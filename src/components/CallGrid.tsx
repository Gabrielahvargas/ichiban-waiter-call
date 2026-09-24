import { CallCard } from "@/components/CallCard";
import type { Call } from "@/modules/shared/types";
import { cn } from "@/lib/utils";

/** Same responsive rules the admin live screen uses, shared with paired displays. */
export function gridClasses(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 md:grid-cols-2";
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 6) return "grid-cols-3";
  if (count <= 9) return "grid-cols-2 lg:grid-cols-3";
  return "grid-cols-2 lg:grid-cols-4";
}

export function portraitGridClasses(count: number): string {
  if (count <= 2) return "grid-cols-1";
  return "grid-cols-2";
}

export function CallGrid({ calls, now, portrait = false }: { calls: Call[]; now: number; portrait?: boolean }) {
  const density = calls.length <= 1 ? "single" : calls.length === 2 ? "split" : calls.length >= 5 ? "compact" : "grid";
  return (
    <div
      className={cn(
        "grid min-h-0 flex-1 auto-rows-[minmax(0,1fr)] gap-3 overflow-hidden",
        portrait ? portraitGridClasses(calls.length) : gridClasses(calls.length),
      )}
    >
      {calls.map((call) => (
        <CallCard key={call.id} call={call} now={now} density={density} />
      ))}
    </div>
  );
}
