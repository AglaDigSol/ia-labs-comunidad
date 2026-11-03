// Adaptadores de álgebra lineal.
import { matrixDeterminant } from "../../linalg/det.ts";
import { intMatrix, intVector, matrixProduct } from "../../linalg/matrix.ts";
import { matrixRank } from "../../linalg/rref.ts";
import { analyzeSystem, splitAugmented } from "../../linalg/systems.ts";
import { detExprTex, detExprText, norm1, norm2Squared, normInf } from "../../linalg/theory.ts";
import { toNumber, type Frac } from "../../rational.ts";
import { seedFromKey } from "../../exercises/choice.ts";
import {
  alphaVecText,
  detRulesAnswer,
  detRulesDets,
  LINALG_DET_RULES,
  LINALG_DETERMINANT,
  LINALG_INDEPENDENCE,
  LINALG_NORMS,
  LINALG_PRODUCT,
  LINALG_ROUCHE_CHOICE,
  LINALG_TENSOR_VOCAB,
  LINALG_THEORY,
  normsQuestion,
  roucheChoiceQuestion,
  tensorVocabQuestion,
  tensorVocabStatement,
  theoryQuestion,
  theorySubject,
  THEORY_ASK,
  type NamedQty,
} from "../../exercises/linalg.ts";
import { examAdapter, type ExamAdapter } from "../adapter.ts";
import { examMath, examP, intMatrixTex, intMatrixText, intText } from "../blocks.ts";
import type { ExamNumericFormat } from "../types.ts";

/** Formato de un valor exacto: entero si lo es; si no, dos decimales. */
const fmtOf = (x: Frac): ExamNumericFormat => (x.d === 1n ? "entero" : "dos-decimales");
const fracText = (x: Frac) => `${intText(x.n)}${x.d === 1n ? "" : `/${x.d}`}`;

/** Sistema de ecuaciones con enteros, en TeX y en texto. */
export function intSystemTex(M: readonly (readonly number[])[], unknowns: number): { tex: string; label: string } {
  const rows = M.map((r) => {
    const terms = r.slice(0, unknowns).flatMap((c, j) => (c === 0 ? [] : [{ neg: c < 0, body: `${Math.abs(c) === 1 ? "" : Math.abs(c)}x_{${j + 1}}` }]));
    const lhs = terms.length === 0 ? "0" : terms.map((t, k) => (k === 0 ? (t.neg ? "-" : "") : t.neg ? " - " : " + ") + t.body).join("");
    return `${lhs} &= ${r[unknowns]}`;
  });
  const label = M.map((r) => `${r.slice(0, unknowns).map((c, j) => `${intText(c)}·x${j + 1}`).join(" + ")} = ${intText(r[unknowns]!)}`).join("; ");
  return { tex: `\\left\\{\\begin{aligned} ${rows.join(" \\\\ ")} \\end{aligned}\\right.`, label };
}

const detRulesAdapter = examAdapter({
  type: LINALG_DET_RULES,
  ask: "Propiedades del determinante: det(kA), det(AB), det(A⁻¹)… (numérica).",
  build(inst) {
    const value = detRulesAnswer(inst);
    if (!value) return null;
    const g = inst.given;
    const dets = detRulesDets(inst);
    const given =
      g.kind === "det"
        ? [examMath(`\\det A = ${g.A}${g.B !== null ? `,\\quad \\det B = ${g.B}` : ""}`, `determinante de A igual a ${intText(g.A)}${g.B !== null ? `; determinante de B igual a ${intText(g.B)}` : ""}`)]
        : g.kind === "autovalores"
          ? [examMath(`\\text{autovalores de } A:\\ ${g.eig.join(",\\ ")}${g.B !== null ? `,\\quad \\det B = ${g.B}` : ""}`, `autovalores de A: ${g.eig.map(intText).join(", ")}${g.B !== null ? `; determinante de B igual a ${intText(g.B)}` : ""}`)]
          : [examMath(`A = ${intMatrixTex(g.A)}`, `A igual a ${intMatrixText(g.A)}`), ...(g.B !== null ? [examMath(`\\det B = ${g.B}`, `determinante de B igual a ${intText(g.B)}`)] : [])];
    return {
      kind: "numeric",
      stem: [examP(`Sean A${g.B !== null ? " y B" : ""} matrices ${inst.n}×${inst.n}${g.kind === "autovalores" ? ", con A diagonalizable" : ""}, con:`), ...given],
      prompt: `Calcula det(${detExprText(inst.expr)}).`,
      expected: value,
      format: fmtOf(value),
      label: "Determinante",
      solution: [
        examP(`det A = ${fracText(dets.A)}${g.B !== null ? `, det B = ${fracText(dets.B)}` : ""}. Con det(kA) = kⁿ·det A (n = ${inst.n}), det(AB) = det A·det B, det(A⁻¹) = 1/det A y det(Aᵀ) = det A:`),
        examMath(`\\det\\left(${detExprTex(inst.expr)}\\right) = ${value.d === 1n ? value.n : `\\frac{${value.n}}{${value.d}}`}`, `determinante de ${detExprText(inst.expr)} igual a ${fracText(value)}`),
      ],
    };
  },
});

const theoryAdapter = examAdapter({
  type: LINALG_THEORY,
  levels: ["básico", "medio"],
  ask: "Verdadero o falso sobre matrices y vectores (opción múltiple: la verdadera o la falsa).",
  build(inst) {
    if (inst.ask === "varias") return null;
    const d = inst.cls === "diagonal" ? (inst as { d: number[] }).d : null;
    const D = d ? d.map((x, i) => d.map((_, j) => (i === j ? x : 0))) : null;
    return {
      kind: "choice",
      stem: [examP(theorySubject(inst)), ...(D ? [examMath(`A = ${intMatrixTex(D)}`, `A igual a ${intMatrixText(D)}`)] : [])],
      prompt: THEORY_ASK[inst.ask],
      question: theoryQuestion(inst),
    };
  },
});

const qtyTex = (q: NamedQty) => (q.k === "num" ? String(q.value) : q.k === "dot" ? "u\\cdot v" : q.k === "norm1" ? `\\|${q.of}\\|_1` : q.k === "norm2sq" ? `\\|${q.of}\\|_2^2` : `\\|${q.of}\\|_\\infty`);
const qtyText = (q: NamedQty) => (q.k === "num" ? intText(q.value) : q.k === "dot" ? "u·v" : q.k === "norm1" ? `‖${q.of}‖₁` : q.k === "norm2sq" ? `‖${q.of}‖₂²` : `‖${q.of}‖∞`);

const normsAdapter = examAdapter({
  type: LINALG_NORMS,
  ask: "Una norma de un vector (numérica) o para cuántos α se cumplen condiciones con normas y producto escalar (opción múltiple).",
  build(inst) {
    if (inst.kind === "calcular") {
      const v = intVector(inst.v);
      const which = seedFromKey(JSON.stringify(inst)) % 3;
      const text = `(${inst.v.map(intText).join(", ")})`;
      const stem = [examP("Sea el vector"), examMath(`v = (${inst.v.join(",\\ ")})`, `v igual a ${text}`)];
      if (which === 1) {
        const sq = toNumber(norm2Squared(v));
        return {
          kind: "numeric",
          stem,
          prompt: "Calcula la norma euclídea ‖v‖₂.",
          expected: Math.sqrt(sq),
          format: Number.isInteger(Math.sqrt(sq)) ? "entero" : "dos-decimales",
          label: "‖v‖₂",
          solution: [examMath(`\\|v\\|_2 = \\sqrt{${inst.v.map((x) => (x < 0 ? `(${x})^2` : `${x}^2`)).join(" + ")}} = \\sqrt{${sq}}`, `norma 2 de v igual a raíz de ${sq}`)],
        };
      }
      const value = which === 0 ? norm1(v) : normInf(v);
      return {
        kind: "numeric",
        stem,
        prompt: which === 0 ? "Calcula la norma ‖v‖₁." : "Calcula la norma del máximo ‖v‖∞.",
        expected: value,
        format: "entero",
        label: which === 0 ? "‖v‖₁" : "‖v‖∞",
        solution: [examP(which === 0 ? `‖v‖₁ = suma de los valores absolutos = ${fracText(value)}.` : `‖v‖∞ = el mayor valor absoluto = ${fracText(value)}.`)],
      };
    }
    const condTex = inst.conds.map((c) => `${qtyTex(c.lhs)} ${c.op} ${qtyTex(c.rhs)}`).join(" \\quad\\text{y}\\quad ");
    const condText = inst.conds.map((c) => `${qtyText(c.lhs)} ${c.op} ${qtyText(c.rhs)}`).join(" y ");
    const domain = inst.domain === "nonneg" ? "no negativos de α (α ≥ 0)" : "reales de α";
    return {
      kind: "choice",
      stem: [examP(`Sean u = ${alphaVecText(inst.u)}${inst.v ? ` y v = ${alphaVecText(inst.v)}` : ""}.`), examMath(condTex, condText)],
      prompt: `¿Para cuántos valores ${domain} se cumple${inst.conds.length > 1 ? "n las condiciones" : ""}?`,
      question: normsQuestion(inst),
      solution: [examP("Cada condición es una ecuación (o inecuación) en α: u·v es la suma de productos, ‖u‖₁ la suma de valores absolutos, ‖u‖₂² la de cuadrados y ‖u‖∞ el mayor valor absoluto.")],
    };
  },
});

const tensorVocabAdapter = examAdapter({
  type: LINALG_TENSOR_VOCAB,
  ask: "Rango y dimensión de un tensor con la terminología del curso (opción múltiple).",
  build(inst) {
    const st = tensorVocabStatement(inst);
    return {
      kind: "choice",
      stem: st.tex ? [examMath(st.tex, st.text)] : [],
      prompt: st.text,
      question: tensorVocabQuestion(inst),
      solution: [examP("En el curso, el rango de un tensor es su número de índices (ndim) y su dimensión, cuántos valores toma cada índice.")],
    };
  },
});

const roucheAdapter = examAdapter({
  type: LINALG_ROUCHE_CHOICE,
  ask: "Clasificar un sistema con Rouché–Frobenius (opción múltiple).",
  build(inst) {
    const { A, b } = splitAugmented(intMatrix(inst.matrix));
    const s = analyzeSystem(A, b);
    const sys = intSystemTex(inst.matrix, inst.unknowns);
    return {
      kind: "choice",
      stem: [examP("Sea el sistema"), examMath(sys.tex, `Sistema: ${sys.label}`)],
      prompt: "¿Cómo es el sistema?",
      question: roucheChoiceQuestion(inst),
      solution: [examP(`rg A = ${s.rankA}, rg (A|b) = ${s.rankAb} y n = ${s.n} incógnitas.`)],
    };
  },
});

const determinantAdapter = examAdapter({
  type: LINALG_DETERMINANT,
  ask: "Determinante de una matriz (numérica, entero).",
  build(inst) {
    const d = matrixDeterminant(intMatrix(inst.matrix));
    return {
      kind: "numeric",
      stem: [examP("Sea la matriz"), examMath(`A = ${intMatrixTex(inst.matrix)}`, `A igual a ${intMatrixText(inst.matrix)}`)],
      prompt: "Calcula det A.",
      expected: d,
      format: "entero",
      label: "det A",
      solution: [examP(inst.matrix.length === 2 ? `det A = ad − bc = ${fracText(d)}.` : inst.matrix.length === 3 ? `Por la regla de Sarrus (o desarrollando por una fila): det A = ${fracText(d)}.` : `Desarrollando por la fila o columna con más ceros: det A = ${fracText(d)}.`)],
    };
  },
});

const independenceAdapter = examAdapter({
  type: LINALG_INDEPENDENCE,
  ask: "Dimensión del subespacio que generan unos vectores (numérica, entero).",
  build(inst) {
    const rank = matrixRank(intMatrix(inst.vectors));
    return {
      kind: "numeric",
      stem: [examP("Sean los vectores"), examMath(inst.vectors.map((v, i) => `v_{${i + 1}} = (${v.join(",\\ ")})`).join(",\\quad "), inst.vectors.map((v, i) => `v${i + 1} = (${v.map(intText).join(", ")})`).join("; "))],
      prompt: "¿Cuál es la dimensión del subespacio que generan?",
      expected: BigInt(rank),
      format: "entero",
      label: "Dimensión",
      solution: [examP(`Es el rango de la matriz que tiene los vectores por filas: ${rank}. ${rank === inst.vectors.length ? "Son linealmente independientes." : "Son linealmente dependientes."}`)],
    };
  },
});

const productAdapter = examAdapter({
  type: LINALG_PRODUCT,
  ask: "Un elemento del producto de dos matrices (numérica, entero).",
  build(inst) {
    const P = matrixProduct(intMatrix(inst.a), intMatrix(inst.b));
    const h = seedFromKey(JSON.stringify(inst));
    const i = h % inst.a.length;
    const j = Math.floor(h / 7) % inst.b[0]!.length;
    const value = P[i]![j]!;
    const row = inst.a[i]!;
    const col = inst.b.map((r) => r[j]!);
    return {
      kind: "numeric",
      stem: [examP("Sean"), examMath(`A = ${intMatrixTex(inst.a)},\\quad B = ${intMatrixTex(inst.b)}`, `A igual a ${intMatrixText(inst.a)}; B igual a ${intMatrixText(inst.b)}`)],
      prompt: `Calcula el elemento de la fila ${i + 1} y la columna ${j + 1} de A·B.`,
      expected: value,
      format: "entero",
      label: `(AB)${i + 1}${j + 1}`,
      solution: [examP(`Fila ${i + 1} de A por columna ${j + 1} de B: ${row.map((x, k) => `${intText(x)}·${col[k]! < 0 ? `(${intText(col[k]!)})` : col[k]}`).join(" + ")} = ${fracText(value)}.`)],
    };
  },
});

export const LINALG_EXAM_ADAPTERS: readonly ExamAdapter[] = [detRulesAdapter, theoryAdapter, normsAdapter, tensorVocabAdapter, roucheAdapter, determinantAdapter, independenceAdapter, productAdapter];
