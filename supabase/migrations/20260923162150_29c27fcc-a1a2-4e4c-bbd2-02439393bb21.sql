ALTER TABLE public.display_screens ADD COLUMN IF NOT EXISTS orientation text NOT NULL DEFAULT 'landscape' CHECK (orientation IN ('landscape','portrait'));

CREATE OR REPLACE FUNCTION public.screen_state(p_screen_id uuid, p_device_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_screen public.display_screens%ROWTYPE;
  v_settings public.app_settings%ROWTYPE;
  v_calls jsonb;
  v_window integer;
BEGIN
  SELECT * INTO v_screen FROM public.display_screens
    WHERE id = p_screen_id AND device_token_hash IS NOT NULL
      AND device_token_hash = public.hash_token(p_device_token);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unpaired');
  END IF;
  UPDATE public.display_screens SET last_seen_at = now() WHERE id = v_screen.id;
  SELECT * INTO v_settings FROM public.app_settings WHERE id = 'global';
  v_window := COALESCE(v_settings.attended_card_seconds, 10);
  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.called_at), '[]'::jsonb) INTO v_calls
  FROM (
    SELECT id, table_number, status, called_at, attended_at, duration_seconds,
           assigned_waiter_name, environment
    FROM public.calls
    WHERE environment = v_screen.environment
      AND (v_screen.table_numbers IS NULL OR table_number = ANY (v_screen.table_numbers))
      AND (status = 'pending' OR attended_at > now() - make_interval(secs => v_window + 5))
  ) c;
  RETURN jsonb_build_object(
    'ok', true,
    'server_time', now(),
    'screen', jsonb_build_object('id', v_screen.id, 'name', v_screen.name,
                                 'tables', v_screen.table_numbers,
                                 'environment', v_screen.environment,
                                 'orientation', v_screen.orientation),
    'settings', jsonb_build_object(
       'attended_card_seconds', v_window,
       'sound_alerts', v_settings.sound_alerts,
       'wait_threshold_seconds', v_settings.wait_threshold_seconds),
    'calls', v_calls);
END;
$$;

CREATE OR REPLACE FUNCTION public.screen_set_orientation(p_screen_id uuid, p_device_token text, p_pin_session text, p_orientation text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_orientation NOT IN ('landscape','portrait') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_orientation');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.display_screens WHERE id = p_screen_id
      AND device_token_hash IS NOT NULL AND device_token_hash = public.hash_token(p_device_token)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unpaired');
  END IF;
  IF NOT public.screen_session_valid(p_screen_id, p_pin_session) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_expired');
  END IF;
  UPDATE public.display_screens SET orientation = p_orientation WHERE id = p_screen_id;
  RETURN jsonb_build_object('ok', true, 'orientation', p_orientation);
END;
$$;
REVOKE ALL ON FUNCTION public.screen_set_orientation(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.screen_set_orientation(uuid, text, text, text) TO anon, authenticated, service_role;