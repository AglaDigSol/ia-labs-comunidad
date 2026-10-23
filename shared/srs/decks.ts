// Seed flashcard decks generated from the symbol dictionary (D-05: reuse, not new content).
// Built once at module load and never written to the store: only their schedule (srs/<cardId>)
// and suspension (susp/<cardId>) are saved.
import { ALL_SYMBOLS } from "../symbols/index.ts";
import type { SymbolEntry } from "../symbols/types.ts";

/** Course id (see content/courses/). Seed decks belong to 01MIAR and 02MIAR. */
export type Course = string;

export type SeedDeck = {
  id: string;
  name: string;
  course: Course;
  session: number | null;
  source: "dictionary";
};

export type SeedCard = { id: string; front: string; back: string; mono?: boolean };

export const SEED_DECKS: SeedDeck[] = [
  { id: "sym-02-s1", name: "Sesión 1 · Símbolos", course: "02MIAR", session: 1, source: "dictionary" },
  { id: "sym-02-s2", name: "Sesión 2 · Símbolos", course: "02MIAR", session: 2, source: "dictionary" },
  { id: "sym-02-gen", name: "General · Símbolos", course: "02MIAR", session: null, source: "dictionary" },
  { id: "sym-01-py", name: "Símbolos en Python", course: "01MIAR", session: null, source: "dictionary" },
];

/** Card text uses the user-card convention ($…$ is KaTeX), so literal dollars are escaped. */
const escapeDollar = (s: string) => s.replace(/\$/g, "\\$");

const DECK_OF_SESSION: Record<SymbolEntry["session"], string> = {
  1: "sym-02-s1",
  2: "sym-02-s2",
  posterior: "sym-02-gen",
};

function build(): Map<string, readonly SeedCard[]> {
  const out = new Map<string, SeedCard[]>(SEED_DECKS.map((d) => [d.id, []]));
  for (const s of ALL_SYMBOLS) {
    // 02MIAR: symbol ↔ lectura.
    out.get(DECK_OF_SESSION[s.session])!.push({
      id: `sym-${s.id}`,
      front: `$${s.tex}$`,
      back: escapeDollar(s.reading),
    });
    // 01MIAR: symbol ↔ its Python equivalents, one item per line with the library prefix.
    if (s.code.length > 0) {
      out.get("sym-01-py")!.push({
        id: `symp-${s.id}`,
        front: `$${s.tex}$`,
        back: escapeDollar(s.code.map((c) => `${c.lib}: ${c.code}`).join("\n")),
        mono: true,
      });
    }
  }
  for (const list of out.values()) for (const c of list) Object.freeze(c);
  return out;
}

const CARDS = build();

/** Seed cards of a deck, in dictionary order (a fresh array of frozen cards); [] for a non-seed deck. */
export function seedCards(deckId: string): SeedCard[] {
  return [...(CARDS.get(deckId) ?? [])];
}
