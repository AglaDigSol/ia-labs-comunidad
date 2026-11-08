// Coeficiente 1 y −1: se escribe x y −x, nunca 1x ni −1x (el revisor: calculo-derivada medio
// s=vlcrag, (1x − 2)⁴; avanzado, cos⁵(1x)). En TeX y en texto, en los enunciados y en las derivadas.
import { describe, expect, it } from "vitest";
import { derivative, derivativeTidy } from "../calculus/derive.ts";
import { parseExpr } from "../calculus/parser.ts";
import { toPlain, toTex, type Expr } from "../calculus/expr.ts";
import { seedFromText } from "./random.ts";
import { exercisesOfTopic } from "./registry.ts";

const ONE = /(^|[^\d.,{])[−-]?\s*1\s*(?:[xy](?![a-z])|\\(?:operatorname|cos|tan|ln|sqrt|left)|e\^|\(|sen|cos|ln|sqrt)/;

const strings = (x: unknown, out: string[] = []): string[] => {
  if (typeof x === "string") out.push(x);
  else if (Array.isArray(x)) for (const y of x) strings(y, out);
  else if (x && typeof x === "object") for (const y of Object.values(x)) strings(y, out);
  return out;
};

const read = (s: string): Expr | null => {
  const r = parseExpr(s, { vars: ["x", "y"] });
  return r.ok ? r.expr : null;
};

describe("coeficiente 1", () => {
  it("1·x es x y −1·x es −x, en texto y en TeX", () => {
    for (const [src, plain, tex] of [
      ["(1x - 2)^4", "(x − 2)^4", "\\left(x - 2\\right)^{4}"],
      ["cos(1x)^5", "cos(x)^5", "\\cos^{5} x"],
      ["-1x + 3", "−x + 3", "-x + 3"],
      ["e^(-1x)", "e^(−x)", "e^{-x}"],
      ["1·2", "1·2", "1 \\cdot 2"],
    ] as const) {
      const e = read(src)!;
      expect(toPlain(e), src).toBe(plain);
      expect(toTex(e), src).toBe(tex);
    }
  });

  it("ningún ejercicio de cálculo (ni su derivada) escribe 1x ni −1x", () => {
    const seeds = [seedFromText("vlcrag")!, ...Array.from({ length: 40 }, (_, i) => i)];
    for (const type of exercisesOfTopic("calculo")) {
      for (const level of type.levels) {
        for (const s of seeds) {
          for (const text of strings(type.generate(s, level))) {
            const e = read(text);
            if (!e) continue;
            for (const out of [toPlain(e), toTex(e)]) expect(out, `${type.id} ${level} ${s}: ${text}`).not.toMatch(ONE);
            if (!/y/.test(text)) for (const d of [derivative(e), derivativeTidy(e)]) for (const out of [toPlain(d), toTex(d)]) expect(out, `${type.id} ${level} ${s}: (${text})′`).not.toMatch(ONE);
          }
        }
      }
    }
  });
});
