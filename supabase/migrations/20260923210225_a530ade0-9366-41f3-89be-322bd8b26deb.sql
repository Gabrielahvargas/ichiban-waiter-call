CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','staff'));
$$;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "lighting_commands_select" ON public.lighting_commands;
CREATE POLICY "lighting_commands_select" ON public.lighting_commands FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "waiters readable by authenticated" ON public.waiters;
CREATE POLICY "waiters readable by team" ON public.waiters FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "dining_tables_select" ON public.dining_tables;
CREATE POLICY "dining_tables_select" ON public.dining_tables FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "button_events_select" ON public.button_events;
CREATE POLICY "button_events_select" ON public.button_events FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "assignments readable by authenticated" ON public.waiter_assignments;
CREATE POLICY "assignments readable by team" ON public.waiter_assignments FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "bulbs_select" ON public.bulbs;
CREATE POLICY "bulbs_select" ON public.bulbs FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "calls_select" ON public.calls;
CREATE POLICY "calls_select" ON public.calls FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "app_settings_select" ON public.app_settings;
CREATE POLICY "app_settings_select" ON public.app_settings FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "user_roles_select_authenticated" ON public.user_roles;
CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));