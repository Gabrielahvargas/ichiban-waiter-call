import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSharedLightActual: vi.fn(),
  setSharedLight: vi.fn(), findLightsByName: vi.fn(), getDevice: vi.fn(),
  from: vi.fn(), update: vi.fn(), filters: vi.fn(),
}));
vi.mock("./tuya.server", () => mocks);
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
import { syncSharedLight } from "./shared-light.server";

const ids = ["server-one", "server-two"];
let pending = 1;
beforeEach(() => {
  vi.clearAllMocks();
  pending = 1;
  mocks.findLightsByName.mockResolvedValue(ids.map(id => ({ id, name: "SERVER" })));
  mocks.setSharedLight.mockResolvedValue(undefined);
  mocks.from.mockImplementation((table: string) => {
    const chain: Record<string, any> = {};
    chain['select'] = vi.fn(() => chain);
    chain['eq'] = vi.fn((...args) => { mocks.filters(...args); return chain; });
    chain['lte'] = vi.fn((...args) => { mocks.filters(...args); return Promise.resolve({ error: null }); });
    chain['maybeSingle'] = vi.fn(async () => ({ data: { shared_light_device_ids: ids, shared_light_device_name: "SERVER" }, error: null }));
    chain['insert'] = vi.fn(async () => ({ error: null }));
    chain['update'] = vi.fn((data) => { mocks.update(table, data); return chain; });
    chain['then'] = (resolve: (value: unknown) => unknown) => Promise.resolve({ count: pending, error: null }).then(resolve);
    return chain;
  });
});

describe("SERVER dispatch independent from table effects", () => {
  it("sends the same red command to both SERVER bulbs for a pending production call", async () => {
    expect((await syncSharedLight("call_created")).status).toBe("applied");
    expect(mocks.setSharedLight.mock.calls).toEqual([[ids[0], "red"], [ids[1], "red"]]);
    expect(mocks.filters).toHaveBeenCalledWith("environment", "production");
    expect(mocks.update).toHaveBeenCalledWith("lighting_commands", { dispatch_status: "sent" });
    expect(mocks.filters).toHaveBeenCalledWith("created_at", expect.any(String));
  });
  it("restores both SERVER bulbs to white only when no production call remains", async () => {
    pending = 0;
    expect((await syncSharedLight("call_attended")).state).toBe("white");
    expect(mocks.setSharedLight.mock.calls).toEqual([[ids[0], "white"], [ids[1], "white"]]);
  });
  it("attempts the other SERVER after a quota failure and does not mark a partial dispatch sent", async () => {
    mocks.setSharedLight.mockRejectedValueOnce(new Error("tuya_command_failed: 60001001 quota"));
    const result = await syncSharedLight("call_created");
    expect(result.status).toBe("partial");
    expect(result.devices).toEqual([{ id: ids[0], ok: false, error: "tuya_command_failed: 60001001 quota" }, { id: ids[1], ok: true }]);
    expect(mocks.setSharedLight).toHaveBeenCalledTimes(2);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
import { serverLightsAlreadyIn } from "./shared-light.server";
describe("serverLightsAlreadyIn", () => {
  const now = Date.parse("2026-11-25T18:00:00Z");
  const at = (m: number) => new Date(now - m * 60000).toISOString();
  it("needs white when last SERVER command was red (stuck red)", () => {
    const logs = [
      { device_id: "a", result: "shared_light_red", created_at: at(5) },
      { device_id: "b", result: "shared_light_red", created_at: at(5) },
    ];
    expect(serverLightsAlreadyIn("white", ["a", "b"], logs, now, 3600000)).toBe(false);
  });
  it("skips when both bulbs already white", () => {
    const logs = [
      { device_id: "a", result: "shared_light_white", created_at: at(2) },
      { device_id: "b", result: "shared_light_white", created_at: at(2) },
    ];
    expect(serverLightsAlreadyIn("white", ["a", "b"], logs, now, 3600000)).toBe(true);
  });
  it("resends when one bulb failed last time", () => {
    const logs = [
      { device_id: "a", result: "shared_light_white", created_at: at(2) },
      { device_id: "b", result: "light_command_failed", created_at: at(1) },
      { device_id: "b", result: "shared_light_white", created_at: at(3) },
    ];
    expect(serverLightsAlreadyIn("white", ["a", "b"], logs, now, 3600000)).toBe(false);
  });
});
