
ALTER TABLE public.dining_tables
  ADD COLUMN IF NOT EXISTS call_click_type text NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS attend_click_type text NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS tuya_cursor_ms bigint;

DO $$ BEGIN
  ALTER TABLE public.dining_tables
    ADD CONSTRAINT dining_tables_call_click_type_chk CHECK (call_click_type IN ('single','double','long'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.dining_tables
    ADD CONSTRAINT dining_tables_attend_click_type_chk CHECK (attend_click_type IN ('single','double','long'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.tuya_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'poll',
  device_id text,
  table_number integer,
  button integer,
  click_type text,
  result text,
  error text,
  raw jsonb
);

GRANT SELECT ON public.tuya_event_log TO authenticated;
GRANT ALL ON public.tuya_event_log TO service_role;
ALTER TABLE public.tuya_event_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read tuya log" ON public.tuya_event_log;
CREATE POLICY "Admins read tuya log" ON public.tuya_event_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS tuya_event_log_received_idx ON public.tuya_event_log (received_at DESC);

CREATE OR REPLACE FUNCTION public.ingest_button_event(p_table_number integer, p_button integer, p_environment app_env, p_idempotency_key text, p_source text DEFAULT 'demo'::text, p_click_type text DEFAULT 'single'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing public.button_events%ROWTYPE;
  v_call public.calls%ROWTYPE;
  v_settings public.app_settings%ROWTYPE;
  v_table public.dining_tables%ROWTYPE;
  v_cooldown integer := 0;
  v_action text;
  v_click text;
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

  SELECT * INTO v_settings FROM public.app_settings WHERE id = 'global';
  v_cooldown := CASE v_settings.new_call_rule WHEN 'after_10s' THEN 10 WHEN 'after_30s' THEN 30 ELSE 0 END;
  SELECT s.service_date, s.shift INTO v_date, v_shift FROM public.current_service_slot() s;

  SELECT * INTO v_table FROM public.dining_tables WHERE table_number = p_table_number;
  v_click := COALESCE(p_click_type, 'single');

  IF v_table.table_number IS NULL THEN
    v_action := NULL;
  ELSIF p_button = v_table.call_button AND v_click = COALESCE(v_table.call_click_type, 'single') THEN
    v_action := 'call';
  ELSIF p_button = v_table.attend_button AND v_click = COALESCE(v_table.attend_click_type, 'single') THEN
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
            cooldown_until = CASE WHEN v_cooldown > 0 THEN now() + make_interval(secs => v_cooldown) ELSE NULL END
        WHERE id = v_call.id
        RETURNING id INTO v_call_id;
      v_result := 'call_attended';

      IF p_environment = 'production'
         AND NOT EXISTS (SELECT 1 FROM public.calls WHERE environment = 'production' AND status = 'pending') THEN
        INSERT INTO public.lighting_commands (target, action, color, environment)
        VALUES ('waiter_area', 'set_color', v_settings.shared_light_color, p_environment);
      END IF;
    END IF;
  ELSE
    v_result := 'ignored_unmapped_button';
  END IF;

  INSERT INTO public.button_events (table_number, button, environment, idempotency_key, source, result, call_id)
  VALUES (p_table_number, p_button, p_environment, p_idempotency_key, p_source, v_result, v_call_id);

  RETURN jsonb_build_object('result', v_result, 'call_id', v_call_id, 'duplicate', false);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ingest_button_event(integer, integer, app_env, text, text, text) TO authenticated, service_role;
