import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { AppSettings } from "@/modules/shared/types";

export const FALLBACK_SETTINGS: AppSettings = {
  id: "global",
  output_mode: "both",
  new_call_rule: "immediate",
  sound_alerts: "every_call",
  wait_threshold_seconds: 300,
  attended_card_seconds: 10,
  local_red_seconds: 3,
  shared_light_color: "#ffd9a0",
  shared_light_alert_color: "#ff0000",
  log_retention_days: 90,
  gateway_external_id: null,
  integration_status: "pending",
  updated_at: new Date(0).toISOString(),
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(FALLBACK_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase.from("app_settings").select("*").eq("id", "global").maybeSingle();
      if (cancelled || !data) return;
      setSettings(data as AppSettings);
      setLoaded(true);
    }

    void load();
    const channel = supabase
      .channel("app-settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, () => void load())
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  return { settings, loaded, setSettings };
}
