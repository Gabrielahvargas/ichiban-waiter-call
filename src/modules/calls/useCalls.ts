import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { AppEnvironment, Call } from "@/modules/shared/types";

export type ConnectionState = "connecting" | "online" | "offline";

/**
 * Live view of the calls that matter for the screen: everything pending plus the
 * recently attended calls (so the green card can linger). Server timestamps are
 * the source of truth, so a reload or a language change never resets a timer.
 */
export function useLiveCalls(environment: AppEnvironment, attendedWindowSeconds: number) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const sinceIso = new Date(Date.now() - (attendedWindowSeconds + 30) * 1000).toISOString();
      const { data, error } = await supabase
        .from("calls")
        .select("*")
        .eq("environment", environment)
        .or(`status.eq.pending,attended_at.gte.${sinceIso}`)
        .order("called_at", { ascending: true });

      if (cancelled) return;
      if (error) {
        setConnection("offline");
        return;
      }
      setCalls((data ?? []) as Call[]);
      setLoaded(true);
      setConnection((prev) => (prev === "offline" ? "online" : prev === "online" ? "online" : "online"));
    }

    void load();
    const poll = setInterval(() => void load(), 4000);

    const channel = supabase
      .channel(`calls-${environment}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls", filter: `environment=eq.${environment}` },
        () => void load(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnection("online");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED")
          setConnection("offline");
      });

    return () => {
      cancelled = true;
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [environment, attendedWindowSeconds]);

  return { calls, connection, loaded };
}

/** Ticks once per second so elapsed times stay live without owning any state. */
export function useClockTick(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function formatElapsed(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const ss = (safe % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}
