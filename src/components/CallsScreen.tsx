import { useEffect, useMemo, useRef } from "react";

import { CallCard } from "@/components/CallCard";
import { useI18n } from "@/i18n";
import { useClockTick, useLiveCalls } from "@/modules/calls/useCalls";
import { useSettings } from "@/modules/config/useSettings";
import type { AppEnvironment, Call } from "@/modules/shared/types";
import { cn } from "@/lib/utils";

import { SoundUnlockBanner } from "@/components/SoundUnlockBanner";
import { playSound } from "@/modules/sound";

function gridClasses(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 md:grid-cols-2";
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 6) return "grid-cols-2 lg:grid-cols-3";
  if (count <= 9) return "grid-cols-2 lg:grid-cols-3";
  return "grid-cols-2 lg:grid-cols-4";
}

export function CallsScreen({ environment }: { environment: AppEnvironment }) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const attendedWindow = settings.attended_card_seconds;
  const { calls, connection } = useLiveCalls(environment, attendedWindow);
  const now = useClockTick();

  const visible: Call[] = useMemo(() => {
    return calls
      .filter((c) => {
        if (c.status === "pending") return true;
        if (!c.attended_at) return false;
        return now - new Date(c.attended_at).getTime() < attendedWindow * 1000;
      })
      .sort((a, b) => new Date(a.called_at).getTime() - new Date(b.called_at).getTime());
  }, [calls, now, attendedWindow]);

  const pendingCount = visible.filter((c) => c.status === "pending").length;

  // Sound alerts
  const known = useRef<Set<string>>(new Set());
  const alerted = useRef<Set<string>>(new Set());
  useEffect(() => {
    const cfg = { soundId: settings.sound_id, volume: settings.sound_volume, customPath: settings.custom_sound_url };
    for (const call of calls) {
      if (call.status !== "pending") continue;
      if (!known.current.has(call.id)) {
        known.current.add(call.id);
        if (settings.sound_alerts === "every_call") void playSound(cfg);
      }
      if (settings.sound_alerts === "threshold_only" && !alerted.current.has(call.id)) {
        const waited = (Date.now() - new Date(call.called_at).getTime()) / 1000;
        if (waited >= settings.wait_threshold_seconds) {
          alerted.current.add(call.id);
          void playSound(cfg);
        }
      }
    }
  }, [calls, now, settings]);

  const density = visible.length <= 1 ? "single" : visible.length === 2 ? "split" : "grid";

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-xl font-semibold uppercase tracking-widest text-muted-foreground">
          {t("live.title")} · {t("live.pendingCount", { count: pendingCount })}
        </span>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-sm font-semibold",
            connection === "online"
              ? "bg-secondary text-status-ok"
              : "bg-destructive text-destructive-foreground animate-pulse",
          )}
          role="status"
        >
          {connection === "online" ? t("live.connected") : t("live.disconnected")}
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-border bg-card p-10 text-center">
          <p className="font-display text-4xl font-bold uppercase tracking-wide text-muted-foreground md:text-6xl">
            {t("live.empty")}
          </p>
          <p className="mt-3 text-base text-muted-foreground">{t("live.emptyHint")}</p>
        </div>
      ) : (
        <div className={cn("grid flex-1 gap-3", gridClasses(visible.length))}>
          {visible.map((call) => (
            <CallCard key={call.id} call={call} now={now} density={density} />
          ))}
        </div>
      )}
    </div>
  );
}
