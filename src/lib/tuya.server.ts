/**
 * Server-only Tuya Cloud adapter.
 *
 * Only the shared waiter-area bulb ("Server") is controlled from here. Table
 * bulbs (e.g. 701) keep their own Smart Life automation and are never touched.
 *
 * Credentials live in server secrets (TUYA_CLIENT_ID / TUYA_CLIENT_SECRET) and
 * never reach the browser.
 */
import { createHash, createHmac } from "crypto";

const REGION_BASE: Record<string, string> = {
  us: "https://openapi.tuyaus.com",
  eu: "https://openapi.tuyaeu.com",
  cn: "https://openapi.tuyacn.com",
  ind: "https://openapi.tuyain.com",
};

function baseUrl(): string {
  const region = (process.env["TUYA_REGION"] ?? "us").toLowerCase();
  return REGION_BASE[region] ?? REGION_BASE["us"]!;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

let cachedToken: { value: string; expiresAt: number } | null = null;

async function tuyaRequest<T>(
  method: "GET" | "POST",
  path: string,
  body: unknown,
  token: string | null,
): Promise<{ success: boolean; result?: T; msg?: string; code?: number }> {
  const id = process.env["TUYA_CLIENT_ID"];
  const secret = process.env["TUYA_CLIENT_SECRET"];
  if (!id || !secret) throw new Error("tuya_credentials_missing");

  const t = Date.now().toString();
  const bodyStr = body ? JSON.stringify(body) : "";
  const stringToSign = `${method}\n${sha256(bodyStr)}\n\n${path}`;
  const sign = createHmac("sha256", secret)
    .update(id + (token ?? "") + t + stringToSign)
    .digest("hex")
    .toUpperCase();

  const res = await fetch(baseUrl() + path, {
    method,
    headers: {
      client_id: id,
      sign,
      t,
      sign_method: "HMAC-SHA256",
      "Content-Type": "application/json",
      ...(token ? { access_token: token } : {}),
    },
    ...(body ? { body: bodyStr } : {}),
  });
  return (await res.json()) as { success: boolean; result?: T; msg?: string; code?: number };
}

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const res = await tuyaRequest<{ access_token: string; expire_time: number }>(
    "GET",
    "/v1.0/token?grant_type=1",
    null,
    null,
  );
  if (!res.success || !res.result) throw new Error(`tuya_token_failed: ${res.msg ?? "unknown"}`);
  cachedToken = {
    value: res.result.access_token,
    expiresAt: Date.now() + res.result.expire_time * 1000,
  };
  return cachedToken.value;
}

export interface TuyaDeviceInfo {
  id: string;
  name: string;
  online: boolean;
  category: string;
  product_name?: string;
}

/** Reads the device so we can confirm it is linked to the Tuya project before sending commands. */
export async function getDevice(deviceId: string): Promise<TuyaDeviceInfo | null> {
  const token = await getToken();
  const res = await tuyaRequest<TuyaDeviceInfo>("GET", `/v1.0/devices/${deviceId}`, null, token);
  return res.success && res.result ? res.result : null;
}

export async function getDeviceFunctionCodes(deviceId: string): Promise<string[]> {
  const token = await getToken();
  const res = await tuyaRequest<{ functions: { code: string }[] }>(
    "GET",
    `/v1.0/devices/${deviceId}/functions`,
    null,
    token,
  );
  return res.success && res.result ? res.result.functions.map((f) => f.code) : [];
}

async function sendCommands(deviceId: string, commands: { code: string; value: unknown }[]) {
  const token = await getToken();
  const res = await tuyaRequest<boolean>("POST", `/v1.0/devices/${deviceId}/commands`, { commands }, token);
  if (!res.success) throw new Error(`tuya_command_failed: ${res.msg ?? "unknown"}`);
}

/** Colour codes differ per product; pick the ones this bulb actually exposes. */
function pickCodes(available: string[]) {
  const has = (c: string) => available.includes(c);
  return {
    workMode: has("work_mode") ? "work_mode" : null,
    colour: has("colour_data_v2") ? "colour_data_v2" : has("colour_data") ? "colour_data" : null,
    bright: has("bright_value_v2") ? "bright_value_v2" : has("bright_value") ? "bright_value" : null,
    switchLed: has("switch_led") ? "switch_led" : null,
  };
}

export type SharedLightState = "red" | "white";

/**
 * Puts the shared waiter-area bulb in red or white. Never turns it off.
 */
export async function setSharedLight(deviceId: string, state: SharedLightState): Promise<void> {
  const codes = pickCodes(await getDeviceFunctionCodes(deviceId));
  const commands: { code: string; value: unknown }[] = [];
  if (codes.switchLed) commands.push({ code: codes.switchLed, value: true });

  if (state === "red") {
    if (codes.workMode) commands.push({ code: codes.workMode, value: "colour" });
    if (codes.colour) {
      commands.push({
        code: codes.colour,
        value: { h: 0, s: 1000, v: 1000 },
      });
    }
  } else {
    if (codes.workMode) commands.push({ code: codes.workMode, value: "white" });
    if (codes.bright) commands.push({ code: codes.bright, value: 1000 });
  }

  if (commands.length === 0) throw new Error("tuya_no_supported_light_codes");
  await sendCommands(deviceId, commands);
}
