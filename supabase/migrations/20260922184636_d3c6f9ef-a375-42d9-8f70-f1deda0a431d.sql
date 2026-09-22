
ALTER TABLE public.dining_tables
  ADD COLUMN IF NOT EXISTS call_click_type text NOT NULL DEFAULT 'single_click',
  ADD COLUMN IF NOT EXISTS attend_click_type text NOT NULL DEFAULT 'single_click';

UPDATE public.dining_tables SET call_click_type = 'single_click' WHERE call_click_type IS NULL OR call_click_type = '';
UPDATE public.dining_tables SET attend_click_type = 'single_click' WHERE attend_click_type IS NULL OR attend_click_type = '';

ALTER TABLE public.dining_tables
  DROP CONSTRAINT IF EXISTS dining_tables_buttons_distinct,
  ADD CONSTRAINT dining_tables_button_action_distinct
    CHECK (NOT (call_button = attend_button AND call_click_type = attend_click_type));

ALTER TABLE public.button_events
  ADD COLUMN IF NOT EXISTS click_type text,
  ADD COLUMN IF NOT EXISTS device_id text;

CREATE INDEX IF NOT EXISTS dining_tables_device_id_idx ON public.dining_tables(button_device_external_id);

DROP FUNCTION IF EXISTS public.ingest_button_event(integer, integer, public.app_env, text, text);
DROP FUNCTION IF EXISTS public.ingest_button_event(integer, integer, public.app_env, text, text, text);

CREATE OR REPLACE FUNCTION public.ingest_button_event(
  p_table_number integer,
  p_button integer,
  p_environment public.app_env,
  p_idempotency_key text,
  p_source text DEFAULT 'demo',
  p_click_type text DEFAULT 'single',
  p_device_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing public.button_events%ROWTYPE;
  v_call public.calls%ROWTYPE;
  v_settings public.app_settings%ROWTYPE;
  v_table public.dining_tables%ROWTYPE;
  v_cooldown integer := 0;
  v_click_normalized text;
  v_action text;
  v_result text;
  v_call_id uuid;
  v_date date;
  v_shift public.app_shift;
  v_waiter_id uuid;
  v_waiter_name text;
BEGIN
  IF auth.uid() IS NULL AND current_user NOT IN ('service_role', 'supabase_admin', 'postgres') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_existing FROM public.button_events WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('result', v_existing.result, 'call_id', v_existing.call_id, 'duplicate', true);
  END IF;

  -- Resolve table by device ID when the gateway forwards a Tuya devId.
  IF p_device_id IS NOT NULL THEN
    SELECT * INTO v_table FROM public.dining_tables WHERE button_device_external_id = p_device_id;
    IF FOUND THEN
      p_table_number := v_table.table_number;
    END IF;
  ELSIF p_table_number IS NOT NULL THEN
    SELECT * INTO v_table FROM public.dining_tables WHERE table_number = p_table_number;
  END IF;

  IF v_table.table_number IS NULL THEN
    v_result := 'ignored_unmapped_device';
    INSERT INTO public.button_events (idempotency_key, table_number, button, click_type, device_id, environment, source, call_id, result)
    VALUES (p_idempotency_key, COALESCE(p_table_number, 0), p_button, p_click_type, p_device_id, p_environment, p_source, NULL, v_result)
    ON CONFLICT (idempotency_key) DO NOTHING;
    RETURN jsonb_build_object('result', v_result, 'call_id', NULL, 'duplicate', false);
  END IF;

  p_table_number := v_table.table_number;

  SELECT * INTO v_settings FROM public.app_settings WHERE id = 'global';
  v_cooldown := CASE v_settings.new_call_rule WHEN 'after_10s' THEN 10 WHEN 'after_30s' THEN 30 ELSE 0 END;
  SELECT s.service_date, s.shift INTO v_date, v_shift FROM public.current_service_slot() s;

  v_click_normalized := lower(coalesce(p_click_type, 'single'));
  v_click_normalized := CASE
    WHEN v_click_normalized IN ('single', 'single_click', 'click') THEN 'single_click'
    WHEN v_click_normalized IN ('double', 'double_click') THEN 'double_click'
    WHEN v_click_normalized IN ('long', 'long_click', 'long_press', 'press') THEN 'long_click'
    ELSE v_click_normalized
  END;

  IF p_button = v_table.call_button AND v_click_normalized = v_table.call_click_type THEN
    v_action := 'call';
  ELSIF p_button = v_table.attend_button AND v_click_normalized = v_table.attend_click_type THEN
    v_action := 'attend';
  ELSE
    v_action := NULL;
  END IF;

  IF v_action = 'call' THEN
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

  ELSIF v_action = 'attend' THEN
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

  INSERT INTO public.button_events (idempotency_key, table_number, button, click_type, device_id, environment, source, call_id, result)
  VALUES (p_idempotency_key, p_table_number, p_button, p_click_type, p_device_id, p_environment, p_source, v_call_id, v_result)
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN jsonb_build_object('result', v_result, 'call_id', v_call_id, 'duplicate', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ingest_button_event(integer, integer, public.app_env, text, text, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.ingest_button_event(integer, integer, public.app_env, text, text, text, text) FROM PUBLIC, anon;
