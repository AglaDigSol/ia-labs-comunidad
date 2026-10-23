import { CATEGORY_LABELS, type SymbolCategory, type SymbolEntry } from "./types.ts";

export function normalizeEs(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

interface Index {
  name: string;
  aliases: string[];
  text: string;
  raw: string[];
}

const MAX_QUERY = 100;
const cache = new WeakMap<SymbolEntry, Index>();

function indexOf(e: SymbolEntry): Index {
  let ix = cache.get(e);
  if (!ix) {
    const aliases = e.aliases.map(normalizeEs);
    ix = {
      name: normalizeEs(e.name),
      aliases,
      text: [
        normalizeEs(e.name),
        ...aliases,
        normalizeEs(e.reading),
        ...(e.altReadings ?? []).map(normalizeEs),
        normalizeEs(CATEGORY_LABELS[e.category]),
        ...e.code.map((c) => normalizeEs(c.code)),
      ].join("\n"),
      raw: [
        e.tex,
        ...e.variants.flatMap((v) => [v.tex, v.text].filter((x): x is string => !!x)),
        ...e.aliases,
      ],
    };
    cache.set(e, ix);
  }
  return ix;
}

function wordBoundary(hay: string, tok: string): boolean {
  let i = hay.indexOf(tok);
  while (i !== -1) {
    if (i === 0 || /[^a-z0-9]/.test(hay[i - 1] ?? "")) return true;
    i = hay.indexOf(tok, i + 1);
  }
  return false;
}

function tokenScore(ix: Index, rawTok: string, tok: string): number {
  let best = 0;
  if (tok) {
    if (ix.name === tok || ix.aliases.includes(tok)) best = 100;
    else if (ix.name.startsWith(tok)) best = 60;
    else if (ix.aliases.some((a) => a.startsWith(tok))) best = 50;
    else if (wordBoundary(ix.text, tok)) best = 30;
    else if (ix.text.includes(tok)) best = 10;
  }
  if (ix.raw.includes(rawTok)) best = Math.max(best, 100);
  else if (ix.raw.some((r) => r.includes(rawTok))) best = Math.max(best, 10);
  return best;
}

export function searchSymbols(
  entries: SymbolEntry[],
  query: string,
  category?: SymbolCategory | null,
): SymbolEntry[] {
  const pool = category ? entries.filter((e) => e.category === category) : entries;
  const q = query.slice(0, MAX_QUERY).trim();
  if (!q) return pool;
  const rawToks = q.split(/\s+/);
  const whole = normalizeEs(q);
  const scored: Array<{ e: SymbolEntry; score: number }> = [];
  for (const e of pool) {
    const ix = indexOf(e);
    let total = 0;
    let ok = true;
    for (const rt of rawToks) {
      const s = tokenScore(ix, rt, normalizeEs(rt));
      if (s === 0) {
        ok = false;
        break;
      }
      total += s;
    }
    if (!ok) continue;
    if (rawToks.length > 1) {
      if (ix.name === whole || ix.aliases.includes(whole) || ix.raw.includes(q)) total += 1000;
    }
    scored.push({ e, score: total });
  }
  scored.sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name, "es"));
  return scored.map((s) => s.e);
}
