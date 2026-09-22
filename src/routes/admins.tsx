import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/modules/auth/useSession";
import type { Profile } from "@/modules/shared/types";

export const Route = createFileRoute("/admins")({
  head: () => ({
    meta: [
      { title: "Administrators — Ichiban Waiter Calls" },
      { name: "description", content: "Individual accounts for the owner and other administrators." },
      { property: "og:title", content: "Administrators — Ichiban Waiter Calls" },
      { property: "og:description", content: "Individual accounts for the owner and other administrators." },
    ],
  }),
  component: AdminsPage,
});

function AdminsPage() {
  const { t } = useI18n();
  const { user } = useSession();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [adminIds, setAdminIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [{ data: profs }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, email, display_name, language").order("created_at"),
      supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
    ]);
    setProfiles((profs ?? []) as Profile[]);
    setAdminIds((roles ?? []).map((r) => r.user_id));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleAdmin(id: string, makeAdmin: boolean) {
    const { error } = makeAdmin
      ? await supabase.from("user_roles").insert({ user_id: id, role: "admin" })
      : await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "admin");
    if (error) toast.error(t("errors.saveFailed"));
    else {
      toast.success(t("common.saved"));
      void load();
    }
  }

  return (
    <AppShell>
      <Protected adminOnly>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">{t("admins.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admins.subtitle")}</p>

        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t("admins.user")}</th>
                <th className="px-4 py-3">{t("admins.role")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const isAdmin = adminIds.includes(p.id);
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <span className="font-medium">{p.display_name ?? p.email}</span>
                      <span className="block text-xs text-muted-foreground">{p.email}</span>
                      {p.id === user?.id && (
                        <span className="text-xs text-muted-foreground">({t("admins.you")})</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{isAdmin ? t("admins.admin") : t("admins.staff")}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={p.id === user?.id && isAdmin}
                        onClick={() => void toggleAdmin(p.id, !isAdmin)}
                        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-40"
                      >
                        {isAdmin ? t("admins.removeAdmin") : t("admins.makeAdmin")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Protected>
    </AppShell>
  );
}
