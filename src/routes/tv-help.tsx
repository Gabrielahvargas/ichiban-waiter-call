import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useI18n } from "@/i18n";
import { getTvHelp } from "@/lib/tv-help.functions";

export const Route = createFileRoute("/tv-help")({
  head: () => ({
    meta: [
      { title: "TV remote help — Ichiban Waiter Calls" },
      { name: "description", content: "AI-generated step-by-step checks for TV remote navigation problems on the call screen." },
      { property: "og:title", content: "TV remote help — Ichiban Waiter Calls" },
      { property: "og:description", content: "AI-generated step-by-step checks for TV remote navigation problems on the call screen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TvHelpPage,
});

function TvHelpPage() {
  const { t, language } = useI18n();
  const run = useServerFn(getTvHelp);
  const [tvModel, setTvModel] = useState("TCL 32Q21K (32\" Q21K, 2025, 720p, Google TV)");
  const [browser, setBrowser] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (tvModel.trim().length < 2 || problem.trim().length < 3) {
      setError(t("tvHelp.required"));
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await run({ data: { tvModel, browser, problem, language: language === "es" ? "es" : "en" } });
      if (r.ok) setResult(r.text);
      else setError(t("tvHelp.error"));
    } catch {
      setError(t("tvHelp.error"));
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-md border border-border bg-background px-3 py-2";
  return (
    <AppShell>
      <Protected adminOnly>
        <div className="mx-auto max-w-3xl space-y-6 p-4">
          <div>
            <h1 className="font-display text-3xl font-bold uppercase tracking-wide">{t("tvHelp.title")}</h1>
            <p className="mt-1 text-muted-foreground">{t("tvHelp.intro")}</p>
          </div>
          <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-4">
            <label className="block space-y-1">
              <span className="text-sm font-semibold">{t("tvHelp.tvModel")}</span>
              <input className={field} value={tvModel} maxLength={200} placeholder={t("tvHelp.tvModelPh")} onChange={(e) => setTvModel(e.target.value)} />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">{t("tvHelp.browser")}</span>
              <input className={field} value={browser} maxLength={200} placeholder={t("tvHelp.browserPh")} onChange={(e) => setBrowser(e.target.value)} />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">{t("tvHelp.problem")}</span>
              <textarea className={`${field} min-h-32`} value={problem} maxLength={2000} placeholder={t("tvHelp.problemPh")} onChange={(e) => setProblem(e.target.value)} />
            </label>
            {error && <p className="text-destructive">{error}</p>}
            <button type="submit" disabled={busy} className="rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? t("tvHelp.working") : t("tvHelp.submit")}
            </button>
          </form>
          {result && (
            <section className="space-y-2 rounded-xl border border-border bg-card p-4">
              <h2 className="font-display text-xl font-bold uppercase">{t("tvHelp.result")}</h2>
              <div className="whitespace-pre-wrap leading-relaxed">{result}</div>
              <p className="text-xs text-muted-foreground">{t("tvHelp.note")}</p>
            </section>
          )}
        </div>
      </Protected>
    </AppShell>
  );
}
