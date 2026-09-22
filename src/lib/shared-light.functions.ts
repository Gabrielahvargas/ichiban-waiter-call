import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface SharedLightStatus {
  configured: boolean;
  deviceId: string | null;
  deviceName: string | null;
  online: boolean | null;
  linked: boolean;
  supportsColour: boolean;
  supportsWhite: boolean;
  pending: number;
  error: string | null;
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

/** Verifies the shared bulb is reachable, linked to the Tuya project and which codes it supports. */
export const getSharedLightStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SharedLightStatus> => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("shared_light_device_id")
      .eq("id", "global")
      .maybeSingle();
    const deviceId = (settings as { shared_light_device_id?: string | null } | null)?.shared_light_device_id ?? null;

    const { count } = await supabaseAdmin
      .from("calls")
      .select("id", { count: "exact", head: true })
      .eq("environment", "production")
      .eq("status", "pending");

    const base: SharedLightStatus = {
      configured: Boolean(deviceId),
      deviceId,
      deviceName: null,
      online: null,
      linked: false,
      supportsColour: false,
      supportsWhite: false,
      pending: count ?? 0,
      error: null,
    };
    if (!deviceId) return base;

    try {
      const { getDevice, getDeviceFunctionCodes } = await import("./tuya.server");
      const device = await getDevice(deviceId);
      if (!device) return { ...base, error: "device_not_found_in_project" };
      const codes = await getDeviceFunctionCodes(deviceId);
      return {
        ...base,
        deviceName: device.name,
        online: device.online,
        linked: true,
        supportsColour: codes.includes("colour_data_v2") || codes.includes("colour_data"),
        supportsWhite: codes.includes("work_mode"),
      };
    } catch (e) {
      return { ...base, error: e instanceof Error ? e.message : "unknown_error" };
    }
  });

/** Re-applies the correct colour from the current pending-call state. */
export const resyncSharedLight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { syncSharedLight } = await import("./shared-light.server");
    return await syncSharedLight("manual");
  });
