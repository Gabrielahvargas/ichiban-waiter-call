import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell, useLanguagePreference } from "@/components/AppShell";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Protected } from "@/components/Protected";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSettings } from "@/modules/config/useSettings";
import { callRpc } from "@/modules/shared/rpc";
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
        timezone: draft.timezone,
        dinner_start_hour: draft.dinner_start_hour,
        gateway_external_id: draft.gateway_external_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "global");
    setBusy(false);
    if (error) toast.error(t("errors.saveFailed"));
    else toast.success(t("common.saved"));
  }

  async function saveTable(table: DiningTable) {
    if (table.call_button === table.attend_button) {
      toast.error(t("settings.sameButtonError", { table: table.table_number }));
      return;
    }
    const { error } = await supabase
      .from("dining_tables")
      .update({
        alert_bulb_code: table.alert_bulb_code,
        button_device_external_id: table.button_device_external_id,
        gateway_external_id: table.gateway_external_id,
        call_button: table.call_button,
        attend_button: table.attend_button,
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
            <Text
              label={t("settings.timezone")}
              value={draft.timezone}
              onChange={(v) => set("timezone", v)}
            />
            <Num
              label={t("settings.dinnerStart")}
              value={draft.dinner_start_hour}
              onChange={(v) => set("dinner_start_hour", v)}
            />
          </Section>

          <Section title={t("settings.pinSection")}>
            <PinSection />
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

          <Section title={t("settings.buttonsSection")} className="lg:col-span-2">
            <p className="mb-3 text-sm text-muted-foreground">{t("settings.buttonsHelp")}</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {tables.map((table, index) => {
                const invalid = table.call_button === table.attend_button;
                return (
                  <div key={`buttons-${table.id}`} className="rounded-lg border border-border p-3">
                    <div className="flex items-baseline gap-3">
                      <p className="font-display text-2xl font-bold tabular">{table.table_number}</p>
                      <span className="truncate text-xs text-muted-foreground">
                        {t("settings.buttonId")}: {table.button_device_external_id || "—"}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <SwitchChoice
                        label={t("settings.callButton")}
                        value={table.call_button}
                        onChange={(v) => {
                          const next = [...tables];
                          next[index] = { ...table, call_button: v };
                          setTables(next);
                        }}
                      />
                      <SwitchChoice
                        label={t("settings.attendButton")}
                        value={table.attend_button}
                        onChange={(v) => {
                          const next = [...tables];
                          next[index] = { ...table, attend_button: v };
                          setTables(next);
                        }}
                      />
                    </div>
                    {invalid ? (
                      <p className="mt-2 text-sm font-medium text-destructive">
                        {t("settings.sameButtonError", { table: table.table_number })}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      disabled={invalid}
                      onClick={() => void saveTable(tables[index]!)}
                      className="mt-3 rounded-md border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                    >
                      {t("common.save")}
                    </button>
                  </div>
                );
              })}
            </div>
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

function PinSection() {
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void callRpc<boolean>("admin_pin_configured")
      .then((value) => setConfigured(Boolean(value)))
      .catch(() => setConfigured(null));
  }, []);

  async function savePin() {
    if (!/^[0-9]{4,8}$/.test(pin)) {
      toast.error(t("settings.pinInvalidFormat"));
      return;
    }
    setBusy(true);
    try {
      await callRpc("admin_set_pin", { p_pin: pin });
      setPin("");
      setConfigured(true);
      toast.success(t("settings.pinSaved"));
    } catch {
      toast.error(t("errors.saveFailed"));
    }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("settings.pinHelp")}</p>
      <p className="text-sm font-semibold">
        {configured === null ? "" : configured ? t("settings.pinConfigured") : t("settings.pinMissing")}
      </p>
      <label className="block text-sm text-muted-foreground">
        {t("settings.pinLabel")}
        <input
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
          value={pin}
          inputMode="numeric"
          autoComplete="off"
          onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => void savePin()}
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {t("common.save")}
      </button>
    </div>
  );
}

function SwitchChoice({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const { t } = useI18n();
  return (
    <label className="block text-sm text-muted-foreground">
      {label}
      <select
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {[1, 2, 3, 4].map((n) => (
          <option key={n} value={n}>
            {t("settings.switchOption", { n })}
          </option>
        ))}
      </select>
    </label>
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
