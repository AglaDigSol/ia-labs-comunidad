// Valida el contenido del laboratorio de cálculo (content/calculo/) con su esquema zod y comprueba
// que cada ejemplo sirve para lo que dice: primitivas inmediatas, integrales definidas finitas, puntos
// del gradiente dentro del dibujo y funciones del simulador que se pueden recorrer.
import { describe, expect, it } from "vitest";
import { CALC_PACK } from "../content/calculo/practica.ts";
import { antiderivative } from "../shared/calculus/antiderivative.ts";
import { criticalPoints } from "../shared/calculus/critical.ts";
import { objective, runDescent } from "../shared/calculus/descent.ts";
import { isEquivalent } from "../shared/calculus/equivalence.ts";
import { evaluate, type Expr, type VarName } from "../shared/calculus/expr.ts";
import { derivativeRaw } from "../shared/calculus/derive.ts";
import { definiteIntegral } from "../shared/calculus/integrals.ts";
import { parseExpr } from "../shared/calculus/parser.ts";
import { CalcPackSchema } from "../shared/calculus/schema.ts";

const issues = (r: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } }) =>
  r.success ? [] : r.error!.issues.map((i) => `${i.path.map(String).join(".")}: ${i.message}`);

const read = (s: string, vars: VarName[] = ["x"]): Expr => {
  const r = parseExpr(s, { vars });
  if (!r.ok) throw new Error(r.error.message);
  return r.expr;
};

describe("content/calculo", () => {
  it("cumple CalcPackSchema", () => {
    expect(issues(CalcPackSchema.safeParse(CALC_PACK))).toEqual([]);
  });

  it("el esquema rechaza una función ilegible y un polinomio con puntos críticos irracionales", () => {
    const bad = { ...CALC_PACK, derivatives: [...CALC_PACK.derivatives, { id: "mal", level: "básico", f: "2x +" }] };
    expect(issues(CalcPackSchema.safeParse(bad)).join(" ")).toMatch(/no se lee/);
    const irr = { ...CALC_PACK, critical: [...CALC_PACK.critical, { id: "raiz", level: "medio", f: "x^3 - 2x + y^2", x: [-2, 2], y: [-2, 2] }] };
    expect(issues(CalcPackSchema.safeParse(irr)).join(" ")).toMatch(/no son todos racionales/);
  });

  it("todas las primitivas son inmediatas (la solución las sabe escribir y se comprueban derivando)", () => {
    for (const a of CALC_PACK.antiderivatives) {
      const f = read(a.f);
      const F = antiderivative(f);
      expect(F, a.id).not.toBeNull();
      expect(isEquivalent(derivativeRaw(F!), f), a.id).toBe(true);
    }
  });

  it("las integrales definidas son finitas y las tangentes, en un punto del dominio", () => {
    for (const d of CALC_PACK.definite) expect(Number.isFinite(definiteIntegral(read(d.f), d.a, d.b)), d.id).toBe(true);
    for (const t of CALC_PACK.tangents) {
      expect(Number.isFinite(evaluate(read(t.f), { x: t.x0 })), t.id).toBe(true);
      expect(t.x0 > t.range[0] && t.x0 < t.range[1], t.id).toBe(true);
    }
    for (const m of CALC_PACK.multivariable) {
      expect(m.point[0] >= m.x[0] && m.point[0] <= m.x[1] && m.point[1] >= m.y[0] && m.point[1] <= m.y[1], m.id).toBe(true);
    }
  });

  it("los puntos críticos caen dentro del dibujo y hay mínimos, máximos y sillas", () => {
    const kinds = new Set<string>();
    for (const c of CALC_PACK.critical) {
      const r = criticalPoints(read(c.f, ["x", "y"]));
      if (!r.ok) throw new Error(c.id);
      for (const p of r.points) {
        kinds.add(p.kind);
        const [x, y] = [Number(p.x.n) / Number(p.x.d), Number(p.y.n) / Number(p.y.d)];
        expect(x > c.x[0] && x < c.x[1] && y > c.y[0] && y < c.y[1], c.id).toBe(true);
      }
    }
    expect(kinds).toEqual(new Set(["minimo", "maximo", "silla"]));
  });

  it("el simulador: el punto de partida está en el dibujo y la silla se escapa", () => {
    for (const d of CALC_PACK.descent1) expect(d.start >= d.range[0] && d.start <= d.range[1], d.id).toBe(true);
    for (const d of CALC_PACK.descent2) {
      expect(d.start[0] >= d.x[0] && d.start[0] <= d.x[1] && d.start[1] >= d.y[0] && d.start[1] <= d.y[1], d.id).toBe(true);
      const run = runDescent(objective(read(d.f, ["x", "y"]), 2), { alpha: d.alpha, start: d.start, iterations: d.iterations });
      const last = run.points.at(-1)!;
      const inside = last[0]! >= d.x[0] && last[0]! <= d.x[1] && last[1]! >= d.y[0] && last[1]! <= d.y[1];
      expect(inside, d.id).toBe(d.id !== "silla");
    }
  });
});
