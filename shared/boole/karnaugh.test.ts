import { describe, expect, it } from "vitest";
import { booleVector, vectorDontCares, vectorFromLists, vectorOnes } from "./canonical.ts";
import { booleToPlain, evalBoole } from "./expr.ts";
import {
  checkKMapGroups,
  grayCode,
  groupLiterals,
  implicantCells,
  kmapColLabel,
  kmapExpression,
  kmapLayout,
  kmapMinterm,
  kmapPosition,
  kmapRowLabel,
  kmapSolution,
  kmapTerm,
  readKMapGroup,
  type KMapMode,
} from "./karnaugh.ts";
import { minimalPOS, minimalSOP, type Implicant } from "./minimize.ts";

const VARS: Record<number, string[]> = { 2: ["x", "y"], 3: ["x", "y", "z"], 4: ["w", "x", "y", "z"] };
const ones = (n: number) => "1".repeat(1 << n);
const group = (vector: string, cells: number[], mode: KMapMode = "sop"): Implicant => {
  const r = readKMapGroup(vector, cells, mode);
  if (!r.ok) throw new Error(`grupo no válido: ${r.issue}`);
  return r.implicant;
};

// Generador con semilla fija (mulberry32), para que los casos al azar sean siempre los mismos.
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("disposición del mapa", () => {
  it("código Gray", () => {
    expect(grayCode(1)).toEqual([0, 1]);
    expect(grayCode(2)).toEqual([0, 1, 3, 2]);
  });

  it("2, 3 y 4 variables: filas con las primeras variables y columnas con el resto", () => {
    expect(kmapLayout(VARS[2]!)).toMatchObject({ rowVars: ["x"], colVars: ["y"], rowCodes: [0, 1], colCodes: [0, 1] });
    expect(kmapLayout(VARS[3]!)).toMatchObject({ rowVars: ["x"], colVars: ["y", "z"], colCodes: [0, 1, 3, 2] });
    expect(kmapLayout(VARS[4]!)).toMatchObject({ rowVars: ["w", "x"], colVars: ["y", "z"], rowCodes: [0, 1, 3, 2] });
    expect(() => kmapLayout(["x"])).toThrow();
    expect(() => kmapLayout(["a", "b", "c", "d", "e"])).toThrow();
  });

  it("rótulos de los ejes", () => {
    const l = kmapLayout(VARS[4]!);
    expect([0, 1, 2, 3].map((r) => kmapRowLabel(l, r))).toEqual(["00", "01", "11", "10"]);
    expect(kmapColLabel(l, 2)).toBe("11");
    expect(kmapRowLabel(kmapLayout(VARS[3]!), 1)).toBe("1");
  });

  it("celda ↔ mintérmino es una biyección, y las vecinas (con vuelta) difieren en un bit", () => {
    for (const n of [2, 3, 4]) {
      const l = kmapLayout(VARS[n]!);
      const R = l.rowCodes.length;
      const C = l.colCodes.length;
      const seen = new Set<number>();
      for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
          const m = kmapMinterm(l, r, c);
          seen.add(m);
          expect(kmapPosition(l, m)).toEqual({ row: r, col: c });
          for (const [dr, dc] of [[0, 1], [1, 0]] as const) {
            const nb = kmapMinterm(l, (r + dr) % R, (c + dc) % C);
            if (nb !== m) expect(Math.log2(m ^ nb) % 1, `${n}: ${m} y ${nb}`).toBe(0);
          }
        }
      }
      expect(seen.size).toBe(1 << n);
    }
  });

  it("4 variables: la celda wx = 01, yz = 11 es m₇ y la esquina inferior derecha es m₁₀", () => {
    const l = kmapLayout(VARS[4]!);
    expect(kmapMinterm(l, 1, 2)).toBe(7);
    expect(kmapMinterm(l, 3, 3)).toBe(10);
  });
});

describe("readKMapGroup", () => {
  const v4 = ones(4);

  it("acepta rectángulos de 1, 2, 4, 8 y 16 celdas, también dando la vuelta", () => {
    expect(readKMapGroup(v4, [5], "sop").ok).toBe(true);
    expect(readKMapGroup(v4, [0, 2], "sop").ok).toBe(true); // primera y última columna
    expect(readKMapGroup(v4, [0, 8], "sop").ok).toBe(true); // primera y última fila
    expect(readKMapGroup(v4, [0, 2, 8, 10], "sop").ok).toBe(true); // las cuatro esquinas
    expect(readKMapGroup(v4, [4, 5, 7, 6], "sop").ok).toBe(true); // una fila entera
    expect(readKMapGroup(v4, [0, 1, 4, 5, 12, 13, 8, 9], "sop").ok).toBe(true); // dos columnas
    expect(readKMapGroup(v4, Array.from({ length: 16 }, (_, i) => i), "sop").ok).toBe(true);
  });

  it("rechaza tamaños que no son potencia de 2, formas que no son rectángulos y grupos vacíos", () => {
    expect(readKMapGroup(v4, [], "sop")).toEqual({ ok: false, issue: "empty" });
    expect(readKMapGroup(v4, [0, 1, 3], "sop")).toEqual({ ok: false, issue: "size" });
    expect(readKMapGroup(v4, [0, 5], "sop")).toEqual({ ok: false, issue: "shape" }); // diagonal
    expect(readKMapGroup(v4, [0, 3], "sop")).toEqual({ ok: false, issue: "shape" }); // columnas yz = 00 y 11, que no son vecinas
    expect(readKMapGroup(v4, [0, 1, 5, 7], "sop")).toEqual({ ok: false, issue: "shape" }); // escalera
  });

  it("en «sop» no admite ceros; en «pos», unos; y hace falta algo que cubrir", () => {
    const v = vectorFromLists(3, [1, 3], [5, 7]); // 01010X0X
    expect(readKMapGroup(v, [1, 3, 5, 7], "sop").ok).toBe(true);
    expect(readKMapGroup(v, [1, 0], "sop")).toEqual({ ok: false, issue: "wrong-cell", cell: 0 });
    expect(readKMapGroup(v, [5, 7], "sop")).toEqual({ ok: false, issue: "no-target" });
    expect(readKMapGroup(v, [0, 2, 4, 6], "pos").ok).toBe(true);
    expect(readKMapGroup(v, [0, 1], "pos")).toEqual({ ok: false, issue: "wrong-cell", cell: 1 });
  });

  it("todas las selecciones posibles: válida ⇔ rectángulo de lados potencia de 2 con vuelta", () => {
    for (const n of [2, 3, 4]) {
      const l = kmapLayout(VARS[n]!);
      const R = l.rowCodes.length;
      const C = l.colCodes.length;
      const rects = new Set<string>();
      for (const h of [1, 2, 4].filter((x) => x <= R))
        for (const w of [1, 2, 4].filter((x) => x <= C))
          for (let r0 = 0; r0 < R; r0++)
            for (let c0 = 0; c0 < C; c0++) {
              const cells = new Set<number>();
              for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) cells.add(kmapMinterm(l, (r0 + i) % R, (c0 + j) % C));
              rects.add([...cells].sort((a, b) => a - b).join(","));
            }
      const size = 1 << n;
      for (let mask = 1; mask < 1 << size; mask++) {
        const cells = Array.from({ length: size }, (_, m) => m).filter((m) => mask & (1 << m));
        expect(readKMapGroup(ones(n), cells, "sop").ok, `${n} variables: ${cells.join(",")}`).toBe(rects.has(cells.join(",")));
      }
    }
  });
});

describe("término de un grupo", () => {
  const V = VARS[4]!;

  it("las cuatro esquinas son x′ ⊙ z′; una fila entera, w′ ⊙ x", () => {
    expect(booleToPlain(kmapTerm(V, group(ones(4), [0, 2, 8, 10]), "sop"))).toBe("x′ ⊙ z′");
    expect(booleToPlain(kmapTerm(V, group(ones(4), [4, 5, 6, 7]), "sop"))).toBe("w′ ⊙ x");
    expect(booleToPlain(kmapTerm(V, group(ones(4), [13]), "sop"))).toBe("w ⊙ x ⊙ y′ ⊙ z");
    expect(booleToPlain(kmapTerm(V, group(ones(4), Array.from({ length: 16 }, (_, i) => i)), "sop"))).toBe("1");
  });

  it("un grupo de ceros da una suma: los ceros de x = 1, z = 0 son el factor x′ ⊕ z", () => {
    const zeros = "0".repeat(16);
    expect(booleToPlain(kmapTerm(V, group(zeros, [8, 10, 12, 14], "pos"), "pos"))).toBe("w′ ⊕ z");
    expect(booleToPlain(kmapTerm(VARS[3]!, group("0".repeat(8), [4, 6], "pos"), "pos"))).toBe("x′ ⊕ z");
  });

  it("celdas y literales de un implicante", () => {
    const g = group(ones(4), [0, 2, 8, 10]);
    expect(implicantCells(4, g)).toEqual([0, 2, 8, 10]);
    expect(groupLiterals(g)).toBe(2);
  });

  it("expresión de una agrupación vacía: 0 en suma de productos y 1 en producto de sumas", () => {
    expect(booleToPlain(kmapExpression(V, [], "sop"))).toBe("0");
    expect(booleToPlain(kmapExpression(V, [], "pos"))).toBe("1");
  });
});

describe("agrupación mínima", () => {
  it("coincide en literales con minimalSOP y minimalPOS (300 funciones al azar, con X) y calcula la función", () => {
    const rand = rng(20261111);
    for (let t = 0; t < 300; t++) {
      const n = 2 + Math.floor(rand() * 3);
      const vars = VARS[n]!;
      const v = Array.from({ length: 1 << n }, () => {
        const r = rand();
        return r < 0.45 ? "1" : r < 0.85 ? "0" : "X";
      }).join("");
      for (const mode of ["sop", "pos"] as const) {
        const sol = kmapSolution(v, mode);
        const lits = sol.reduce((s, g) => s + groupLiterals(g), 0);
        const ref = (mode === "sop" ? minimalSOP : minimalPOS)(vars, vectorOnes(v), vectorDontCares(v));
        expect(lits, `${v} ${mode}`).toBe(ref.literals);
        // Cada grupo es válido y la agrupación cubre lo que debe: la expresión vale lo mismo fuera de las X.
        for (const g of sol) expect(readKMapGroup(v, implicantCells(n, g), mode).ok, `${v} ${mode}`).toBe(true);
        expect(checkKMapGroups(v, sol, mode).status, `${v} ${mode}`).toBe("minimal");
        const e = kmapExpression(vars, sol, mode);
        const got = booleVector(e, vars);
        for (let m = 0; m < v.length; m++) if (v[m] !== "X") expect(got[m], `${v} ${mode} m${m}`).toBe(v[m]);
      }
    }
  });

  it("todo unos: un único grupo de 16 celdas (término 1)", () => {
    const sol = kmapSolution(ones(4), "sop");
    expect(sol).toEqual([{ care: 0, value: 0 }]);
    expect(checkKMapGroups(ones(4), sol, "sop")).toMatchObject({ status: "minimal", literals: 0, terms: 1 });
  });

  it("sin nada que agrupar, la agrupación vacía es la mínima", () => {
    expect(kmapSolution("0000", "sop")).toEqual([]);
    expect(checkKMapGroups("0000", [], "sop").status).toBe("minimal");
    expect(checkKMapGroups("1111", [], "pos").status).toBe("minimal");
  });

  it("ordenada de mayor a menor", () => {
    // Σm(0, 2, 8, 10, 15): las esquinas (4 celdas) y m₁₅ suelto.
    const sol = kmapSolution(vectorFromLists(4, [0, 2, 8, 10, 15]), "sop");
    expect(sol.map((g) => groupLiterals(g))).toEqual([2, 4]);
  });
});

describe("checkKMapGroups", () => {
  // f = Σm(1, 3, 5, 7, 6) en x, y, z: z ⊕ x ⊙ y.
  const v = vectorFromLists(3, [1, 3, 5, 6, 7]);

  it("faltan unos por cubrir", () => {
    const c = checkKMapGroups(v, [group(v, [1, 3, 5, 7])], "sop");
    expect(c.status).toBe("incomplete");
    expect(c.uncovered).toEqual([6]);
  });

  it("cubre todo pero no es mínima: grupos que sobran y grupos que se pueden agrandar", () => {
    const c = checkKMapGroups(v, [group(v, [1, 3, 5, 7]), group(v, [6]), group(v, [6, 7]), group(v, [3, 7])], "sop");
    expect(c.status).toBe("not-minimal");
    expect(c.uncovered).toEqual([]);
    // Cada uno de estos se puede quitar por separado (no todos a la vez).
    expect(c.redundant).toEqual([1, 2, 3]);
    expect(c.enlargeable).toEqual([1, 3]);
    expect(c.minimal).toEqual({ literals: 3, terms: 2 });
  });

  it("todos los grupos primos y ninguno sobra, pero aún hay una cobertura con menos literales", () => {
    // Σm(0, 1, 2, 5, 6, 7) (núcleo cíclico): con cuatro parejas cubre todo, y con tres basta.
    const w = vectorFromLists(3, [0, 1, 2, 5, 6, 7]);
    const four = [group(w, [0, 1]), group(w, [0, 2]), group(w, [5, 7]), group(w, [6, 7])];
    const c4 = checkKMapGroups(w, four, "sop");
    expect(c4.status).toBe("not-minimal");
    expect(c4.enlargeable).toEqual([]);
    // Las dos coberturas mínimas, distintas, valen las dos.
    expect(checkKMapGroups(w, [group(w, [0, 1]), group(w, [2, 6]), group(w, [5, 7])], "sop").status).toBe("minimal");
    expect(checkKMapGroups(w, [group(w, [0, 2]), group(w, [1, 5]), group(w, [6, 7])], "sop").status).toBe("minimal");
  });

  it("correcta con indiferencias, usándolas o no", () => {
    // Σm(1, 3, 7, 11, 15) + d(0, 2, 5) en w, x, y, z: w′ ⊙ z ⊕ y ⊙ z.
    const d = vectorFromLists(4, [1, 3, 7, 11, 15], [0, 2, 5]);
    const best = [group(d, [1, 3, 5, 7]), group(d, [3, 7, 11, 15])];
    expect(checkKMapGroups(d, best, "sop")).toMatchObject({ status: "minimal", literals: 4, terms: 2 });
    // Sin usar la X de m₅, el grupo de m₁ es más pequeño.
    expect(checkKMapGroups(d, [group(d, [1, 3]), group(d, [3, 7, 11, 15])], "sop").status).toBe("not-minimal");
  });

  it("producto de sumas: agrupar los ceros", () => {
    // Ceros en 0, 2, 4 de x, y, z: (x ⊕ z) ⊙ (y ⊕ z).
    const p = vectorFromLists(3, [1, 3, 5, 6, 7]);
    const groups = [group(p, [0, 2], "pos"), group(p, [0, 4], "pos")];
    const c = checkKMapGroups(p, groups, "pos");
    expect(c.status).toBe("minimal");
    expect(booleToPlain(kmapExpression(VARS[3]!, groups, "pos"))).toBe("(x ⊕ z) ⊙ (y ⊕ z)");
    // Y la expresión calcula la función.
    const e = kmapExpression(VARS[3]!, groups, "pos");
    for (let m = 0; m < 8; m++) {
      const env = { x: (m & 4) !== 0, y: (m & 2) !== 0, z: (m & 1) !== 0 };
      expect(evalBoole(e, env) ? "1" : "0").toBe(p[m]);
    }
  });
});
