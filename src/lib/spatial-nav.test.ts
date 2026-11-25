import { describe, expect, it } from "vitest";
import { pickNext } from "./spatial-nav";

const rect = (x: number, y: number) => ({ left: x, top: y, right: x + 10, bottom: y + 10, width: 10, height: 10 }) as DOMRect;
const el = (n: string) => ({ id: n }) as unknown as HTMLElement;
const a = el("a"), b = el("b"), c = el("c");
const grid = [{ el: a, r: rect(20, 0) }, { el: b, r: rect(0, 20) }, { el: c, r: rect(20, 20) }];

describe("pickNext", () => {
  it("moves right to the neighbour on the same row", () => expect(pickNext(rect(0, 0), grid, "ArrowRight")).toBe(a));
  it("moves down to the element below", () => expect(pickNext(rect(0, 0), grid, "ArrowDown")).toBe(b));
  it("returns null at the edge", () => expect(pickNext(rect(0, 0), grid, "ArrowUp")).toBeNull());
});
