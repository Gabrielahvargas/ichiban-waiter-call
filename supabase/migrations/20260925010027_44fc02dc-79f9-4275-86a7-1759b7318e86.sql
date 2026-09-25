ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS sound_id text NOT NULL DEFAULT 'chime',
  ADD COLUMN IF NOT EXISTS sound_volume integer NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS custom_sound_url text;

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
       'wait_threshold_seconds', v_settings.wait_threshold_seconds,
       'sound_id', v_settings.sound_id,
       'sound_volume', v_settings.sound_volume,
       'custom_sound_url', v_settings.custom_sound_url),
    'calls', v_calls);
END;
$$;

CREATE POLICY "alert sounds public read" ON storage.objects FOR SELECT USING (bucket_id = 'alert-sounds');
CREATE POLICY "alert sounds admin insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'alert-sounds' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "alert sounds admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'alert-sounds' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "alert sounds admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'alert-sounds' AND public.has_role(auth.uid(), 'admin'));