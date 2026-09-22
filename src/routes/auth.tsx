import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Ichiban Waiter Calls" },
      { name: "description", content: "Sign in to the Ichiban hibachi waiter call system." },
      { property: "og:title", content: "Sign in — Ichiban Waiter Calls" },
      { property: "og:description", content: "Sign in to the Ichiban hibachi waiter call system." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "in") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        void navigate({ to: "/", replace: true });
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName },
          },
        });
        if (err) throw err;
        if (data.session) void navigate({ to: "/", replace: true });
        else setMessage(t("auth.checkEmail"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide">
            {mode === "in" ? t("auth.title") : t("auth.signUpTitle")}
          </h1>
          <LanguageSwitcher />
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "up" && (
            <Field label={t("auth.displayName")}>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </Field>
          )}
          <Field label={t("auth.email")}>
            <input
              type="email"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label={t("auth.password")}>
            <input
              type="password"
              required
              minLength={6}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {message && <p className="text-sm text-status-ok">{message}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? t("common.loading") : mode === "in" ? t("auth.signIn") : t("auth.signUp")}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
          className="mt-4 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {mode === "in" ? t("auth.toSignUp") : t("auth.toSignIn")}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
