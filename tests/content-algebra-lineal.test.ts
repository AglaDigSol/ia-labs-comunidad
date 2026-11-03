// Valida el contenido del laboratorio de álgebra lineal (content/algebra-lineal/) con su esquema zod y
// comprueba que cada ejemplo es del tipo que dice su título.
import { describe, expect, it } from "vitest";
import { LINALG_PACK } from "../content/algebra-lineal/practica.ts";
import { matrixDeterminant } from "../shared/linalg/det.ts";
import { eigenvalues } from "../shared/linalg/eigen.ts";
import { parseMatrix, type Matrix } from "../shared/linalg/matrix.ts";
import { LinalgPackSchema } from "../shared/linalg/schema.ts";
import { analyzeSystem, splitAugmented } from "../shared/linalg/systems.ts";
import { tensorOpResult } from "../shared/linalg/tensors.ts";
import { isZero } from "../shared/rational.ts";

const issues = (r: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } }) =>
  r.success ? [] : r.error!.issues.map((i) => `${i.path.map(String).join(".")}: ${i.message}`);

const read = (s: string): Matrix => {
  const r = parseMatrix(s);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe("content/algebra-lineal", () => {
  it("cumple LinalgPackSchema", () => {
    expect(issues(LinalgPackSchema.safeParse(LINALG_PACK))).toEqual([]);
  });

  it("el esquema rechaza un producto no definido y una matriz de autovalores irracionales", () => {
    const badProduct = { ...LINALG_PACK, products: [...LINALG_PACK.products.slice(1), { id: "mal", level: "básico", a: "1 2", b: "1 2" }] };
    expect(issues(LinalgPackSchema.safeParse(badProduct)).join(" ")).toMatch(/no está definido/);
    const badEigen = { ...LINALG_PACK, eigen: [...LINALG_PACK.eigen, { id: "raiz-dos", level: "medio", matrix: "0 2\n1 0" }] };
    expect(issues(LinalgPackSchema.safeParse(badEigen)).join(" ")).toMatch(/no son todos racionales/);
  });

  it("cada sistema es del tipo que dice su título", () => {
    const kinds = Object.fromEntries(
      LINALG_PACK.systems.map((s) => {
        const { A, b } = splitAugmented(read(s.matrix));
        return [s.id, analyzeSystem(A, b).kind];
      }),
    );
    expect(kinds).toEqual({
      "dos-determinado": "determinado",
      "dos-cambio-fila": "determinado",
      "dos-incompatible": "incompatible",
      "tres-determinado": "determinado",
      "tres-fracciones": "determinado",
      "tres-indeterminado": "indeterminado",
      "tres-incompatible": "incompatible",
      "tres-cuatro-incognitas": "indeterminado",
    });
  });

  it("las matrices «singular» y «rango-dos» tienen determinante 0; las demás, no", () => {
    for (const s of LINALG_PACK.square) {
      expect(isZero(matrixDeterminant(read(s.matrix))), s.id).toBe(/singular|rango/.test(s.id));
    }
  });

  it("los autovalores son enteros y, en «tres-doble», hay uno doble", () => {
    for (const e of LINALG_PACK.eigen) {
      const ev = eigenvalues(read(e.matrix));
      expect(ev.roots.every((r) => r.value.d === 1n), e.id).toBe(true);
      expect(ev.roots.some((r) => r.mult > 1), e.id).toBe(e.id === "tres-doble");
    }
  });

  it("las preguntas de tensores: hay con resultado y con error", () => {
    const results = LINALG_PACK.tensors.map((t) => tensorOpResult(t.q).ok);
    expect(results.filter(Boolean).length).toBeGreaterThan(6);
    expect(results.filter((x) => !x).length).toBeGreaterThanOrEqual(2);
    expect(LINALG_PACK.tensors.filter((t) => t.level === "básico").every((t) => tensorOpResult(t.q).ok)).toBe(true);
  });
});
