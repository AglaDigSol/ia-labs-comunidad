// Motor de cálculo: analizador (ida y vuelta y errores), derivadas comparadas con la derivada numérica
// (diferencias centradas) en muchas funciones generadas al azar, simplificación, equivalencia,
// derivadas paso a paso, integrales, puntos críticos con la hessiana y descenso de gradiente.
import { describe, expect, it } from "vitest";
import { createRng, type Rng } from "../exercises/random.ts";
import { frac } from "../rational.ts";
import { classifyHessian, criticalPoints, isCriticalPoint } from "./critical.ts";
import { derivative, derivativeRaw, derivativeTidy, gradient, hessian, resolveD, rulesFor } from "./derive.ts";
import { antiderivative } from "./antiderivative.ts";
import { exactDescentSteps, iterationsTo, objective, oscillates, runDescent } from "./descent.ts";
import { differByConstant, equivalent, isEquivalent } from "./equivalence.ts";
import { evaluate, exprSize, toPlain, toTex, type Expr, type FnName } from "./expr.ts";
import { checkAntiderivative, definiteIntegral, numberMatches, parseNumberAnswer, riemannSum, simpson } from "./integrals.ts";
import { parseExpr } from "./parser.ts";
import { contourLevels, contourSegments, sampleCurve, sampleGrid, ticks } from "./plot.ts";
import { canonKey, simplify, tidy } from "./simplify.ts";
import { checkDerivStep, derivationSteps, nextRuleHints } from "./steps.ts";

const P = (s: string, vars: Array<"x" | "y"> = ["x"]): Expr => {
  const r = parseExpr(s, { vars, allowPrime: true });
  if (!r.ok) throw new Error(`${s}: ${r.error.message}`);
  return r.expr;
};
const at = (e: Expr, x: number, y = 0) => evaluate(e, { x, y });

/** Función al azar con las piezas de un tema de cálculo (profundidad acotada). */
function randomExpr(rng: Rng, depth: number): Expr {
  const leaf = (): Expr => (rng.chance(0.6) ? { k: "var", name: "x" } : { k: "num", v: frac(BigInt(rng.int(1, 5))) });
  if (depth <= 0) return leaf();
  const sub = () => randomExpr(rng, depth - 1);
  switch (rng.int(0, 7)) {
    case 0:
      return { k: "add", args: [sub(), sub()] };
    case 1:
      return { k: "mul", args: [sub(), sub()] };
    case 2:
      return { k: "div", a: sub(), b: { k: "add", args: [{ k: "pow", a: sub(), b: { k: "num", v: frac(2n) } }, { k: "num", v: frac(1n) }] } };
    case 3:
      return { k: "pow", a: sub(), b: { k: "num", v: frac(BigInt(rng.pick([2, 3, -1, 1])), BigInt(rng.pick([1, 1, 2]))) } };
    case 4:
      return { k: "fn", name: rng.pick<FnName>(["sin", "cos", "exp", "ln", "sqrt"]), a: sub() };
    case 5:
      return { k: "neg", a: sub() };
    case 6:
      return { k: "add", args: [sub(), { k: "neg", a: sub() }] };
    default:
      return leaf();
  }
}

/** Derivada numérica por diferencias centradas. */
const numericDerivative = (e: Expr, x: number, h = 1e-5) => (at(e, x + h) - at(e, x - h)) / (2 * h);

describe("analizador", () => {
  it("lee la escritura de clase: producto implícito, funciones sin paréntesis, superíndices y constantes", () => {
    const cases: Array<[string, number, number]> = [
      ["2x", 1.5, 3],
      ["3(x+1)", 2, 9],
      ["x y", 2, 6],
      ["2 sen x", Math.PI / 2, 2],
      ["sin(x)^2 + cos(x)^2", 0.7, 1],
      ["sen^2 x", Math.PI / 2, 1],
      ["x²", 3, 9],
      ["x^-1", 4, 0.25],
      ["x**2", 5, 25],
      ["e^x", 1, Math.E],
      ["π x", 2, 2 * Math.PI],
      ["pi", 0, Math.PI],
      ["ln x", Math.E, 1],
      ["log(e^2)", 0, 2],
      ["sqrt(x)", 9, 3],
      ["|x - 3|", 1, 2],
      ["2^3^2", 0, 512],
      ["-x^2", 3, -9],
      ["0,5x", 4, 2],
      ["1/2x", 4, 2],
      ["sen x cos x", 0.3, Math.sin(0.3) * Math.cos(0.3)],
      ["sen 2x", 0.3, Math.sin(0.6)],
      ["x^(1/3)", -8, -2],
      ["(x−1)·(x+1)", 3, 8],
    ];
    for (const [s, x, v] of cases) {
      const e = P(s, ["x", "y"]);
      expect(at(e, x, 3), s).toBeCloseTo(v, 9);
    }
  });

  it("toPlain se vuelve a leer igual (ida y vuelta) y toTex no se rompe", () => {
    const rng = createRng(7);
    for (let i = 0; i < 300; i++) {
      const e = simplify(randomExpr(rng, 3));
      const text = toPlain(tidy(e));
      const back = parseExpr(text);
      expect(back.ok, text).toBe(true);
      if (!back.ok) continue;
      expect(equivalent(back.expr, e).kind, text).not.toBe("different");
      // Leer lo escrito y volver a escribirlo no cambia el texto.
      expect(toPlain(back.expr), text).toBe(text);
      expect(toTex(tidy(e))).not.toMatch(/undefined|NaN/);
    }
  });

  it("errores en español con su posición", () => {
    const err = (s: string, opts = {}) => {
      const r = parseExpr(s, opts);
      if (r.ok) throw new Error(`debería fallar: ${s}`);
      return r.error;
    };
    expect(err("")).toMatchObject({ message: "Escribe una expresión." });
    expect(err("2x +")).toMatchObject({ message: "Falta un término después de «+».", start: 3, end: 4 });
    expect(err("(x+1")).toMatchObject({ message: "Falta cerrar este paréntesis.", start: 0 });
    expect(err("x)")).toMatchObject({ message: "Sobra este paréntesis de cierre.", start: 1 });
    expect(err("3z").message).toMatch(/«z» no es una variable/);
    expect(err("x + y").message).toMatch(/la única variable es x/);
    expect(err("sen").message).toBe("Falta el argumento de sen: escribe sen(x).");
    expect(err("x ^")).toMatchObject({ message: "Falta el exponente después de «^»." });
    expect(err("|x")).toMatchObject({ message: "Falta la barra que cierra el valor absoluto." });
    expect(err("2 # x")).toMatchObject({ message: "El carácter «#» no se entiende aquí.", start: 2, end: 3 });
    expect(err("(x^2)'").message).toMatch(/La prima/);
    expect(err("x".repeat(201)).message).toMatch(/Como mucho 200/);
    expect(parseExpr("(x^2)′", { allowPrime: true }).ok).toBe(true);
  });
});

describe("derivadas", () => {
  it("las de la tabla, escritas como en un libro", () => {
    const cases: Array<[string, string]> = [
      ["3x^2 - 2x + 5", "6x − 2"],
      ["x^2 sen x", "2x·sen(x) + x^2·cos(x)"],
      ["sen(x)/x", "(x·cos(x) − sen(x))/x^2"],
      ["e^(2x)", "2·e^(2x)"],
      ["ln(x^2+1)", "2x/(x^2 + 1)"],
      ["sqrt(x)", "1/(2·sqrt(x))"],
      ["(x^2+1)^3", "6x·(x^2 + 1)^2"],
      ["x^3/3 - x", "x^2 − 1"],
      ["1/(x+1)", "−1/(x + 1)^2"],
      ["cos(3x^2)", "−6x·sen(3x^2)"],
      ["e^x/(1+e^x)", "e^x/(e^x + 1)^2"],
      ["5", "0"],
      ["(x−1)(x+2)", "2x + 1"],
    ];
    for (const [f, d] of cases) expect(toPlain(derivativeTidy(P(f))), f).toBe(d);
  });

  it("coinciden con la derivada numérica en 400 funciones al azar", () => {
    const rng = createRng(2026);
    let checked = 0;
    for (let i = 0; i < 400; i++) {
      const f = randomExpr(rng, 3);
      const df = derivative(f);
      for (const x of [-1.7, -0.6, 0.35, 0.9, 1.6, 2.3]) {
        const exact = at(df, x);
        const approx = numericDerivative(f, x);
        if (!Number.isFinite(exact) || !Number.isFinite(approx) || Math.abs(approx) > 1e5 || Math.abs(at(f, x)) > 1e6) continue;
        // Cerca de un borde del dominio la diferencia centrada falla: se mira solo donde f es suave.
        if (![x - 1e-3, x + 1e-3].every((t) => Number.isFinite(at(f, t)))) continue;
        expect(exact, `${toPlain(f)} en ${x}`).toBeCloseTo(approx, 3);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it("la simplificación no cambia la función y la deja más corta", () => {
    const rng = createRng(99);
    for (let i = 0; i < 200; i++) {
      const raw = derivativeRaw(randomExpr(rng, 3));
      const s = tidy(raw);
      expect(isEquivalent(s, raw), toPlain(raw)).toBe(true);
      expect(exprSize(s)).toBeLessThanOrEqual(exprSize(raw) + 2);
    }
    expect(toPlain(tidy(P("x + x + 2x")))).toBe("4x");
    expect(toPlain(tidy(P("x·x^2")))).toBe("x^3");
    expect(toPlain(tidy(P("0·sen(x) + 1·x")))).toBe("x");
    expect(toPlain(tidy(P("x^2 - x^2")))).toBe("0");
    expect(toPlain(tidy(P("ln(e^x)")))).toBe("x");
    expect(toPlain(tidy(P("(2x)^2")))).toBe("4x^2");
    expect(toPlain(tidy(P("x/2")))).toBe("x/2");
    expect(canonKey(simplify(P("x y + 1", ["x", "y"])))).toBe(canonKey(simplify(P("1 + y x", ["x", "y"]))));
  });

  it("parciales, gradiente y hessiana", () => {
    const f = P("x^2 y + 3x y^2 - y", ["x", "y"]);
    const [fx, fy] = gradient(f);
    expect(toPlain(tidy(fx))).toBe("2xy + 3y^2");
    expect(toPlain(tidy(fy))).toBe("x^2 + 6xy − 1");
    const H = hessian(f);
    expect(H.flat().map((h) => toPlain(tidy(h)))).toEqual(["2y", "2x + 6y", "2x + 6y", "6x"]);
    const g = P("e^(x y) + sen(x)", ["x", "y"]);
    expect(at(derivative(g, "y"), 1.2, 0.5)).toBeCloseTo(1.2 * Math.exp(0.6), 10);
  });

  it("la regla que toca a cada derivada", () => {
    expect(rulesFor(P("3x^2 + x"))[0]).toBe("suma");
    expect(rulesFor(P("3x^2"))[0]).toBe("constante");
    expect(rulesFor(P("x^2 sen x"))[0]).toBe("producto");
    expect(rulesFor(P("sen(x)/x"))[0]).toBe("cociente");
    expect(rulesFor(P("x^5"))[0]).toBe("potencia");
    expect(rulesFor(P("(x^2+1)^5"))[0]).toBe("cadena");
    expect(rulesFor(P("sen(2x)"))[0]).toBe("cadena");
    expect(rulesFor(P("ln x"))[0]).toBe("elementales");
    expect(rulesFor(P("7"))[0]).toBe("elementales");
    expect(rulesFor(P("x y", ["x", "y"]), "y")[0]).toBe("constante");
  });
});

describe("equivalencia", () => {
  it("acepta formas equivalentes", () => {
    const pairs: Array<[string, string]> = [
      ["2x·sen(x) + x^2·cos(x)", "x(2 sen x + x cos x)"],
      ["(x cos x − sen x)/x^2", "cos(x)/x − sen(x)/x^2"],
      ["2 sen x cos x", "sen(2x)"],
      ["1/cos(x)^2", "1 + tan(x)^2"],
      ["2/x", "(ln(x^2))′"],
      ["e^(2x)", "(e^x)^2"],
      ["sqrt(x)/x", "x^(-1/2)"],
      ["(x+1)^2", "x^2 + 2x + 1"],
      ["2 ln x", "ln(x^2)"],
    ];
    for (const [a, b] of pairs) expect(equivalent(P(a), P(b)).kind, `${a} = ${b}`).toBe("equal");
  });

  it("rechaza las que se parecen pero no son", () => {
    const pairs: Array<[string, string]> = [
      ["2x", "2x + 0,001"],
      ["2x sen x + x^2 cos x", "2x sen x − x^2 cos x"],
      ["1/(2 sqrt(x))", "1/sqrt(x)"],
      ["x^2", "|x|·x"],
      ["cos x", "sen x"],
      ["e^x", "x e^(x-1)"],
      ["3x^2", "3x^2.0001"],
    ];
    for (const [a, b] of pairs) expect(equivalent(P(a), P(b)).kind, `${a} ≠ ${b}`).toBe("different");
  });

  it("sin puntos donde las dos estén definidas no da nada por bueno", () => {
    expect(equivalent(P("ln(-x^2 - 1)"), P("ln(-x^2 - 2)")).kind).toBe("unknown");
    expect(differByConstant(P("x^2 + 7"), P("x^2 - 1"))).toBe(true);
    expect(differByConstant(P("x^2 + x"), P("x^2"))).toBe(false);
  });
});

describe("derivadas paso a paso", () => {
  const f = P("x^2 sen x");
  const start: Expr = { k: "d", a: f, v: "x" };

  it("un paso con la regla que toca se acepta; con otra regla, se avisa", () => {
    const s1 = P("(x^2)′ sen x + x^2 (sen x)′");
    const ok = checkDerivStep(f, start, s1, "producto");
    expect(ok).toMatchObject({ ok: true, ruleFits: true, done: false, alsoApplied: [] });
    const wrongRule = checkDerivStep(f, start, s1, "cadena");
    expect(wrongRule).toMatchObject({ ok: true, ruleFits: false, suggestions: ["producto"] });
  });

  it("un paso que no vale f′ se rechaza sin decir el resultado", () => {
    const bad = checkDerivStep(f, start, P("(x^2)′ (sen x)′"), "producto");
    expect(bad).toEqual({ ok: false, reason: "not-equivalent" });
  });

  it("dos reglas en un paso: vale, pero lo dice", () => {
    const r = checkDerivStep(f, start, P("2x sen x + x^2 (sen x)′"), "producto");
    expect(r).toMatchObject({ ok: true, ruleFits: true, alsoApplied: ["potencia"] });
    const last = checkDerivStep(f, P("2x sen x + x^2 (sen x)′"), P("2x sen x + x^2 cos x"), "elementales");
    expect(last).toMatchObject({ ok: true, ruleFits: true, done: true });
    const tidyUp = checkDerivStep(f, P("2x sen x + x^2 cos x"), P("x(2 sen x + x cos x)"), "simplificar");
    expect(tidyUp).toMatchObject({ ok: true, ruleFits: true, done: true });
    const noRule = checkDerivStep(f, P("2x sen x + x^2 cos x"), P("x(2 sen x + x cos x)"), "producto");
    expect(noRule).toMatchObject({ ok: true, ruleFits: false });
  });

  it("la cadena y la pista que dice la regla, no el resultado", () => {
    const g = P("sen(x^2 + 1)");
    const r = checkDerivStep(g, { k: "d", a: g, v: "x" }, P("cos(x^2 + 1)·(x^2 + 1)′"), "cadena");
    expect(r).toMatchObject({ ok: true, ruleFits: true });
    expect(nextRuleHints(P("cos(x^2+1)·(x^2+1)′")).map((h) => h.rule)).toEqual(["suma"]);
  });

  it("la solución completa: cada línea vale f′ y la última no tiene primas", () => {
    for (const s of ["x^2 sen x", "ln(x^2+1)", "(3x - 1)^4", "e^x/(x+1)", "sqrt(1 + x^2)", "x^3 - 4x + 2", "x cos(2x)"]) {
      const g = P(s);
      const steps = derivationSteps(g);
      expect(steps.length).toBeGreaterThan(0);
      for (const st of steps) expect(isEquivalent(st.line, derivativeRaw(g)), `${s}: ${toPlain(st.line)}`).toBe(true);
      expect(resolveD(steps.at(-1)!.line)).toEqual(steps.at(-1)!.line);
    }
    expect(derivationSteps(P("x^2 sen x")).map((s) => s.rule)).toEqual(["producto", "potencia", "elementales"]);
  });
});

describe("integrales", () => {
  it("primitivas: se derivan y se comparan; vale + C y cualquier forma", () => {
    const f = P("3x^2 + cos x");
    expect(checkAntiderivative("x^3 + sen x + C", f)).toEqual({ ok: true, hadConstant: true });
    expect(checkAntiderivative("x^3 + sen(x) + 4", f)).toEqual({ ok: true, hadConstant: false });
    expect(checkAntiderivative("x^3 − sen x", f)).toEqual({ ok: false, reason: "wrong" });
    expect(checkAntiderivative("x^3 +", f)).toMatchObject({ ok: false, reason: "parse" });
    expect(checkAntiderivative("ln|x|", P("1/x"))).toMatchObject({ ok: true });
    expect(checkAntiderivative("-e^(-x)/1 + K", P("e^(-x)"))).toMatchObject({ ok: true, hadConstant: true });
  });

  it("Simpson adaptativo da muchas cifras", () => {
    expect(simpson(Math.sin, 0, Math.PI)).toBeCloseTo(2, 10);
    expect(definiteIntegral(P("x^2"), 0, 3)).toBeCloseTo(9, 10);
    expect(definiteIntegral(P("1/x"), 1, Math.E)).toBeCloseTo(1, 10);
    expect(definiteIntegral(P("e^(-x^2)"), -4, 4)).toBeCloseTo(Math.sqrt(Math.PI), 6);
    expect(definiteIntegral(P("sqrt(x)"), 0, 4)).toBeCloseTo(16 / 3, 6);
    expect(Number.isNaN(definiteIntegral(P("1/x"), -1, 1))).toBe(true);
  });

  it("respuestas numéricas: decimales con tres cifras, fracciones y expresiones exactas", () => {
    const read = (s: string) => {
      const r = parseNumberAnswer(s);
      if (!r.ok) throw new Error(r.error.message);
      return r;
    };
    expect(numberMatches(read("5,333"), 16 / 3)).toBe(true);
    expect(numberMatches(read("5,33"), 16 / 3)).toBe(false);
    expect(numberMatches(read("16/3"), 16 / 3)).toBe(true);
    expect(numberMatches(read("5.3333"), 16 / 3)).toBe(true);
    expect(numberMatches(read("π/4"), Math.atan(1))).toBe(true);
    expect(numberMatches(read("e − 1"), Math.E - 1)).toBe(true);
    expect(numberMatches(read("ln 2"), Math.log(2))).toBe(true);
    expect(numberMatches(read("0,785"), Math.PI / 4)).toBe(true);
    expect(parseNumberAnswer("x + 1").ok).toBe(false);
  });

  it("las sumas de Riemann se acercan a la integral al aumentar n; el punto medio, antes", () => {
    const f = (x: number) => x * x;
    const exact = 9;
    const err = (n: number, rule: "izquierda" | "derecha" | "medio") => Math.abs(riemannSum(f, 0, 3, n, rule).sum - exact);
    expect(err(40, "izquierda")).toBeLessThan(err(10, "izquierda"));
    expect(riemannSum(f, 0, 3, 10, "izquierda").sum).toBeLessThan(exact);
    expect(riemannSum(f, 0, 3, 10, "derecha").sum).toBeGreaterThan(exact);
    expect(err(10, "medio")).toBeLessThan(err(10, "izquierda") / 10);
    expect(riemannSum(f, 0, 3, 6, "medio").rects).toHaveLength(6);
  });
});

describe("puntos críticos y hessiana", () => {
  it("clasifica con el determinante de la hessiana", () => {
    const one = (n: number) => frac(BigInt(n));
    expect(classifyHessian([[one(2), one(0)], [one(0), one(2)]]).kind).toBe("minimo");
    expect(classifyHessian([[one(-2), one(1)], [one(1), one(-3)]]).kind).toBe("maximo");
    expect(classifyHessian([[one(2), one(0)], [one(0), one(-2)]]).kind).toBe("silla");
    expect(classifyHessian([[one(1), one(1)], [one(1), one(1)]]).kind).toBe("no-concluyente");
  });

  it("encuentra todos los puntos de polinomios típicos", () => {
    const kinds = (s: string) => {
      const r = criticalPoints(P(s, ["x", "y"]));
      if (!r.ok) throw new Error(r.reason);
      return r.points.map((p) => `(${p.x.n}/${p.x.d}, ${p.y.n}/${p.y.d}) ${p.kind}`);
    };
    expect(kinds("x^2 + y^2 - 2x + 4y")).toEqual(["(1/1, -2/1) minimo"]);
    expect(kinds("x^2 - y^2")).toEqual(["(0/1, 0/1) silla"]);
    expect(kinds("x^3 - 3x + y^2")).toEqual(["(-1/1, 0/1) silla", "(1/1, 0/1) minimo"]);
    expect(kinds("-x^2 + x y - y^2 + 3y")).toEqual(["(1/1, 2/1) maximo"]);
    expect(kinds("x^3 + y^3 - 3x y")).toEqual(["(0/1, 0/1) silla", "(1/1, 1/1) minimo"]);
    expect(kinds("x^4 + y^2")).toEqual(["(0/1, 0/1) no-concluyente"]);
    expect(criticalPoints(P("sen(x) + y^2", ["x", "y"]))).toEqual({ ok: false, reason: "not-polynomial" });
    expect(criticalPoints(P("x^3 - 2x + y^2", ["x", "y"]))).toEqual({ ok: false, reason: "irrational" });
    expect(isCriticalPoint(P("x^2 + y^2", ["x", "y"]), { x: frac(0n), y: frac(0n) })).toBe(true);
  });
});

describe("descenso de gradiente", () => {
  it("converge en una cuadrática convexa con un α razonable", () => {
    const run = runDescent(objective(P("x^2 + y^2", ["x", "y"])), { alpha: 0.1, start: [3, -2], iterations: 200 });
    expect(run.status).toBe("converge");
    expect(run.points.at(-1)![0]).toBeCloseTo(0, 5);
    // El primer paso: x₁ = x₀ − α·f′(x₀) = 3 − 0,1·6.
    expect(run.points[1]).toEqual([2.4, -1.6]);
    expect(run.values[1]!).toBeLessThan(run.values[0]!);
  });

  it("diverge con un α demasiado grande y oscila cerca del límite", () => {
    const f = objective(P("x^2"));
    expect(runDescent(f, { alpha: 1.1, start: [1], iterations: 300 }).status).toBe("diverge");
    const osc = runDescent(f, { alpha: 0.9, start: [1], iterations: 300 });
    expect(osc.status).toBe("converge");
    expect(oscillates(osc)).toBe(true);
    const slow = runDescent(f, { alpha: 0.01, start: [1], iterations: 100 });
    expect(slow.status).toBe("max");
  });

  it("el momento llega antes en el valle alargado", () => {
    const f = objective(P("x^2/20 + 5y^2", ["x", "y"]));
    const gd = runDescent(f, { alpha: 0.09, start: [-8, 1], iterations: 500, method: "gd" });
    const mo = runDescent(f, { alpha: 0.09, start: [-8, 1], iterations: 500, method: "momentum", beta: 0.8 });
    const tg = iterationsTo(gd, 1e-3);
    const tm = iterationsTo(mo, 1e-3);
    expect(tm).not.toBeNull();
    expect(tg === null || tm! < tg / 2).toBe(true);
  });

  it("Rosenbrock, Adam, mínimos locales y punto de silla", () => {
    const rosen = objective(P("(1 - x)^2 + 100(y - x^2)^2", ["x", "y"]));
    const run = runDescent(rosen, { alpha: 0.001, start: [-1.2, 1], iterations: 500 });
    expect(run.values.at(-1)!).toBeLessThan(run.values[0]!);
    const adam = runDescent(objective(P("x^2 + y^2", ["x", "y"])), { alpha: 0.1, start: [2, 2], iterations: 500, method: "adam" });
    expect(Math.hypot(adam.points.at(-1)![0]!, adam.points.at(-1)![1]!)).toBeLessThan(0.05);
    // Dos mínimos: cada punto de partida cae en el suyo.
    const two = objective(P("x^4 - 3x^2 + x"));
    const left = runDescent(two, { alpha: 0.02, start: [-2], iterations: 500 }).points.at(-1)![0]!;
    const right = runDescent(two, { alpha: 0.02, start: [2], iterations: 500 }).points.at(-1)![0]!;
    expect(left).toBeLessThan(-1);
    expect(right).toBeGreaterThan(1);
    // Silla: con y = 0 exacto se queda en el punto de silla; con un poco de y, escapa.
    const saddle = objective(P("x^2 - y^2", ["x", "y"]));
    expect(runDescent(saddle, { alpha: 0.1, start: [1, 0], iterations: 300 }).status).toBe("converge");
    expect(runDescent(saddle, { alpha: 0.1, start: [1, 0.01], iterations: 300 }).status).toBe("diverge");
  });

  it("como mucho 500 iteraciones, y deterministas", () => {
    const f = objective(P("x^2"));
    const a = runDescent(f, { alpha: 0.001, start: [1], iterations: 10_000 });
    expect(a.points.length).toBe(501);
    expect(runDescent(f, { alpha: 0.3, start: [1], iterations: 20 })).toEqual(runDescent(f, { alpha: 0.3, start: [1], iterations: 20 }));
  });
});

describe("dibujos", () => {
  it("las curvas se cortan donde la función no está definida o salta", () => {
    expect(sampleCurve((x) => 1 / x, -2, 2, 200, [-5, 5]).length).toBe(2);
    expect(sampleCurve((x) => Math.log(x), -2, 2, 200).length).toBe(1);
    expect(ticks(-3, 3)).toEqual([-3, -2, -1, 0, 1, 2, 3]);
  });

  it("las curvas de nivel de x² + y² son círculos", () => {
    const g = sampleGrid((x, y) => x * x + y * y, [-2, 2], [-2, 2], 40);
    const segs = contourSegments(g, 1);
    expect(segs.length).toBeGreaterThan(20);
    for (const [a, b] of segs) {
      expect(Math.hypot(...a)).toBeCloseTo(1, 1);
      expect(Math.hypot(...b)).toBeCloseTo(1, 1);
    }
    expect(contourLevels(g, 8).length).toBeGreaterThan(5);
  });
});

describe("primitivas inmediatas (para la solución)", () => {
  it("se comprueban derivando", () => {
    for (const s of ["6x^2 - 4x + 3", "x^3 + 1/x^2", "3 sqrt(x) - 2/x", "cos(x) + 2 sen(x)", "e^(3x) + 4/(2x + 1)", "sen(2x - 1)", "(2x + 1)^3", "5", "x/4", "-e^(-x)"]) {
      const f = P(s);
      const F = antiderivative(f);
      expect(F, s).not.toBeNull();
      expect(isEquivalent(derivativeRaw(F!), f), s).toBe(true);
    }
    expect(antiderivative(P("x e^x"))).toBeNull();
    expect(toPlain(antiderivative(P("1/x"))!)).toBe("ln(abs(x))");
  });
});

describe("descenso exacto (para corregir las cuentas a mano)", () => {
  it("x₁ = x₀ − α·f′(x₀) con fracciones", () => {
    const steps = exactDescentSteps(P("x^2 - 4x"), [frac(0n)], frac(1n, 4n), 2)!;
    expect(steps.map((s) => `${s[0]!.n}/${s[0]!.d}`)).toEqual(["0/1", "1/1", "3/2"]);
    const two = exactDescentSteps(P("x^2 + 3y^2", ["x", "y"]), [frac(2n), frac(1n)], frac(1n, 10n), 1)!;
    expect(two[1]!.map((v) => Number(v.n) / Number(v.d))).toEqual([1.6, 0.4]);
    expect(exactDescentSteps(P("sen(x)"), [frac(0n)], frac(1n, 10n), 1)).toBeNull();
  });
});

describe("derivadas paso a paso: el signo dentro o fuera de la prima", () => {
  it("−(5x²)′ cuenta como la derivada de −5x²", () => {
    const f = P("4x^3 - 5x^2 + 2x - 7");
    const r = checkDerivStep(f, { k: "d", a: f, v: "x" }, P("(4x^3)′ − (5x^2)′ + (2x)′ − (7)′"), "suma");
    expect(r).toMatchObject({ ok: true, ruleFits: true, alsoApplied: [] });
  });
});
