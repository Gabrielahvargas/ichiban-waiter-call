export type AppEnvironment = "production" | "demo";
export type CallStatus = "pending" | "attended";

export interface Call {
  id: string;
  table_number: number;
  environment: AppEnvironment;
  status: CallStatus;
  called_at: string;
  attended_at: string | null;
  duration_seconds: number | null;
  attended_by: string | null;
  cooldown_until: string | null;
}

export interface DiningTable {
  id: string;
  table_number: number;
  alert_bulb_code: string;
  button_device_external_id: string | null;
  gateway_external_id: string | null;
}

export interface Bulb {
  id: string;
  table_number: number;
  bulb_code: string;
  external_id: string | null;
}

export type OutputMode = "tv" | "touch" | "both";
export type NewCallRule = "immediate" | "after_10s" | "after_30s";
export type SoundAlerts = "every_call" | "threshold_only" | "none";

export interface AppSettings {
  id: string;
  output_mode: OutputMode;
  new_call_rule: NewCallRule;
  sound_alerts: SoundAlerts;
  wait_threshold_seconds: number;
  attended_card_seconds: number;
  local_red_seconds: number;
  shared_light_color: string;
  shared_light_alert_color: string;
  log_retention_days: number;
  gateway_external_id: string | null;
  integration_status: string;
  updated_at: string;
}

export interface LightingCommand {
  id: string;
  target: string;
  bulb_code: string | null;
  action: string;
  color: string | null;
  duration_ms: number | null;
  environment: AppEnvironment;
  dispatch_status: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  language: string;
}

export const TABLE_NUMBERS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

export function bulbCodesForTable(tableNumber: number): string[] {
  const base = tableNumber / 100;
  return [`${base}01`, `${base}02`];
}
