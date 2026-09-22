/**
 * Decides and applies the shared waiter-area bulb state from the real call
 * state in the database: red while at least one production call is pending,
 * white (never off) when none remain.
 */
import { setSharedLight } from "./tuya.server";

export interface SharedLightSyncResult {
  status: "applied" | "skipped" | "error";
  state?: "red" | "white";
  pending?: number;
  detail?: string;
}

export async function syncSharedLight(reason: string): Promise<SharedLightSyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: settings } = await supabaseAdmin
    .from("app_settings")
    .select("shared_light_device_id")
    .eq("id", "global")
    .maybeSingle();

  const deviceId = (settings as { shared_light_device_id?: string | null } | null)?.shared_light_device_id;
  if (!deviceId) return { status: "skipped", detail: "shared_light_device_not_configured" };

  const { count, error: countError } = await supabaseAdmin
    .from("calls")
    .select("id", { count: "exact", head: true })
    .eq("environment", "production")
    .eq("status", "pending");

  if (countError) return { status: "error", detail: countError.message };

  const pending = count ?? 0;
  const state: "red" | "white" = pending > 0 ? "red" : "white";

  try {
    await setSharedLight(deviceId, state);
  } catch (e) {
    const detail = e instanceof Error ? e.message : "unknown_error";
    await supabaseAdmin.from("tuya_event_log").insert({
      source: `light:${reason}`,
      device_id: deviceId,
      result: "light_command_failed",
      error: detail,
    } as never);
    return { status: "error", state, pending, detail };
  }

  await supabaseAdmin.from("tuya_event_log").insert({
    source: `light:${reason}`,
    device_id: deviceId,
    result: `shared_light_${state}`,
  } as never);

  await supabaseAdmin
    .from("lighting_commands")
    .update({ dispatch_status: "sent" } as never)
    .eq("target", "waiter_area")
    .eq("environment", "production")
    .eq("dispatch_status", "pending_integration");

  return { status: "applied", state, pending };
}
