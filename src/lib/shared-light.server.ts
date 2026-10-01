/**
 * Decides and applies the shared waiter-area bulb state from the real call
 * state in the database: red while at least one production call is pending,
 * white (never off) when none remain. If the stored bulb no longer responds
 * (e.g. it was deleted and re-created in Smart Life), it is re-linked by name.
 */
import { findLightsByName, getDevice, setSharedLight } from "./tuya.server";

export interface SharedLightSyncResult {
  status: "applied" | "skipped" | "error";
  state?: "red" | "white";
  pending?: number;
  detail?: string;
  relinked?: boolean;
}

export interface RelinkResult {
  status: "relinked" | "unchanged" | "not_found" | "ambiguous" | "error";
  deviceId?: string | null;
  detail?: string;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function log(row: Record<string, unknown>) {
  const db = await admin();
  await db.from("tuya_event_log").insert(row as never);
}

/** Searches the Tuya project for a single bulb with the configured name and stores its ID. */
export async function relinkSharedLightByName(reason: string): Promise<RelinkResult> {
  const db = await admin();
  const { data } = await db
    .from("app_settings")
    .select("shared_light_device_id, shared_light_device_name")
    .eq("id", "global")
    .maybeSingle();
  const s = data as { shared_light_device_id?: string | null; shared_light_device_name?: string | null } | null;
  const name = (s?.shared_light_device_name ?? "SERVER").trim() || "SERVER";
  try {
    const matches = await findLightsByName(name);
    if (matches.length === 0) {
      await log({ source: `light:${reason}`, result: "shared_light_relink_failed", error: `no_light_named_${name}` });
      return { status: "not_found", detail: name };
    }
    if (matches.length > 1) {
      await log({ source: `light:${reason}`, result: "shared_light_relink_failed", error: `multiple_lights_named_${name}` });
      return { status: "ambiguous", detail: name };
    }
    const newId = matches[0]!.id;
    if (newId === s?.shared_light_device_id) return { status: "unchanged", deviceId: newId };
    await db
      .from("app_settings")
      .update({ shared_light_device_id: newId, shared_light_relinked_at: new Date().toISOString() } as never)
      .eq("id", "global");
    await log({ source: `light:${reason}`, device_id: newId, result: "shared_light_relinked" });
    return { status: "relinked", deviceId: newId };
  } catch (e) {
    return { status: "error", detail: e instanceof Error ? e.message : "unknown_error" };
  }
}

export async function syncSharedLight(reason: string): Promise<SharedLightSyncResult> {
  const db = await admin();

  const { data: settings } = await db
    .from("app_settings")
    .select("shared_light_device_id")
    .eq("id", "global")
    .maybeSingle();

  let deviceId = (settings as { shared_light_device_id?: string | null } | null)?.shared_light_device_id ?? null;

  const { count, error: countError } = await db
    .from("calls")
    .select("id", { count: "exact", head: true })
    .eq("environment", "production")
    .eq("status", "pending");
  if (countError) return { status: "error", detail: countError.message };

  const pending = count ?? 0;
  const state: "red" | "white" = pending > 0 ? "red" : "white";
  let relinked = false;

  // If no bulb is stored or the stored one is gone, look it up by name.
  if (!deviceId || !(await getDevice(deviceId).catch(() => null))) {
    const r = await relinkSharedLightByName(reason);
    if (r.status === "relinked" || r.status === "unchanged") {
      relinked = r.status === "relinked";
      deviceId = r.deviceId ?? deviceId;
    } else if (!deviceId) {
      return { status: "skipped", detail: `shared_light_${r.status}` };
    }
  }

  try {
    await setSharedLight(deviceId!, state);
  } catch (e) {
    let detail = e instanceof Error ? e.message : "unknown_error";
    if (!relinked) {
      const r = await relinkSharedLightByName(reason);
      if (r.status === "relinked" && r.deviceId) {
        try {
          await setSharedLight(r.deviceId, state);
          deviceId = r.deviceId;
          relinked = true;
          detail = "";
        } catch (e2) {
          detail = e2 instanceof Error ? e2.message : "unknown_error";
        }
      }
    }
    if (detail) {
      await log({ source: `light:${reason}`, device_id: deviceId, result: "light_command_failed", error: detail });
      return { status: "error", state, pending, detail };
    }
  }

  await log({ source: `light:${reason}`, device_id: deviceId, result: `shared_light_${state}` });

  await db
    .from("lighting_commands")
    .update({ dispatch_status: "sent" } as never)
    .eq("target", "waiter_area")
    .eq("environment", "production")
    .eq("dispatch_status", "pending_integration");

  return { status: "applied", state, pending, relinked };
}
