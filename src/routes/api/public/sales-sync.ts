import { createFileRoute } from "@tanstack/react-router";

/** Called every 30 min by the database scheduler; authenticated with a DB-held token. */
export const Route = createFileRoute("/api/public/sales-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-sales-cron-token") ?? "";
        if (!/^[0-9a-f]{64}$/.test(token)) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: valid } = await supabaseAdmin.rpc("sales_cron_token_valid", { p_token: token });
        if (!valid) return new Response("Unauthorized", { status: 401 });
        const { runSalesSync } = await import("@/lib/sales/sync.server");
        const result = await runSalesSync("schedule");
        return Response.json(result);
      },
    },
  },
});
