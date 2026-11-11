// Pistas que dependen del enunciado: cada pista dice de qué operadores o funciones habla (`needs`) y
// solo se enseña si la instancia los tiene. Así una pista de √u no sale en un cociente, ni la regla
// de ↔ en una fórmula sin ↔. Los tests barren semillas y niveles y comprueban que ninguna pista nombra
// algo que no está en el enunciado.
import type { Node } from "../logic/ast.ts";

export type TaggedHint = { text: string; needs?: readonly string[] };

/** Las pistas cuyos requisitos están todos en el enunciado, en su orden. */
export function pickHints(hints: readonly TaggedHint[], present: Iterable<string>): string[] {
  const has = new Set(present);
  return hints.filter((h) => (h.needs ?? []).every((t) => has.has(t))).map((h) => h.text);
}

// ---------------------------------------------------------------- Lógica proposicional

type Connective = Exclude<Node["kind"], "var" | "const">;

/** Conectivas que aparecen en la fórmula. */
export function connectivesOf(n: Node): Set<Connective> {
  const out = new Set<Connective>();
  const walk = (x: Node) => {
    if (x.kind === "var" || x.kind === "const") return;
    out.add(x.kind);
    if (x.kind === "not") walk(x.arg);
    else {
      walk(x.left);
      walk(x.right);
    }
  };
  walk(n);
  return out;
}

const RULES: Array<{ k: Connective; text: string }> = [
  { k: "imp", text: "p → q solo es falsa cuando p es verdadera y q es falsa" },
  { k: "iff", text: "p ↔ q es verdadera cuando ambas coinciden" },
  { k: "xor", text: "p ⊻ q, cuando difieren" },
];
const BASIC: Array<{ k: Connective; text: string }> = [
  { k: "and", text: "p ∧ q solo es verdadera cuando las dos lo son" },
  { k: "or", text: "p ∨ q solo es falsa cuando las dos son falsas" },
];

/**
 * «Recuerda: …» con la regla de las conectivas de la fórmula: →, ↔ y ⊻ si las hay; si no, ∧ y ∨. Null
 * si no hay ninguna binaria.
 */
export function connectiveRulesHint(n: Node): string | null {
  const ks = connectivesOf(n);
  let rules = RULES.filter((r) => ks.has(r.k)).map((r) => r.text);
  if (rules.length === 0) rules = BASIC.filter((r) => ks.has(r.k)).map((r) => r.text);
  if (rules.length === 0) return null;
  // «p ⊻ q, cuando difieren» solo se entiende detrás de la de ↔.
  const xorAlone = ks.has("xor") && !ks.has("iff");
  const text = rules.map((r) => (xorAlone && r.startsWith("p ⊻") ? "p ⊻ q es verdadera cuando difieren" : r));
  return `Recuerda: ${text.join("; ")}.`;
}
