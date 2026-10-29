import { describe, expect, it } from "vitest";
import {
  cartesianProduct,
  checkElements,
  checkPowerSet,
  checkProduct,
  parseElementList,
  parsePairList,
  parseSetFamily,
  powerSetOf,
  subsetText,
} from "./finite.ts";

describe("listas de elementos", () => {
  it("con o sin llaves, vacío y repetidos", () => {
    expect(parseElementList("{1, 2, 3}")).toEqual({ ok: true, value: { elements: ["1", "2", "3"], repeated: [] } });
    expect(parseElementList("a, b, a")).toEqual({ ok: true, value: { elements: ["a", "b"], repeated: ["a"] } });
    expect(parseElementList("∅")).toEqual({ ok: true, value: { elements: [], repeated: [] } });
    expect(parseElementList("{}")).toEqual({ ok: true, value: { elements: [], repeated: [] } });
    expect(parseElementList("1,,2").ok).toBe(false);
    expect(parseElementList("{1, {2}}").ok).toBe(false);
  });
});

describe("𝒫(A)", () => {
  it("2ⁿ subconjuntos, por tamaño", () => {
    const ps = powerSetOf(["a", "b", "c"]);
    expect(ps).toHaveLength(8);
    expect(ps.map(subsetText).slice(0, 4)).toEqual(["∅", "{a}", "{b}", "{c}"]);
    expect(powerSetOf([])).toEqual([[]]);
  });

  it("lee familias con o sin llaves exteriores", () => {
    expect(parseSetFamily("∅, {a}, {b}, {a, b}")).toEqual({ ok: true, value: [[], ["a"], ["b"], ["a", "b"]] });
    expect(parseSetFamily("{∅, {a}, {b, a}}")).toEqual({ ok: true, value: [[], ["a"], ["b", "a"]] });
    expect(parseSetFamily("{a, b}")).toEqual({ ok: true, value: [["a", "b"]] });
    expect(parseSetFamily("{}")).toEqual({ ok: true, value: [[]] });
    expect(parseSetFamily("{a}, b").ok).toBe(false);
    expect(parseSetFamily("{a b}").ok).toBe(false);
  });

  it("corrige sin importar el orden: marca lo que sobra y cuenta lo que falta", () => {
    const A = ["a", "b"];
    const ok = checkPowerSet([["b", "a"], [], ["a"], ["b"]], A);
    expect(ok.correct).toBe(true);
    const bad = checkPowerSet([[], ["a"], ["c"], ["a"]], A);
    expect(bad).toEqual({ wrong: [2], repeated: [3], missing: 2, right: 2, correct: false });
  });
});

describe("A × B", () => {
  it("|A|·|B| pares en orden", () => {
    expect(cartesianProduct(["1", "2"], ["x", "y", "z"])).toHaveLength(6);
    expect(cartesianProduct(["1"], ["x"])).toEqual([["1", "x"]]);
  });

  it("lee pares y detecta pares al revés", () => {
    const r = parsePairList("{(1, x), (x, 2)}");
    expect(r).toEqual({ ok: true, value: [["1", "x"], ["x", "2"]] });
    if (!r.ok) return;
    const c = checkProduct(r.value, ["1", "2"], ["x"]);
    expect(c.wrong).toEqual([1]);
    expect(c.reversed).toBe(true);
    expect(c.missing).toBe(1);
    expect(parsePairList("(1, x, y)").ok).toBe(false);
  });
});

describe("conjunto resultado", () => {
  it("checkElements", () => {
    expect(checkElements(["3", "1"], ["1", "3"]).correct).toBe(true);
    expect(checkElements(["1", "4"], ["1", "3"])).toEqual({ wrong: [1], repeated: [], missing: 1, right: 1, correct: false });
  });
});
