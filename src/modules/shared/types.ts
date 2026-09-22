export type AppEnvironment = "production" | "demo";
export type CallStatus = "pending" | "attended";
export type Shift = "lunch" | "dinner";

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
  /** Waiter on duty for this table when the call started (snapshot). */
  assigned_waiter_id?: string | null;
  assigned_waiter_name?: string | null;
  service_date?: string | null;
  shift?: Shift | null;
}

export interface Waiter {
  id: string;
  full_name: string;
  code: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WaiterAssignment {
  id: string;
  waiter_id: string;
  table_number: number;
  service_date: string;
  shift: Shift;
  effective_from: string;
  effective_to: string | null;
  created_by: string | null;
}

export interface DisplayScreen {
  id: string;
  name: string;
  environment: AppEnvironment;
  /** null means "all ten tables". */
  table_numbers: number[] | null;
  pairing_code: string | null;
  pairing_code_expires_at: string | null;
  paired_at: string | null;
  last_seen_at: string | null;
  created_at: string;
}

export interface ScreenState {
  ok: boolean;
  server_time: string;
  screen: { id: string; name: string; tables: number[] | null; environment: AppEnvironment };
  settings: {
    attended_card_seconds: number;
    sound_alerts: SoundAlerts;
    wait_threshold_seconds: number;
  };
  calls: Call[];
}

export interface DiningTable {
  id: string;
  table_number: number;
  alert_bulb_code: string;
  button_device_external_id: string | null;
  gateway_external_id: string | null;
  /** Physical switch (1-4) on this table's Zigbee remote that calls a waiter. */
  call_button: number;
  /** Physical switch (1-4) that marks the call as attended. */
  attend_button: number;
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
  timezone: string;
  dinner_start_hour: number;
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
