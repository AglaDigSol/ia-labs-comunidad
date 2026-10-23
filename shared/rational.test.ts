import { describe, expect, it } from "vitest";
import {
  add,
  equals,
  formatDecimal,
  formatFrac,
  frac,
  ONE,
  parseNumber,
  sum,
  toTexNumber,
} from "./rational.ts";

const MSG = "Escribe un número entre 0 y 1 (por ejemplo, 0,25 o 1/4).";
const val = (s: string) => {
  const r = parseNumber(s);
  if (!r.ok) throw new Error(`no parsea: ${s}`);
  return formatFrac(r.value);
};

describe("parseNumber", () => {
  it.each([
    ["0,75", "3/4"],
    ["0.75", "3/4"],
    [".5", "1/2"],
    ["3/4", "3/4"],
    ["-0.2", "-1/5"],
    ["−0,2", "-1/5"],
    ["1,1", "11/10"],
    ["25%", "1/4"],
    ["1", "1"],
  ])("%s -> %s", (input, out) => {
    expect(val(input)).toBe(out);
  });

  it.each(["", "1e-3", "1,000.5", "0,2,5", "abc", "1/0", "x".repeat(33), "0,1234567890123"])(
    "rechaza %j",
    (input) => {
      const r = parseNumber(input);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe(MSG);
    },
  );
});

describe("aritmética exacta y formato", () => {
  it("sin error de coma flotante", () => {
    expect(equals(add(frac(1n, 10n), frac(2n, 10n)), frac(3n, 10n))).toBe(true);
    expect(equals(sum([frac(7n, 10n), frac(2n, 10n), frac(1n, 10n)]), ONE)).toBe(true);
  });
  it("formatos", () => {
    expect(formatFrac(frac(-1n, 6n))).toBe("-1/6");
    expect(formatDecimal(frac(39n, 80n))).toEqual({ text: "0,4875", exact: true });
    expect(formatDecimal(frac(1n, 3n))).toEqual({ text: "0,3333", exact: false });
    expect(formatDecimal(frac(2n, 3n)).text).toBe("0,6667");
    expect(formatDecimal(frac(119n, 200n), 4, { pad: true }).text).toBe("0,5950");
    expect(formatDecimal(frac(119n, 200n)).text).toBe("0,595");
    expect(toTexNumber(frac(119n, 200n))).toBe("0{,}595");
  });
  it("denominador cero lanza", () => {
    expect(() => frac(1n, 0n)).toThrow();
  });
});
