import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { formatElapsed } from "@/modules/calls/useCalls";
import type { AppEnvironment, Call } from "@/modules/shared/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Call history — Ichiban Waiter Calls" },
      { name: "description", content: "Every waiter call with its time, response time and table." },
      { property: "og:title", content: "Call history — Ichiban Waiter Calls" },
      { property: "og:description", content: "Every waiter call with its time, response time and table." },
    ],
  }),
  component: HistoryPage,
});

export function useCallHistory(environment: AppEnvironment) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void supabase
      .from("calls")
      .select("*")
      .eq("environment", environment)
      .order("called_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (cancelled) return;
        setCalls((data ?? []) as Call[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [environment]);

  return { calls, loading };
}

function HistoryPage() {
  const { t, locale } = useI18n();
  const [environment, setEnvironment] = useState<AppEnvironment>("production");
  const { calls, loading } = useCallHistory(environment);

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale, { dateStyle: "short", timeStyle: "medium" }) : "—";

  return (
    <AppShell>
      <Protected>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide">{t("history.title")}</h1>
          <EnvironmentToggle value={environment} onChange={setEnvironment} />
        </div>

        {loading ? (
          <p className="text-muted-foreground">{t("common.loading")}</p>
        ) : calls.length === 0 ? (
          <p className="text-muted-foreground">{t("history.empty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t("common.table")}</th>
                  <th className="px-4 py-3">{t("history.calledAt")}</th>
                  <th className="px-4 py-3">{t("history.attendedAt")}</th>
                  <th className="px-4 py-3">{t("history.duration")}</th>
                  <th className="px-4 py-3">{t("history.status")}</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr key={call.id} className="border-t border-border">
                    <td className="px-4 py-3 font-display text-lg font-bold tabular">{call.table_number}</td>
                    <td className="px-4 py-3 tabular">{fmt(call.called_at)}</td>
                    <td className="px-4 py-3 tabular">{fmt(call.attended_at)}</td>
                    <td className="px-4 py-3 tabular">
                      {call.duration_seconds == null ? "—" : formatElapsed(call.duration_seconds)}
                    </td>
                    <td className="px-4 py-3">
                      {call.status === "pending" ? t("history.pending") : t("history.done")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Protected>
    </AppShell>
  );
}

export function EnvironmentToggle({
  value,
  onChange,
}: {
  value: AppEnvironment;
  onChange: (v: AppEnvironment) => void;
}) {
  const { t } = useI18n();
  const options: { key: AppEnvironment; label: string }[] = [
    { key: "production", label: t("history.production") },
    { key: "demo", label: t("history.demoEnv") },
  ];
  return (
    <div className="inline-flex rounded-full border border-border bg-secondary p-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
            value === o.key ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
