// Tipos guiados (tensores, factorizaciones, formas de NumPy, desbordamiento y extremos absolutos): en
// todas las semillas y niveles, la respuesta buena de cada paso se acepta, cada error típico se rechaza
// con su explicación (que nunca es la respuesta), las pistas no hablan de lo que no hay en el enunciado
// y los ejemplos a mano dan lo que dicen las guías.
import { describe, expect, it } from "vitest";
import { intMatrix, type Matrix } from "../linalg/matrix.ts";
import { frac, type Frac } from "../rational.ts";
import { CALC_ABS_EXTREMES, extremesGuided, extremesOf, polyValue } from "./calculus-extremes.ts";
import { choleskyOf, LINALG_LINEAR_MAP, LINALG_SVD, linearMapMatrix, luOf, qrOf, qrProduct, svdOf, LINALG_QR } from "./factorizations.ts";
import { checkStep, dimsText, parseDims, parseNumberList, rightAnswer, stepMistakes, typedAnswer, type GuidedExercise, type GuidedStep } from "./guided.ts";
import { GUIDED_TYPES, guidedExercise } from "./guided-types.ts";
import { axesGuided, axesResult, dataShape, dataShapeGuided, overflowGuided, overflowValues, PY_DATA_SHAPE, PY_NUMPY_AXES, sliceLength, wrap } from "./numpy-shapes.ts";
import { EXERCISE_TYPES, exerciseType } from "./registry.ts";
import { changeBasisOf, contract, coordsAnswer, einsteinDummies, einsteinFree, einsteinGuided, LINALG_EINSTEIN, outer, tensorOf } from "./tensors.ts";
import { EXERCISE_LEVELS } from "./types.ts";

const SEEDS = Array.from({ length: 120 }, (_, i) => (i * 2654435761 + 7) >>> 0);
const F = (n: number, d = 1): Frac => frac(BigInt(n), BigInt(d));
const M = (rows: number[][]): Matrix => intMatrix(rows);

/** Una respuesta equivocada «cualquiera» para el paso (cambia el primer valor). */
function wrongAnswer(step: GuidedStep) {
  switch (step.kind) {
    case "numbers": {
      const v = step.expected.map((r) => [...r]);
      v[0]![0] = frac(v[0]![0]!.n + 7n * v[0]![0]!.d, v[0]![0]!.d);
      return typedAnswer(step, v);
    }
    case "integer":
      return typedAnswer(step, step.expected + 3n);
    case "shape":
      return step.expected === "error" ? typedAnswer(step, [2, 3]) : typedAnswer(step, [...step.expected, 7]);
    case "list":
      return typedAnswer(step, [...step.expected, F(99)]);
    case "labels":
      return typedAnswer(step, step.expected.map((x) => (x === step.options[0]!.id ? step.options[1]!.id : step.options[0]!.id)));
    case "choice":
      return typedAnswer(step, step.options.find((o) => o.id !== step.expected)!.id);
  }
}

const allTexts = (g: GuidedExercise) => [
  g.statement.ask,
  ...g.statement.blocks.map((b) => (b.kind === "p" ? b.text : b.kind === "code" ? b.code : `${b.tex} ${b.label}`)),
  ...g.solution,
  ...g.steps.flatMap((s) => [s.title, s.okText, ...s.hints, ...stepMistakes(s).map((m) => m.text)]),
];

describe("tipos guiados: registro", () => {
  it("todos están en el banco, sin módulo, con los tres niveles", () => {
    for (const { type } of GUIDED_TYPES) {
      expect(EXERCISE_TYPES).toContain(type);
      expect(exerciseType(type.id)).toBe(type);
      expect(type.module).toBeUndefined();
      expect(type.levels).toEqual(EXERCISE_LEVELS);
    }
    expect(guidedExercise("logica-tabla", {})).toBeNull();
  });
});

describe("tipos guiados: en todas las semillas y niveles", () => {
  for (const { type, guided } of GUIDED_TYPES) {
    it(`${type.id}: la buena se acepta, los errores típicos se rechazan con su explicación`, () => {
      for (const level of EXERCISE_LEVELS) {
        for (const s of SEEDS) {
          const inst = type.generate(s, level);
          const g = guided(inst);
          const where = `${type.id} ${level} ${s}: ${JSON.stringify(inst)}`;
          expect(g.steps.length, where).toBeGreaterThan(0);
          expect(g.solution.length, where).toBeGreaterThan(0);
          for (const t of allTexts(g)) expect(t, where).not.toMatch(/undefined|NaN|Infinity|\[object/);
          for (const step of g.steps) {
            expect(step.hints.length, `${where} ${step.title}`).toBeGreaterThan(0);
            const ok = checkStep(step, rightAnswer(step));
            expect(ok.ok, `${where} ${step.title}: ${ok.text}`).toBe(true);
            for (const m of stepMistakes(step)) {
              const v = checkStep(step, typedAnswer(step, m.value));
              expect(v.ok, `${where} ${step.title}: el error «${m.text}» pasa`).toBe(false);
              if (step.kind !== "choice") expect(v.text.startsWith(m.text), `${where} ${step.title}: ${v.text}`).toBe(true);
            }
            const bad = checkStep(step, wrongAnswer(step));
            expect(bad.ok, `${where} ${step.title}`).toBe(false);
            expect(bad.text.length).toBeGreaterThan(5);
          }
        }
      }
    });
  }

  it("los mensajes de error no dicen la respuesta buena del paso", () => {
    for (const { type, guided } of GUIDED_TYPES)
      for (const level of EXERCISE_LEVELS)
        for (const s of SEEDS.slice(0, 30)) {
          const g = guided(type.generate(s, level));
          for (const step of g.steps) {
            if (step.kind === "integer" && step.expected > 9n) for (const m of stepMistakes(step)) expect(m.text, `${type.id}: ${m.text}`).not.toContain(String(step.expected));
            if (step.kind === "shape" && step.expected !== "error") for (const m of stepMistakes(step)) expect(m.text).not.toContain(dimsText(step.expected));
          }
        }
  });
});

describe("lectura de respuestas", () => {
  it("formas: como en NumPy, con longitudes grandes y sin separador de miles", () => {
    expect(parseDims("(96000,)")).toEqual({ ok: true, value: [96000] });
    expect(parseDims("(2, 132_300)")).toEqual({ ok: true, value: [2, 132300] });
    expect(parseDims("[32, 3, 224, 224]")).toEqual({ ok: true, value: [32, 3, 224, 224] });
    expect(parseDims("()")).toEqual({ ok: true, value: [] });
    expect(parseDims("3").ok).toBe(true);
    for (const bad of ["(2 3)", "(2.5, 3)", "(96 000,)", "(-1, 2)", "", "abc"]) expect(parseDims(bad).ok, bad).toBe(false);
  });

  it("listas: con punto y coma (la coma es la decimal) y «ninguno»", () => {
    expect(parseNumberList("−1; 2")).toEqual({ ok: true, value: [F(-1), F(2)] });
    expect(parseNumberList("ninguno")).toEqual({ ok: true, value: [] });
    expect(parseNumberList("1,5; 3/2")).toEqual({ ok: true, value: [F(3, 2), F(3, 2)] });
    expect(parseNumberList("").ok).toBe(false);
    expect(parseNumberList("1, 2, 3").ok).toBe(false);
  });

  it("enteros: como en el examen, con el aviso del separador de miles", () => {
    const step: GuidedStep = { kind: "integer", title: "t", label: "l", expected: 96000n, hints: ["h"], okText: "Bien." };
    expect(checkStep(step, { kind: "integer", text: "96000" })).toEqual({ ok: true, text: "Bien." });
    const r = checkStep(step, { kind: "integer", text: "96.000" });
    expect(r.ok).toBe(true);
    expect(r.text).toMatch(/sin separador de miles: 96000/);
    expect(checkStep(step, { kind: "integer", text: "95.000" }).text).toMatch(/Sin separador de miles/);
  });

  it("números de una matriz: fracciones, decimales con coma o punto, y celdas que no se leen", () => {
    const step: GuidedStep = { kind: "numbers", title: "t", name: "q₁", expected: [[F(3, 5), F(4, 5)]], hints: ["h"], okText: "Bien." };
    expect(checkStep(step, { kind: "numbers", cells: [["3/5", "0,8"]] }).ok).toBe(true);
    expect(checkStep(step, { kind: "numbers", cells: [["0.6", "4/5"]] }).ok).toBe(true);
    const bad = checkStep(step, { kind: "numbers", cells: [["tres", "4/5"]] });
    expect(bad.ok).toBe(false);
    expect(bad.cells).toEqual([[0, 0]]);
    expect(checkStep(step, { kind: "numbers", cells: [["", "4/5"]] }).cells).toEqual([[0, 0]]);
  });
});

describe("Einstein", () => {
  it("aᵢⱼbⱼₖ con n = 3: j mudo, i y k libres, 3 sumandos y 9 componentes", () => {
    const inst = { n: 3, factors: [{ name: "a", lower: ["i", "j"], upper: [] }, { name: "b", lower: ["j", "k"], upper: [] }] };
    expect(einsteinDummies(inst)).toEqual(["j"]);
    expect(einsteinFree(inst)).toEqual(["i", "k"]);
    const g = einsteinGuided(inst);
    expect(g.steps.map((s) => s.expected)).toEqual([["libre", "mudo", "libre"], 3n, 9n]);
    // 3·1 = 3: el error n·d coincide con la buena y no se ofrece.
    const terms = g.steps[1]!;
    expect(checkStep(terms, { kind: "integer", text: "27" }).text).toMatch(/libres/);
    expect(g.solution.join(" ")).toContain("Para i = 1, k = 1: a₁₁b₁₁ + a₁₂b₂₁ + a₁₃b₃₁.");
  });

  it("Tⁱⱼₖ vʲ wᵏ con n = 4: 16 sumandos y 4 componentes; sin libres es un escalar", () => {
    const g = einsteinGuided({ n: 4, factors: [{ name: "T", upper: ["i"], lower: ["j", "k"] }, { name: "v", upper: ["j"], lower: [] }, { name: "w", upper: ["k"], lower: [] }] });
    expect(g.steps[1]!.expected).toBe(16n);
    expect(g.steps[2]!.expected).toBe(4n);
    expect(checkStep(g.steps[1]!, { kind: "integer", text: "8" }).text).toMatch(/no se suma n una vez/);
    expect(einsteinGuided({ n: 3, factors: [{ name: "a", lower: ["i"], upper: [] }, { name: "b", lower: ["i"], upper: [] }] }).steps[2]!.expected).toBe(1n);
  });

  it("las pistas de arriba/abajo y de la traza solo salen si el enunciado las tiene", () => {
    for (const level of EXERCISE_LEVELS)
      for (const s of SEEDS) {
        const inst = LINALG_EINSTEIN.generate(s, level);
        const hints = einsteinGuided(inst).steps.flatMap((x) => x.hints).join(" ");
        const up = inst.factors.some((f) => f.upper.length > 0);
        const tr = inst.factors.some((f) => new Set([...f.upper, ...f.lower]).size < f.upper.length + f.lower.length);
        if (!up) expect(hints).not.toMatch(/arriba/);
        if (!tr) expect(hints).not.toMatch(/mismo factor/);
        if (einsteinFree(inst).length > 0) expect(hints).not.toMatch(/Sin índices libres/);
      }
  });
});

describe("producto tensorial y contracción", () => {
  it("u ⊗ v es la tabla uᵢvⱼ; contraer u ⊗ v da u·v y A ⊗ B en (2, 3) da AB", () => {
    const u = tensorOf([[1, 2]], true);
    const v = tensorOf([[3, -1, 0]], true);
    expect(outer(u, v)).toEqual({ shape: [2, 3], data: [3, -1, 0, 6, -2, 0] });
    expect(contract(outer(u, tensorOf([[4, 5]], true)), 0, 1)).toEqual({ shape: [], data: [14] });
    const A = tensorOf([[1, 2], [3, 4]], false);
    const B = tensorOf([[0, 1], [5, -2]], false);
    expect(contract(outer(A, B), 1, 2).data).toEqual([10, -3, 20, -5]);
    expect(contract(outer(A, B), 1, 3).data).toEqual([2, 1, 4, 7]);
  });
});

describe("coordenadas en otra base", () => {
  it("el (5, 4) de las láminas en la base (1, −1), (1, 2) tiene coordenadas (2, 3); la base escalada divide", () => {
    expect(coordsAnswer({ kind: "directa", b1: [1, -1], b2: [1, 2], v: [5, 4], covariant: true })).toEqual({ v: [F(5), F(4)], coords: [F(2), F(3)], cov: [F(1), F(13)] });
    expect(coordsAnswer({ kind: "escalada", b1: [1, 0], b2: [0, 1], c: [5, 4], s: [2, 2] }).coords).toEqual([F(5, 2), F(2)]);
  });
});

describe("operador en una base nueva", () => {
  it("D = C⁻¹AC tiene la traza de A, y C·A·C⁻¹ es el error típico", () => {
    const { D, wrong } = changeBasisOf({ A: [[2, 1], [0, 3]], C: [[1, 1], [0, 1]] });
    expect(D).toEqual(M([[2, 0], [0, 3]]));
    expect(wrong).toEqual(M([[2, 2], [0, 3]]));
  });
});

describe("factorizaciones", () => {
  it("LU del ejemplo de la guía", () => {
    const r = luOf([[2, 1, 1], [4, 3, 3], [8, 7, 9]])!;
    expect(r.L).toEqual(M([[1, 0, 0], [2, 1, 0], [4, 3, 1]]));
    expect(r.U).toEqual(M([[2, 1, 1], [0, 1, 1], [0, 0, 2]]));
    expect(luOf([[0, 1], [1, 0]])).toBeNull();
  });

  it("Cholesky del ejemplo de la guía", () => {
    expect(choleskyOf([[4, 2, 2], [2, 5, 3], [2, 3, 6]])).toEqual(M([[2, 0, 0], [1, 2, 0], [1, 1, 2]]));
    expect(choleskyOf([[1, 2], [2, 1]])).toBeNull();
  });

  it("QR de (3 1; 4 2): r₁₁ = 5, r₁₂ = 11/5, r₂₂ = 2/5, y Q·R = A en todas las semillas", () => {
    const q = qrOf({ a1: [3, 4], a2: [1, 2] });
    expect([q.r11, q.r12, q.r22]).toEqual([F(5), F(11, 5), F(2, 5)]);
    expect(q.q2).toEqual([F(-4, 5), F(3, 5)]);
    for (const level of EXERCISE_LEVELS)
      for (const s of SEEDS) {
        const inst = LINALG_QR.generate(s, level);
        expect(qrProduct(inst)).toEqual(inst.a1.map((x, i) => [F(x), F(inst.a2[i]!)]));
      }
  });

  it("valores singulares de (12 −1; 6 12): 15 y 10", () => {
    expect(svdOf({ A: [[12, -1], [6, 12]] })!.sigmas).toEqual([F(15), F(10)]);
    for (const level of EXERCISE_LEVELS)
      for (const s of SEEDS) {
        const sv = svdOf(LINALG_SVD.generate(s, level))!;
        const frob = sv.A.flat().reduce((acc, x) => acc + Number(x.n) ** 2, 0);
        expect(Number(sv.sigmas[0]!.n) ** 2 + Number(sv.sigmas[1]!.n) ** 2).toBe(frob);
      }
  });

  it("aplicación lineal: A·bᵢ = T(bᵢ) cuando se da en otra base", () => {
    for (const s of SEEDS) {
      const inst = LINALG_LINEAR_MAP.generate(s, "avanzado");
      if (inst.kind !== "base") continue;
      const A = linearMapMatrix(inst);
      const img = (b: number[]) => A.map((r) => Number(r[0]!.n) * b[0]! + Number(r[1]!.n) * b[1]!);
      expect(img(inst.b1)).toEqual(inst.t1);
      expect(img(inst.b2)).toEqual(inst.t2);
    }
  });
});

describe("formas de arrays de NumPy", () => {
  it("los ejemplos de las láminas", () => {
    const base = { h: 0, w: 0, res: "wxh" as const, conv: "numpy" as const, batch: null, dtype: null };
    expect(dataShape({ ...base, kind: "audio", rate: 48000, secs: 2, channels: 1, conv: "pytorch" })).toEqual([96000]);
    expect(dataShape({ ...base, kind: "audio", rate: 44100, secs: 3, channels: 2, conv: "pytorch" })).toEqual([2, 132300]);
    expect(dataShape({ ...base, kind: "imagen", rate: 0, secs: 0, h: 800, w: 600, channels: 1 })).toEqual([800, 600]);
    expect(dataShape({ ...base, kind: "imagen", rate: 0, secs: 0, h: 1200, w: 2000, channels: 3, conv: "pytorch" })).toEqual([3, 1200, 2000]);
    expect(dataShape({ ...base, kind: "imagen", rate: 0, secs: 0, h: 1200, w: 2000, channels: 3 })).toEqual([1200, 2000, 3]);
    expect(dataShape({ ...base, kind: "video", rate: 30, secs: 60, h: 720, w: 1280, channels: 1 })).toEqual([1800, 720, 1280]);
    expect(dataShape({ ...base, kind: "video", rate: 60, secs: 40, h: 1080, w: 1920, channels: 3, conv: "pytorch" })).toEqual([2400, 3, 1080, 1920]);
    expect(dataShape({ ...base, kind: "imagen", rate: 0, secs: 0, h: 224, w: 224, channels: 3, conv: "pytorch", batch: 32 })).toEqual([32, 3, 224, 224]);
  });

  it("ancho antes que alto o los canales en el sitio de la otra librería: se rechaza con su explicación", () => {
    const inst = { kind: "imagen" as const, rate: 0, secs: 0, h: 1200, w: 2000, res: "wxh" as const, channels: 3, conv: "pytorch" as const, batch: null, dtype: null };
    const step = dataShapeGuided(inst).steps.find((s) => s.kind === "shape")!;
    expect(checkStep(step, { kind: "shape", text: "(3, 2000, 1200)", error: false }).text).toMatch(/ancho antes que el alto/);
    expect(checkStep(step, { kind: "shape", text: "(1200, 2000, 3)", error: false }).text).toMatch(/orden de NumPy/);
    expect(checkStep(step, { kind: "shape", text: "(3, 1200, 2000)", error: false }).ok).toBe(true);
  });

  it("las pistas del lote, del vídeo y de ancho × alto solo si el enunciado las tiene", () => {
    for (const level of EXERCISE_LEVELS)
      for (const s of SEEDS) {
        const inst = PY_DATA_SHAPE.generate(s, level);
        const hints = dataShapeGuided(inst).steps.flatMap((x) => x.hints).join(" ");
        if (inst.batch === null) expect(hints).not.toMatch(/lote/);
        if (inst.kind !== "video") expect(hints).not.toMatch(/fotogramas/);
        if (inst.kind !== "audio") expect(hints).not.toMatch(/muestreo/);
        if (inst.channels === 1) expect(hints).not.toMatch(/canales van al final|canales van delante del alto/);
      }
  });

  it("cortes de Python, expand_dims, squeeze e índices", () => {
    expect(sliceLength(5, null, null, 2)).toBe(3);
    expect(sliceLength(5, 1, 3, null)).toBe(2);
    expect(sliceLength(4, null, null, -1)).toBe(4);
    expect(sliceLength(4, 1, 10, null)).toBe(3);
    const s = [2, 3, 4];
    expect(axesResult({ shape: s, op: { k: "expand", axis: 0 } })).toEqual({ ok: true, shape: [1, 2, 3, 4] });
    expect(axesResult({ shape: s, op: { k: "expand", axis: -1 } })).toEqual({ ok: true, shape: [2, 3, 4, 1] });
    expect(axesResult({ shape: s, op: { k: "expand", axis: 4 } }).ok).toBe(false);
    expect(axesResult({ shape: [1, 3, 1, 4], op: { k: "squeeze", axis: null } })).toEqual({ ok: true, shape: [3, 4] });
    expect(axesResult({ shape: [1, 3, 1, 4], op: { k: "squeeze", axis: 1 } })).toMatchObject({ ok: false, error: "ValueError" });
    expect(axesResult({ shape: s, op: { k: "index", idx: [{ t: "ellipsis" }, { t: "int", v: 0 }] } })).toEqual({ ok: true, shape: [2, 3] });
    expect(axesResult({ shape: s, op: { k: "index", idx: [{ t: "slice", start: null, stop: null, step: null }, { t: "new" }] } })).toEqual({ ok: true, shape: [2, 1, 3, 4] });
    expect(axesResult({ shape: s, op: { k: "index", idx: [{ t: "int", v: 2 }] } })).toMatchObject({ ok: false, error: "IndexError" });
    const g = axesGuided({ shape: s, op: { k: "index", idx: [{ t: "int", v: 0 }] } });
    expect(checkStep(g.steps[0]!, { kind: "shape", text: "(1, 3, 4)", error: false }).text).toMatch(/quita su eje/);
    expect(checkStep(g.steps[0]!, { kind: "shape", text: "", error: true }).ok).toBe(false);
  });

  it("en avanzado hay ejercicios que dan error y en básico y medio no", () => {
    const errs = (level: (typeof EXERCISE_LEVELS)[number]) => SEEDS.filter((s) => !axesResult(PY_NUMPY_AXES.generate(s, level)).ok).length;
    expect(errs("básico")).toBe(0);
    expect(errs("medio")).toBe(0);
    expect(errs("avanzado")).toBeGreaterThan(5);
  });
});

describe("desbordamiento", () => {
  it("int8: 100 + 50 = −106; uint8: 3 − 5 = 254; la media (200 + 100) // 2 da 22", () => {
    expect(wrap(150, "int8")).toBe(-106);
    expect(wrap(-129, "int8")).toBe(127);
    expect(wrap(-2, "uint8")).toBe(254);
    expect(overflowValues({ dtype: "uint8", a: [200, 10], b: [100, 20], expr: "media", k: 2, widen: true })).toEqual({ exact: [150, 15], numpy: [22, 15], wide: [150, 15] });
  });

  it("saturar en 127 o no dar la vuelta se rechaza con su explicación", () => {
    const g = overflowGuided({ dtype: "int8", a: [100], b: [50], expr: "+", k: 2, widen: false });
    const step = g.steps[2]!;
    expect(checkStep(step, { kind: "numbers", cells: [["-106"]] }).ok).toBe(true);
    expect(checkStep(step, { kind: "numbers", cells: [["150"]] }).text).toMatch(/no cabe/);
    expect(checkStep(step, { kind: "numbers", cells: [["127"]] }).text).toMatch(/no satura/);
    expect(checkStep(step, { kind: "numbers", cells: [["22"]] }).text).toMatch(/256 en 256/);
  });
});

describe("extremos absolutos", () => {
  it("en todas las semillas: el máximo y el mínimo son los de f en una malla fina del intervalo", () => {
    for (const level of EXERCISE_LEVELS)
      for (const s of SEEDS) {
        const inst = CALC_ABS_EXTREMES.generate(s, level);
        const e = extremesOf(inst);
        let hi = -Infinity;
        let lo = Infinity;
        for (let k = 0; k <= 4000; k++) {
          const y = polyValue(inst.coefs, inst.a + ((inst.b - inst.a) * k) / 4000);
          hi = Math.max(hi, y);
          lo = Math.min(lo, y);
        }
        // En la malla, nunca por encima del máximo ni por debajo del mínimo, y casi en ellos.
        expect(e.max.y).toBeGreaterThanOrEqual(hi - 1e-9);
        expect(e.max.y - hi).toBeLessThan(0.01);
        expect(e.min.y).toBeLessThanOrEqual(lo + 1e-9);
        expect(lo - e.min.y).toBeLessThan(0.01);
        expect(inst.coefs.every(Number.isInteger)).toBe(true);
      }
  });

  it("olvidar los extremos del intervalo se rechaza con su explicación", () => {
    for (const s of SEEDS) {
      const inst = CALC_ABS_EXTREMES.generate(s, "medio");
      const g = extremesGuided(inst);
      const e = extremesOf(inst);
      const crit = e.vals.filter((v) => e.inside.includes(v.x));
      const localMax = crit.reduce((m, v) => (v.y > m.y ? v : m));
      if (localMax.x === e.max.x) continue;
      const r = checkStep(g.steps[1]!, { kind: "numbers", cells: [[String(localMax.x), String(localMax.y)]] });
      expect(r.ok).toBe(false);
      expect(r.text).toMatch(/extremos del intervalo/);
      return;
    }
    throw new Error("ninguna semilla con el máximo en un extremo");
  });
});
