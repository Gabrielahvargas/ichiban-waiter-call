-- lovable-cron-fallback-reviewed: Tabit has no public webhook/subscription; user explicitly requires polling every 30 minutes
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.sales_cron_token (
  id text PRIMARY KEY DEFAULT 'global',
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex')
);
GRANT ALL ON public.sales_cron_token TO service_role;
ALTER TABLE public.sales_cron_token ENABLE ROW LEVEL SECURITY;
INSERT INTO public.sales_cron_token (id) VALUES ('global') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.sales_cron_token_valid(p_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.sales_cron_token WHERE id = 'global' AND token = p_token);
$$;
REVOKE ALL ON FUNCTION public.sales_cron_token_valid(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sales_cron_token_valid(text) TO service_role;

CREATE OR REPLACE FUNCTION public.trigger_sales_sync()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_token text;
BEGIN
  SELECT token INTO v_token FROM public.sales_cron_token WHERE id = 'global';
  PERFORM net.http_post(
    url := 'https://project--4c9885f1-6388-4131-bccc-9817a174abd7.lovable.app/api/public/sales-sync',
    headers := jsonb_build_object('Content-Type','application/json','x-sales-cron-token', v_token),
    body := '{}'::jsonb);
END; $$;
REVOKE ALL ON FUNCTION public.trigger_sales_sync() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('tabit-sales-sync', '*/30 * * * *', 'SELECT public.trigger_sales_sync()');