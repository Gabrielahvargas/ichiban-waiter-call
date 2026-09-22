import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { CallsScreen } from "@/components/CallsScreen";
import { Protected } from "@/components/Protected";
import { useI18n } from "@/i18n";
import { ingestButtonEvent, type IngestResult } from "@/modules/events/ingest";
import { TABLE_NUMBERS } from "@/modules/shared/types";

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

  async function press(tableNumber: number, button: 3 | 4) {
    const key = `${tableNumber}-${button}`;
    setBusy(key);
    try {
      const res = await ingestButtonEvent({ tableNumber, button, environment: "demo", source: "demo_panel" });
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
            {TABLE_NUMBERS.map((tableNumber) => (
              <div
                key={tableNumber}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                <span className="font-display text-3xl font-bold tabular">{tableNumber}</span>
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    disabled={busy === `${tableNumber}-3`}
                    onClick={() => void press(tableNumber, 3)}
                    className="min-h-12 rounded-lg bg-call-pending px-4 py-2 text-sm font-semibold text-call-number disabled:opacity-60"
                  >
                    {t("demo.call")}
                  </button>
                  <button
                    type="button"
                    disabled={busy === `${tableNumber}-4`}
                    onClick={() => void press(tableNumber, 4)}
                    className="min-h-12 rounded-lg bg-call-attended px-4 py-2 text-sm font-semibold text-call-number disabled:opacity-60"
                  >
                    {t("demo.attend")}
                  </button>
                </div>
              </div>
            ))}
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
