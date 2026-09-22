import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { CallsScreen } from "@/components/CallsScreen";
import { Protected } from "@/components/Protected";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Live waiter calls — Ichiban" },
      {
        name: "description",
        content:
          "Real-time hibachi waiter call board for Ichiban: pending tables, live timers and attended confirmations.",
      },
      { property: "og:title", content: "Live waiter calls — Ichiban" },
      {
        property: "og:description",
        content: "Real-time hibachi waiter call board for Ichiban, built for a large TV and a touch screen.",
      },
    ],
  }),
  component: LivePage,
});

function LivePage() {
  return (
    <AppShell wide>
      <Protected>
        <CallsScreen environment="production" />
      </Protected>
    </AppShell>
  );
}
