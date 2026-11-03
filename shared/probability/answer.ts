// Respuestas numéricas de probabilidad: se leen fracciones («3/8»), decimales con coma o punto
// («0,375», «0.375»), porcentajes («37,5 %») y enteros, con signo si hace falta (una ganancia
// esperada puede ser negativa).
//
// Reglas de corrección:
// - Una fracción, un entero o un porcentaje sin decimales se comparan EXACTOS con el valor esperado.
// - Un decimal vale si es exactamente el valor esperado (0,375 = 3/8) o si es ese valor redondeado o
//   truncado a las cifras que escribe la persona, con al menos `digits` cifras decimales (por defecto,
//   4, como en los exámenes: «con cuatro decimales»). Así 0,3333 vale para 1/3, pero 0,33 no, y
//   0,3334 tampoco.
// - Si el valor esperado no es racional (Poisson, normal), se compara con su aproximación en coma
//   flotante: un decimal, redondeado o truncado; una fracción, a menos de media unidad de la cifra
//   `digits`.
import { equals, frac, parseNumber, toNumber, type Frac } from "../rational.ts";

/** Cifras decimales que se piden, como mínimo, cuando el resultado no es un decimal exacto. */
export const PROB_DIGITS = 4;

export const PROB_ANSWER_HELP = "Fracción (3/8), decimal con coma o punto (0,375) o porcentaje (37,5 %). Si no es exacto, con al menos cuatro decimales.";
export const PROB_ANSWER_ERROR = "No se lee como número: escribe una fracción (3/8), un decimal (0,375) o un porcentaje (37,5 %).";

export type ProbAnswer =
  | {
      ok: true;
      value: Frac;
      /** Cifras decimales que aporta lo escrito (con un porcentaje, dos más); null si es exacto (fracción o entero). */
      decimals: number | null;
    }
  | { ok: false; error: string };

/** Lee lo que escribe la persona. Admite espacios alrededor del % y «≈» o «=» delante. */
export function parseProbAnswer(text: string): ProbAnswer {
  const clean = text
    .trim()
    .replace(/^[≈=]\s*/, "")
    .replace(/\s+%$/, "%");
  if (clean.length === 0) return { ok: false, error: PROB_ANSWER_ERROR };
  const r = parseNumber(clean);
  if (!r.ok) return { ok: false, error: PROB_ANSWER_ERROR };
  const percent = clean.endsWith("%");
  const sep = /[.,](\d+)%?$/.exec(clean);
  // Una fracción, un entero o «25 %» son exactos; «37,5 %» aporta 1 + 2 cifras decimales.
  const decimals = !clean.includes("/") && sep ? sep[1]!.length + (percent ? 2 : 0) : null;
  return { ok: true, value: r.value, decimals };
}

const pow10 = (d: number) => 10n ** BigInt(d);

/** x truncado y redondeado a d cifras decimales (exactos). */
function truncRound(x: Frac, d: number): [Frac, Frac] {
  const s = pow10(d);
  const scaled = x.n * s;
  const neg = scaled < 0n;
  const a = neg ? -scaled : scaled;
  const t = a / x.d;
  const r = a % x.d;
  const rounded = 2n * r >= x.d ? t + 1n : t;
  return [frac(neg ? -t : t, s), frac(neg ? -rounded : rounded, s)];
}

/** ¿Lo escrito vale lo esperado? `expected` es exacto (Frac) o, si no es racional, un número. */
export function answerMatches(answer: Extract<ProbAnswer, { ok: true }>, expected: Frac | number, digits = PROB_DIGITS): boolean {
  if (typeof expected === "number") {
    if (!Number.isFinite(expected)) return false;
    const v = toNumber(answer.value);
    if (answer.decimals === null) return Math.abs(v - expected) < 0.5 * 10 ** -digits;
    if (answer.decimals < digits) return false;
    const s = 10 ** answer.decimals;
    const eps = 1e-9;
    const t = Math.trunc(expected * s + (expected >= 0 ? eps : -eps)) / s;
    const r = Math.round(expected * s) / s;
    return Math.abs(v - t) < 0.5 / s || Math.abs(v - r) < 0.5 / s;
  }
  if (equals(answer.value, expected)) return true;
  if (answer.decimals === null || answer.decimals < digits) return false;
  const [t, r] = truncRound(expected, answer.decimals);
  return equals(answer.value, t) || equals(answer.value, r);
}

/** Atajo: lee el texto y lo compara. Un texto vacío o ilegible no vale. */
export function checkProbAnswer(text: string, expected: Frac | number, digits = PROB_DIGITS): boolean {
  const a = parseProbAnswer(text);
  return a.ok && answerMatches(a, expected, digits);
}

/** Estado de un campo: vacío, ilegible, bien o mal. */
export type AnswerState = "vacío" | "ilegible" | "bien" | "mal";

export function answerState(text: string, expected: Frac | number, digits = PROB_DIGITS): AnswerState {
  if (text.trim() === "") return "vacío";
  const a = parseProbAnswer(text);
  if (!a.ok) return "ilegible";
  return answerMatches(a, expected, digits) ? "bien" : "mal";
}
