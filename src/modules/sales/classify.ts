/** Pure sales classification + ranking helpers, shared by the dashboard and tests. */
export type SalesCategory = "alcohol" | "sushi" | "ignore" | "other";

export interface CategoryRule {
  id?: string;
  match_type: "keyword" | "tabit_category";
  pattern: string;
  target: "alcohol" | "sushi" | "ignore";
  priority: number;
}

export interface SaleRow {
  product_name: string;
  tabit_category: string | null;
  waiter_external_id: string | null;
  waiter_name: string | null;
  quantity: number;
  amount: number;
}

const DEFAULT_KEYWORDS: Record<"alcohol" | "sushi", string[]> = {
  alcohol: ["sake", "beer", "cerveza", "wine", "vino", "cocktail", "coctel", "margarita", "whisky", "vodka", "tequila", "soju", "mojito", "sapporo", "asahi", "kirin", "liquor", "alcohol"],
  sushi: ["sushi", "roll", "nigiri", "sashimi", "maki", "temaki", "uramaki", "hand roll"],
};

const norm = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/** Order: user rules (lowest priority number first) → Tabit category → default keywords on product name. */
export function classifySale(sale: Pick<SaleRow, "product_name" | "tabit_category">, rules: CategoryRule[]): SalesCategory {
  const product = norm(sale.product_name);
  const category = norm(sale.tabit_category);
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  for (const rule of sorted) {
    const p = norm(rule.pattern);
    if (!p) continue;
    if (rule.match_type === "tabit_category" ? category === p : product.includes(p) || category.includes(p)) {
      return rule.target;
    }
  }
  for (const key of ["alcohol", "sushi"] as const) {
    if (DEFAULT_KEYWORDS[key].some((k) => category.includes(k))) return key;
  }
  for (const key of ["alcohol", "sushi"] as const) {
    if (DEFAULT_KEYWORDS[key].some((k) => product.includes(k))) return key;
  }
  return "other";
}

export interface WaiterTotals {
  key: string;
  name: string;
  alcoholUnits: number;
  alcoholAmount: number;
  sushiUnits: number;
  sushiAmount: number;
}

export function aggregateByWaiter(sales: SaleRow[], rules: CategoryRule[], unassignedLabel = "—"): WaiterTotals[] {
  const map = new Map<string, WaiterTotals>();
  for (const s of sales) {
    const cat = classifySale(s, rules);
    if (cat !== "alcohol" && cat !== "sushi") continue;
    const key = s.waiter_external_id ?? s.waiter_name ?? "none";
    const row = map.get(key) ?? { key, name: s.waiter_name ?? unassignedLabel, alcoholUnits: 0, alcoholAmount: 0, sushiUnits: 0, sushiAmount: 0 };
    if (cat === "alcohol") {
      row.alcoholUnits += Number(s.quantity);
      row.alcoholAmount += Number(s.amount);
    } else {
      row.sushiUnits += Number(s.quantity);
      row.sushiAmount += Number(s.amount);
    }
    map.set(key, row);
  }
  return [...map.values()];
}

export function leader(rows: WaiterTotals[], field: keyof Omit<WaiterTotals, "key" | "name">): WaiterTotals | null {
  let best: WaiterTotals | null = null;
  for (const r of rows) if (r[field] > 0 && (!best || r[field] > best[field])) best = r;
  return best;
}

/** Retry backoff for failed syncs: 5, 10, 20 min, capped at the 30-min schedule. */
export function retryDelayMinutes(failures: number): number {
  return Math.min(30, 5 * 2 ** Math.max(0, failures - 1));
}
