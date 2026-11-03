import { describe, expect, it } from "vitest";
import { createRng, type Rng } from "../exercises/random.ts";
import { equals, frac, ONE, ZERO, type Frac } from "../rational.ts";
import { detCofactor, detElimination, matrixDeterminant, sarrusTerms } from "./det.ts";
import {
  charPolynomial,
  eigenspace,
  eigenvalueOf,
  eigenvalues,
  isCharPolynomial,
  isEigenpair,
  parsePolynomial,
  polyEquals,
  polyEval,
  polyFromRoots,
  polyScale,
  polyText,
  rationalRoots,
  shiftMatrix,
} from "./eigen.ts";
import {
  fracTex,
  fracText,
  identityMatrix,
  intMatrix,
  intVector,
  isZeroVector,
  matrixAdd,
  matrixEquals,
  matrixLabel,
  matrixProduct,
  matrixScale,
  matrixTex,
  matrixTranspose,
  matrixVector,
  parseEntry,
  parseMatrix,
  type Matrix,
} from "./matrix.ts";
import {
  applyRowOp,
  checkTypedStep,
  detectRowOp,
  gaussHintText,
  isRowEchelon,
  isRref,
  matrixInverse,
  matrixRank,
  nextGaussHint,
  rowEquivalent,
  rowOpError,
  rowOpTex,
  rowOpText,
  rref,
  rrefProgress,
  type RowOp,
} from "./rref.ts";
import { checkBasis, dependenceRelation, inSpan, isIndependent, nullSpace, spanBasisIndices } from "./spaces.ts";
import { analyzeSystem, checkParametric, parseAffine, splitAugmented, type Affine } from "./systems.ts";
import { broadcastShapes, parseShape, shapeText, tensorOpCode, tensorOpResult, type Shape } from "./tensors.ts";
import { describeTransform, eigenDirections2, transformMatrix } from "./transform2d.ts";

const M = (rows: number[][]) => intMatrix(rows);
const F = (n: number, d = 1) => frac(BigInt(n), BigInt(d));
const txt = (m: Matrix) => m.map((r) => r.map(fracText).join(" ")).join(" | ");
const parsed = (s: string) => {
  const r = parseMatrix(s);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

function randomMatrix(rng: Rng, rows: number, cols: number, range = 5): Matrix {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => F(rng.int(-range, range))));
}

describe("lectura de matrices", () => {
  it("filas por línea o con ;, números enteros, fracciones y decimales con coma o punto (exactos)", () => {
    expect(txt(parsed("1 2 3\n4 5 6"))).toBe("1 2 3 | 4 5 6");
    expect(txt(parsed("1 -2; 3/4 0,5"))).toBe("1 −2 | 3/4 1/2");
    expect(txt(parsed("0.25  −1\t+2"))).toBe("1/4 −1 2");
    expect(txt(parsed("1, 2; 3, 4"))).toBe("1 2 | 3 4");
    expect(txt(parsed("[[1, 2], [3, 4]]"))).toBe("1 2 | 3 4");
    expect(txt(parsed("(1 2; 3 4)"))).toBe("1 2 | 3 4");
    expect(txt(parsed("1,5 2"))).toBe("3/2 2");
    expect(equals(parsed("0,1")[0]![0]!, F(1, 10))).toBe(true);
  });

  it("explica qué falla: filas de distinta longitud, números mal escritos, comas sin espacios", () => {
    const a = parseMatrix("1 2\n3");
    expect(a.ok === false && a.error).toBe("La fila 2 tiene 1 números y la primera, 2.");
    const b = parseMatrix("1 x");
    expect(b.ok === false && b.row === 0 && b.col === 1).toBe(true);
    const c = parseMatrix("1,2,3");
    expect(c.ok === false && c.error).toMatch(/la coma es la de los decimales/);
    expect(parseMatrix("").ok).toBe(false);
    expect(parseMatrix("1/0").ok).toBe(false);
    expect(parseEntry("25%").ok).toBe(false);
    expect(parseEntry("−3/4").ok && fracText((parseEntry("−3/4") as { value: Frac }).value)).toBe("−3/4");
  });

  it("formato en texto y en TeX (solo enteros dentro del TeX)", () => {
    expect(fracTex(F(-3, 4))).toBe("-\\frac{3}{4}");
    expect(matrixTex(M([[1, 2, 3]]), { bar: 2 })).toBe("\\left(\\begin{array}{cc|c} 1 & 2 & 3 \\end{array}\\right)");
    expect(matrixLabel(M([[1, -2]]))).toBe("fila 1: 1, −2");
  });
});

describe("operaciones con matrices", () => {
  it("suma, escalar, producto y traspuesta", () => {
    const A = M([
      [1, 2],
      [3, 4],
    ]);
    const B = M([
      [0, 1],
      [1, 0],
    ]);
    expect(txt(matrixAdd(A, B))).toBe("1 3 | 4 4");
    expect(txt(matrixScale(F(1, 2), A))).toBe("1/2 1 | 3/2 2");
    expect(txt(matrixProduct(A, B))).toBe("2 1 | 4 3");
    expect(txt(matrixProduct(B, A))).toBe("3 4 | 1 2");
    expect(txt(matrixTranspose(M([[1, 2, 3]])))).toBe("1 | 2 | 3");
    expect(() => matrixProduct(M([[1, 2]]), M([[1, 2]]))).toThrow();
  });

  it("(AB)ᵀ = BᵀAᵀ y A(BC) = (AB)C en matrices al azar", () => {
    const rng = createRng(11);
    for (let t = 0; t < 50; t++) {
      const A = randomMatrix(rng, 2, 3);
      const B = randomMatrix(rng, 3, 4);
      const C = randomMatrix(rng, 4, 2);
      expect(matrixEquals(matrixTranspose(matrixProduct(A, B)), matrixProduct(matrixTranspose(B), matrixTranspose(A)))).toBe(true);
      expect(matrixEquals(matrixProduct(A, matrixProduct(B, C)), matrixProduct(matrixProduct(A, B), C))).toBe(true);
    }
  });
});

describe("determinantes", () => {
  it("casos de referencia", () => {
    expect(fracText(matrixDeterminant(M([[3]])))).toBe("3");
    expect(fracText(matrixDeterminant(M([[1, 2], [3, 4]])))).toBe("−2");
    expect(fracText(matrixDeterminant(M([[2, 0, 1], [1, 3, 2], [1, 1, 1]])))).toBe("0");
    expect(fracText(matrixDeterminant(M([[1, 2, 3], [0, 1, 4], [5, 6, 0]])))).toBe("1");
    expect(fracText(matrixDeterminant(M([[1, 0, 2, -1], [3, 0, 0, 5], [2, 1, 4, -3], [1, 0, 5, 0]])))).toBe("30");
  });

  it("cofactores y eliminación coinciden en 300 matrices al azar (1×1 a 4×4), y Sarrus también en 3×3", () => {
    const rng = createRng(5);
    for (let t = 0; t < 300; t++) {
      const n = rng.int(1, 4);
      const A = randomMatrix(rng, n, n);
      expect(equals(detCofactor(A), detElimination(A))).toBe(true);
      if (n === 3) {
        const s = sarrusTerms(A).reduce(
          (acc, { factors: [a, b, c], sign }) => acc + (sign * Number(a.n * b.n * c.n)) / Number(a.d * b.d * c.d),
          0,
        );
        expect(s).toBe(Number(detCofactor(A).n));
      }
    }
  });

  it("|AB| = |A|·|B| y |Aᵀ| = |A|", () => {
    const rng = createRng(6);
    for (let t = 0; t < 60; t++) {
      const A = randomMatrix(rng, 3, 3);
      const B = randomMatrix(rng, 3, 3);
      const dA = matrixDeterminant(A);
      expect(equals(matrixDeterminant(matrixProduct(A, B)), frac(dA.n * matrixDeterminant(B).n))).toBe(true);
      expect(equals(matrixDeterminant(matrixTranspose(A)), dA)).toBe(true);
    }
  });
});

describe("operaciones elementales y Gauss-Jordan", () => {
  const A = M([
    [2, 4, 6],
    [1, 3, 5],
  ]);

  it("aplica las tres operaciones y rechaza las que no son elementales", () => {
    const swap = applyRowOp(A, { k: "swap", i: 0, j: 1 });
    expect(swap.ok && txt(swap.value)).toBe("1 3 5 | 2 4 6");
    const scale = applyRowOp(A, { k: "scale", i: 0, c: F(1, 2) });
    expect(scale.ok && txt(scale.value)).toBe("1 2 3 | 1 3 5");
    const addOp = applyRowOp(A, { k: "add", i: 1, j: 0, c: F(-1, 2) });
    expect(addOp.ok && txt(addOp.value)).toBe("2 4 6 | 0 1 2");
    expect(rowOpError({ k: "scale", i: 0, c: ZERO }, 2)).toMatch(/k no puede ser 0/);
    expect(rowOpError({ k: "swap", i: 1, j: 1 }, 2)).toMatch(/dos filas distintas/);
    expect(rowOpError({ k: "add", i: 0, j: 0, c: ONE }, 2)).toMatch(/tienen que ser distintas/);
    expect(rowOpError({ k: "add", i: 0, j: 5, c: ONE }, 2)).toBe("Elige filas de la matriz.");
  });

  it("escribe las operaciones como en clase", () => {
    expect(rowOpText({ k: "swap", i: 0, j: 1 })).toBe("F₁ ↔ F₂");
    expect(rowOpText({ k: "scale", i: 1, c: F(1, 2) })).toBe("F₂ ← (1/2)·F₂");
    expect(rowOpText({ k: "scale", i: 1, c: F(-3) })).toBe("F₂ ← (−3)·F₂");
    expect(rowOpText({ k: "add", i: 2, j: 0, c: F(-2) })).toBe("F₃ ← F₃ − 2·F₁");
    expect(rowOpText({ k: "add", i: 2, j: 0, c: F(1) })).toBe("F₃ ← F₃ + F₁");
    expect(rowOpText({ k: "add", i: 2, j: 1, c: F(3, 4) })).toBe("F₃ ← F₃ + (3/4)·F₂");
    expect(rowOpTex({ k: "add", i: 2, j: 0, c: F(-2) })).toBe("F_{3} \\leftarrow F_{3} - 2\\,F_{1}");
    expect(rowOpTex({ k: "scale", i: 0, c: F(-1) })).toBe("F_{1} \\leftarrow -F_{1}");
  });

  it("la reducida de matrices al azar: reaplicar las operaciones da la reducida, que es RREF y equivalente", () => {
    const rng = createRng(21);
    for (let t = 0; t < 200; t++) {
      const A = randomMatrix(rng, rng.int(1, 4), rng.int(1, 5), 3);
      const R = rref(A);
      let cur = A;
      for (const op of R.ops) {
        const r = applyRowOp(cur, op);
        expect(r.ok).toBe(true);
        if (r.ok) cur = r.value;
      }
      expect(matrixEquals(cur, R.matrix)).toBe(true);
      expect(isRref(R.matrix)).toBe(true);
      expect(isRowEchelon(R.matrix)).toBe(true);
      expect(rowEquivalent(A, R.matrix)).toBe(true);
      expect(matrixRank(A)).toBe(R.pivots.length);
      expect(matrixRank(matrixTranspose(A))).toBe(R.pivots.length);
      expect(nextGaussHint(R.matrix).kind).toBe("done");
      const p = rrefProgress(R.matrix);
      expect(p.done).toBe(p.total);
    }
  });

  it("las pistas dicen la regla y la columna, nunca el número", () => {
    const S = M([
      [0, 2, 4],
      [3, 6, 9],
    ]);
    const h = nextGaussHint(S);
    expect(h).toEqual({ kind: "swap", row: 0, col: 0 });
    expect(gaussHintText(h)).toBe(
      "Busca un pivote en la columna 1: F₁ tiene un 0 ahí. Intercámbiala con una fila de debajo que no tenga 0 en esa columna.",
    );
    expect(nextGaussHint(M([[3, 6], [1, 1]]))).toEqual({ kind: "scale", row: 0, col: 0 });
    const e = nextGaussHint(M([[1, 2], [3, 1]]));
    expect(e).toEqual({ kind: "eliminate", row: 0, col: 0, targets: [1] });
    expect(gaussHintText(e)).not.toMatch(/−3|-3/);
    expect(rrefProgress(M([[1, 2], [0, 1]]))).toEqual({ done: 1, total: 2 });
  });

  it("corrige la matriz siguiente escrita a mano: una operación, varias a la vez o filas que no salen", () => {
    // Matriz ampliada de rango 3 en ℝ⁴: no todas las filas nuevas caben en su espacio de filas.
    const P = M([
      [1, 2, 3, 1],
      [2, 5, 8, 0],
      [1, 0, 2, 1],
    ]);
    const one = checkTypedStep(P, M([[1, 2, 3, 1], [0, 1, 2, -2], [1, 0, 2, 1]]));
    expect(one).toEqual({ kind: "ok", op: { k: "add", i: 1, j: 0, c: F(-2) } });
    const two = checkTypedStep(P, M([[1, 2, 3, 1], [0, 1, 2, -2], [0, -2, -1, 0]]));
    expect(two).toEqual({ kind: "ok", op: null });
    const bad = checkTypedStep(P, M([[1, 2, 3, 1], [0, 1, 2, -1], [1, 0, 2, 1]]));
    expect(bad).toEqual({ kind: "bad", badRows: [1], lostRank: false });
    const lost = checkTypedStep(P, M([[1, 2, 3, 1], [0, 0, 0, 0], [1, 0, 2, 1]]));
    expect(lost).toEqual({ kind: "bad", badRows: [], lostRank: true });
    expect(checkTypedStep(P, P)).toEqual({ kind: "same" });
    expect(detectRowOp(P, M([[1, 0, 2, 1], [2, 5, 8, 0], [1, 2, 3, 1]]))).toEqual({ k: "swap", i: 0, j: 2 });
    expect(detectRowOp(P, M([[2, 4, 6, 2], [2, 5, 8, 0], [1, 0, 2, 1]]))).toEqual({ k: "scale", i: 0, c: F(2) });
  });

  it("detecta la operación de cualquier paso de la reducida", () => {
    const rng = createRng(3);
    for (let t = 0; t < 80; t++) {
      const A = randomMatrix(rng, 3, 4, 4);
      let cur = A;
      for (const op of rref(A).ops) {
        const next = (applyRowOp(cur, op) as { value: Matrix }).value;
        const found = detectRowOp(cur, next) as RowOp;
        expect(found).not.toBeNull();
        expect(matrixEquals((applyRowOp(cur, found) as { value: Matrix }).value, next)).toBe(true);
        cur = next;
      }
    }
  });

  it("inversa por Gauss-Jordan: A⁻¹·A = A·A⁻¹ = I; las singulares no tienen", () => {
    const rng = createRng(8);
    let invertible = 0;
    for (let t = 0; t < 150; t++) {
      const n = rng.int(1, 4);
      const A = randomMatrix(rng, n, n, 4);
      const inv = matrixInverse(A);
      const singular = equals(matrixDeterminant(A), ZERO);
      expect(inv === null).toBe(singular);
      if (inv) {
        invertible++;
        expect(matrixEquals(matrixProduct(inv.inverse, A), identityMatrix(n))).toBe(true);
        expect(matrixEquals(matrixProduct(A, inv.inverse), identityMatrix(n))).toBe(true);
      }
    }
    expect(invertible).toBeGreaterThan(100);
    expect(matrixInverse(M([[1, 2], [2, 4]]))).toBeNull();
    expect(matrixInverse(M([[1, 2, 3]]))).toBeNull();
  });
});

describe("sistemas (Rouché–Frobenius)", () => {
  it("determinado, indeterminado e incompatible", () => {
    const det = analyzeSystem(M([[1, 1], [1, -1]]), intVector([3, 1]));
    expect(det.kind === "determinado" && det.x.map(fracText)).toEqual(["2", "1"]);
    const ind = analyzeSystem(M([[1, 1, 1], [2, 2, 2]]), intVector([1, 2]));
    expect(ind.kind).toBe("indeterminado");
    if (ind.kind === "indeterminado") {
      expect([ind.rankA, ind.rankAb, ind.n]).toEqual([1, 1, 3]);
      expect(ind.free).toEqual([1, 2]);
      expect(ind.directions).toHaveLength(2);
    }
    const inc = analyzeSystem(M([[1, 1], [2, 2]]), intVector([1, 3]));
    expect(inc).toEqual({ kind: "incompatible", rankA: 1, rankAb: 2, n: 2 });
    const { A, b } = splitAugmented(M([[1, 2, 5]]));
    expect([A.length, A[0]!.length, b.length]).toEqual([1, 2, 1]);
  });

  it("lee soluciones paramétricas y acepta cualquier parametrización equivalente", () => {
    const aff = (s: string): Affine => {
      const r = parseAffine(s);
      if (!r.ok) throw new Error(s);
      return r.value;
    };
    expect(fracText(aff("2 − 3t + 1/2").constant)).toBe("5/2");
    expect(fracText(aff("−t/2").coefs.get("t")!)).toBe("−1/2");
    expect(fracText(aff("2·s").coefs.get("s")!)).toBe("2");
    expect(fracText(aff("1/2λ").coefs.get("λ")!)).toBe("1/2");
    for (const bad of ["", "2x", "t t", "3//4", "+", "2 ++ t"]) expect(parseAffine(bad).ok).toBe(false);

    // x + y + z = 1: dos parámetros.
    const A = M([[1, 1, 1]]);
    const b = intVector([1]);
    expect(checkParametric(A, b, [aff("1 − t − s"), aff("t"), aff("s")]).ok).toBe(true);
    expect(checkParametric(A, b, [aff("t"), aff("s"), aff("1 − t − s")]).ok).toBe(true);
    expect(checkParametric(A, b, [aff("2 − 2u"), aff("u + v"), aff("−1 + u − v")]).ok).toBe(true);
    const few = checkParametric(A, b, [aff("1 − t"), aff("t"), aff("0")]);
    expect(few.ok).toBe(false);
    expect([few.params.length, few.expectedParams]).toEqual([1, 2]);
    const wrongP = checkParametric(A, b, [aff("2 − t − s"), aff("t"), aff("s")]);
    expect([wrongP.particularOk, wrongP.directionsOk]).toEqual([false, [true, true]]);
    const dependent = checkParametric(A, b, [aff("1 − t − 2s"), aff("t + 2s"), aff("0")]);
    expect(dependent.independent).toBe(false);
  });
});

describe("espacios: núcleo, independencia y bases", () => {
  it("el núcleo tiene n − rango vectores independientes que anulan la matriz", () => {
    const rng = createRng(9);
    for (let t = 0; t < 120; t++) {
      const A = randomMatrix(rng, rng.int(1, 4), rng.int(1, 5), 2);
      const ker = nullSpace(A);
      expect(ker.length).toBe(A[0]!.length - matrixRank(A));
      for (const v of ker) expect(isZeroVector(matrixVector(A, v))).toBe(true);
      expect(isIndependent(ker)).toBe(true);
    }
  });

  it("independencia, relación de dependencia y base del subespacio generado", () => {
    const u = intVector([1, 2, 3]);
    const v = intVector([0, 1, 1]);
    const w = intVector([1, 3, 4]);
    expect(isIndependent([u, v])).toBe(true);
    expect(isIndependent([u, v, w])).toBe(false);
    expect(isIndependent([intVector([0, 0, 0])])).toBe(false);
    expect(dependenceRelation([u, v, w])?.map(fracText)).toEqual(["−1", "−1", "1"]);
    expect(dependenceRelation([u, v])).toBeNull();
    expect(spanBasisIndices([u, v, w])).toEqual([0, 1]);
    expect(inSpan(w, [u, v])).toBe(true);
    expect(inSpan(intVector([0, 0, 1]), [u, v])).toBe(false);
    expect(checkBasis([v, w], [u, v, w]).ok).toBe(true);
    expect(checkBasis([intVector([2, 4, 6]), intVector([1, 4, 5])], [u, v, w]).ok).toBe(true);
    const bad = checkBasis([u, intVector([0, 0, 1])], [u, v, w]);
    expect([bad.ok, bad.inSpan, bad.dimension]).toEqual([false, [true, false], 2]);
    expect(checkBasis([u], [u, v, w]).ok).toBe(false);
    expect(checkBasis([u, v, w], [u, v, w]).independent).toBe(false);
  });
});

describe("autovalores y autovectores", () => {
  it("polinomio característico: 2×2 es λ² − tr·λ + det; en 3×3 coincide con det(λI − A) en varios λ", () => {
    const A = M([[4, 1], [2, 3]]);
    expect(polyText(charPolynomial(A))).toBe("λ² − 7λ + 10");
    const rng = createRng(4);
    for (let t = 0; t < 60; t++) {
      const n = rng.int(1, 4);
      const B = randomMatrix(rng, n, n, 4);
      const p = charPolynomial(B);
      for (const x of [-2, 0, 1, 3]) {
        const lam = F(x);
        const d = matrixDeterminant(matrixScale(F(-1), shiftMatrix(B, lam)));
        expect(equals(polyEval(p, lam), d)).toBe(true);
      }
    }
  });

  it("raíces racionales con multiplicidad; las irracionales quedan fuera", () => {
    const r = rationalRoots(polyFromRoots([F(2), F(-1), F(2), F(1, 2)]));
    expect(r.complete).toBe(true);
    expect(r.roots.map((x) => [fracText(x.value), x.mult])).toEqual([
      ["−1", 1],
      ["1/2", 1],
      ["2", 2],
    ]);
    const irr = rationalRoots([F(-2), ZERO, ONE]); // λ² − 2
    expect(irr).toEqual({ roots: [], complete: false });
    expect(rationalRoots([ZERO, ZERO, ONE]).roots.map((x) => x.mult)).toEqual([2]);
  });

  it("A = P·D·P⁻¹ con P entera invertible: autovalores enteros y autovectores que cumplen Av = λv", () => {
    const P = M([[1, 1, 0], [0, 1, 1], [1, 0, 2]]); // |P| = 3: A tiene fracciones, pero autovalores enteros
    const D = M([[2, 0, 0], [0, -1, 0], [0, 0, 3]]);
    const inv = matrixInverse(P)!.inverse;
    const A = matrixProduct(matrixProduct(P, D), inv);
    const ev = eigenvalues(A);
    expect(ev.complete).toBe(true);
    expect(ev.roots.map((x) => fracText(x.value))).toEqual(["−1", "2", "3"]);
    for (const { value } of ev.roots) {
      const space = eigenspace(A, value);
      expect(space).toHaveLength(1);
      expect(isEigenpair(A, space[0]!, value)).toBe(true);
      // Cualquier múltiplo no nulo también vale; el vector nulo no.
      expect(isEigenpair(A, space[0]!.map((x) => frac(-3n * x.n, x.d)), value)).toBe(true);
      expect(isEigenpair(A, space[0]!.map(() => ZERO), value)).toBe(false);
      expect(equals(eigenvalueOf(A, space[0]!)!, value)).toBe(true);
    }
    expect(eigenvalueOf(A, intVector([1, 0, 0]))).toBeNull();
    expect(eigenspace(A, F(5))).toEqual([]);
  });

  it("lee el polinomio desarrollado o factorizado y acepta det(λI − A) y det(A − λI)", () => {
    const A = M([[4, 1], [2, 3]]);
    const read = (s: string) => {
      const r = parsePolynomial(s);
      if (!r.ok) throw new Error(s);
      return r.value;
    };
    for (const s of ["λ² − 7λ + 10", "λ^2-7λ+10", "(λ − 2)(λ − 5)", "(2 − λ)(5 − λ)", "x^2 - 7x + 10", "λ·λ − 7·λ + 10", "10 + λ(λ − 7)"]) {
      expect(isCharPolynomial(A, read(s))).toBe(true);
    }
    expect(isCharPolynomial(A, read("λ² − 7λ + 12"))).toBe(false);
    const B = M([[1, 0, 0], [0, 2, 0], [0, 0, 3]]);
    expect(isCharPolynomial(B, read("(1 − λ)(2 − λ)(3 − λ)"))).toBe(true);
    expect(isCharPolynomial(B, read("(λ − 1)(λ − 2)(λ − 3)"))).toBe(true);
    expect(polyEquals(read("λ³/2"), polyScale(F(1, 2), [ZERO, ZERO, ZERO, ONE]))).toBe(true);
    for (const bad of ["", "λ +", "(λ − 1", "λ x", "λ^λ", "2^", "λ²²²²²²²²²"]) expect(parsePolynomial(bad).ok).toBe(false);
  });
});

describe("transformaciones del plano", () => {
  it("matrices de los movimientos de clase y su descripción", () => {
    expect(txt(transformMatrix({ kind: "rotacion", degrees: 90 }))).toBe("0 −1 | 1 0");
    expect(txt(transformMatrix({ kind: "reflexion", axis: "y=x" }))).toBe("0 1 | 1 0");
    expect(txt(transformMatrix({ kind: "cizalla", direction: "horizontal", k: 2 }))).toBe("1 2 | 0 1");
    expect(describeTransform({ kind: "escala", a: 2, b: -1 })).toBe("Escalado: multiplica la coordenada x por 2 y la y por −1.");
    // La rotación de 90° no deja direcciones invariantes; una simetría, dos.
    expect(eigenDirections2([[0, -1], [1, 0]]).kind).toBe("none");
    const s = eigenDirections2([[0, 1], [1, 0]]);
    expect(s.kind === "lines" && s.lines.map((l) => l.lambda)).toEqual([1, -1]);
    expect(eigenDirections2([[2, 0], [0, 2]])).toEqual({ kind: "all", lambda: 2 });
    const shear = eigenDirections2([[1, 2], [0, 1]]);
    expect(shear.kind === "lines" && shear.lines).toHaveLength(1);
  });
});

describe("formas de tensores (reglas de NumPy)", () => {
  const shape = (s: string): Shape => {
    const r = parseShape(s);
    if (!r.ok) throw new Error(s);
    return r.value;
  };
  const res = (q: Parameters<typeof tensorOpResult>[0]) => {
    const r = tensorOpResult(q);
    return r.ok ? shapeText(r.shape) : "error";
  };

  it("lee y escribe formas como NumPy", () => {
    expect(shape("(2, 3)")).toEqual([2, 3]);
    expect(shape("[2,3,4]")).toEqual([2, 3, 4]);
    expect(shape("2 3")).toEqual([2, 3]);
    expect(shape("(3,)")).toEqual([3]);
    expect(shape("()")).toEqual([]);
    expect(shapeText([3])).toBe("(3,)");
    expect(shapeText([])).toBe("()");
    for (const bad of ["", "(a, 2)", "(-1, 2)", "2.5", "(1, 2, 3, 4, 5, 6, 7)"]) expect(parseShape(bad).ok).toBe(false);
  });

  it("emisión: la tabla de la documentación de NumPy", () => {
    const table: Array<[string, string, string]> = [
      ["(256, 256, 3)", "(3,)", "(256, 256, 3)"],
      ["(8, 1, 6, 1)", "(7, 1, 5)", "(8, 7, 6, 5)"],
      ["(5, 4)", "(1,)", "(5, 4)"],
      ["(5, 4)", "(4,)", "(5, 4)"],
      ["(15, 3, 5)", "(15, 1, 5)", "(15, 3, 5)"],
      ["(15, 3, 5)", "(3, 5)", "(15, 3, 5)"],
      ["(15, 3, 5)", "(3, 1)", "(15, 3, 5)"],
      ["()", "(2, 3)", "(2, 3)"],
      ["(3,)", "(4,)", "error"],
      ["(2, 1)", "(8, 4, 3)", "error"],
    ];
    for (const [a, b, out] of table) {
      expect(res({ op: "suma", a: shape(a), b: shape(b) })).toBe(out);
      expect(res({ op: "suma", a: shape(b), b: shape(a) })).toBe(out);
    }
    const r = broadcastShapes([8, 1, 6, 1], [7, 1, 5]);
    expect(r.dims.map((d) => d.rule)).toEqual(["falta-b", "a-uno", "b-uno", "a-uno"]);
    const e = tensorOpResult({ op: "suma", a: [3], b: [4] });
    expect(e.explain.join(" ")).toMatch(/ninguno es 1/);
  });

  it("producto @ con matrices, vectores 1-D y lotes", () => {
    const table: Array<[string, string, string]> = [
      ["(2, 3)", "(3, 4)", "(2, 4)"],
      ["(3,)", "(3,)", "()"],
      ["(3,)", "(3, 4)", "(4,)"],
      ["(2, 3)", "(3,)", "(2,)"],
      ["(10, 2, 3)", "(3, 4)", "(10, 2, 4)"],
      ["(10, 1, 2, 3)", "(5, 3, 4)", "(10, 5, 2, 4)"],
      ["(2, 3)", "(2, 3)", "error"],
      ["(4, 2, 3)", "(5, 3, 2)", "error"],
      ["()", "(3,)", "error"],
    ];
    for (const [a, b, out] of table) expect(res({ op: "matmul", a: shape(a), b: shape(b) })).toBe(out);
  });

  it("sum(axis), reshape y .T", () => {
    expect(res({ op: "sum", a: [2, 3, 4], axis: 1 })).toBe("(2, 4)");
    expect(res({ op: "sum", a: [2, 3, 4], axis: -1 })).toBe("(2, 3)");
    expect(res({ op: "sum", a: [2, 3, 4], axis: 0, keepdims: true })).toBe("(1, 3, 4)");
    expect(res({ op: "sum", a: [2, 3], axis: null })).toBe("()");
    expect(res({ op: "sum", a: [2, 3], axis: 2 })).toBe("error");
    expect(res({ op: "reshape", a: [2, 3, 4], target: [6, -1] })).toBe("(6, 4)");
    expect(res({ op: "reshape", a: [2, 3, 4], target: [4, 6] })).toBe("(4, 6)");
    expect(res({ op: "reshape", a: [2, 3], target: [4, -1] })).toBe("error");
    expect(res({ op: "reshape", a: [2, 3], target: [-1, -1] })).toBe("error");
    expect(res({ op: "reshape", a: [2, 3], target: [5] })).toBe("error");
    expect(res({ op: "T", a: [2, 3, 4] })).toBe("(4, 3, 2)");
    expect(res({ op: "T", a: [5] })).toBe("(5,)");
    expect(tensorOpCode({ op: "sum", a: [2], axis: 0, keepdims: true })).toBe("a.sum(axis=0, keepdims=True)");
    expect(tensorOpCode({ op: "reshape", a: [6], target: [2, -1] })).toBe("a.reshape(2, -1)");
  });
});
