import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/modules/shared/types";

export interface SessionState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  ready: boolean;
}

export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setProfile(null);
        setIsAdmin(false);
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    let cancelled = false;

    void (async () => {
      const [{ data: prof }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, email, display_name, language").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      if (cancelled) return;
      if (prof) setProfile(prof as Profile);
      setIsAdmin((roles ?? []).some((r) => r.role === "admin"));
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  return { session, user: session?.user ?? null, profile, isAdmin, ready };
}
