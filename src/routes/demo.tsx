import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { CallsScreen } from "@/components/CallsScreen";
import { Protected } from "@/components/Protected";
import { useI18n } from "@/i18n";
import { ingestButtonEvent, type IngestResult } from "@/modules/events/ingest";
import { TABLE_NUMBERS, type DiningTable } from "@/modules/shared/types";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Demo mode — Ichiban Waiter Calls" },
      {
        name: "description",
        content: "Try the Ichiban waiter call system with simulated table buttons and a real clock.",
      },
      { property: "og:title", content: "Demo mode — Ichiban Waiter Calls" },
      {
        property: "og:description",
        content: "Simulated button 3 and button 4 for every table, with records kept apart from production.",
      },
    ],
  }),
  component: DemoPage,
});

function DemoPage() {
  const { t } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const [tables, setTables] = useState<DiningTable[]>([]);

  useEffect(() => {
    void supabase
      .from("dining_tables")
      .select("*")
      .order("table_number")
      .then(({ data }) => setTables((data ?? []) as DiningTable[]));
  }, []);

  function mappingFor(tableNumber: number) {
    const row = tables.find((tbl) => tbl.table_number === tableNumber);
    return {
      call: { button: row?.call_button ?? 3, clickType: row?.call_click_type ?? "single_click" },
      attend: { button: row?.attend_button ?? 4, clickType: row?.attend_click_type ?? "single_click" },
    };
  }

  async function press(tableNumber: number, config: { button: number; clickType: string }) {
    const key = `${tableNumber}-${config.button}-${config.clickType}`;
    setBusy(key);
    try {
      const res = await ingestButtonEvent({
        tableNumber,
        button: config.button,
        environment: "demo",
        source: "demo_panel",
        clickType: config.clickType as "single_click" | "double_click" | "long_click",
      });
      toast(messageFor(res.result, tableNumber, t));
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell wide>
      <Protected>
        <div className="mb-5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold uppercase tracking-wide">{t("demo.title")}</h1>
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold tracking-widest text-primary-foreground">
              {t("demo.badge")}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t("demo.subtitle")}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {TABLE_NUMBERS.map((tableNumber) => {
              const map = mappingFor(tableNumber);
              return (
                <div
                  key={tableNumber}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <span className="font-display text-3xl font-bold tabular">{tableNumber}</span>
                  <div className="ml-auto flex gap-2">
                    <button
                      type="button"
                      disabled={busy === `${tableNumber}-${map.call.button}-${map.call.clickType}`}
                      onClick={() => void press(tableNumber, map.call)}
                      className="min-h-12 rounded-lg bg-call-pending px-4 py-2 text-sm font-semibold text-call-number disabled:opacity-60"
                    >
                      {t("demo.call", { n: map.call.button })}
                      <span className="ml-1 text-xs opacity-80">({t(`common.clickType.${map.call.clickType}`)})</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy === `${tableNumber}-${map.attend.button}-${map.attend.clickType}`}
                      onClick={() => void press(tableNumber, map.attend)}
                      className="min-h-12 rounded-lg bg-call-attended px-4 py-2 text-sm font-semibold text-call-number disabled:opacity-60"
                    >
                      {t("demo.attend", { n: map.attend.button })}
                      <span className="ml-1 text-xs opacity-80">({t(`common.clickType.${map.attend.clickType}`)})</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-border bg-background p-2">
            <CallsScreen environment="demo" />
          </div>
        </div>
      </Protected>
    </AppShell>
  );
}

function messageFor(result: IngestResult, table: number, t: (k: string, v?: Record<string, string | number>) => string) {
  switch (result) {
    case "call_created":
      return t("demo.created", { table });
    case "call_attended":
      return t("demo.attended", { table });
    case "ignored_already_pending":
      return t("demo.ignoredPending");
    case "ignored_cooldown":
      return t("demo.ignoredCooldown");
    default:
      return t("demo.ignoredNoPending");
  }
}
