import { toTexNumber } from "../rational.ts";
import { vecMul, type Mat, type Vec } from "./matrix.ts";

export const MAX_STEPS = 30;

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";
const subscript = (k: number) => [...String(k)].map((c) => SUBSCRIPTS[Number(c)]).join("");

export interface EvolutionStep {
  k: number;
  title: string;
  tex: string[];
}

function pmatrix(rows: string[][]): string {
  return `\\begin{pmatrix} ${rows.map((r) => r.join(" & ")).join(" \\\\ ")} \\end{pmatrix}`;
}

// vₖ = vₖ₋₁ · P. TeX is built only from formatted numbers and integer indices.
export function evolve(P: Mat, v0: Vec, n: number): { vectors: Vec[]; steps: EvolutionStep[] } {
  if (!Number.isInteger(n) || n < 0 || n > MAX_STEPS) {
    throw new RangeError(`n debe estar entre 0 y ${MAX_STEPS}`);
  }
  const vectors: Vec[] = [v0];
  const steps: EvolutionStep[] = [];
  const pTex = pmatrix(P.map((r) => r.map((x) => toTexNumber(x))));
  for (let k = 1; k <= n; k++) {
    const prev = vectors[k - 1]!;
    const next = vecMul(prev, P);
    vectors.push(next);
    const tex = [
      `v_{${k}} = v_{${k - 1}}\\,P = ${pmatrix([prev.map((x) => toTexNumber(x))])}${pTex}`,
    ];
    next.forEach((res, j) => {
      const terms = prev.map((a, i) => `${toTexNumber(a)}\\cdot ${toTexNumber(P[i]![j]!)}`).join(" + ");
      tex.push(`v_{${k},${j + 1}} = ${terms} = ${toTexNumber(res)}`);
    });
    steps.push({ k, title: `Paso ${k}: v${subscript(k)} = v${subscript(k - 1)} · P`, tex });
  }
  return { vectors, steps };
}
