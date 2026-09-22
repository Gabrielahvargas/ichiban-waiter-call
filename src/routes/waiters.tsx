import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useI18n } from "@/i18n";
import {
  assignTable,
  createWaiter,
  defaultShift,
  deleteWaiter,
  setWaiterActive,
  todayIso,
  useAssignments,
  useWaiters,
} from "@/modules/waiters/api";
import { TABLE_NUMBERS, type Shift } from "@/modules/shared/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/waiters")({
  head: () => ({
    meta: [
      { title: "Waiters — Ichiban Waiter Calls" },
      {
        name: "description",
        content: "Waiter registry and daily table assignments by date and shift.",
      },
      { property: "og:title", content: "Waiters — Ichiban Waiter Calls" },
      {
        property: "og:description",
        content: "Waiter registry and daily table assignments by date and shift.",
      },
    ],
  }),
  component: WaitersPage,
});

function WaitersPage() {
  const { t, locale } = useI18n();
  const { waiters, reload } = useWaiters();
  const [serviceDate, setServiceDate] = useState(todayIso());
  const [shift, setShift] = useState<Shift>(defaultShift());
  const { assignments, history, reload: reloadAssignments } = useAssignments(serviceDate, shift);
  const [selectedWaiter, setSelectedWaiter] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const byTable = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of assignments) map.set(a.table_number, a.waiter_id);
    return map;
  }, [assignments]);

  const waiterName = (id: string | null | undefined) =>
    waiters.find((w) => w.id === id)?.full_name ?? t("waiters.unassigned");

  async function toggleTable(tableNumber: number) {
    if (!selectedWaiter) {
      toast.info(t("waiters.selectWaiterHint"));
      return;
    }
    const current = byTable.get(tableNumber) ?? null;
    const next = current === selectedWaiter ? null : selectedWaiter;
    try {
      await assignTable({ tableNumber, serviceDate, shift, waiterId: next });
      await reloadAssignments();
    } catch {
      toast.error(t("errors.saveFailed"));
    }
  }

  async function addWaiter() {
    const name = newName.trim();
    if (!name) return;
    try {
      await createWaiter(name, null);
      setNewName("");
      await reload();
    } catch {
      toast.error(t("errors.saveFailed"));
    }
  }

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" }) : t("waiters.current");

  return (
    <AppShell>
      <Protected adminOnly>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">{t("waiters.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("waiters.subtitle")}</p>

        <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* Registry */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 font-display text-xl font-semibold uppercase tracking-wide">
              {t("waiters.title")}
            </h2>
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("waiters.addPlaceholder")}
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void addWaiter()}
                className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
              >
                {t("waiters.add")}
              </button>
            </div>

            <ul className="mt-4 space-y-2">
              {waiters.length === 0 && <li className="text-sm text-muted-foreground">{t("waiters.empty")}</li>}
              {waiters.map((w) => (
                <li
                  key={w.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border border-border px-3 py-2",
                    selectedWaiter === w.id && "border-primary bg-accent",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedWaiter(selectedWaiter === w.id ? null : w.id)}
                    className="flex-1 text-left text-sm font-semibold"
                  >
                    {w.full_name}
                    {!w.active && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({t("waiters.inactive")})
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void setWaiterActive(w.id, !w.active).then(reload)}
                    className="rounded border border-border px-2 py-1 text-xs text-muted-foreground"
                  >
                    {w.active ? t("waiters.deactivate") : t("waiters.activate")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteWaiter(w.id).then(reload)}
                    className="rounded border border-border px-2 py-1 text-xs text-muted-foreground"
                  >
                    {t("waiters.remove")}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Daily board */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-end gap-3">
              <h2 className="font-display text-xl font-semibold uppercase tracking-wide">{t("waiters.board")}</h2>
              <label className="text-sm">
                <span className="mr-2 text-muted-foreground">{t("waiters.date")}</span>
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
              </label>
              <div className="inline-flex rounded-full border border-border bg-secondary p-1">
                {(["lunch", "dinner"] as Shift[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setShift(s)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-semibold",
                      shift === s ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {t(`waiters.${s}`)}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              {selectedWaiter
                ? `${t("waiters.selectTables")} — ${waiterName(selectedWaiter)}`
                : t("waiters.selectWaiter")}
            </p>
            <p className="text-xs text-muted-foreground">{t("waiters.planAhead")}</p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {TABLE_NUMBERS.map((num) => {
                const owner = byTable.get(num) ?? null;
                const mine = owner !== null && owner === selectedWaiter;
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => void toggleTable(num)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-colors",
                      mine
                        ? "border-primary bg-primary/15"
                        : owner
                          ? "border-border bg-secondary"
                          : "border-dashed border-border bg-background",
                    )}
                  >
                    <span className="block font-display text-3xl font-bold tabular">{num}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {owner ? waiterName(owner) : t("waiters.unassigned")}
                    </span>
                  </button>
                );
              })}
            </div>

            <h3 className="mt-6 mb-2 font-display text-lg font-semibold uppercase tracking-wide">
              {t("waiters.history")}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-2">{t("common.table")}</th>
                    <th className="py-2">{t("metrics.waiter")}</th>
                    <th className="py-2">{t("waiters.effectiveFrom")}</th>
                    <th className="py-2">{t("waiters.effectiveTo")}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((a) => (
                    <tr key={a.id} className="border-t border-border">
                      <td className="py-2 font-display text-base font-bold tabular">{a.table_number}</td>
                      <td className="py-2">{waiterName(a.waiter_id)}</td>
                      <td className="py-2 tabular">{fmt(a.effective_from)}</td>
                      <td className="py-2 tabular">{fmt(a.effective_to)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </Protected>
    </AppShell>
  );
}
