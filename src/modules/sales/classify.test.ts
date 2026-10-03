import { describe, expect, it } from "vitest";

import { aggregateByWaiter, classifySale, leader, retryDelayMinutes, type SaleRow } from "./classify";

const sale = (p: Partial<SaleRow>): SaleRow => ({
  product_name: "x", tabit_category: null, waiter_external_id: "w1", waiter_name: "Ana", quantity: 1, amount: 10, ...p,
});

describe("sales classification", () => {
  it("uses Tabit category before product keywords", () => {
    expect(classifySale({ product_name: "House special", tabit_category: "Sushi Bar" }, [])).toBe("sushi");
  });
  it("user rule overrides defaults", () => {
    expect(classifySale({ product_name: "Sake Roll", tabit_category: null }, [
      { match_type: "keyword", pattern: "sake roll", target: "sushi", priority: 1 },
    ])).toBe("sushi");
  });
  it("ignore rule excludes item", () => {
    expect(classifySale({ product_name: "Beer battered shrimp", tabit_category: null }, [
      { match_type: "keyword", pattern: "battered", target: "ignore", priority: 1 },
    ])).toBe("ignore");
  });
  it("leader by units vs amount can differ", () => {
    const rows = aggregateByWaiter([
      sale({ product_name: "Sapporo", quantity: 5, amount: 25 }),
      sale({ waiter_external_id: "w2", waiter_name: "Luis", product_name: "Wine bottle", quantity: 1, amount: 60 }),
    ], []);
    expect(leader(rows, "alcoholUnits")?.name).toBe("Ana");
    expect(leader(rows, "alcoholAmount")?.name).toBe("Luis");
  });
  it("retry backoff 5,10,20 then capped at 30", () => {
    expect([1, 2, 3, 4].map(retryDelayMinutes)).toEqual([5, 10, 20, 30]);
  });
});
