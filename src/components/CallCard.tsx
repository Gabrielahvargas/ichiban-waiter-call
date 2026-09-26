import { formatElapsed } from "@/modules/calls/useCalls";
import { useI18n } from "@/i18n";
import type { Call } from "@/modules/shared/types";
import { cn } from "@/lib/utils";

export interface CallCardProps {
  call: Call;
  now: number;
  /** Bigger type when only one or two cards share the screen. */
  density: "single" | "split" | "grid" | "compact";
}

export function CallCard({ call, now, density }: CallCardProps) {
  const { t } = useI18n();
  const attended = call.status === "attended";

  const elapsedSeconds = attended
    ? (call.duration_seconds ??
      Math.round((new Date(call.attended_at ?? call.called_at).getTime() - new Date(call.called_at).getTime()) / 1000))
    : Math.round((now - new Date(call.called_at).getTime()) / 1000);

  /* Size caps pair width (vw) with a height cap (vh) so the whole card —
     label, number, timer, waiter name and helper — always fits on a 720p TV. */
  const numberSize =
    density === "single"
      ? "text-[clamp(6rem,min(26vw,28vh),22rem)]"
      : density === "split"
        ? "text-[clamp(4.5rem,min(16vw,20vh),15rem)]"
        : density === "compact"
          ? "text-[clamp(3rem,8vh,5.5rem)]"
        : "text-[clamp(3.5rem,min(9vw,11vh),9rem)]";

  const timerSize =
    density === "single"
      ? "text-[clamp(3rem,min(12vw,14vh),10rem)]"
      : density === "split"
        ? "text-[clamp(2rem,min(7vw,10vh),6.5rem)]"
        : density === "compact"
          ? "text-[clamp(1.5rem,4.5vh,3rem)]"
        : "text-[clamp(1.75rem,min(4vw,5.5vh),4rem)]";

  const helperSize = density === "grid" || density === "compact" ? "text-sm" : "text-lg md:text-2xl";

  return (
    <article
      className={cn(
        "flex h-full min-h-0 w-full flex-col items-center justify-center overflow-hidden rounded-3xl px-4 text-center shadow-2xl transition-colors duration-300",
        density === "compact"
          ? "pt-1 pb-6"
          : density === "grid"
            ? "pt-4 pb-10"
            : "py-6",
        attended ? "call-card-attended" : "call-card-pending",
      )}
    >
      <span
        className={cn(
          "font-display font-semibold uppercase tracking-[0.3em] text-call-helper",
          density === "grid" || density === "compact" ? "text-xs" : "text-base md:text-xl",
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

      {call.assigned_waiter_name && call.assigned_waiter_name.trim().length > 0 && (
        <span
          className={cn(
            "w-full max-w-full truncate font-semibold text-call-helper",
            density === "single" || density === "split" ? "mt-2 text-xl md:text-3xl" : "mt-1 text-sm md:text-base",
          )}
          title={call.assigned_waiter_name}
        >
          {t("live.waiterLabel")}: {call.assigned_waiter_name}
        </span>
      )}

      <span className={cn("font-medium text-call-helper/90", density === "compact" ? "mt-1" : "mt-2", helperSize)}>
        {attended ? t("live.helperAttended") : t("live.helperWaiting")}
      </span>
    </article>
  );
}
