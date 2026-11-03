// ¿Son la misma función? Primero un atajo estructural (misma forma simplificada, sin importar el
// orden) y, si no, evaluación en muchos puntos al azar (con semilla fija: siempre los mismos) con
// tolerancia relativa. Los puntos donde alguna de las dos no está definida (ln de un negativo, una
// división por cero) se saltan, así que ln(x²) y 2·ln x se aceptan donde coinciden. Si casi no quedan
// puntos válidos, se dice que no se puede comprobar en vez de dar por buena la respuesta.
import { createRng } from "../exercises/random.ts";
import { evaluate, hasD, type Expr, type VarName } from "./expr.ts";
import { resolveD } from "./derive.ts";
import { simplifiedKey } from "./simplify.ts";

export type Equivalence =
  | { kind: "equal"; via: "structure" | "numeric" }
  | { kind: "different"; at: { x: number; y: number }; left: number; right: number }
  | { kind: "unknown" };

const SAMPLES = 60;
const MIN_VALID = 12;

/** Puntos de prueba: unos pequeños y otros más grandes, positivos y negativos, nunca enteros justos. */
function samplePoints(vars: readonly VarName[]): Array<{ x: number; y: number }> {
  const rng = createRng(0x5eed);
  const pts: Array<{ x: number; y: number }> = [];
  const draw = (i: number) => {
    const scale = i % 3 === 0 ? 0.9 : i % 3 === 1 ? 2.7 : 6;
    const v = (rng.next() * 2 - 1) * scale;
    return Math.abs(v) < 0.05 ? v + 0.137 : v;
  };
  for (let i = 0; i < SAMPLES; i++) pts.push({ x: draw(i), y: vars.includes("y") ? draw(i + 1) : 0 });
  // Unos cuantos solo positivos, para las funciones con ln o raíces.
  for (let i = 0; i < 20; i++) pts.push({ x: 0.1 + rng.next() * 4, y: vars.includes("y") ? 0.1 + rng.next() * 4 : 0 });
  return pts;
}
const POINTS_X = samplePoints(["x"]);
const POINTS_XY = samplePoints(["x", "y"]);

/** ¿Valen lo mismo dos números? Tolerancia relativa (y absoluta cerca de 0). */
export const close = (a: number, b: number, tol = 1e-7) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/**
 * Compara dos expresiones como funciones de x (o de x e y). Las derivadas sin hacer, (u)′, se
 * resuelven antes, así que sirve para las líneas de una derivación.
 */
export function equivalent(a: Expr, b: Expr, vars: readonly VarName[] = ["x"]): Equivalence {
  const ra = hasD(a) ? resolveD(a) : a;
  const rb = hasD(b) ? resolveD(b) : b;
  if (simplifiedKey(ra) === simplifiedKey(rb)) return { kind: "equal", via: "structure" };
  const pts = vars.includes("y") ? POINTS_XY : POINTS_X;
  let valid = 0;
  for (const p of pts) {
    const va = evaluate(ra, p);
    const vb = evaluate(rb, p);
    if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
    // Valores enormes (eˣ con x grande): se comparan igual, con tolerancia relativa.
    valid++;
    if (!close(va, vb, 1e-6)) return { kind: "different", at: p, left: va, right: vb };
  }
  return valid >= MIN_VALID ? { kind: "equal", via: "numeric" } : { kind: "unknown" };
}

/** Atajo: ¿son equivalentes? (lo desconocido cuenta como no). */
export const isEquivalent = (a: Expr, b: Expr, vars: readonly VarName[] = ["x"]) => equivalent(a, b, vars).kind === "equal";

/**
 * ¿Difieren en una constante? (para las primitivas: F y G valen si F − G es constante). Se mira la
 * diferencia en los puntos válidos.
 */
export function differByConstant(a: Expr, b: Expr): boolean {
  let first: number | null = null;
  let valid = 0;
  for (const p of POINTS_X) {
    const va = evaluate(a, p);
    const vb = evaluate(b, p);
    if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
    valid++;
    const diff = va - vb;
    if (first === null) first = diff;
    else if (!close(diff, first, 1e-6)) return false;
  }
  return valid >= MIN_VALID;
}
