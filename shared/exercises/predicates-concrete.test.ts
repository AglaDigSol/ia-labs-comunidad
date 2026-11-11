// «Cuantificadores en un conjunto concreto»: barrido de semillas en los tres niveles. El valor de
// verdad se comprueba con el motor de predicados (shared/predicates, con cada propiedad como la
// extensión de un predicado en A), los testigos uno a uno, la negación por fuerza bruta en los
// subconjuntos de A y en conjuntos al azar, y las pistas no dicen ni el valor ni el testigo.
import { describe, expect, it } from "vitest";
import type { PredFormula } from "../predicates/ast.ts";
import { evaluatePred } from "../predicates/evaluate.ts";
import { examItem, examLevels } from "../exam/items.ts";
import { createRng } from "./random.ts";
import { exercisesOfTopic, exerciseType } from "./registry.ts";
import {
  askedStatement,
  bodyHolds,
  checkWitness,
  concreteHints,
  conclusion,
  correctNegation,
  explainElement,
  isNegation,
  isNegationOn,
  needsWitness,
  negationDistractors,
  negationMistakeOf,
  negationMistakeText,
  nomenclature,
  parseWitness,
  PRED_CONCRETE,
  propHolds,
  RANDOM_SETS,
  statementText,
  subsetsOf,
  truthIn,
  validWitnesses,
  type Body,
  type ConcreteStatement,
  type PredConcreteInstance,
  type Prop,
  type SimpleStatement,
} from "./predicates-concrete.ts";
import { EXERCISE_LEVELS } from "./types.ts";

const SEEDS = Array.from({ length: 200 }, (_, i) => (i * 2654435761 + 7) >>> 0);
const ALL = EXERCISE_LEVELS.flatMap((level) => SEEDS.map((seed) => ({ level, seed, inst: PRED_CONCRETE.generate(seed, level) })));

// ---------------------------------------------------------------- Fuerza bruta independiente

/** El enunciado como fórmula del motor de predicados: cada propiedad es un predicado P0, P1… y la relación, R. */
function toPred(s: ConcreteStatement, set: readonly number[]): { formula: PredFormula; preds: Record<string, string[][]> } {
  const preds: Record<string, string[][]> = {};
  const names = new Map<string, string>();
  const name = (p: Prop) => {
    const key = JSON.stringify(p);
    if (!names.has(key)) {
      const n = `P${names.size}`;
      names.set(key, n);
      preds[n] = set.filter((x) => propHolds(p, x)).map((x) => [String(x)]);
    }
    return names.get(key)!;
  };
  const body = (b: Body): PredFormula => {
    if (b.kind === "atom") return { kind: "pred", name: name(b.prop), args: [{ name: "x" }] };
    if (b.kind === "not") return { kind: "not", arg: body(b.arg) };
    return { kind: b.kind, left: body(b.left), right: body(b.right) };
  };
  if (s.kind === "simple") return { formula: { kind: s.q, variable: "x", body: body(s.body) }, preds };
  const rel: Record<string, (x: number, y: number) => boolean> = { gt: (x, y) => y > x, lt: (x, y) => y < x, le: (x, y) => x <= y, ge: (x, y) => x >= y, ne: (x, y) => x !== y, opp: (x, y) => x + y === 0 };
  preds.R = set.flatMap((x) => set.filter((y) => rel[s.rel]!(x, y)).map((y) => [String(x), String(y)]));
  const R: PredFormula = { kind: "pred", name: "R", args: [{ name: "x" }, { name: "y" }] };
  return { formula: { kind: s.outer, variable: "x", body: { kind: s.inner, variable: "y", body: R } }, preds };
}
const engineTruth = (s: ConcreteStatement, set: readonly number[]) => {
  const { formula, preds } = toPred(s, set);
  return evaluatePred(formula, { domain: set.map(String), predicates: preds });
};

const isPrimeRef = (n: number) => n > 1 && Array.from({ length: n - 2 }, (_, i) => i + 2).every((d) => n % d !== 0);

describe("propiedades", () => {
  it("primo, par, impar, múltiplo, divisor, cuadrado, positivo, mayor y menor, también con 0 y negativos", () => {
    for (let n = -12; n <= 30; n++) {
      expect(propHolds({ kind: "primo" }, n)).toBe(isPrimeRef(n));
      expect(propHolds({ kind: "par" }, n)).toBe(Math.abs(n) % 2 === 0);
      expect(propHolds({ kind: "impar" }, n)).toBe(Math.abs(n) % 2 === 1);
      expect(propHolds({ kind: "multiplo", k: 3 }, n)).toBe(Math.abs(n) % 3 === 0);
      expect(propHolds({ kind: "divisor", k: 12 }, n)).toBe(n !== 0 && 12 % Math.abs(n) === 0);
      expect(propHolds({ kind: "cuadrado" }, n)).toBe([0, 1, 4, 9, 16, 25].includes(n));
      expect(propHolds({ kind: "positivo" }, n)).toBe(n > 0);
      expect(propHolds({ kind: "mayor", k: -2 }, n)).toBe(n > -2);
      expect(propHolds({ kind: "menor", k: 5 }, n)).toBe(n < 5);
    }
  });

  it("el ejemplo del enunciado: ∃x ∈ {2, 3, 4, 5} : primo(x) ∧ par(x) es verdadero con x = 2", () => {
    const s: SimpleStatement = { kind: "simple", q: "exists", body: { kind: "and", left: { kind: "atom", prop: { kind: "primo" } }, right: { kind: "atom", prop: { kind: "par" } } } };
    const A = [2, 3, 4, 5];
    expect(statementText(s)).toBe("∃x ∈ A : (primo(x) ∧ par(x))");
    expect(truthIn(s, A)).toBe(true);
    expect(validWitnesses(s, A)).toEqual([2]);
    expect(checkWitness(s, A, "2").ok).toBe(true);
    expect(checkWitness(s, A, "3")).toEqual({ ok: false, message: "3 es primo pero no es par, así que no cumple primo(x) ∧ par(x). No sirve de testigo." });
    expect(checkWitness(s, A, "8").message).toMatch(/no está en A/);
    expect(explainElement(s.body, 4)).toBe("4 no es primo pero es par, así que no cumple primo(x) ∧ par(x).");
  });

  it("De Morgan generalizado: ¬[∀x (par(x) ∧ positivo(x))] ≡ ∃x (¬par(x) ∨ ¬positivo(x))", () => {
    const s: SimpleStatement = { kind: "simple", q: "forall", body: { kind: "and", left: { kind: "atom", prop: { kind: "par" } }, right: { kind: "atom", prop: { kind: "positivo" } } } };
    expect(statementText(correctNegation(s))).toBe("∃x ∈ A : (¬par(x) ∨ ¬positivo(x))");
    expect(negationDistractors(s).map((d) => statementText(d.statement))).toEqual(["∀x ∈ A, (¬par(x) ∨ ¬positivo(x))", "∃x ∈ A : (¬par(x) ∧ ¬positivo(x))", "∃x ∈ A : (par(x) ∧ positivo(x))"]);
    const imp: SimpleStatement = { kind: "simple", q: "forall", body: { kind: "imp", left: { kind: "atom", prop: { kind: "primo" } }, right: { kind: "atom", prop: { kind: "impar" } } } };
    expect(statementText(correctNegation(imp))).toBe("∃x ∈ A : (primo(x) ∧ ¬impar(x))");
    expect(nomenclature(s)).toEqual(["par(x): x es par", "positivo(x): x > 0"]);
  });

  it("lee testigos con el menos de teclado o el tipográfico", () => {
    expect(parseWitness(" 3 ")).toBe(3);
    expect(parseWitness("-4")).toBe(-4);
    expect(parseWitness("−4")).toBe(-4);
    expect(parseWitness("3,5")).toBeNull();
    expect(parseWitness("x")).toBeNull();
  });
});

describe("generador", () => {
  it("está en el banco, en Lógica de predicados, antes de los tipos de examen", () => {
    expect(exerciseType("predicados-conjunto-concreto")).toBe(PRED_CONCRETE);
    expect(exercisesOfTopic("predicados").map((t) => t.id)).toContain("predicados-conjunto-concreto");
    expect(PRED_CONCRETE.generate(5, "medio")).toEqual(PRED_CONCRETE.generate(5, "medio"));
  });

  it("enunciados bien formados y del tamaño de cada nivel", () => {
    const SIZE = { básico: [4, 4], medio: [5, 6], avanzado: [7, 8] } as const;
    let negatives = 0;
    let nested = 0;
    let negar = 0;
    for (const { level, inst } of ALL) {
      const [a, b] = SIZE[level];
      expect(inst.set.length).toBeGreaterThanOrEqual(a);
      expect(inst.set.length).toBeLessThanOrEqual(b);
      expect([...inst.set].sort((x, y) => x - y)).toEqual(inst.set);
      expect(new Set(inst.set).size).toBe(inst.set.length);
      if (level === "básico") expect(inst.set.every((x) => x >= 1)).toBe(true);
      if (inst.set.some((x) => x <= 0)) negatives++;
      if (inst.mode === "negar") negar++;
      const s = inst.statement;
      if (s.kind === "nested") {
        nested++;
        expect(level).toBe("avanzado");
        expect(inst.mode).toBe("evaluar");
        expect(statementText(s)).toMatch(/^[∀∃]x ∈ A(, | : )[∀∃]y ∈ A(, | : )/);
        continue;
      }
      const text = statementText(s);
      expect(text).toMatch(/^(∀x ∈ A, |∃x ∈ A : )/);
      expect(text).not.toMatch(/—|\d\.\d/);
      // Una o dos propiedades, con ¬ solo desde el nivel medio.
      const atoms = text.match(/[a-zú₀-₉]+\(x\)|x [<>] −?\d+/g) ?? [];
      expect(atoms.length).toBeGreaterThanOrEqual(1);
      expect(atoms.length).toBeLessThanOrEqual(2);
      if (level === "básico") expect(text).not.toContain("¬");
      if (inst.mode === "negar") expect(atoms).toHaveLength(2);
      // Cada propiedad con nombre tiene su línea de nomenclatura.
      for (const a of atoms.filter((x) => x.endsWith("(x)"))) expect(nomenclature(s).some((l) => l.startsWith(`${a}: x `))).toBe(true);
    }
    expect(negatives).toBeGreaterThan(100);
    expect(nested).toBeGreaterThan(20);
    expect(negar).toBeGreaterThan(ALL.length * 0.25);
    expect(negar).toBeLessThan(ALL.length * 0.55);
  });

  it("el valor de verdad (recorriendo A) coincide con el del motor de predicados, y está equilibrado", () => {
    for (const level of EXERCISE_LEVELS) {
      let yes = 0;
      for (const seed of SEEDS) {
        const inst = PRED_CONCRETE.generate(seed, level);
        const asked = askedStatement(inst);
        const value = truthIn(asked, inst.set);
        expect(engineTruth(asked, inst.set), `${level} ${seed}`).toBe(value);
        expect(engineTruth(inst.statement, inst.set)).toBe(inst.mode === "evaluar" ? value : !value);
        if (value) yes++;
      }
      expect(yes / SEEDS.length).toBeGreaterThan(0.38);
      expect(yes / SEEDS.length).toBeLessThan(0.62);
    }
  });

  it("los testigos y contraejemplos: vale cualquier elemento que sirva y ninguno más", () => {
    let asked = 0;
    for (const { inst } of ALL) {
      const s = askedStatement(inst);
      const value = truthIn(s, inst.set);
      if (!needsWitness(s, value)) {
        const t: ConcreteStatement = askedStatement(inst);
        expect(t.kind === "nested" || (t.q === "exists" ? !value : value)).toBe(true);
        continue;
      }
      asked++;
      const valid = inst.set.filter((x) => bodyHolds(s.body, x) === (s.q === "exists"));
      expect(valid.length).toBeGreaterThan(0);
      expect(validWitnesses(s, inst.set)).toEqual(valid);
      for (const x of inst.set) {
        const c = checkWitness(s, inst.set, String(x).replace("-", "−"));
        expect(c.ok).toBe(valid.includes(x));
        // La explicación habla de ese elemento.
        expect(c.message.startsWith(String(x).replace("-", "−"))).toBe(true);
      }
      for (const x of [-20, 99, inst.set[0]! - 1].filter((y) => !inst.set.includes(y))) expect(checkWitness(s, inst.set, String(x)).ok).toBe(false);
      expect(checkWitness(s, inst.set, "").ok).toBe(false);
      expect(checkWitness(s, inst.set, "dos").ok).toBe(false);
    }
    expect(asked).toBeGreaterThan(ALL.length * 0.3);
  });

  it("negar: exactamente una opción equivalente (en los subconjuntos de A y en conjuntos al azar) y cada error, no equivalente", () => {
    const rng = createRng(4242);
    const extra = Array.from({ length: 200 }, () => {
      const s = new Set<number>();
      const size = rng.int(1, 7);
      while (s.size < size) s.add(rng.int(-15, 35));
      return [...s];
    });
    let n = 0;
    for (const { inst } of ALL) {
      if (inst.mode !== "negar") continue;
      n++;
      const opts = inst.options;
      expect(opts).toHaveLength(4);
      expect(new Set(opts.map(statementText)).size).toBe(4);
      const subs = subsetsOf(inst.set);
      const onSet = opts.filter((o) => isNegationOn(inst.statement, o, subs));
      expect(onSet).toHaveLength(1);
      const good = opts.filter((o) => isNegation(inst.statement, o, inst.set));
      expect(good).toEqual(onSet);
      expect(statementText(good[0]!)).toBe(statementText(correctNegation(inst.statement)));
      // La buena vale lo contrario que el enunciado en cualquier conjunto; los errores no.
      expect(isNegationOn(inst.statement, good[0]!, extra)).toBe(true);
      expect(isNegationOn(inst.statement, good[0]!, RANDOM_SETS)).toBe(true);
      for (const o of opts.filter((x) => x !== good[0])) {
        expect(isNegationOn(inst.statement, o, extra) && isNegationOn(inst.statement, o, subs)).toBe(false);
        // Es uno de los tres errores típicos, con su explicación.
        expect(negationMistakeOf(inst.statement, o)).not.toBeNull();
        expect(negationMistakeText(inst.statement, o).length).toBeGreaterThan(40);
      }
      expect(new Set(opts.map((o) => negationMistakeOf(inst.statement, o)))).toEqual(new Set([null, "cuantificador", "de-morgan", "solo-cuantificador"]));
    }
    expect(n).toBeGreaterThan(150);
  });
});

describe("pistas", () => {
  const hintsOf = (inst: PredConcreteInstance) => (inst.mode === "negar" ? [...concreteHints(inst, "negar"), ...concreteHints(inst, "evaluar")] : concreteHints(inst));

  it("nunca dicen el valor ni el testigo, ni la negación buena", () => {
    for (const { inst } of ALL) {
      const hints = hintsOf(inst);
      expect(hints.length).toBeGreaterThan(0);
      const asked = askedStatement(inst);
      const answer = conclusion(asked, inst.set);
      for (const h of hints) {
        // Ni cifras (ningún elemento de A ni testigo), ni «verdadero» o «falso».
        expect(h).not.toMatch(/\d/);
        expect(h).not.toMatch(/verdader|fals/i);
        expect(h).not.toContain(answer);
        if (inst.mode === "negar") expect(h).not.toContain(statementText(correctNegation(inst.statement)));
      }
    }
  });

  it("solo las reglas del enunciado: ∃ / ∀, De Morgan y ¬(p → q) al negar, y las propiedades que salen", () => {
    for (const { inst } of ALL) {
      const asked = askedStatement(inst);
      const text = inst.mode === "negar" ? statementText(inst.statement) : statementText(asked);
      const ev = inst.mode === "negar" ? concreteHints(inst, "evaluar") : concreteHints(inst);
      const askedText = statementText(asked);
      for (const h of ev) {
        if (/^Para un ∃ basta un ejemplo/.test(h)) expect(askedText).toMatch(/^∃x/);
        if (/^Para tumbar un ∀/.test(h)) expect(askedText).toMatch(/^∀x/);
        if (/∀x ∃y/.test(h)) expect(askedText).toMatch(/^∀x ∈ A, ∃y/);
        if (/^∃x ∀y/.test(h)) expect(askedText).toMatch(/^∃x ∈ A : ∀y/);
        if (/^p → q/.test(h)) expect(askedText).toContain("→");
        if (/^p ∧ q/.test(h)) expect(askedText).toContain("∧");
        if (/^p ∨ q/.test(h)) expect(askedText).toContain("∨");
        if (/primo/.test(h)) expect(askedText).toContain("primo(x)");
        if (/cuadrado perfecto/.test(h)) expect(askedText).toContain("cuadrado(x)");
        if (/^n es divisor/.test(h)) expect(askedText).toContain("divisor");
        if (/^n es múltiplo/.test(h)) expect(askedText).toContain("múltiplo");
        if (/^Positivo/.test(h)) expect(askedText).toContain("positivo(x)");
        expect(h).not.toMatch(/De Morgan|¬\(p → q\)/);
      }
      if (inst.mode === "negar") {
        const neg = concreteHints(inst, "negar");
        expect(neg.some((h) => h.startsWith("Al negar"))).toBe(true);
        for (const h of neg) {
          if (/∧ pasa a ∨/.test(h)) expect(text).toContain(" ∧ ");
          if (/∨ pasa a ∧/.test(h)) expect(text).toContain(" ∨ ");
          if (/^¬\(p → q\)/.test(h)) expect(text).toContain(" → ");
          if (/doble negación/.test(h)) expect(text).toContain("¬");
          // Al negar, no se dice cómo se evalúa la negación (eso sería dar su conectiva).
          expect(h).not.toMatch(/^Para un ∃|^Para tumbar|^p ∧ q|^p ∨ q|^p → q/);
        }
      }
    }
  });
});

describe("simulacro", () => {
  it("sale en el bloque de predicados, en todos los niveles, con una sola correcta que se comprueba recorriendo A", () => {
    expect(examLevels("predicados-conjunto-concreto")).toEqual(["básico", "medio", "avanzado"]);
    for (const level of EXERCISE_LEVELS) {
      for (const seed of SEEDS.slice(0, 60)) {
        const item = examItem("predicados-conjunto-concreto", seed, level);
        expect(item).not.toBeNull();
        if (item!.kind !== "choice") throw new Error("opción múltiple");
        expect(item!.options.filter((o) => o.correct)).toHaveLength(1);
        for (const o of item!.options) expect(o.why?.length ?? 0).toBeGreaterThan(20);
      }
    }
  });
});
