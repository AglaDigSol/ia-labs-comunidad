// Motor de combinatoria y complejidad: las fórmulas contra la enumeración por fuerza bruta con n
// pequeño, el clasificador y la guía, la lectura de respuestas como en el examen, el orden O grande
// de costes y fragmentos, y las funciones por cardinal contra todas las funciones posibles.
import { describe, expect, it } from "vitest";
import { algorithmCost, algorithmGrowth, algorithmLines, type Algorithm } from "./algorithms.ts";
import { commaWarning, equalsInteger, parseExamNumber } from "./answer.ts";
import { bigOText, costOf, costTex, distractors, growthOf, growthTex, growthText, optionIsCorrect, parseCost, prune, sameGrowth, type Growth } from "./bigo.ts";
import {
  acceptedFormulas,
  classify,
  combinations,
  combinationsRep,
  countModel,
  factorial,
  FORMULA_IDS,
  guideFor,
  guideFormula,
  modelProblem,
  permutations,
  permutationsRep,
  thirdQuestion,
  variations,
  variationsRep,
  type CountingModel,
} from "./count.ts";
import { countFunctions, functionFacts, imageFacts, statementText, statementTrue, type FnStatement } from "./functions.ts";
import { PNP_STATEMENTS, pnpPool } from "./pnp.ts";

// ---------------------------------------------------------------- fuerza bruta

/** Todas las secuencias de longitud k con valores 0..n−1. */
function sequences(n: number, k: number): number[][] {
  let out: number[][] = [[]];
  for (let i = 0; i < k; i++) out = out.flatMap((s) => Array.from({ length: n }, (_, v) => [...s, v]));
  return out;
}
const distinct = (s: number[]) => new Set(s).size === s.length;
const nonDecreasing = (s: number[]) => s.every((x, i) => i === 0 || s[i - 1]! <= x);
const increasing = (s: number[]) => s.every((x, i) => i === 0 || s[i - 1]! < x);

describe("fórmulas contra fuerza bruta", () => {
  it("factorial exacto, también grande", () => {
    expect(factorial(0)).toBe(1n);
    expect(factorial(5)).toBe(120n);
    expect(factorial(25)).toBe(15511210043330985984000000n);
    expect(factorial(30).toString()).toBe("265252859812191058636308480000000");
    expect(() => factorial(-1)).toThrow();
    expect(() => factorial(1.5)).toThrow();
  });

  it("V, VR, C y CR coinciden con contar secuencias (n ≤ 5, k ≤ 4)", () => {
    for (let n = 1; n <= 5; n++) {
      for (let k = 0; k <= 4; k++) {
        const all = sequences(n, k);
        expect(variationsRep(n, k), `VR ${n},${k}`).toBe(BigInt(all.length));
        expect(variations(n, k), `V ${n},${k}`).toBe(BigInt(all.filter(distinct).length));
        expect(combinations(n, k), `C ${n},${k}`).toBe(BigInt(all.filter(increasing).length));
        expect(combinationsRep(n, k), `CR ${n},${k}`).toBe(BigInt(all.filter(nonDecreasing).length));
      }
      expect(permutations(n)).toBe(BigInt(sequences(n, n).filter(distinct).length));
    }
  });

  it("PR coincide con contar las ordenaciones distintas de una palabra con letras repetidas", () => {
    for (const groups of [[2, 1], [2, 2], [3, 1, 1], [2, 2, 1], [3, 2], [1, 1, 1, 1], [4, 2]]) {
      const letters = groups.flatMap((g, i) => Array.from({ length: g }, () => i));
      const n = letters.length;
      const words = new Set(sequences(n, n).filter(distinct).map((p) => p.map((i) => letters[i]).join("")));
      expect(permutationsRep(groups), groups.join(",")).toBe(BigInt(words.size));
    }
  });

  it("identidades: C(n,k) = C(n,n−k), CR(n,k) = C(n+k−1,k), V(n,n) = P(n), PR con dos grupos = C", () => {
    for (let n = 1; n <= 20; n++) {
      expect(variations(n, n)).toBe(permutations(n));
      for (let k = 0; k <= n; k++) {
        expect(combinations(n, k)).toBe(combinations(n, n - k));
        expect(combinations(n, k) * factorial(k)).toBe(variations(n, k));
        expect(permutationsRep([k, n - k].filter((g) => g > 0))).toBe(combinations(n, k));
        expect(combinationsRep(n, k)).toBe(combinations(n + k - 1, k));
      }
    }
    expect(variations(3, 5)).toBe(0n);
    expect(combinations(3, 5)).toBe(0n);
    expect(combinationsRep(0, 0)).toBe(1n);
  });
});

describe("clasificador y guía", () => {
  const cases: Array<[CountingModel, string]> = [
    [{ n: 6, k: 6, order: true, repetition: false }, "P"],
    [{ n: 9, k: 3, order: true, repetition: false }, "V"],
    [{ n: 10, k: 5, order: true, repetition: true }, "VR"],
    [{ n: 12, k: 4, order: false, repetition: false }, "C"],
    [{ n: 5, k: 3, order: false, repetition: true }, "CR"],
    [{ n: 7, k: 7, order: true, repetition: true, groups: [3, 4] }, "PR"],
  ];

  it("cada modelo tiene su fórmula y la guía lleva a ella", () => {
    for (const [m, id] of cases) {
      expect(classify(m)).toBe(id);
      expect(modelProblem(m)).toBeNull();
      const g = guideFor(m);
      expect(thirdQuestion(g.order, g.repetition) === null).toBe(g.third === null);
      expect(guideFormula(g)).toBe(id);
    }
    const reached = new Set<string>();
    for (const order of [true, false]) for (const repetition of [true, false]) for (const third of [true, false]) {
      const f = guideFormula({ order, repetition, third: thirdQuestion(order, repetition) ? third : null });
      if (f) reached.add(f);
    }
    expect([...reached].sort()).toEqual([...FORMULA_IDS].sort());
    expect(guideFormula({ order: true, repetition: false, third: null })).toBeNull();
    expect(guideFormula({ order: null, repetition: false, third: null })).toBeNull();
  });

  it("valores y fórmulas equivalentes", () => {
    expect(countModel(cases[1]![0])).toBe(504n);
    expect(countModel(cases[5]![0])).toBe(35n);
    expect(acceptedFormulas(cases[0]![0])).toEqual(["P", "V"]);
    expect(acceptedFormulas(cases[5]![0])).toEqual(["PR", "C"]);
    expect(acceptedFormulas({ n: 6, k: 6, order: true, repetition: true, groups: [3, 2, 1] })).toEqual(["PR"]);
    expect(acceptedFormulas(cases[3]![0])).toEqual(["C"]);
  });

  it("rechaza modelos imposibles", () => {
    expect(modelProblem({ n: 3, k: 5, order: false, repetition: false })).toMatch(/Sin repetición/);
    expect(modelProblem({ n: 5, k: 5, order: true, repetition: true, groups: [2, 2] })).toMatch(/sumar n/);
    expect(modelProblem({ n: 0, k: 0, order: true, repetition: false })).toMatch(/entre 1/);
    expect(modelProblem({ n: 3, k: 5, order: false, repetition: true })).toBeNull();
  });
});

describe("respuestas como en el examen", () => {
  it("acepta enteros y coma decimal, exactos", () => {
    const r = parseExamNumber(" 12870 ");
    expect(r.ok && equalsInteger(r.value, 12870n)).toBe(true);
    const d = parseExamNumber("12870,0");
    expect(d.ok && equalsInteger(d.value, 12870n)).toBe(true);
    const h = parseExamNumber("0,5");
    expect(h.ok && h.value).toEqual({ units: 5n, scale: 1 });
    const big = parseExamNumber(factorial(30).toString());
    expect(big.ok && equalsInteger(big.value, factorial(30))).toBe(true);
    const neg = parseExamNumber("−3");
    expect(neg.ok && equalsInteger(neg.value, -3n)).toBe(true);
  });

  it("rechaza separadores de miles y el punto decimal con un mensaje que repite tus cifras", () => {
    for (const t of ["12.870", "1.234.567", "12 870", "12 870"]) {
      const r = parseExamNumber(t);
      expect(r.ok, t).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/Sin separador de miles/);
    }
    const r = parseExamNumber("12.870");
    expect(!r.ok && r.error).toContain("12870");
    const p = parseExamNumber("2.5");
    expect(!p.ok && p.error).toMatch(/coma es la decimal.*2,5/);
    for (const t of ["", "1e5", "12a", "1,2,3", "12..3"]) expect(parseExamNumber(t).ok, t).toBe(false);
    expect(commaWarning("12,870")).toMatch(/coma es la decimal/);
    expect(commaWarning("12870")).toBeNull();
  });
});

describe("O grande", () => {
  const O = (s: string) => growthText(growthOf(costOf(s)));

  it("término dominante de costes de tipo polinómico", () => {
    expect(O("(n^5 - 2n + 1)^2")).toBe("n¹⁰");
    expect(O("n·(2^n + n^8 + 3)")).toBe("n·2ⁿ");
    expect(O("3n^2 + 5n log n + 7")).toBe("n²");
    expect(O("n log n + n")).toBe("n·log n");
    expect(O("2^n + 3^n")).toBe("3ⁿ");
    expect(O("(2^n)^2")).toBe("4ⁿ");
    expect(O("m n + n")).toBe("m·n");
    expect(O("m^2 + n")).toBe("n + m²");
    expect(O("log(n)^2 + log n")).toBe("log² n");
    expect(O("7")).toBe("1");
    expect(O("n^3 - n^2 + 4")).toBe("n³");
  });

  it("canónico: mismo orden escrito de dos formas", () => {
    expect(sameGrowth(growthOf(costOf("n^2 + n")), growthOf(costOf("5n^2")))).toBe(true);
    expect(sameGrowth(growthOf(costOf("n^2")), growthOf(costOf("n^3")))).toBe(false);
    expect(sameGrowth(growthOf(costOf("m n")), growthOf(costOf("n m + 3")))).toBe(true);
  });

  it("TeX del coste y del orden", () => {
    expect(costTex(costOf("(n^5 - 2n + 1)^2"))).toBe("\\left(n^{5} - 2n + 1\\right)^{2}");
    expect(costTex(costOf("2^k + k^8 + 3", ["k"]))).toBe("2^{k} + k^{8} + 3");
    expect(growthTex(growthOf(costOf("n 2^n")))).toBe("n \\cdot 2^{n}");
    expect(growthTex(growthOf(costOf("m n")))).toBe("m n");
    expect(bigOText(growthOf(costOf("n log n")))).toBe("O(n·log n)");
  });

  it("el analizador rechaza lo que no es un coste, sin evaluar nada", () => {
    for (const t of ["", "n +", "2^", "x", "n^n", "(n", "log", "alert(1)", "1^n", "0"]) expect(parseCost(t).ok, t).toBe(false);
    expect(parseCost("k^2", ["n"]).ok).toBe(false);
    expect(parseCost("n⁵ + 2ⁿ").ok).toBe(true);
    expect(O("n⁵ + n²")).toBe("n⁵");
  });

  it("los distractores son distintos entre sí y del correcto", () => {
    for (const s of ["(n^5 - 2n + 1)^2", "n 2^n", "m n", "n log n", "n^2", "log n", "n", "n^3 + m", "1"]) {
      const g = growthOf(costOf(s));
      const ds = distractors(g);
      expect(ds.length, s).toBeGreaterThanOrEqual(4);
      for (const d of ds) expect(sameGrowth(d, g), s).toBe(false);
      for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) expect(sameGrowth(ds[i]!, ds[j]!)).toBe(false);
    }
  });

  it("«Ninguna de las otras» es correcta solo si no está el orden correcto", () => {
    const g = growthOf(costOf("n^2"));
    const wrong: Growth[] = distractors(g).slice(0, 4);
    const withIt = [{ growth: g }, ...wrong.slice(0, 3).map((growth) => ({ growth })), { none: true as const }];
    expect(optionIsCorrect(withIt, 0, g)).toBe(true);
    expect(optionIsCorrect(withIt, 4, g)).toBe(false);
    const without = [...wrong.map((growth) => ({ growth })), { none: true as const }];
    expect(optionIsCorrect(without, 4, g)).toBe(true);
    expect(optionIsCorrect(without, 0, g)).toBe(false);
    expect(prune([{}, {}])).toEqual([{}]);
  });

  it("fragmentos de pseudocódigo: bucles anidados, triangulares, mitades y llamadas", () => {
    const nested: Algorithm = {
      sets: { A: "m", B: "n" },
      body: [{ k: "forEach", v: "a", set: "A", body: [{ k: "forEach", v: "b", set: "B", body: [{ k: "op", text: "s ← s + 1" }] }] }],
    };
    expect(growthText(algorithmGrowth(nested))).toBe("m·n");
    const tri: Algorithm = { body: [{ k: "for", v: "i", to: "n", body: [{ k: "for", v: "j", to: "i", body: [{ k: "op", text: "s ← s + 1" }] }] }] };
    expect(growthText(algorithmGrowth(tri))).toBe("n²");
    const call: Algorithm = { sub: "2^k + k^8 + 3", body: [{ k: "for", v: "i", to: "n", body: [{ k: "call", arg: "n" }] }] };
    expect(growthText(algorithmGrowth(call))).toBe("n·2ⁿ");
    const half: Algorithm = { body: [{ k: "for", v: "i", to: "n", body: [{ k: "halve", v: "j", from: "n", body: [{ k: "op", text: "s ← s + 1" }] }] }] };
    expect(growthText(algorithmGrowth(half))).toBe("n·log n");
    const seq: Algorithm = {
      body: [
        { k: "for", v: "i", to: "n", body: [{ k: "op", text: "s ← s + i" }] },
        { k: "for", v: "i", to: "n", body: [{ k: "for", v: "j", to: "n", body: [{ k: "for", v: "l", to: "n", body: [{ k: "op", text: "s ← s + 1" }] }] }] },
      ],
    };
    expect(growthText(algorithmGrowth(seq))).toBe("n³");
    expect(algorithmLines(half)).toEqual(["para i ← 1 hasta n:", "    j ← n", "    mientras j > 1:", "        s ← s + 1", "        j ← ⌊j/2⌋"]);
    expect(() => algorithmCost({ body: [{ k: "for", v: "j", to: "i", body: [] }] })).toThrow();
  });

  it("el número de vueltas real crece como el orden calculado (bucle triangular y mitades)", () => {
    const tri = (n: number) => {
      let c = 0;
      for (let i = 1; i <= n; i++) for (let j = 1; j <= i; j++) c++;
      return c;
    };
    // n(n+1)/2: entre n²/2 y n², del orden de n².
    for (const n of [10, 100, 1000]) expect(tri(n) / (n * n)).toBeGreaterThan(0.49);
    const halves = (n: number) => {
      let c = 0;
      for (let j = n; j > 1; j = Math.floor(j / 2)) c++;
      return c;
    };
    for (const n of [16, 1000, 1 << 20]) expect(halves(n)).toBe(Math.floor(Math.log2(n)));
  });
});

describe("funciones por cardinal contra todas las funciones", () => {
  /** Todas las funciones de {0..a−1} en {0..b−1}. */
  const allFunctions = (a: number, b: number) => sequences(b, a);
  const isInj = (f: number[]) => distinct(f);
  const isSurj = (f: number[], b: number) => new Set(f).size === b;

  it("puede y necesariamente, para |A|, |B| ≤ 4", () => {
    for (let a = 1; a <= 4; a++) {
      for (let b = 1; b <= 4; b++) {
        const fs = allFunctions(a, b);
        const facts = functionFacts(a, b);
        const inj = fs.map(isInj);
        const sur = fs.map((f) => isSurj(f, b));
        const bij = fs.map((_, i) => inj[i]! && sur[i]!);
        expect(facts.inyectiva).toEqual({ possible: inj.some(Boolean), necessary: inj.every(Boolean) });
        expect(facts.sobreyectiva).toEqual({ possible: sur.some(Boolean), necessary: sur.every(Boolean) });
        expect(facts.biyectiva).toEqual({ possible: bij.some(Boolean), necessary: bij.every(Boolean) });
        expect(countFunctions(a, b, "todas")).toBe(BigInt(fs.length));
        expect(countFunctions(a, b, "inyectivas")).toBe(BigInt(inj.filter(Boolean).length));
        expect(countFunctions(a, b, "biyectivas")).toBe(BigInt(bij.filter(Boolean).length));
      }
    }
  });

  it("con |f(A)| conocido, f y g: A → f(A)", () => {
    for (let a = 1; a <= 4; a++) {
      for (let b = 1; b <= 4; b++) {
        for (const f of allFunctions(a, b)) {
          const c = new Set(f).size;
          const facts = imageFacts(a, b, c);
          expect(facts.f.inyectiva).toBe(isInj(f));
          expect(facts.f.sobreyectiva).toBe(isSurj(f, b));
          expect(facts.g.sobreyectiva).toBe(true);
          expect(facts.g.biyectiva).toBe(isInj(f));
        }
      }
    }
  });

  it("afirmaciones en texto y su valor", () => {
    const s = { a: 5, b: 3 };
    const st: FnStatement[] = [
      { k: "modal", mode: "puede", prop: "inyectiva" },
      { k: "modal", mode: "puede", prop: "sobreyectiva" },
      { k: "modal", mode: "no-puede", prop: "biyectiva" },
      { k: "count", what: "todas", value: 243 },
    ];
    expect(st.map((x) => statementTrue(x, s))).toEqual([false, true, true, true]);
    expect(statementText(st[0]!)).toBe("f puede ser inyectiva.");
    expect(statementText({ k: "onto-image", prop: "sobreyectiva" })).toBe("g: A → f(A), g(x) = f(x), es sobreyectiva.");
    expect(() => statementTrue({ k: "fixed", prop: "inyectiva" }, s)).toThrow();
  });
});

describe("afirmaciones de P y NP", () => {
  it("ids únicos, de los tres niveles y con explicación", () => {
    const ids = PNP_STATEMENTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const level of ["básico", "medio", "avanzado"] as const) {
      const pool = pnpPool(level);
      expect(pool.length).toBeGreaterThanOrEqual(8);
      expect(pool.some((s) => s.value) && pool.some((s) => !s.value)).toBe(true);
    }
    for (const s of PNP_STATEMENTS) expect(s.why.length).toBeGreaterThan(20);
  });
});
