/**
 * Isolated Tabit Cloud adapter.
 *
 * Tabit does not publish a public API (no documented base URL, endpoints or auth).
 * Access is granted through Tabit's partner/integration program. Until Tabit provides
 * the official documentation, `fetchSalesSince` reports "not_configured" instead of
 * calling any invented endpoint. Implement the request mapping here only, once the
 * official contract is known; the rest of the app depends only on this interface.
 */
export interface NormalizedSale {
  external_id: string;
  sold_at: string;
  waiter_external_id: string | null;
  waiter_name: string | null;
  product_name: string;
  tabit_category: string | null;
  quantity: number;
  amount: number;
}

export type FetchResult =
  | { ok: true; sales: NormalizedSale[]; nextCursor: string | null }
  | { ok: false; reason: "not_configured" | "error"; message: string };

export function tabitConfigured(): boolean {
  return Boolean(process.env["TABIT_API_BASE_URL"] && process.env["TABIT_API_KEY"]);
}

export async function fetchSalesSince(_cursor: string | null): Promise<FetchResult> {
  if (!tabitConfigured()) {
    return { ok: false, reason: "not_configured", message: "TABIT_API_BASE_URL / TABIT_API_KEY are not set" };
  }
  // Credentials exist but the official request contract has not been provided by Tabit yet.
  return {
    ok: false,
    reason: "not_configured",
    message: "Tabit credentials found, but the official API contract is not implemented yet in src/lib/tabit/adapter.server.ts",
  };
}
