import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CallGrid } from "@/components/CallGrid";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SoundUnlockBanner } from "@/components/SoundUnlockBanner";
import { playSound } from "@/modules/sound";
import { useI18n } from "@/i18n";
import { callRpc } from "@/modules/shared/rpc";
import {
  claimPairingCode,
  readDeviceSession,
  storeDeviceSession,
  useScreenState,
  type DeviceSession,
} from "@/modules/screens/api";
import { defaultShift, todayIso } from "@/modules/waiters/api";
import { TABLE_NUMBERS, type Call, type ScreenOrientation, type Shift } from "@/modules/shared/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/screen")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Call display — Ichiban Waiter Calls" },
      { name: "description", content: "Standalone waiter call display for TVs, tablets and touch computers." },
      { property: "og:title", content: "Call display — Ichiban Waiter Calls" },
      {
        property: "og:description",
        content: "Standalone waiter call display for TVs, tablets and touch computers.",
      },
    ],
  }),
  component: ScreenPage,
});

/** Remote keys: standard browser keys plus Tizen (10009) and webOS (461) back. */
function isBack(e: KeyboardEvent) {
  return e.key === "Escape" || e.key === "Backspace" || e.keyCode === 10009 || e.keyCode === 461;
}
function isOk(e: KeyboardEvent) {
  return e.key === "Enter" || e.key === " ";
}

/**
 * Normalises remote keys: standard KeyboardEvent.key, DOM keyCodes (37-40, 13)
 * and raw Android KeyEvent codes some TV wrappers forward
 * (DPAD_UP 19, DOWN 20, LEFT 21, RIGHT 22, CENTER 23, ENTER 66).
 */
const REMOTE_CODES: Record<number, string> = {
  19: "ArrowUp", 20: "ArrowDown", 21: "ArrowLeft", 22: "ArrowRight", 23: "Enter", 66: "Enter",
  37: "ArrowLeft", 38: "ArrowUp", 39: "ArrowRight", 40: "ArrowDown", 13: "Enter",
};
function remoteKey(e: KeyboardEvent): string {
  const std = e.key;
  if (std && std !== "Unidentified" && (std.startsWith("Arrow") || std === "Enter" || std.length === 1)) return std;
  const code = e.keyCode || e.which;
  return REMOTE_CODES[code] ?? std ?? "";
}

/** Only with ?debugRemote=1: shows the last keydown so we can tell if the TV app forwards keys. */
function RemoteDebug() {
  const [on, setOn] = useState(false);
  const [info, setInfo] = useState<{ n: number; key: string; code: string; keyCode: number; which: number } | null>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("debugRemote") !== "1") return;
    setOn(true);
    let n = 0;
    const onKey = (e: KeyboardEvent) => {
      n += 1;
      setInfo({ n, key: e.key, code: e.code, keyCode: e.keyCode, which: e.which });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  if (!on) return null;
  return (
    <div className="pointer-events-none fixed bottom-2 left-2 z-[100] rounded-md border border-border bg-card/90 px-3 py-1 font-mono text-xs text-muted-foreground">
      {info
        ? `keydown #${info.n} key=${info.key} code=${info.code} keyCode=${info.keyCode} which=${info.which}`
        : "debugRemote: no key event received yet"}
    </div>
  );
}


function ScreenPage() {
  const [session, setSession] = useState<DeviceSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSession(readDeviceSession());
    setHydrated(true);
  }, []);

  if (!hydrated) return null;
  if (!session) {
    return (
      <PairingView
        onPaired={(s) => {
          storeDeviceSession(s);
          setSession(s);
        }}
      />
    );
  }
  return (
    <DisplayView
      session={session}
      onUnpaired={() => {
        storeDeviceSession(null);
        setSession(null);
      }}
    />
  );
}

/* ------------------------------------------------------------- pairing */

/** Same alphabet the server uses in generate_pairing_code (no I, O, 0, 1). */
const PAIR_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PAIR_LEN = 6;
const PAIR_COLS = 8;
const PAIR_KEYS = [...PAIR_ALPHABET.split(""), "⌫", "PAIR"];

function PairingView({ onPaired }: { onPaired: (s: DeviceSession) => void }) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const keyRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const submit = useCallback(async () => {
    if (busy || code.trim().length < 4) return;
    setBusy(true);
    setError(null);
    try {
      const result = await claimPairingCode(code);
      if ("error" in result) setError(t("screen.invalidCode"));
      else onPaired(result);
    } catch {
      setError(t("screen.invalidCode"));
    }
    setBusy(false);
  }, [busy, code, onPaired, t]);

  const press = useCallback(
    (key: string) => {
      setError(null);
      if (key === "⌫") setCode((c) => c.slice(0, -1));
      else if (key === "PAIR") void submit();
      else setCode((c) => (c.length < PAIR_LEN ? c + key : c));
    },
    [submit],
  );

  // Keep the real DOM focus on the highlighted key so the TV WebView never
  // moves focus to something else on its own.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) keyRefs.current[focus]?.focus({ preventScroll: true });
  }, [focus]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const key = remoteKey(e);
      const isArrow = key.startsWith("Arrow");
      const inInput = document.activeElement === inputRef.current;
      // Typing in the real input (physical keyboard / touch keyboard): let it work natively.
      if (inInput && !isArrow) return;
      if (isArrow) {
        e.preventDefault();
        if (inInput) inputRef.current?.blur();
        const last = PAIR_KEYS.length - 1;
        setFocus((f) => {
          if (inInput) return f;
          if (key === "ArrowRight") return Math.min(last, f + 1);
          if (key === "ArrowLeft") return Math.max(0, f - 1);
          if (key === "ArrowDown") return Math.min(last, f + PAIR_COLS);
          return Math.max(0, f - PAIR_COLS);
        });
        return;
      }
      if (key === "Enter") {
        e.preventDefault();
        if (e.repeat) return;
        press(PAIR_KEYS[focus] ?? "");
        return;
      }
      if (isBack(e)) {
        e.preventDefault();
        press("⌫");
        return;
      }
      const ch = key.length === 1 ? key.toUpperCase() : "";
      if (ch && PAIR_ALPHABET.includes(ch)) {
        e.preventDefault();
        press(ch);
      }
    }
    // Capture phase so a focused button / WebView default can't swallow it first.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [focus, press]);

  return (
    <div className="relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 py-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <h1 className="font-display text-4xl font-bold uppercase tracking-wide">{t("screen.pairTitle")}</h1>
      <p className="mt-1 max-w-xl text-center text-sm text-muted-foreground">{t("screen.pairHint")}</p>
      <input
        ref={inputRef}
        value={code}
        onChange={(e) =>
          setCode(
            e.target.value
              .toUpperCase()
              .split("")
              .filter((c) => PAIR_ALPHABET.includes(c))
              .join("")
              .slice(0, PAIR_LEN),
          )
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
        maxLength={PAIR_LEN}
        aria-label={t("screen.codeLabel")}
        className="mt-4 w-full max-w-sm rounded-xl border border-border bg-card px-4 py-2 text-center font-display text-5xl font-bold uppercase tracking-[0.4em]"
      />
      <p className="mt-1 h-6 text-destructive">{error ?? ""}</p>
      <div className="mt-1 grid grid-cols-8 gap-2" role="group" aria-label={t("screen.codeLabel")}>
        {PAIR_KEYS.map((key, i) => {
          const wide = key === "⌫" || key === "PAIR";
          return (
            <button
              key={key}
              ref={(el) => {
                keyRefs.current[i] = el;
              }}
              type="button"
              tabIndex={focus === i ? 0 : -1}
              disabled={busy && key === "PAIR"}
              onClick={() => {
                setFocus(i);
                press(key);
              }}
              className={cn(
                "h-14 min-w-16 rounded-xl border-2 border-border bg-card px-3 font-display text-3xl font-bold outline-none transition",
                wide && "col-span-4",
                key === "PAIR" && "bg-primary text-primary-foreground",
                focus === i && "scale-105 border-call-timer ring-4 ring-call-timer",
              )}
            >
              {key === "PAIR" ? (busy ? t("screen.pairing") : t("screen.pair")) : key}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- display */

type Mode = "display" | "pin" | "menu" | "assign";

function DisplayView({ session, onUnpaired }: { session: DeviceSession; onUnpaired: () => void }) {
  const { t } = useI18n();
  const { state, connection, serverNow } = useScreenState(session);
  const [mode, setMode] = useState<Mode>("display");
  const [pinSession, setPinSession] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 500);
    return () => clearInterval(id);
  }, [serverNow]);

  useEffect(() => {
    if (connection === "unpaired") onUnpaired();
  }, [connection, onUnpaired]);

  const attendedWindow = state?.settings.attended_card_seconds ?? 10;
  const soundMode = state?.settings.sound_alerts ?? "none";

  const visible: Call[] = useMemo(() => {
    const calls = state?.calls ?? [];
    return calls
      .filter((c) => {
        if (c.status === "pending") return true;
        if (!c.attended_at) return false;
        return now - new Date(c.attended_at).getTime() < attendedWindow * 1000;
      })
      .sort((a, b) => new Date(a.called_at).getTime() - new Date(b.called_at).getTime());
  }, [state, now, attendedWindow]);

  const seen = useRef<Set<string>>(new Set());
  const alerted = useRef<Set<string>>(new Set());
  const threshold = state?.settings.wait_threshold_seconds ?? 300;
  const soundCfg = {
    soundId: state?.settings.sound_id ?? "chime",
    volume: state?.settings.sound_volume ?? 80,
    customPath: state?.settings.custom_sound_url ?? null,
  };
  useEffect(() => {
    for (const call of state?.calls ?? []) {
      if (call.status !== "pending") continue;
      if (!seen.current.has(call.id)) {
        seen.current.add(call.id);
        if (soundMode === "every_call") void playSound(soundCfg);
      }
      if (soundMode === "threshold_only" && !alerted.current.has(call.id)) {
        if ((now - new Date(call.called_at).getTime()) / 1000 >= threshold) {
          alerted.current.add(call.id);
          void playSound(soundCfg);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, soundMode, now, threshold]);

  // Remote: OK opens the menu from the call display; timers keep running because
  // elapsed time is derived from the server timestamps, never from local state.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (mode !== "display") return;
      if (isOk(e)) {
        e.preventDefault();
        setMode(pinSession ? "menu" : "pin");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, pinSession]);

  const pendingCount = visible.filter((c) => c.status === "pending").length;

  const [orientationOverride, setOrientationOverride] = useState<ScreenOrientation | null>(null);
  const orientation: ScreenOrientation = orientationOverride ?? state?.screen.orientation ?? "landscape";
  useEffect(() => {
    // Once the server reflects the change, drop the local override.
    if (orientationOverride && state?.screen.orientation === orientationOverride) setOrientationOverride(null);
  }, [state?.screen.orientation, orientationOverride]);
  const [windowLandscape, setWindowLandscape] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape)");
    const update = () => setWindowLandscape(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const portrait = orientation === "portrait";
  const rotate = portrait && windowLandscape;

  async function changeOrientation(next: ScreenOrientation) {
    if (!pinSession) return;
    setOrientationOverride(next);
    try {
      const data = await callRpc<{ ok: boolean; error?: string }>("screen_set_orientation", {
        p_screen_id: session.screenId,
        p_device_token: session.token,
        p_pin_session: pinSession,
        p_orientation: next,
      });
      if (!data?.ok) {
        setOrientationOverride(null);
        if (data?.error === "session_expired") {
          setPinSession(null);
          setMode("pin");
        }
      }
    } catch {
      setOrientationOverride(null);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden bg-background p-3",
        rotate ? "fixed left-0 top-0" : "h-dvh min-h-0",
      )}
      style={
        rotate
          ? { width: "100vh", height: "100vw", transform: "rotate(90deg) translateY(-100%)", transformOrigin: "top left" }
          : undefined
      }
    >
      <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pb-2">
        <span className="font-display text-lg font-semibold uppercase tracking-widest text-muted-foreground">
          {state?.screen.name ?? session.name} · {t("live.pendingCount", { count: pendingCount })}
        </span>
        <div className="flex items-center gap-2">
          <SoundUnlockBanner enabled={soundMode !== "none"} />
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => setMode(pinSession ? "menu" : "pin")}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold"
          >
            {t("screen.menu")}
          </button>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-sm font-semibold",
              connection === "online"
                ? "bg-secondary text-status-ok"
                : connection === "connecting"
                  ? "bg-secondary text-muted-foreground"
                  : "bg-destructive text-destructive-foreground animate-pulse",
            )}
            role="status"
          >
            {connection === "online"
              ? t("live.connected")
              : connection === "connecting"
                ? t("screen.connecting")
                : t("screen.reconnecting")}
          </span>
        </div>
      </header>

      {visible.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-border bg-card p-10 text-center">
          <p className="font-display text-4xl font-bold uppercase tracking-wide text-muted-foreground md:text-6xl">
            {t("live.empty")}
          </p>
          <p className="mt-3 text-base text-muted-foreground">{t("screen.menuHint")}</p>
        </div>
      ) : (
        <CallGrid calls={visible} now={now} portrait={portrait} />
      )}

      {mode === "pin" && (
        <PinOverlay
          session={session}
          onCancel={() => setMode("display")}
          onSuccess={(token) => {
            setPinSession(token);
            setMode("menu");
          }}
        />
      )}
      {mode === "menu" && pinSession && (
        <MenuOverlay
          onClose={() => setMode("display")}
          onAssign={() => setMode("assign")}
          tables={state?.screen.tables ?? null}
          orientation={orientation}
          onToggleOrientation={() => void changeOrientation(orientation === "portrait" ? "landscape" : "portrait")}
        />
      )}
      {mode === "assign" && pinSession && (
        <AssignOverlay
          session={session}
          pinSession={pinSession}
          onClose={() => setMode("display")}
          onExpired={() => {
            setPinSession(null);
            setMode("pin");
          }}
        />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- PIN */

const KEYPAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"];

function PinOverlay({
  session,
  onCancel,
  onSuccess,
}: {
  session: DeviceSession;
  onCancel: () => void;
  onSuccess: (token: string) => void;
}) {
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [focus, setFocus] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (value: string) => {
      if (value.length < 4) return;
      setBusy(true);
      setError(null);
      try {
        const data = await callRpc<{ ok: boolean; error?: string; pin_session?: string; remaining?: number }>(
          "screen_verify_pin",
          { p_screen_id: session.screenId, p_device_token: session.token, p_pin: value },
        );
        if (data.ok && data.pin_session) {
          onSuccess(data.pin_session);
        } else if (data.error === "rate_limited") {
          setError(t("screen.pinRateLimited"));
        } else if (data.error === "not_configured") {
          setError(t("screen.pinNotConfigured"));
        } else {
          setError(t("screen.pinInvalid", { remaining: data.remaining ?? 0 }));
        }
      } catch {
        setError(t("errors.generic"));
      }
      setPin("");
      setBusy(false);
    },
    [session, onSuccess, t],
  );

  const press = useCallback(
    (key: string) => {
      if (key === "⌫") setPin((p) => p.slice(0, -1));
      else if (key === "OK") void submit(pin);
      else setPin((p) => (p.length < 8 ? p + key : p));
    },
    [pin, submit],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isBack(e)) {
        e.preventDefault();
        onCancel();
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        setPin((p) => (p.length < 8 ? p + e.key : p));
        return;
      }
      if (isOk(e)) {
        e.preventDefault();
        const key = KEYPAD[focus];
        if (key) press(key);
        return;
      }
      const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 };
      const delta = moves[e.key];
      if (delta) {
        e.preventDefault();
        setFocus((f) => Math.min(KEYPAD.length - 1, Math.max(0, f + delta)));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, onCancel, press]);

  return (
    <Overlay title={t("screen.pinTitle")} hint={t("screen.pinHint")} onClose={onCancel}>
      <p className="mb-4 font-display text-5xl tracking-[0.4em]">{"•".repeat(pin.length) || "—"}</p>
      {error && <p className="mb-4 max-w-md text-center text-destructive">{error}</p>}
      <div className="grid grid-cols-3 gap-3">
        {KEYPAD.map((key, i) => (
          <button
            key={key}
            type="button"
            disabled={busy}
            onClick={() => {
              setFocus(i);
              press(key);
            }}
            className={cn(
              "rounded-xl border border-border bg-card px-8 py-5 font-display text-3xl font-bold",
              focus === i && "border-primary bg-accent",
            )}
          >
            {key}
          </button>
        ))}
      </div>
    </Overlay>
  );
}

/* ---------------------------------------------------------------- menu */

function MenuOverlay({
  onClose,
  onAssign,
  tables,
  orientation,
  onToggleOrientation,
}: {
  onClose: () => void;
  onAssign: () => void;
  tables: number[] | null;
  orientation: ScreenOrientation;
  onToggleOrientation: () => void;
}) {
  const { t } = useI18n();
  const items = useMemo(
    () => [
      { key: "assign", label: t("screen.assignments"), run: onAssign },
      {
        key: "orientation",
        label: `${t("screens.orientation")}: ${t(orientation === "portrait" ? "screens.portrait" : "screens.landscape")}`,
        run: onToggleOrientation,
      },
      { key: "exit", label: t("screen.exitMenu"), run: onClose },
    ],
    [t, onAssign, onClose, orientation, onToggleOrientation],
  );
  const [focus, setFocus] = useState(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isBack(e)) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") setFocus((f) => Math.min(items.length - 1, f + 1));
      if (e.key === "ArrowUp") setFocus((f) => Math.max(0, f - 1));
      if (isOk(e)) {
        e.preventDefault();
        items[focus]?.run();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, items, onClose]);

  return (
    <Overlay title={t("screen.menu")} hint={t("screen.remoteHint")} onClose={onClose}>
      <div className="flex w-full max-w-md flex-col gap-3">
        {items.map((item, i) => (
          <button
            key={item.key}
            type="button"
            onClick={item.run}
            className={cn(
              "rounded-xl border border-border bg-card px-6 py-5 text-left font-display text-2xl font-bold uppercase",
              focus === i && "border-primary bg-accent",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-muted-foreground">
        <dt>{t("screen.tablesShown")}</dt>
        <dd className="tabular">{tables ? tables.join(", ") : TABLE_NUMBERS.join(", ")}</dd>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">{t("screen.remoteNote")}</p>
    </Overlay>
  );
}

/* ---------------------------------------------------------- assignment */

interface Board {
  ok: boolean;
  error?: string;
  service_date: string;
  shift: Shift;
  waiters: { id: string; full_name: string }[];
  assignments: { table_number: number; waiter_id: string }[];
}

function AssignOverlay({
  session,
  pinSession,
  onClose,
  onExpired,
}: {
  session: DeviceSession;
  pinSession: string;
  onClose: () => void;
  onExpired: () => void;
}) {
  const { t } = useI18n();
  const [serviceDate, setServiceDate] = useState(todayIso());
  const [shift, setShift] = useState<Shift>(defaultShift());
  const [board, setBoard] = useState<Board | null>(null);
  const [selectedWaiter, setSelectedWaiter] = useState<string | null>(null);
  const [column, setColumn] = useState<"waiters" | "tables">("waiters");
  const [focus, setFocus] = useState(0);

  const load = useCallback(async () => {
    const data = await callRpc<Board>("screen_assignment_board", {
      p_screen_id: session.screenId,
      p_pin_session: pinSession,
      p_service_date: serviceDate,
      p_shift: shift,
    });
    if (!data.ok) {
      onExpired();
      return;
    }
    setBoard(data);
  }, [session, pinSession, serviceDate, shift, onExpired]);

  useEffect(() => {
    void load();
  }, [load]);

  const waiters = board?.waiters ?? [];
  const byTable = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of board?.assignments ?? []) map.set(a.table_number, a.waiter_id);
    return map;
  }, [board]);

  const toggleTable = useCallback(
    async (tableNumber: number) => {
      if (!selectedWaiter) return;
      const current = byTable.get(tableNumber) ?? null;
      const next = current === selectedWaiter ? null : selectedWaiter;
      const data = await callRpc<{ ok: boolean }>("screen_set_assignment", {
        p_screen_id: session.screenId,
        p_pin_session: pinSession,
        p_table_number: tableNumber,
        p_service_date: serviceDate,
        p_shift: shift,
        p_waiter_id: next,
      });
      if (!data.ok) onExpired();
      else await load();
    },
    [selectedWaiter, byTable, session, pinSession, serviceDate, shift, onExpired, load],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isBack(e)) {
        e.preventDefault();
        onClose();
        return;
      }
      const list = column === "waiters" ? waiters.length : TABLE_NUMBERS.length;
      if (e.key === "ArrowDown") setFocus((f) => Math.min(list - 1, f + 1));
      if (e.key === "ArrowUp") setFocus((f) => Math.max(0, f - 1));
      if (e.key === "ArrowRight" && column === "waiters") {
        setColumn("tables");
        setFocus(0);
      }
      if (e.key === "ArrowLeft" && column === "tables") {
        setColumn("waiters");
        setFocus(0);
      }
      if (isOk(e)) {
        e.preventDefault();
        if (column === "waiters") {
          const w = waiters[focus];
          if (w) setSelectedWaiter((prev) => (prev === w.id ? null : w.id));
        } else {
          const num = TABLE_NUMBERS[focus];
          if (num !== undefined) void toggleTable(num);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [column, focus, waiters, onClose, toggleTable]);

  const nameOf = (id: string | null) => waiters.find((w) => w.id === id)?.full_name ?? t("waiters.unassigned");

  return (
    <Overlay title={t("screen.assignments")} hint={t("screen.remoteHint")} onClose={onClose}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={serviceDate}
          onChange={(e) => setServiceDate(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2"
        />
        <div className="inline-flex rounded-full border border-border bg-secondary p-1">
          {(["lunch", "dinner"] as Shift[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setShift(s)}
              className={cn(
                "rounded-full px-4 py-1.5 font-semibold",
                shift === s ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {t(`waiters.${s}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid w-full max-w-5xl gap-4 md:grid-cols-[260px_1fr]">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("waiters.selectWaiter")}</p>
          {waiters.map((w, i) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setSelectedWaiter(selectedWaiter === w.id ? null : w.id)}
              className={cn(
                "w-full rounded-lg border border-border bg-card px-4 py-3 text-left text-lg font-semibold",
                selectedWaiter === w.id && "border-primary bg-primary/20",
                column === "waiters" && focus === i && "ring-2 ring-primary",
              )}
            >
              {w.full_name}
            </button>
          ))}
          {waiters.length === 0 && <p className="text-sm text-muted-foreground">{t("waiters.empty")}</p>}
        </div>

        <div>
          <p className="mb-2 text-sm text-muted-foreground">{t("waiters.selectTables")}</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {TABLE_NUMBERS.map((num, i) => {
              const owner = byTable.get(num) ?? null;
              const mine = owner !== null && owner === selectedWaiter;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => void toggleTable(num)}
                  className={cn(
                    "rounded-xl border p-3 text-left",
                    mine ? "border-primary bg-primary/20" : "border-border bg-card",
                    column === "tables" && focus === i && "ring-2 ring-primary",
                  )}
                >
                  <span className="block font-display text-2xl font-bold tabular">{num}</span>
                  <span className="block text-xs text-muted-foreground">
                    {owner ? nameOf(owner) : t("waiters.unassigned")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Overlay>
  );
}

/* ------------------------------------------------------------- overlay */

function Overlay({
  title,
  hint,
  onClose,
  children,
}: {
  title: string;
  hint: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-auto bg-background/95 p-6">
      <h2 className="font-display text-3xl font-bold uppercase tracking-wide md:text-4xl">{title}</h2>
      <p className="mb-6 mt-2 text-sm text-muted-foreground">{hint}</p>
      {children}
      <button
        type="button"
        onClick={onClose}
        className="mt-8 rounded-md border border-border px-5 py-3 font-semibold"
      >
        {t("common.back")}
      </button>
    </div>
  );
}
