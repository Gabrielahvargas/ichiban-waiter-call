
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TYPE public.app_shift AS ENUM ('lunch', 'dinner');

-- settings additions
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Chicago',
  ADD COLUMN IF NOT EXISTS dinner_start_hour integer NOT NULL DEFAULT 16;

-- ---------------------------------------------------------------- waiters
CREATE TABLE public.waiters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  code text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waiters TO authenticated;
GRANT ALL ON public.waiters TO service_role;
ALTER TABLE public.waiters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "waiters readable by authenticated" ON public.waiters
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "waiters managed by admins" ON public.waiters
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- --------------------------------------------------------- assignments
CREATE TABLE public.waiter_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waiter_id uuid NOT NULL REFERENCES public.waiters(id) ON DELETE CASCADE,
  table_number integer NOT NULL,
  service_date date NOT NULL,
  shift public.app_shift NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX waiter_assignments_active_table
  ON public.waiter_assignments (table_number, service_date, shift)
  WHERE effective_to IS NULL;
CREATE INDEX waiter_assignments_lookup
  ON public.waiter_assignments (service_date, shift, table_number);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waiter_assignments TO authenticated;
GRANT ALL ON public.waiter_assignments TO service_role;
ALTER TABLE public.waiter_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assignments readable by authenticated" ON public.waiter_assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "assignments managed by admins" ON public.waiter_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ------------------------------------------------------------- calls cols
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS assigned_waiter_id uuid REFERENCES public.waiters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_waiter_name text,
  ADD COLUMN IF NOT EXISTS service_date date,
  ADD COLUMN IF NOT EXISTS shift public.app_shift;
CREATE INDEX IF NOT EXISTS calls_service_date_idx ON public.calls (service_date, shift);

-- ------------------------------------------------------------ screens
CREATE TABLE public.display_screens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  environment public.app_env NOT NULL DEFAULT 'production',
  table_numbers integer[],
  pairing_code text,
  pairing_code_expires_at timestamptz,
  device_token_hash text,
  paired_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX display_screens_pairing_code
  ON public.display_screens (pairing_code) WHERE pairing_code IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.display_screens TO authenticated;
GRANT ALL ON public.display_screens TO service_role;
ALTER TABLE public.display_screens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "screens managed by admins" ON public.display_screens
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ------------------------------------------------------------ admin pin
CREATE TABLE public.admin_pin (
  id text PRIMARY KEY DEFAULT 'global',
  pin_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT ALL ON public.admin_pin TO service_role;
ALTER TABLE public.admin_pin ENABLE ROW LEVEL SECURITY;
-- no policies: reachable only through security definer functions

CREATE TABLE public.admin_pin_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id uuid,
  success boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_pin_attempts TO service_role;
ALTER TABLE public.admin_pin_attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.screen_pin_sessions (
  token_hash text PRIMARY KEY,
  screen_id uuid NOT NULL REFERENCES public.display_screens(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.screen_pin_sessions TO service_role;
ALTER TABLE public.screen_pin_sessions ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------ helpers
CREATE OR REPLACE FUNCTION public.current_service_slot(p_at timestamptz DEFAULT now())
RETURNS TABLE (service_date date, shift public.app_shift)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tz text;
  v_hour integer;
  v_local timestamp;
  v_dinner integer;
BEGIN
  SELECT COALESCE(timezone, 'America/Chicago'), COALESCE(dinner_start_hour, 16)
    INTO v_tz, v_dinner FROM public.app_settings WHERE id = 'global';
  v_tz := COALESCE(v_tz, 'America/Chicago');
  v_dinner := COALESCE(v_dinner, 16);
  v_local := p_at AT TIME ZONE v_tz;
  v_hour := EXTRACT(HOUR FROM v_local)::int;
  service_date := v_local::date;
  shift := CASE WHEN v_hour < v_dinner THEN 'lunch'::public.app_shift ELSE 'dinner'::public.app_shift END;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.hash_token(p_token text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

-- ------------------------------------------- call state machine (updated)
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
  IF auth.uid() IS NULL THEN
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

-- --------------------------------------------------- assignment writer
CREATE OR REPLACE FUNCTION public.set_table_assignment(
  p_table_number integer,
  p_service_date date,
  p_shift public.app_shift,
  p_waiter_id uuid,
  p_actor uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE public.waiter_assignments
    SET effective_to = now(), updated_at = now()
    WHERE table_number = p_table_number
      AND service_date = p_service_date
      AND shift = p_shift
      AND effective_to IS NULL
      AND (p_waiter_id IS NULL OR waiter_id IS DISTINCT FROM p_waiter_id);

  IF p_waiter_id IS NOT NULL THEN
    INSERT INTO public.waiter_assignments (waiter_id, table_number, service_date, shift, created_by)
    VALUES (p_waiter_id, p_table_number, p_service_date, p_shift, p_actor)
    ON CONFLICT (table_number, service_date, shift) WHERE effective_to IS NULL DO NOTHING
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object('assignment_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_table_assignment(
  p_table_number integer,
  p_service_date date,
  p_shift public.app_shift,
  p_waiter_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN public.set_table_assignment(p_table_number, p_service_date, p_shift, p_waiter_id, auth.uid());
END;
$$;

-- ------------------------------------------------------------- pin
CREATE OR REPLACE FUNCTION public.admin_set_pin(p_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF p_pin !~ '^[0-9]{4,8}$' THEN
    RAISE EXCEPTION 'pin must be 4 to 8 digits';
  END IF;
  INSERT INTO public.admin_pin (id, pin_hash, updated_at, updated_by)
  VALUES ('global', extensions.crypt(p_pin, extensions.gen_salt('bf')), now(), auth.uid())
  ON CONFLICT (id) DO UPDATE
    SET pin_hash = EXCLUDED.pin_hash, updated_at = now(), updated_by = EXCLUDED.updated_by;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_pin_configured()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_pin WHERE id = 'global');
$$;

-- ------------------------------------------------- screen pairing/session
CREATE OR REPLACE FUNCTION public.admin_create_screen(p_name text, p_tables integer[] DEFAULT NULL,
                                                      p_environment public.app_env DEFAULT 'production')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text; v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'unauthorized'; END IF;
  LOOP
    v_code := upper(translate(encode(extensions.gen_random_bytes(8), 'base32'), '01IOU=', 'ABCDEF'));
    v_code := substr(regexp_replace(v_code, '[^A-Z2-9]', '', 'g'), 1, 6);
    EXIT WHEN length(v_code) = 6 AND NOT EXISTS (SELECT 1 FROM public.display_screens WHERE pairing_code = v_code);
  END LOOP;
  INSERT INTO public.display_screens (name, table_numbers, environment, pairing_code, pairing_code_expires_at)
  VALUES (p_name, p_tables, p_environment, v_code, now() + interval '15 minutes')
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'pairing_code', v_code, 'expires_at', now() + interval '15 minutes');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_regenerate_pairing_code(p_screen_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'unauthorized'; END IF;
  LOOP
    v_code := substr(regexp_replace(upper(encode(extensions.gen_random_bytes(8), 'base32')), '[^A-Z2-9]', '', 'g'), 1, 6);
    EXIT WHEN length(v_code) = 6 AND NOT EXISTS (SELECT 1 FROM public.display_screens WHERE pairing_code = v_code);
  END LOOP;
  UPDATE public.display_screens
    SET pairing_code = v_code,
        pairing_code_expires_at = now() + interval '15 minutes',
        device_token_hash = NULL,
        paired_at = NULL,
        updated_at = now()
    WHERE id = p_screen_id;
  RETURN jsonb_build_object('pairing_code', v_code, 'expires_at', now() + interval '15 minutes');
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_pairing_code(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_screen public.display_screens%ROWTYPE; v_token text;
BEGIN
  SELECT * INTO v_screen FROM public.display_screens
    WHERE pairing_code = upper(trim(p_code))
      AND pairing_code_expires_at > now()
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  END IF;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  UPDATE public.display_screens
    SET device_token_hash = public.hash_token(v_token),
        paired_at = now(),
        pairing_code = NULL,
        pairing_code_expires_at = NULL,
        last_seen_at = now(),
        updated_at = now()
    WHERE id = v_screen.id;
  RETURN jsonb_build_object('ok', true, 'screen_id', v_screen.id, 'device_token', v_token,
                            'name', v_screen.name);
END;
$$;

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
                                 'environment', v_screen.environment),
    'settings', jsonb_build_object(
       'attended_card_seconds', v_window,
       'sound_alerts', v_settings.sound_alerts,
       'wait_threshold_seconds', v_settings.wait_threshold_seconds),
    'calls', v_calls);
END;
$$;

CREATE OR REPLACE FUNCTION public.screen_verify_pin(p_screen_id uuid, p_device_token text, p_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hash text; v_fails integer; v_token text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.display_screens
                 WHERE id = p_screen_id AND device_token_hash = public.hash_token(p_device_token)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unpaired');
  END IF;

  SELECT count(*) INTO v_fails FROM public.admin_pin_attempts
    WHERE screen_id = p_screen_id AND NOT success AND attempted_at > now() - interval '15 minutes';
  IF v_fails >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  SELECT pin_hash INTO v_hash FROM public.admin_pin WHERE id = 'global';
  IF v_hash IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_configured');
  END IF;

  IF extensions.crypt(p_pin, v_hash) = v_hash THEN
    INSERT INTO public.admin_pin_attempts (screen_id, success) VALUES (p_screen_id, true);
    v_token := encode(extensions.gen_random_bytes(24), 'hex');
    INSERT INTO public.screen_pin_sessions (token_hash, screen_id, expires_at)
    VALUES (public.hash_token(v_token), p_screen_id, now() + interval '30 minutes');
    DELETE FROM public.screen_pin_sessions WHERE expires_at < now();
    RETURN jsonb_build_object('ok', true, 'pin_session', v_token,
                              'expires_at', now() + interval '30 minutes');
  END IF;

  INSERT INTO public.admin_pin_attempts (screen_id, success) VALUES (p_screen_id, false);
  RETURN jsonb_build_object('ok', false, 'error', 'invalid_pin',
                            'remaining', GREATEST(0, 4 - v_fails));
END;
$$;

CREATE OR REPLACE FUNCTION public.screen_session_valid(p_screen_id uuid, p_pin_session text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.screen_pin_sessions
                 WHERE screen_id = p_screen_id
                   AND token_hash = public.hash_token(p_pin_session)
                   AND expires_at > now());
$$;

-- TV menu: only waiter assignment is exposed, nothing else.
CREATE OR REPLACE FUNCTION public.screen_assignment_board(
  p_screen_id uuid, p_pin_session text, p_service_date date DEFAULT NULL, p_shift public.app_shift DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_date date; v_shift public.app_shift;
BEGIN
  IF NOT public.screen_session_valid(p_screen_id, p_pin_session) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_expired');
  END IF;
  SELECT s.service_date, s.shift INTO v_date, v_shift FROM public.current_service_slot() s;
  v_date := COALESCE(p_service_date, v_date);
  v_shift := COALESCE(p_shift, v_shift);

  RETURN jsonb_build_object(
    'ok', true,
    'service_date', v_date,
    'shift', v_shift,
    'waiters', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'full_name', full_name)
                                          ORDER BY full_name), '[]'::jsonb)
                FROM public.waiters WHERE active),
    'assignments', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                        'table_number', table_number, 'waiter_id', waiter_id)), '[]'::jsonb)
                    FROM public.waiter_assignments
                    WHERE service_date = v_date AND shift = v_shift AND effective_to IS NULL));
END;
$$;

CREATE OR REPLACE FUNCTION public.screen_set_assignment(
  p_screen_id uuid, p_pin_session text, p_table_number integer,
  p_service_date date, p_shift public.app_shift, p_waiter_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.screen_session_valid(p_screen_id, p_pin_session) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_expired');
  END IF;
  PERFORM public.set_table_assignment(p_table_number, p_service_date, p_shift, p_waiter_id, NULL);
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- --------------------------------------------------------------- grants
REVOKE ALL ON FUNCTION public.set_table_assignment(integer, date, public.app_shift, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_table_assignment(integer, date, public.app_shift, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.hash_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hash_token(text) TO service_role;

GRANT EXECUTE ON FUNCTION public.current_service_slot(timestamptz) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_table_assignment(integer, date, public.app_shift, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_pin(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_pin_configured() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_create_screen(text, integer[], public.app_env) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_regenerate_pairing_code(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_pairing_code(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.screen_state(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.screen_verify_pin(uuid, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.screen_session_valid(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.screen_assignment_board(uuid, text, date, public.app_shift) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.screen_set_assignment(uuid, text, integer, date, public.app_shift, uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER waiters_updated_at BEFORE UPDATE ON public.waiters
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER display_screens_updated_at BEFORE UPDATE ON public.display_screens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
