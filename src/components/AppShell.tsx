import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  MonitorPlay,
  Gamepad2,
  Users,
  MonitorSmartphone,
  History,
  BarChart3,
  Settings,
  ShieldCheck,
  PlugZap,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { readStoredLanguage, useI18n, type Language } from "@/i18n";
import { useSession } from "@/modules/auth/useSession";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", key: "nav.live", icon: MonitorPlay },
  { to: "/demo", key: "nav.demo", icon: Gamepad2 },
  { to: "/waiters", key: "nav.waiters", icon: Users },
  { to: "/screens", key: "nav.screens", icon: MonitorSmartphone },
  { to: "/history", key: "nav.history", icon: History },
  { to: "/stats", key: "nav.stats", icon: BarChart3 },
  { to: "/settings", key: "nav.settings", icon: Settings },
  { to: "/admins", key: "nav.admins", icon: ShieldCheck },
  { to: "/integration", key: "nav.integration", icon: PlugZap },
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

function AppSidebar() {
  const { t } = useI18n();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (router) => router.location.pathname });

  const isActive = (path: string) =>
    path === "/" ? currentPath === "/" : currentPath.startsWith(path);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-4">
        <Link
          to="/"
          className="font-display text-2xl font-bold uppercase tracking-wide"
        >
          {collapsed ? "I" : "Ichiban"}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup defaultOpen>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={isActive(item.to)}>
                    <Link
                      to={item.to}
                      className="flex items-center gap-2 hover:bg-muted/50"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{t(item.key)}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
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
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur">
            <SidebarTrigger />
            <div className="ml-auto flex items-center gap-3">
              <LanguageSwitcher onChange={persist} />
              {user ? (
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("nav.signOut")}
                </button>
              ) : (
                <Link
                  to="/auth"
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
                >
                  {t("nav.signIn")}
                </Link>
              )}
            </div>
          </header>
          <main className={cn("flex-1 px-4 py-6", wide ? "" : "mx-auto w-full max-w-[1600px]")}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
