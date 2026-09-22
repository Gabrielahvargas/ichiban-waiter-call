import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useI18n } from "@/i18n";
import { useSession } from "@/modules/auth/useSession";

/**
 * UI-level gate. Data access is enforced server-side by row level security, so
 * this only decides what the screen shows.
 */
export function Protected({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { t } = useI18n();
  const { user, isAdmin, ready } = useSession();

  if (!ready) {
    return <p className="p-8 text-center text-muted-foreground">{t("common.loading")}</p>;
  }

  if (!user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <p className="font-display text-3xl font-bold uppercase tracking-wide">{t("live.signInRequired")}</p>
        <Link to="/auth" className="rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground">
          {t("nav.signIn")}
        </Link>
      </div>
    );
  }

  if (adminOnly && !isAdmin) {
    return <p className="p-8 text-center text-muted-foreground">{t("errors.notAdmin")}</p>;
  }

  return <>{children}</>;
}
