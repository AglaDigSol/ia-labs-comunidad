// Transformaciones lineales del plano: la matriz (exacta) de los movimientos que se ven en clase
// (giros de múltiplos de 90°, simetrías, cizallas, escalados y proyecciones), su descripción en
// palabras y ayudas numéricas para dibujar (imagen de un punto y direcciones propias reales). Las
// ayudas para dibujar usan number: no deciden ninguna corrección.
import { frac, type Frac } from "../rational.ts";
import { fracText, type Matrix } from "./matrix.ts";

export type TransformSpec =
  | { kind: "rotacion"; degrees: 90 | 180 | 270 }
  | { kind: "reflexion"; axis: "x" | "y" | "y=x" | "y=-x" }
  | { kind: "cizalla"; direction: "horizontal" | "vertical"; k: number }
  | { kind: "escala"; a: number; b: number }
  | { kind: "proyeccion"; axis: "x" | "y" };

const I = (x: number): Frac => frac(BigInt(x));

/** Matriz estándar: sus columnas son las imágenes de e₁ = (1, 0) y e₂ = (0, 1). */
export function transformMatrix(t: TransformSpec): Matrix {
  const m = (a: number, b: number, c: number, d: number): Matrix => [
    [I(a), I(b)],
    [I(c), I(d)],
  ];
  switch (t.kind) {
    case "rotacion":
      return t.degrees === 90 ? m(0, -1, 1, 0) : t.degrees === 180 ? m(-1, 0, 0, -1) : m(0, 1, -1, 0);
    case "reflexion":
      return t.axis === "x" ? m(1, 0, 0, -1) : t.axis === "y" ? m(-1, 0, 0, 1) : t.axis === "y=x" ? m(0, 1, 1, 0) : m(0, -1, -1, 0);
    case "cizalla":
      return t.direction === "horizontal" ? m(1, t.k, 0, 1) : m(1, 0, t.k, 1);
    case "escala":
      return m(t.a, 0, 0, t.b);
    case "proyeccion":
      return t.axis === "x" ? m(1, 0, 0, 0) : m(0, 0, 0, 1);
  }
}

/** La transformación en palabras, como en un enunciado. */
export function describeTransform(t: TransformSpec): string {
  const k = (x: number) => fracText(I(x));
  switch (t.kind) {
    case "rotacion":
      return t.degrees === 270
        ? "Giro de 90° en sentido horario (o de 270° en sentido antihorario) alrededor del origen."
        : `Giro de ${t.degrees}° en sentido antihorario alrededor del origen.`;
    case "reflexion":
      return t.axis === "x"
        ? "Simetría respecto del eje X."
        : t.axis === "y"
          ? "Simetría respecto del eje Y."
          : t.axis === "y=x"
            ? "Simetría respecto de la recta y = x."
            : "Simetría respecto de la recta y = −x.";
    case "cizalla":
      return t.direction === "horizontal"
        ? `Cizalla horizontal de factor ${k(t.k)}: (x, y) ↦ (x + ${k(t.k)}·y, y).`
        : `Cizalla vertical de factor ${k(t.k)}: (x, y) ↦ (x, ${k(t.k)}·x + y).`;
    case "escala":
      return `Escalado: multiplica la coordenada x por ${k(t.a)} y la y por ${k(t.b)}.`;
    case "proyeccion":
      return `Proyección ortogonal sobre el eje ${t.axis === "x" ? "X" : "Y"}.`;
  }
}

// ---------------------------------------------------------------- Ayudas para dibujar (number)

export type M2 = [[number, number], [number, number]];

export const apply2 = (m: M2, [x, y]: readonly [number, number]): [number, number] => [m[0][0] * x + m[0][1] * y, m[1][0] * x + m[1][1] * y];

export const det2 = (m: M2): number => m[0][0] * m[1][1] - m[0][1] * m[1][0];

export type EigenDirections =
  | { kind: "none" }
  | { kind: "all"; lambda: number }
  | { kind: "lines"; lines: Array<{ lambda: number; dir: [number, number] }> };

const EPS = 1e-9;

/** Direcciones propias reales de una matriz 2×2 (para dibujarlas). */
export function eigenDirections2(m: M2): EigenDirections {
  const [[a, b], [c, d]] = m;
  const tr = a + d;
  const disc = tr * tr - 4 * det2(m);
  if (disc < -EPS) return { kind: "none" };
  const s = Math.sqrt(Math.max(0, disc));
  const lambdas = Math.abs(s) < EPS ? [tr / 2] : [(tr + s) / 2, (tr - s) / 2];
  if (lambdas.length === 1 && Math.abs(b) < EPS && Math.abs(c) < EPS && Math.abs(a - d) < EPS) return { kind: "all", lambda: a };
  const lines = lambdas.map((lambda) => {
    // (A − λI)·v = 0: v = (b, λ − a) o (λ − d, c), el que no sea nulo.
    let dir: [number, number] = Math.abs(b) > EPS || Math.abs(lambda - a) > EPS ? [b, lambda - a] : [lambda - d, c];
    if (Math.hypot(dir[0], dir[1]) < EPS) dir = Math.abs(a - lambda) < EPS && Math.abs(c) < EPS ? [1, 0] : [0, 1];
    const n = Math.hypot(dir[0], dir[1]);
    return { lambda, dir: [dir[0] / n, dir[1] / n] as [number, number] };
  });
  return { kind: "lines", lines };
}
