import { formatElapsed } from "@/modules/calls/useCalls";
import { useI18n } from "@/i18n";
import type { Call } from "@/modules/shared/types";
import { cn } from "@/lib/utils";

export interface CallCardProps {
  call: Call;
  now: number;
  /** Bigger type when only one or two cards share the screen. */
  density: "single" | "split" | "grid";
}

export function CallCard({ call, now, density }: CallCardProps) {
  const { t } = useI18n();
  const attended = call.status === "attended";

  const elapsedSeconds = attended
    ? (call.duration_seconds ??
      Math.round((new Date(call.attended_at ?? call.called_at).getTime() - new Date(call.called_at).getTime()) / 1000))
    : Math.round((now - new Date(call.called_at).getTime()) / 1000);

  const numberSize =
    density === "single"
      ? "text-[clamp(7rem,26vw,22rem)]"
      : density === "split"
        ? "text-[clamp(5rem,16vw,15rem)]"
        : "text-[clamp(3.5rem,9vw,9rem)]";

  const timerSize =
    density === "single"
      ? "text-[clamp(3.5rem,12vw,10rem)]"
      : density === "split"
        ? "text-[clamp(2.5rem,7vw,6.5rem)]"
        : "text-[clamp(1.75rem,4vw,4rem)]";

  const helperSize = density === "grid" ? "text-sm" : "text-lg md:text-2xl";

  return (
    <article
      className={cn(
        "flex h-full w-full flex-col items-center justify-center rounded-3xl px-4 py-6 text-center shadow-2xl transition-colors duration-300",
        attended ? "call-card-attended" : "call-card-pending",
      )}
    >
      <span
        className={cn(
          "font-display font-semibold uppercase tracking-[0.3em] text-call-helper",
          density === "grid" ? "text-xs" : "text-base md:text-xl",
        )}
      >
        {attended ? t("live.attended") : t("live.waiting")}
      </span>

      <span
        className={cn(
          "font-display font-bold leading-none text-call-number tabular",
          numberSize,
        )}
      >
        {call.table_number}
      </span>

      <span className={cn("font-display font-bold leading-none text-call-timer tabular", timerSize)}>
        {formatElapsed(elapsedSeconds)}
      </span>

      <span className={cn("mt-2 font-medium text-call-helper/90", helperSize)}>
        {attended ? t("live.helperAttended") : t("live.helperWaiting")}
      </span>
    </article>
  );
}
