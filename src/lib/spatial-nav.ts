import { useEffect, type RefObject } from "react";

/**
 * Android TV / D-pad navigation for a container: arrows move real DOM focus to the
 * nearest focusable element in that direction (screen space, so rotated layouts
 * still match what the viewer sees), OK/Enter activates it, Back calls onBack.
 * Arrows are always consumed so the TV browser never turns them into a cursor.
 */
const CODES: Record<number, string> = {
  19: "ArrowUp", 20: "ArrowDown", 21: "ArrowLeft", 22: "ArrowRight", 23: "Enter", 66: "Enter",
  37: "ArrowLeft", 38: "ArrowUp", 39: "ArrowRight", 40: "ArrowDown", 13: "Enter",
};
export function navKey(e: KeyboardEvent): string {
  if (e.key && e.key !== "Unidentified" && (e.key.startsWith("Arrow") || e.key === "Enter")) return e.key;
  return CODES[e.keyCode || e.which] ?? e.key ?? "";
}
export function isBackKey(e: KeyboardEvent): boolean {
  return e.key === "Escape" || e.key === "GoBack" || e.key === "BrowserBack" || e.keyCode === 4 || e.keyCode === 10009 || e.keyCode === 461;
}

const SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(SELECTOR)).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

export function pickNext(from: DOMRect, candidates: { el: HTMLElement; r: DOMRect }[], dir: string): HTMLElement | null {
  const cx = from.left + from.width / 2, cy = from.top + from.height / 2;
  let best: HTMLElement | null = null, bestScore = Infinity;
  for (const { el, r } of candidates) {
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const dx = x - cx, dy = y - cy;
    let main: number, cross: number;
    if (dir === "ArrowRight") { if (r.left < from.right - 4 && dx <= 4) continue; main = dx; cross = Math.abs(dy); }
    else if (dir === "ArrowLeft") { if (r.right > from.left + 4 && dx >= -4) continue; main = -dx; cross = Math.abs(dy); }
    else if (dir === "ArrowDown") { if (r.top < from.bottom - 4 && dy <= 4) continue; main = dy; cross = Math.abs(dx); }
    else { if (r.bottom > from.top + 4 && dy >= -4) continue; main = -dy; cross = Math.abs(dx); }
    if (main <= 0) continue;
    const score = main + cross * 2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  return best;
}

export function useSpatialNav(
  ref: RefObject<HTMLElement | null>,
  opts: { enabled?: boolean; onBack?: () => void; initial?: string } = {},
) {
  const { enabled = true, onBack, initial } = opts;

  useEffect(() => {
    if (!enabled) return;
    const root = ref.current;
    if (!root) return;
    // Visible initial focus.
    const t = setTimeout(() => {
      if (root.contains(document.activeElement)) return;
      const first = (initial ? root.querySelector<HTMLElement>(initial) : null) ?? focusables(root)[0];
      first?.focus({ preventScroll: false });
    }, 50);

    function onKey(e: KeyboardEvent) {
      const r = ref.current;
      if (!r) return;
      if (isBackKey(e)) {
        if (onBack) { e.preventDefault(); e.stopPropagation(); onBack(); }
        return;
      }
      const key = navKey(e);
      if (key.startsWith("Arrow") || key === "Enter") document.documentElement.classList.add("tv-dpad");
      const active = document.activeElement as HTMLElement | null;
      const inside = !!active && r.contains(active);
      if (key.startsWith("Arrow")) {
        e.preventDefault();
        e.stopPropagation();
        const list = focusables(r);
        if (!inside) { list[0]?.focus(); return; }
        const next = pickNext(
          active!.getBoundingClientRect(),
          list.filter((el) => el !== active).map((el) => ({ el, r: el.getBoundingClientRect() })),
          key,
        );
        next?.focus();
        next?.scrollIntoView({ block: "nearest", inline: "nearest" });
        return;
      }
      if (key === "Enter") {
        if (!inside) { e.preventDefault(); focusables(r)[0]?.focus(); return; }
        if (active instanceof HTMLInputElement && active.type !== "button") return;
        e.preventDefault();
        e.stopPropagation();
        active!.click();
      }
    }
    // Swallow the matching keyup/keypress so the TV WebView never acts on arrows itself.
    function onOther(e: KeyboardEvent) {
      const k = navKey(e);
      if (k.startsWith("Arrow") || k === "Enter") { e.preventDefault(); e.stopPropagation(); }
    }
    // Hide the pointer while navigating with the remote; any real mouse move shows it again.
    const showPointer = () => document.documentElement.classList.remove("tv-dpad");
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onOther, true);
    window.addEventListener("keypress", onOther, true);
    window.addEventListener("mousemove", showPointer, true);
    window.addEventListener("touchstart", showPointer, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onOther, true);
      window.removeEventListener("keypress", onOther, true);
      window.removeEventListener("mousemove", showPointer, true);
      window.removeEventListener("touchstart", showPointer, true);
    };
  }, [ref, enabled, onBack, initial]);
}
