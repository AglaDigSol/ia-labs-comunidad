// Ejercicios de NumPy sin ejecutar código (01MIAR, NumPy; y la sesión de tensores de 02MIAR): la forma
// y el rango de un audio, una imagen o un vídeo guardados como arrays (con el convenio de NumPy/PIL o
// el de PyTorch, y el eje del lote), la forma tras np.expand_dims, np.squeeze o un índice o corte de un
// array de 3 dimensiones, y el desbordamiento de int8 y uint8 (la cuenta da la vuelta, módulo 256).
// No necesitan Pyodide: el resultado lo calculan estas reglas (y los tests lo comparan con NumPy).
import { intMatrix, type Matrix } from "../linalg/matrix.ts";
import { frac } from "../rational.ts";
import { cleanMistakes, dimsSize, dimsText, sameDims, sameMatrix, type Dims, type GuidedExercise, type GuidedStep, type Mistake } from "./guided.ts";
import { pickHints, type TaggedHint } from "./hints.ts";
import { generateUntil, rngFor, type Rng } from "./random.ts";
import type { ExerciseLevel, ExerciseType } from "./types.ts";

const ALL_LEVELS = ["básico", "medio", "avanzado"] as const;
const minus = (s: string) => s.replace(/-/g, "−");
/** Número con separador de miles fino para leer el enunciado (12 000), nunca en las respuestas. */
const big = (n: number) => (n >= 10000 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0") : String(n));
const decimalComma = (x: number) => String(x).replace(".", ",");
const intM = (value: bigint, text: string): Mistake<bigint> => ({ value, text });
const sameBig = (a: bigint, b: bigint) => a === b;

// ================================================================ Forma de un audio, una imagen o un vídeo

export type DataKind = "audio" | "imagen" | "video";
export type DataConvention = "numpy" | "pytorch";

export type DataShapeInstance = {
  kind: DataKind;
  /** Audio: muestras por segundo (Hz). Vídeo: fotogramas por segundo. */
  rate: number;
  /** Duración en segundos (audio y vídeo). */
  secs: number;
  /** Imagen y vídeo: alto y ancho en píxeles. */
  h: number;
  w: number;
  /** Cómo se da la resolución: «ancho × alto», «alto y ancho» o «720p». */
  res: "wxh" | "hw" | "p";
  channels: number;
  conv: DataConvention;
  batch: number | null;
  /** Avanzado: también los bytes, con este tipo. */
  dtype: "uint8" | "float32" | null;
};

/** La forma con el convenio del enunciado. */
export function dataShape(i: DataShapeInstance): number[] {
  const lote = i.batch === null ? [] : [i.batch];
  if (i.kind === "audio") {
    const n = i.rate * i.secs;
    return [...lote, ...(i.channels === 1 ? [] : [i.channels]), n];
  }
  const ch = i.channels === 1 ? [] : [i.channels];
  const img = i.conv === "numpy" ? [i.h, i.w, ...ch] : [...ch, i.h, i.w];
  if (i.kind === "imagen") return [...lote, ...img];
  return [...lote, i.rate * i.secs, ...img];
}

const BYTES = { uint8: 1, float32: 4 } as const;

const AUDIO_RATES = [8000, 16000, 22050, 44100, 48000] as const;
const VIDEO_FPS = [24, 25, 30, 60] as const;
const P_RES: Array<[number, number, string]> = [
  [480, 640, "480p (640 × 480)"],
  [720, 1280, "720p (1280 × 720)"],
  [1080, 1920, "1080p (1920 × 1080)"],
];
const IMG_SIZES: Array<[number, number]> = [
  [28, 28],
  [32, 32],
  [64, 48],
  [48, 64],
  [224, 224],
  [600, 800],
  [800, 600],
  [1200, 2000],
  [480, 640],
  [256, 128],
];

function makeDataShape(rng: Rng, level: ExerciseLevel): DataShapeInstance {
  const kind = rng.pick(level === "básico" ? (["audio", "imagen", "imagen"] as const) : (["audio", "imagen", "video"] as const));
  const base: DataShapeInstance = { kind, rate: 0, secs: 0, h: 0, w: 0, res: "wxh", channels: 1, conv: "numpy", batch: null, dtype: null };
  if (kind === "audio") {
    base.rate = rng.pick(AUDIO_RATES);
    base.secs = rng.int(1, level === "básico" ? 5 : 10);
    base.channels = rng.pick([1, 2]);
    base.conv = "pytorch";
  } else {
    const color = rng.chance(level === "básico" ? 0.6 : 0.75);
    base.channels = color ? (level === "avanzado" && kind === "imagen" && rng.chance(0.25) ? 4 : 3) : 1;
    // En PyTorch, la imagen en gris lleva su eje de canales (1, H, W): para no liar, solo con NumPy.
    base.conv = color ? rng.pick(["numpy", "pytorch"] as const) : "numpy";
    if (kind === "video") {
      base.rate = rng.pick(VIDEO_FPS);
      base.secs = rng.pick([2, 5, 10, 20, 40, 60]);
      const [h, w] = rng.pick(P_RES);
      base.h = h;
      base.w = w;
      base.res = rng.chance(0.5) ? "p" : "wxh";
    } else {
      const [h, w] = rng.pick(IMG_SIZES);
      base.h = h;
      base.w = w;
      base.res = rng.chance(0.3) ? "hw" : "wxh";
    }
  }
  if (level !== "básico" && rng.chance(level === "medio" ? 0.35 : 0.6) && kind !== "video") base.batch = rng.pick([8, 16, 32, 64]);
  if (level === "avanzado" && kind === "video" && rng.chance(0.3)) base.batch = rng.pick([2, 4, 8]);
  if (level === "avanzado") base.dtype = kind === "audio" ? "float32" : rng.pick(["uint8", "float32"] as const);
  return base;
}

export const PY_DATA_SHAPE: ExerciseType<DataShapeInstance> = {
  id: "py-forma-datos",
  topic: "python",
  title: "Forma de un audio, una imagen o un vídeo",
  description:
    "Muestras o fotogramas, forma (shape) y rango (ndim) del array de un audio, una imagen o un vídeo: alto antes que ancho, canales al final (NumPy/PIL) o delante (PyTorch) y el lote primero.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("py-forma-datos", seed),
      (r) => makeDataShape(r, level),
      (i) => {
        const s = dataShape(i);
        const size = dimsSize(s) * (i.dtype ? BYTES[i.dtype] : 1);
        // En básico, sin vídeos enormes; los bytes caben en un entero seguro.
        return Number.isSafeInteger(size) && (level !== "básico" || dimsSize(s) <= 50_000_000);
      },
    );
  },
};

export function dataTokens(i: DataShapeInstance): string[] {
  const t: string[] = [i.kind];
  if (i.batch !== null) t.push("lote");
  if (i.channels > 1) t.push("color");
  else t.push("un-canal");
  if (i.kind !== "audio") t.push(i.conv);
  if (i.res !== "hw" && i.kind !== "audio") t.push("ancho-alto");
  if (i.dtype) t.push("bytes");
  return t;
}

const DATA_SHAPE_HINTS: readonly TaggedHint[] = [
  { needs: ["lote"], text: "Si hay varios ejemplos juntos (un lote), su número es el primer eje." },
  { needs: ["audio"], text: "Audio: muestras = frecuencia de muestreo × segundos. En mono no se escribe el eje de canales; en estéreo, los canales van delante (como en las láminas y en torchaudio)." },
  { needs: ["video"], text: "Vídeo: fotogramas = fps × segundos, y es el primer eje del vídeo (delante de cada imagen)." },
  { needs: ["ancho-alto"], text: "Las resoluciones se anuncian ancho × alto, pero la forma lleva primero el alto (filas) y después el ancho (columnas)." },
  { needs: ["numpy", "color"], text: "Con NumPy o PIL, los canales van al final: (alto, ancho, canales)." },
  { needs: ["pytorch", "color"], text: "Con PyTorch, los canales van delante del alto y el ancho: (canales, alto, ancho)." },
  { needs: ["un-canal"], text: "Con un solo canal (audio mono, imagen en gris) no se escribe el eje de canales." },
];

const kindName = (i: DataShapeInstance) => (i.kind === "audio" ? "del audio" : i.kind === "imagen" ? "de la imagen" : "del vídeo");

export function dataStatementText(i: DataShapeInstance): string[] {
  const res = i.res === "p" ? P_RES.find(([h, w]) => h === i.h && w === i.w)![2] : i.res === "wxh" ? `${i.w} × ${i.h} píxeles (ancho × alto)` : `${i.h} píxeles de alto y ${i.w} de ancho`;
  const ch = i.channels === 1 ? (i.kind === "audio" ? "mono" : "en blanco y negro (un canal)") : i.kind === "audio" ? "estéreo (2 canales)" : i.channels === 3 ? "en color RGB (3 canales)" : "en color RGBA (4 canales: rojo, verde, azul y transparencia)";
  const conv = i.kind === "audio" ? "" : i.conv === "numpy" ? " Se guarda con el convenio de NumPy y PIL." : " Se guarda con el convenio de PyTorch.";
  const what =
    i.kind === "audio"
      ? `Un audio ${ch} de ${i.secs} s grabado a ${decimalComma(i.rate / 1000)} kHz (${big(i.rate)} muestras por segundo).`
      : i.kind === "imagen"
        ? `Una imagen ${ch} de ${res}.`
        : `Un vídeo ${ch} de ${i.secs} s a ${i.rate} fps, con resolución ${res}.`;
  const lote = i.batch === null ? "" : ` Van ${i.batch} ${i.kind === "audio" ? "audios" : i.kind === "imagen" ? "imágenes" : "vídeos"} iguales juntos en un lote (batch).`;
  const bytes = i.dtype ? ` Cada número es un ${i.dtype} (${BYTES[i.dtype]} byte${BYTES[i.dtype] === 1 ? "" : "s"}).` : "";
  return [`${what}${conv}${lote}${bytes}`];
}

export function dataShapeGuided(i: DataShapeInstance): GuidedExercise {
  const s = dataShape(i);
  const tokens = dataTokens(i);
  const hints = pickHints(DATA_SHAPE_HINTS, tokens);
  const steps: GuidedStep[] = [];
  const lote = i.batch === null ? [] : [i.batch];
  if (i.kind !== "imagen") {
    const n = BigInt(i.rate * i.secs);
    steps.push({
      kind: "integer",
      title: i.kind === "audio" ? "Muestras por canal" : "Número de fotogramas",
      label: i.kind === "audio" ? "Muestras por canal" : "Fotogramas",
      expected: n,
      mistakes: cleanMistakes(n, [intM(BigInt(i.rate + i.secs), "Se multiplica, no se suma: la frecuencia dice cuántos por cada segundo."), intM(BigInt(i.rate), "Eso es lo que hay en un segundo: multiplica por la duración.")], sameBig),
      hints: [i.kind === "audio" ? "Muestras = muestras por segundo × segundos." : "Fotogramas = fotogramas por segundo × segundos."],
      okText: `Bien: ${n} ${i.kind === "audio" ? "muestras" : "fotogramas"}.`,
    });
  }
  const swapped = dataShape({ ...i, h: i.w, w: i.h });
  const otherConv = i.kind === "audio" ? null : i.channels > 1 ? dataShape({ ...i, conv: i.conv === "numpy" ? "pytorch" : "numpy" }) : null;
  const withChannel = i.channels === 1 ? (i.kind === "audio" ? [...lote, 1, i.rate * i.secs] : i.kind === "imagen" ? [...lote, i.h, i.w, 1] : [...lote, i.rate * i.secs, i.h, i.w, 1]) : null;
  const audioLast = i.kind === "audio" && i.channels > 1 ? [...lote, i.rate * i.secs, i.channels] : null;
  const noBatch = i.batch !== null ? s.slice(1) : null;
  steps.push({
    kind: "shape",
    title: `Forma (shape) ${kindName(i)}${i.batch !== null ? " (el lote entero)" : ""}`,
    expected: s,
    allowError: false,
    mistakes: cleanMistakes<Dims | "error">(s, [
      i.kind !== "audio" && i.h !== i.w ? { value: swapped, text: "Has puesto el ancho antes que el alto: las librerías guardan primero las filas (alto) y después las columnas (ancho)." } : null,
      otherConv ? { value: otherConv, text: i.conv === "numpy" ? "Ese es el orden de PyTorch; con NumPy y PIL los canales van al final." : "Ese es el orden de NumPy; con PyTorch los canales van delante del alto y el ancho." } : null,
      withChannel ? { value: withChannel, text: "Con un solo canal no se escribe el eje de canales." } : null,
      audioLast ? { value: audioLast, text: "Aquí los canales van delante de las muestras (como en las láminas y en torchaudio)." } : null,
      noBatch ? { value: noBatch, text: "Falta el eje del lote, delante de todo." } : null,
    ], sameDims) as Mistake<Dims | "error">[],
    hints,
    okText: `Bien: la forma es ${dimsText(s)}.`,
  });
  const rank = BigInt(s.length);
  steps.push({
    kind: "integer",
    title: "Rango (ndim): cuántos ejes tiene",
    label: "Rango (ndim)",
    expected: rank,
    mistakes: cleanMistakes(rank, [
      i.channels === 1 && i.kind !== "audio" ? intM(rank + 1n, "En blanco y negro no hay eje de canales: no lo cuentes.") : null,
      i.batch !== null ? intM(rank - 1n, "El lote también es un eje.") : null,
      intM(BigInt(dimsSize(s)), "Ese es el número de valores; el rango es cuántos números tiene la forma."),
    ], sameBig),
    hints: ["El rango es cuántos números tiene la forma (en NumPy, ndim)."],
    okText: `Bien: rango ${rank}.`,
  });
  if (i.batch !== null || i.dtype !== null || i.kind === "video") {
    const size = BigInt(dimsSize(s));
    steps.push({
      kind: "integer",
      title: "Número total de valores (size)",
      label: "Total de valores",
      expected: size,
      mistakes: cleanMistakes(size, [
        intM(BigInt(s.reduce((a, b) => a + b, 0)), "Se multiplican las longitudes de los ejes, no se suman."),
        i.batch !== null ? intM(BigInt(dimsSize(s.slice(1))), "Eso es un solo ejemplo: multiplica también por el lote.") : null,
      ], sameBig),
      hints: ["El total de valores es el producto de la forma (en NumPy, size)."],
      okText: `Bien: ${size} valores.`,
    });
  }
  if (i.dtype) {
    const bytes = BigInt(dimsSize(s) * BYTES[i.dtype]);
    steps.push({
      kind: "integer",
      title: `Memoria en bytes (cada valor es un ${i.dtype})`,
      label: "Bytes",
      expected: bytes,
      mistakes: cleanMistakes(bytes, [
        intM(BigInt(dimsSize(s)), `Eso son los valores; cada ${i.dtype} ocupa ${BYTES[i.dtype]} bytes.`),
        intM(BigInt(dimsSize(s) * 8), `Un ${i.dtype} ocupa ${BYTES[i.dtype]} byte${BYTES[i.dtype] === 1 ? "" : "s"}, no 8 (8 es un float64).`),
        intM(BigInt(dimsSize(s) * 32), "32 son los bits de un float32; en bytes son 4."),
      ], sameBig),
      hints: ["Memoria = número de valores × bytes de cada valor (uint8: 1 byte; float32: 4 bytes)."],
      okText: `Bien: ${bytes} bytes.`,
    });
  }
  const code = `x = np.zeros(${dimsText(s)}${i.dtype ? `, dtype=np.${i.dtype}` : ""})\nx.shape, x.ndim, x.size${i.dtype ? ", x.nbytes" : ""}`;
  return {
    statement: { blocks: dataStatementText(i).map((text) => ({ kind: "p" as const, text })), ask: "Escribe la forma del array, su rango y lo que se pida." },
    steps,
    solution: [
      ...(i.kind === "audio" ? [`Muestras por canal: ${big(i.rate)} × ${i.secs} = ${big(i.rate * i.secs)}.`] : i.kind === "video" ? [`Fotogramas: ${i.rate} × ${i.secs} = ${i.rate * i.secs}.`] : []),
      `Forma: ${dimsText(s)}${i.kind !== "audio" ? ` (alto ${i.h} antes que ancho ${i.w}${i.channels > 1 ? `; canales ${i.conv === "numpy" ? "al final, como en NumPy/PIL" : "delante, como en PyTorch"}` : ""})` : ""}${i.batch !== null ? `, con el lote de ${i.batch} delante` : ""}.`,
      `Rango: ${s.length}.`,
      ...(steps.some((x) => x.title.startsWith("Número total")) ? [`Valores: ${s.join(" × ")} = ${dimsSize(s)}.`] : []),
      ...(i.dtype ? [`Bytes: ${dimsSize(s)} × ${BYTES[i.dtype]} = ${dimsSize(s) * BYTES[i.dtype]}.`] : []),
      `Con NumPy: ${code.replace("\n", "; ")}.`,
    ],
  };
}

// ================================================================ expand_dims, squeeze e índices

export type IndexItem = { t: "int"; v: number } | { t: "slice"; start: number | null; stop: number | null; step: number | null } | { t: "ellipsis" } | { t: "new" } | { t: "list"; v: number[] };

export type AxesOp = { k: "expand"; axis: number } | { k: "squeeze"; axis: number | null } | { k: "index"; idx: IndexItem[] };
export type AxesInstance = { shape: number[]; op: AxesOp };

export type AxesError = "IndexError" | "ValueError" | "AxisError";
export type AxesResult = { ok: true; shape: number[] } | { ok: false; error: AxesError; why: string };

/** Longitud de range(start, stop, step) sobre un eje de longitud n (como un corte de Python). */
export function sliceLength(n: number, start: number | null, stop: number | null, step: number | null): number {
  const st = step ?? 1;
  const norm = (x: number | null, def: number, lo: number, hi: number) => {
    if (x === null) return def;
    const v = x < 0 ? x + n : x;
    return Math.min(Math.max(v, lo), hi);
  };
  if (st > 0) {
    const a = norm(start, 0, 0, n);
    const b = norm(stop, n, 0, n);
    return Math.max(0, Math.ceil((b - a) / st));
  }
  const a = norm(start, n - 1, -1, n - 1);
  const b = norm(stop, -1, -1, n - 1);
  return Math.max(0, Math.ceil((a - b) / -st));
}

export function axesResult(inst: AxesInstance): AxesResult {
  const s = inst.shape;
  const op = inst.op;
  if (op.k === "expand") {
    const nd = s.length + 1;
    if (op.axis < -nd || op.axis >= nd) return { ok: false, error: "AxisError", why: `El resultado tiene ${nd} ejes: axis va de ${-nd} a ${nd - 1}.` };
    const at = op.axis < 0 ? op.axis + nd : op.axis;
    return { ok: true, shape: [...s.slice(0, at), 1, ...s.slice(at)] };
  }
  if (op.k === "squeeze") {
    if (op.axis === null) return { ok: true, shape: s.filter((d) => d !== 1) };
    if (op.axis < -s.length || op.axis >= s.length) return { ok: false, error: "AxisError", why: "Ese eje no existe." };
    const at = op.axis < 0 ? op.axis + s.length : op.axis;
    if (s[at] !== 1) return { ok: false, error: "ValueError", why: `El eje ${op.axis} mide ${s[at]}: squeeze solo quita ejes de longitud 1.` };
    return { ok: true, shape: s.filter((_, i) => i !== at) };
  }
  const real = op.idx.filter((x) => x.t !== "new" && x.t !== "ellipsis").length;
  if (real > s.length) return { ok: false, error: "IndexError", why: `Hay ${real} índices y el array tiene ${s.length} ejes.` };
  const items: IndexItem[] = [];
  for (const x of op.idx) {
    if (x.t === "ellipsis") for (let k = 0; k < s.length - real; k++) items.push({ t: "slice", start: null, stop: null, step: null });
    else items.push(x);
  }
  if (!op.idx.some((x) => x.t === "ellipsis")) for (let k = real; k < s.length; k++) items.push({ t: "slice", start: null, stop: null, step: null });
  const out: number[] = [];
  let axis = 0;
  for (const x of items) {
    if (x.t === "new") {
      out.push(1);
      continue;
    }
    const n = s[axis]!;
    if (x.t === "int") {
      if (x.v < -n || x.v >= n) return { ok: false, error: "IndexError", why: `El eje ${axis} mide ${n}: los índices van de 0 a ${n - 1} (o de −${n} a −1).` };
    } else if (x.t === "list") {
      const bad = x.v.find((v) => v < -n || v >= n);
      if (bad !== undefined) return { ok: false, error: "IndexError", why: `El eje ${axis} mide ${n}: la posición ${bad} no existe.` };
      out.push(x.v.length);
    } else if (x.t === "slice") out.push(sliceLength(n, x.start, x.stop, x.step));
    axis++;
  }
  return { ok: true, shape: out };
}

const itemCode = (x: IndexItem): string => {
  switch (x.t) {
    case "int":
      return String(x.v);
    case "slice":
      return `${x.start ?? ""}:${x.stop ?? ""}${x.step !== null ? `:${x.step}` : ""}`;
    case "ellipsis":
      return "...";
    case "new":
      return "np.newaxis";
    case "list":
      return `[${x.v.join(", ")}]`;
  }
};

export function axesCode(op: AxesOp): string {
  if (op.k === "expand") return `np.expand_dims(a, axis=${op.axis})`;
  if (op.k === "squeeze") return op.axis === null ? "np.squeeze(a)" : `np.squeeze(a, axis=${op.axis})`;
  return `a[${op.idx.map(itemCode).join(", ")}]`;
}

const dim = (rng: Rng) => rng.pick([2, 3, 4, 5, 6]);
const sl = (start: number | null, stop: number | null, step: number | null = null): IndexItem => ({ t: "slice", start, stop, step });
const ALL: IndexItem = sl(null, null);

function makeAxes(rng: Rng, level: ExerciseLevel): AxesInstance {
  const shape = [dim(rng), dim(rng), dim(rng)];
  const kind = rng.pick(["expand", "squeeze", "index", "index"] as const);
  if (kind === "squeeze") {
    const ones = rng.int(1, level === "básico" ? 1 : 2);
    const s = [...shape];
    for (let k = 0; k < ones; k++) s.splice(rng.int(0, s.length), 0, 1);
    if (level === "básico") return { shape: s, op: { k: "squeeze", axis: null } };
    const oneAxes = s.flatMap((d, i) => (d === 1 ? [i] : []));
    if (level === "avanzado" && rng.chance(0.3)) return { shape: s, op: { k: "squeeze", axis: rng.pick(s.flatMap((d, i) => (d !== 1 ? [i] : []))) } };
    const ax = rng.pick(oneAxes);
    return { shape: s, op: { k: "squeeze", axis: rng.chance(0.3) ? ax - s.length : rng.chance(0.3) ? null : ax } };
  }
  if (kind === "expand") {
    const axes = level === "básico" ? [0, -1] : level === "medio" ? [0, 1, 2, 3, -1] : [1, 2, -2, -1, 4, -5];
    return { shape, op: { k: "expand", axis: rng.pick(axes) } };
  }
  const n = shape;
  const pickInt = (k: number) => rng.int(0, n[k]! - 1);
  if (level === "básico") {
    const opts: IndexItem[][] = [[{ t: "int", v: pickInt(0) }], [ALL, { t: "int", v: pickInt(1) }], [{ t: "ellipsis" }, { t: "int", v: pickInt(2) }], [{ t: "int", v: pickInt(0) }, { t: "int", v: pickInt(1) }]];
    return { shape, op: { k: "index", idx: rng.pick(opts) } };
  }
  if (level === "medio") {
    const a = rng.int(0, 2);
    const opts: IndexItem[][] = [
      [sl(a, a + rng.int(1, 3))],
      [ALL, ALL, sl(null, null, 2)],
      [{ t: "int", v: pickInt(0) }, sl(1, null)],
      [ALL, { t: "new" }],
      [{ t: "ellipsis" }, sl(null, rng.int(1, 3))],
      [{ t: "int", v: -1 }, ALL, { t: "int", v: pickInt(2) }],
    ];
    return { shape, op: { k: "index", idx: rng.pick(opts) } };
  }
  const opts: IndexItem[][] = [
    [sl(null, null, -1), { t: "int", v: pickInt(1) }],
    [ALL, { t: "list", v: rng.shuffle([0, 1, 2, 3].filter((x) => x < n[1]!)).slice(0, rng.int(2, 3)) }],
    [{ t: "ellipsis" }, { t: "new" }],
    [{ t: "int", v: -1 }, { t: "ellipsis" }, sl(1, rng.int(2, 4))],
    [{ t: "int", v: n[0]! }],
    [ALL, ALL, { t: "int", v: -n[2]! - 1 }],
    [{ t: "new" }, { t: "int", v: pickInt(0) }, sl(null, null, 2)],
    [ALL, sl(rng.int(1, 3), null), { t: "new" }],
  ];
  return { shape, op: { k: "index", idx: rng.pick(opts) } };
}

export const PY_NUMPY_AXES: ExerciseType<AxesInstance> = {
  id: "py-numpy-ejes",
  topic: "python",
  title: "Ejes: expand_dims, squeeze e índices",
  description: "Predice la forma de np.expand_dims(a, axis), np.squeeze(a) o un índice o corte (a[0], a[:, 1], a[..., np.newaxis], a[::2]) de un array de 3 dimensiones, o si da un error.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("py-numpy-ejes", seed),
      (r) => makeAxes(r, level),
      (inst) => {
        const r = axesResult(inst);
        if (level !== "avanzado" && !r.ok) return false;
        return !r.ok || r.shape.length <= 5;
      },
    );
  },
};

export function axesTokens(inst: AxesInstance): string[] {
  const op = inst.op;
  if (op.k === "expand") return ["expand", ...(op.axis < 0 ? ["negativo"] : [])];
  if (op.k === "squeeze") return ["squeeze", op.axis === null ? "squeeze-todos" : "squeeze-eje", ...(op.axis !== null && op.axis < 0 ? ["negativo"] : [])];
  const t = new Set<string>(["index"]);
  for (const x of op.idx) {
    if (x.t === "int") t.add("entero");
    if (x.t === "int" && x.v < 0) t.add("negativo");
    if (x.t === "slice" && (x.start !== null || x.stop !== null)) t.add("corte");
    if (x.t === "slice" && x.step !== null) t.add("paso");
    if (x.t === "ellipsis") t.add("puntos");
    if (x.t === "new") t.add("nuevo");
    if (x.t === "list") t.add("lista");
  }
  return [...t];
}

const AXES_HINTS: readonly TaggedHint[] = [
  { needs: ["expand"], text: "np.expand_dims(a, axis=k) añade un eje de longitud 1 que queda en la posición k del resultado." },
  { needs: ["squeeze-todos"], text: "np.squeeze(a) sin axis quita todos los ejes de longitud 1." },
  { needs: ["squeeze-eje"], text: "np.squeeze(a, axis=k) quita solo el eje k, y solo si mide 1." },
  { needs: ["negativo"], text: "Los números negativos cuentan desde el final: −1 es el último." },
  { needs: ["entero"], text: "Un índice entero elige una posición y quita ese eje." },
  { needs: ["corte"], text: "Un corte inicio:fin se queda con las posiciones de inicio a fin − 1 (el fin no entra) y mantiene el eje." },
  { needs: ["paso"], text: "Con paso, ::2 se queda con una de cada dos posiciones (redondeando hacia arriba); ::−1 da la vuelta sin cambiar la longitud." },
  { needs: ["puntos"], text: "... (Ellipsis) ocupa todos los ejes que no se nombran." },
  { needs: ["nuevo"], text: "np.newaxis (o None) añade un eje de longitud 1 en ese sitio." },
  { needs: ["lista"], text: "Una lista de posiciones mantiene el eje, con tantos elementos como tenga la lista." },
  { needs: ["index"], text: "Los ejes que no se nombran se quedan enteros, como si llevaran «:»." },
];

/** Formas equivocadas típicas para la operación. */
function axesMistakes(inst: AxesInstance, r: AxesResult): Mistake<Dims | "error">[] {
  const s = inst.shape;
  const op = inst.op;
  const out: Array<Mistake<Dims | "error"> | null> = [];
  if (!r.ok) {
    if (op.k === "squeeze") out.push({ value: s.filter((_, i) => i !== (op.axis! < 0 ? op.axis! + s.length : op.axis!)), text: "¿Cuánto mide el eje que pides quitar? squeeze solo quita ejes de longitud 1." });
    if (op.k === "index") {
      const clipped = axesResult({ shape: s, op: { k: "index", idx: op.idx.map((x) => (x.t === "int" ? { t: "int", v: 0 } : x)) } });
      if (clipped.ok) out.push({ value: clipped.shape, text: "¿Existe esa posición en ese eje? Los índices van de 0 a n − 1 (o de −n a −1)." });
    }
    if (op.k === "expand") out.push({ value: [...s, 1], text: "¿Cabe ese axis? El resultado tiene un eje más que a y axis tiene que ser una de sus posiciones." });
    return cleanMistakes<Dims | "error">("error", out, sameDims);
  }
  if (op.k === "expand") {
    const nd = s.length + 1;
    const at = op.axis < 0 ? op.axis + nd : op.axis;
    if (at + 1 <= s.length) out.push({ value: [...s.slice(0, at + 1), 1, ...s.slice(at + 1)], text: "El nuevo eje queda en la posición axis del resultado (contando desde 0), no detrás del eje axis de a." });
    if (op.axis < 0) out.push({ value: [...s.slice(0, s.length + op.axis), 1, ...s.slice(s.length + op.axis)], text: "Con axis negativo se cuenta desde el final del resultado (que tiene un eje más): axis=−1 lo pone al final." });
  } else if (op.k === "squeeze") {
    if (op.axis === null) {
      const first = s.indexOf(1);
      out.push({ value: s.filter((_, i) => i !== first), text: "squeeze() sin axis quita todos los ejes de longitud 1, no solo el primero." });
    } else out.push({ value: s.filter((d) => d !== 1), text: "Con axis, squeeze quita solo ese eje." });
  } else {
    const keep = axesResult({ shape: s, op: { k: "index", idx: op.idx.map((x) => (x.t === "int" ? sl(x.v, x.v + 1 === 0 ? null : x.v + 1) : x)) } });
    if (keep.ok && op.idx.some((x) => x.t === "int")) out.push({ value: keep.shape, text: "Un índice entero quita su eje (no lo deja con longitud 1); un corte, en cambio, lo mantiene." });
    const inclusive = axesResult({ shape: s, op: { k: "index", idx: op.idx.map((x) => (x.t === "slice" && x.stop !== null && (x.step ?? 1) > 0 ? { ...x, stop: x.stop + 1 } : x)) } });
    if (inclusive.ok) out.push({ value: inclusive.shape, text: "En un corte inicio:fin, el fin no entra." });
    const noNew = axesResult({ shape: s, op: { k: "index", idx: op.idx.filter((x) => x.t !== "new") } });
    if (noNew.ok && op.idx.some((x) => x.t === "new")) out.push({ value: noNew.shape, text: "np.newaxis añade un eje de longitud 1: cuéntalo." });
    const half = axesResult({ shape: s, op: { k: "index", idx: op.idx.map((x) => (x.t === "slice" && x.step === 2 ? { ...x, step: null } : x)) } });
    if (half.ok && op.idx.some((x) => x.t === "slice" && x.step === 2)) out.push({ value: half.shape, text: "::2 se queda con una de cada dos posiciones: el eje se acorta." });
  }
  out.push({ value: "error", text: "Esta operación sí da un resultado: vuelve a aplicar la regla eje a eje." });
  return cleanMistakes<Dims | "error">(r.shape, out, sameDims);
}

export function axesGuided(inst: AxesInstance): GuidedExercise {
  const r = axesResult(inst);
  const tokens = axesTokens(inst);
  const code = `a = np.zeros(${dimsText(inst.shape)})\nb = ${axesCode(inst.op)}\nb.shape  # ¿?`;
  const steps: GuidedStep[] = [
    {
      kind: "shape",
      title: "Forma de b (o si NumPy da un error)",
      expected: r.ok ? r.shape : "error",
      allowError: true,
      mistakes: axesMistakes(inst, r),
      hints: pickHints(AXES_HINTS, tokens),
      okText: r.ok ? `¡Correcto! b.shape es ${dimsText(r.shape)}.` : `¡Correcto! NumPy da un ${r.error}.`,
    },
  ];
  if (r.ok && inst.op.k === "index") {
    const size = BigInt(dimsSize(r.shape));
    steps.push({
      kind: "integer",
      title: "¿Cuántos elementos tiene b (b.size)?",
      label: "b.size",
      expected: size,
      mistakes: cleanMistakes(size, [{ value: BigInt(r.shape.reduce((a, b) => a + b, 0)), text: "Se multiplican las longitudes, no se suman." }, { value: BigInt(dimsSize(inst.shape)), text: "Ese es el tamaño de a: el índice se queda con una parte." }], sameBig),
      hints: ["b.size es el producto de su forma."],
      okText: `Bien: b tiene ${size} elementos.`,
    });
  }
  return {
    statement: { blocks: [{ kind: "code", code }], ask: "¿Qué forma tiene b? Si la operación no se puede hacer, marca que NumPy da un error." },
    steps,
    solution: [r.ok ? `b.shape == ${dimsText(r.shape)}.` : `NumPy da un ${r.error}: ${r.why}`, ...pickHints(AXES_HINTS, tokens).slice(0, 2)],
  };
}

// ================================================================ Desbordamiento de int8 y uint8

export type OverflowDtype = "int8" | "uint8";
export type OverflowInstance = {
  dtype: OverflowDtype;
  a: number[];
  b: number[];
  /** «a + b», «a - b», «a * b», «(a + b) // 2» o «a * k». */
  expr: "+" | "-" | "*" | "media" | "escalar";
  k: number;
  /** Avanzado: también con a.astype(np.int16). */
  widen: boolean;
};

export const DTYPE_RANGE: Record<OverflowDtype, [number, number]> = { int8: [-128, 127], uint8: [0, 255] };

/** El valor que guarda el tipo: la cuenta módulo 256, en su rango. */
export function wrap(x: number, dtype: OverflowDtype): number {
  const m = ((x % 256) + 256) % 256;
  return dtype === "uint8" ? m : m >= 128 ? m - 256 : m;
}

/** Cada elemento: el resultado exacto y el que da NumPy con el tipo (y con int16, si se pide). */
export function overflowValues(i: OverflowInstance): { exact: number[]; numpy: number[]; wide: number[] } {
  const exact = i.a.map((x, j) => {
    const y = i.b[j]!;
    switch (i.expr) {
      case "+":
        return x + y;
      case "-":
        return x - y;
      case "*":
        return x * y;
      case "media":
        return Math.floor((x + y) / 2);
      case "escalar":
        return x * i.k;
    }
  });
  const numpy = i.a.map((x, j) => {
    const y = i.b[j]!;
    // La suma da la vuelta antes de dividir: (a + b) // 2 con el desbordamiento ya hecho.
    if (i.expr === "media") return Math.floor(wrap(x + y, i.dtype) / 2);
    return wrap(exact[j]!, i.dtype);
  });
  return { exact, numpy, wide: exact };
}

export const overflowCode = (i: OverflowInstance): string => {
  const e = i.expr === "media" ? "(a + b) // 2" : i.expr === "escalar" ? `a * ${i.k}` : `a ${i.expr} b`;
  return e;
};

function makeOverflow(rng: Rng, level: ExerciseLevel): OverflowInstance {
  const dtype = level === "básico" ? rng.pick(["int8", "int8", "uint8"] as const) : rng.pick(["int8", "uint8"] as const);
  const [lo, hi] = DTYPE_RANGE[dtype];
  const len = level === "básico" ? 1 : rng.int(2, 3);
  const val = () => rng.int(lo, hi);
  const expr = level === "básico" ? rng.pick(["+", "+", "*"] as const) : level === "medio" ? rng.pick(["+", "-", "*", "escalar"] as const) : rng.pick(["media", "*", "-", "escalar"] as const);
  const a = Array.from({ length: len }, () => (expr === "*" || expr === "escalar" ? rng.int(Math.max(lo, -40), Math.min(hi, 60)) : val()));
  const b = Array.from({ length: len }, () => (expr === "*" ? rng.int(Math.max(lo, -9), 9) : val()));
  return { dtype, a, b, expr, k: rng.int(2, 5), widen: level === "avanzado" };
}

export const PY_OVERFLOW: ExerciseType<OverflowInstance> = {
  id: "py-desbordamiento",
  topic: "python",
  title: "Desbordamiento de int8 y uint8",
  description: "Qué imprime NumPy al sumar, restar o multiplicar arrays de int8 o uint8 cuando el resultado no cabe: la cuenta da la vuelta (módulo 256), sin avisar.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("py-desbordamiento", seed),
      (r) => makeOverflow(r, level),
      (i) => {
        const v = overflowValues(i);
        const [lo, hi] = DTYPE_RANGE[i.dtype];
        const overflows = v.exact.filter((x, j) => x !== v.numpy[j]).length;
        // Siempre alguno se sale; en medio y avanzado, alguno que no (para distinguir).
        if (overflows === 0 || (i.a.length > 1 && overflows === i.a.length)) return false;
        if (i.expr === "escalar" && i.k * Math.max(...i.a.map(Math.abs)) > 1000) return false;
        if (i.expr === "media" && v.exact.every((x, j) => x === v.numpy[j])) return false;
        // int16 no se desborda con estos números.
        return v.exact.every((x) => x >= -32768 && x <= 32767) && i.a.every((x) => x >= lo && x <= hi) && i.b.every((x) => x >= lo && x <= hi);
      },
    );
  },
};

const rowM = (xs: readonly number[]): Matrix => [xs.map((x) => frac(BigInt(x)))];

export function overflowGuided(i: OverflowInstance): GuidedExercise {
  const v = overflowValues(i);
  const [lo, hi] = DTYPE_RANGE[i.dtype];
  const expr = overflowCode(i);
  const code = [
    "import numpy as np",
    `a = np.array([${i.a.join(", ")}], dtype=np.${i.dtype})`,
    ...(i.expr === "escalar" ? [] : [`b = np.array([${i.b.join(", ")}], dtype=np.${i.dtype})`]),
    `print(${expr})`,
    ...(i.widen ? [`print(${expr.replace(/\ba\b/, "a.astype(np.int16)")})`] : []),
  ].join("\n");
  const clamp = v.exact.map((x) => Math.min(hi, Math.max(lo, x)));
  const badWrap = v.exact.map((x) => (x > hi ? x - 128 : x < lo ? x + 128 : x));
  const isInt = i.dtype === "int8";
  const steps: GuidedStep[] = [
    {
      kind: "numbers",
      title: `Valores que caben en ${i.dtype}: mínimo y máximo`,
      name: `rango de ${i.dtype}`,
      expected: rowM([lo, hi]),
      mistakes: cleanMistakes(rowM([lo, hi]), [
        { value: rowM(isInt ? [-127, 127] : [1, 256]), text: isInt ? "Con 8 bits y signo hay 256 valores: del −128 al 127 (uno más en los negativos)." : "Con 8 bits sin signo hay 256 valores, del 0 al 255." },
        { value: rowM(isInt ? [0, 255] : [-128, 127]), text: isInt ? "Ese es el rango de uint8 (sin signo); int8 tiene signo." : "Ese es el rango de int8; uint8 no tiene signo." },
        { value: rowM(isInt ? [-128, 128] : [0, 256]), text: "Son 256 valores en total: el máximo es uno menos." },
      ], sameMatrix),
      hints: ["8 bits dan 2⁸ = 256 valores distintos.", isInt ? "Con signo, la mitad son negativos: empieza en −128." : "Sin signo, empieza en 0."],
      okText: `Bien: ${i.dtype} va de ${minus(String(lo))} a ${hi}.`,
    },
    {
      kind: "numbers",
      title: "La cuenta exacta (con enteros de Python, sin límite)",
      name: "resultado exacto",
      expected: rowM(v.exact),
      hints: [i.expr === "media" ? "(a + b) // 2 es la división entera de la suma entre 2 (hacia abajo)." : "Haz la cuenta elemento a elemento, como si no hubiera límite."],
      okText: "Bien: esa es la cuenta exacta.",
    },
    {
      kind: "numbers",
      title: `Lo que imprime print(${expr})`,
      name: `print(${expr})`,
      expected: rowM(v.numpy),
      mistakes: cleanMistakes(rowM(v.numpy), [
        i.expr === "media" ? { value: rowM(v.exact), text: "La suma a + b se desborda antes de dividir: haz la vuelta primero y divide después." } : null,
        { value: rowM(v.exact), text: `Algún resultado no cabe en ${i.dtype} (de ${minus(String(lo))} a ${hi}). Los arrays de NumPy no avisan: el número da la vuelta.` },
        { value: rowM(clamp), text: "NumPy no se queda en el máximo (no satura): da la vuelta, sumando o restando 256." },
        { value: rowM(badWrap), text: "La vuelta es de 256 en 256 (2⁸ valores), no de 128." },
      ], sameMatrix),
      hints: [`Si el resultado se sale de ${minus(String(lo))}…${hi}, súmale o réstale 256 hasta que caiga dentro.`, i.expr === "media" ? "Primero a + b (con la vuelta), después // 2." : "Cada elemento por separado: los que caben no cambian."],
      okText: "Bien: así lo imprime NumPy.",
    },
  ];
  if (i.widen) {
    steps.push({
      kind: "numbers",
      title: `Y con a.astype(np.int16)`,
      name: "con int16",
      expected: rowM(v.wide),
      mistakes: cleanMistakes(rowM(v.wide), [{ value: rowM(v.numpy), text: "Al mezclar int16 con int8 (o uint8), NumPy usa int16: ahí ya caben los resultados." }], sameMatrix),
      hints: ["int16 va de −32768 a 32767: el resultado se hace en int16 y no se desborda."],
      okText: "Bien: con int16 no hay desbordamiento.",
    });
  }
  return {
    statement: { blocks: [{ kind: "code", code }], ask: "¿Qué imprime? Calcula primero la cuenta exacta y después lo que guarda el tipo." },
    steps,
    solution: [
      `${i.dtype} guarda de ${minus(String(lo))} a ${hi} (256 valores).`,
      ...v.exact.map((x, j) =>
        x === v.numpy[j]
          ? `${x} cabe: se queda igual.`
          : i.expr === "media"
            ? `${i.a[j]} + ${i.b[j]} = ${i.a[j]! + i.b[j]!} da la vuelta a ${wrap(i.a[j]! + i.b[j]!, i.dtype)}, y // 2 da ${v.numpy[j]} (en vez de ${x}).`
            : `${minus(String(x))} no cabe: ${minus(String(x))} ${x > hi ? "−" : "+"} ${Math.abs(x - v.numpy[j]!)} = ${minus(String(v.numpy[j]!))}.`,
      ),
      `print(${expr}) → [${v.numpy.join(" ")}]`.replace(/-/g, "−"),
      ...(i.widen ? [`Con int16 caben todos: [${v.wide.join(" ")}]`.replace(/-/g, "−")] : []),
    ],
  };
}

export const NUMPY_SHAPE_EXERCISES = [PY_DATA_SHAPE, PY_NUMPY_AXES, PY_OVERFLOW] as const;

/** Para tests: la matriz fila de unos enteros. */
export const intRow = (xs: readonly number[]): Matrix => intMatrix([xs as number[]]);
