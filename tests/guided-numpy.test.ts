// Los tipos guiados, comprobados con NumPy (no con el código que los corrige): formas tras expand_dims,
// squeeze e índices, lo que imprime NumPy con int8/uint8, el convenio de Einstein con np.einsum, el
// producto tensorial y la contracción, D = C⁻¹AC, las coordenadas, LU, Cholesky, QR, valores singulares,
// la matriz de una aplicación lineal y los extremos absolutos. Sin numpy en el python3 del sistema, se
// salta.
import { describe, expect, it } from "vitest";
import type { Matrix } from "../shared/linalg/matrix.ts";
import type { Frac } from "../shared/rational.ts";
import { CALC_ABS_EXTREMES, extremesOf } from "../shared/exercises/calculus-extremes.ts";
import { choleskyOf, LINALG_CHOLESKY, LINALG_LINEAR_MAP, LINALG_LU, LINALG_QR, LINALG_SVD, linearMapMatrix, luOf, qrOf, svdOf } from "../shared/exercises/factorizations.ts";
import { axesCode, axesResult, overflowCode, overflowValues, PY_NUMPY_AXES, PY_OVERFLOW } from "../shared/exercises/numpy-shapes.ts";
import { changeBasisOf, coordsAnswer, einsteinDummies, einsteinFree, LINALG_CHANGE_BASIS, LINALG_COORDS, LINALG_EINSTEIN, LINALG_OUTER, outerResult } from "../shared/exercises/tensors.ts";
import { EXERCISE_LEVELS } from "../shared/exercises/types.ts";
import { hasPyModules, runJobs } from "./system-python.ts";

const hasNumpy = hasPyModules("numpy");
const SEEDS = Array.from({ length: 40 }, (_, i) => (i * 2654435761 + 5) >>> 0);
const each = <I,>(gen: (s: number, l: (typeof EXERCISE_LEVELS)[number]) => I) => EXERCISE_LEVELS.flatMap((l) => SEEDS.map((s) => gen(s, l)));
const num = (x: Frac) => Number(x.n) / Number(x.d);
const mat = (M: Matrix) => M.map((r) => r.map(num));

const SOURCE = String.raw`
import json
import numpy as np

def axes(p):
    out = []
    for shape, code in p:
        a = np.zeros(shape)
        try:
            b = eval(code, {"np": np, "a": a})
            out.append(list(b.shape))
        except Exception as e:
            out.append(type(e).__name__)
    return json.dumps(out)

def overflow(p):
    out = []
    for dtype, a, b, code, widen in p:
        env = {"np": np, "a": np.array(a, dtype=dtype), "b": np.array(b, dtype=dtype)}
        with np.errstate(over="ignore"):
            r = eval(code, env).tolist()
            w = eval(code.replace("a", "a.astype(np.int16)", 1), env).tolist() if widen else None
        out.append([r, w])
    return json.dumps(out)

def einstein(p):
    out = []
    for n, factors, free in p:
        ops = [np.ones((n,) * len(f)) for f in factors]
        r = np.einsum(",".join("".join(f) for f in factors) + "->" + "".join(free), *ops)
        out.append([int(np.size(r)), int(np.max(r))])
    return json.dumps(out)

def outer(p):
    out = []
    for a, b, c in p:
        t = np.multiply.outer(np.array(a), np.array(b))
        if c is not None:
            t = np.trace(t, axis1=c[0] - 1, axis2=c[1] - 1)
        out.append([list(np.shape(t)), np.ravel(t).tolist()])
    return json.dumps(out)

def change_basis(p):
    return json.dumps([(np.linalg.inv(np.array(C, float)) @ np.array(A, float) @ np.array(C, float)).tolist() for A, C in p])

def coords(p):
    return json.dumps([np.linalg.solve(np.array(B, float).T, np.array(v, float)).tolist() for B, v in p])

def lu(p):
    out = []
    for A in p:
        A = np.array(A, float)
        n = len(A)
        U = A.copy(); L = np.eye(n)
        for j in range(n):
            for i in range(j + 1, n):
                L[i, j] = U[i, j] / U[j, j]
                U[i] -= L[i, j] * U[j]
        out.append([L.tolist(), U.tolist()])
    return json.dumps(out)

def cholesky(p):
    return json.dumps([np.linalg.cholesky(np.array(S, float)).tolist() for S in p])

def qr(p):
    out = []
    for A in p:
        Q, R = np.linalg.qr(np.array(A, float))
        s = np.sign(np.diag(R))
        out.append([(Q * s).tolist(), (R * s[:, None]).tolist()])
    return json.dumps(out)

def svd(p):
    return json.dumps([np.linalg.svd(np.array(A, float), compute_uv=False).tolist() for A in p])

def extremes(p):
    out = []
    for coefs, a, b in p:
        xs = np.linspace(a, b, 20001)
        ys = np.polyval(coefs[::-1], xs)
        crit = [r.real for r in np.roots(np.polyder(coefs[::-1])) if abs(r.imag) < 1e-9 and a < r.real < b]
        cand = [a, b] + crit
        vals = np.polyval(coefs[::-1], cand)
        out.append([float(max(vals.max(), ys.max())), float(min(vals.min(), ys.min()))])
    return json.dumps(out)
`;

const close = (a: number[][], b: number[][]) => {
  expect(a.length).toBe(b.length);
  a.forEach((r, i) => r.forEach((x, j) => expect(x).toBeCloseTo(b[i]![j]!, 7)));
};

describe.skipIf(!hasNumpy)("tipos guiados frente a NumPy", () => {
  it("formas tras expand_dims, squeeze e índices (y el tipo de error)", () => {
    const insts = each((s, l) => PY_NUMPY_AXES.generate(s, l));
    const [got] = runJobs<Array<number[] | string>>(SOURCE, [{ fn: "axes", payload: insts.map((i) => [i.shape, axesCode(i.op)]) }]);
    insts.forEach((inst, k) => {
      const r = axesResult(inst);
      const g = got![k]!;
      if (r.ok) expect(g, axesCode(inst.op)).toEqual(r.shape);
      // AxisError hereda de ValueError e IndexError: el nombre de la excepción es el que da NumPy.
      else expect(g, axesCode(inst.op)).toBe(r.error);
    });
  });

  it("int8 y uint8: lo que imprime NumPy, y con int16", () => {
    const insts = each((s, l) => PY_OVERFLOW.generate(s, l));
    const [got] = runJobs<Array<[number[], number[] | null]>>(SOURCE, [{ fn: "overflow", payload: insts.map((i) => [i.dtype, i.a, i.b, overflowCode(i), i.widen]) }]);
    insts.forEach((inst, k) => {
      const v = overflowValues(inst);
      expect(got![k]![0], `${JSON.stringify(inst)}`).toEqual(v.numpy);
      if (inst.widen) expect(got![k]![1]).toEqual(v.wide);
    });
  });

  it("Einstein: componentes y sumandos con np.einsum", () => {
    const insts = each((s, l) => LINALG_EINSTEIN.generate(s, l));
    const [got] = runJobs<Array<[number, number]>>(SOURCE, [{ fn: "einstein", payload: insts.map((i) => [i.n, i.factors.map((f) => [...f.upper, ...f.lower]), einsteinFree(i)]) }]);
    insts.forEach((inst, k) => expect(got![k]).toEqual([inst.n ** einsteinFree(inst).length, inst.n ** einsteinDummies(inst).length]));
  });

  it("producto tensorial y contracción", () => {
    const insts = each((s, l) => LINALG_OUTER.generate(s, l));
    const [got] = runJobs<Array<[number[], number[]]>>(SOURCE, [{ fn: "outer", payload: insts.map((i) => [i.aVec ? i.a[0] : i.a, i.bVec ? i.b[0] : i.b, i.contract]) }]);
    insts.forEach((inst, k) => {
      const r = outerResult(inst);
      expect(got![k]).toEqual([r.shape, r.data]);
    });
  });

  it("D = C⁻¹AC y coordenadas en otra base", () => {
    const cb = each((s, l) => LINALG_CHANGE_BASIS.generate(s, l));
    const co = each((s, l) => LINALG_COORDS.generate(s, l));
    const [d, c] = runJobs<number[][][] | number[][]>(SOURCE, [
      { fn: "change_basis", payload: cb.map((i) => [i.A, i.C]) },
      { fn: "coords", payload: co.map((i) => [[i.b1, i.b2], i.kind === "directa" ? i.v : coordsAnswer(i).v.map(num)]) },
    ]);
    cb.forEach((inst, k) => close((d as number[][][])[k]!, mat(changeBasisOf(inst).D)));
    co.forEach((inst, k) => {
      const a = coordsAnswer(inst);
      const base = (c as number[][])[k]!;
      // En la base escalada, las coordenadas en B′ son las de B divididas por la escala.
      const want = inst.kind === "directa" ? a.coords.map(num) : base.map((x, i) => x / inst.s[i]!);
      expect(inst.kind === "directa" ? base : a.coords.map(num)).toEqual(want.map((x) => expect.closeTo(x, 9)));
    });
  });

  it("LU, Cholesky, QR, valores singulares y aplicación lineal", () => {
    const lus = each((s, l) => LINALG_LU.generate(s, l));
    const chs = each((s, l) => LINALG_CHOLESKY.generate(s, l));
    const qrs = each((s, l) => LINALG_QR.generate(s, l));
    const svs = each((s, l) => LINALG_SVD.generate(s, l));
    const [lu, ch, qr, sv] = runJobs<unknown[]>(SOURCE, [
      { fn: "lu", payload: lus.map((i) => i.A) },
      { fn: "cholesky", payload: chs.map((i) => i.S) },
      { fn: "qr", payload: qrs.map((i) => i.a1.map((x, r) => [x, i.a2[r]!])) },
      { fn: "svd", payload: svs.map((i) => i.A) },
    ]);
    lus.forEach((inst, k) => {
      const r = luOf(inst.A)!;
      const [L, U] = (lu as number[][][][])[k]!;
      close(L!, mat(r.L));
      close(U!, mat(r.U));
    });
    chs.forEach((inst, k) => close((ch as number[][][])[k]!, mat(choleskyOf(inst.S)!)));
    qrs.forEach((inst, k) => {
      const q = qrOf(inst);
      const [Q, R] = (qr as number[][][][])[k]!;
      close(Q!, q.q1.map((x, i) => [num(x), num(q.q2![i]!)]));
      close(R!, [
        [num(q.r11), num(q.r12)],
        [0, num(q.r22!)],
      ]);
    });
    svs.forEach((inst, k) => expect((sv as number[][])[k]!).toEqual(svdOf(inst)!.sigmas.map((x) => expect.closeTo(num(x), 9))));
    for (const s of SEEDS) {
      const inst = LINALG_LINEAR_MAP.generate(s, "medio");
      if (inst.kind === "formula") expect(mat(linearMapMatrix(inst))).toEqual(inst.M);
    }
  });

  it("extremos absolutos: el máximo y el mínimo de f en [a, b]", () => {
    const insts = each((s, l) => CALC_ABS_EXTREMES.generate(s, l));
    const [got] = runJobs<Array<[number, number]>>(SOURCE, [{ fn: "extremes", payload: insts.map((i) => [i.coefs, i.a, i.b]) }]);
    insts.forEach((inst, k) => {
      const e = extremesOf(inst);
      expect(got![k]![0]).toBeCloseTo(e.max.y, 6);
      expect(got![k]![1]).toBeCloseTo(e.min.y, 6);
    });
  });
});
