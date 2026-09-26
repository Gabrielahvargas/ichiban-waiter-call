import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { resyncSharedLight } from "@/lib/shared-light.functions";
import { ingestButtonEvent, type IngestResult } from "@/modules/events/ingest";
import { cn } from "@/lib/utils";
import { TABLE_NUMBERS, type Call, type DiningTable } from "@/modules/shared/types";

export const Route = createFileRoute("/remote")({
  head: () => ({
    meta: [
      { title: "Remote panel — Ichiban Waiter Calls" },
      { name: "description", content: "Call or attend real tables from your phone." },
      { property: "og:title", content: "Remote panel — Ichiban Waiter Calls" },
      { property: "og:description", content: "Call or attend real tables from your phone." },
    ],
  }),
  component: RemotePage,
});

function RemotePage() {
  const { t } = useI18n();
  const syncLight = useServerFn(resyncSharedLight);
  const [busy, setBusy] = useState<string | null>(null);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [pending, setPending] = useState<Map<number, Call>>(new Map());
  const [, setTick] = useState(0);

  const loadPending = useCallback(async () => {
    const { data } = await supabase
      .from("calls")
      .select("*")
      .eq("environment", "production")
      .eq("status", "pending");
    const map = new Map<number, Call>();
    for (const c of (data ?? []) as Call[]) map.set(c.table_number, c);
    setPending(map);
  }, []);

  useEffect(() => {
    void supabase
      .from("dining_tables")
      .select("*")
      .order("table_number")
      .then(({ data }) => setTables((data ?? []) as DiningTable[]));
    void loadPending();

    const channel = supabase
      .channel("remote-calls")
      .on("postgres_changes", { event: "*", schema: "public", table: "calls" }, () => void loadPending())
      .subscribe();
    const timer = window.setInterval(() => setTick((n) => n + 1), 30000);
    return () => {
      void supabase.removeChannel(channel);
      window.clearInterval(timer);
    };
  }, [loadPending]);

  function mappingFor(tableNumber: number) {
    const row = tables.find((tbl) => tbl.table_number === tableNumber);
    return {
      call: { button: row?.call_button ?? 3, clickType: row?.call_click_type ?? "single_click" },
      attend: { button: row?.attend_button ?? 4, clickType: row?.attend_click_type ?? "single_click" },
    };
  }

  async function press(tableNumber: number, config: { button: number; clickType: string }) {
    const key = `${tableNumber}-${config.button}`;
    setBusy(key);
    try {
      const res = await ingestButtonEvent({
        tableNumber,
        button: config.button,
        environment: "production",
        source: "remote_panel",
        clickType: config.clickType as "single_click" | "double_click" | "long_click",
      });
      toast(messageFor(res.result, tableNumber, t));
      if (res.result === "call_created" || res.result === "call_attended") {
        void syncLight({}).catch(() => undefined);
      }
      await loadPending();
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setBusy(null);
    }
  }

  function elapsedLabel(call: Call): string {
    const mins = Math.floor((Date.now() - new Date(call.called_at).getTime()) / 60000);
    return mins < 1 ? t("remote.now") : t("remote.ago", { m: mins });
  }

  return (
    <AppShell>
      <Protected adminOnly>
        <div className="mx-auto max-w-[480px]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-black uppercase tracking-tight">
                {t("remote.title")}
              </h1>
              <p className="text-xs text-muted-foreground">{t("remote.subtitle")}</p>
            </div>
            {pending.size > 0 && (
              <div className="flex animate-pulse items-center gap-2 rounded-full border border-call-pending/30 bg-call-pending/10 px-3 py-1">
                <span className="block h-2 w-2 rounded-full bg-call-pending" />
                <span className="text-xs font-bold text-call-pending">
                  {t("remote.pending", { count: pending.size })}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {TABLE_NUMBERS.map((tableNumber) => {
              const map = mappingFor(tableNumber);
              const call = pending.get(tableNumber);
              const isPending = Boolean(call);
              return (
                <div
                  key={tableNumber}
                  className={cn(
                    "flex items-center gap-4 rounded-2xl border bg-card p-4",
                    isPending
                      ? "border-2 border-call-pending/50 shadow-[0_0_15px_rgba(220,38,38,0.15)]"
                      : "border-border",
                  )}
                >
                  <div className="flex w-16 flex-col items-center justify-center border-r border-border pr-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {t("remote.table")}
                    </span>
                    <span
                      className={cn(
                        "font-display text-2xl font-black tabular",
                        isPending ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {tableNumber}
                    </span>
                  </div>
                  <div className="grid flex-1 grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busy === `${tableNumber}-${map.call.button}`}
                      onClick={() => void press(tableNumber, map.call)}
                      className={cn(
                        "flex h-14 flex-col items-center justify-center rounded-xl font-bold uppercase tracking-tight transition-all disabled:opacity-60",
                        isPending
                          ? "bg-call-pending text-call-number shadow-lg"
                          : "bg-secondary text-muted-foreground hover:bg-call-pending hover:text-call-number",
                      )}
                    >
                      <span className="text-sm">{t("remote.call")}</span>
                      {isPending && call && (
                        <span className="text-[10px] font-normal opacity-70">{elapsedLabel(call)}</span>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={busy === `${tableNumber}-${map.attend.button}`}
                      onClick={() => void press(tableNumber, map.attend)}
                      className={cn(
                        "flex h-14 items-center justify-center rounded-xl text-sm font-bold uppercase tracking-tight transition-colors disabled:opacity-60",
                        isPending
                          ? "border border-call-attended/40 bg-call-attended/20 text-call-attended"
                          : "bg-call-attended text-call-number shadow-lg",
                      )}
                    >
                      {t("remote.attend")}
                    </button>
                  </div>
                </div>
              );
            })}
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
