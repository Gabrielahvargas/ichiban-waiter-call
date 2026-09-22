
CREATE OR REPLACE FUNCTION public.generate_pairing_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.display_screens WHERE pairing_code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;
REVOKE ALL ON FUNCTION public.generate_pairing_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_pairing_code() TO service_role;

CREATE OR REPLACE FUNCTION public.admin_create_screen(
  p_name text,
  p_tables integer[] DEFAULT NULL,
  p_environment public.app_env DEFAULT 'production'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text; v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'unauthorized'; END IF;
  v_code := public.generate_pairing_code();
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
  v_code := public.generate_pairing_code();
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

REVOKE ALL ON FUNCTION public.admin_create_screen(text, integer[], public.app_env) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_screen(text, integer[], public.app_env) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_regenerate_pairing_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_regenerate_pairing_code(uuid) TO authenticated, service_role;
