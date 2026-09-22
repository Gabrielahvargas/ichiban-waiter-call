import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { EnvironmentToggle, useCallHistory } from "@/routes/history";
import { useI18n } from "@/i18n";
import { formatElapsed } from "@/modules/calls/useCalls";
import { todayIso, useWaiters } from "@/modules/waiters/api";
import { TABLE_NUMBERS, type AppEnvironment, type Shift } from "@/modules/shared/types";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Statistics — Ichiban Waiter Calls" },
      {
        name: "description",
        content: "Response times and call volume by waiter, table, shift and hour.",
      },
      { property: "og:title", content: "Statistics — Ichiban Waiter Calls" },
      {
        property: "og:description",
        content: "Response times and call volume by waiter, table, shift and hour.",
      },
    ],
  }),
  component: StatsPage,
});

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function StatsPage() {
  const { t } = useI18n();
  const { waiters } = useWaiters();
  const [environment, setEnvironment] = useState<AppEnvironment>("production");
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [shift, setShift] = useState<Shift | "all">("all");
  const [waiterId, setWaiterId] = useState<string | "all" | "none">("all");
  const [tableNumber, setTableNumber] = useState<number | "all">("all");

  const { calls, loading } = useCallHistory(environment, { from, to, shift, waiterId, tableNumber });

  const stats = useMemo(() => {
    const durations = calls.filter((c) => c.duration_seconds != null).map((c) => c.duration_seconds as number);
    const byTable = new Map<number, { count: number; total: number; max: number }>();
    const byHour = new Map<number, number>();
    const byWaiter = new Map<string, { name: string; count: number; total: number; max: number }>();

    for (const call of calls) {
      const hour = new Date(call.called_at).getHours();
      byHour.set(hour, (byHour.get(hour) ?? 0) + 1);

      const entry = byTable.get(call.table_number) ?? { count: 0, total: 0, max: 0 };
      entry.count += 1;
      if (call.duration_seconds != null) {
        entry.total += call.duration_seconds;
        entry.max = Math.max(entry.max, call.duration_seconds);
      }
      byTable.set(call.table_number, entry);

      const key = call.assigned_waiter_id ?? "none";
      const w = byWaiter.get(key) ?? {
        name: call.assigned_waiter_name ?? t("metrics.unassigned"),
        count: 0,
        total: 0,
        max: 0,
      };
      w.count += 1;
      if (call.duration_seconds != null) {
        w.total += call.duration_seconds;
        w.max = Math.max(w.max, call.duration_seconds);
      }
      byWaiter.set(key, w);
    }

    return {
      volume: calls.length,
      average: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      max: durations.length ? Math.max(...durations) : 0,
      byTable: [...byTable.entries()].sort((a, b) => a[0] - b[0]),
      byHour: [...byHour.entries()].sort((a, b) => a[0] - b[0]),
      byWaiter: [...byWaiter.entries()].sort((a, b) => b[1].count - a[1].count),
    };
  }, [calls, t]);

  return (
    <AppShell>
      <Protected>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide">{t("stats.title")}</h1>
          <EnvironmentToggle value={environment} onChange={setEnvironment} />
        </div>

        <section className="mb-5 rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-display text-lg font-semibold uppercase tracking-wide">
            {t("metrics.filters")}
          </h2>
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="text-muted-foreground">
              {t("metrics.from")}
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 block rounded-md border border-input bg-background px-3 py-2 text-foreground"
              />
            </label>
            <label className="text-muted-foreground">
              {t("metrics.to")}
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 block rounded-md border border-input bg-background px-3 py-2 text-foreground"
              />
            </label>
            <label className="text-muted-foreground">
              {t("waiters.shift")}
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as Shift | "all")}
                className="mt-1 block rounded-md border border-input bg-background px-3 py-2 text-foreground"
              >
                <option value="all">{t("metrics.allShifts")}</option>
                <option value="lunch">{t("waiters.lunch")}</option>
                <option value="dinner">{t("waiters.dinner")}</option>
              </select>
            </label>
            <label className="text-muted-foreground">
              {t("metrics.waiter")}
              <select
                value={waiterId}
                onChange={(e) => setWaiterId(e.target.value)}
                className="mt-1 block rounded-md border border-input bg-background px-3 py-2 text-foreground"
              >
                <option value="all">{t("metrics.allWaiters")}</option>
                <option value="none">{t("metrics.unassigned")}</option>
                {waiters.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-muted-foreground">
              {t("common.table")}
              <select
                value={String(tableNumber)}
                onChange={(e) => setTableNumber(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="mt-1 block rounded-md border border-input bg-background px-3 py-2 text-foreground"
              >
                <option value="all">{t("metrics.allTables")}</option>
                {TABLE_NUMBERS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {loading ? (
          <p className="text-muted-foreground">{t("common.loading")}</p>
        ) : stats.volume === 0 ? (
          <p className="text-muted-foreground">{t("stats.noData")}</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label={t("stats.average")} value={formatElapsed(stats.average)} />
              <Metric label={t("stats.max")} value={formatElapsed(stats.max)} />
              <Metric label={t("stats.volume")} value={String(stats.volume)} />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <Panel title={t("metrics.byWaiter")}>
                <table className="w-full text-left text-sm">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-2">{t("metrics.waiter")}</th>
                      <th className="py-2">{t("stats.calls")}</th>
                      <th className="py-2">{t("stats.average")}</th>
                      <th className="py-2">{t("stats.max")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byWaiter.map(([key, v]) => (
                      <tr key={key} className="border-t border-border">
                        <td className="py-2 font-semibold">{v.name}</td>
                        <td className="py-2 tabular">{v.count}</td>
                        <td className="py-2 tabular">{formatElapsed(v.count ? v.total / v.count : 0)}</td>
                        <td className="py-2 tabular">{formatElapsed(v.max)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>

              <Panel title={t("stats.byTable")}>
                <table className="w-full text-left text-sm">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-2">{t("common.table")}</th>
                      <th className="py-2">{t("stats.calls")}</th>
                      <th className="py-2">{t("stats.average")}</th>
                      <th className="py-2">{t("stats.max")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byTable.map(([table, v]) => (
                      <tr key={table} className="border-t border-border">
                        <td className="py-2 font-display text-lg font-bold tabular">{table}</td>
                        <td className="py-2 tabular">{v.count}</td>
                        <td className="py-2 tabular">{formatElapsed(v.count ? v.total / v.count : 0)}</td>
                        <td className="py-2 tabular">{formatElapsed(v.max)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>

              <Panel title={t("stats.byHour")}>
                <div className="space-y-2">
                  {stats.byHour.map(([hour, count]) => {
                    const peak = Math.max(...stats.byHour.map(([, c]) => c));
                    return (
                      <div key={hour} className="flex items-center gap-3">
                        <span className="w-14 tabular text-sm text-muted-foreground">
                          {String(hour).padStart(2, "0")}:00
                        </span>
                        <div className="h-3 flex-1 rounded-full bg-secondary">
                          <div
                            className="h-3 rounded-full bg-primary"
                            style={{ width: `${(count / peak) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-right tabular text-sm">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </div>
          </>
        )}
      </Protected>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-4xl font-bold tabular">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 font-display text-xl font-semibold uppercase tracking-wide">{title}</h2>
      {children}
    </section>
  );
}
