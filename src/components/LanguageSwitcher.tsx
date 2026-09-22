import { useI18n, type Language } from "@/i18n";
import { cn } from "@/lib/utils";

const LABELS: Record<Language, string> = { en: "EN", es: "ES" };

export function LanguageSwitcher({
  className,
  size = "default",
  onChange,
}: {
  className?: string;
  size?: "default" | "large";
  onChange?: (lang: Language) => void;
}) {
  const { language, setLanguage, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("common.language")}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-secondary p-1",
        className,
      )}
    >
      {(Object.keys(LABELS) as Language[]).map((lang) => (
        <button
          key={lang}
          type="button"
          aria-pressed={language === lang}
          onClick={() => {
            setLanguage(lang);
            onChange?.(lang);
          }}
          className={cn(
            "rounded-full font-semibold transition-colors",
            size === "large" ? "px-5 py-2 text-base" : "px-3 py-1 text-sm",
            language === lang
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {LABELS[lang]}
        </button>
      ))}
    </div>
  );
}
