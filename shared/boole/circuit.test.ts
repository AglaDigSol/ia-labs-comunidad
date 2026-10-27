import { describe, expect, it } from "vitest";
import { CIRCUIT_PACK } from "../../content/boole/circuitos.ts";
import { compareFormulas } from "../logic/compare.ts";
import {
  circuitFromExpression,
  circuitLayers,
  circuitsEquivalent,
  circuitToExpression,
  circuitToPlain,
  circuitTruthTable,
  evaluateCircuit,
  firstDifference,
  GATE_TYPES,
  gateValue,
  layoutCircuit,
  toNand,
  toNor,
  validateNetlist,
  type GateType,
  type Netlist,
} from "./circuit.ts";
import { band, bconst, bnot, bor, booleVars, bvar, evalBoole, parseBoole, toLogicNode, type BExpr } from "./expr.ts";

const p = (s: string, xor = false): BExpr => {
  const r = parseBoole(s, { xor });
  if (!r.ok) throw new Error(r.error.message);
  return r.expr;
};
const equivalent = (a: BExpr, b: BExpr) => {
  const c = compareFormulas(toLogicNode(a), toLogicNode(b));
  return c.ok && c.equivalent;
};
/** El circuito calcula lo mismo que la expresión, sobre las variables dadas. */
const computes = (net: Netlist, e: BExpr, vars: string[]) => {
  const n = vars.length;
  return circuitTruthTable(net, vars).every(
    (v, m) => v === evalBoole(e, Object.fromEntries(vars.map((x, i) => [x, ((m >> (n - 1 - i)) & 1) === 1]))),
  );
};
const bits = (t: boolean[]) => t.map((b) => (b ? "1" : "0")).join("");

// Generador pseudoaleatorio con semilla (mulberry32): las pruebas aleatorias son reproducibles.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randomExpr(r: () => number, vars: string[], depth: number): BExpr {
  const x = r();
  if (depth === 0 || x < 0.25) {
    if (r() < 0.08) return bconst(r() < 0.5 ? 0 : 1);
    return bvar(vars[Math.floor(r() * vars.length)]!);
  }
  if (x < 0.45) return bnot(randomExpr(r, vars, depth - 1));
  const k = 2 + Math.floor(r() * 3);
  const args = Array.from({ length: k }, () => randomExpr(r, vars, depth - 1));
  return x < 0.72 ? bor(...args) : band(...args);
}
const RANDOM = (() => {
  const r = rng(20261027);
  const all = ["x", "y", "z", "w"];
  return Array.from({ length: 150 }, () => randomExpr(r, all.slice(0, 1 + Math.floor(r() * 4)), 4));
})();

const single = (type: GateType, k: number): Netlist => {
  const inputs = ["a", "b", "c"].slice(0, k);
  return { inputs, gates: [{ id: "g1", type, inputs }], output: "g1" };
};

describe("puertas", () => {
  const TABLES: Record<GateType, string> = {
    or: "0111",
    and: "0001",
    xor: "0110",
    nor: "1000",
    nand: "1110",
    xnor: "1001",
    not: "10",
  };
  for (const t of GATE_TYPES) {
    it(`${t}: evaluateCircuit coincide con la tabla de la puerta`, () => {
      const net = single(t, t === "not" ? 1 : 2);
      expect(bits(circuitTruthTable(net))).toBe(TABLES[t]);
      expect(equivalent(circuitToExpression(net), p(circuitToPlain(net), true))).toBe(true);
    });
  }

  it("con tres entradas, XOR es la paridad y XNOR su complemento", () => {
    expect(bits(circuitTruthTable(single("xor", 3)))).toBe("01101001");
    expect(bits(circuitTruthTable(single("xnor", 3)))).toBe("10010110");
    expect(bits(circuitTruthTable(single("nand", 3)))).toBe("11111110");
    expect(gateValue("nor", [false, false, false])).toBe(true);
  });

  it("evaluateCircuit da el valor de cada cable", () => {
    const net: Netlist = {
      inputs: ["x", "y"],
      gates: [
        { id: "g1", type: "not", inputs: ["x"] },
        { id: "g2", type: "and", inputs: ["g1", "y"] },
      ],
      output: "g2",
    };
    expect(evaluateCircuit(net, { x: false, y: true })).toEqual({
      output: true,
      wires: { "0": false, "1": true, x: false, y: true, g1: true, g2: true },
    });
  });
});

describe("validateNetlist", () => {
  const ok: Netlist = {
    inputs: ["x", "y"],
    gates: [
      { id: "g1", type: "and", inputs: ["x", "y"] },
      { id: "g2", type: "not", inputs: ["g1"] },
    ],
    output: "g2",
  };

  it("acepta un circuito bien formado y las constantes 0 y 1", () => {
    expect(validateNetlist(ok)).toBeNull();
    expect(validateNetlist({ inputs: ["x"], gates: [{ id: "g1", type: "or", inputs: ["x", "1"] }], output: "g1" })).toBeNull();
  });

  it("detecta ciclos", () => {
    const cyc: Netlist = {
      inputs: ["x"],
      gates: [
        { id: "g1", type: "and", inputs: ["x", "g2"] },
        { id: "g2", type: "not", inputs: ["g1"] },
      ],
      output: "g2",
    };
    expect(validateNetlist(cyc)?.code).toBe("cycle");
    const self: Netlist = { inputs: ["x"], gates: [{ id: "g1", type: "or", inputs: ["x", "g1"] }], output: "g1" };
    expect(validateNetlist(self)?.code).toBe("cycle");
    expect(() => circuitToExpression(cyc)).toThrow(/ciclo/);
  });

  it("exige entradas definidas, la aridad correcta, una salida y que todo llegue a ella", () => {
    expect(validateNetlist({ ...ok, gates: [{ id: "g1", type: "and", inputs: ["x", "q"] }], output: "g1" })?.code).toBe("undefined");
    expect(validateNetlist({ ...ok, gates: [{ id: "g1", type: "not", inputs: ["x", "y"] }], output: "g1" })?.code).toBe("arity");
    expect(validateNetlist({ ...ok, gates: [{ id: "g1", type: "and", inputs: ["x"] }], output: "g1" })?.code).toBe("arity");
    expect(validateNetlist({ ...ok, output: "g9" })?.code).toBe("no-output");
    expect(validateNetlist({ ...ok, output: "g1" })?.code).toBe("unused");
    expect(validateNetlist({ ...ok, inputs: ["x", "x"] })?.code).toBe("duplicate");
    expect(validateNetlist({ ...ok, gates: [...ok.gates, { id: "x", type: "not", inputs: ["y"] }] })?.code).toBe("duplicate");
  });
});

describe("circuitToExpression", () => {
  for (const c of CIRCUIT_PACK.circuits) {
    it(`${c.id}: la expresión coincide con su tabla de verdad`, () => {
      const e = circuitToExpression(c);
      const n = c.inputs.length;
      const table = Array.from({ length: 1 << n }, (_, m) =>
        evalBoole(e, Object.fromEntries(c.inputs.map((x, i) => [x, ((m >> (n - 1 - i)) & 1) === 1]))),
      );
      expect(bits(table)).toBe(c.table);
      // La fórmula «a nivel de puertas» (con ⊻) se vuelve a leer y es equivalente.
      expect(equivalent(p(circuitToPlain(c), true), e)).toBe(true);
    });
  }

  it("lee ⊻ y (…)′ como en el dibujo", () => {
    const c = CIRCUIT_PACK.circuits.find((x) => x.id === "producto-contra-nand")!;
    expect(circuitToPlain(c)).toBe("(x ⊙ y) ⊻ (y ⊙ z)′");
  });
});

describe("circuitFromExpression", () => {
  it("fromExpression → toExpression es equivalente (150 expresiones aleatorias, semilla fija, hasta 4 variables)", () => {
    for (const e of RANDOM) {
      const net = circuitFromExpression(e);
      expect(validateNetlist(net)).toBeNull();
      expect(equivalent(circuitToExpression(net), e)).toBe(true);
      expect(computes(net, e, booleVars(e))).toBe(true);
      expect(net.gates.every((g) => g.type === "or" || g.type === "and" || g.type === "not")).toBe(true);
    }
  });

  it("reutiliza subexpresiones iguales y parte las puertas de más de 4 entradas", () => {
    const net = circuitFromExpression(p("x′ ⊙ y ⊕ x′ ⊙ z"));
    expect(net.gates.filter((g) => g.type === "not")).toHaveLength(1);
    const wide = circuitFromExpression(p("a ⊕ b ⊕ c ⊕ d ⊕ e ⊕ f"));
    expect(wide.gates.every((g) => g.inputs.length <= 4)).toBe(true);
    expect(equivalent(circuitToExpression(wide), p("a ⊕ b ⊕ c ⊕ d ⊕ e ⊕ f"))).toBe(true);
  });

  it("una variable o una constante sola no necesitan puertas", () => {
    expect(circuitFromExpression(p("x"))).toEqual({ inputs: ["x"], gates: [], output: "x" });
    const one = circuitFromExpression(p("1"));
    expect(one.gates).toHaveLength(0);
    expect(circuitTruthTable(one)).toEqual([true]);
  });
});

describe("puertas universales", () => {
  const cases: Array<[string, Netlist]> = [
    ...CIRCUIT_PACK.circuits.map((c) => [c.id, c] as [string, Netlist]),
    ...RANDOM.slice(0, 60).map((e, i) => [`aleatoria ${i}`, circuitFromExpression(e)] as [string, Netlist]),
    ...GATE_TYPES.flatMap((t) => [[`${t} sola`, single(t, t === "not" ? 1 : 2)] as [string, Netlist], [`${t} de 3`, single(t, t === "not" ? 1 : 3)] as [string, Netlist]]),
  ];
  for (const [u, f] of [
    ["nand", toNand],
    ["nor", toNor],
  ] as const) {
    it(`solo ${u.toUpperCase()}: equivalente y sin otras puertas`, () => {
      for (const [name, net] of cases) {
        const t = f(net);
        expect(validateNetlist(t), name).toBeNull();
        expect(t.gates.every((g) => g.type === u), name).toBe(true);
        expect(circuitsEquivalent(net, t), name).toBe(true);
      }
    });
  }

  it("x′ con NAND es una sola puerta y los dobles complementos se cancelan", () => {
    const not = toNand(single("not", 1));
    expect(not.gates).toEqual([{ id: "g1", type: "nand", inputs: ["a", "a"] }]);
    // AND con NAND: dos puertas; NOT(AND) con NAND: una (el doble complemento desaparece).
    expect(toNand(single("and", 2)).gates).toHaveLength(2);
    expect(toNand(circuitFromExpression(p("(x ⊙ y)′"))).gates).toHaveLength(1);
    expect(toNor(circuitFromExpression(p("(x ⊕ y)′"))).gates).toHaveLength(1);
    // XOR con NAND: las cuatro puertas clásicas.
    expect(toNand(single("xor", 2)).gates).toHaveLength(4);
  });
});

describe("capas y disposición", () => {
  it("capa de cada señal: entradas en 0 y cada puerta tras la más profunda de sus entradas", () => {
    const c = CIRCUIT_PACK.circuits.find((x) => x.id === "dos-caminos")!;
    expect(circuitLayers(c)).toEqual({ layer: { x: 0, y: 0, "0": 0, "1": 0, g1: 1, g2: 2, g3: 3 }, depth: 3 });
  });

  for (const c of CIRCUIT_PACK.circuits) {
    it(`${c.id}: puertas en su columna, sin solaparse, y cables que empiezan y acaban en su sitio`, () => {
      const L = layoutCircuit(c);
      const { layer } = circuitLayers(c);
      const gates = L.nodes.filter((n) => n.kind === "gate");
      expect(gates).toHaveLength(c.gates.length);
      for (const a of gates) {
        if (a.kind !== "gate") continue;
        expect(a.layer).toBe(layer[a.id]);
        expect(a.y - a.h / 2).toBeGreaterThan(0);
        expect(a.y + a.h / 2).toBeLessThan(L.height);
        expect(a.x + a.w).toBeLessThan(L.width);
        for (const b of gates) {
          if (b === a || b.kind !== "gate" || b.layer !== a.layer) continue;
          const overlap = Math.abs(a.y - b.y) < (a.h + b.h) / 2;
          expect(overlap, `${a.id} y ${b.id}`).toBe(false);
        }
      }
      // Cada cable tiene tramos horizontales o verticales.
      for (const w of L.wires) {
        for (let i = 1; i < w.points.length; i++) {
          const [x0, y0] = w.points[i - 1]!;
          const [x1, y1] = w.points[i]!;
          expect(x0 === x1 || Math.abs(y0 - y1) < 1e-9).toBe(true);
        }
      }
      // Etiquetas A, B… para todas las puertas menos la salida.
      expect(Object.keys(L.labels).sort()).toEqual(c.gates.filter((g) => g.id !== c.output).map((g) => g.id).sort());
      expect(L.output.to[0]).toBeGreaterThan(L.output.from[0]);
    });
  }
});

describe("firstDifference y ⊻", () => {
  it("primera fila (en orden 00…, 01…) donde difieren", () => {
    expect(firstDifference(p("x ⊕ y"), p("x ⊙ y"), ["x", "y"])).toEqual({
      vars: ["x", "y"],
      values: [false, true],
      expected: true,
      given: false,
    });
    expect(firstDifference(p("x ⊕ x′ ⊙ y"), p("x ⊕ y"), ["x", "y"])).toBeNull();
  });

  it("parseBoole solo acepta ⊻ con { xor: true } y lo desarrolla", () => {
    expect(parseBoole("x ⊻ y").ok).toBe(false);
    const e = p("x ⊻ y", true);
    expect(equivalent(e, p("x ⊙ y′ ⊕ x′ ⊙ y"))).toBe(true);
    expect(booleVars(p("x ^ (y ⊕ z)", true))).toEqual(["x", "y", "z"]);
    // ⊕ sigue siendo la suma aunque se acepte ⊻.
    expect(equivalent(p("x ⊕ y", true), p("x + y"))).toBe(true);
  });
});
