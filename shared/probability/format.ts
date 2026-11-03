// Cómo se escriben las probabilidades en la solución: la fracción en TeX (\frac{3}{8}), en texto
// («3/8») y con su decimal («3/8 = 0,375» o «1/3 ≈ 0,3333»).
import { formatDecimal, formatFrac, type Frac } from "../rational.ts";
import { PROB_DIGITS } from "./answer.ts";

export const probText = (x: Frac): string => formatFrac(x).replace("-", "−");

export function probTex(x: Frac): string {
  if (x.d === 1n) return x.n.toString();
  const neg = x.n < 0n;
  return `${neg ? "-" : ""}\\frac{${neg ? -x.n : x.n}}{${x.d}}`;
}

/** El decimal (como mucho `digits` cifras) y si es exacto. */
export const probDecimal = (x: Frac, digits = PROB_DIGITS) => formatDecimal(x, digits);

/** «3/8 = 0,375», «1/3 ≈ 0,3333», «2» (sin repetir si es entero). */
export function probWithDecimal(x: Frac, digits = PROB_DIGITS): string {
  if (x.d === 1n) return probText(x);
  const d = formatDecimal(x, digits);
  return `${probText(x)} ${d.exact ? "=" : "≈"} ${d.text}`;
}

/** Lo mismo en TeX. */
export function probWithDecimalTex(x: Frac, digits = PROB_DIGITS): string {
  if (x.d === 1n) return probTex(x);
  const d = formatDecimal(x, digits);
  return `${probTex(x)} ${d.exact ? "=" : "\\approx"} ${d.text.replace("−", "-").replace(",", "{,}")}`;
}

/** Un número en coma flotante, con coma decimal y `digits` cifras. */
export function decimalComma(v: number, digits = PROB_DIGITS): string {
  const s = v.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
  return (s === "-0" ? "0" : s).replace("-", "−").replace(".", ",");
}
