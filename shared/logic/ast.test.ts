// Paréntesis «de libro» en toPlain/toTex y vuelta al analizador de todo lo que se imprime.
import { describe, expect, it } from "vitest";
import { subformulas, toPlain, toTex, type Node } from "./ast.ts";
import { parseFormula } from "./parser.ts";

const ast = (s: string): Node => {
  const r = parseFormula(s);
  if (!r.ok) throw new Error(`${s}: ${r.error.message}`);
  return r.ast;
};
const plain = (s: string) => toPlain(ast(s));

// Lleva la salida de toTex a la notación del analizador (solo variables de una letra o con subíndice).
const texToPlain = (t: string) =>
  t
    .replace(/\\lnot /g, "¬")
    .replace(/\\land/g, "∧")
    .replace(/\\lor/g, "∨")
    .replace(/\\veebar/g, "⊻")
    .replace(/\\to/g, "→")
    .replace(/\\leftrightarrow/g, "↔")
    .replace(/_\{(\d+)\}/g, "$1");

// Ejemplos de la app (lógica y comparar), casos de libro y de precedencia.
const EXAMPLES = [
  "p → q",
  "¬(p ∧ q)",
  "(p → q) ↔ (¬q → ¬p)",
  "(p → q) ↔ (q → p)",
  "¬q → ¬p",
  "q → p",
  "(p ∧ q) → r",
  "(p ∧ q) ∨ r",
  "p ∨ ¬p",
  "¬(p ∧ ¬p)",
  "((p → q) ∧ p) → q",
  "((p → q) ∧ ¬q) → ¬p",
  "((p → q) ∧ (q → r)) → (p → r)",
  "((p ∨ q) ∧ ¬p) → q",
  "p → (p ∨ q)",
  "((p → q) → p) → p",
  "¬p ∨ ¬q",
  "p ∧ (q ∨ r)",
  "(p ∨ q) ∧ ¬(p ∧ q)",
  "p → (q → r)",
  "¬(p ∧ q ∧ r)",
  "¬p ∨ ¬q ∨ ¬r",
  "p ∨ q ∧ r",
  "p ⊻ q ∨ r",
  "p → q → r",
  "(p → q) → r",
  "p ↔ q → r",
  "p ∧ q ∧ r",
  "p ∧ (q ∧ r)",
  "¬¬p",
  "(a ∧ b) ∨ (c ∧ d) ∨ (e ∧ f) ∨ ¬a ∨ ¬b ∨ ¬c",
  "¬(p ∧ q) ∨ x1",
  "1 ∧ 0 → p",
];

// Generador pseudoaleatorio con semilla fija: los mismos árboles en cada ejecución.
function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}
const BIN = ["and", "or", "xor", "imp", "iff"] as const;
function randomNode(rand: () => number, depth: number): Node {
  const r = rand();
  if (depth === 0 || r < 0.2) return { kind: "var", name: ["p", "q", "r", "s"][Math.floor(rand() * 4)]! };
  if (r < 0.35) return { kind: "not", arg: randomNode(rand, depth - 1) };
  const kind = BIN[Math.floor(rand() * BIN.length)]!;
  return { kind, left: randomNode(rand, depth - 1), right: randomNode(rand, depth - 1) };
}

describe("paréntesis de libro", () => {
  it.each([
    ["(p → q) ↔ (q → p)", "(p → q) ↔ (q → p)"],
    ["p → q ↔ q → p", "(p → q) ↔ (q → p)"],
    ["(p ∧ q) ∨ r", "(p ∧ q) ∨ r"],
    ["p ∧ q ∨ r", "(p ∧ q) ∨ r"],
    ["(p ∧ q) → r", "(p ∧ q) → r"],
    ["p ∨ q ∧ r", "p ∨ (q ∧ r)"],
    ["p ↔ q → r", "p ↔ (q → r)"],
    ["(p → q) ↔ (¬q → ¬p)", "(p → q) ↔ (¬q → ¬p)"],
  ])("operadores distintos: %s", (src, out) => {
    expect(plain(src)).toBe(out);
  });

  it("mismo operador: se mantiene la asociatividad", () => {
    expect(plain("p ∧ q ∧ r")).toBe("p ∧ q ∧ r");
    expect(plain("p ∧ (q ∧ r)")).toBe("p ∧ (q ∧ r)");
    expect(plain("p ∨ q ∨ r")).toBe("p ∨ q ∨ r");
    expect(plain("p → q → r")).toBe("p → q → r");
    expect(plain("(p → q) → r")).toBe("(p → q) → r");
    expect(plain("p ↔ q ↔ r")).toBe("p ↔ q ↔ r");
  });

  it("¬ no cambia", () => {
    expect(plain("¬p ∧ q")).toBe("¬p ∧ q");
    expect(plain("¬(p ∧ q)")).toBe("¬(p ∧ q)");
    expect(plain("¬¬p")).toBe("¬¬p");
    expect(plain("¬p → ¬(q ∨ r)")).toBe("¬p → ¬(q ∨ r)");
  });

  it("toTex sigue la misma regla", () => {
    expect(toTex(ast("p → q ↔ q → p"))).toBe("(p \\to q) \\leftrightarrow (q \\to p)");
    expect(toTex(ast("p ∧ q ∨ r"))).toBe("(p \\land q) \\lor r");
    expect(toTex(ast("¬(p ∧ q) ∨ x1"))).toBe("\\lnot (p \\land q) \\lor x_{1}");
  });

  it("las subfórmulas de (p → q) ↔ (q → p), de dentro hacia fuera", () => {
    expect(subformulas(ast("(p → q) ↔ (q → p)")).map(toPlain)).toEqual([
      "p → q",
      "q → p",
      "(p → q) ↔ (q → p)",
    ]);
  });
});

describe("vuelta al analizador", () => {
  it.each(EXAMPLES)("%s", (src) => {
    const node = ast(src);
    const out = toPlain(node);
    expect(ast(out)).toEqual(node);
    expect(toPlain(ast(out))).toBe(out);
    expect(ast(texToPlain(toTex(node)))).toEqual(node);
    for (const sub of subformulas(node)) expect(ast(toPlain(sub))).toEqual(sub);
  });

  it("300 árboles al azar (semilla fija)", () => {
    const rand = lcg(2026);
    for (let i = 0; i < 300; i++) {
      const node = randomNode(rand, 4);
      const out = toPlain(node);
      expect(ast(out), out).toEqual(node);
      expect(ast(texToPlain(toTex(node))), out).toEqual(node);
    }
  });
});
