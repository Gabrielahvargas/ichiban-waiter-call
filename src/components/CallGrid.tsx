import { CallCard } from "@/components/CallCard";
import type { Call } from "@/modules/shared/types";
import { cn } from "@/lib/utils";

/** Same responsive rules the admin live screen uses, shared with paired displays. */
export function gridClasses(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 md:grid-cols-2";
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 6) return "grid-cols-2 lg:grid-cols-3";
  if (count <= 9) return "grid-cols-2 lg:grid-cols-3";
  return "grid-cols-2 lg:grid-cols-4";
}

export function CallGrid({ calls, now }: { calls: Call[]; now: number }) {
  const density = calls.length <= 1 ? "single" : calls.length === 2 ? "split" : "grid";
  return (
    <div className={cn("grid flex-1 gap-3", gridClasses(calls.length))}>
      {calls.map((call) => (
        <CallCard key={call.id} call={call} now={now} density={density} />
      ))}
    </div>
  );
}
