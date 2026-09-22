import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { en, type Dictionary } from "./en";
import { es } from "./es";

export type Language = "en" | "es";

/** English is the default for every visitor, signed in or not. */
export const DEFAULT_LANGUAGE: Language = "en";
export const LANGUAGES: Language[] = ["en", "es"];
const STORAGE_KEY = "ichiban.language";

const dictionaries: Record<Language, Dictionary> = { en, es };

type Path = string;

function resolve(dict: Dictionary, path: Path): string {
  const value = path
    .split(".")
    .reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], dict);
  return typeof value === "string" ? value : path;
}

export type Translate = (key: Path, vars?: Record<string, string | number>) => string;

interface I18nValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translate;
  locale: string;
}

const I18nContext = createContext<I18nValue | null>(null);

function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "es";
}

export function readStoredLanguage(): Language | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isLanguage(stored) ? stored : null;
}

export function storeLanguage(lang: Language) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, lang);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Always start from English so server and client render the same markup.
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    const stored = readStoredLanguage();
    if (stored && stored !== language) setLanguageState(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    storeLanguage(lang);
  }, []);

  const t = useCallback<Translate>(
    (key, vars) => {
      let text = resolve(dictionaries[language], key);
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
        }
      }
      return text;
    },
    [language],
  );

  const value = useMemo<I18nValue>(
    () => ({ language, setLanguage, t, locale: language === "es" ? "es-MX" : "en-US" }),
    [language, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

export function useT(): Translate {
  return useI18n().t;
}
