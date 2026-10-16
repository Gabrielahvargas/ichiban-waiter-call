import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ShowAllResult {
  sent: number[];
  failed: { table: number; error: string }[];
  /** Tables without a configured Tuya light group. */
  skipped: number[];
  /** When an auto-stop was requested, the time the lights go back to white. */
  stopAt?: string | null;
  runId?: string | null;
}

type LightAction = "scene" | "white" | "on" | "off";

const LOG_RESULT: Record<LightAction, string> = {
  scene: "show_scene_sent",
  white: "show_stop_sent",
  on: "lights_on_sent",
  off: "lights_off_sent",
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

/** Sends one light action to every table's light group in parallel, logging per table. */
async function applyToAllTables(action: LightAction): Promise<ShowAllResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tuya = await import("./tuya.server");
  const send = (g: string) =>
    action === "scene"
      ? tuya.setGroupScene(g)
      : action === "white"
        ? tuya.setGroupWhite(g)
        : tuya.setGroupPower(g, action === "on");

  const { data: tables, error } = await supabaseAdmin
    .from("dining_tables")
    .select("table_number, light_group_id")
    .order("table_number");
  if (error) throw new Error(error.message);

  const rows = (tables ?? []) as { table_number: number; light_group_id: string | null }[];
  const skipped = rows.filter((r) => !r.light_group_id).map((r) => r.table_number);
  const targets = rows.filter((r) => r.light_group_id);
  const results = await Promise.allSettled(targets.map((r) => send(r.light_group_id!)));

  const sent: number[] = [];
  const failed: { table: number; error: string }[] = [];
  const logs = targets.map((row, i) => {
    const r = results[i]!;
    const ok = r.status === "fulfilled";
    const err = ok ? null : r.reason instanceof Error ? r.reason.message : "unknown_error";
    if (ok) sent.push(row.table_number);
    else failed.push({ table: row.table_number, error: err! });
    return {
      source: "show_all",
      device_id: row.light_group_id,
      table_number: row.table_number,
      result: ok ? LOG_RESULT[action] : "light_command_failed",
      error: ok ? null : err,
    };
  });
  if (logs.length) await supabaseAdmin.from("tuya_event_log").insert(logs as never);
  return { sent, failed, skipped };
}

/** Marks every open SHOW run as stopped (cancels any pending auto-stop). */
async function closeOpenRuns() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("show_runs")
    .update({ stopped_at: new Date().toISOString() } as never)
    .is("stopped_at", null);
}

/**
 * Triggers the same light effect as the physical button 1 double-click (the
 * SHOW automation) on every table's light group. Optionally records when the
 * lights should go back to white.
 */
export const triggerShowAllTables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { autoStopSeconds?: number } | undefined) => {
    const s = Math.round(Number(input?.autoStopSeconds ?? 0));
    if (!Number.isFinite(s) || s < 0 || s > 600) throw new Error("invalid_auto_stop");
    return { autoStopSeconds: s };
  })
  .handler(async ({ context, data }): Promise<ShowAllResult> => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await closeOpenRuns();
    const result = await applyToAllTables("scene");
    const stopAt =
      data.autoStopSeconds > 0 ? new Date(Date.now() + data.autoStopSeconds * 1000).toISOString() : null;
    const { data: run } = await supabaseAdmin
      .from("show_runs")
      .insert({ stop_at: stopAt } as never)
      .select("id")
      .single();
    return { ...result, stopAt, runId: (run as { id: string } | null)?.id ?? null };
  });

/** Stops the SHOW effect: all table lights back to normal white. */
export const stopShowAllTables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ShowAllResult> => {
    await assertAdmin(context as never);
    await closeOpenRuns();
    return applyToAllTables("white");
  });

/** Turns every table light on (normal white) or off. Cancels any pending auto-stop. */
export const setAllTableLights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { action: "on" | "off" }) => {
    if (input?.action !== "on" && input?.action !== "off") throw new Error("invalid_action");
    return { action: input.action };
  })
  .handler(async ({ context, data }): Promise<ShowAllResult> => {
    await assertAdmin(context as never);
    await closeOpenRuns();
    return applyToAllTables(data.action);
  });

/** The SHOW run still waiting for its auto-stop, if any. */
export const getActiveShowRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ runId: string; stopAt: string } | null> => {
    await assertAdmin(context as never);
    const { data } = await (context as any).supabase
      .from("show_runs")
      .select("id, stop_at")
      .is("stopped_at", null)
      .not("stop_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? { runId: data.id, stopAt: data.stop_at } : null;
  });
