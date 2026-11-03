// Dominio de definición de una función sencilla de x (raíces cuadradas, logaritmos, cocientes y sus
// combinaciones) como unión de intervalos, y su escritura: «[−2, 2]», «(−∞, 1) ∪ (1, +∞)» o
// «ℝ ∖ {1}». Cómo: se buscan los puntos donde se anula algo que pone condiciones (lo de dentro de una
// raíz o un logaritmo, un denominador, la base de una potencia no entera) y, entre ellos, se mira en un
// punto si f está definida; en cada punto de corte, también. Las raíces enteras o con denominador
// pequeño salen exactas (la malla las pisa); las demás, por bisección.
import { evaluate, type Expr } from "./expr.ts";
import { snapNice } from "./limits.ts";

export interface Interval {
  /** Extremos (pueden ser ±Infinity). */
  lo: number;
  hi: number;
  loClosed: boolean;
  hiClosed: boolean;
}

/** Intervalos disjuntos y ordenados. */
export type IntervalSet = Interval[];

export const REALS: IntervalSet = [{ lo: -Infinity, hi: Infinity, loClosed: false, hiClosed: false }];

/** Lo que pone condiciones en f: argumentos de sqrt y ln, denominadores y bases de potencias no enteras. */
function conditions(e: Expr, out: Expr[] = []): Expr[] {
  switch (e.k) {
    case "add":
    case "mul":
      e.args.forEach((a) => conditions(a, out));
      break;
    case "div":
      out.push(e.b);
      conditions(e.a, out);
      conditions(e.b, out);
      break;
    case "pow":
      if (!(e.b.k === "num" && e.b.v.d === 1n && e.b.v.n >= 0n)) out.push(e.a);
      conditions(e.a, out);
      conditions(e.b, out);
      break;
    case "neg":
      conditions(e.a, out);
      break;
    case "fn":
      if (e.name === "ln" || e.name === "sqrt" || e.name === "tan") out.push(e.name === "tan" ? { k: "fn", name: "cos", a: e.a } : e.a);
      conditions(e.a, out);
      break;
    default:
      break;
  }
  return out;
}

const STEP = 1 / 24;

/** Ceros de g en [−R, R]: los de la malla (múltiplos de 1/24), cambios de signo y mínimos de |g| que tocan 0. */
export function zerosOf(g: Expr, R = 40): number[] {
  const n = Math.round((2 * R) / STEP);
  const xs = Array.from({ length: n + 1 }, (_, i) => snapNice(-R + i * STEP, 1e-12));
  const vs = xs.map((x) => evaluate(g, { x }));
  const found: number[] = [];
  const push = (x: number) => {
    const s = snapNice(x, 1e-9);
    if (!found.some((y) => Math.abs(y - s) < 1e-9)) found.push(s);
  };
  const f = (x: number) => evaluate(g, { x });
  for (let i = 0; i <= n; i++) {
    const v = vs[i]!;
    if (v === 0) push(xs[i]!);
    if (i === n) break;
    const w = vs[i + 1]!;
    if (Number.isFinite(v) && Number.isFinite(w) && v * w < 0) {
      let a = xs[i]!;
      let b = xs[i + 1]!;
      for (let k = 0; k < 80; k++) {
        const m = (a + b) / 2;
        const fm = f(m);
        if (fm === 0) {
          a = b = m;
          break;
        }
        if (Math.sign(fm) === Math.sign(f(a))) a = m;
        else b = m;
      }
      push((a + b) / 2);
    }
    // Un cero doble que no cae en la malla: |g| baja y vuelve a subir sin cambiar de signo.
    if (i > 0 && Number.isFinite(v) && Math.abs(v) < Math.abs(vs[i - 1]!) && Math.abs(v) < Math.abs(w) && v !== 0 && Math.sign(vs[i - 1]!) === Math.sign(w)) {
      let a = xs[i - 1]!;
      let b = xs[i + 1]!;
      for (let k = 0; k < 120; k++) {
        const m1 = a + (b - a) / 3;
        const m2 = b - (b - a) / 3;
        if (Math.abs(f(m1)) < Math.abs(f(m2))) b = m2;
        else a = m1;
      }
      const m = (a + b) / 2;
      if (Math.abs(f(m)) < 1e-10) push(m);
    }
  }
  return found.sort((a, b) => a - b);
}

const defined = (f: Expr, x: number) => Number.isFinite(evaluate(f, { x }));

/** Dominio de f (funciones de x) dentro de [−R, R] y, fuera, como siga a los lados. */
export function domainOf(f: Expr, R = 40): IntervalSet {
  const cuts = [...new Set(conditions(f).flatMap((g) => zerosOf(g, R)))].sort((a, b) => a - b);
  if (cuts.length === 0) return defined(f, 0.5) ? REALS : [];
  // Trozos: (−∞, c₁), {c₁}, (c₁, c₂), …, {cₘ}, (cₘ, +∞).
  type Piece = { lo: number; hi: number; point: boolean; ok: boolean };
  const pieces: Piece[] = [];
  const at = (lo: number, hi: number) => (lo === -Infinity ? hi - 1 : hi === Infinity ? lo + 1 : (lo + hi) / 2);
  let prev = -Infinity;
  for (const c of cuts) {
    pieces.push({ lo: prev, hi: c, point: false, ok: defined(f, at(prev, c)) });
    pieces.push({ lo: c, hi: c, point: true, ok: defined(f, c) });
    prev = c;
  }
  pieces.push({ lo: prev, hi: Infinity, point: false, ok: defined(f, at(prev, Infinity)) });
  const out: IntervalSet = [];
  for (const p of pieces) {
    if (!p.ok) continue;
    const last = out[out.length - 1];
    if (last && last.hi === p.lo && (last.hiClosed || p.point)) {
      // Se pega al anterior: el punto de corte lo cierra o el trozo abierto sigue al punto. Dos trozos
      // abiertos separados por un punto que no está siguen siendo dos intervalos.
      last.hi = p.hi;
      last.hiClosed = p.point;
      continue;
    }
    out.push({ lo: p.lo, hi: p.hi, loClosed: p.point, hiClosed: p.point });
  }
  return out;
}

const close = (a: number, b: number) => a === b || Math.abs(a - b) < 1e-9;

export function intervalSetEquals(a: IntervalSet, b: IntervalSet): boolean {
  return (
    a.length === b.length &&
    a.every((x, i) => {
      const y = b[i]!;
      return close(x.lo, y.lo) && close(x.hi, y.hi) && (x.loClosed || x.lo === -Infinity) === (y.loClosed || y.lo === -Infinity) && (x.hiClosed || x.hi === Infinity) === (y.hiClosed || y.hi === Infinity);
    })
  );
}

/** ¿x está en el conjunto? */
export const inSet = (s: IntervalSet, x: number) =>
  s.some((i) => (x > i.lo || (i.loClosed && x === i.lo)) && (x < i.hi || (i.hiClosed && x === i.hi)));

/** Puntos aislados que faltan si el conjunto es ℝ menos unos puntos; si no, null. */
function missingPoints(s: IntervalSet): number[] | null {
  if (s.length === 0 || s[0]!.lo !== -Infinity || s[s.length - 1]!.hi !== Infinity) return null;
  const pts: number[] = [];
  for (let i = 0; i + 1 < s.length; i++) {
    const a = s[i]!;
    const b = s[i + 1]!;
    if (a.hi !== b.lo || a.hiClosed || b.loClosed) return null;
    pts.push(a.hi);
  }
  return pts;
}

/** Escritura de un conjunto: con `num` para los extremos (texto o TeX) y los símbolos de cada caso. */
function writeSet(s: IntervalSet, num: (v: number) => string, sym: { reals: string; empty: string; inf: string; minf: string; union: string; minus: (pts: string) => string; point: (v: string) => string }): string {
  if (s.length === 0) return sym.empty;
  const pts = missingPoints(s);
  if (pts) return pts.length === 0 ? sym.reals : sym.minus(pts.map(num).join(", "));
  return s
    .map((i) => {
      if (i.lo === i.hi) return sym.point(num(i.lo));
      const lo = i.lo === -Infinity ? sym.minf : num(i.lo);
      const hi = i.hi === Infinity ? sym.inf : num(i.hi);
      return `${i.loClosed ? "[" : "("}${lo}, ${hi}${i.hiClosed ? "]" : ")"}`;
    })
    .join(sym.union);
}

/** «(−∞, −2] ∪ [2, +∞)», «ℝ ∖ {1, 3}», «∅». */
export const intervalSetText = (s: IntervalSet, num: (v: number) => string) =>
  writeSet(s, num, { reals: "ℝ", empty: "∅", inf: "+∞", minf: "−∞", union: " ∪ ", minus: (p) => `ℝ ∖ {${p}}`, point: (v) => `{${v}}` });

/** Lo mismo en TeX. */
export const intervalSetTex = (s: IntervalSet, num: (v: number) => string) =>
  writeSet(s, num, {
    reals: "\\mathbb{R}",
    empty: "\\varnothing",
    inf: "+\\infty",
    minf: "-\\infty",
    union: " \\cup ",
    minus: (p) => `\\mathbb{R}\\setminus\\{${p}\\}`,
    point: (v) => `\\{${v}\\}`,
  });

/** Lectura en voz: «unión de …», con las palabras de clase. */
export function intervalSetSpoken(s: IntervalSet, num: (v: number) => string): string {
  if (s.length === 0) return "conjunto vacío";
  const pts = missingPoints(s);
  if (pts) return pts.length === 0 ? "todos los números reales" : `los reales menos ${pts.map(num).join(" y ")}`;
  const end = (v: number) => (v === Infinity ? "más infinito" : v === -Infinity ? "menos infinito" : num(v));
  return s
    .map((i) =>
      i.lo === i.hi
        ? `el punto ${num(i.lo)}`
        : `intervalo ${i.loClosed ? "cerrado" : "abierto"} en ${end(i.lo)} y ${i.hiClosed ? "cerrado" : "abierto"} en ${end(i.hi)}`,
    )
    .join(" unión ");
}
