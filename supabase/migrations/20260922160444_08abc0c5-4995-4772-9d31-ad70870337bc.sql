
-- ROLES ---------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');
CREATE TYPE public.call_status AS ENUM ('pending', 'attended');
CREATE TYPE public.app_env AS ENUM ('production', 'demo');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  language text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "user_roles_select_authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_admin_write" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- First signed-up account becomes admin; everyone gets a profile.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, language)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), 'en')
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- TABLES / BULBS / DEVICES ---------------------------------------------
CREATE TABLE public.dining_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number integer NOT NULL UNIQUE,
  alert_bulb_code text NOT NULL,
  button_device_external_id text,
  gateway_external_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dining_tables TO authenticated;
GRANT ALL ON public.dining_tables TO service_role;
ALTER TABLE public.dining_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dining_tables_select" ON public.dining_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "dining_tables_admin_write" ON public.dining_tables FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.bulbs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number integer NOT NULL REFERENCES public.dining_tables(table_number) ON DELETE CASCADE,
  bulb_code text NOT NULL UNIQUE,
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bulbs TO authenticated;
GRANT ALL ON public.bulbs TO service_role;
ALTER TABLE public.bulbs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bulbs_select" ON public.bulbs FOR SELECT TO authenticated USING (true);
CREATE POLICY "bulbs_admin_write" ON public.bulbs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- CALLS -----------------------------------------------------------------
CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number integer NOT NULL,
  environment public.app_env NOT NULL DEFAULT 'production',
  status public.call_status NOT NULL DEFAULT 'pending',
  called_at timestamptz NOT NULL DEFAULT now(),
  attended_at timestamptz,
  duration_seconds integer,
  attended_by uuid,
  cooldown_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX calls_one_pending_per_table ON public.calls (table_number, environment) WHERE status = 'pending';
CREATE INDEX calls_called_at_idx ON public.calls (environment, called_at DESC);
GRANT SELECT ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calls_select" ON public.calls FOR SELECT TO authenticated USING (true);
CREATE POLICY "calls_admin_write" ON public.calls FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.button_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  table_number integer NOT NULL,
  button integer NOT NULL,
  environment public.app_env NOT NULL DEFAULT 'production',
  source text NOT NULL DEFAULT 'demo',
  call_id uuid,
  result text,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.button_events TO authenticated;
GRANT ALL ON public.button_events TO service_role;
ALTER TABLE public.button_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "button_events_select" ON public.button_events FOR SELECT TO authenticated USING (true);

CREATE TABLE public.lighting_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target text NOT NULL,
  bulb_code text,
  action text NOT NULL,
  color text,
  duration_ms integer,
  environment public.app_env NOT NULL DEFAULT 'production',
  dispatch_status text NOT NULL DEFAULT 'pending_integration',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lighting_commands TO authenticated;
GRANT ALL ON public.lighting_commands TO service_role;
ALTER TABLE public.lighting_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lighting_commands_select" ON public.lighting_commands FOR SELECT TO authenticated USING (true);

-- SETTINGS ---------------------------------------------------------------
CREATE TABLE public.app_settings (
  id text PRIMARY KEY DEFAULT 'global',
  output_mode text NOT NULL DEFAULT 'both',
  new_call_rule text NOT NULL DEFAULT 'immediate',
  sound_alerts text NOT NULL DEFAULT 'every_call',
  wait_threshold_seconds integer NOT NULL DEFAULT 300,
  attended_card_seconds integer NOT NULL DEFAULT 10,
  local_red_seconds integer NOT NULL DEFAULT 3,
  shared_light_color text NOT NULL DEFAULT '#ffd9a0',
  shared_light_alert_color text NOT NULL DEFAULT '#ff0000',
  log_retention_days integer NOT NULL DEFAULT 90,
  gateway_external_id text,
  integration_status text NOT NULL DEFAULT 'pending',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_settings_select" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_settings_admin_write" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings (id) VALUES ('global');

-- SEED TABLES AND BULBS ---------------------------------------------------
INSERT INTO public.dining_tables (table_number, alert_bulb_code) VALUES
 (100,'101'),(200,'201'),(300,'301'),(400,'401'),(500,'501'),
 (600,'601'),(700,'701'),(800,'801'),(900,'901'),(1000,'1001');

INSERT INTO public.bulbs (table_number, bulb_code) VALUES
 (100,'101'),(100,'102'),(200,'201'),(200,'202'),(300,'301'),(300,'302'),
 (400,'401'),(400,'402'),(500,'501'),(500,'502'),(600,'601'),(600,'602'),
 (700,'701'),(700,'702'),(800,'801'),(800,'802'),(900,'901'),(900,'902'),
 (1000,'1001'),(1000,'1002');

-- EVENT INGESTION (atomic, idempotent) -------------------------------------
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
        INSERT INTO public.calls (table_number, environment, status)
        VALUES (p_table_number, p_environment, 'pending')
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_call_id;
        v_result := CASE WHEN v_call_id IS NULL THEN 'ignored_already_pending' ELSE 'call_created' END;

        IF v_result = 'call_created' THEN
          INSERT INTO public.lighting_commands (target, bulb_code, action, color, duration_ms, environment)
          SELECT 'table_bulb', dt.alert_bulb_code, 'flash_red', '#ff0000',
                 v_settings.local_red_seconds * 1000, p_environment
          FROM public.dining_tables dt WHERE dt.table_number = p_table_number;

          INSERT INTO public.lighting_commands (target, action, color, environment)
          VALUES ('waiter_area', 'set_color', v_settings.shared_light_alert_color, p_environment);
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

      IF NOT EXISTS (
        SELECT 1 FROM public.calls
        WHERE environment = p_environment AND status = 'pending'
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

GRANT EXECUTE ON FUNCTION public.ingest_button_event(integer, integer, public.app_env, text, text) TO authenticated;

ALTER TABLE public.app_settings REPLICA IDENTITY FULL;
ALTER TABLE public.calls REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
