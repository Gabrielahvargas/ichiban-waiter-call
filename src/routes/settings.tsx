import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell, useLanguagePreference } from "@/components/AppShell";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Protected } from "@/components/Protected";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSettings } from "@/modules/config/useSettings";
import { bulbCodesForTable, type AppSettings, type DiningTable } from "@/modules/shared/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Ichiban Waiter Calls" },
      { name: "description", content: "Display output, call rules, sound alerts, lights and device identifiers." },
      { property: "og:title", content: "Settings — Ichiban Waiter Calls" },
      {
        property: "og:description",
        content: "Display output, call rules, sound alerts, lights and device identifiers.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useI18n();
  const { persist } = useLanguagePreference();
  const { settings } = useSettings();
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!draft) setDraft(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  useEffect(() => {
    void supabase
      .from("dining_tables")
      .select("*")
      .order("table_number")
      .then(({ data }) => setTables((data ?? []) as DiningTable[]));
  }, []);

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    const { error } = await supabase
      .from("app_settings")
      .update({
        output_mode: draft.output_mode,
        new_call_rule: draft.new_call_rule,
        sound_alerts: draft.sound_alerts,
        wait_threshold_seconds: draft.wait_threshold_seconds,
        attended_card_seconds: draft.attended_card_seconds,
        local_red_seconds: draft.local_red_seconds,
        shared_light_color: draft.shared_light_color,
        shared_light_alert_color: draft.shared_light_alert_color,
        log_retention_days: draft.log_retention_days,
        gateway_external_id: draft.gateway_external_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "global");
    setBusy(false);
    if (error) toast.error(t("errors.saveFailed"));
    else toast.success(t("common.saved"));
  }

  async function saveTable(table: DiningTable) {
    const { error } = await supabase
      .from("dining_tables")
      .update({
        alert_bulb_code: table.alert_bulb_code,
        button_device_external_id: table.button_device_external_id,
        gateway_external_id: table.gateway_external_id,
      })
      .eq("id", table.id);
    if (error) toast.error(t("errors.saveFailed"));
    else toast.success(t("common.saved"));
  }

  if (!draft) return null;

  return (
    <AppShell>
      <Protected adminOnly>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide">{t("settings.title")}</h1>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="ml-auto rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? t("common.saving") : t("common.save")}
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title={t("settings.languageSection")}>
            <p className="mb-3 text-sm text-muted-foreground">{t("settings.languageHelp")}</p>
            <LanguageSwitcher size="large" onChange={persist} />
          </Section>

          <Section title={t("settings.outputSection")}>
            <Choice
              label={t("settings.outputMode")}
              value={draft.output_mode}
              onChange={(v) => set("output_mode", v as AppSettings["output_mode"])}
              options={[
                { value: "tv", label: t("settings.outputTv") },
                { value: "touch", label: t("settings.outputTouch") },
                { value: "both", label: t("settings.outputBoth") },
              ]}
            />
          </Section>

          <Section title={t("settings.callRuleSection")}>
            <Choice
              label={t("settings.newCallRule")}
              value={draft.new_call_rule}
              onChange={(v) => set("new_call_rule", v as AppSettings["new_call_rule"])}
              options={[
                { value: "immediate", label: t("settings.ruleImmediate") },
                { value: "after_10s", label: t("settings.rule10") },
                { value: "after_30s", label: t("settings.rule30") },
              ]}
            />
          </Section>

          <Section title={t("settings.soundSection")}>
            <Choice
              label={t("settings.soundMode")}
              value={draft.sound_alerts}
              onChange={(v) => set("sound_alerts", v as AppSettings["sound_alerts"])}
              options={[
                { value: "every_call", label: t("settings.soundEvery") },
                { value: "threshold_only", label: t("settings.soundThreshold") },
                { value: "none", label: t("settings.soundNone") },
              ]}
            />
            <Num
              label={t("settings.waitThreshold")}
              value={draft.wait_threshold_seconds}
              onChange={(v) => set("wait_threshold_seconds", v)}
            />
          </Section>

          <Section title={t("settings.timingSection")}>
            <Num
              label={t("settings.attendedCard")}
              value={draft.attended_card_seconds}
              onChange={(v) => set("attended_card_seconds", v)}
            />
            <Num
              label={t("settings.localRed")}
              value={draft.local_red_seconds}
              onChange={(v) => set("local_red_seconds", v)}
            />
          </Section>

          <Section title={t("settings.lightSection")}>
            <Color
              label={t("settings.normalColor")}
              value={draft.shared_light_color}
              onChange={(v) => set("shared_light_color", v)}
            />
            <Color
              label={t("settings.alertColor")}
              value={draft.shared_light_alert_color}
              onChange={(v) => set("shared_light_alert_color", v)}
            />
          </Section>

          <Section title={t("settings.retentionSection")}>
            <Num
              label={t("settings.retentionDays")}
              value={draft.log_retention_days}
              onChange={(v) => set("log_retention_days", v)}
            />
          </Section>

          <Section title={t("settings.idsSection")}>
            <Text
              label={t("settings.gatewayId")}
              value={draft.gateway_external_id ?? ""}
              onChange={(v) => set("gateway_external_id", v)}
            />
          </Section>

          <Section title={t("settings.bulbsSection")} className="lg:col-span-2">
            <div className="grid gap-3 md:grid-cols-2">
              {tables.map((table, index) => (
                <div key={table.id} className="rounded-lg border border-border p-3">
                  <p className="font-display text-2xl font-bold tabular">{table.table_number}</p>
                  <label className="mt-2 block text-sm text-muted-foreground">
                    {t("settings.alertBulb")}
                    <select
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                      value={table.alert_bulb_code}
                      onChange={(e) => {
                        const next = [...tables];
                        next[index] = { ...table, alert_bulb_code: e.target.value };
                        setTables(next);
                      }}
                    >
                      {bulbCodesForTable(table.table_number).map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="mt-2 block text-sm text-muted-foreground">
                    {t("settings.buttonId")}
                    <input
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                      value={table.button_device_external_id ?? ""}
                      onChange={(e) => {
                        const next = [...tables];
                        next[index] = { ...table, button_device_external_id: e.target.value };
                        setTables(next);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void saveTable(tables[index]!)}
                    className="mt-3 rounded-md border border-border px-3 py-1.5 text-sm font-medium"
                  >
                    {t("common.save")}
                  </button>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </Protected>
    </AppShell>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 ${className ?? ""}`}>
      <h2 className="mb-3 font-display text-xl font-semibold uppercase tracking-wide">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block text-sm text-muted-foreground">
      {label}
      <select
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-sm text-muted-foreground">
      {label}
      <input
        type="number"
        min={0}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-foreground tabular"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm text-muted-foreground">
      {label}
      <input
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      {label}
      <input
        type="color"
        className="h-10 w-20 rounded-md border border-input bg-background"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
