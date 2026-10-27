// Textos que explican una identidad evaluada en elementos concretos (para la corrección y la solución).
import {
  AXIOM_IDENTITIES,
  evalIdentity,
  IDENTITIES,
  type AxiomId,
  type FiniteStructure,
  type IdentityId,
  type Violation,
} from "../../../../shared/boole/algebra.ts";

/** Los dos lados de cada identidad, con a, b, c, 0 y 1 como marcadores. */
const SIDES: Record<IdentityId, [string, string]> = {
  "B1+": ["a ⊕ b", "b ⊕ a"],
  "B1·": ["a ⊙ b", "b ⊙ a"],
  "B2+": ["a ⊕ (b ⊕ c)", "(a ⊕ b) ⊕ c"],
  "B2·": ["a ⊙ (b ⊙ c)", "(a ⊙ b) ⊙ c"],
  "B3≠": ["0", "1"],
  "B3+": ["a ⊕ 0", "a"],
  "B3·": ["1 ⊙ a", "a"],
  "B4·+": ["a ⊙ (b ⊕ c)", "(a ⊙ b) ⊕ (a ⊙ c)"],
  "B4+·": ["a ⊕ (b ⊙ c)", "(a ⊕ b) ⊙ (a ⊕ c)"],
  "B5+": ["a ⊕ a′", "1"],
  "B5·": ["a ⊙ a′", "0"],
};

/** Sustituye a, b, c, 0 y 1 por las etiquetas, en una sola pasada (las etiquetas no se vuelven a leer). */
function subst(s: FiniteStructure, template: string, a: number, b: number, c: number): string {
  const L = (i: number) => s.elements[i]!;
  return template.replace(/[abc01]/g, (m) =>
    m === "a" ? L(a) : m === "b" ? L(b) : m === "c" ? L(c) : m === "0" ? L(s.zero) : L(s.one),
  );
}

/** Elementos usados: «a = 2» o «a = 2, b = 3, c = 5». */
export function tupleText(s: FiniteStructure, arity: number, a: number, b: number, c: number): string {
  const L = (i: number) => s.elements[i]!;
  return [`a = ${L(a)}`, `b = ${L(b)}`, `c = ${L(c)}`].slice(0, arity).join(", ");
}

/** «2 ⊕ 2′ = 6, pero debería dar 12» o «a ⊙ b = x, pero b ⊙ a = y». */
export function violationText(s: FiniteStructure, v: Violation): string {
  const L = (i: number) => s.elements[i]!;
  if (v.identity === "B3≠") return `0 y 1 son el mismo elemento (${L(s.zero)}).`;
  const [lt, rt] = SIDES[v.identity];
  let lhs = subst(s, lt, v.a, v.b, v.c);
  // a′ se sustituye también por su valor: «2 ⊕ 2′ = 2 ⊕ 6».
  if (lt.includes("a′")) lhs += ` = ${subst(s, lt.replace("a′", "#"), v.a, v.b, v.c).replace("#", L(s.comp[v.a]!))}`;
  const rhs = subst(s, rt, v.a, v.b, v.c);
  const single = /^[a01]$/.test(rt);
  return single
    ? `${lhs} = ${L(v.lhs)}, pero debería dar ${rhs} (${IDENTITIES[v.identity].text}).`
    : `${lhs} = ${L(v.lhs)}, pero ${rhs} = ${L(v.rhs)}.`;
}

/** Valores de cada identidad del axioma en (a, b, c), para mostrar por qué se cumple ahí. */
export function holdsText(s: FiniteStructure, axiom: AxiomId, a: number, b: number, c: number): string {
  const L = (i: number) => s.elements[i]!;
  return AXIOM_IDENTITIES[axiom]
    .filter((id) => id !== "B3≠")
    .map((id) => {
      const { lhs } = evalIdentity(s, id, a, b, c);
      const [lt, rt] = SIDES[id];
      return `${subst(s, lt, a, b, c)} = ${L(lhs)} = ${subst(s, rt, a, b, c)}`;
    })
    .join("; ");
}
