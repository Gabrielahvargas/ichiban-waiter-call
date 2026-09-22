import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSettings } from "@/modules/config/useSettings";
import type { LightingCommand } from "@/modules/shared/types";

export const Route = createFileRoute("/integration")({
  head: () => ({
    meta: [
      { title: "Integration status — Ichiban Waiter Calls" },
      {
        name: "description",
        content: "Tuya / Smart Life integration status and the queued light commands, pending verification.",
      },
      { property: "og:title", content: "Integration status — Ichiban Waiter Calls" },
      {
        property: "og:description",
        content: "Tuya / Smart Life integration status and the queued light commands, pending verification.",
      },
    ],
  }),
  component: IntegrationPage,
});

function IntegrationPage() {
  const { t, locale } = useI18n();
  const { settings } = useSettings();
  const [commands, setCommands] = useState<LightingCommand[]>([]);
  const [secretReady, setSecretReady] = useState<boolean | null>(null);
  const [lastHardwareEvent, setLastHardwareEvent] = useState<string | null>(null);
  const [demoOnly, setDemoOnly] = useState(false);
  const endpointUrl =
    typeof window === "undefined" ? "/api/public/tuya-events" : `${window.location.origin}/api/public/tuya-events`;

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/public/tuya-events")
      .then((r) => r.json())
      .then((body: { status?: string }) => {
        if (!cancelled) setSecretReady(body.status === "armed");
      })
      .catch(() => {
        if (!cancelled) setSecretReady(false);
      });

    void supabase
      .from("button_events")
      .select("received_at, source")
      .order("received_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data ?? []) as { received_at: string; source: string | null }[];
        const hardware = rows.find((r) => (r.source ?? "").startsWith("gateway"));
        setLastHardwareEvent(hardware?.received_at ?? null);
        setDemoOnly(!hardware && rows.length > 0);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("lighting_commands")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);
      if (!cancelled) setCommands((data ?? []) as LightingCommand[]);
    }
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const verified = settings.integration_status === "verified";

  return (
    <AppShell>
      <Protected adminOnly>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide">{t("integration.title")}</h1>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              verified ? "bg-call-attended text-call-number" : "bg-status-down/20 text-status-down"
            }`}
          >
            {t("integration.statusLabel")}: {verified ? t("integration.verified") : t("integration.pending")}
          </span>
        </div>

        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{t("integration.explanation")}</p>

        <section className="mt-6 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 font-display text-xl font-semibold uppercase tracking-wide">
            {t("integration.checklist")}
          </h2>
          <ul className="space-y-2 text-sm">
            {[t("integration.checkEvents3"), t("integration.checkEvents4"), t("integration.checkLights")].map(
              (item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="inline-block h-3 w-3 rounded-full bg-status-down" aria-hidden />
                  <span>{item}</span>
                </li>
              ),
            )}
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 font-display text-xl font-semibold uppercase tracking-wide">
            {t("integration.diagnosticsTitle")}
          </h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">{t("integration.diagEndpoint")}</dt>
              <dd className="font-mono text-xs break-all">{endpointUrl}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("integration.diagSecretSet")}</dt>
              <dd className={secretReady ? "font-semibold text-status-ok" : "font-semibold text-status-down"}>
                {secretReady === null
                  ? t("common.loading")
                  : secretReady
                    ? t("integration.diagSecretSet")
                    : t("integration.diagSecretMissing")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("integration.diagLastEvent")}</dt>
              <dd className="tabular">
                {lastHardwareEvent
                  ? new Date(lastHardwareEvent).toLocaleString(locale, {
                      dateStyle: "short",
                      timeStyle: "medium",
                    })
                  : demoOnly
                    ? t("integration.diagDemoOnly")
                    : t("integration.diagNoEvents")}
              </dd>
            </div>
          </dl>
          {!secretReady ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("integration.diagSteps")}</p>
          ) : null}
        </section>

        <section className="mt-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
            {t("integration.offlineTitle")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("integration.offlineNote")}</p>
        </section>

        <section className="mt-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
            {t("integration.commandsTitle")}
          </h2>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">{t("integration.commandsNote")}</p>
          {commands.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("integration.noCommands")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-2">{t("integration.target")}</th>
                    <th className="py-2">{t("integration.action")}</th>
                    <th className="py-2">{t("integration.color")}</th>
                    <th className="py-2">{t("integration.when")}</th>
                  </tr>
                </thead>
                <tbody>
                  {commands.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="py-2">
                        {c.target === "waiter_area" ? t("integration.waiterArea") : t("integration.tableBulb")}
                        {c.bulb_code ? ` · ${c.bulb_code}` : ""}
                      </td>
                      <td className="py-2">{c.action}</td>
                      <td className="py-2">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full border border-border"
                            style={{ backgroundColor: c.color ?? "transparent" }}
                            aria-hidden
                          />
                          {c.color ?? "—"}
                        </span>
                      </td>
                      <td className="py-2 tabular">
                        {new Date(c.created_at).toLocaleString(locale, {
                          dateStyle: "short",
                          timeStyle: "medium",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </Protected>
    </AppShell>
  );
}
