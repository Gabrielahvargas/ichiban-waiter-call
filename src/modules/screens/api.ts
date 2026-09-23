import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/modules/shared/rpc";
import type { AppEnvironment, DisplayScreen, ScreenOrientation, ScreenState } from "@/modules/shared/types";

const DEVICE_KEY = "ichiban.screen.device";

export interface DeviceSession {
  screenId: string;
  token: string;
  name: string;
}

export function readDeviceSession(): DeviceSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEVICE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeviceSession;
    return parsed.screenId && parsed.token ? parsed : null;
  } catch {
    return null;
  }
}

export function storeDeviceSession(session: DeviceSession | null) {
  if (typeof window === "undefined") return;
  if (session) window.localStorage.setItem(DEVICE_KEY, JSON.stringify(session));
  else window.localStorage.removeItem(DEVICE_KEY);
}

export async function claimPairingCode(code: string): Promise<DeviceSession | { error: string }> {
  const data = await callRpc<{ ok: boolean; error?: string; screen_id: string; device_token: string; name: string }>(
    "claim_pairing_code",
    { p_code: code.trim().toUpperCase() },
  );
  if (!data?.ok) return { error: data?.error ?? "invalid_or_expired" };
  return { screenId: data.screen_id, token: data.device_token, name: data.name };
}

/**
 * Polls the token-protected screen endpoint. It doubles as the heartbeat and
 * returns the server clock, so every paired display shares one timeline and
 * multiple screens with overlapping tables stay in sync.
 */
export function useScreenState(session: DeviceSession | null, intervalMs = 2000) {
  const [state, setState] = useState<ScreenState | null>(null);
  const [connection, setConnection] = useState<"connecting" | "online" | "offline" | "unpaired">("connecting");
  const offsetRef = useRef(0);
  const lastOkRef = useRef(Date.now());
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (!session || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const data = await Promise.race([
        callRpc<ScreenState & { ok: boolean; error?: string }>("screen_state", {
          p_screen_id: session.screenId,
          p_device_token: session.token,
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 12000)),
      ]);
      if (!data?.ok) {
        setConnection("unpaired");
        return;
      }
      lastOkRef.current = Date.now();
      offsetRef.current = new Date(data.server_time).getTime() - Date.now();
      setState(data);
      setConnection("online");
    } catch {
      // Tablets on Wi-Fi power saving drop single requests often. Only warn
      // when nothing has succeeded for 25 seconds.
      if (Date.now() - lastOkRef.current > 25000) setConnection("offline");
    } finally {
      inFlightRef.current = false;
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    void load();
    const id = setInterval(() => void load(), intervalMs);
    const retry = () => {
      if (document.visibilityState === "visible") {
        lastOkRef.current = Math.max(lastOkRef.current, Date.now() - 15000);
        void load();
      }
    };
    document.addEventListener("visibilitychange", retry);
    window.addEventListener("online", retry);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", retry);
      window.removeEventListener("online", retry);
    };
  }, [load, session, intervalMs]);

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  return { state, connection, serverNow, reload: load };
}

/* ------------------------------------------------------------------ admin */

export function useScreens() {
  const [screens, setScreens] = useState<DisplayScreen[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data } = await supabase.from("display_screens").select("*").order("created_at");
    setScreens((data ?? []) as unknown as DisplayScreen[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
    const id = setInterval(() => void reload(), 10000);
    return () => clearInterval(id);
  }, [reload]);

  return { screens, loading, reload };
}

export async function createScreen(name: string, tables: number[] | null, environment: AppEnvironment) {
  return callRpc<{ id: string; pairing_code: string; expires_at: string }>("admin_create_screen", {
    p_name: name,
    p_tables: tables,
    p_environment: environment,
  });
}

export async function regeneratePairingCode(screenId: string) {
  return callRpc<{ pairing_code: string; expires_at: string }>("admin_regenerate_pairing_code", {
    p_screen_id: screenId,
  });
}

export async function updateScreen(
  screenId: string,
  patch: { name?: string; table_numbers?: number[] | null; environment?: AppEnvironment; orientation?: ScreenOrientation },
) {
  const { error } = await supabase.from("display_screens").update(patch as never).eq("id", screenId);
  if (error) throw new Error(error.message);
}

export async function unpairScreen(screenId: string) {
  const { error } = await supabase
    .from("display_screens")
    .update({ device_token_hash: null, paired_at: null } as never)
    .eq("id", screenId);
  if (error) throw new Error(error.message);
}

export async function deleteScreen(screenId: string) {
  const { error } = await supabase.from("display_screens").delete().eq("id", screenId);
  if (error) throw new Error(error.message);
}

export function screenIsOnline(screen: DisplayScreen): boolean {
  if (!screen.last_seen_at) return false;
  return Date.now() - new Date(screen.last_seen_at).getTime() < 15000;
}
