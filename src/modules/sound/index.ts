import { supabase } from "@/integrations/supabase/client";

export const SOUND_IDS = ["chime", "double", "soft_alarm", "loud_alarm", "kitchen", "custom"] as const;
export type SoundId = (typeof SOUND_IDS)[number];

export interface SoundConfig {
  soundId: string;
  volume: number; // 0-100
  customPath: string | null;
}

type Note = { f: number; start: number; dur: number; type?: OscillatorType };

const PATTERNS: Record<Exclude<SoundId, "custom">, Note[]> = {
  chime: [{ f: 880, start: 0, dur: 0.8 }],
  double: [
    { f: 988, start: 0, dur: 0.35 },
    { f: 784, start: 0.4, dur: 0.6 },
  ],
  soft_alarm: [
    { f: 660, start: 0, dur: 0.25, type: "triangle" },
    { f: 660, start: 0.35, dur: 0.25, type: "triangle" },
    { f: 660, start: 0.7, dur: 0.25, type: "triangle" },
  ],
  loud_alarm: [
    { f: 1200, start: 0, dur: 0.2, type: "square" },
    { f: 900, start: 0.2, dur: 0.2, type: "square" },
    { f: 1200, start: 0.4, dur: 0.2, type: "square" },
    { f: 900, start: 0.6, dur: 0.2, type: "square" },
  ],
  kitchen: [
    { f: 2093, start: 0, dur: 1.2 },
    { f: 2637, start: 0, dur: 1.2 },
  ],
};

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!ctx) ctx = new Ctx();
  return ctx;
}

/** True when the browser is blocking audio until the user touches the page. */
export function audioBlocked(): boolean {
  const c = getCtx();
  return !!c && c.state === "suspended";
}

export async function unlockAudio(): Promise<void> {
  const c = getCtx();
  if (c && c.state === "suspended") await c.resume().catch(() => undefined);
}

const customCache = new Map<string, string>();
async function customUrl(path: string): Promise<string | null> {
  const cached = customCache.get(path);
  if (cached) return cached;
  const { data, error } = await supabase.storage.from("alert-sounds").download(path);
  if (error || !data) return null;
  const url = URL.createObjectURL(data);
  customCache.set(path, url);
  return url;
}

export async function playSound(cfg: SoundConfig): Promise<void> {
  const vol = Math.max(0, Math.min(100, cfg.volume)) / 100;
  if (vol === 0) return;
  try {
    if (cfg.soundId === "custom" && cfg.customPath) {
      const url = await customUrl(cfg.customPath);
      if (url) {
        const audio = new Audio(url);
        audio.volume = vol;
        await audio.play();
        return;
      }
    }
    const c = getCtx();
    if (!c) return;
    if (c.state === "suspended") await c.resume().catch(() => undefined);
    const pattern = PATTERNS[(cfg.soundId as keyof typeof PATTERNS)] ?? PATTERNS.chime;
    const t0 = c.currentTime + 0.02;
    for (const n of pattern) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = n.type ?? "sine";
      osc.frequency.setValueAtTime(n.f, t0 + n.start);
      gain.gain.setValueAtTime(0.0001, t0 + n.start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.95 * vol), t0 + n.start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.start + n.dur);
      osc.connect(gain).connect(c.destination);
      osc.start(t0 + n.start);
      osc.stop(t0 + n.start + n.dur + 0.05);
    }
  } catch {
    /* audio is best-effort */
  }
}
