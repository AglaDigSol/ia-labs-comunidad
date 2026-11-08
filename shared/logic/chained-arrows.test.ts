// → y ↔ encadenados siempre con paréntesis: «p → q → ¬r» se lee p → (q → ¬r) con la convención del
// analizador, pero escrito así es ambiguo (el revisor: logica-tabla medio s=7, simulacro semilla 12).
// Se recorren los ejercicios de lógica y predicados y las preguntas del simulacro que salen de ellos.
import { describe, expect, it } from "vitest";
import { examItem, examLevels, EXAM_ADAPTERS } from "../exam/items.ts";
import { exercisesOfTopic } from "../exercises/registry.ts";
import { seedFromText } from "../exercises/random.ts";
import { parsePredicate } from "../predicates/parser.ts";
import { predToPlain, predToTex } from "../predicates/ast.ts";
import { toPlain, toTex } from "./ast.ts";
import { parseFormula } from "./parser.ts";

const ARROW = /^(→|↔|\\to(?![a-zA-Z])|\\leftrightarrow|\\rightarrow|\\Leftrightarrow)/;

/** ¿Hay dos → o ↔ al mismo nivel de paréntesis (sin una coma o dos puntos entre ellos)? */
function chainedArrow(s: string): boolean {
  const counts = [0];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (ch === "(" || ch === "{" || ch === "[") counts.push(0);
    else if (ch === ")" || ch === "}" || ch === "]") {
      if (counts.length > 1) counts.pop();
    } else if (ch === "," || ch === ";" || ch === ":") counts[counts.length - 1] = 0;
    else {
      const m = ARROW.exec(s.slice(i));
      if (m) {
        counts[counts.length - 1]!++;
        if (counts[counts.length - 1]! > 1) return true;
        i += m[0].length - 1;
      }
    }
  }
  return false;
}

const strings = (x: unknown, out: string[] = []): string[] => {
  if (typeof x === "string") out.push(x);
  else if (Array.isArray(x)) for (const y of x) strings(y, out);
  else if (x && typeof x === "object") for (const y of Object.values(x)) strings(y, out);
  return out;
};

const SEEDS = [...Array.from({ length: 60 }, (_, i) => i), seedFromText("7")!, seedFromText("12")!, 12];

describe("→ y ↔ encadenados", () => {
  it("se escriben con paréntesis, en texto y en TeX, y se vuelven a leer igual", () => {
    for (const src of ["p → q → ¬r", "p → (q → p) → ¬r", "¬r ↔ q ↔ (r ∨ p)", "q → p → ¬q"]) {
      const r = parseFormula(src);
      if (!r.ok) throw new Error(src);
      expect(chainedArrow(toPlain(r.ast)), toPlain(r.ast)).toBe(false);
      expect(chainedArrow(toTex(r.ast)), toTex(r.ast)).toBe(false);
      const again = parseFormula(toPlain(r.ast));
      expect(again.ok && toPlain(again.ast)).toBe(toPlain(r.ast));
    }
    const r = parseFormula("p → q → r");
    expect(r.ok && toTex(r.ast)).toBe("p \\to (q \\to r)");
    const p = parsePredicate("P(x) → Q(x) → R(x)");
    if (!p.ok) throw new Error("predicado");
    expect(predToPlain(p.formula)).toBe("P(x) → (Q(x) → R(x))");
    expect(chainedArrow(predToTex(p.formula))).toBe(false);
    expect(chainedArrow("p → q → r")).toBe(true);
    expect(chainedArrow("(p → q) → r")).toBe(false);
  });

  it("en los ejercicios de lógica y de predicados", () => {
    for (const topic of ["logica", "predicados"] as const) {
      for (const type of exercisesOfTopic(topic)) {
        for (const level of type.levels) {
          for (const s of SEEDS) {
            for (const text of strings(type.generate(s, level))) expect(chainedArrow(text), `${type.id} ${level} ${s}: ${text}`).toBe(false);
          }
        }
      }
    }
  });

  it("en las preguntas del simulacro de lógica y predicados", () => {
    for (const a of EXAM_ADAPTERS.filter((x) => x.type.topic === "logica" || x.type.topic === "predicados")) {
      for (const level of examLevels(a.type.id)) {
        for (const s of SEEDS) {
          const item = examItem(a.type.id, s, level);
          if (!item) continue;
          const { stem, prompt } = item;
          const options = item.kind === "choice" ? item.options : [];
          for (const text of strings({ stem, prompt, options })) expect(chainedArrow(text), `${a.type.id} ${level} ${s}: ${text}`).toBe(false);
        }
      }
    }
  });
});
