// Simulador de descenso de gradiente para f(x) y f(x, y): descenso de gradiente simple
// (xₖ₊₁ = xₖ − α·∇f(xₖ)), con momento (vₖ₊₁ = β·vₖ − α·∇f(xₖ), xₖ₊₁ = xₖ + vₖ₊₁) y Adam. El
// gradiente es el simbólico (derive.ts), compilado una vez. Devuelve la trayectoria, f y ‖∇f‖ en cada
// iteración y cómo acaba: converge (‖∇f‖ muy pequeño), diverge (se va lejos o deja de ser finito) o se
// queda sin iteraciones. Determinista y con un máximo de iteraciones, para que sea rápido.
import { compile, exprVars, type Expr } from "./expr.ts";
import { derivative } from "./derive.ts";

export const MAX_ITERATIONS = 500;
export const METHODS = ["gd", "momentum", "adam"] as const;
export type Method = (typeof METHODS)[number];
export const METHOD_LABEL: Record<Method, string> = { gd: "Descenso de gradiente", momentum: "Con momento", adam: "Adam" };

export type DescentOptions = {
  alpha: number;
  start: readonly number[];
  iterations: number;
  method?: Method;
  /** β del momento (0,9 por defecto). */
  beta?: number;
  /** Tolerancia de ‖∇f‖ para dar por convergido. */
  tol?: number;
  /** Más allá de este tamaño se da por divergido. */
  limit?: number;
};

export type DescentStatus = "converge" | "diverge" | "max";

export type DescentRun = {
  dim: 1 | 2;
  /** Puntos x₀, x₁, … (uno o dos números cada uno). */
  points: number[][];
  values: number[];
  gradNorms: number[];
  status: DescentStatus;
  /** Iteración en la que se para. */
  stoppedAt: number;
};

export type Objective = { dim: 1 | 2; f: (p: readonly number[]) => number; grad: (p: readonly number[]) => number[] };

/** Prepara f y su gradiente simbólico como funciones numéricas. */
export function objective(f: Expr, dim?: 1 | 2): Objective {
  const n = dim ?? (exprVars(f).includes("y") ? 2 : 1);
  const fc = compile(f);
  if (n === 1) {
    const g = compile(derivative(f, "x"));
    return { dim: 1, f: (p) => fc(p[0]!), grad: (p) => [g(p[0]!)] };
  }
  const gx = compile(derivative(f, "x"));
  const gy = compile(derivative(f, "y"));
  return { dim: 2, f: (p) => fc(p[0]!, p[1]!), grad: (p) => [gx(p[0]!, p[1]!), gy(p[0]!, p[1]!)] };
}

const norm = (v: readonly number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));

/** Ejecuta el método elegido desde `start`. */
export function runDescent(obj: Objective, opts: DescentOptions): DescentRun {
  const method = opts.method ?? "gd";
  const iterations = Math.max(0, Math.min(MAX_ITERATIONS, Math.floor(opts.iterations)));
  const beta = opts.beta ?? 0.9;
  const tol = opts.tol ?? 1e-6;
  const limit = opts.limit ?? 1e6;
  const alpha = opts.alpha;
  let p = opts.start.slice(0, obj.dim).map(Number);
  const points = [p];
  const values = [obj.f(p)];
  let g = obj.grad(p);
  const gradNorms = [norm(g)];
  let v = p.map(() => 0);
  let m = p.map(() => 0);
  let s = p.map(() => 0);
  let status: DescentStatus = "max";
  let stoppedAt = iterations;
  if (gradNorms[0]! <= tol) return { dim: obj.dim, points, values, gradNorms, status: "converge", stoppedAt: 0 };
  for (let k = 1; k <= iterations; k++) {
    if (method === "gd") p = p.map((x, i) => x - alpha * g[i]!);
    else if (method === "momentum") {
      v = v.map((vi, i) => beta * vi - alpha * g[i]!);
      p = p.map((x, i) => x + v[i]!);
    } else {
      // Adam con β₁ = 0,9, β₂ = 0,999 y ε = 10⁻⁸.
      m = m.map((mi, i) => 0.9 * mi + 0.1 * g[i]!);
      s = s.map((si, i) => 0.999 * si + 0.001 * g[i]! * g[i]!);
      const mh = m.map((mi) => mi / (1 - Math.pow(0.9, k)));
      const sh = s.map((si) => si / (1 - Math.pow(0.999, k)));
      p = p.map((x, i) => x - (alpha * mh[i]!) / (Math.sqrt(sh[i]!) + 1e-8));
    }
    const fv = obj.f(p);
    g = obj.grad(p);
    const gn = norm(g);
    points.push(p);
    values.push(fv);
    gradNorms.push(gn);
    if (!p.every(Number.isFinite) || !Number.isFinite(fv) || !Number.isFinite(gn) || norm(p) > limit) {
      status = "diverge";
      stoppedAt = k;
      break;
    }
    if (gn <= tol) {
      status = "converge";
      stoppedAt = k;
      break;
    }
  }
  return { dim: obj.dim, points, values, gradNorms, status, stoppedAt };
}

/**
 * ¿Oscila? Signos alternos en el paso de una coordenada durante las primeras iteraciones (pasa de
 * un lado al otro del mínimo).
 */
export function oscillates(run: DescentRun, coord = 0, window = 8): boolean {
  const steps = run.points.slice(1, window + 1).map((q, i) => q[coord]! - run.points[i]![coord]!);
  if (steps.length < 3) return false;
  let flips = 0;
  for (let i = 1; i < steps.length; i++) if (steps[i]! * steps[i - 1]! < 0) flips++;
  return flips >= steps.length - 2;
}

/** Iteraciones hasta que f baja de `level` (o null si no llega). */
export function iterationsTo(run: DescentRun, level: number): number | null {
  const i = run.values.findIndex((v) => v <= level);
  return i < 0 ? null : i;
}
