// «Árbol de probabilidad»: una partición A₁, …, Aₙ y un suceso C. La persona completa las ramas que
// faltan (la P(Aᵢ) que no se da y cada P(Cᶜ | Aᵢ)), los productos de cada camino P(Aᵢ ∩ C), P(C) por
// la probabilidad total y, si se pide, P(Aᵢ | C) por Bayes. Cada casilla se comprueba por separado y
// se marca sin decir su valor; el árbol dibujado enseña lo que va escribiendo. La solución, detrás de
// «Ver la solución completa».
import { useId, useMemo } from "react";
import { solveTree, type ProbTree } from "../../../../shared/probability/conditional.ts";
import { branchTex, probTex } from "../../../../shared/probability/format.ts";
import type { Frac } from "../../../../shared/rational.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Tex } from "../../../lib/tex.tsx";
import { TreeDiagram, type TreeEdge } from "./charts.tsx";
import {
  AnswerField,
  AnswerHelp,
  CheckButton,
  dataTex,
  dataText,
  GradeSummary,
  gradeFields,
  Hints,
  PracticeBox,
  probWithDecimal,
  probWithDecimalTex,
  SolutionBox,
  SolutionLine,
  Status,
  useFields,
} from "./common.tsx";

export const TREE_HINTS = [
  "Las ramas que salen de un mismo nodo suman 1: P(A₁) + P(A₂) + … = 1 y P(C | Aᵢ) + P(Cᶜ | Aᵢ) = 1.",
  "Cada camino del árbol se multiplica: P(Aᵢ ∩ C) = P(Aᵢ)·P(C | Aᵢ).",
  "Probabilidad total: P(C) es la suma de los caminos que acaban en C, P(C) = Σ P(Aᵢ)·P(C | Aᵢ).",
  "Bayes: P(Aᵢ | C) = P(Aᵢ ∩ C) / P(C), el camino de Aᵢ dividido entre la suma de todos los caminos que acaban en C.",
];
/** «P(S₁ ∩ C)» para TeX: S_{1}, con el subíndice de TeX (KaTeX no admite «₁»); las palabras, en \text{}. */
/** «P(S₁ ∩ C)» para TeX: S_{1}, con el subíndice de TeX (KaTeX no admite «₁»); las palabras, en \\text{}. */
const nameTex = branchTex;

export function TreePractice({
  tree,
  branches,
  hiddenPrior,
  ask,
  onSolved,
  title = "Árbol de probabilidad",
}: {
  tree: ProbTree;
  branches: readonly string[];
  /** Rama cuya P(Aᵢ) se deduce (no se da), o null si se dan todas. */
  hiddenPrior: number | null;
  /** Rama de la que se pide P(Aᵢ | C), o null. */
  ask: number | null;
  onSolved?: () => void;
  title?: string;
}) {
  const help = useId();
  const sol = useMemo(() => solveTree(tree), [tree]);
  const n = branches.length;
  const keys = useMemo(() => {
    const k: string[] = [];
    if (hiddenPrior !== null) k.push(`p${hiddenPrior}`);
    for (let i = 0; i < n; i++) k.push(`n${i}`);
    for (let i = 0; i < n; i++) k.push(`j${i}`);
    k.push("total");
    if (ask !== null) k.push("post");
    return k;
  }, [n, hiddenPrior, ask]);
  const expected = useMemo(() => {
    const e: Record<string, Frac> = {};
    if (hiddenPrior !== null) e[`p${hiddenPrior}`] = sol.priors[hiddenPrior]!;
    sol.complements.forEach((c, i) => (e[`n${i}`] = c));
    sol.joints.forEach((j, i) => (e[`j${i}`] = j));
    e.total = sol.total;
    if (ask !== null) e.post = sol.posteriors[ask]!;
    return e;
  }, [sol, hiddenPrior, ask]);
  const f = useFields(keys);
  const graded = gradeFields(f.values, expected);
  const solved = f.checked && graded.allOk;
  const bad = (k: string) => f.checked && graded.states[k] !== "bien";

  const field = (k: string, label: string, labelTex: string) => (
    <AnswerField
      label={label}
      labelNode={<Tex tex={labelTex} />}
      value={f.values[k] ?? ""}
      onChange={(v) => f.set(k, v)}
      invalid={bad(k)}
      describedBy={help}
      className="w-full sm:w-40"
    />
  );
  const edgeOf = (k: string | null, value: Frac): TreeEdge => {
    if (k === null) return { text: dataText(value), state: "dato" };
    const v = (f.values[k] ?? "").trim();
    return { text: v === "" ? "?" : v, state: bad(k) ? "mal" : v === "" ? "vacío" : "respuesta" };
  };

  return (
    <PracticeBox title={title}>
      <TreeDiagram
        branches={branches}
        first={branches.map((_, i) => edgeOf(i === hiddenPrior ? `p${i}` : null, sol.priors[i]!))}
        second={branches.map((_, i) => [edgeOf(null, sol.likelihoods[i]!), edgeOf(`n${i}`, sol.complements[i]!)] as const)}
        leaves={branches.map((_, i) => edgeOf(`j${i}`, sol.joints[i]!))}
        label={`Árbol de probabilidad con ${n} ramas (${branches.join(", ")}) y, en cada una, C y su complementario. Las ramas que faltan llevan un signo de interrogación.`}
      />
      <ol aria-label="Ramas del árbol" className="flex flex-col gap-3">
        {branches.map((b, i) => (
          <li key={b} className="flex flex-col gap-2 rounded-md border border-border p-2">
            <div className="flex flex-wrap items-end gap-3">
              {i === hiddenPrior ? (
                field(`p${i}`, `P(${b})`, `P(${nameTex(b)})`)
              ) : (
                <Tex tex={`P(${nameTex(b)}) = ${dataTex(sol.priors[i]!)}`} label={`P de ${b} igual a ${dataText(sol.priors[i]!)}`} className="text-[16px]" />
              )}
            </div>
            <ul className="ml-2 flex flex-col gap-2 border-l-2 border-border pl-3">
              <li className="flex flex-wrap items-end gap-3">
                <Tex tex={`P(C \\mid ${nameTex(b)}) = ${dataTex(sol.likelihoods[i]!)}`} label={`P de C dado ${b} igual a ${dataText(sol.likelihoods[i]!)}`} className="text-[16px]" />
                {field(`j${i}`, `P(${b} ∩ C)`, `P(${nameTex(b)} \\cap C)`)}
              </li>
              <li className="flex flex-wrap items-end gap-3">{field(`n${i}`, `P(Cᶜ | ${b})`, `P(C^c \\mid ${nameTex(b)})`)}</li>
            </ul>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-3">
        {field("total", "P(C)", "P(C)")}
        {ask !== null ? field("post", `P(${branches[ask]} | C)`, `P(${nameTex(branches[ask]!)} \\mid C)`) : null}
      </div>
      <AnswerHelp id={help} />
      <div className="flex flex-wrap gap-2">
        <CheckButton
          onClick={() => {
            f.check();
            if (graded.allOk) onSolved?.();
          }}
        />
        <Hints hints={TREE_HINTS} />
      </div>
      {f.checked ? (
        <Status>
          <GradeSummary graded={graded} solved={solved} success="¡Correcto! El árbol está completo." />
        </Status>
      ) : null}
      <SolutionGate resetKey={JSON.stringify([tree.priors, tree.likelihoods].map((xs) => xs.map(probTex)))}>
        <SolutionBox>
          {branches.map((b, i) => (
            <SolutionLine
              key={b}
              tex={`P(${nameTex(b)} \\cap C) = ${probTex(sol.priors[i]!)} \\cdot ${probTex(sol.likelihoods[i]!)} = ${probWithDecimalTex(sol.joints[i]!)},\\quad P(C^c \\mid ${nameTex(b)}) = 1 - ${probTex(sol.likelihoods[i]!)} = ${probTex(sol.complements[i]!)}`}
              label={`P de ${b} y C igual a ${probWithDecimal(sol.joints[i]!)}; P de no C dado ${b} igual a ${probWithDecimal(sol.complements[i]!)}`}
            />
          ))}
          <SolutionLine tex={`P(C) = ${sol.joints.map(probTex).join(" + ")} = ${probWithDecimalTex(sol.total)}`} label={`P de C igual a ${probWithDecimal(sol.total)}`} />
          {ask !== null ? (
            <SolutionLine
              tex={`P(${nameTex(branches[ask]!)} \\mid C) = \\dfrac{${probTex(sol.joints[ask]!)}}{${probTex(sol.total)}} = ${probWithDecimalTex(sol.posteriors[ask]!)}`}
              label={`P de ${branches[ask]} dado C igual a ${probWithDecimal(sol.posteriors[ask]!)}`}
            />
          ) : null}
        </SolutionBox>
      </SolutionGate>
    </PracticeBox>
  );
}
