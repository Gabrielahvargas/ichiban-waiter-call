import { fetchSalesSince } from "@/lib/tabit/adapter.server";
import { retryDelayMinutes } from "@/modules/sales/classify";

const SCHEDULE_MINUTES = 30;
const MAX_PAGES = 20;

/** Runs one production sync: pages through the adapter, upserts idempotently, advances the cursor. */
export async function runSalesSync(trigger: "manual" | "schedule") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date();
  const { data: state } = await supabaseAdmin.from("sales_sync_state").select("*").eq("environment", "production").maybeSingle();
  const { data: run } = await supabaseAdmin.from("sales_sync_runs").insert({ environment: "production", trigger }).select("id").single();

  let cursor = state?.cursor ?? null;
  let upserted = 0;
  let failure: { status: string; message: string } | null = null;

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await fetchSalesSince(cursor);
      if (!result.ok) {
        failure = { status: result.reason === "not_configured" ? "not_configured" : "error", message: result.message };
        break;
      }
      if (result.sales.length) {
        const waiters = new Map<string, string>();
        for (const s of result.sales) if (s.waiter_external_id) waiters.set(s.waiter_external_id, s.waiter_name ?? s.waiter_external_id);
        if (waiters.size) {
          await supabaseAdmin.from("sales_waiters").upsert(
            [...waiters].map(([external_id, name]) => ({ environment: "production" as const, external_id, name, updated_at: now.toISOString() })),
            { onConflict: "environment,external_id" },
          );
        }
        const { error } = await supabaseAdmin
          .from("sales_items")
          .upsert(result.sales.map((s) => ({ ...s, environment: "production" as const })), { onConflict: "environment,external_id" });
        if (error) throw new Error(error.message);
        upserted += result.sales.length;
      }
      cursor = result.nextCursor ?? cursor;
      // Persist the cursor after every page so a crash never reprocesses committed pages.
      await supabaseAdmin.from("sales_sync_state").update({ cursor }).eq("environment", "production");
      if (!result.nextCursor || !result.sales.length) break;
    }
  } catch (e) {
    failure = { status: "error", message: e instanceof Error ? e.message : String(e) };
  }

  const failures = failure?.status === "error" ? (state?.consecutive_failures ?? 0) + 1 : 0;
  const nextMinutes = failure?.status === "error" ? retryDelayMinutes(failures) : SCHEDULE_MINUTES;
  const status = failure ? failure.status : "connected";
  await supabaseAdmin.from("sales_sync_state").update({
    status,
    last_attempt_at: now.toISOString(),
    ...(failure ? {} : { last_success_at: new Date().toISOString() }),
    next_attempt_at: new Date(now.getTime() + nextMinutes * 60_000).toISOString(),
    consecutive_failures: failures,
    last_error: failure?.message ?? null,
    updated_at: new Date().toISOString(),
  }).eq("environment", "production");
  if (run) {
    await supabaseAdmin.from("sales_sync_runs").update({
      finished_at: new Date().toISOString(), status, items_upserted: upserted, error: failure?.message ?? null,
    }).eq("id", run.id);
  }
  if (failure) console.warn(`[sales-sync] ${status}: ${failure.message}`);
  return { status, upserted, error: failure?.message ?? null };
}
