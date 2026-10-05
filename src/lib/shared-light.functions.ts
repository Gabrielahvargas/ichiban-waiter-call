import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface SharedLightDevice {
  deviceId: string;
  deviceName: string | null;
  online: boolean | null;
  linked: boolean;
  supportsColour: boolean;
  supportsWhite: boolean;
  error: string | null;
}

export interface SharedLightStatus {
  configured: boolean;
  searchName: string;
  relinkedAt: string | null;
  pending: number;
  devices: SharedLightDevice[];
  error: string | null;
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

/** Verifies every shared bulb is reachable, linked to the Tuya project and which codes it supports. */
export const getSharedLightStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SharedLightStatus> => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { storedIds } = await import("./shared-light.server");

    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("shared_light_device_id, shared_light_device_ids, shared_light_device_name, shared_light_relinked_at")
      .eq("id", "global")
      .maybeSingle();
    const s = settings as {
      shared_light_device_id?: string | null;
      shared_light_device_ids?: string[] | null;
      shared_light_device_name?: string | null;
      shared_light_relinked_at?: string | null;
    } | null;
    const ids = storedIds(s);

    const { count } = await supabaseAdmin
      .from("calls")
      .select("id", { count: "exact", head: true })
      .eq("environment", "production")
      .eq("status", "pending");

    const base: SharedLightStatus = {
      configured: ids.length > 0,
      searchName: s?.shared_light_device_name ?? "SERVER",
      relinkedAt: s?.shared_light_relinked_at ?? null,
      pending: count ?? 0,
      devices: [],
      error: null,
    };
    if (!ids.length) return base;

    try {
      const { getDevice, getDeviceFunctionCodes } = await import("./tuya.server");
      const devices = await Promise.all(
        ids.map(async (deviceId): Promise<SharedLightDevice> => {
          const empty = { deviceId, deviceName: null, online: null, linked: false, supportsColour: false, supportsWhite: false };
          try {
            const device = await getDevice(deviceId);
            if (!device) return { ...empty, error: "device_not_found_in_project" };
            const codes = await getDeviceFunctionCodes(deviceId);
            return {
              deviceId,
              deviceName: device.name,
              online: device.online,
              linked: true,
              supportsColour: codes.includes("colour_data_v2") || codes.includes("colour_data"),
              supportsWhite: codes.includes("work_mode"),
              error: null,
            };
          } catch (e) {
            return { ...empty, error: e instanceof Error ? e.message : "unknown_error" };
          }
        }),
      );
      return { ...base, devices };
    } catch (e) {
      return { ...base, error: e instanceof Error ? e.message : "unknown_error" };
    }
  });

/** Re-applies the correct colour to every shared bulb from the current pending-call state. */
export const resyncSharedLight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { syncSharedLight } = await import("./shared-light.server");
    return await syncSharedLight("manual");
  });

/** Looks up all bulbs with the configured name (e.g. SERVER) and stores them. */
export const relinkSharedLight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { relinkSharedLightByName } = await import("./shared-light.server");
    return await relinkSharedLightByName("manual_relink");
  });
