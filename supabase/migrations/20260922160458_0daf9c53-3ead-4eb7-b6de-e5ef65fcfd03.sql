
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.ingest_button_event(integer, integer, public.app_env, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ingest_button_event(integer, integer, public.app_env, text, text) TO authenticated, service_role;
