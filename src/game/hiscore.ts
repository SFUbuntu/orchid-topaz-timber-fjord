import type { ShipId } from "./story";

export type HiEntry = { name: string; score: number; ship: ShipId; stage: number };

const TABLE_KEY = "vectorfang-hi-table-v1";

const SEED: HiEntry[] = [
  { name: "VAL", score: 88000, ship: "iron", stage: 6 },
  { name: "NYX", score: 72000, ship: "azure", stage: 5 },
  { name: "KAI", score: 61000, ship: "crimson", stage: 4 },
  { name: "BOB", score: 50000, ship: "azure", stage: 3 },
  { name: "REX", score: 41000, ship: "iron", stage: 3 },
  { name: "JUN", score: 33000, ship: "crimson", stage: 2 },
  { name: "IDA", score: 25000, ship: "azure", stage: 2 },
  { name: "TOM", score: 18000, ship: "iron", stage: 1 },
  { name: "LEO", score: 12000, ship: "azure", stage: 1 },
  { name: "REN", score: 8000, ship: "crimson", stage: 0 },
];

export function loadTable(): HiEntry[] {
  try {
    const raw = localStorage.getItem(TABLE_KEY);
    if (!raw) return [...SEED];
    const parsed = JSON.parse(raw) as HiEntry[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [...SEED];
    return parsed
      .filter((e) => e && typeof e.score === "number" && typeof e.name === "string")
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  } catch {
    return [...SEED];
  }
}

export function qualifies(score: number, table = loadTable()) {
  return score > 0 && (table.length < 10 || score > table[table.length - 1].score);
}

export function insertScore(entry: HiEntry): HiEntry[] {
  const table = [...loadTable(), entry].sort((a, b) => b.score - a.score).slice(0, 10);
  localStorage.setItem(TABLE_KEY, JSON.stringify(table));
  return table;
}

export function continueCost(used: number) {
  return 20000 * 2 ** Math.min(used, 6);
}

export const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
