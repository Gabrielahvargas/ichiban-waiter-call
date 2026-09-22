import { supabase } from "@/integrations/supabase/client";

type RpcResult = { data: unknown; error: { message: string } | null };

/**
 * Loosely typed RPC helper. The generated types lag behind newly added database
 * functions, and every payload here is validated by the caller anyway.
 */
export const rpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<RpcResult>;

export async function callRpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}
