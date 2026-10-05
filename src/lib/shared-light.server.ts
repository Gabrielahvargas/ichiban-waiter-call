/**
 * Decides and applies the shared waiter-area bulbs state from the real call
 * state in the database: red while at least one production call is pending,
 * white (never off) when none remain. Every configured bulb (all named e.g.
 * SERVER) receives the same command. If a stored bulb no longer responds, the
 * list is refreshed by name.
 */
import { findLightsByName, getDevice, setSharedLight } from "./tuya.server";

export interface SharedLightSyncResult {
  status: "applied" | "partial" | "skipped" | "error";
  state?: "red" | "white";
  pending?: number;
  detail?: string;
  relinked?: boolean;
  devices?: { id: string; ok: boolean; error?: string }[];
}

export interface RelinkResult {
  status: "relinked" | "unchanged" | "not_found" | "error";
  deviceIds?: string[];
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

type Settings = {
  shared_light_device_id?: string | null;
  shared_light_device_ids?: string[] | null;
  shared_light_device_name?: string | null;
};

async function readSettings(): Promise<Settings | null> {
  const db = await admin();
  const { data } = await db
    .from("app_settings")
    .select("shared_light_device_id, shared_light_device_ids, shared_light_device_name")
    .eq("id", "global")
    .maybeSingle();
  return data as Settings | null;
}

export function storedIds(s: Settings | null): string[] {
  const list = (s?.shared_light_device_ids ?? []).filter(Boolean);
  if (list.length) return list;
  return s?.shared_light_device_id ? [s.shared_light_device_id] : [];
}

/** Finds every bulb with the configured name and stores all their IDs. */
export async function relinkSharedLightByName(reason: string): Promise<RelinkResult> {
  const db = await admin();
  const s = await readSettings();
  const name = (s?.shared_light_device_name ?? "SERVER").trim() || "SERVER";
  try {
    const matches = await findLightsByName(name);
    if (matches.length === 0) {
      await log({ source: `light:${reason}`, result: "shared_light_relink_failed", error: `no_light_named_${name}` });
      return { status: "not_found", detail: name };
    }
    const newIds = matches.map((m) => m.id).sort();
    const current = [...storedIds(s)].sort();
    if (newIds.join(",") === current.join(",")) return { status: "unchanged", deviceIds: newIds };
    await db
      .from("app_settings")
      .update({
        shared_light_device_ids: newIds,
        shared_light_device_id: newIds[0],
        shared_light_relinked_at: new Date().toISOString(),
      } as never)
      .eq("id", "global");
    await log({ source: `light:${reason}`, result: "shared_light_relinked", error: newIds.join(",") });
    return { status: "relinked", deviceIds: newIds };
  } catch (e) {
    return { status: "error", detail: e instanceof Error ? e.message : "unknown_error" };
  }
}

export async function syncSharedLight(reason: string): Promise<SharedLightSyncResult> {
  const db = await admin();
  let ids = storedIds(await readSettings());

  const { count, error: countError } = await db
    .from("calls")
    .select("id", { count: "exact", head: true })
    .eq("environment", "production")
    .eq("status", "pending");
  if (countError) return { status: "error", detail: countError.message };

  const pending = count ?? 0;
  const state: "red" | "white" = pending > 0 ? "red" : "white";
  let relinked = false;

  // No bulbs stored, or one of them is gone: refresh the list by name.
  const reachable = await Promise.all(ids.map((id) => getDevice(id).catch(() => null)));
  if (ids.length === 0 || reachable.some((d) => !d)) {
    const r = await relinkSharedLightByName(reason);
    if ((r.status === "relinked" || r.status === "unchanged") && r.deviceIds) {
      relinked = r.status === "relinked";
      ids = r.deviceIds;
    } else if (ids.length === 0) {
      return { status: "skipped", detail: `shared_light_${r.status}` };
    }
  }

  const results = await Promise.allSettled(ids.map((id) => setSharedLight(id, state)));
  const devices = ids.map((id, i) => {
    const r = results[i]!;
    return r.status === "fulfilled"
      ? { id, ok: true }
      : { id, ok: false, error: r.reason instanceof Error ? r.reason.message : "unknown_error" };
  });

  for (const d of devices) {
    await log({
      source: `light:${reason}`,
      device_id: d.id,
      result: d.ok ? `shared_light_${state}` : "light_command_failed",
      error: d.error ?? null,
    });
  }

  const okCount = devices.filter((d) => d.ok).length;
  if (okCount === 0) {
    return { status: "error", state, pending, relinked, devices, detail: devices.map((d) => d.error).join("; ") };
  }

  await db
    .from("lighting_commands")
    .update({ dispatch_status: "sent" } as never)
    .eq("target", "waiter_area")
    .eq("environment", "production")
    .eq("dispatch_status", "pending_integration");

  return { status: okCount === devices.length ? "applied" : "partial", state, pending, relinked, devices };
}
