import { describe, expect, it } from "vitest";
import { parseFormula } from "../logic/parser.ts";
import { toPlain } from "../logic/ast.ts";
import { booleToPlain, booleToTex, literalCount, parseBoole, sameBoole, type BExpr } from "./expr.ts";
import { LAWS, type LawId } from "./laws.ts";
import { applicableLaws, checkStep, lawJustifies, lawsJustifying, trivialStep } from "./rewrite.ts";

const p = (s: string): BExpr => {
  const r = parseBoole(s);
  if (!r.ok) throw new Error(`${s}: ${r.error.message}`);
  return r.expr;
};
const just = (a: string, b: string, law: LawId) => lawJustifies(p(a), p(b), law);

describe("lectura en modo Boole", () => {
  it("⊕ es la suma y ⊙ el producto; también +, ·, ∨, ∧, ¬, ~ y la yuxtaposición", () => {
    const forms = ["x ⊕ y ⊙ z′", "x + y·z'", "x ∨ y ∧ ¬z", "x + yz′", "x+y~z", "x ⊕ y z/"];
    for (const f of forms) expect(sameBoole(p(f), p("x ⊕ (y ⊙ z′)")), f).toBe(true);
    expect(booleToPlain(p("x′y′z + x′yz"))).toBe("x′ ⊙ y′ ⊙ z ⊕ x′ ⊙ y ⊙ z");
    expect(booleToPlain(p("(x+y)'"))).toBe("(x ⊕ y)′");
    expect(booleToTex(p("(x+y)''"))).toBe("\\left(x \\oplus y\\right)''");
    expect(literalCount(p("x(y + z′) + 1"))).toBe(3);
  });

  it("x(y+z) y x1x2 se leen como productos", () => {
    expect(booleToPlain(p("x(y+z)"))).toBe("x ⊙ (y ⊕ z)");
    expect(booleToPlain(p("x1x2"))).toBe("x1 ⊙ x2");
  });

  it("no cambia cómo lee ⊕ el laboratorio de lógica", () => {
    const r = parseFormula("p ⊕ q");
    expect(r.ok && toPlain(r.ast)).toBe("p ⊻ q");
    const xy = parseFormula("xy ∧ q");
    expect(xy.ok && toPlain(xy.ast)).toBe("xy ∧ q");
    expect(parseFormula("p q").ok).toBe(false);
  });

  it("rechaza ⊻, → y ↔ en el laboratorio de Boole", () => {
    for (const s of ["x ⊻ y", "x → y", "x <-> y"]) {
      const r = parseBoole(s);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.message).toMatch(/solo se usan ⊕/);
    }
  });
});

describe("cada ley: casos positivos y negativos", () => {
  const cases: Array<[LawId, Array<[string, string]>, Array<[string, string]>]> = [
    ["B1", [["x + y", "y + x"], ["xy + z", "z + yx"]], [["x + y", "x"], ["x + 0", "x"]]],
    ["B2", [["x + (y + z)", "(x + y) + z"]], [["x(y + z)", "xy + z"]]],
    ["B3", [["x + 0", "x"], ["1 ⊙ x", "x"], ["y", "y ⊙ 1"], ["(x + 0)y", "xy"]], [["x + 1", "x"], ["x ⊙ 0", "x"]]],
    [
      "B4",
      [
        ["x(y + z)", "xy + xz"],
        ["xy + xz", "x(y + z)"],
        ["x + yz", "(x + y)(x + z)"],
        ["xyz + xyw", "xy(z + w)"],
        ["xy + xz + w", "x(y + z) + w"],
      ],
      [["x(y + z)", "xy + z"], ["xy + z", "x(y + z)"]],
    ],
    ["B5", [["x + x′", "1"], ["x x′ y", "0 ⊙ y"], ["0′", "1"], ["y(x + x′)", "y ⊙ 1"]], [["x + x′", "0"], ["x + y′", "1"]]],
    ["idempotencia", [["x + x", "x"], ["xyx", "xy"], ["x′ + x′ + y", "x′ + y"]], [["x + x′", "x"], ["xy + x", "x"]]],
    ["dominacion", [["x + 1", "1"], ["x ⊙ 0", "0"], ["xy(z + 1)", "xy ⊙ 1"]], [["x + 0", "0"], ["x ⊙ 1", "1"]]],
    [
      "absorcion",
      [
        ["x + xy", "x"],
        ["x(x + y)", "x"],
        ["xy + xyz", "xy"],
        ["x + x′y", "x + y"],
        ["z + x + xy", "z + x"],
      ],
      [["x + y", "x"], ["xy + z", "xy"]],
    ],
    ["involucion", [["x′′", "x"], ["((x + y)′)′", "x + y"], ["x′′ y′′", "xy"]], [["x′", "x"], ["(x′y)′", "xy′"]]],
    [
      "demorgan",
      [
        ["(x + y)′", "x′y′"],
        ["(xy)′", "x′ + y′"],
        ["(x + y + z)′", "x′y′z′"],
        ["(x + y + z)′", "x′(y + z)′"],
        ["x′y′", "(x + y)′"],
      ],
      [["(x + y)′", "x′ + y′"], ["(xy)′", "x′y′"]],
    ],
    [
      "consenso",
      [
        ["xy + x′z + yz", "xy + x′z"],
        ["(x + y)(x′ + z)(y + z)", "(x + y)(x′ + z)"],
        ["x + x′z + z", "x + x′z"],
      ],
      [["xy + x′z", "xy"], ["xy + xz + yz", "xy + xz"]],
    ],
  ];
  for (const [law, pos, neg] of cases) {
    it(`${law}: encaja`, () => {
      for (const [a, b] of pos) expect(just(a, b, law), `${a} → ${b}`).toBe(true);
    });
    it(`${law}: no encaja`, () => {
      for (const [a, b] of neg) expect(just(a, b, law), `${a} → ${b}`).toBe(false);
    });
  }

  it("todas las leyes tienen nombre y TeX", () => {
    expect(LAWS).toHaveLength(11);
    for (const l of LAWS) expect(l.name.length * l.tex.length).toBeGreaterThan(0);
  });
});

describe("De Morgan con complementos anidados", () => {
  it("((xy)′ + z)′ → (xy)′′ z′ y también, cancelando, xyz′", () => {
    expect(just("((xy)′ + z)′", "(xy)′′ z′", "demorgan")).toBe(true);
    expect(just("((xy)′ + z)′", "x y z′", "demorgan")).toBe(true);
  });
  it("(x′ + y)′ → x y′", () => {
    expect(just("(x′ + y)′", "x y′", "demorgan")).toBe(true);
    expect(just("(x′ + y)′", "x′′ y′", "demorgan")).toBe(true);
  });
  it("dentro de otra expresión y en dos sitios a la vez", () => {
    expect(just("z + (x′y)′", "z + x + y′", "demorgan")).toBe(true);
    expect(just("(x + y)′ + (zw)′", "x′y′ + z′ + w′", "demorgan")).toBe(true);
  });
});

describe("absorción x ⊕ (x ⊙ y) = x", () => {
  it("en los dos sentidos y con orden cambiado", () => {
    expect(just("x ⊕ (x ⊙ y)", "x", "absorcion")).toBe(true);
    expect(just("(y ⊙ x) ⊕ x", "x", "absorcion")).toBe(true);
    expect(just("x", "x ⊕ x ⊙ y", "absorcion")).toBe(true);
  });
});

describe("checkStep", () => {
  it("equivalente y con la ley correcta", () => {
    expect(checkStep(p("x + xy"), p("x"), "absorcion")).toEqual({ ok: true, lawMatches: true, suggestions: [] });
  });
  it("equivalente pero con otra ley: sugiere la buena", () => {
    const r = checkStep(p("x + xy"), p("x"), "demorgan");
    expect(r).toMatchObject({ ok: true, lawMatches: false });
    if (r.ok) expect(r.suggestions).toContain("absorcion");
  });
  it("no equivalente: da una fila donde difieren", () => {
    const r = checkStep(p("x + y"), p("x"), "absorcion");
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === "not-equivalent") {
      expect(r.row.vars).toEqual(["x", "y"]);
      expect(r.row.values).toEqual([false, true]);
      expect([r.row.before, r.row.after]).toEqual([true, false]);
    }
  });
  it("reordenar es B1/B2", () => {
    expect(lawsJustifying(p("x + y"), p("y + x"))).toEqual(["B1", "B2"]);
  });
});

describe("pistas: leyes aplicables", () => {
  it("x + xy + 0", () => {
    const laws = applicableLaws(p("x + xy + 0"));
    expect(laws).toContain("absorcion");
    expect(laws).toContain("B3");
    expect(laws).not.toContain("demorgan");
    expect(laws).not.toContain("B1");
  });
  it("(x + y)′′", () => {
    expect(applicableLaws(p("(x + y)′′"))).toEqual(expect.arrayContaining(["involucion", "demorgan"]));
  });
  it("una variable sola no admite ninguna", () => {
    expect(applicableLaws(p("x"))).toEqual([]);
  });
});

describe("trivialStep («He terminado» antes de felicitar)", () => {
  it("encuentra constantes neutras, dominantes, términos repetidos y dobles complementos", () => {
    expect(trivialStep(p("x ⊙ y ⊕ 0"))).toEqual({ law: "B3", constant: 0, op: "or" });
    expect(trivialStep(p("x ⊙ 1 ⊕ y"))).toEqual({ law: "B3", constant: 1, op: "and" });
    expect(trivialStep(p("x ⊙ y ⊕ 1"))).toEqual({ law: "dominacion", constant: 1, op: "or" });
    expect(trivialStep(p("(x ⊕ y) ⊙ 0"))).toEqual({ law: "dominacion", constant: 0, op: "and" });
    expect(trivialStep(p("x ⊙ y ⊕ x ⊙ y"))).toMatchObject({ law: "idempotencia", op: "or" });
    expect(trivialStep(p("z ⊕ x ⊙ x"))).toMatchObject({ law: "idempotencia", op: "and" });
    expect(trivialStep(p("(x′)′ ⊙ y"))).toEqual({ law: "involucion" });
    expect(trivialStep(p("x ⊙ 0′"))).toEqual({ law: "B5", constant: 0 });
  });

  it("coincide con las leyes que applicableLaws ve aplicables", () => {
    for (const s of ["x ⊙ y ⊕ 0", "x ⊙ y ⊕ 1", "x ⊕ x", "x ⊙ 1"]) {
      const t = trivialStep(p(s))!;
      expect(applicableLaws(p(s))).toContain(t.law);
    }
  });

  it("nada que quitar en una expresión ya limpia", () => {
    for (const s of ["x ⊙ y", "x′ ⊙ z ⊕ y ⊙ z", "(x ⊕ y)′", "0", "1", "x"]) expect(trivialStep(p(s)), s).toBeNull();
  });
});
