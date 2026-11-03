// Respuestas numéricas de probabilidad: se leen fracciones («3/8»), decimales con coma o punto
// («0,375», «0.375»), porcentajes («37,5 %») y enteros, con signo si hace falta (una ganancia
// esperada puede ser negativa).
//
// Reglas de corrección (como en el examen final: «redondeando a dos decimales y use una coma»):
// - Una fracción, un entero o un porcentaje sin decimales se comparan EXACTOS con el valor esperado.
// - Un decimal vale si es exactamente el valor esperado (0,375 = 3/8) o si es ese valor bien
//   redondeado a `digits` cifras (por defecto, 2): 0,33 vale para 1/3 y 0,67 para 2/3, pero 0,66
//   (truncado) no. Con menos cifras, no vale.
// - Con más cifras de las pedidas, vale si es el valor redondeado o truncado a esas cifras (0,3333 o
//   0,6666), con una nota: en el examen hay que redondear a `digits` cifras.
// - Un decimal con punto vale igual, con una nota: Blackboard pide coma.
// - Si el valor esperado no es racional (Poisson, normal), se compara con su aproximación en coma
//   flotante con las mismas reglas; una fracción, a menos de media unidad de la cifra `digits`.
import { equals, frac, parseNumber, toNumber, type Frac } from "../rational.ts";

/** Cifras decimales que se piden, como mínimo, cuando el resultado no es un decimal exacto. */
export const PROB_DIGITS = 2;

export const PROB_ANSWER_HELP = "Fracción (3/8), decimal con coma o punto (0,375) o porcentaje (37,5 %). Si no es exacto, redondeado a dos decimales (como en el examen).";
export const PROB_ANSWER_ERROR = "No se lee como número: escribe una fracción (3/8), un decimal (0,375) o un porcentaje (37,5 %).";

export type ProbAnswer =
  | {
      ok: true;
      value: Frac;
      /** Cifras decimales que aporta lo escrito (con un porcentaje, dos más); null si es exacto (fracción o entero). */
      decimals: number | null;
      /** ¿Se ha escrito el decimal con punto? */
      dot: boolean;
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
  return { ok: true, value: r.value, decimals, dot: /\d?\.\d/.test(clean) };
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

/** Valor esperado redondeado y truncado a d cifras, como números (para un valor no racional). */
function truncRoundNumber(x: number, d: number): [number, number] {
  const s = 10 ** d;
  const eps = 1e-9;
  return [Math.trunc(x * s + (x >= 0 ? eps : -eps)) / s, Math.round(x * s) / s];
}

export type AnswerCheck = {
  ok: boolean;
  /** Avisos que no cambian la nota: más cifras de las pedidas, punto en vez de coma, redondeo. */
  notes: string[];
};

export const NOTE_MORE_DIGITS = (digits: number) => `Bien, pero en el examen se redondea a ${digits === 2 ? "dos" : digits} decimales.`;
export const NOTE_DOT = "En el examen, el decimal se escribe con coma (0,25), no con punto.";
export const NOTE_ROUNDING = "Revisa el redondeo: si la cifra siguiente es 5 o más, la última sube (no se trunca).";

/** Corrige lo escrito con sus avisos. `expected` es exacto (Frac) o, si no es racional, un número. */
export function gradeAnswer(answer: Extract<ProbAnswer, { ok: true }>, expected: Frac | number, digits = PROB_DIGITS): AnswerCheck {
  const notes: string[] = [];
  const d = answer.decimals;
  const same = (t: Frac | number, r: Frac | number): [boolean, boolean] => {
    const v = toNumber(answer.value);
    const is = (x: Frac | number) => (typeof x === "number" ? Math.abs(v - x) < 1e-12 : equals(answer.value, x));
    return [is(t), is(r)];
  };
  let ok: boolean;
  if (typeof expected === "number" && !Number.isFinite(expected)) ok = false;
  else if (d === null) {
    ok = typeof expected === "number" ? Math.abs(toNumber(answer.value) - expected) < 0.5 * 10 ** -digits : equals(answer.value, expected);
  } else if (typeof expected !== "number" && equals(answer.value, expected)) {
    ok = true;
  } else if (d < digits) {
    ok = false;
  } else {
    const [t, r] = typeof expected === "number" ? truncRoundNumber(expected, d) : truncRound(expected, d);
    const [isT, isR] = same(t, r);
    if (d === digits) {
      ok = isR;
      if (!ok && isT) notes.push(NOTE_ROUNDING);
    } else {
      ok = isT || isR;
      if (ok) notes.push(NOTE_MORE_DIGITS(digits));
    }
  }
  if (ok && answer.dot) notes.push(NOTE_DOT);
  return { ok, notes };
}

/** ¿Lo escrito vale lo esperado? */
export const answerMatches = (answer: Extract<ProbAnswer, { ok: true }>, expected: Frac | number, digits = PROB_DIGITS): boolean =>
  gradeAnswer(answer, expected, digits).ok;

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

/** Corrección de un campo de texto: su estado y los avisos (vacíos salvo si está bien o casi). */
export function answerFeedback(text: string, expected: Frac | number, digits = PROB_DIGITS): { state: AnswerState; notes: string[] } {
  if (text.trim() === "") return { state: "vacío", notes: [] };
  const a = parseProbAnswer(text);
  if (!a.ok) return { state: "ilegible", notes: [] };
  const g = gradeAnswer(a, expected, digits);
  return { state: g.ok ? "bien" : "mal", notes: g.notes };
}
