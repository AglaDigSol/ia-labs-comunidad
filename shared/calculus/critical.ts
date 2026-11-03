// Puntos críticos de un polinomio f(x, y) y su clasificación con la hessiana: en un punto con
// ∇f = 0, si |H| > 0 es un mínimo (fxx > 0) o un máximo (fxx < 0); si |H| < 0, un punto de silla; si
// |H| = 0, el criterio no decide. Todo con racionales exactos (el determinante es el de
// shared/linalg). Se resuelve ∇f = 0 cuando el sistema se deja: una de las parciales es de grado 1 en
// una variable con coeficiente constante (se despeja y se sustituye) o las dos parciales están
// separadas (cada una en una sola variable). Con raíces irracionales, se avisa.
import { matrixDeterminant } from "../linalg/det.ts";
import { rationalRoots } from "../linalg/eigen.ts";
import { add as fadd, cmp, div as fdiv, equals, frac, isZero, mul as fmul, sign, toNumber, type Frac } from "../rational.ts";
import type { Expr } from "./expr.ts";
import {
  exprToPoly,
  polyDegreeIn,
  polyDerivative,
  polyEval2,
  polyScale2,
  polySplitLinearY,
  polySubstituteY,
  polySwap,
  polyUnivariate,
  type Poly2,
} from "./poly.ts";

export type CriticalKind = "minimo" | "maximo" | "silla" | "no-concluyente";
export const CRITICAL_LABEL: Record<CriticalKind, string> = {
  minimo: "Mínimo local",
  maximo: "Máximo local",
  silla: "Punto de silla",
  "no-concluyente": "El criterio no decide (|H| = 0)",
};

export type Point2 = { x: Frac; y: Frac };
export type Hessian2 = [[Frac, Frac], [Frac, Frac]];

export function hessianAt(p: Poly2, at: Point2): Hessian2 {
  const fx = polyDerivative(p, "x");
  const fy = polyDerivative(p, "y");
  const e = (q: Poly2) => polyEval2(q, at.x, at.y);
  const fxy = e(polyDerivative(fx, "y"));
  return [
    [e(polyDerivative(fx, "x")), fxy],
    [fxy, e(polyDerivative(fy, "y"))],
  ];
}

/** Clasificación de un punto crítico por el criterio de la hessiana. */
export function classifyHessian(H: Hessian2): { kind: CriticalKind; det: Frac } {
  const det = matrixDeterminant(H);
  const s = sign(det);
  if (s > 0) return { kind: sign(H[0][0]) > 0 ? "minimo" : "maximo", det };
  if (s < 0) return { kind: "silla", det };
  return { kind: "no-concluyente", det };
}

export type CriticalAnalysis =
  | { ok: true; points: Array<Point2 & { kind: CriticalKind; H: Hessian2; det: Frac }> }
  | { ok: false; reason: "not-polynomial" | "unsupported" | "irrational" | "infinite" };

const ptKey = (p: Point2) => `${p.x.n}/${p.x.d},${p.y.n}/${p.y.d}`;

/** Raíces racionales de un polinomio en una variable (todas, o null si alguna no es racional). */
function allRoots(coefs: Frac[]): Frac[] | "all" | null {
  const trimmed = [...coefs];
  while (trimmed.length > 0 && isZero(trimmed[trimmed.length - 1]!)) trimmed.pop();
  if (trimmed.length === 0) return "all";
  if (trimmed.length === 1) return [];
  const r = rationalRoots(trimmed);
  const roots = r.roots.map((x) => x.value);
  if (r.complete) return roots;
  // Lo que queda tras quitar las raíces racionales: si no tiene raíces reales (x² + x + 1), no
  // estorba; si las tiene, son irracionales.
  let rest = trimmed;
  for (const { value, mult } of r.roots) for (let m = 0; m < mult; m++) rest = deflate(rest, value);
  return hasRealRoot(rest) ? null : roots;
}

/** Divide entre (x − r) por Ruffini (r es raíz). */
function deflate(p: Frac[], r: Frac): Frac[] {
  const out: Frac[] = new Array(p.length - 1);
  let acc = frac(0n);
  for (let k = p.length - 1; k >= 1; k--) {
    acc = fadd(fmul(acc, r), p[k]!);
    out[k - 1] = acc;
  }
  return out;
}

/** ¿Tiene alguna raíz real? (cambio de signo en una malla fina dentro de la cota de Cauchy). */
function hasRealRoot(p: Frac[]): boolean {
  const c = p.map(toNumber);
  const n = c.length - 1;
  if (n <= 0) return false;
  if (n % 2 === 1) return true;
  const bound = 1 + Math.max(...c.slice(0, n).map((a) => Math.abs(a / c[n]!)));
  const val = (x: number) => c.reduceRight((acc, a) => acc * x + a, 0);
  let prev = val(-bound);
  for (let i = 1; i <= 4000; i++) {
    const v = val(-bound + (2 * bound * i) / 4000);
    if (v === 0 || Math.sign(v) !== Math.sign(prev)) return true;
    prev = v;
  }
  return false;
}

/**
 * Resuelve ∇f = 0 cuando `linear` (una de las dos parciales) es de grado 1 en y con coeficiente
 * constante: y = q(x) y se sustituye en `other`.
 */
function solveLinearIn(linear: Poly2, other: Poly2): Point2[] | "irrational" | "infinite" | null {
  const split = polySplitLinearY(linear);
  if (!split) return null;
  const [a, b] = split;
  if (a.size === 0) return null;
  const ac = polyUnivariate(a, "x");
  if (!ac || ac.length !== 1) return null;
  const k = ac[0]!;
  // y = q(x) = −b(x)/k
  const q = polyScale2(b, fdiv(frac(-1n), k));
  const g = polySubstituteY(other, q);
  const roots = allRoots(polyUnivariate(g, "x")!);
  if (roots === "all") return "infinite";
  if (roots === null) return "irrational";
  return roots.map((x) => ({ x, y: polyEval2(q, x) }));
}

/** Puntos críticos de f (polinomio en x e y) con su clasificación. */
export function criticalPoints(f: Expr): CriticalAnalysis {
  const p = exprToPoly(f);
  if (!p) return { ok: false, reason: "not-polynomial" };
  const fx = polyDerivative(p, "x");
  const fy = polyDerivative(p, "y");
  let pts: Point2[] | "irrational" | "infinite" | null = null;
  const ux = polyUnivariate(fx, "x");
  const uy = polyUnivariate(fy, "y");
  if (ux && uy) {
    // Separadas: fx solo depende de x y fy solo de y.
    const rx = allRoots(ux);
    const ry = allRoots(uy);
    if (rx === "all" || ry === "all") pts = "infinite";
    else if (rx === null || ry === null) pts = "irrational";
    else pts = rx.flatMap((x) => ry.map((y) => ({ x, y })));
  }
  // Una parcial lineal en y (se despeja y) o en x (lo mismo con x e y cambiadas).
  for (const [lin, other, swapped] of [
    [fy, fx, false],
    [fx, fy, false],
    [fx, fy, true],
    [fy, fx, true],
  ] as const) {
    if (pts !== null) break;
    const s = swapped ? solveLinearIn(polySwap(lin), polySwap(other)) : solveLinearIn(lin, other);
    pts = Array.isArray(s) && swapped ? s.map((q) => ({ x: q.y, y: q.x })) : s;
  }
  if (pts === null) return { ok: false, reason: "unsupported" };
  if (pts === "irrational" || pts === "infinite") return { ok: false, reason: pts };
  // Sin repetidos y en orden (x, luego y).
  const unique = [...new Map(pts.map((q) => [ptKey(q), q])).values()].sort((a, b) => cmp(a.x, b.x) || cmp(a.y, b.y));
  // Comprobación: ∇f = 0 de verdad en cada uno.
  const verified = unique.filter((q) => isZero(polyEval2(fx, q.x, q.y)) && isZero(polyEval2(fy, q.x, q.y)));
  return {
    ok: true,
    points: verified.map((q) => {
      const H = hessianAt(p, q);
      const c = classifyHessian(H);
      return { ...q, H, kind: c.kind, det: c.det };
    }),
  };
}

/** ¿Es (x, y) un punto crítico? (∇f = 0 exacto). */
export function isCriticalPoint(f: Expr, at: Point2): boolean {
  const p = exprToPoly(f);
  if (!p) return false;
  return isZero(polyEval2(polyDerivative(p, "x"), at.x, at.y)) && isZero(polyEval2(polyDerivative(p, "y"), at.x, at.y));
}

export const samePoint = (a: Point2, b: Point2) => equals(a.x, b.x) && equals(a.y, b.y);

/** Grado de f en cada variable (para avisar de polinomios que no sabe resolver). */
export const polyDegrees = (f: Expr): [number, number] | null => {
  const p = exprToPoly(f);
  return p ? [polyDegreeIn(p, "x"), polyDegreeIn(p, "y")] : null;
};
