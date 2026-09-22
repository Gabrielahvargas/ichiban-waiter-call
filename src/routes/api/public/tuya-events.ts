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
  table_number: z.number().int().positive(),
  button: z.union([z.literal(3), z.literal(4)]),
  event_id: z.string().min(6).max(200),
  device_id: z.string().max(200).optional(),
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
              ? "Signing secret present. Waiting for a verified button 3/4 event from the gateway."
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
          p_table_number: parsed.table_number,
          p_button: parsed.button,
          p_environment: "production",
          p_idempotency_key: parsed.event_id,
          p_source: parsed.device_id ? `gateway:${parsed.device_id}` : "gateway",
        } as never);

        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, ...(data as Record<string, unknown>) }, 200);
      },
    },
  },
});
