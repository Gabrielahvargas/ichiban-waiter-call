import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { readStoredLanguage, useI18n, type Language } from "@/i18n";
import { useSession } from "@/modules/auth/useSession";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", key: "nav.live" },
  { to: "/demo", key: "nav.demo" },
  { to: "/history", key: "nav.history" },
  { to: "/stats", key: "nav.stats" },
  { to: "/settings", key: "nav.settings" },
  { to: "/admins", key: "nav.admins" },
  { to: "/integration", key: "nav.integration" },
] as const;

/** Applies the signed-in user's saved language and keeps it in sync. */
export function useLanguagePreference() {
  const { language, setLanguage } = useI18n();
  const { user, profile } = useSession();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current || !profile) return;
    applied.current = true;
    const local = readStoredLanguage();
    if (!local && (profile.language === "en" || profile.language === "es")) {
      setLanguage(profile.language);
    }
  }, [profile, setLanguage]);

  const persist = (lang: Language) => {
    if (!user) return;
    void supabase.from("profiles").update({ language: lang }).eq("id", user.id);
  };

  return { language, persist };
}

export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  const { persist } = useLanguagePreference();
  const { user } = useSession();
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/" className="mr-2 font-display text-2xl font-bold uppercase tracking-wide">
            Ichiban
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeProps={{ className: "bg-accent text-foreground" }}
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <LanguageSwitcher onChange={persist} />
            {user ? (
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("nav.signOut")}
              </button>
            ) : (
              <Link
                to="/auth"
                className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
              >
                {t("nav.signIn")}
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className={cn("mx-auto px-4 py-6", wide ? "max-w-none" : "max-w-[1600px]")}>{children}</main>
    </div>
  );
}
