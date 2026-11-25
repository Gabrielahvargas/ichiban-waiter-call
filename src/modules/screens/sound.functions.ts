import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Paired TV screens are not signed in, so they get a short-lived link to the
 * custom alert sound after proving their device token. The sound path is read
 * from settings on the server, never taken from the caller.
 */
export const getScreenSoundUrl = createServerFn({ method: "POST" })
  .inputValidator(z.object({ screenId: z.string().uuid(), token: z.string().min(16).max(200) }))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
    if (!url || !key) return { url: null as string | null };
    const res = await fetch(`${url}/rest/v1/rpc/screen_state`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_screen_id: data.screenId, p_device_token: data.token }),
    });
    if (!res.ok) return { url: null };
    const state = (await res.json()) as { ok?: boolean; settings?: { custom_sound_url?: string | null } };
    const path = state.ok ? state.settings?.custom_sound_url : null;
    if (!path) return { url: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage.from("alert-sounds").createSignedUrl(path, 3600);
    return { url: signed?.signedUrl ?? null };
  });
