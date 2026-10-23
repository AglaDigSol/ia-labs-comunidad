// Exact BigInt rationals. No float tolerance anywhere except toNumber (display/plot only).

export interface Frac {
  n: bigint;
  d: bigint;
}

export const PARSE_ERROR = "Escribe un número entre 0 y 1 (por ejemplo, 0,25 o 1/4).";
const MAX_INPUT = 32;
const MAX_DIGITS = 12;

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    [x, y] = [y, x % y];
  }
  return x;
}

export function frac(n: bigint, d: bigint = 1n): Frac {
  if (d === 0n) throw new RangeError("Denominador cero");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return g > 1n ? { n: n / g, d: d / g } : { n, d };
}

export const ZERO: Frac = { n: 0n, d: 1n };
export const ONE: Frac = { n: 1n, d: 1n };

export const add = (a: Frac, b: Frac): Frac => frac(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Frac, b: Frac): Frac => frac(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Frac, b: Frac): Frac => frac(a.n * b.n, a.d * b.d);
export function div(a: Frac, b: Frac): Frac {
  if (b.n === 0n) throw new RangeError("División por cero");
  return frac(a.n * b.d, a.d * b.n);
}
export const neg = (a: Frac): Frac => ({ n: -a.n, d: a.d });
export const cmp = (a: Frac, b: Frac): number => {
  const l = a.n * b.d;
  const r = b.n * a.d;
  return l < r ? -1 : l > r ? 1 : 0;
};
export const isZero = (a: Frac): boolean => a.n === 0n;
export const sign = (a: Frac): -1 | 0 | 1 => (a.n < 0n ? -1 : a.n > 0n ? 1 : 0);
export const equals = (a: Frac, b: Frac): boolean => a.n === b.n && a.d === b.d;
export const sum = (xs: readonly Frac[]): Frac => xs.reduce(add, ZERO);

export type ParseResult = { ok: true; value: Frac } | { ok: false; error: string };
const fail = (): ParseResult => ({ ok: false, error: PARSE_ERROR });

function isDigits(s: string): boolean {
  if (s.length === 0) return false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  return true;
}

export function parseNumber(text: string): ParseResult {
  if (text.length > MAX_INPUT) return fail();
  let s = text.trim();
  if (s.length === 0) return fail();
  let negative = false;
  if (s[0] === "-" || s[0] === "−") {
    negative = true;
    s = s.slice(1);
  }
  let percent = false;
  if (s.endsWith("%")) {
    percent = true;
    s = s.slice(0, -1);
  }
  if (s.length === 0) return fail();

  let value: Frac;
  const slash = s.indexOf("/");
  if (slash >= 0) {
    if (percent) return fail();
    const a = s.slice(0, slash);
    const b = s.slice(slash + 1);
    if (!isDigits(a) || !isDigits(b) || a.length > MAX_DIGITS || b.length > MAX_DIGITS) return fail();
    const bd = BigInt(b);
    if (bd === 0n) return fail();
    value = frac(BigInt(a), bd);
  } else {
    let intPart = s;
    let decPart = "";
    let seps = 0;
    for (const ch of s) if (ch === "," || ch === ".") seps++;
    if (seps > 1) return fail();
    if (seps === 1) {
      const i = s.search(/[,.]/);
      intPart = s.slice(0, i);
      decPart = s.slice(i + 1);
    }
    if (intPart.length > 0 && !isDigits(intPart)) return fail();
    if (decPart.length > 0 && !isDigits(decPart)) return fail();
    if (intPart.length === 0 && decPart.length === 0) return fail();
    if (intPart.length > MAX_DIGITS || decPart.length > MAX_DIGITS) return fail();
    value = frac(BigInt((intPart || "0") + decPart), 10n ** BigInt(decPart.length));
  }
  if (percent) value = div(value, frac(100n));
  if (negative) value = neg(value);
  return { ok: true, value };
}

export function toNumber(x: Frac): number {
  return Number(x.n) / Number(x.d);
}

export function formatFrac(x: Frac): string {
  return x.d === 1n ? x.n.toString() : `${x.n}/${x.d}`;
}

export function formatDecimal(
  x: Frac,
  maxDigits = 4,
  opts: { pad?: boolean } = {},
): { text: string; exact: boolean } {
  const negative = x.n < 0n;
  const abs = negative ? -x.n : x.n;
  const scale = 10n ** BigInt(maxDigits);
  const scaled = abs * scale;
  let q = scaled / x.d;
  const r = scaled % x.d;
  const exact = r === 0n;
  if (2n * r >= x.d && !exact) q += 1n;
  const intPart = q / scale;
  let dec = (q % scale).toString().padStart(maxDigits, "0");
  if (!opts.pad) dec = dec.replace(/0+$/, "");
  const body = dec.length > 0 ? `${intPart},${dec}` : intPart.toString();
  return { text: negative && q !== 0n ? `−${body}` : body, exact };
}

export function toTexNumber(x: Frac, maxDigits = 4): string {
  return formatDecimal(x, maxDigits).text.replace(",", "{,}");
}
