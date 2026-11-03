// Prácticas de teoría de álgebra lineal con el formato del examen: propiedades del determinante
// (número), verdadero o falso sobre matrices y vectores (opción múltiple o varias correctas), normas
// (números o «¿para cuántos α…?»), rango y dimensión de un tensor y clasificación de un sistema. Las
// usan la sección «Propiedades y teoría» (y «Tensores») y el banco de ejercicios.
import { useMemo } from "react";
import {
  alphaVecText,
  detRulesAnswer,
  detRulesDets,
  normsQuestion,
  roucheChoiceQuestion,
  tensorVocabQuestion,
  tensorVocabStatement,
  theoryQuestion,
  theorySubject,
  THEORY_ASK,
  type DetRulesInstance,
  type LinSystemInstance,
  type MatrixTheoryInstance,
  type NamedQty,
  type NormsInstance,
  type TensorVocabInstance,
} from "../../../../shared/exercises/linalg.ts";
import { intMatrix, intVector } from "../../../../shared/linalg/matrix.ts";
import { analyzeSystem, splitAugmented } from "../../../../shared/linalg/systems.ts";
import { detExprTex, detExprText, norm1, norm2Squared, normInf } from "../../../../shared/linalg/theory.ts";
import { toNumber } from "../../../../shared/rational.ts";
import { ChoicePractice } from "../../../components/practice/ChoiceQuestion.tsx";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Tex } from "../../../lib/tex.tsx";
import { NumericAnswers } from "../calculus/TheoryPractice.tsx";
import { Hints, MatrixView, PracticeBox } from "./common.tsx";
import { equationsLabel, equationsTex } from "./SystemAnswer.tsx";

type Props<I> = { instance: I; onSolved?: () => void };
const key = (x: unknown) => JSON.stringify(x);
const num = (v: number) => String(v).replace("-", "−");

// ---------------------------------------------------------------- Propiedades del determinante

export function DetRulesPractice({ instance, onSolved }: Props<DetRulesInstance>) {
  const g = instance.given;
  const value = detRulesAnswer(instance)!;
  const dets = detRulesDets(instance);
  const n = instance.n;
  return (
    <PracticeBox title="Propiedades del determinante">
      <div className="flex flex-col gap-2">
        <p>{`Sean A${g.B !== null ? " y B" : ""} matrices ${n}×${n}${g.kind === "autovalores" ? ", con A diagonalizable" : ""}, con:`}</p>
        {g.kind === "det" ? (
          <Tex display tex={`\\det A = ${g.A}${g.B !== null ? `,\\quad \\det B = ${g.B}` : ""}`} label={`determinante de A igual a ${num(g.A)}${g.B !== null ? `; determinante de B igual a ${num(g.B)}` : ""}`} className="text-[18px]" />
        ) : g.kind === "autovalores" ? (
          <Tex
            display
            tex={`\\text{autovalores de } A:\\ ${g.eig.join(",\\ ")}${g.B !== null ? `,\\quad \\det B = ${g.B}` : ""}`}
            label={`autovalores de A: ${g.eig.map(num).join(", ")}${g.B !== null ? `; determinante de B igual a ${num(g.B)}` : ""}`}
            className="text-[18px]"
          />
        ) : (
          <>
            <MatrixView M={intMatrix(g.A)} label="A" />
            {g.B !== null ? <Tex display tex={`\\det B = ${g.B}`} label={`determinante de B igual a ${num(g.B)}`} className="text-[18px]" /> : null}
          </>
        )}
        <p>
          Calcula <Tex tex={`\\det\\left(${detExprTex(instance.expr)}\\right)`} label={`el determinante de ${detExprText(instance.expr)}`} />.
        </p>
      </div>
      <NumericAnswers
        fields={[{ label: "Determinante =", expected: toNumber(value) }]}
        onSolved={onSolved}
        hints={[
          `det(kA) = kⁿ·det A: el número sale elevado a n = ${n} (una vez por fila).`,
          "det(AB) = det A·det B; det(A⁻¹) = 1/det A; det(Aᵀ) = det A; det(A²) = (det A)².",
          g.kind === "autovalores"
            ? "Si A es diagonalizable, det A es el producto de sus autovalores (con su multiplicidad)."
            : g.kind === "matriz"
              ? "Con una sola entrada no nula en cada fila y columna, det A = ± el producto de esas entradas: el signo es el de la permutación (cuenta los intercambios de filas para llegar a la diagonal)."
              : "Primero aplica las reglas con letras y al final sustituye los números.",
        ]}
      />
      <SolutionGate resetKey={key(instance)}>
        <p className="rounded-lg border border-border bg-raised p-3">
          {`det A = ${num(toNumber(dets.A))}${g.B !== null ? `, det B = ${num(toNumber(dets.B))}` : ""}. det(${detExprText(instance.expr)}) = ${num(instance.expr.k)}^${n}·${instance.expr.factors
            .map((f) => `(det ${f.m})${f.pow === 1 ? "" : `^${f.pow}`}`)
            .join("·")} = ${num(Number(value.n))}${value.d === 1n ? "" : `/${value.d}`}.`}
        </p>
      </SolutionGate>
    </PracticeBox>
  );
}

// ---------------------------------------------------------------- Teoría de matrices

export function MatrixTheoryPractice({ instance, onSolved }: Props<MatrixTheoryInstance>) {
  const q = useMemo(() => theoryQuestion(instance), [instance]);
  const d = instance.cls === "diagonal" ? (instance as { d: number[] }).d : null;
  return (
    <PracticeBox title="Teoría de matrices y vectores">
      <p>{theorySubject(instance)}</p>
      {d ? <MatrixView M={intMatrix(d.map((x, i) => d.map((_, j) => (i === j ? x : 0))))} label="A" /> : null}
      <ChoicePractice
        legend={THEORY_ASK[instance.ask]}
        question={q}
        seedKey={key(instance)}
        onSolved={onSolved}
        actions={
          <Hints
            hints={[
              "Para descartar una afirmación general basta un contraejemplo sencillo: I, −I, diag(1, 0), (1 1; 0 1)…",
              "Regular ⇔ det ≠ 0 ⇔ rg = n ⇔ 0 no es autovalor. Simétrica ⇒ diagonalizable con autovalores reales. Definida positiva ⇔ todos los autovalores > 0.",
              "det A = producto de autovalores y traza = suma: con det < 0 en 2×2 hay uno positivo y otro negativo.",
            ]}
          />
        }
      />
    </PracticeBox>
  );
}

// ---------------------------------------------------------------- Normas

const qtyTex = (q: NamedQty) => (q.k === "num" ? String(q.value) : q.k === "dot" ? "u\\cdot v" : q.k === "norm1" ? `\\|${q.of}\\|_1` : q.k === "norm2sq" ? `\\|${q.of}\\|_2^2` : `\\|${q.of}\\|_\\infty`);
const qtyText = (q: NamedQty) => (q.k === "num" ? num(q.value) : q.k === "dot" ? "u·v" : q.k === "norm1" ? `‖${q.of}‖₁` : q.k === "norm2sq" ? `‖${q.of}‖₂²` : `‖${q.of}‖∞`);
const OP_TEX = { "=": "=", ">": ">", "<": "<" } as const;

export function NormsPractice({ instance, onSolved }: Props<NormsInstance>) {
  if (instance.kind === "calcular") {
    const v = intVector(instance.v);
    const text = `(${instance.v.map(num).join(", ")})`;
    return (
      <PracticeBox title="Normas de un vector">
        <Tex display tex={`v = (${instance.v.join(",\\ ")})`} label={`v igual a ${text}`} className="text-[18px]" />
        <NumericAnswers
          fields={[
            { label: "‖v‖₁ =", expected: toNumber(norm1(v)) },
            { label: "‖v‖₂ =", expected: Math.sqrt(toNumber(norm2Squared(v))) },
            { label: "‖v‖∞ =", expected: toNumber(normInf(v)) },
          ]}
          onSolved={onSolved}
          hints={["‖v‖₁: suma de los valores absolutos.", "‖v‖₂: raíz de la suma de los cuadrados (puedes escribir sqrt(14)).", "‖v‖∞: el mayor valor absoluto."]}
        />
      </PracticeBox>
    );
  }
  return <NormsCount instance={instance} onSolved={onSolved} />;
}

function NormsCount({ instance, onSolved }: Props<Extract<NormsInstance, { kind: "contar" }>>) {
  const q = useMemo(() => normsQuestion(instance), [instance]);
  const condTex = instance.conds.map((c) => `${qtyTex(c.lhs)} ${OP_TEX[c.op]} ${qtyTex(c.rhs)}`).join(" \\quad\\text{y}\\quad ");
  const condText = instance.conds.map((c) => `${qtyText(c.lhs)} ${c.op} ${qtyText(c.rhs)}`).join(" y ");
  const domain = instance.domain === "nonneg" ? "no negativos de α (α ≥ 0)" : "reales de α";
  return (
    <PracticeBox title="Normas y producto escalar">
      <p>
        {`Sean u = ${alphaVecText(instance.u)}${instance.v ? ` y v = ${alphaVecText(instance.v)}` : ""}.`}
      </p>
      <Tex display tex={condTex} label={condText} className="text-[18px]" />
      <ChoicePractice
        legend={`¿Para cuántos valores ${domain} se cumple${instance.conds.length > 1 ? "n las condiciones" : ""}?`}
        question={q}
        seedKey={key(instance)}
        onSolved={onSolved}
        actions={
          <Hints
            hints={[
              "Escribe cada condición como una ecuación en α: u·v = suma de productos; ‖u‖₁ = suma de |·|; ‖u‖₂² = suma de cuadrados; ‖u‖∞ = el mayor |·|.",
              "Con |α| salen dos casos (α y −α); si solo valen α ≥ 0, quédate con los no negativos.",
              "‖u‖∞ = c se cumple para todo un intervalo de α si otra componente ya vale c en valor absoluto: entonces hay infinitos.",
            ]}
          />
        }
      />
    </PracticeBox>
  );
}

// ---------------------------------------------------------------- Tensores

export function TensorVocabPractice({ instance, onSolved }: Props<TensorVocabInstance>) {
  const q = useMemo(() => tensorVocabQuestion(instance), [instance]);
  const st = tensorVocabStatement(instance);
  return (
    <PracticeBox title="Rango y dimensión de un tensor">
      {st.tex ? <Tex display tex={st.tex} label={st.text} className="text-[18px]" /> : null}
      <ChoicePractice
        legend={st.text}
        question={q}
        seedKey={key(instance)}
        onSolved={onSolved}
        actions={
          <Hints
            hints={[
              "En el curso, el rango de un tensor es el número de índices (en NumPy, ndim) y su dimensión, cuántos valores toma cada índice.",
              "No es el rango de una matriz (rg): una matriz n×n es siempre un tensor de rango 2 y dimensión n.",
              "Un tensor de rango k y dimensión n tiene nᵏ componentes y shape (n, n, …, n), con k números.",
            ]}
          />
        }
      />
    </PracticeBox>
  );
}

// ---------------------------------------------------------------- Rouché–Frobenius tipo test

export function RoucheChoicePractice({ instance, onSolved }: Props<LinSystemInstance>) {
  const { A, b } = useMemo(() => splitAugmented(intMatrix(instance.matrix)), [instance.matrix]);
  const q = useMemo(() => roucheChoiceQuestion(instance), [instance]);
  const s = analyzeSystem(A, b);
  return (
    <PracticeBox title="Clasificar un sistema">
      <Tex display tex={equationsTex(A, b)} label={`Sistema: ${equationsLabel(A, b)}`} className="text-[18px]" />
      <ChoicePractice
        legend="¿Cómo es el sistema?"
        question={q}
        seedKey={key(instance)}
        onSolved={onSolved}
        actions={
          <Hints
            hints={[
              "Rouché–Frobenius: si rg A ≠ rg (A|b), incompatible. Si son iguales a n (incógnitas), compatible determinado.",
              "Si rg A = rg (A|b) < n, compatible indeterminado con n − rg A parámetros.",
            ]}
          />
        }
        extraSolution={<p className="text-[14px] text-muted">{`rg A = ${s.rankA}, rg (A|b) = ${s.rankAb}, n = ${s.n}.`}</p>}
      />
    </PracticeBox>
  );
}
