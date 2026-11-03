// Formas (shapes) de tensores con las reglas de NumPy: número de ejes (ndim), tamaño, emisión
// (broadcasting) de a + b, producto a @ b (con lotes y vectores 1-D), a.sum(axis=k), a.reshape(…) y
// a.T. Cada regla devuelve, además del resultado, una explicación eje a eje para después de contestar.
// Solo trabaja con formas: no hay datos ni cálculos numéricos.

export type Shape = number[];

export const MAX_NDIM = 6;
export const MAX_DIM = 4096;

export const ndim = (s: Shape) => s.length;
export const shapeSize = (s: Shape) => s.reduce((a, b) => a * b, 1);

/** «(2, 3)», «(3,)», «()» — como las escribe NumPy. */
export const shapeText = (s: Shape) => (s.length === 1 ? `(${s[0]},)` : `(${s.join(", ")})`);

export type ShapeParse = { ok: true; value: Shape } | { ok: false; error: string };
export const SHAPE_ERROR = "Escribe la forma como en NumPy: (2, 3), (3,) o () para un escalar.";

/** Lee una forma: «(2, 3)», «[2, 3]», «2, 3», «2 3», «(3,)» o «()». */
export function parseShape(text: string): ShapeParse {
  const t = text.trim();
  if (t.length > 60) return { ok: false, error: SHAPE_ERROR };
  const inner = t.replace(/^[([]\s*/, "").replace(/\s*[)\]]$/, "");
  if (inner === "") return /^[([]\s*[)\]]$/.test(t) ? { ok: true, value: [] } : { ok: false, error: SHAPE_ERROR };
  const clean = inner.split(/[\s,]+/).filter((p) => p !== "");
  if (clean.length === 0 || clean.length > MAX_NDIM || !clean.every((p) => /^\d+$/.test(p))) return { ok: false, error: SHAPE_ERROR };
  const value = clean.map(Number);
  if (value.some((d) => d > MAX_DIM)) return { ok: false, error: SHAPE_ERROR };
  return { ok: true, value };
}

export const shapeEquals = (a: Shape, b: Shape) => a.length === b.length && a.every((x, i) => x === b[i]);

// ---------------------------------------------------------------- Emisión (broadcasting)

export type BroadcastRule = "iguales" | "a-uno" | "b-uno" | "falta-a" | "falta-b" | "incompatible";

export interface BroadcastDim {
  a: number | null;
  b: number | null;
  result: number | null;
  rule: BroadcastRule;
}

export type BroadcastResult = { ok: true; shape: Shape; dims: BroadcastDim[] } | { ok: false; dims: BroadcastDim[] };

/**
 * Reglas de NumPy: se alinean las formas por la derecha; en cada eje, las longitudes tienen que ser
 * iguales o una de ellas 1 (que se repite); al que le faltan ejes se le añaden unos por la izquierda.
 */
export function broadcastShapes(a: Shape, b: Shape): BroadcastResult {
  const n = Math.max(a.length, b.length);
  const dims: BroadcastDim[] = [];
  for (let k = n - 1; k >= 0; k--) {
    const da = a[a.length - 1 - k] ?? null;
    const db = b[b.length - 1 - k] ?? null;
    let d: BroadcastDim;
    if (da === null) d = { a: null, b: db, result: db, rule: "falta-a" };
    else if (db === null) d = { a: da, b: null, result: da, rule: "falta-b" };
    else if (da === db) d = { a: da, b: db, result: da, rule: "iguales" };
    else if (da === 1) d = { a: da, b: db, result: db, rule: "a-uno" };
    else if (db === 1) d = { a: da, b: db, result: da, rule: "b-uno" };
    else d = { a: da, b: db, result: null, rule: "incompatible" };
    dims.push(d);
  }
  if (dims.some((d) => d.rule === "incompatible")) return { ok: false, dims };
  return { ok: true, shape: dims.map((d) => d.result!), dims };
}

/** Un eje de la emisión, en palabras. */
export function broadcastDimText(d: BroadcastDim, names: [string, string] = ["a", "b"]): string {
  const [A, B] = names;
  switch (d.rule) {
    case "iguales":
      return `${A} y ${B} tienen ${d.a}: coinciden y queda ${d.result}.`;
    case "a-uno":
      return `${A} tiene 1 y ${B} tiene ${d.b}: ${A} se repite a lo largo de este eje y queda ${d.result}.`;
    case "b-uno":
      return `${B} tiene 1 y ${A} tiene ${d.a}: ${B} se repite a lo largo de este eje y queda ${d.result}.`;
    case "falta-a":
      return `${A} no tiene este eje: se le añade un 1 por la izquierda y se repite hasta ${d.result}.`;
    case "falta-b":
      return `${B} no tiene este eje: se le añade un 1 por la izquierda y se repite hasta ${d.result}.`;
    case "incompatible":
      return `${A} tiene ${d.a} y ${B} tiene ${d.b}: no son iguales y ninguno es 1, así que no se pueden emitir. NumPy da un error.`;
  }
}

// ---------------------------------------------------------------- Operaciones

export type TensorOp =
  | { op: "suma"; a: Shape; b: Shape }
  | { op: "matmul"; a: Shape; b: Shape }
  | { op: "sum"; a: Shape; axis: number | null; keepdims?: boolean }
  | { op: "reshape"; a: Shape; target: number[] }
  | { op: "T"; a: Shape };

export type TensorOpResult = { ok: true; shape: Shape; explain: string[] } | { ok: false; explain: string[] };

/** El código de la operación, como en Python: «a + b», «a @ b», «a.sum(axis=1)», «a.reshape(2, -1)», «a.T». */
export function tensorOpCode(q: TensorOp): string {
  switch (q.op) {
    case "suma":
      return "a + b";
    case "matmul":
      return "a @ b";
    case "sum": {
      const args = [q.axis === null ? null : `axis=${q.axis}`, q.keepdims ? "keepdims=True" : null].filter(Boolean);
      return `a.sum(${args.join(", ")})`;
    }
    case "reshape":
      return `a.reshape(${q.target.join(", ")})`;
    case "T":
      return "a.T";
  }
}

function matmul(a: Shape, b: Shape): TensorOpResult {
  if (a.length === 0 || b.length === 0) return { ok: false, explain: ["@ no admite escalares (tensores de forma ()): usa * para multiplicar por un número."] };
  const explain: string[] = [];
  const A = a.length === 1 ? [1, a[0]!] : a;
  const B = b.length === 1 ? [b[0]!, 1] : b;
  if (a.length === 1) explain.push(`a es un vector 1-D: se trata como una fila ${shapeText(A)} y al final se quita ese 1.`);
  if (b.length === 1) explain.push(`b es un vector 1-D: se trata como una columna ${shapeText(B)} y al final se quita ese 1.`);
  const k1 = A[A.length - 1]!;
  const k2 = B[B.length - 2]!;
  if (k1 !== k2) {
    explain.push(`El último eje de a (${k1}) tiene que coincidir con el penúltimo de b (${k2}): no coinciden, así que NumPy da un error.`);
    return { ok: false, explain };
  }
  explain.push(`El último eje de a y el penúltimo de b coinciden (${k1}): se suman los productos a lo largo de ese eje y desaparece.`);
  const batchA = A.slice(0, -2);
  const batchB = B.slice(0, -2);
  let batch: Shape = [];
  if (batchA.length > 0 || batchB.length > 0) {
    const r = broadcastShapes(batchA, batchB);
    explain.push(`Los ejes de lote ${shapeText(batchA)} y ${shapeText(batchB)} se emiten como en la suma:`);
    for (const d of r.dims) explain.push(`· ${broadcastDimText(d)}`);
    if (!r.ok) return { ok: false, explain };
    batch = r.shape;
  }
  const out = [...batch, ...(a.length === 1 ? [] : [A[A.length - 2]!]), ...(b.length === 1 ? [] : [B[B.length - 1]!])];
  explain.push(`Resultado: ${shapeText(out)}.`);
  return { ok: true, shape: out, explain };
}

/** El resultado de la operación (o el error de NumPy) y su explicación. */
export function tensorOpResult(q: TensorOp): TensorOpResult {
  switch (q.op) {
    case "suma": {
      const r = broadcastShapes(q.a, q.b);
      const explain = [`Se alinean ${shapeText(q.a)} y ${shapeText(q.b)} por la derecha y se miran eje a eje:`, ...r.dims.map((d) => `· ${broadcastDimText(d)}`)];
      return r.ok ? { ok: true, shape: r.shape, explain: [...explain, `Resultado: ${shapeText(r.shape)}.`] } : { ok: false, explain };
    }
    case "matmul":
      return matmul(q.a, q.b);
    case "sum": {
      const n = q.a.length;
      if (q.axis === null) {
        const shape = q.keepdims ? q.a.map(() => 1) : [];
        return { ok: true, shape, explain: [`Sin axis se suman todos los elementos: ${q.keepdims ? "con keepdims=True cada eje queda con longitud 1" : "queda un escalar, de forma ()"}.`] };
      }
      if (q.axis < -n || q.axis >= n) return { ok: false, explain: [`a tiene ${n} ejes (0 a ${n - 1}, o −1 a −${n} desde el final): axis=${q.axis} no existe y NumPy da un error.`] };
      const ax = q.axis < 0 ? q.axis + n : q.axis;
      const shape = q.keepdims ? q.a.map((d, i) => (i === ax ? 1 : d)) : q.a.filter((_, i) => i !== ax);
      const where = q.axis < 0 ? `axis=${q.axis} es el eje ${ax} contando desde 0` : `El eje ${ax}`;
      return {
        ok: true,
        shape,
        explain: [`${where} (longitud ${q.a[ax]}): se suma a lo largo de él y ${q.keepdims ? "queda con longitud 1 (keepdims=True)" : "desaparece"}. Resultado: ${shapeText(shape)}.`],
      };
    }
    case "reshape": {
      const size = shapeSize(q.a);
      const unknown = q.target.filter((d) => d === -1).length;
      if (unknown > 1) return { ok: false, explain: ["Solo un eje puede ser −1 (el que NumPy calcula): hay más de uno y da un error."] };
      if (q.target.some((d) => d < -1)) return { ok: false, explain: ["Las longitudes no pueden ser negativas (salvo un −1)."] };
      const known = q.target.filter((d) => d !== -1).reduce((x, y) => x * y, 1);
      if (unknown === 1) {
        if (known === 0 || size % known !== 0) {
          return { ok: false, explain: [`a tiene ${size} elementos y ${size} no es múltiplo de ${known}: no hay longitud entera para el −1 y NumPy da un error.`] };
        }
        const shape = q.target.map((d) => (d === -1 ? size / known : d));
        return { ok: true, shape, explain: [`a tiene ${size} elementos. El −1 se calcula para que salgan los mismos: ${size} / ${known} = ${size / known}. Resultado: ${shapeText(shape)}.`] };
      }
      if (known !== size) return { ok: false, explain: [`a tiene ${size} elementos y ${shapeText(q.target)} tiene ${known}: reshape no cambia el número de elementos, así que NumPy da un error.`] };
      return { ok: true, shape: [...q.target], explain: [`a tiene ${size} elementos y ${shapeText(q.target)} también: vale. Resultado: ${shapeText(q.target)}.`] };
    }
    case "T": {
      const shape = [...q.a].reverse();
      return {
        ok: true,
        shape,
        explain: [q.a.length <= 1 ? `En un tensor de ${q.a.length} ejes, .T no cambia nada: ${shapeText(shape)}.` : `.T invierte el orden de los ejes: ${shapeText(q.a)} pasa a ${shapeText(shape)}.`],
      };
    }
  }
}
