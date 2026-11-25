import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin only: AI-generated diagnostic steps for TV remote problems. */
export const getTvHelp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      tvModel: z.string().trim().min(2).max(200),
      browser: z.string().trim().max(200),
      problem: z.string().trim().min(3).max(2000),
      language: z.enum(["en", "es"]),
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) return { ok: false as const, error: "forbidden" };
    try {
      const { generateTvHelp } = await import("@/lib/ai/tv-help.server");
      const text = await generateTvHelp(data);
      if (!text.trim()) return { ok: false as const, error: "empty" };
      return { ok: true as const, text };
    } catch (e) {
      console.error("tv-help failed", e);
      const status = (e as { statusCode?: number }).statusCode;
      return { ok: false as const, error: status === 402 ? "credits" : status === 429 ? "busy" : "failed" };
    }
  });
