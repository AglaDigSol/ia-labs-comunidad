import { describe, expect, it } from "vitest";
import { analyzeVariables, predKey, predToPlain, predToTex, type PredFormula } from "./ast.ts";
import { parsePredicate } from "./parser.ts";
import { PREDICADOS_PACK } from "../../content/predicados/practica.ts";

const parse = (s: string): PredFormula => {
  const r = parsePredicate(s);
  if (!r.ok) throw new Error(`${s}: ${r.error.message}`);
  return r.formula;
};
const plain = (s: string) => predToPlain(parse(s));
const fail = (s: string) => {
  const r = parsePredicate(s);
  if (r.ok) throw new Error(`se esperaba un error en «${s}»`);
  return r.error;
};

describe("parsePredicate", () => {
  it("lee átomos, conectivas y cuantificadores", () => {
    expect(parse("P(x)")).toEqual({ kind: "pred", name: "P", args: [{ name: "x" }] });
    expect(parse("∀x P(x)")).toEqual({ kind: "forall", variable: "x", body: { kind: "pred", name: "P", args: [{ name: "x" }] } });
    expect(parse("R(x, 2)")).toEqual({ kind: "pred", name: "R", args: [{ name: "x" }, { name: "2" }] });
    expect(plain("∀x(P(x)→Q(x))")).toBe("∀x (P(x) → Q(x))");
  });

  it("los cuantificadores ligan como ¬", () => {
    expect(plain("∀x P(x) ∧ Q(x)")).toBe("(∀x P(x)) ∧ Q(x)");
    expect(parse("∀x P(x) ∧ Q(x)").kind).toBe("and");
    expect(plain("¬∀x P(x)")).toBe("¬∀x P(x)");
    expect(plain("∀x ∃y R(x, y)")).toBe("∀x ∃y R(x, y)");
  });

  it("acepta las alternativas ASCII y de TeX", () => {
    const target = "∀x (P(x) → ∃y (R(x, y) ∧ ¬Q(y)))";
    for (const s of [
      "forall x (P(x) -> exists y (R(x,y) & ~Q(y)))",
      "A x (P(x) => E y (R(x, y) and not Q(y)))",
      "Ax (P(x) -> Ey (R(x,y) && !Q(y)))",
      "\\forall x (P(x) \\to \\exists y (R(x, y) \\land \\neg Q(y)))",
      "FORALL x: (P(x) -> EXISTS y. (R(x, y) AND NOT Q(y)))",
      "∀x, (P(x) → ∃y (R(x, y) ∧ ¬Q(y)))",
    ]) {
      expect(plain(s), s).toBe(target);
    }
    expect(plain("A(x) | E(x)")).toBe("A(x) ∨ E(x)");
    expect(plain("Ax(y) ∧ Ax P(x)")).toBe("Ax(y) ∧ ∀x P(x)");
    expect(plain("P(x) <-> Q(x)")).toBe("P(x) ↔ Q(x)");
  });

  it("→ y ↔ asocian por la derecha y ∧ liga más que ∨", () => {
    expect(plain("P(a) → Q(a) → R(a)")).toBe("P(a) → Q(a) → R(a)");
    expect(parse("P(a) → Q(a) → R(a)")).toMatchObject({ kind: "imp", right: { kind: "imp" } });
    expect(plain("P(a) ∧ Q(a) ∨ R(a)")).toBe("(P(a) ∧ Q(a)) ∨ R(a)");
  });

  it("explica los errores habituales", () => {
    expect(fail("").code).toBe("empty");
    expect(fail("P").code).toBe("missing-arguments");
    expect(fail("P()").code).toBe("missing-arguments");
    expect(fail("P(x").code).toBe("unclosed-paren");
    expect(fail("p ∧ q").code).toBe("not-a-formula");
    expect(fail("∀ P(x)").code).toBe("missing-variable");
    expect(fail("∀a P(a)").message).toContain("no es una variable");
    expect(fail("∃!x P(x)").code).toBe("unsupported");
    expect(fail("x = y").code).toBe("unsupported");
    expect(fail("x ∧ P(x)").code).toBe("not-a-formula");
    expect(fail("P(x) = Q(x)").code).toBe("unsupported");
    expect(fail("P(x) Q(x)").code).toBe("missing-operator");
    expect(fail("P(x))").code).toBe("unmatched-close");
    expect(fail("(P(x)]").code).toBe("mismatched-paren");
    expect(fail("P(x) ∧").code).toBe("missing-operand");
    expect(fail("P(x) # Q(x)").code).toBe("unexpected-char");
    expect(fail("x".repeat(400)).code).toBe("too-long");
    const e = fail("∀x (P(x) ∧ q)");
    expect([e.start, e.end]).toEqual([11, 12]);
  });
});

describe("variables libres y ligadas", () => {
  it("separa libres, ligadas y constantes", () => {
    expect(analyzeVariables(parse("∀x (P(x) → R(x, y)) ∧ Q(a) ∧ Q(2)"))).toEqual({
      free: ["y"],
      bound: ["x"],
      constants: ["a", "2"],
      vacuous: [],
    });
  });

  it("una variable puede estar libre y ligada en la misma fórmula", () => {
    const a = analyzeVariables(parse("P(x) ∧ ∃x Q(x)"));
    expect(a.free).toEqual(["x"]);
    expect(a.bound).toEqual(["x"]);
  });

  it("detecta cuantificadores que no ligan nada", () => {
    expect(analyzeVariables(parse("∀x P(y)")).vacuous).toEqual(["x"]);
  });

  it("predKey identifica fórmulas que solo cambian el nombre de las variables ligadas", () => {
    expect(predKey(parse("∀x ∃y R(x, y)"))).toBe(predKey(parse("∀u ∃v R(u, v)")));
    expect(predKey(parse("∀x ∃y R(x, y)"))).not.toBe(predKey(parse("∀x ∃y R(y, x)")));
    expect(predKey(parse("∀x P(x)"))).not.toBe(predKey(parse("∀y P(x)")));
  });
});

describe("escritura de libro", () => {
  it("toTex", () => {
    expect(predToTex(parse("∀x (P(x) → ¬Q(x, a))"))).toBe("\\forall x\\, (P(x) \\to \\lnot Q(x, a))");
    expect(predToTex(parse("∃x1 Par(x1)"))).toBe("\\exists x_{1}\\, \\mathit{Par}(x_{1})");
  });

  it("paréntesis entre binarios distintos, como en lógica proposicional", () => {
    expect(plain("P(a) → Q(a) ↔ Q(a) → P(a)")).toBe("(P(a) → Q(a)) ↔ (Q(a) → P(a))");
    expect(plain("P(a) ∧ Q(a) ∧ R(a)")).toBe("P(a) ∧ Q(a) ∧ R(a)");
  });

  // Vuelta: leer lo que se escribe da el mismo árbol.
  const roundTrip = (f: PredFormula) => {
    const r = parsePredicate(predToPlain(f));
    expect(r.ok, predToPlain(f)).toBe(true);
    if (r.ok) expect(r.formula).toEqual(f);
  };

  it("vuelta al analizador de todo el contenido", () => {
    const all = [
      ...PREDICADOS_PACK.domains.flatMap((d) => d.formulas),
      ...PREDICADOS_PACK.negation.map((n) => n.formula),
      ...PREDICADOS_PACK.translation.map((t) => t.answer),
    ];
    for (const s of all) roundTrip(parse(s));
  });

  it("vuelta al analizador de 400 fórmulas al azar (semilla fija)", () => {
    let seed = 42;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    const terms = ["x", "y", "a", "1"];
    const gen = (depth: number): PredFormula => {
      const k = depth <= 0 ? 0 : rand(8);
      if (k <= 1) {
        const n = 1 + rand(2);
        return { kind: "pred", name: ["P", "Q", "R"][rand(3)]!, args: Array.from({ length: n }, () => ({ name: terms[rand(4)]! })) };
      }
      if (k === 2) return { kind: "not", arg: gen(depth - 1) };
      if (k === 3) return { kind: rand(2) ? "forall" : "exists", variable: rand(2) ? "x" : "y", body: gen(depth - 1) };
      const kind = (["and", "or", "imp", "iff"] as const)[rand(4)]!;
      return { kind, left: gen(depth - 1), right: gen(depth - 1) };
    };
    for (let i = 0; i < 400; i++) roundTrip(gen(4));
  });
});
