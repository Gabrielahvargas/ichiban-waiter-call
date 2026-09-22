
CREATE OR REPLACE FUNCTION public.ingest_button_event(
  p_table_number integer,
  p_button integer,
  p_environment public.app_env,
  p_idempotency_key text,
  p_source text DEFAULT 'demo'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing public.button_events%ROWTYPE;
  v_call public.calls%ROWTYPE;
  v_settings public.app_settings%ROWTYPE;
  v_cooldown integer := 0;
  v_result text;
  v_call_id uuid;
  v_date date;
  v_shift public.app_shift;
  v_waiter_id uuid;
  v_waiter_name text;
BEGIN
  -- Signed-in operators, or the trusted server role used by the verified gateway webhook.
  IF auth.uid() IS NULL AND current_user NOT IN ('service_role', 'supabase_admin', 'postgres') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_existing FROM public.button_events WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('result', v_existing.result, 'call_id', v_existing.call_id, 'duplicate', true);
  END IF;

  SELECT * INTO v_settings FROM public.app_settings WHERE id = 'global';
  v_cooldown := CASE v_settings.new_call_rule WHEN 'after_10s' THEN 10 WHEN 'after_30s' THEN 30 ELSE 0 END;
  SELECT s.service_date, s.shift INTO v_date, v_shift FROM public.current_service_slot() s;

  IF p_button = 3 THEN
    SELECT * INTO v_call FROM public.calls
      WHERE table_number = p_table_number AND environment = p_environment AND status = 'pending'
      FOR UPDATE;
    IF FOUND THEN
      v_result := 'ignored_already_pending';
      v_call_id := v_call.id;
    ELSE
      SELECT * INTO v_call FROM public.calls
        WHERE table_number = p_table_number AND environment = p_environment AND status = 'attended'
        ORDER BY attended_at DESC NULLS LAST LIMIT 1;
      IF FOUND AND v_call.cooldown_until IS NOT NULL AND v_call.cooldown_until > now() THEN
        v_result := 'ignored_cooldown';
        v_call_id := NULL;
      ELSE
        SELECT wa.waiter_id, w.full_name INTO v_waiter_id, v_waiter_name
        FROM public.waiter_assignments wa
        JOIN public.waiters w ON w.id = wa.waiter_id
        WHERE wa.table_number = p_table_number
          AND wa.service_date = v_date
          AND wa.shift = v_shift
          AND wa.effective_from <= now()
          AND wa.effective_to IS NULL
        LIMIT 1;

        INSERT INTO public.calls (table_number, environment, status, service_date, shift,
                                  assigned_waiter_id, assigned_waiter_name)
        VALUES (p_table_number, p_environment, 'pending', v_date, v_shift, v_waiter_id, v_waiter_name)
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_call_id;
        v_result := CASE WHEN v_call_id IS NULL THEN 'ignored_already_pending' ELSE 'call_created' END;

        IF v_result = 'call_created' THEN
          INSERT INTO public.lighting_commands (target, bulb_code, action, color, duration_ms, environment)
          SELECT 'table_bulb', dt.alert_bulb_code, 'flash_red', '#ff0000',
                 v_settings.local_red_seconds * 1000, p_environment
          FROM public.dining_tables dt WHERE dt.table_number = p_table_number;

          IF p_environment = 'production' THEN
            INSERT INTO public.lighting_commands (target, action, color, environment)
            VALUES ('waiter_area', 'set_color', v_settings.shared_light_alert_color, p_environment);
          END IF;
        END IF;
      END IF;
    END IF;

  ELSIF p_button = 4 THEN
    SELECT * INTO v_call FROM public.calls
      WHERE table_number = p_table_number AND environment = p_environment AND status = 'pending'
      FOR UPDATE;
    IF NOT FOUND THEN
      v_result := 'ignored_no_pending';
    ELSE
      UPDATE public.calls
        SET status = 'attended',
            attended_at = now(),
            attended_by = auth.uid(),
            duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (now() - called_at))::int),
            cooldown_until = now() + make_interval(secs => v_cooldown)
        WHERE id = v_call.id;
      v_call_id := v_call.id;
      v_result := 'call_attended';

      IF p_environment = 'production' AND NOT EXISTS (
        SELECT 1 FROM public.calls WHERE environment = 'production' AND status = 'pending'
      ) THEN
        INSERT INTO public.lighting_commands (target, action, color, environment)
        VALUES ('waiter_area', 'restore_color', v_settings.shared_light_color, p_environment);
      END IF;
    END IF;
  ELSE
    v_result := 'ignored_unmapped_button';
  END IF;

  INSERT INTO public.button_events (idempotency_key, table_number, button, environment, source, call_id, result)
  VALUES (p_idempotency_key, p_table_number, p_button, p_environment, p_source, v_call_id, v_result);

  RETURN jsonb_build_object('result', v_result, 'call_id', v_call_id, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_button_event(integer, integer, public.app_env, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ingest_button_event(integer, integer, public.app_env, text, text)
  TO authenticated, service_role;
