CREATE TABLE public.show_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  stop_at timestamptz,
  stopped_at timestamptz
);
GRANT SELECT ON public.show_runs TO authenticated;
GRANT ALL ON public.show_runs TO service_role;
ALTER TABLE public.show_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY show_runs_admin_read ON public.show_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));