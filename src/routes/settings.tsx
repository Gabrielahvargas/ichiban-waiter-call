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
import { playSound, SOUND_IDS } from "@/modules/sound";
import {
  bulbCodesForTable,
  type AppSettings,
  type ClickType,
  type DiningTable,
} from "@/modules/shared/types";

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

const SETTINGS_KEYS = [
  "output_mode",
  "new_call_rule",
  "sound_alerts",
  "wait_threshold_seconds",
  "attended_card_seconds",
  "local_red_seconds",
  "shared_light_color",
  "shared_light_alert_color",
  "log_retention_days",
  "timezone",
  "dinner_start_hour",
  "gateway_external_id",
  "sound_id",
  "sound_volume",
  "custom_sound_url",
] as const;

function pickSettings(s: AppSettings) {
  const out: Record<string, unknown> = {};
  for (const k of SETTINGS_KEYS) out[k] = s[k];
  return out;
}

const TABLE_KEYS = [
  "alert_bulb_code",
  "button_device_external_id",
  "gateway_external_id",
  "call_button",
  "call_click_type",
  "attend_button",
  "attend_click_type",
] as const;

function tableChanged(a: DiningTable, b: DiningTable | undefined) {
  if (!b) return false;
  return TABLE_KEYS.some((k) => (a[k] ?? "") !== (b[k] ?? ""));
}

function SettingsPage() {
  const { t } = useI18n();
  const { persist } = useLanguagePreference();
  const { settings } = useSettings();
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState<AppSettings | null>(null);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [savedTables, setSavedTables] = useState<Record<string, DiningTable>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!draft) setDraft(settings);
    if (!saved || !draft) setSaved(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  useEffect(() => {
    void supabase
      .from("dining_tables")
      .select("*")
      .order("table_number")
      .then(({ data }) => {
        const rows = (data ?? []) as DiningTable[];
        setTables(rows);
        setSavedTables(Object.fromEntries(rows.map((r) => [r.id, r])));
      });
  }, []);

  const settingsDirty =
    !!draft && !!saved && JSON.stringify(pickSettings(draft)) !== JSON.stringify(pickSettings(saved));
  const tablesDirty = tables.some((tb) => tableChanged(tb, savedTables[tb.id]));
  const anyDirty = settingsDirty || tablesDirty;

  useEffect(() => {
    if (!anyDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = t("settings.leaveWarning");
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [anyDirty, t]);

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    const { error } = await supabase
      .from("app_settings")
      .update({ ...(pickSettings(draft) as Partial<AppSettings>), updated_at: new Date().toISOString() })
      .eq("id", "global");
    setBusy(false);
    if (error) toast.error(t("errors.saveFailed"));
    else {
      setSaved(draft);
      toast.success(t("common.saved"));
    }
  }

  function tableActionConflict(table: DiningTable) {
    return table.call_button === table.attend_button && table.call_click_type === table.attend_click_type;
  }

  async function saveTable(table: DiningTable) {
    if (tableActionConflict(table)) {
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
        call_click_type: table.call_click_type,
        attend_button: table.attend_button,
        attend_click_type: table.attend_click_type,
      })
      .eq("id", table.id);
    if (error) toast.error(t("errors.saveFailed"));
    else {
      setSavedTables((prev) => ({ ...prev, [table.id]: table }));
      toast.success(t("common.saved"));
    }
  }

  if (!draft) return null;

  return (
    <AppShell>
      <Protected adminOnly>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide">{t("settings.title")}</h1>
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
            <p className="text-xs text-muted-foreground">
              {t("settings.waitThresholdHelp", { seconds: draft.wait_threshold_seconds })}
            </p>
            <SoundPicker draft={draft} set={set} />
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
                const invalid = tableActionConflict(table);
                return (
                  <div key={`buttons-${table.id}`} className="rounded-lg border border-border p-3">
                    <div className="flex items-baseline gap-3">
                      <p className="font-display text-2xl font-bold tabular">{table.table_number}</p>
                      <span className="truncate text-xs text-muted-foreground">
                        {t("settings.buttonId")}: {table.button_device_external_id || "—"}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="space-y-2">
                        <SwitchChoice
                          label={t("settings.callButton")}
                          value={table.call_button}
                          onChange={(v) => {
                            const next = [...tables];
                            next[index] = { ...table, call_button: v };
                            setTables(next);
                          }}
                        />
                        <ClickChoice
                          value={table.call_click_type}
                          onChange={(v) => {
                            const next = [...tables];
                            next[index] = { ...table, call_click_type: v as ClickType };
                            setTables(next);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <SwitchChoice
                          label={t("settings.attendButton")}
                          value={table.attend_button}
                          onChange={(v) => {
                            const next = [...tables];
                            next[index] = { ...table, attend_button: v };
                            setTables(next);
                          }}
                        />
                        <ClickChoice
                          value={table.attend_click_type}
                          onChange={(v) => {
                            const next = [...tables];
                            next[index] = { ...table, attend_click_type: v as ClickType };
                            setTables(next);
                          }}
                        />
                      </div>
                    </div>
                    {invalid ? (
                      <p className="mt-2 text-sm font-medium text-destructive">
                        {t("settings.sameButtonError", { table: table.table_number })}
                      </p>
                    ) : null}
                    <TableSaveButton
                      disabled={invalid}
                      dirty={tableChanged(table, savedTables[table.id])}
                      onClick={() => void saveTable(tables[index]!)}
                    />
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
                  <TableSaveButton
                    dirty={tableChanged(table, savedTables[table.id])}
                    onClick={() => void saveTable(tables[index]!)}
                  />
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="sticky bottom-0 z-20 mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
          <span
            className={`text-sm font-semibold ${anyDirty ? "text-accent" : "text-status-ok"}`}
            role="status"
          >
            {anyDirty ? t("settings.unsavedChanges") : t("settings.allSaved")}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              disabled={!settingsDirty || busy}
              onClick={() => saved && setDraft(saved)}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {t("settings.discard")}
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || !settingsDirty}
              className="rounded-md bg-primary px-5 py-2 font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? t("common.saving") : t("common.save")}
            </button>
          </div>
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

function ClickChoice({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  return (
    <label className="block text-xs text-muted-foreground">
      {t("settings.clickTypeLabel")}
      <select
        className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-foreground"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {(["single_click", "double_click", "long_click"] as const).map((type) => (
          <option key={type} value={type}>
            {t(`common.clickType.${type}`)}
          </option>
        ))}
      </select>
    </label>
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

function TableSaveButton({ dirty, disabled, onClick }: { dirty: boolean; disabled?: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        type="button"
        disabled={disabled || !dirty}
        onClick={onClick}
        className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
          dirty ? "bg-primary text-primary-foreground" : "border border-border"
        }`}
      >
        {t("common.save")}
      </button>
      {dirty ? <span className="text-xs font-semibold text-accent">{t("settings.unsavedChanges")}</span> : null}
    </div>
  );
}

function SoundPicker({
  draft,
  set,
}: {
  draft: AppSettings;
  set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}) {
  const { t } = useI18n();
  const [uploading, setUploading] = useState(false);
  const cfg = (id: string) => ({ soundId: id, volume: draft.sound_volume, customPath: draft.custom_sound_url });
  const ids = SOUND_IDS.filter((id) => id !== "custom" || draft.custom_sound_url);

  async function upload(file: File) {
    if (!/\.mp3$/i.test(file.name) || file.size > 1024 * 1024) {
      toast.error(t("settings.soundUploadInvalid"));
      return;
    }
    setUploading(true);
    const path = `custom-${Date.now()}.mp3`;
    const { error } = await supabase.storage
      .from("alert-sounds")
      .upload(path, file, { contentType: "audio/mpeg", upsert: true });
    setUploading(false);
    if (error) {
      toast.error(t("errors.saveFailed"));
      return;
    }
    set("custom_sound_url", path);
    set("sound_id", "custom");
    toast.success(t("settings.soundUploaded"));
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-sm font-semibold">{t("settings.soundChoice")}</p>
      <div className="space-y-2">
        {ids.map((id) => (
          <div key={id} className="flex items-center gap-3">
            <label className="flex flex-1 items-center gap-2 text-sm">
              <input type="radio" name="sound_id" checked={draft.sound_id === id} onChange={() => set("sound_id", id)} />
              {t(`settings.soundNames.${id}`)}
            </label>
            <button
              type="button"
              onClick={() => void playSound(cfg(id))}
              className="rounded-md border border-border px-3 py-1 text-sm font-medium"
            >
              ▶ {t("settings.soundListen")}
            </button>
          </div>
        ))}
      </div>
      <label className="block text-sm text-muted-foreground">
        {t("settings.soundVolume")}: {draft.sound_volume}%
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          className="mt-1 w-full"
          value={draft.sound_volume}
          onChange={(e) => set("sound_volume", Number(e.target.value))}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm font-medium">
          {uploading ? t("common.saving") : draft.custom_sound_url ? t("settings.soundUploadReplace") : t("settings.soundUpload")}
          <input
            type="file"
            accept="audio/mpeg,.mp3"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void upload(f);
            }}
          />
        </label>
        {draft.custom_sound_url ? (
          <button
            type="button"
            onClick={() => {
              set("custom_sound_url", null);
              if (draft.sound_id === "custom") set("sound_id", "chime");
            }}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-destructive"
          >
            {t("settings.soundUploadRemove")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
