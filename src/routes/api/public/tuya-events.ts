import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

/**
 * Gateway ingestion endpoint for real Zigbee button events (Tuya / Smart Life).
 *
 * It stays intentionally inert until TUYA_WEBHOOK_SECRET is configured on the
 * server: without a verified signing secret we cannot trust any caller, so the
 * endpoint reports "pending" instead of pretending the integration is live.
 * Nothing here invents Tuya endpoints or credentials.
 */

const payloadSchema = z.object({
  /** Optional table number; if omitted, the device_id is used to resolve the table. */
  table_number: z.number().int().positive().optional(),
  /** Raw switch number reported by the device (1 .. 4). The server resolves it
   *  into CALL or ATTEND using this table's configurable mapping. */
  button: z.number().int().min(1).max(4),
  /** Stable idempotency key from the bridge (e.g. pulsar messageId or dataId). */
  event_id: z.string().min(6).max(400),
  /** Tuya device ID of the physical Zigbee button. Required for bridge events. */
  device_id: z.string().min(6).max(200),
  /** Normalized click type; single_click, double_click, long_click. */
  click_type: z.enum(["single_click", "double_click", "long_click"]).default("single_click"),
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/tuya-events")({
  server: {
    handlers: {
      GET: () => {
        const configured = Boolean(process.env["TUYA_WEBHOOK_SECRET"]);
        return json(
          {
            status: configured ? "armed" : "pending",
            detail: configured
              ? "Signing secret present. Waiting for a verified single-click switch event from the gateway."
              : "TUYA_WEBHOOK_SECRET is not configured, so no gateway event can be trusted yet.",
          },
          200,
        );
      },
      POST: async ({ request }) => {
        const secret = process.env["TUYA_WEBHOOK_SECRET"];
        if (!secret) {
          return json({ status: "pending", error: "integration_not_configured" }, 503);
        }

        const body = await request.text();
        const provided = request.headers.get("x-signature") ?? "";
        const expected = createHmac("sha256", secret).update(body).digest("hex");
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return json({ error: "invalid_signature" }, 401);
        }

        let parsed: z.infer<typeof payloadSchema>;
        try {
          parsed = payloadSchema.parse(JSON.parse(body));
        } catch {
          return json({ error: "invalid_payload" }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("ingest_button_event", {
          p_table_number: parsed.table_number ?? 0,
          p_button: parsed.button,
          p_environment: "production",
          p_idempotency_key: parsed.event_id,
          p_source: `gateway:${parsed.device_id}`,
          p_click_type: parsed.click_type,
          p_device_id: parsed.device_id,
        } as never);

        if (error) return json({ error: error.message }, 500);

        // Apply the shared waiter-area bulb state from the resulting call state.
        const result = (data as { result?: string } | null)?.result;
        let light: unknown = { status: "skipped", detail: "no_state_change" };
        if (result === "call_created" || result === "call_attended") {
          try {
            const { syncSharedLight } = await import("@/lib/shared-light.server");
            light = await syncSharedLight(result);
          } catch (e) {
            light = { status: "error", detail: e instanceof Error ? e.message : "unknown_error" };
          }
        }

        return json({ ok: true, ...(data as Record<string, unknown>), light }, 200);
      },
    },
  },
});
