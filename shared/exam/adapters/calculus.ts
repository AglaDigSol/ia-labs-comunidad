// Adaptadores de cálculo: límites y continuidad, derivadas y regla de la cadena, integrales, puntos
// críticos y descenso de gradiente.
import { criticalPoints1D, CRITICAL_1D_LABEL } from "../../calculus/basins.ts";
import { bisectionInterval, bisectionIterations, bisectionLength } from "../../calculus/bisection.ts";
import { boundTex, boundText, closedTex, closedText, closedValue, partsChoice, partsIntegrand } from "../../calculus/byparts.ts";
import { CRITICAL_LABEL, criticalPoints, type CriticalKind } from "../../calculus/critical.ts";
import { derivative } from "../../calculus/derive.ts";
import { exactDescentSteps } from "../../calculus/descent.ts";
import { evaluate, toSpoken, toTex, type Expr } from "../../calculus/expr.ts";
import { definiteIntegral } from "../../calculus/integrals.ts";
import { formatDecimal, frac, type Frac } from "../../rational.ts";
import { seedFromKey, type ChoiceOption } from "../../exercises/choice.ts";
import {
  alphaFrac,
  basinQuestion,
  bisectionOf,
  CALC_BASIN,
  CALC_BISECTION,
  CALC_CHAIN,
  CALC_CRITICAL,
  CALC_CRITICAL_CHOICE,
  CALC_DEFINITE,
  CALC_DESCENT,
  CALC_DOMAIN,
  CALC_GRADIENT,
  CALC_LHOPITAL,
  CALC_PARTS,
  CALC_PIECEWISE,
  CALC_TANGENT,
  calcExpr,
  calcNumber,
  chainAnswer,
  criticalAskText,
  criticalChoiceQuestion,
  curveTex,
  domainQuestion,
  lhopitalOf,
  niceTex,
  niceText,
  partsIntegral,
  partsQuestion,
  PIECEWISE_ASK,
  piecewiseQuestion,
  type CalcChainInstance,
  type CalcPiecewiseInstance,
} from "../../exercises/calculus.ts";
import { examAdapter, type ExamAdapter, type ExamDraft } from "../adapter.ts";
import { examList, examMath, examP, examTex } from "../blocks.ts";
import { niceFrac, type ExamExpected } from "../numeric.ts";
import type { ExamBlock, ExamNumericFormat } from "../types.ts";

const opt = (id: string, text: string, correct: boolean, why?: string, tex?: string): ChoiceOption => ({ id, text, correct, ...(tex ? { tex } : {}), ...(why ? { why } : {}) });

/** f(x) = … destacada. */
const fnBlock = (e: Expr, lhs = "f(x)"): ExamBlock => examMath(`${lhs} = ${toTex(e)}`, `${lhs} igual a ${toSpoken(e)}`);

/** Valor esperado y formato de un número real: entero si lo es, si no redondeado a dos decimales. */
function numericOf(v: number): { expected: ExamExpected; format: ExamNumericFormat } {
  const f = niceFrac(v, 1000);
  if (f) return { expected: f, format: f.d === 1n ? "entero" : "dos-decimales" };
  return { expected: v, format: "dos-decimales" };
}

/** «3/4 ≈ 0,75», «7», «1,7183». */
const approxText = (v: number) => {
  const t = niceText(v);
  if (Number.isInteger(v)) return t;
  const d = String(Number(v.toFixed(4))).replace(".", ",").replace("-", "−");
  return t === d ? t : `${t} ≈ ${d}`;
};

// ---------------------------------------------------------------- Límites y continuidad

function piecewiseTex(inst: CalcPiecewiseInstance): { tex: string; label: string } {
  const L = calcExpr(inst.left);
  const R = calcExpr(inst.right);
  const a = niceTex(inst.a);
  const A = niceText(inst.a);
  const separate = inst.at !== "izquierda" && inst.at !== "derecha";
  if (separate && inst.left === inst.right) {
    return {
      tex: `f(x) = \\begin{cases} ${toTex(L)} & \\text{si } x \\neq ${a} \\\\ ${toTex(calcExpr(inst.at))} & \\text{si } x = ${a} \\end{cases}`,
      label: `f de x igual a ${toSpoken(L)} si x distinto de ${A}, y ${inst.at} si x igual a ${A}`,
    };
  }
  const lt = inst.at === "izquierda" ? "\\le" : "<";
  const gt = inst.at === "derecha" ? "\\ge" : ">";
  const mid = separate ? ` \\\\ ${toTex(calcExpr(inst.at))} & \\text{si } x = ${a}` : "";
  return {
    tex: `f(x) = \\begin{cases} ${toTex(L)} & \\text{si } x ${lt} ${a}${mid} \\\\ ${toTex(R)} & \\text{si } x ${gt} ${a} \\end{cases}`,
    label: `f de x igual a ${toSpoken(L)} si x ${inst.at === "izquierda" ? "menor o igual que" : "menor que"} ${A}${separate ? `; ${inst.at} si x igual a ${A}` : ""}; y ${toSpoken(R)} si x ${inst.at === "derecha" ? "mayor o igual que" : "mayor que"} ${A}`,
  };
}

const piecewiseAdapter = examAdapter({
  type: CALC_PIECEWISE,
  levels: ["básico", "medio"],
  ask: "Límites laterales, continuidad y derivabilidad de una función a trozos (opción múltiple).",
  build(inst) {
    if (inst.ask === "varias") return null;
    const t = piecewiseTex(inst);
    return {
      kind: "choice",
      stem: [examP("Sea la función"), examMath(t.tex, t.label)],
      prompt: PIECEWISE_ASK[inst.ask],
      question: piecewiseQuestion(inst),
      solution: [examP("Límites laterales con la fórmula de cada lado; continua si existe el límite y vale f(a); derivable si además coinciden las derivadas laterales.")],
    };
  },
});

const lhopitalAdapter = examAdapter({
  type: CALC_LHOPITAL,
  ask: "Límite con la regla de L'Hôpital (numérica).",
  build(inst) {
    const r = lhopitalOf(inst);
    if (!r || r.result.kind !== "finito") return null;
    const num = calcExpr(inst.num);
    const den = calcExpr(inst.den);
    const at = inst.at === "+inf" ? "+\\infty" : niceTex(inst.at);
    const lim = `\\lim_{x\\to ${at}}`;
    const value = r.result.value;
    return {
      kind: "numeric",
      stem: [examP("Calcula el límite"), examMath(`${lim} \\frac{${toTex(num)}}{${toTex(den)}}`, `límite cuando x tiende a ${inst.at === "+inf" ? "más infinito" : niceText(inst.at)} de ${toSpoken(num)} entre ${toSpoken(den)}`)],
      prompt: "¿Cuánto vale el límite?",
      ...numericOf(value),
      label: "Límite",
      solution: [
        examP(`Sale ${r.steps[0]!.form ?? "una indeterminación"}: se derivan numerador y denominador por separado${r.steps.length > 2 ? " (varias veces)" : ""}.`),
        ...r.steps.map((s) => examMath(`${lim} \\frac{${toTex(s.num)}}{${toTex(s.den)}}`, `${toSpoken(s.num)} entre ${toSpoken(s.den)}`)),
        examP(`El límite vale ${approxText(value)}.`),
      ],
    };
  },
});

const domainAdapter = examAdapter({
  type: CALC_DOMAIN,
  levels: ["básico", "medio"],
  ask: "Dominio de una función con raíces, logaritmos y cocientes (opción múltiple).",
  build(inst) {
    if (inst.none) return null;
    return {
      kind: "choice",
      stem: [examP("Sea"), fnBlock(calcExpr(inst.f))],
      prompt: "¿Cuál es el dominio de f?",
      question: domainQuestion(inst),
      solution: [examP("√u pide u ≥ 0; ln u pide u > 0; un cociente, denominador ≠ 0. El dominio cumple todas las condiciones a la vez.")],
    };
  },
});

const bisectionAdapter = examAdapter({
  type: CALC_BISECTION,
  ask: "Método de bisección: longitud, intervalo final o iteraciones necesarias.",
  build(inst): ExamDraft | null {
    const f = calcExpr(inst.f);
    const ab = `[${niceText(inst.a)}, ${niceText(inst.b)}]`;
    const stem = [fnBlock(f)];
    if (inst.ask === "iteraciones") {
      const k = bisectionIterations(inst.a, inst.b, inst.eps);
      return {
        kind: "numeric",
        stem,
        prompt: `Con el método de bisección en ${ab}, ¿cuántas iteraciones hacen falta como mínimo para que el intervalo mida menos de ε = ${String(inst.eps).replace(".", ",")}?`,
        expected: BigInt(k),
        format: "entero",
        label: "Iteraciones",
        solution: [examP(`(b − a)/2ᵏ < ε: con k = ${k - 1} mide ${niceText(bisectionLength(inst.a, inst.b, k - 1))}; con k = ${k}, ${niceText(bisectionLength(inst.a, inst.b, k))}.`)],
      };
    }
    if (inst.ask === "longitud") {
      const len = bisectionLength(inst.a, inst.b, inst.k);
      return {
        kind: "numeric",
        stem,
        prompt: `Se aplica el método de bisección a f en ${ab}. ¿Cuánto mide el intervalo tras ${inst.k} iteraciones?`,
        ...numericOf(len),
        label: "Longitud",
        solution: [examP(`Cada iteración parte el intervalo por la mitad: (b − a)/2^${inst.k} = ${niceText(inst.b - inst.a)}/${2 ** inst.k} = ${approxText(len)}.`)],
      };
    }
    const steps = bisectionOf(inst, inst.k);
    const more = bisectionOf(inst, inst.k + 1);
    if (!steps || !more) return null;
    const [lo, hi] = bisectionInterval(steps);
    const last = steps[steps.length - 1]!;
    const other: [number, number] = last.keep === "izquierda" ? [last.m, last.b] : [last.a, last.m];
    const cands: Array<[number, number]> = [[lo, hi], other, [last.a, last.b], bisectionInterval(more)];
    const keys = new Set(cands.map((c) => c.join()));
    if (keys.size !== 4) return null;
    const iv = (c: [number, number]) => ({ text: `[${niceText(c[0])}, ${niceText(c[1])}]`, tex: `[${niceTex(c[0])},\\ ${niceTex(c[1])}]` });
    return {
      kind: "choice",
      stem,
      prompt: `Tras ${inst.k} iteraciones del método de bisección en ${ab}, ¿en qué intervalo queda la raíz?`,
      question: { mode: "single", options: cands.map((c, i) => opt(`i${i}`, iv(c).text, i === 0, i === 0 ? "Es el intervalo tras la última iteración." : i === 1 ? "Es la otra mitad: ahí f no cambia de signo." : i === 2 ? "Es el intervalo antes de la última iteración." : "Es una iteración de más.", iv(c).tex)) },
      solution: [examList(steps.map((s, i) => [`k = ${i + 1}: m = ${niceText(s.m)}, f(m) ${s.fm > 0 ? "> 0" : "< 0"}; queda ${s.keep === "izquierda" ? `[${niceText(s.a)}, ${niceText(s.m)}]` : `[${niceText(s.m)}, ${niceText(s.b)}]`}`]))],
    };
  },
});

// ---------------------------------------------------------------- Derivadas

const vecTex = (v: readonly number[]) => `(${v.map(niceTex).join(",\\ ")})`;
const vecText = (v: readonly number[]) => `(${v.map(niceText).join(", ")})`;

function chainStem(inst: CalcChainInstance): ExamBlock[] {
  const h = inst.outer;
  const c = h === "f" ? "g" : "f";
  if (inst.kind === "jacobiana") {
    const m = inst.map.map((t) => calcExpr(t, ["x", "y"]));
    return [
      examP(`Sean ${c}: ℝ² → ℝ² y ${h}: ℝ² → ℝ diferenciables, con`),
      examMath(`${c}(x, y) = \\left(${toTex(m[0]!)},\\ ${toTex(m[1]!)}\\right)`, `${c} de x, y igual a ${toSpoken(m[0]!)} coma ${toSpoken(m[1]!)}`),
      examMath(`\\nabla ${h}\\big(${c}${vecTex(inst.p)}\\big) = ${vecTex(inst.grad)}`, `gradiente de ${h} en ${c} de ${vecText(inst.p)} igual a ${vecText(inst.grad)}`),
      examP(
        "Calcula ",
        examTex(`\\frac{\\partial (${h}\\circ ${c})}{\\partial x} + \\frac{\\partial (${h}\\circ ${c})}{\\partial y}`, `la suma de las dos parciales de ${h} compuesta con ${c}`),
        ` en el punto ${vecText(inst.p)}.`,
      ),
    ];
  }
  const t0 = niceTex(inst.t0);
  const out: ExamBlock[] = [examP(`Sean ${c}: ℝ → ℝ² y ${h}: ℝ² → ℝ diferenciables, con:`)];
  if (inst.curve) out.push(examMath(`${c}(t) = \\left(${curveTex(inst.curve[0])},\\ ${curveTex(inst.curve[1])}\\right)`, `${c} de t igual a ${inst.curve[0]} coma ${inst.curve[1]}`));
  else out.push(examMath(`${c}(${t0}) = ${vecTex(inst.point)},\\quad ${c}'(${t0}) = ${vecTex(inst.velocity)}`, `${c} de ${inst.t0} igual a ${vecText(inst.point)}; ${c} prima de ${inst.t0} igual a ${vecText(inst.velocity)}`));
  if (inst.h) out.push(fnBlock(calcExpr(inst.h, ["x", "y"]), `${h}(x, y)`));
  else {
    const data = [{ at: inst.point, g: inst.grad! }, ...(inst.decoy ? [{ at: inst.decoy.at, g: inst.decoy.grad }] : [])].sort((a, b) => a.at[0] - b.at[0] || a.at[1] - b.at[1]);
    out.push(
      examList(
        data.map((d) => [
          examTex(
            `\\frac{\\partial ${h}}{\\partial x}${vecTex(d.at)} = ${niceTex(d.g[0])},\\quad \\frac{\\partial ${h}}{\\partial y}${vecTex(d.at)} = ${niceTex(d.g[1])}`,
            `parcial de ${h} respecto de x en ${vecText(d.at)} igual a ${niceText(d.g[0])}; respecto de y, ${niceText(d.g[1])}`,
          ),
        ]),
      ),
    );
  }
  out.push(examP("Calcula ", examTex(`[${h}\\circ ${c}]'(${t0})`, `la derivada de ${h} compuesta con ${c} en ${inst.t0}`), "."));
  return out;
}

const chainAdapter = examAdapter({
  type: CALC_CHAIN,
  ask: "Regla de la cadena en varias variables (numérica, entero).",
  build(inst) {
    const v = chainAnswer(inst);
    const h = inst.outer;
    const c = h === "f" ? "g" : "f";
    return {
      kind: "numeric",
      stem: chainStem(inst),
      prompt: "¿Cuánto vale?",
      expected: BigInt(Math.round(v)),
      format: "entero",
      label: "Resultado",
      solution: [
        examP(
          inst.kind === "jacobiana"
            ? `∇(${h}∘${c})(p) = ∇${h}(${c}(p))·J${c}(p): el gradiente por la matriz jacobiana de ${c} en p = ${vecText(inst.p)}; la suma de las dos componentes da ${niceText(v)}.`
            : `[${h}∘${c}]′(t₀) = ∇${h}(${c}(t₀))·${c}′(t₀), con ${c}(t₀) = ${vecText(inst.point)} y ${c}′(t₀) = ${vecText(inst.velocity)}: ${niceText(v)}.`,
        ),
      ],
    };
  },
});

const gradientAdapter = examAdapter({
  type: CALC_GRADIENT,
  ask: "Una derivada parcial en un punto (numérica).",
  build(inst) {
    const e = calcExpr(inst.f, ["x", "y"]);
    const at = { x: inst.point[0], y: inst.point[1] };
    const v = seedFromKey(JSON.stringify(inst)) % 2 === 0 ? "x" : "y";
    const d = derivative(e, v);
    const value = evaluate(d, at);
    return {
      kind: "numeric",
      stem: [examP("Sea"), fnBlock(e, "f(x, y)")],
      prompt: `Calcula ∂f/∂${v} en el punto ${vecText(inst.point)}.`,
      ...numericOf(value),
      label: `∂f/∂${v}`,
      solution: [examMath(`\\frac{\\partial f}{\\partial ${v}} = ${toTex(d)}`, `derivada parcial respecto de ${v}: ${toSpoken(d)}`), examP(`En ${vecText(inst.point)} vale ${approxText(value)}.`)],
    };
  },
});

const tangentAdapter = examAdapter({
  type: CALC_TANGENT,
  ask: "Pendiente u ordenada en el origen de la recta tangente (numérica).",
  build(inst) {
    const e = calcExpr(inst.f);
    const y0 = evaluate(e, { x: inst.x0 });
    const m = evaluate(derivative(e), { x: inst.x0 });
    const n = y0 - m * inst.x0;
    const askSlope = seedFromKey(JSON.stringify(inst)) % 2 === 0;
    const value = askSlope ? m : n;
    return {
      kind: "numeric",
      stem: [examP("Sea"), fnBlock(e), examP(`y sea y = mx + n la recta tangente a la gráfica de f en x₀ = ${niceText(inst.x0)}.`)],
      prompt: askSlope ? "¿Cuánto vale la pendiente m?" : "¿Cuánto vale la ordenada en el origen n?",
      ...numericOf(value),
      label: askSlope ? "m" : "n",
      solution: [examP(`f(x₀) = ${niceText(y0)} y m = f′(x₀) = ${niceText(m)}. La tangente es y = f(x₀) + f′(x₀)(x − x₀), así que n = f(x₀) − m·x₀ = ${niceText(n)}.`)],
    };
  },
});

// ---------------------------------------------------------------- Integrales

const boundOf = (text: string) => {
  const e = calcExpr(text);
  return { tex: toTex(e), text: toSpoken(e) };
};

const definiteAdapter = examAdapter({
  type: CALC_DEFINITE,
  ask: "Integral definida por la regla de Barrow (numérica, dos decimales).",
  build(inst) {
    const f = calcExpr(inst.f);
    const v = definiteIntegral(f, calcNumber(inst.a), calcNumber(inst.b));
    const a = boundOf(inst.a);
    const b = boundOf(inst.b);
    return {
      kind: "numeric",
      stem: [examP("Calcula"), examMath(`\\int_{${a.tex}}^{${b.tex}} ${toTex(f)}\\, dx`, `integral entre ${a.text} y ${b.text} de ${toSpoken(f)}`)],
      prompt: "¿Cuánto vale la integral?",
      expected: niceFrac(v, 1000) ?? v,
      format: "dos-decimales",
      label: "Integral",
      solution: [examP(`Se busca una primitiva F y se aplica la regla de Barrow, F(${inst.b}) − F(${inst.a}): ${approxText(v)}.`)],
    };
  },
});

const partsAdapter = examAdapter({
  type: CALC_PARTS,
  ask: "Integral definida por partes (opción múltiple con la forma cerrada, o numérica con dos decimales).",
  build(inst): ExamDraft {
    const integrand = calcExpr(partsIntegrand(inst.fam, inst.k, inst.a));
    const cf = partsIntegral(inst);
    const choice = partsChoice(inst.fam, inst.a);
    const tex = `\\int_{${boundTex(inst.lo)}}^{${boundTex(inst.hi)}} ${toTex(integrand)}\\, dx`;
    const stem = [examP("Calcula"), examMath(tex, `integral entre ${boundText(inst.lo)} y ${boundText(inst.hi)} de ${toSpoken(integrand)}`)];
    const solution = [
      examP(`Por partes, con u = ${choice.u} y dv = ${choice.dv} (du = ${choice.du}, v = ${choice.v}):`),
      examMath(`${tex} = ${closedTex(cf)} \\approx ${niceTex(Number(closedValue(cf).toFixed(4)))}`, `la integral vale ${closedText(cf)}`),
    ];
    if (inst.answer === "opciones") return { kind: "choice", stem, prompt: "¿Cuánto vale la integral?", question: partsQuestion(inst), solution };
    return { kind: "numeric", stem, prompt: "¿Cuánto vale la integral?", expected: closedValue(cf), format: "dos-decimales", label: "Integral", solution };
  },
});

// ---------------------------------------------------------------- Puntos críticos

const criticalChoiceAdapter = examAdapter({
  type: CALC_CRITICAL_CHOICE,
  ask: "Cuál de cuatro puntos es un punto crítico del tipo pedido (opción múltiple).",
  build(inst) {
    return {
      kind: "choice",
      stem: [examP("Sea"), fnBlock(calcExpr(inst.f, ["x", "y"]), "f(x, y)")],
      prompt: criticalAskText(inst),
      question: criticalChoiceQuestion(inst),
      solution: [examP("Punto crítico: ∂f/∂x = ∂f/∂y = 0. Hessiana: |H| > 0 y f_xx > 0, mínimo; |H| > 0 y f_xx < 0, máximo; |H| < 0, silla.")],
    };
  },
});

const KIND_WORDS: Record<Exclude<CriticalKind, "no-concluyente">, [string, string]> = {
  minimo: ["mínimo local", "mínimos locales"],
  maximo: ["máximo local", "máximos locales"],
  silla: ["punto de silla", "puntos de silla"],
};
const NUM_WORDS = ["ningún", "un", "dos", "tres", "cuatro"];
type KindCount = Record<Exclude<CriticalKind, "no-concluyente">, number>;
function countText(c: KindCount): string {
  const parts = (["minimo", "maximo", "silla"] as const).filter((k) => c[k] > 0).map((k) => `${NUM_WORDS[c[k]]} ${KIND_WORDS[k][c[k] === 1 ? 0 : 1]}`);
  const s = parts.length === 0 ? "ningún punto crítico" : parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}`;
  return `${s[0]!.toUpperCase()}${s.slice(1)}`;
}

const criticalAdapter = examAdapter({
  type: CALC_CRITICAL,
  ask: "Cuántos puntos críticos hay y de qué tipo (opción múltiple).",
  build(inst) {
    const f = calcExpr(inst.f, ["x", "y"]);
    const r = criticalPoints(f);
    if (!r.ok || r.points.some((p) => p.kind === "no-concluyente")) return null;
    const right: KindCount = { minimo: 0, maximo: 0, silla: 0 };
    for (const p of r.points) right[p.kind as keyof KindCount]++;
    const total = r.points.length;
    // Distractores: el mismo número de puntos con otros tipos, uno más o uno menos.
    const all: KindCount[] = [];
    for (let a = 0; a <= 3; a++) for (let b = 0; b <= 3 - a; b++) for (let c = 0; c <= 3 - a - b; c++) if (a + b + c >= 1) all.push({ minimo: a, maximo: b, silla: c });
    const key = (c: KindCount) => `${c.minimo}${c.maximo}${c.silla}`;
    const dist = (c: KindCount) => Math.abs(c.minimo - right.minimo) + Math.abs(c.maximo - right.maximo) + Math.abs(c.silla - right.silla) + (c.minimo + c.maximo + c.silla === total ? 0 : 0.5);
    const seed = seedFromKey(inst.f);
    const wrong = all
      .filter((c) => key(c) !== key(right))
      .sort((x, y) => dist(x) - dist(y) || ((seedFromKey(key(x)) ^ seed) >>> 0) - ((seedFromKey(key(y)) ^ seed) >>> 0))
      .slice(0, 3);
    return {
      kind: "choice",
      stem: [examP("Sea"), fnBlock(f, "f(x, y)")],
      prompt: "¿Cuántos puntos críticos tiene f y de qué tipo son?",
      question: { mode: "single", options: [opt("ok", countText(right), true), ...wrong.map((c, i) => opt(`w${i}`, countText(c), false))] },
      solution: [
        examP("Se resuelve ∇f = 0 y se clasifica cada punto con la hessiana:"),
        examList(r.points.map((p) => [`(${niceText(Number(p.x.n) / Number(p.x.d))}, ${niceText(Number(p.y.n) / Number(p.y.d))}): ${CRITICAL_LABEL[p.kind].toLowerCase()}`])),
      ],
    };
  },
});

// ---------------------------------------------------------------- Descenso de gradiente

const basinAdapter = examAdapter({
  type: CALC_BASIN,
  ask: "Adónde converge el descenso de gradiente o qué puntos de partida llevan a un mínimo (opción múltiple).",
  build(inst) {
    const f = calcExpr(inst.f);
    const crit = criticalPoints1D(f) ?? [];
    return {
      kind: "choice",
      stem: [examP("Sea"), fnBlock(f)],
      prompt:
        inst.ask === "destino"
          ? `Con una tasa de aprendizaje α pequeña, ¿adónde lleva el descenso de gradiente empezando en x₀ = ${niceText(inst.x0)}?`
          : `Con una tasa de aprendizaje α pequeña, ¿para qué puntos de partida x₀ converge el descenso de gradiente a x = ${niceText(inst.target)}?`,
      question: basinQuestion(inst),
      solution: [
        examP("Puntos críticos de f (f′ = 0):"),
        examList(crit.map((c) => [`x = ${niceText(Number(c.x.n) / Number(c.x.d))}: ${CRITICAL_1D_LABEL[c.kind]}`])),
        examP("Cada paso va cuesta abajo (x ← x − α·f′(x)) y, con α pequeño, se para en el fondo del valle donde empieza."),
      ],
    };
  },
});

const fracDec = (x: Frac) => formatDecimal(x, 6).text;

const descentAdapter = examAdapter({
  type: CALC_DESCENT,
  ask: "Una iteración del descenso de gradiente hecha a mano (numérica, valor exacto).",
  build(inst) {
    const two = inst.start.length === 2;
    const vars = two ? (["x", "y"] as const) : (["x"] as const);
    const f = calcExpr(inst.f, [...vars]);
    const steps = exactDescentSteps(f, inst.start.map((s) => frac(BigInt(s))), alphaFrac(inst.alpha), inst.steps);
    if (!steps) return null;
    const last = steps[inst.steps]!;
    const value = last[0]!;
    const alpha = String(inst.alpha).replace(".", ",");
    const x0 = two ? `(${inst.start.join(", ")})` : String(inst.start[0]);
    return {
      kind: "numeric",
      stem: [examP("Sea"), fnBlock(f, two ? "f(x, y)" : "f(x)"), examP(`Se aplica el descenso de gradiente xₖ₊₁ = xₖ − α·∇f(xₖ) con α = ${alpha}, empezando en x₀ = ${x0}.`.replace(/-/g, "−"))],
      prompt: two ? `¿Cuánto vale la primera coordenada de x${inst.steps === 2 ? "₂" : "₁"}?` : `¿Cuánto vale x${inst.steps === 2 ? "₂" : "₁"}?`,
      expected: value,
      format: "dos-decimales",
      label: two ? "Primera coordenada" : `x${inst.steps === 2 ? "₂" : "₁"}`,
      solution: [examList(steps.map((s, k) => [`x${["₀", "₁", "₂", "₃"][k]} = ${two ? `(${s.map(fracDec).join("; ")})` : fracDec(s[0]!)}`]))],
    };
  },
});

export const CALC_EXAM_ADAPTERS: readonly ExamAdapter[] = [
  piecewiseAdapter,
  lhopitalAdapter,
  domainAdapter,
  bisectionAdapter,
  chainAdapter,
  gradientAdapter,
  tangentAdapter,
  definiteAdapter,
  partsAdapter,
  criticalChoiceAdapter,
  criticalAdapter,
  basinAdapter,
  descentAdapter,
];
