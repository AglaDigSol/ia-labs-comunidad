// Respuestas numéricas como en el examen: cifras, coma decimal y sin separador de miles. Se leen como
// decimales exactos (BigInt), así que un 20! se compara cifra a cifra. Si alguien escribe 12.870 o
// 12 870, se le avisa de que en el examen no se usa separador de miles; si escribe 2.5, de que la coma
// es la decimal. Los mensajes repiten las cifras de la persona, nunca las de la solución.

/** Un decimal exacto: valor = units / 10^scale. */
export type ExactDecimal = { units: bigint; scale: number };

export type ExamNumber = { ok: true; value: ExactDecimal } | { ok: false; error: string };

/** Longitud máxima de una respuesta (400 cifras dan para 200!). */
export const MAX_ANSWER_TEXT = 420;

/** Lee una respuesta numérica con la convención del examen. */
export function parseExamNumber(raw: string): ExamNumber {
  const text = raw.trim().replace(/−/g, "-");
  if (text === "") return { ok: false, error: "Escribe un número." };
  if (text.length > MAX_ANSWER_TEXT) return { ok: false, error: "Ese número es demasiado largo." };
  const m = /^([+-]?)(\d+)(?:,(\d+))?$/.exec(text);
  if (m) {
    const dec = m[3] ?? "";
    const units = BigInt(m[2]! + dec) * (m[1] === "-" ? -1n : 1n);
    return { ok: true, value: { units, scale: dec.length } };
  }
  const digits = text.replace(/[^\d,]/g, "");
  // 12.870 · 1.234.567 · 12 870 · 12 870 · 12'870: separador de miles.
  if (/^[+-]?\d{1,3}(?:([.\s'’])\d{3})(?:\1\d{3})*(?:,\d+)?$/.test(text)) {
    return { ok: false, error: `Sin separador de miles, como en el examen: escribe ${digits}.` };
  }
  // 2.5: punto decimal.
  if (/^[+-]?\d+\.\d+$/.test(text)) {
    return { ok: false, error: `La coma es la decimal, como en el examen: escribe ${text.replace(".", ",")}.` };
  }
  return { ok: false, error: "Escribe solo cifras (y, si hace falta, una coma decimal), sin puntos ni espacios." };
}

/** ¿La respuesta vale exactamente este entero? (12870 y 12870,0 valen lo mismo.) */
export function equalsInteger(x: ExactDecimal, n: bigint): boolean {
  return x.units === n * 10n ** BigInt(x.scale);
}

/** Aviso si la coma va seguida de tres cifras (12,870 se lee 12,87 y no 12870). */
export function commaWarning(raw: string): string | null {
  return /^\s*[+-]?\d{1,3},\d{3}\s*$/.test(raw) ? "Ojo: la coma es la decimal; si querías un número entero, escríbelo sin coma." : null;
}

/** Un entero sin separador de miles, como en el examen (los muy largos se parten donde haga falta). */
export const integerText = (n: bigint): string => n.toString().replace("-", "−");
