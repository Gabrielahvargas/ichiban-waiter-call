import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { EnvironmentToggle } from "@/routes/history";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { syncSalesNow } from "@/lib/sales.functions";
import { useSettings } from "@/modules/config/useSettings";
import { todayIso } from "@/modules/waiters/api";
import { aggregateByWaiter, leader, type CategoryRule, type SaleRow, type WaiterTotals } from "@/modules/sales/classify";
import type { AppEnvironment, Shift } from "@/modules/shared/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sales")({
  head: () => ({
    meta: [
      { title: "Sales ranking — Ichiban" },
      { name: "description", content: "Which waiter sells the most alcohol and sushi, by period and shift." },
      { property: "og:title", content: "Sales ranking — Ichiban" },
      { property: "og:description", content: "Which waiter sells the most alcohol and sushi, by period and shift." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalesPage,
});

type Metric = "units" | "amount";
type SortKey = keyof Omit<WaiterTotals, "key">;
interface SyncState {
  status: string;
  last_success_at: string | null;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  last_error: string | null;
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function SalesPage() {
  const { t } = useI18n();
  const { settings } = useSettings();
  const sync = useServerFn(syncSalesNow);
  const [environment, setEnvironment] = useState<AppEnvironment>("production");
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [shift, setShift] = useState<Shift | "all">("all");
  const [metric, setMetric] = useState<Metric>("units");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "alcoholUnits", desc: true });
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [state, setState] = useState<SyncState | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    const { data } = await supabase.from("sales_category_rules").select("*").order("priority");
    setRules((data ?? []) as CategoryRule[]);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("sales_items")
      .select("product_name, tabit_category, waiter_external_id, waiter_name, quantity, amount")
      .eq("environment", environment)
      .gte("service_date", from)
      .lte("service_date", to)
      .limit(10000);
    if (shift !== "all") q = q.eq("shift", shift);
    const [{ data }, { data: st }] = await Promise.all([
      q,
      supabase.from("sales_sync_state").select("*").eq("environment", "production").maybeSingle(),
    ]);
    setSales((data ?? []) as SaleRow[]);
    setState(st as SyncState | null);
    setLoading(false);
  }, [environment, from, to, shift]);

  useEffect(() => void load(), [load]);
  useEffect(() => void loadRules(), [loadRules]);

  const rows = useMemo(() => aggregateByWaiter(sales, rules, t("metrics.unassigned")), [sales, rules, t]);
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sort.desc ? -cmp : cmp;
    });
  }, [rows, sort]);

  const aKey = metric === "units" ? "alcoholUnits" : "alcoholAmount";
  const sKey = metric === "units" ? "sushiUnits" : "sushiAmount";
  const alcoholLeader = leader(rows, aKey);
  const sushiLeader = leader(rows, sKey);
  const sum = (k: SortKey) => rows.reduce((acc, r) => acc + (r[k] as number), 0);
  const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const fmt = (n: number, m: Metric) => (m === "units" ? n.toLocaleString() : money(n));
  const when = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString("en-US", { timeZone: settings.timezone, dateStyle: "medium", timeStyle: "short" }) : t("sales.never");

  async function refreshNow() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await sync();
      setSyncMsg(r.status === "connected" ? t("sales.syncDone", { n: r.upserted }) : t(`sales.status.${r.status}`));
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : String(e));
    }
    setSyncing(false);
    void load();
  }

  const status = state?.status ?? "not_configured";
  const statusColor = status === "connected" ? "bg-primary" : status === "error" ? "bg-destructive" : "bg-muted-foreground";

  const header = (key: SortKey, label: string) => (
    <th className="py-2">
      <button type="button" className="font-semibold hover:text-foreground" onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }))}>
        {label}{sort.key === key ? (sort.desc ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );

  return (
    <AppShell>
      <Protected adminOnly>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide">{t("sales.title")}</h1>
          <EnvironmentToggle value={environment} onChange={setEnvironment} />
          {environment === "demo" && (
            <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold uppercase">{t("sales.demoBadge")}</span>
          )}
        </div>

        <section className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4 text-sm" aria-label={t("sales.syncStatus")}>
          <span className="flex items-center gap-2 font-semibold">
            <span className={cn("h-2.5 w-2.5 rounded-full", statusColor)} />
            {t(`sales.status.${status}`)}
          </span>
          <span className="text-muted-foreground">{t("sales.lastSync")}: <b className="text-foreground">{when(state?.last_success_at)}</b></span>
          <span className="text-muted-foreground">{t("sales.lastAttempt")}: <b className="text-foreground">{when(state?.last_attempt_at)}</b></span>
          <span className="text-muted-foreground">{t("sales.nextAttempt")}: <b className="text-foreground">{when(state?.next_attempt_at)}</b></span>
          <button type="button" disabled={syncing} onClick={() => void refreshNow()} className="ml-auto rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-60">
            {syncing ? t("sales.syncing") : t("sales.refreshNow")}
          </button>
          {(syncMsg || state?.last_error) && <p className="w-full text-muted-foreground">{syncMsg ?? state?.last_error}</p>}
        </section>

        {status === "not_configured" && environment === "production" && (
          <section className="mb-5 rounded-xl border border-border bg-card p-4 text-sm">
            <h2 className="mb-2 font-display text-lg font-semibold uppercase">{t("sales.setupTitle")}</h2>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>{t("sales.setup1")}</li>
              <li>{t("sales.setup2")}</li>
              <li>{t("sales.setup3", { tz: settings.timezone })}</li>
              <li>{t("sales.setup4")}</li>
            </ol>
          </section>
        )}

        <section className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 text-sm">
          <label className="text-muted-foreground">{t("metrics.from")}
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-md border border-input bg-background px-3 py-2 text-foreground" />
          </label>
          <label className="text-muted-foreground">{t("metrics.to")}
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-md border border-input bg-background px-3 py-2 text-foreground" />
          </label>
          <label className="text-muted-foreground">{t("waiters.shift")}
            <select value={shift} onChange={(e) => setShift(e.target.value as Shift | "all")} className="mt-1 block rounded-md border border-input bg-background px-3 py-2 text-foreground">
              <option value="all">{t("metrics.allShifts")}</option>
              <option value="lunch">{t("waiters.lunch")}</option>
              <option value="dinner">{t("waiters.dinner")}</option>
            </select>
          </label>
          <div className="inline-flex rounded-full border border-border bg-secondary p-1">
            {(["units", "amount"] as const).map((m) => (
              <button key={m} type="button" onClick={() => { setMetric(m); setSort({ key: m === "units" ? "alcoholUnits" : "alcoholAmount", desc: true }); }}
                className={cn("rounded-full px-4 py-1.5 font-semibold", metric === m ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                {t(`sales.by.${m}`)}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <p className="text-muted-foreground">{t("common.loading")}</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground">{t("sales.noData")}</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card label={t("sales.alcoholLeader")} value={alcoholLeader?.name ?? "—"} sub={alcoholLeader ? fmt(alcoholLeader[aKey], metric) : ""} />
              <Card label={t("sales.sushiLeader")} value={sushiLeader?.name ?? "—"} sub={sushiLeader ? fmt(sushiLeader[sKey], metric) : ""} />
              <Card label={t("sales.alcoholTotal")} value={`${sum("alcoholUnits").toLocaleString()} ${t("sales.units")}`} sub={money(sum("alcoholAmount"))} />
              <Card label={t("sales.sushiTotal")} value={`${sum("sushiUnits").toLocaleString()} ${t("sales.units")}`} sub={money(sum("sushiAmount"))} />
            </div>
            <section className="mt-5 overflow-x-auto rounded-xl border border-border bg-card p-5">
              <table className="w-full text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    {header("name", t("metrics.waiter"))}
                    {header("alcoholUnits", t("sales.col.alcoholUnits"))}
                    {header("alcoholAmount", t("sales.col.alcoholAmount"))}
                    {header("sushiUnits", t("sales.col.sushiUnits"))}
                    {header("sushiAmount", t("sales.col.sushiAmount"))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.key} className="border-t border-border">
                      <td className="py-2 font-semibold">{r.name}</td>
                      <td className="py-2 tabular">{r.alcoholUnits}</td>
                      <td className="py-2 tabular">{money(r.alcoholAmount)}</td>
                      <td className="py-2 tabular">{r.sushiUnits}</td>
                      <td className="py-2 tabular">{money(r.sushiAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}

        <RulesEditor rules={rules} onChange={() => void loadRules()} />
      </Protected>
    </AppShell>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-display text-3xl font-bold">{value}</p>
      <p className="tabular text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

function RulesEditor({ rules, onChange }: { rules: CategoryRule[]; onChange: () => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<CategoryRule>({ match_type: "keyword", pattern: "", target: "alcohol", priority: 100 });
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!draft.pattern.trim()) return setError(t("sales.rules.patternRequired"));
    const { error: e } = await supabase.from("sales_category_rules").insert({ ...draft, pattern: draft.pattern.trim() });
    setError(e?.message ?? null);
    if (!e) { setDraft({ ...draft, pattern: "" }); onChange(); }
  }
  async function remove(id?: string) {
    if (!id) return;
    await supabase.from("sales_category_rules").delete().eq("id", id);
    onChange();
  }

  const input = "rounded-md border border-input bg-background px-3 py-2 text-foreground";
  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-5 text-sm">
      <h2 className="font-display text-xl font-semibold uppercase tracking-wide">{t("sales.rules.title")}</h2>
      <p className="mb-3 text-muted-foreground">{t("sales.rules.help")}</p>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <select aria-label={t("sales.rules.type")} value={draft.match_type} onChange={(e) => setDraft({ ...draft, match_type: e.target.value as CategoryRule["match_type"] })} className={input}>
          <option value="keyword">{t("sales.rules.keyword")}</option>
          <option value="tabit_category">{t("sales.rules.tabitCategory")}</option>
        </select>
        <input aria-label={t("sales.rules.pattern")} placeholder={t("sales.rules.pattern")} value={draft.pattern} onChange={(e) => setDraft({ ...draft, pattern: e.target.value })} className={input} />
        <select aria-label={t("sales.rules.target")} value={draft.target} onChange={(e) => setDraft({ ...draft, target: e.target.value as CategoryRule["target"] })} className={input}>
          <option value="alcohol">{t("sales.cat.alcohol")}</option>
          <option value="sushi">{t("sales.cat.sushi")}</option>
          <option value="ignore">{t("sales.cat.ignore")}</option>
        </select>
        <input aria-label={t("sales.rules.priority")} type="number" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} className={cn(input, "w-24")} />
        <button type="button" onClick={() => void add()} className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground">{t("sales.rules.add")}</button>
      </div>
      {error && <p className="mb-2 text-destructive">{error}</p>}
      <ul className="space-y-1">
        {rules.map((r) => (
          <li key={r.id} className="flex items-center gap-3 border-t border-border py-2">
            <span className="w-32 text-muted-foreground">{r.match_type === "keyword" ? t("sales.rules.keyword") : t("sales.rules.tabitCategory")}</span>
            <span className="font-semibold">"{r.pattern}"</span>
            <span>→ {t(`sales.cat.${r.target}`)}</span>
            <span className="text-muted-foreground">#{r.priority}</span>
            <button type="button" onClick={() => void remove(r.id)} className="ml-auto text-muted-foreground hover:text-destructive">{t("sales.rules.remove")}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
