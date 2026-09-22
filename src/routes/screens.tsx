import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useI18n } from "@/i18n";
import {
  createScreen,
  deleteScreen,
  regeneratePairingCode,
  screenIsOnline,
  unpairScreen,
  updateScreen,
  useScreens,
} from "@/modules/screens/api";
import { TABLE_NUMBERS, type AppEnvironment, type DisplayScreen } from "@/modules/shared/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/screens")({
  head: () => ({
    meta: [
      { title: "Display screens — Ichiban Waiter Calls" },
      { name: "description", content: "Pair and manage the TV and touch displays that show waiter calls." },
      { property: "og:title", content: "Display screens — Ichiban Waiter Calls" },
      {
        property: "og:description",
        content: "Pair and manage the TV and touch displays that show waiter calls.",
      },
    ],
  }),
  component: ScreensPage,
});

function ScreensPage() {
  const { t, locale } = useI18n();
  const { screens, reload } = useScreens();
  const [name, setName] = useState("");
  const [tables, setTables] = useState<number[] | null>(null);
  const [environment, setEnvironment] = useState<AppEnvironment>("production");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createScreen(name.trim(), tables, environment);
      setName("");
      setTables(null);
      await reload();
    } catch {
      toast.error(t("errors.saveFailed"));
    }
    setBusy(false);
  }

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" }) : "—";

  return (
    <AppShell>
      <Protected adminOnly>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">{t("screens.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("screens.subtitle")}</p>
        <p className="text-sm text-muted-foreground">
          {t("screens.howTo")}{" "}
          <a href="/screen" target="_blank" rel="noreferrer" className="underline">
            /screen
          </a>
        </p>

        <section className="mt-6 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 font-display text-xl font-semibold uppercase tracking-wide">{t("screens.add")}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("screens.namePlaceholder")}
              className="min-w-[240px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as AppEnvironment)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="production">{t("history.production")}</option>
              <option value="demo">{t("history.demoEnv")}</option>
            </select>
            <button
              type="button"
              disabled={busy}
              onClick={() => void add()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              {t("screens.create")}
            </button>
          </div>
          <TablePicker value={tables} onChange={setTables} />
        </section>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {screens.length === 0 && <p className="text-muted-foreground">{t("screens.empty")}</p>}
          {screens.map((screen) => (
            <ScreenCard key={screen.id} screen={screen} onChanged={reload} fmt={fmt} />
          ))}
        </div>
      </Protected>
    </AppShell>
  );
}

function TablePicker({
  value,
  onChange,
}: {
  value: number[] | null;
  onChange: (next: number[] | null) => void;
}) {
  const { t } = useI18n();
  const all = value === null;
  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            "rounded-full border border-border px-3 py-1.5 text-sm",
            all && "bg-primary text-primary-foreground",
          )}
        >
          {t("screens.allTables")}
        </button>
        <button
          type="button"
          onClick={() => onChange(value ?? [])}
          className={cn(
            "rounded-full border border-border px-3 py-1.5 text-sm",
            !all && "bg-primary text-primary-foreground",
          )}
        >
          {t("screens.subsetTables")}
        </button>
      </div>
      {!all && (
        <div className="mt-2 flex flex-wrap gap-2">
          {TABLE_NUMBERS.map((num) => {
            const on = (value ?? []).includes(num);
            return (
              <button
                key={num}
                type="button"
                onClick={() =>
                  onChange(on ? (value ?? []).filter((n) => n !== num) : [...(value ?? []), num].sort((a, b) => a - b))
                }
                className={cn(
                  "rounded-md border border-border px-3 py-1.5 font-display text-base font-bold tabular",
                  on ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {num}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ScreenCard({
  screen,
  onChanged,
  fmt,
}: {
  screen: DisplayScreen;
  onChanged: () => Promise<void> | void;
  fmt: (iso: string | null) => string;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(screen.name);
  const [tables, setTables] = useState<number[] | null>(screen.table_numbers);
  const online = screenIsOnline(screen);
  const codeValid =
    screen.pairing_code && screen.pairing_code_expires_at
      ? new Date(screen.pairing_code_expires_at).getTime() > Date.now()
      : false;

  async function save() {
    try {
      await updateScreen(screen.id, { name, table_numbers: tables });
      toast.success(t("common.saved"));
      await onChanged();
    } catch {
      toast.error(t("errors.saveFailed"));
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 font-display text-lg font-semibold"
        />
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            online ? "bg-secondary text-status-ok" : "bg-destructive text-destructive-foreground",
          )}
        >
          {online ? t("screens.online") : t("screens.offline")}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-muted-foreground">{t("screens.pairedAt")}</dt>
          <dd className="tabular">{screen.paired_at ? fmt(screen.paired_at) : t("screens.waitingPairing")}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("screens.lastSeen")}</dt>
          <dd className="tabular">{fmt(screen.last_seen_at)}</dd>
        </div>
      </dl>

      {screen.pairing_code && (
        <div className="mt-3 rounded-lg border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">{t("screens.pairingCode")}</p>
          <p className="font-display text-4xl font-bold tracking-[0.3em]">{screen.pairing_code}</p>
          <p className="text-xs text-muted-foreground">
            {codeValid
              ? t("screens.codeExpires", { when: fmt(screen.pairing_code_expires_at) })
              : t("screens.codeExpired")}
          </p>
        </div>
      )}

      <TablePicker value={tables} onChange={setTables} />

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save()}
          className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
        >
          {t("screens.save")}
        </button>
        <button
          type="button"
          onClick={() =>
            void regeneratePairingCode(screen.id)
              .then(onChanged)
              .catch(() => toast.error(t("errors.saveFailed")))
          }
          className="rounded-md border border-border px-3 py-2 text-sm"
        >
          {t("screens.regenerate")}
        </button>
        <button
          type="button"
          onClick={() =>
            void unpairScreen(screen.id)
              .then(onChanged)
              .catch(() => toast.error(t("errors.saveFailed")))
          }
          className="rounded-md border border-border px-3 py-2 text-sm"
        >
          {t("screens.unpair")}
        </button>
        <button
          type="button"
          onClick={() =>
            void deleteScreen(screen.id)
              .then(onChanged)
              .catch(() => toast.error(t("errors.saveFailed")))
          }
          className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground"
        >
          {t("screens.remove")}
        </button>
      </div>
    </section>
  );
}
