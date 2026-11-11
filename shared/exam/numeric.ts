// Respuestas numéricas del simulacro, como en Blackboard: cifras, coma decimal y sin separador de miles.
// Se leen como decimales exactos (BigInt) y se comparan con el valor esperado, que puede ser un entero
// (bigint), una fracción exacta (Frac) o, si no es racional (e, π, ln 2…), un número en coma flotante.
//
// - «entero» y «exacto»: lo escrito tiene que valer exactamente lo esperado (12870 y 12870,0 valen lo
//   mismo; 0,5 y 0,50 también).
// - «dos-decimales»: vale el valor exacto o lo escrito, con al menos dos decimales, si al redondearlo a
//   dos decimales da lo mismo que el valor esperado redondeado (1/3: 0,33 o 0,333; no 0,3 ni 0,34).
//   El redondeo es el de siempre: si la tercera cifra es 5 o más, la segunda sube (2/3 → 0,67).
// - El punto decimal se acepta (con un aviso en los resultados: en el examen se escribe coma). Un
//   separador de miles no: «12.870» se lee como 12,87, como lo leería Blackboard.
import { frac, formatDecimal, type Frac } from "../rational.ts";
import type { ExamNumericFormat } from "./types.ts";

/** Longitud máxima de una respuesta numérica. */
export const MAX_NUMERIC_ANSWER = 40;

export type ExamDecimal = { units: bigint; scale: number; dot: boolean };

/** Lee lo escrito: signo (− o -), cifras y, si acaso, una coma (o punto) decimal. Null si no se lee. */
export function parseExamDecimal(text: string): ExamDecimal | null {
  const t = text.trim().replace(/−/g, "-");
  if (t.length === 0 || t.length > MAX_NUMERIC_ANSWER) return null;
  const m = /^([+-]?)(\d+)(?:([.,])(\d+))?$/.exec(t);
  if (!m) return null;
  const dec = m[4] ?? "";
  const units = BigInt(m[2]! + dec) * (m[1] === "-" ? -1n : 1n);
  return { units, scale: dec.length, dot: m[3] === "." };
}

const decimalFrac = (d: ExamDecimal): Frac => frac(d.units, 10n ** BigInt(d.scale));

/** Valor esperado: entero, fracción o número real. */
export type ExamExpected = bigint | Frac | number;

/** Un número real como fracción si lo es «de verdad» (denominador pequeño); si no, null. */
export function niceFrac(v: number, maxDen = 10000): Frac | null {
  if (!Number.isFinite(v) || Math.abs(v) > 1e12) return null;
  for (let d = 1; d <= maxDen; d++) {
    const n = Math.round(v * d);
    if (Math.abs(v * d - n) < 1e-9 * Math.max(1, Math.abs(v * d))) return frac(BigInt(n), BigInt(d));
  }
  return null;
}

/** El valor esperado como fracción exacta, si lo es. */
export function expectedFrac(e: ExamExpected): Frac | null {
  if (typeof e === "bigint") return frac(e);
  if (typeof e === "number") return niceFrac(e);
  return e;
}

const absBig = (x: bigint) => (x < 0n ? -x : x);

/** Céntimos (valor × 100) redondeados como en clase: la mitad sube, simétrico para negativos. */
export function roundedCents(e: ExamExpected): bigint {
  const f = expectedFrac(e);
  if (f) {
    const scaled = absBig(f.n) * 100n;
    let q = scaled / f.d;
    if (2n * (scaled % f.d) >= f.d) q += 1n;
    return f.n < 0n ? -q : q;
  }
  const v = e as number;
  const q = BigInt(Math.round(Math.abs(v) * 100 + 1e-7));
  return v < 0 ? -q : q;
}

const sameFrac = (a: Frac, b: Frac) => a.n === b.n && a.d === b.d;

/** ¿Lo escrito vale lo esperado con ese formato? Vacío o ilegible: no. */
export function numericMatches(text: string | null, expected: ExamExpected, format: ExamNumericFormat): boolean {
  if (text === null) return false;
  const d = parseExamDecimal(text);
  if (!d) return false;
  const value = decimalFrac(d);
  const exact = expectedFrac(expected);
  if (exact && sameFrac(value, exact)) return true;
  if (format !== "dos-decimales") return false;
  // Con menos de dos cifras vale si es el valor redondeado sin los ceros del final («1» o «1,0» para 1,00).
  return roundedCents(value) === roundedCents(expected);
}

/** Avisos que no cambian la nota (punto decimal, más cifras de las pedidas). */
export function numericNotes(text: string | null, format: ExamNumericFormat): string[] {
  if (text === null) return [];
  const d = parseExamDecimal(text);
  if (!d) return text.trim() === "" ? [] : ["No se lee como número: en el examen, solo cifras, signo y coma decimal."];
  const out: string[] = [];
  if (d.dot) out.push("En el examen, el decimal se escribe con coma (0,25), no con punto.");
  if (format === "dos-decimales" && d.scale > 2) out.push("En el examen se redondea a dos decimales.");
  return out;
}

/** La respuesta correcta como se escribiría en el examen: «12870», «0,35», «−1,5». */
export function numericCorrectText(expected: ExamExpected, format: ExamNumericFormat): string {
  const exact = expectedFrac(expected);
  if (format === "dos-decimales") {
    if (exact && exact.d === 1n) return exact.n.toString().replace("-", "−");
    const c = roundedCents(expected);
    const text = formatDecimal(frac(c, 100n), 2, { pad: true }).text;
    const short = exact ? formatDecimal(exact, 6) : null;
    // Si el valor exacto tiene más cifras, se dice cuál es; si no es un decimal exacto (2/21), su
    // aproximación con ≈ y coma: «0,10 (≈ 0,0952)».
    if (exact && short && !short.exact) return `${text} (≈ ${formatDecimal(exact, 4).text})`;
    return short && short.exact && short.text !== text ? `${text} (exacto: ${short.text})` : text;
  }
  if (!exact) return formatDecimal(frac(roundedCents(expected), 100n), 2, { pad: true }).text;
  return formatDecimal(exact, 8).text;
}

const EXAMPLES: Record<ExamNumericFormat, [string, string]> = { entero: ["1260", "357"], exacto: ["2,75", "0,125"], "dos-decimales": ["0,47", "3,14"] };
const NOTE_TEXT: Record<ExamNumericFormat, (ex: string) => string> = {
  entero: (ex) => `Un número entero, sin puntos ni espacios (por ejemplo, ${ex}).`,
  exacto: (ex) => `El valor exacto, con coma decimal si hace falta (por ejemplo, ${ex}).`,
  "dos-decimales": (ex) => `Redondeando a dos decimales y con coma (por ejemplo, ${ex}).`,
};

/**
 * Indicación de formato que acompaña al campo, con un ejemplo que nunca es la respuesta (si el primero
 * coincidiera con ella, se usa el segundo).
 */
export function numericFormatNote(format: ExamNumericFormat, expected: ExamExpected): string {
  const [a, b] = EXAMPLES[format];
  return NOTE_TEXT[format](numericMatches(a, expected, format) ? b : a);
}
