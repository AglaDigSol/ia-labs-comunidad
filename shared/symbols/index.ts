import { SYMBOL_PACKS } from "../../content/symbols/index.ts";
import type { SymbolEntry } from "./types.ts";

export const ALL_SYMBOLS: SymbolEntry[] = SYMBOL_PACKS.flatMap((p) => p.entries);

const BY_ID = new Map(ALL_SYMBOLS.map((s) => [s.id, s]));

export function symbolById(id: string): SymbolEntry | undefined {
  return BY_ID.get(id);
}
