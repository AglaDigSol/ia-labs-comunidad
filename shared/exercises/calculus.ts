// Ejercicios de cálculo: derivadas por reglas (tres niveles), recta tangente, primitivas, integrales
// definidas, derivadas parciales y gradiente, puntos críticos con la hessiana y pasos de descenso de
// gradiente. Las funciones se generan desde plantillas con coeficientes al azar y se guardan como
// texto (lo que lee el analizador); lo que se corrige lo calcula el motor de shared/calculus al
// resolver. Los números que se piden salen cómodos: enteros o fracciones pequeñas, decimales finitos.
import { antiderivative } from "../calculus/antiderivative.ts";
import { criticalPoints } from "../calculus/critical.ts";
import { derivative, derivativeTidy } from "../calculus/derive.ts";
import { exactDescentSteps } from "../calculus/descent.ts";
import { evaluate, exprSize, type Expr, type VarName } from "../calculus/expr.ts";
import { definiteIntegral, parseNumberAnswer } from "../calculus/integrals.ts";
import { parseExpr } from "../calculus/parser.ts";
import { frac, type Frac } from "../rational.ts";
import { generateUntil, rngFor, type Rng } from "./random.ts";
import type { ExerciseLevel, ExerciseType } from "./types.ts";

const ALL_LEVELS = ["básico", "medio", "avanzado"] as const;

/** Una función escrita como en clase. */
export type CalcFnInstance = { f: string };
export type CalcTangentInstance = { f: string; x0: number };
/** Límites como texto: "0", "π", "π/2", "e". */
export type CalcIntegralInstance = { f: string; a: string; b: string };
export type CalcGradientInstance = { f: string; point: [number, number] };
export type CalcDescentInstance = { f: string; start: number[]; alpha: number; steps: number };

/** Lee una función generada (si no se lee, es un error de programación: los tests lo cubren). */
export function calcExpr(text: string, vars: readonly VarName[] = ["x"]): Expr {
  const r = parseExpr(text, { vars });
  if (!r.ok) throw new Error(`función ilegible: ${text} (${r.error.message})`);
  return r.expr;
}

/** Valor de un límite de integración o de un α escrito como texto. */
export function calcNumber(text: string): number {
  const r = parseNumberAnswer(text);
  if (!r.ok) throw new Error(`número ilegible: ${text}`);
  return r.value;
}

/** α como fracción exacta (0,1 = 1/10). */
export function alphaFrac(alpha: number): Frac {
  const s = String(alpha);
  const [int, dec = ""] = s.split(".");
  return frac(BigInt(int! + dec), 10n ** BigInt(dec.length));
}

/** ¿Número cómodo? Entero o fracción de denominador pequeño, y no muy grande. */
export function niceValue(v: number, maxDen = 12, maxAbs = 60): boolean {
  if (!Number.isFinite(v) || Math.abs(v) > maxAbs) return false;
  for (let d = 1; d <= maxDen; d++) if (Math.abs(v * d - Math.round(v * d)) < 1e-9) return true;
  return false;
}

// ---------------------------------------------------------------- Escritura de sumas

/** Coeficiente delante de algo: 1 no se escribe y −1 es «−». */
const coefText = (c: number, body: string) => (body === "" ? String(Math.abs(c)) : Math.abs(c) === 1 ? body : `${Math.abs(c)}${/^[a-z(]/.test(body) ? "" : "·"}${body}`);

/** «3x^4 − 2x^2 + 5»: términos (coeficiente, cuerpo) sin los de coeficiente 0. */
function sumText(terms: Array<[number, string]>): string {
  let out = "";
  for (const [c, body] of terms) {
    if (c === 0) continue;
    const t = body.startsWith("/") ? `${Math.abs(c)}${body}` : coefText(c, body);
    out += out === "" ? (c < 0 ? `−${t}` : t) : c < 0 ? ` − ${t}` : ` + ${t}`;
  }
  return out === "" ? "0" : out;
}

const nz = (rng: Rng, lo: number, hi: number) => {
  for (;;) {
    const v = rng.int(lo, hi);
    if (v !== 0) return v;
  }
};
const signed = (n: number) => (n < 0 ? `− ${-n}` : `+ ${n}`);
const xPow = (n: number) => (n === 1 ? "x" : `x^${n}`);

// ---------------------------------------------------------------- Derivadas

function derivativeTemplate(rng: Rng, level: ExerciseLevel): string {
  if (level === "básico") {
    switch (rng.int(0, 3)) {
      case 0: {
        const n = rng.int(3, 5);
        return sumText([
          [nz(rng, -5, 5), xPow(n)],
          [rng.int(-6, 6), "x^2"],
          [rng.int(-9, 9), "x"],
          [rng.int(-9, 9), ""],
        ]);
      }
      case 1:
        return sumText([
          [nz(rng, -5, 5), rng.pick(["sen(x)", "cos(x)"])],
          [nz(rng, -4, 4), "e^x"],
          [rng.int(-5, 5), "x^2"],
        ]);
      case 2:
        return sumText([
          [nz(rng, -6, 6), "ln(x)"],
          [nz(rng, -4, 4), xPow(rng.int(2, 4))],
        ]);
      default:
        return sumText([
          [nz(rng, 1, 6), "sqrt(x)"],
          [nz(rng, -6, 6), "/x"],
          [rng.int(-4, 4), "x"],
        ]);
    }
  }
  const a = nz(rng, 1, 4);
  const b = nz(rng, -5, 5);
  const n = rng.int(2, 5);
  if (level === "medio") {
    return rng.pick([
      `${xPow(rng.int(1, 3))} ${rng.pick(["sen(x)", "cos(x)", "e^x"])}`,
      `${xPow(rng.int(1, 2))} ln(x)`,
      `(${a}x ${signed(b)})^${n}`,
      `${rng.pick(["sen", "cos"])}(${a}x^2)`,
      `e^(${a === 1 ? "" : a}x^2 ${signed(b)})`,
      `ln(${a}x^2 + ${Math.abs(b)})`,
      `(x ${signed(b)})/(x ${signed(nz(rng, -5, 5))})`,
      `x^2/(x ${signed(b)})`,
    ]);
  }
  return rng.pick([
    `${xPow(rng.int(1, 3))} e^(${b}x)`,
    `e^(${b}x) ${rng.pick(["sen", "cos"])}(${a}x)`,
    `sqrt(x^2 + ${a * a})`,
    `x/(x^2 + ${a})`,
    `${rng.pick(["sen", "cos"])}(${a}x)^${n}`,
    `e^(${rng.pick(["sen", "cos"])}(x))`,
    `x^2 ln(${a}x)`,
    `1/(1 + e^(${-a}x))`,
    `x (x^2 ${signed(b)})^${n}`,
    `ln(${rng.pick(["sen", "cos"])}(x)^2 + ${a})`,
  ]);
}

const definedSomewhere = (f: Expr) => [0.3, 0.7, 1.3, 2.1].some((x) => Number.isFinite(evaluate(f, { x })));

export const CALC_DERIVATIVE: ExerciseType<CalcFnInstance> = {
  id: "calculo-derivada",
  topic: "calculo",
  title: "Derivada por reglas",
  description: "Deriva paso a paso, eligiendo en cada línea la regla (suma, producto, cociente, potencia, cadena…), o escribe solo el resultado.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    const f = generateUntil(
      rngFor("calculo-derivada", seed),
      (r) => derivativeTemplate(r, level),
      (text) => {
        const e = calcExpr(text);
        return definedSomewhere(e) && exprSize(derivativeTidy(e)) <= 60 && derivativeTidy(e).k !== "num";
      },
    );
    return { f };
  },
};

// ---------------------------------------------------------------- Recta tangente

function tangentTemplate(rng: Rng, level: ExerciseLevel): CalcTangentInstance {
  if (level === "básico") {
    return { f: sumText([[nz(rng, -3, 3), "x^2"], [rng.int(-6, 6), "x"], [rng.int(-6, 6), ""]]), x0: rng.int(-2, 3) };
  }
  if (level === "medio") {
    return { f: sumText([[nz(rng, -2, 2), "x^3"], [rng.int(-3, 3), "x^2"], [rng.int(-6, 6), "x"], [rng.int(-5, 5), ""]]), x0: rng.int(-2, 2) };
  }
  const a = nz(rng, 1, 3);
  const b = rng.int(2, 4);
  return rng.pick([
    { f: `x e^(${a}x)`, x0: 0 },
    { f: `x ln(x)`, x0: 1 },
    { f: `${xPow(rng.int(2, 3))} ln(x)`, x0: 1 },
    { f: `${rng.pick(["sen", "cos"])}(${a}x) + x^2`, x0: 0 },
    { f: `ln(${a}x + 1)`, x0: 0 },
    { f: `sqrt(x + ${b * b})`, x0: 0 },
    { f: `(x + ${a})/(x + ${b})`, x0: 0 },
    { f: `e^(x^2 - ${a}x)`, x0: rng.pick([0, a]) },
  ]);
}

export const CALC_TANGENT: ExerciseType<CalcTangentInstance> = {
  id: "calculo-tangente",
  topic: "calculo",
  title: "Recta tangente",
  description: "Calcula f(x₀), la pendiente f′(x₀) y la ecuación de la recta tangente y = f(x₀) + f′(x₀)(x − x₀); la ves dibujada sobre la curva.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("calculo-tangente", seed),
      (r) => tangentTemplate(r, level),
      (t) => {
        const e = calcExpr(t.f);
        return niceValue(evaluate(e, { x: t.x0 })) && niceValue(evaluate(derivative(e), { x: t.x0 }));
      },
    );
  },
};

// ---------------------------------------------------------------- Primitivas

function antiderivativeTemplate(rng: Rng, level: ExerciseLevel): string {
  if (level === "básico") {
    const top = rng.int(2, 4);
    return sumText([
      [(top + 1) * nz(rng, -3, 3), xPow(top)],
      [rng.int(-4, 4) * (rng.chance(0.5) ? 3 : 1), top > 2 ? "x^2" : ""],
      [rng.int(-6, 6), "x"],
      [rng.int(-6, 6), ""],
    ]);
  }
  if (level === "medio") {
    const pool: Array<[number, string]> = [
      [nz(rng, -3, 3) * 3, "sqrt(x)"],
      [nz(rng, -5, 5), "/x"],
      [nz(rng, -4, 4), "e^x"],
      [nz(rng, -4, 4), "sen(x)"],
      [nz(rng, -4, 4), "cos(x)"],
      [nz(rng, -3, 3), "/x^2"],
      [nz(rng, -3, 3) * 2, "x"],
    ];
    return sumText(rng.shuffle(pool).slice(0, rng.int(2, 3)));
  }
  const a = nz(rng, 2, 4);
  const b = nz(rng, -3, 3);
  const pool = [
    `e^(${a}x)`,
    `${rng.pick(["sen", "cos"])}(${a}x ${signed(b)})`,
    `${a}/(${a}x ${signed(b)})`,
    `(${a}x ${signed(b)})^${rng.int(2, 3)}`,
    `1/(x ${signed(b)})^2`,
    `sqrt(${a}x + ${Math.abs(b)})`,
  ];
  const picked = rng.shuffle(pool).slice(0, 2);
  return picked.join(rng.chance(0.5) ? " + " : " − ");
}

export const CALC_ANTIDERIVATIVE: ExerciseType<CalcFnInstance> = {
  id: "calculo-primitiva",
  topic: "calculo",
  title: "Primitiva",
  description: "Escribe una primitiva F(x) (con + C si quieres): se comprueba derivándola, así que vale cualquier forma equivalente.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    const f = generateUntil(
      rngFor("calculo-primitiva", seed),
      (r) => antiderivativeTemplate(r, level),
      (text) => antiderivative(calcExpr(text)) !== null && definedSomewhere(calcExpr(text)),
    );
    return { f };
  },
};

// ---------------------------------------------------------------- Integral definida

function integralTemplate(rng: Rng, level: ExerciseLevel): CalcIntegralInstance {
  if (level !== "avanzado") {
    const a = rng.int(-2, 1);
    const b = a + rng.int(1, 3);
    const f =
      level === "básico"
        ? sumText([[nz(rng, -3, 3), "x^2"], [rng.int(-4, 4), "x"], [rng.int(-4, 4), ""]])
        : sumText([[nz(rng, -2, 2), "x^3"], [rng.int(-3, 3), "x^2"], [rng.int(-4, 4), "x"], [rng.int(-3, 3), ""]]);
    return { f, a: String(a), b: String(b) };
  }
  const k = rng.int(1, 4);
  const kx = k === 1 ? "" : String(k);
  return rng.pick<CalcIntegralInstance>([
    { f: `${kx}e^x + ${xPow(rng.int(1, 3))}`, a: "0", b: "1" },
    { f: `e^(${k}x)`, a: "0", b: rng.pick(["1", "2"]) },
    { f: `${k}/x`, a: "1", b: rng.pick(["e", "2", "4", "e^2"]) },
    { f: `${kx}sen(x)`, a: "0", b: rng.pick(["π", "π/2"]) },
    { f: `cos(${k}x)`, a: "0", b: k === 1 ? "π/2" : `π/${2 * k}` },
    { f: `${kx}sqrt(x)`, a: rng.pick(["0", "1"]), b: rng.pick(["4", "9"]) },
    { f: `${k}/(x + 1)`, a: "0", b: rng.pick(["1", "e − 1", "3"]) },
    { f: `e^(-x)`, a: "0", b: rng.pick(["1", "ln(2)", "2"]) },
  ]);
}

export const CALC_DEFINITE: ExerciseType<CalcIntegralInstance> = {
  id: "calculo-integral",
  topic: "calculo",
  title: "Integral definida",
  description: "Calcula ∫ₐᵇ f(x) dx con la regla de Barrow; escribe el número (con tres decimales) o el valor exacto (como 7/2, 2 + ln 3 o π/6).",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("calculo-integral", seed),
      (r) => integralTemplate(r, level),
      (inst) => {
        const v = definiteIntegral(calcExpr(inst.f), calcNumber(inst.a), calcNumber(inst.b));
        // En básico y medio, un número racional cómodo y no nulo.
        return Number.isFinite(v) && Math.abs(v) > 1e-9 && (level === "avanzado" || niceValue(v, 12, 80));
      },
    );
  },
};

// ---------------------------------------------------------------- Gradiente

function gradientTemplate(rng: Rng, level: ExerciseLevel): CalcGradientInstance {
  const point: [number, number] = [rng.int(-2, 2), rng.int(-2, 2)];
  if (level === "básico") {
    return {
      f: sumText([
        [nz(rng, -3, 3), rng.pick(["x^2 y", "x y^2", "x y"])],
        [rng.int(-3, 3), "x^2"],
        [rng.int(-3, 3), "y^2"],
        [rng.int(-5, 5), rng.pick(["x", "y"])],
      ]),
      point,
    };
  }
  if (level === "medio") {
    return {
      f: sumText([
        [nz(rng, -3, 3), rng.pick(["x^3 y", "x^2 y^2", "x y^3", "x^2 y"])],
        [nz(rng, -4, 4), rng.pick(["x y", "x^3", "y^3"])],
        [rng.int(-4, 4), rng.pick(["x", "y", "y^2"])],
      ]),
      point,
    };
  }
  const p = rng.int(-2, 2);
  return rng.pick<CalcGradientInstance>([
    { f: `x e^(x - y)`, point: [p, p] },
    { f: `y e^(x y) + x^2`, point: [0, rng.int(-2, 2)] },
    { f: `sen(x y) + ${nz(rng, -3, 3)}x`, point: [0, rng.int(-2, 2)] },
    { f: `ln(x^2 + y^2)`, point: rng.pick<[number, number]>([[1, 0], [0, 1], [1, 1], [2, 0], [1, -1]]) },
    { f: `x^2 e^y - ${nz(rng, 1, 3)}x y`, point: [rng.int(-2, 2), 0] },
    { f: `cos(x - y) + x y^2`, point: [p, p] },
  ]);
}

export const CALC_GRADIENT: ExerciseType<CalcGradientInstance> = {
  id: "calculo-gradiente",
  topic: "calculo",
  title: "Derivadas parciales y gradiente",
  description: "Calcula ∂f/∂x y ∂f/∂y (la otra variable queda como constante) y el gradiente ∇f en un punto.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("calculo-gradiente", seed),
      (r) => gradientTemplate(r, level),
      (inst) => {
        const e = calcExpr(inst.f, ["x", "y"]);
        const at = { x: inst.point[0], y: inst.point[1] };
        const g = [derivative(e, "x"), derivative(e, "y")].map((d) => evaluate(d, at));
        // Las dos parciales tienen que depender de algo (no ser 0) y valer números cómodos en el punto.
        return g.every((v) => niceValue(v)) && g.some((v) => v !== 0) && derivative(e, "x").k !== "num" && derivative(e, "y").k !== "num";
      },
    );
  },
};

// ---------------------------------------------------------------- Puntos críticos

function criticalTemplate(rng: Rng, level: ExerciseLevel): string {
  if (level === "básico") {
    // a(x − p)² + b(x − p)(y − q) + c(y − q)², desarrollado y sin la constante.
    const p = rng.int(-2, 2);
    const q = rng.int(-2, 2);
    const a = nz(rng, -2, 2);
    const b = rng.int(-2, 2);
    const c = nz(rng, -2, 2);
    return sumText([
      [a, "x^2"],
      [b, "x y"],
      [c, "y^2"],
      [-2 * a * p - b * q, "x"],
      [-2 * c * q - b * p, "y"],
    ]);
  }
  if (level === "medio") {
    // Separada: una cúbica x³ − 3r²x (críticos en ±r) más una parábola k(y − s)² (sin la constante),
    // o al revés.
    const r = rng.int(1, 2);
    const s = rng.int(-2, 2);
    const k = nz(rng, -2, 2);
    return rng.chance(0.5)
      ? sumText([[1, "x^3"], [-3 * r * r, "x"], [k, "y^2"], [-2 * k * s, "y"]])
      : sumText([[k, "x^2"], [-2 * k * s, "x"], [1, "y^3"], [-3 * r * r, "y"]]);
  }
  // x³ + c·x² + a·xy + b·y² + d·x + e·y con a = ±2, b = ±1 y e par: ∂f/∂y = 0 da y = −(a·x + e)/(2b),
  // y al sustituir queda 3(x − r₁)(x − r₂) = 0 eligiendo c y d. Dos puntos críticos enteros.
  const sA = rng.pick([1, -1]);
  const b = rng.pick([1, -1]);
  const e = 2 * rng.int(-2, 2);
  const r1 = rng.int(-3, 3);
  let r2 = r1 + 2 * rng.pick([-2, -1, 1, 2]);
  if (r2 > 3 || r2 < -3) r2 = r1 - (r2 - r1);
  const a = 2 * sA;
  const c = b - (3 * (r1 + r2)) / 2;
  const d = 3 * r1 * r2 + sA * e * b;
  return sumText([
    [1, "x^3"],
    [c, "x^2"],
    [a, "x y"],
    [b, "y^2"],
    [d, "x"],
    [e, "y"],
  ]);
}

export const CALC_CRITICAL: ExerciseType<CalcFnInstance> = {
  id: "calculo-criticos",
  topic: "calculo",
  title: "Puntos críticos y hessiana",
  description: "Resuelve ∇f = 0 y clasifica cada punto crítico con el determinante de la hessiana: mínimo, máximo o punto de silla.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    const f = generateUntil(
      rngFor("calculo-criticos", seed),
      (r) => criticalTemplate(r, level),
      (text) => {
        const r = criticalPoints(calcExpr(text, ["x", "y"]));
        if (!r.ok || r.points.length === 0 || r.points.length > 4) return false;
        if (r.points.some((p) => p.kind === "no-concluyente" || p.x.d !== 1n || p.y.d !== 1n)) return false;
        if (r.points.some((p) => Math.abs(Number(p.x.n)) > 4 || Math.abs(Number(p.y.n)) > 4)) return false;
        // En avanzado, al menos dos puntos.
        return level !== "avanzado" || r.points.length >= 2;
      },
    );
    return { f };
  },
};

// ---------------------------------------------------------------- Descenso de gradiente

function descentTemplate(rng: Rng, level: ExerciseLevel): CalcDescentInstance {
  if (level === "básico") {
    return {
      f: sumText([[rng.pick([1, 2]), "x^2"], [rng.int(-8, 8), "x"], [rng.int(0, 5), ""]]),
      start: [rng.int(-3, 3)],
      alpha: rng.pick([0.1, 0.25]),
      steps: 2,
    };
  }
  if (level === "medio") {
    return {
      f: rng.pick([sumText([[1, "x^3"], [-3 * rng.int(1, 2), "x"]]), sumText([[1, "x^4"], [-rng.int(1, 4) * 2, "x^2"]]), sumText([[1, "x^3"], [rng.int(-3, 3), "x^2"]])]),
      start: [rng.pick([-2, -1, 1, 2])],
      alpha: rng.pick([0.1, 0.05]),
      steps: 2,
    };
  }
  return {
    f: sumText([
      [rng.pick([1, 2]), "x^2"],
      [rng.pick([1, 2, 3]), "y^2"],
      [rng.int(-1, 1), "x y"],
      [rng.int(-4, 4), "x"],
      [rng.int(-4, 4), "y"],
    ]),
    start: [rng.int(-2, 2), rng.int(-2, 2)],
    alpha: rng.pick([0.1, 0.25]),
    steps: 2,
  };
}

/** ¿Decimal con como mucho 4 cifras? (el denominador divide a 10⁴). */
const shortDecimal = (x: Frac) => 10000n % x.d === 0n;

export const CALC_DESCENT: ExerciseType<CalcDescentInstance> = {
  id: "calculo-descenso",
  topic: "calculo",
  title: "Paso de descenso de gradiente",
  description: "Haz a mano las primeras iteraciones xₖ₊₁ = xₖ − α·∇f(xₖ): calcula x₁ y x₂.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("calculo-descenso", seed),
      (r) => descentTemplate(r, level),
      (inst) => {
        const vars: VarName[] = inst.start.length === 2 ? ["x", "y"] : ["x"];
        const steps = exactDescentSteps(calcExpr(inst.f, vars), inst.start.map((s) => frac(BigInt(s))), alphaFrac(inst.alpha), inst.steps);
        if (!steps) return false;
        const flat = steps.slice(1).flat();
        // Que se mueva (∇f(x₀) ≠ 0), con decimales cortos y sin salir disparado.
        const moved = steps[1]!.some((v, i) => v.n * steps[0]![i]!.d !== steps[0]![i]!.n * v.d);
        return moved && flat.every((v) => shortDecimal(v) && Math.abs(Number(v.n) / Number(v.d)) <= 30);
      },
    );
  },
};

export const CALC_EXERCISES = [CALC_DERIVATIVE, CALC_TANGENT, CALC_ANTIDERIVATIVE, CALC_DEFINITE, CALC_GRADIENT, CALC_CRITICAL, CALC_DESCENT] as const;
