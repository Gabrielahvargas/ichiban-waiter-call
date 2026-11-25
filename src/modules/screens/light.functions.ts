import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Paired screens ask the server to reconcile the SERVER bulbs with the real
 * active calls. The screen only proves its device token; the server decides
 * the colour from the database and skips when the bulbs already match.
 */
export const reconcileScreenServerLight = createServerFn({ method: "POST" })
  .inputValidator(z.object({ screenId: z.string().uuid(), token: z.string().min(16).max(200) }))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
    if (!url || !key) return { status: "error" as const };
    const res = await fetch(`${url}/rest/v1/rpc/screen_state`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_screen_id: data.screenId, p_device_token: data.token }),
    });
    if (!res.ok) return { status: "error" as const };
    const state = (await res.json()) as { ok?: boolean };
    if (!state.ok) return { status: "error" as const };
    const { reconcileSharedLight } = await import("@/lib/shared-light.server");
    const r = await reconcileSharedLight("screen_reconcile");
    return { status: r.status, state: r.state ?? null };
  });
