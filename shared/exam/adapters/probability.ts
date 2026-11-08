// Adaptadores de probabilidad.
import { solveTree } from "../../probability/conditional.ts";
import { distMean, probAtLeast, pmfExact, cdf, type DistSpec } from "../../probability/distributions.ts";
import { dieEventText } from "../../probability/events.ts";
import { branchTex, probTex, probText } from "../../probability/format.ts";
import { dieRuleText, gameVar, rvMean } from "../../probability/variable.ts";
import { formatDecimal, mul, ONE, sub, type Frac } from "../../rational.ts";
import type { ChoiceOption } from "../../exercises/choice.ts";
import {
  BINOMIAL_STORIES,
  binomialSpec,
  branchName,
  dieCondFacts,
  gameInstanceRows,
  GEOMETRIC_STORIES,
  geometricSpec,
  PAIR_STORIES,
  pairInstanceFacts,
  pairStatementTrue,
  penaltyAnswer,
  PERCENT_STORIES,
  PROB_BINOMIAL,
  PROB_DIE_COND,
  PROB_GAME,
  PROB_GEOMETRIC,
  PROB_INDEPENDENCE,
  PROB_PENALTY,
  PROB_PRODUCT,
  PROB_TOTAL,
  qFrac,
  toProbTree,
  TREE_STORIES,
  type PairStatement,
  type ProbDistInstance,
} from "../../exercises/probability.ts";
import { examAdapter, type ExamAdapter, type ExamDraft } from "../adapter.ts";
import { examList, examMath, examMuted, examP, examTex } from "../blocks.ts";
import type { ExamBlock } from "../types.ts";

const opt = (id: string, text: string, correct: boolean, why?: string, tex?: string): ChoiceOption => ({ id, text, correct, ...(tex ? { tex } : {}), ...(why ? { why } : {}) });

/** ¿Se escribe como decimal? (denominador divisor de 100: 0,25; 0,05). Si no, fracción. */
const shortDecimal = (x: Frac) => 100n % x.d === 0n;
export const probDataTex = (x: Frac): string => (shortDecimal(x) ? formatDecimal(x, 2).text.replace("−", "-").replace(",", "{,}") : probTex(x));
export const probDataText = (x: Frac): string => (shortDecimal(x) ? formatDecimal(x, 2).text : probText(x));
const pct = (x: Frac) => formatDecimal({ n: x.n * 100n, d: x.d }, 2).text;
/** «3/8 = 0,375» o «1/3 ≈ 0,3333». */
const withDecimal = (x: Frac) => {
  if (x.d === 1n) return probText(x);
  const d = formatDecimal(x, 4);
  return `${probText(x)} ${d.exact ? "=" : "≈"} ${d.text}`;
};

/** Un dado con pesos impar : par. */
export function loadedDieWords(odd: number, even: number): string {
  if (odd === even) return "un dado equilibrado";
  const times = (k: number) => (k === 2 ? "el doble de" : k === 3 ? "el triple de" : `${k} veces más`);
  if (odd % even === 0) return `un dado trucado en el que cada cara impar es ${times(odd / even)} probable que cada cara par`;
  if (even % odd === 0) return `un dado trucado en el que cada cara par es ${times(even / odd)} probable que cada cara impar`;
  return `un dado trucado en el que cada cara impar y cada cara par tienen probabilidades en proporción ${odd} : ${even}`;
}

const dataLine = (tex: string, text: string) => [examTex(tex, text)];

// ---------------------------------------------------------------- Probabilidad total y Bayes

const totalAdapter = examAdapter({
  type: PROB_TOTAL,
  ask: "Probabilidad total P(C) o Bayes P(Aᵢ | C) con un árbol (numérica, dos decimales).",
  build(inst) {
    const tree = toProbTree(inst);
    const s = solveTree(tree);
    let stem: ExamBlock[];
    let prompt: string;
    let names: string[];
    if (inst.percent !== null) {
      const st = PERCENT_STORIES[inst.percent]!;
      names = [...st.branches];
      stem = [examP(st.text.replace("{x}", pct(tree.priors[0]!)).replace("{y}", pct(sub(ONE, tree.likelihoods[0]!))).replace("{z}", pct(tree.likelihoods[1]!)))];
      prompt = st.question;
    } else {
      const story = TREE_STORIES[inst.story]!;
      names = tree.priors.map((_, i) => branchName(inst.story, i));
      stem = [
        examP(`${story.context} ${names.join(", ").replace(/, ([^,]*)$/, " y $1")} forman una partición: cada caso cae en uno solo. C es el suceso «${story.event}».`),
        examList([
          ...names.flatMap((b, i) => (i === inst.hiddenPrior ? [] : [dataLine(`P(${branchTex(b)}) = ${probDataTex(tree.priors[i]!)}`, `P de ${b} igual a ${probDataText(tree.priors[i]!)}`)])),
          ...names.map((b, i) => dataLine(`P(C \\mid ${branchTex(b)}) = ${probDataTex(tree.likelihoods[i]!)}`, `P de C dado ${b} igual a ${probDataText(tree.likelihoods[i]!)}`)),
        ]),
      ];
      prompt = inst.ask === null ? "Calcula P(C)." : `Calcula P(${names[inst.ask]} | C).`;
    }
    const ask = inst.ask;
    const value = ask === null ? s.total : s.posteriors[ask];
    if (!value) return null;
    const totalLine = `P(C) = ${s.joints.map((j) => probText(j)).join(" + ")} = ${withDecimal(s.total)}`;
    return {
      kind: "numeric",
      stem,
      prompt,
      expected: value,
      format: "dos-decimales",
      label: ask === null ? "P(C)" : "Probabilidad",
      solution: [
        examP(`Probabilidad total: ${totalLine}.`),
        ...(ask === null ? [] : [examP(`Bayes: P(${names[ask]} | C) = P(${names[ask]})·P(C | ${names[ask]}) / P(C) = ${probText(s.joints[ask]!)} / ${probText(s.total)} = ${withDecimal(value)}.`)]),
      ],
    };
  },
});

// ---------------------------------------------------------------- Condicionada

const dieCondAdapter = examAdapter({
  type: PROB_DIE_COND,
  ask: "Probabilidad condicionada con un dado (opción múltiple).",
  build(inst) {
    const f = dieCondFacts(inst);
    if (!f.answer) return null;
    const answer = f.answer;
    return {
      kind: "choice",
      stem: [examP(`Se tira ${loadedDieWords(inst.odd, inst.even)}.`)],
      prompt: `¿Cuál es la probabilidad de que el resultado ${dieEventText(inst.a)}, sabiendo que ${dieEventText(inst.b)}?`,
      question: {
        mode: "single",
        options: inst.options.map((q, i) => {
          const x = qFrac(q);
          return opt(`p${i}`, probText(x), x.n === answer.n && x.d === answer.d, undefined, probTex(x));
        }),
      },
      solution: [examP(`P(A | B) = P(A ∩ B) / P(B) = ${probText(f.pAB)} / ${probText(f.pB)} = ${probText(answer)}.`)],
    };
  },
});

function statementNode(s: PairStatement): { tex: string; text: string } {
  switch (s.kind) {
    case "independientes":
      return { tex: "\\text{A y B son independientes.}", text: "A y B son independientes." };
    case "incompatibles":
      return { tex: "\\text{A y B son incompatibles: } P(A \\cap B) = 0.", text: "A y B son incompatibles: P(A ∩ B) = 0." };
    case "condicionada-igual":
      return { tex: "P(A \\mid B) = P(A)", text: "P(A | B) = P(A)." };
    case "a-dado-b":
      return { tex: `P(A \\mid B) = ${probDataTex(qFrac(s.value))}`, text: `P(A | B) = ${probDataText(qFrac(s.value))}.` };
    case "b-dado-a":
      return { tex: `P(B \\mid A) = ${probDataTex(qFrac(s.value))}`, text: `P(B | A) = ${probDataText(qFrac(s.value))}.` };
    case "union":
      return { tex: `P(A \\cup B) = ${probDataTex(qFrac(s.value))}`, text: `P(A ∪ B) = ${probDataText(qFrac(s.value))}.` };
    case "ninguno":
      return { tex: `P(A^c \\cap B^c) = ${probDataTex(qFrac(s.value))}`, text: `P(Aᶜ ∩ Bᶜ) = ${probDataText(qFrac(s.value))}.` };
  }
}

const GIVEN = { inter: ["P(A \\cap B)", "P(A ∩ B)"], union: ["P(A \\cup B)", "P(A ∪ B)"], cond: ["P(A \\mid B)", "P(A | B)"] } as const;

const independenceAdapter = examAdapter({
  type: PROB_INDEPENDENCE,
  levels: ["básico", "medio"],
  ask: "Condicionada, unión e independencia de dos sucesos (opción múltiple).",
  build(inst) {
    if (inst.multi) return null;
    const story = PAIR_STORIES[inst.story]!;
    const f = pairInstanceFacts(inst);
    const pA = qFrac(inst.pA);
    const pB = qFrac(inst.pB);
    const v = qFrac(inst.value);
    return {
      kind: "choice",
      stem: [
        examP(story.context),
        examMuted(`A: ${story.a}. B: ${story.b}.`),
        examMath(
          `P(A) = ${probDataTex(pA)},\\quad P(B) = ${probDataTex(pB)},\\quad ${GIVEN[inst.given][0]} = ${probDataTex(v)}`,
          `P de A igual a ${probDataText(pA)}; P de B igual a ${probDataText(pB)}; ${GIVEN[inst.given][1]} igual a ${probDataText(v)}`,
        ),
      ],
      prompt: "¿Cuál de estas afirmaciones es correcta?",
      question: {
        mode: "single",
        options: inst.statements.map((s, i) => {
          const n = statementNode(s);
          return opt(`a${i}`, n.text, pairStatementTrue(s, f), undefined, n.tex);
        }),
      },
      solution: [
        examP(
          `P(A ∩ B) = ${withDecimal(f.inter)}, P(A ∪ B) = ${withDecimal(f.union)}${f.aGivenB ? `, P(A | B) = ${withDecimal(f.aGivenB)}` : ""}${f.bGivenA ? `, P(B | A) = ${withDecimal(f.bGivenA)}` : ""}. P(A)·P(B) = ${withDecimal(mul(pA, pB))}: ${f.independent ? "son independientes" : "no son independientes"}.`,
        ),
      ],
    };
  },
});

// ---------------------------------------------------------------- Distribuciones

function distAdapter(type: typeof PROB_BINOMIAL, stories: readonly string[], spec: (i: ProbDistInstance) => DistSpec, name: string) {
  return examAdapter({
    type,
    ask: `${name}: P(X = k), P(X ≥ k) o P(X ≤ k) (numérica, dos decimales).`,
    build(inst): ExamDraft | null {
      const d = spec(inst);
      const ask = inst.ask.find((a) => a === "igual" || a === "al-menos" || a === "como-mucho");
      if (!ask) return null;
      const raw = ask === "igual" ? pmfExact(d, inst.k) : ask === "al-menos" ? probAtLeast(d, inst.k) : cdf(d, inst.k);
      if (raw === null || typeof raw === "number") return null;
      const text = stories[inst.story]!.replace("{p}", probDataText(qFrac(inst.p))).replace("{n}", String(inst.n));
      const what = ask === "igual" ? `P(X = ${inst.k})` : ask === "al-menos" ? `P(X ≥ ${inst.k})` : `P(X ≤ ${inst.k})`;
      return {
        kind: "numeric",
        stem: [examP(text)],
        prompt: `Calcula ${what}.`,
        expected: raw,
        format: "dos-decimales",
        label: what,
        solution: [
          examP(
            d.kind === "binomial"
              ? `X ~ B(${inst.n}, ${probText(qFrac(inst.p))}): P(X = k) = C(n, k)·pᵏ·(1 − p)ⁿ⁻ᵏ${ask === "igual" ? "" : ", sumando los k que pide"}.`
              : `X ~ Geom(${probText(qFrac(inst.p))}): P(X = k) = (1 − p)ᵏ⁻¹·p${ask === "al-menos" ? " y P(X ≥ k) = (1 − p)ᵏ⁻¹" : ask === "como-mucho" ? " y P(X ≤ k) = 1 − (1 − p)ᵏ" : ""}.`,
          ),
          examP(`${what} = ${withDecimal(raw)}. Media: E[X] = ${probText(distMean(d))}.`),
        ],
      };
    },
  });
}

// ---------------------------------------------------------------- Esperanza

const gameAdapter = examAdapter({
  type: PROB_GAME,
  ask: "Ganancia esperada de un juego con un dado (numérica, dos decimales).",
  build(inst) {
    const rows = gameInstanceRows(inst);
    const mean = rvMean(gameVar(rows));
    return {
      kind: "numeric",
      stem: [examP(`Se tira ${loadedDieWords(inst.odd, inst.even)}. ${dieRuleText(inst.rule)} X es tu ganancia, en euros (negativa si pierdes).`)],
      prompt: "¿Cuál es la ganancia esperada E[X]?",
      expected: mean,
      format: "dos-decimales",
      label: "E[X]",
      solution: [
        examP("E[X] = Σ (ganancia de la cara)·P(cara):"),
        examList(rows.map((r) => [`Cara ${r.label}: ${probText(r.value)} € con probabilidad ${probText(r.prob)}`.replace(/-/g, "−")])),
        examP(`E[X] = ${withDecimal(mean)} €.`.replace(/-/g, "−")),
      ],
    };
  },
});

const penaltyAdapter = examAdapter({
  type: PROB_PENALTY,
  ask: "Penalización por fallo para que contestar al azar valga lo pedido (numérica, dos decimales).",
  build(inst) {
    const x = penaltyAnswer(inst);
    const reward = qFrac(inst.reward);
    const target = qFrac(inst.target);
    const pts = (v: Frac) => `${probDataText(v)} ${v.n === 1n && v.d === 1n ? "punto" : "puntos"}`;
    return {
      kind: "numeric",
      stem: [
        examP(
          `En un test, cada pregunta tiene ${inst.options} opciones y solo una es correcta. Un acierto suma ${pts(reward)} y una pregunta en blanco, 0. Un fallo resta x puntos.`,
        ),
      ],
      prompt: `¿Cuánto tiene que valer x para que responder al azar valga, de media, ${target.n === 0n ? "0 puntos (lo mismo que dejarla en blanco)" : pts(target)} por pregunta?`,
      expected: x,
      format: "dos-decimales",
      label: "x (puntos)",
      solution: [examP(`E = ${probText(reward)}·(1/${inst.options}) − x·(${inst.options - 1}/${inst.options}). Igualando a ${probText(target)} y despejando: x = ${withDecimal(x)}.`)],
    };
  },
});

const productAdapter = examAdapter({
  type: PROB_PRODUCT,
  ask: "E[XY] con dos binomiales independientes (numérica, dos decimales).",
  build(inst) {
    const dx: DistSpec = { kind: "binomial", n: inst.x.n, p: qFrac(inst.x.p) };
    const dy: DistSpec = { kind: "binomial", n: inst.y.n, p: qFrac(inst.y.p) };
    const ex = distMean(dx);
    const ey = distMean(dy);
    const exy = mul(ex, ey);
    return {
      kind: "numeric",
      stem: [
        examP("Sean X e Y independientes, con"),
        examMath(
          `X \\sim B\\left(${inst.x.n},\\ ${probDataTex(qFrac(inst.x.p))}\\right),\\quad Y \\sim B\\left(${inst.y.n},\\ ${probDataTex(qFrac(inst.y.p))}\\right)`,
          `X binomial de parámetros ${inst.x.n} y ${probDataText(qFrac(inst.x.p))}; Y binomial de parámetros ${inst.y.n} y ${probDataText(qFrac(inst.y.p))}`,
        ),
      ],
      prompt: "Calcula E[XY].",
      expected: exy,
      format: "dos-decimales",
      label: "E[XY]",
      solution: [examP(`Independientes: E[XY] = E[X]·E[Y] = ${probText(ex)}·${probText(ey)} = ${withDecimal(exy)} (E de una binomial: n·p).`)],
    };
  },
});

export const PROB_EXAM_ADAPTERS: readonly ExamAdapter[] = [
  totalAdapter,
  dieCondAdapter,
  independenceAdapter,
  distAdapter(PROB_BINOMIAL, BINOMIAL_STORIES, binomialSpec, "Binomial"),
  distAdapter(PROB_GEOMETRIC, GEOMETRIC_STORIES, geometricSpec, "Geométrica"),
  gameAdapter,
  penaltyAdapter,
  productAdapter,
];
