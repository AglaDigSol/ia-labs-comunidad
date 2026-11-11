import { describe, expect, it } from "vitest";
import { numericMatches } from "../exam/numeric.ts";
import { binomialSpec, PROB_BINOMIAL } from "../exercises/probability.ts";
import { seedFromText } from "../exercises/random.ts";
import { frac, toNumber, type Frac } from "../rational.ts";
import { checkProbAnswer, gradeAnswer, NOTE_PAD, parseProbAnswer } from "./answer.ts";
import { probAtLeast, pmfExact } from "./distributions.ts";
import { probWithDecimal, probWithDecimalTex } from "./format.ts";

const grade = (text: string, expected: Frac | number) => {
  const a = parseProbAnswer(text);
  if (!a.ok) throw new Error(text);
  return gradeAnswer(a, expected);
};

describe("redondeo a dos decimales: el valor redondeado sin ceros finales también vale", () => {
  const p = frac(9963n, 10000n); // P(X ≥ 2) de la binomial de la semilla abc123, nivel medio

  it("1, 1,0 y 1,00 valen para 0,9963; 1 y 1,0 con la nota de escribir 1,00", () => {
    for (const t of ["1", "1,0", "1,00", "0,9963", "0,996"]) expect(checkProbAnswer(t, p), t).toBe(true);
    expect(grade("1", p).notes).toContain(NOTE_PAD("1,00"));
    expect(grade("1,0", p).notes).toContain(NOTE_PAD("1,00"));
    expect(grade("1,00", p).notes).not.toContain(NOTE_PAD("1,00"));
  });

  it("lo que no es el valor redondeado sigue sin valer", () => {
    for (const t of ["0,99", "0,9", "0", "1,01", "2"]) expect(checkProbAnswer(t, p), t).toBe(false);
    const q = frac(4012n, 10000n);
    expect(checkProbAnswer("0,4", q)).toBe(true);
    expect(grade("0,4", q).notes).toContain(NOTE_PAD("0,40"));
    expect(checkProbAnswer("0,41", q)).toBe(false);
    expect(checkProbAnswer("0,3", frac(36n, 100n))).toBe(false);
  });

  it("también con un valor no racional (Poisson, normal)", () => {
    expect(checkProbAnswer("1", 0.99631)).toBe(true);
    expect(checkProbAnswer("1,0", 0.99631)).toBe(true);
    expect(checkProbAnswer("0,9", 0.99631)).toBe(false);
  });

  it("el simulacro acepta lo mismo", () => {
    for (const t of ["1", "1,0", "1,00"]) expect(numericMatches(t, p, "dos-decimales"), t).toBe(true);
    expect(numericMatches("0,99", p, "dos-decimales")).toBe(false);
  });

  it("la solución enseña el valor exacto y el redondeado", () => {
    expect(probWithDecimal(p)).toBe("9963/10000 = 0,9963 ≈ 1,00");
    expect(probWithDecimalTex(p)).toBe("\\frac{9963}{10000} = 0{,}9963 \\approx 1{,}00");
    expect(probWithDecimal(frac(1n, 3n))).toBe("1/3 ≈ 0,33");
    expect(probWithDecimal(frac(3n, 8n))).toBe("3/8 = 0,375 ≈ 0,38");
    expect(probWithDecimal(frac(1n, 4n))).toBe("1/4 = 0,25");
  });

  it("barrido de semillas de la binomial: si el valor redondeado es entero, el entero vale", () => {
    let seen = 0;
    for (const level of ["medio", "avanzado"] as const) {
      for (let s = 0; s < 400; s++) {
        const inst = PROB_BINOMIAL.generate(seedFromText(`r${s}`) ?? s, level);
        const d = binomialSpec(inst);
        for (const v of [pmfExact(d, inst.k)!, probAtLeast(d, inst.k)]) {
          const r = Math.round(toNumber(typeof v === "number" ? frac(BigInt(Math.round(v * 1e9)), 1000000000n) : v) * 100) / 100;
          if (r !== 0 && r !== 1) continue;
          seen++;
          expect(checkProbAnswer(String(r), v), `${level} r${s}`).toBe(true);
          expect(checkProbAnswer(`${r},0`, v), `${level} r${s}`).toBe(true);
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
