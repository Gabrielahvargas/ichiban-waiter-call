import { useEffect, useState } from "react";

import { useI18n } from "@/i18n";
import { audioBlocked, unlockAudio } from "@/modules/sound";

/** Browsers block audio until the first touch/key; show a hint until unlocked. */
export function SoundUnlockBanner({ enabled }: { enabled: boolean }) {
  const { t } = useI18n();
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setBlocked(audioBlocked());
    const unlock = () => void unlockAudio().then(() => setBlocked(audioBlocked()));
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [enabled]);

  if (!enabled || !blocked) return null;
  return (
    <button
      type="button"
      onClick={() => void unlockAudio().then(() => setBlocked(audioBlocked()))}
      className="rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground"
    >
      {t("settings.soundTapToEnable")}
    </button>
  );
}
