// ¿Es un punto crítico de f(x, y), y de qué tipo? Para preguntas tipo test: se comprueba ∇f = 0 en el
// punto con las derivadas simbólicas y se clasifica con el determinante de la hessiana. Y, para
// funciones como 2eˣ + y⁴ + 1, si no tiene ningún punto crítico porque una parcial no se anula nunca.
import type { CriticalKind } from "./critical.ts";
import { derivative } from "./derive.ts";
import { dependsOn, evaluate, type Expr } from "./expr.ts";
import { zerosOf } from "./domain.ts";

export type PointKind = CriticalKind | "no-critico";

export function classifyPoint(f: Expr, p: readonly [number, number]): PointKind {
  const at = { x: p[0], y: p[1] };
  const fx = derivative(f, "x");
  const fy = derivative(f, "y");
  const g = [evaluate(fx, at), evaluate(fy, at)];
  if (!g.every(Number.isFinite) || g.some((v) => Math.abs(v) > 1e-9)) return "no-critico";
  const a = evaluate(derivative(fx, "x"), at);
  const b = evaluate(derivative(fx, "y"), at);
  const c = evaluate(derivative(fy, "y"), at);
  const det = a * c - b * b;
  if (Math.abs(det) < 1e-9) return "no-concluyente";
  if (det < 0) return "silla";
  return a > 0 ? "minimo" : "maximo";
}

/**
 * ¿Seguro que no tiene puntos críticos? Sí si alguna parcial depende de una sola variable y no se
 * anula nunca (por ejemplo, ∂f/∂x = 2eˣ). Si no se puede asegurar así, false.
 */
export function hasNoCriticalPoints(f: Expr): boolean {
  for (const [v, other] of [
    ["x", "y"],
    ["y", "x"],
  ] as const) {
    const d = derivative(f, v);
    if (dependsOn(d, other)) continue;
    // zerosOf trabaja en x: si la parcial es de y, se cambia el nombre de la variable.
    const inX = v === "x" ? d : swapXY(d);
    const samples = Array.from({ length: 81 }, (_, i) => evaluate(inX, { x: -20 + i / 2 }));
    if (zerosOf(inX).length === 0 && samples.every((s) => Number.isFinite(s) && Math.abs(s) > 1e-12) && samples.every((s) => Math.sign(s) === Math.sign(samples[0]!))) return true;
  }
  return false;
}

function swapXY(e: Expr): Expr {
  switch (e.k) {
    case "var":
      return { k: "var", name: e.name === "x" ? "y" : "x" };
    case "add":
    case "mul":
      return { ...e, args: e.args.map(swapXY) };
    case "div":
    case "pow":
      return { ...e, a: swapXY(e.a), b: swapXY(e.b) };
    case "neg":
    case "fn":
      return { ...e, a: swapXY(e.a) };
    case "d":
      return { ...e, a: swapXY(e.a), v: e.v === "x" ? "y" : "x" };
    default:
      return e;
  }
}
