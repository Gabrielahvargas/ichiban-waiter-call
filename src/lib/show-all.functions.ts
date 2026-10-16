import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ShowAllResult {
  sent: number[];
  failed: { table: number; error: string }[];
  /** Tables without a configured Tuya light group. */
  skipped: number[];
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

/**
 * Triggers the same light effect as the physical button 1 double-click (the
 * SHOW automation) on every table's light group, from the remote panel.
 * Smart Life automations cannot be fired through the Tuya API, so the app
 * sends the same scene command directly to each table's light group.
 */
export const triggerShowAllTables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ShowAllResult> => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { setGroupScene } = await import("./tuya.server");

    const { data: tables, error } = await supabaseAdmin
      .from("dining_tables")
      .select("table_number, light_group_id")
      .order("table_number");
    if (error) throw new Error(error.message);

    const rows = (tables ?? []) as { table_number: number; light_group_id: string | null }[];
    const skipped = rows.filter((r) => !r.light_group_id).map((r) => r.table_number);
    const targets = rows.filter((r) => r.light_group_id);

    const results = await Promise.allSettled(
      targets.map((r) => setGroupScene(r.light_group_id!)),
    );

    const sent: number[] = [];
    const failed: { table: number; error: string }[] = [];
    for (let i = 0; i < targets.length; i++) {
      const table = targets[i]!.table_number;
      const r = results[i]!;
      const ok = r.status === "fulfilled";
      const err = ok ? null : r.reason instanceof Error ? r.reason.message : "unknown_error";
      if (ok) sent.push(table);
      else failed.push({ table, error: err! });
      await supabaseAdmin.from("tuya_event_log").insert({
        source: "show_all",
        device_id: targets[i]!.light_group_id,
        result: ok ? "show_scene_sent" : "light_command_failed",
        error: ok ? `table_${table}` : `table_${table}: ${err}`,
      } as never);
    }

    return { sent, failed, skipped };
  });
