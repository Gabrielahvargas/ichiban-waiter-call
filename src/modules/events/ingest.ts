import { supabase } from "@/integrations/supabase/client";
import type { AppEnvironment } from "@/modules/shared/types";

export type IngestResult =
  | "call_created"
  | "call_attended"
  | "ignored_already_pending"
  | "ignored_cooldown"
  | "ignored_no_pending"
  | "ignored_unmapped_button";

export interface IngestResponse {
  result: IngestResult;
  call_id: string | null;
  duplicate: boolean;
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Single ingestion entry point for button events. The database function applies
 * the call state machine atomically, so concurrent tables and repeated presses
 * are safe. Pass a stable idempotencyKey to make a retry a no-op.
 */
export async function ingestButtonEvent(params: {
  tableNumber: number;
  /** Raw physical switch number (1-4) reported by the device. */
  button: number;
  environment: AppEnvironment;
  source?: string;
  clickType?: "single" | "double" | "long";
  idempotencyKey?: string;
}): Promise<IngestResponse> {
  const { data, error } = await supabase.rpc("ingest_button_event" as never, {
    p_table_number: params.tableNumber,
    p_button: params.button,
    p_environment: params.environment,
    p_idempotency_key: params.idempotencyKey ?? newIdempotencyKey(),
    p_source: params.source ?? "demo",
    p_click_type: params.clickType ?? "single",
  });
  if (error) throw error;
  return data as unknown as IngestResponse;
}
