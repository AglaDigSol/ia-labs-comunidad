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

/**
 * El decimal que acompaña a una fracción: exacto («= 0,375») o redondeado a `digits` cifras sin
 * quitar ceros («≈ 0,33», «≈ 1,00»). Si la fracción es un decimal exacto más largo, se escriben los
 * dos («= 0,9963 ≈ 1,00»), para que se vea de dónde sale el redondeo.
 */
function decimalParts(x: Frac, digits: number): string[] {
  const d = formatDecimal(x, digits);
  if (d.exact) return ["=", d.text];
  const rounded = formatDecimal(x, digits, { pad: true }).text;
  const long = formatDecimal(x, 6);
  return long.exact ? ["=", long.text, "≈", rounded] : ["≈", rounded];
}

/** «3/8 = 0,375», «1/3 ≈ 0,33», «9963/10000 = 0,9963 ≈ 1,00», «2» (sin repetir si es entero). */
export function probWithDecimal(x: Frac, digits = PROB_DIGITS): string {
  if (x.d === 1n) return probText(x);
  return `${probText(x)} ${decimalParts(x, digits).join(" ")}`;
}

/** Lo mismo en TeX. */
export function probWithDecimalTex(x: Frac, digits = PROB_DIGITS): string {
  if (x.d === 1n) return probTex(x);
  const tex = decimalParts(x, digits).map((t) => (t === "≈" ? "\\approx" : t === "=" ? "=" : t.replace("−", "-").replace(",", "{,}")));
  return `${probTex(x)} ${tex.join(" ")}`;
}

/** Un número en coma flotante, con coma decimal y `digits` cifras. */
export function decimalComma(v: number, digits = PROB_DIGITS): string {
  const s = v.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
  return (s === "-0" ? "0" : s).replace("-", "−").replace(".", ",");
}

const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";

/**
 * El nombre de una rama en TeX: «S₁» → S_{1} (KaTeX no admite los subíndices Unicode, ni en \text),
 * una letra sola en cursiva y una palabra («Phishing», «Legítimo») en \text{}. Solo letras, cifras y
 * subíndices: lo demás se quita.
 */
export function branchTex(name: string): string {
  const m = /^(.*?)([₀-₉]+)$/u.exec(name);
  const base = (m ? m[1]! : name).replace(/[^\p{L}\p{N} ]/gu, "");
  const sub = m ? [...m[2]!].map((c) => SUBSCRIPT_DIGITS.indexOf(c)).join("") : "";
  const head = /^[A-Za-z]$/.test(base) ? base : `\\text{${base}}`;
  return sub ? `${head}_{${sub}}` : head;
}
