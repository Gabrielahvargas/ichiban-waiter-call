CREATE TABLE public.sales_sync_state (
  environment public.app_env PRIMARY KEY,
  source text NOT NULL DEFAULT 'tabit',
  status text NOT NULL DEFAULT 'not_configured',
  cursor text,
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sales_sync_state TO authenticated;
GRANT ALL ON public.sales_sync_state TO service_role;
ALTER TABLE public.sales_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_sync_state_admin_read ON public.sales_sync_state FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.sales_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment public.app_env NOT NULL DEFAULT 'production',
  trigger text NOT NULL DEFAULT 'manual',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  items_upserted integer NOT NULL DEFAULT 0,
  error text
);
GRANT SELECT ON public.sales_sync_runs TO authenticated;
GRANT ALL ON public.sales_sync_runs TO service_role;
ALTER TABLE public.sales_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_sync_runs_admin_read ON public.sales_sync_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.sales_waiters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment public.app_env NOT NULL DEFAULT 'production',
  external_id text NOT NULL,
  name text NOT NULL,
  waiter_id uuid REFERENCES public.waiters(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (environment, external_id)
);
GRANT SELECT, UPDATE ON public.sales_waiters TO authenticated;
GRANT ALL ON public.sales_waiters TO service_role;
ALTER TABLE public.sales_waiters ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_waiters_admin ON public.sales_waiters FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.sales_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment public.app_env NOT NULL DEFAULT 'production',
  external_id text NOT NULL,
  sold_at timestamptz NOT NULL,
  service_date date,
  shift public.app_shift,
  waiter_external_id text,
  waiter_name text,
  product_name text NOT NULL,
  tabit_category text,
  quantity numeric NOT NULL DEFAULT 1,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (environment, external_id)
);
CREATE INDEX sales_items_env_date_idx ON public.sales_items (environment, service_date);
GRANT SELECT ON public.sales_items TO authenticated;
GRANT ALL ON public.sales_items TO service_role;
ALTER TABLE public.sales_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_items_admin_read ON public.sales_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.sales_items_set_slot()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  SELECT s.service_date, s.shift INTO NEW.service_date, NEW.shift FROM public.current_service_slot(NEW.sold_at) s;
  RETURN NEW;
END; $$;
CREATE TRIGGER sales_items_slot BEFORE INSERT OR UPDATE OF sold_at ON public.sales_items
  FOR EACH ROW EXECUTE FUNCTION public.sales_items_set_slot();

CREATE TABLE public.sales_category_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_type text NOT NULL DEFAULT 'keyword' CHECK (match_type IN ('keyword','tabit_category')),
  pattern text NOT NULL,
  target text NOT NULL CHECK (target IN ('alcohol','sushi','ignore')),
  priority integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_category_rules TO authenticated;
GRANT ALL ON public.sales_category_rules TO service_role;
ALTER TABLE public.sales_category_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_rules_admin ON public.sales_category_rules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.sales_sync_state (environment, status) VALUES ('production','not_configured'), ('demo','demo') ON CONFLICT DO NOTHING;