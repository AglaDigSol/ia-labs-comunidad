// Vistas del banco de ejercicios para el tema «Probabilidad»: el enunciado de cada instancia y la
// práctica del laboratorio (src/features/labs/probability). Van en su propio fichero y views.tsx solo
// las añade a EXERCISE_VIEWS.
import { useMemo, type ComponentType } from "react";
import {
  BINOMIAL_STORIES,
  binomialSpec,
  branchName,
  gameInstanceRows,
  GEOMETRIC_STORIES,
  geometricSpec,
  PAIR_STORIES,
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
  type ProbDieCondInstance,
  type ProbDistInstance,
  type ProbGameInstance,
  type ProbPairInstance,
  type ProbPenaltyInstance,
  type ProbProductInstance,
  type ProbTreeInstance,
} from "../../../../shared/exercises/probability.ts";
import type { ExerciseType } from "../../../../shared/exercises/types.ts";
import { dieRuleText } from "../../../../shared/probability/variable.ts";
import { formatDecimal, ONE, sub, type Frac } from "../../../../shared/rational.ts";
import { dataTex, dataText, loadedDieText, Statement, TexList } from "../probability/common.tsx";
import { DieCondPractice, PairPractice } from "../probability/ConditionalPractice.tsx";
import { DistributionPractice } from "../probability/DistributionPractice.tsx";
import { GamePractice, PenaltyPractice, ProductPractice } from "../probability/ExpectationPractice.tsx";
import { TreePractice } from "../probability/TreePractice.tsx";
import type { ExerciseViewProps } from "./views.tsx";

type View = ComponentType<ExerciseViewProps<unknown>>;

/** «12» de 12/100 (porcentaje sin el signo). */
const pct = (x: Frac) => formatDecimal({ n: x.n * 100n, d: x.d }, 2).text;

function TotalExercise({ instance, onSolved }: ExerciseViewProps<ProbTreeInstance>) {
  const tree = useMemo(() => toProbTree(instance), [instance]);
  if (instance.percent !== null) {
    const s = PERCENT_STORIES[instance.percent]!;
    const text = s.text.replace("{x}", pct(tree.priors[0]!)).replace("{y}", pct(sub(ONE, tree.likelihoods[0]!))).replace("{z}", pct(tree.likelihoods[1]!));
    return (
      <>
        <Statement>
          <p>{text}</p>
          <p className="font-semibold">{s.question}</p>
          <p className="text-[14px] text-muted">{`C: ${s.event}. Redondea a dos decimales y usa la coma.`}</p>
        </Statement>
        <TreePractice tree={tree} branches={s.branches} hiddenPrior={instance.hiddenPrior} ask={instance.ask} onSolved={onSolved} />
      </>
    );
  }
  const story = TREE_STORIES[instance.story]!;
  const names = tree.priors.map((_, i) => branchName(instance.story, i));
  const data = [
    ...names.flatMap((b, i) => (i === instance.hiddenPrior ? [] : [[`P(${b}) = ${dataTex(tree.priors[i]!)}`, `P de ${b} igual a ${dataText(tree.priors[i]!)}`]])),
    ...names.map((b, i) => [`P(C \\mid ${b}) = ${dataTex(tree.likelihoods[i]!)}`, `P de C dado ${b} igual a ${dataText(tree.likelihoods[i]!)}`]),
  ];
  return (
    <>
      <Statement>
        <p>{`${story.context} ${names.join(", ").replace(/, ([^,]*)$/, " y $1")} forman una partición: cada caso cae en uno solo. C es el suceso «${story.event}».`}</p>
        <TexList items={data as Array<[string, string]>} />
        <p className="font-semibold">{instance.ask === null ? "Calcula P(C)." : `Calcula P(C) y P(${names[instance.ask]} | C).`}</p>
      </Statement>
      <TreePractice tree={tree} branches={names} hiddenPrior={instance.hiddenPrior} ask={instance.ask} onSolved={onSolved} />
    </>
  );
}

const DieCondExercise = ({ instance, onSolved }: ExerciseViewProps<ProbDieCondInstance>) => (
  <DieCondPractice odd={instance.odd} even={instance.even} a={instance.a} b={instance.b} options={instance.options.map(qFrac)} onSolved={onSolved} />
);

function IndependenceExercise({ instance, onSolved }: ExerciseViewProps<ProbPairInstance>) {
  const story = PAIR_STORIES[instance.story]!;
  const [pA, pB, value] = useMemo(() => [qFrac(instance.pA), qFrac(instance.pB), qFrac(instance.value)], [instance]);
  return (
    <>
      <Statement>
        <p>{story.context}</p>
        <p className="text-[14px] text-muted">{`A: ${story.a}. B: ${story.b}.`}</p>
      </Statement>
      <PairPractice pA={pA} pB={pB} given={instance.given} value={value} statements={instance.statements} multi={instance.multi} onSolved={onSolved} />
    </>
  );
}

function DistExercise({ instance, onSolved, stories, spec }: ExerciseViewProps<ProbDistInstance> & { stories: readonly string[]; spec: typeof binomialSpec }) {
  const d = useMemo(() => spec(instance), [instance, spec]);
  const text = stories[instance.story]!.replace("{p}", dataText(qFrac(instance.p))).replace("{n}", String(instance.n));
  return (
    <>
      <Statement>
        <p>{text}</p>
      </Statement>
      <DistributionPractice d={d} k={instance.k} ask={instance.ask} identify={false} onSolved={onSolved} />
    </>
  );
}

const BinomialExercise = (props: ExerciseViewProps<ProbDistInstance>) => <DistExercise {...props} stories={BINOMIAL_STORIES} spec={binomialSpec} />;
const GeometricExercise = (props: ExerciseViewProps<ProbDistInstance>) => <DistExercise {...props} stories={GEOMETRIC_STORIES} spec={geometricSpec} />;

function GameExercise({ instance, onSolved }: ExerciseViewProps<ProbGameInstance>) {
  const rows = useMemo(() => gameInstanceRows(instance), [instance]);
  const die = loadedDieText(instance.odd, instance.even);
  return (
    <>
      <Statement>
        <p>{`Se tira ${die}. ${dieRuleText(instance.rule)} X es tu ganancia (negativa si pierdes).`}</p>
        <p className="font-semibold">{instance.ask.includes("varianza") ? "Rellena la tabla y calcula E[X] y Var(X)." : "Rellena la tabla y calcula la ganancia esperada E[X]."}</p>
      </Statement>
      <GamePractice rows={rows} askVariance={instance.ask.includes("varianza")} onSolved={onSolved} />
    </>
  );
}

const PenaltyExercise = ({ instance, onSolved }: ExerciseViewProps<ProbPenaltyInstance>) => (
  <PenaltyPractice options={instance.options} reward={qFrac(instance.reward)} target={qFrac(instance.target)} onSolved={onSolved} />
);

const ProductExercise = ({ instance, onSolved }: ExerciseViewProps<ProbProductInstance>) => (
  <ProductPractice x={{ n: instance.x.n, p: qFrac(instance.x.p) }} y={{ n: instance.y.n, p: qFrac(instance.y.p) }} lin={instance.lin} ask={instance.ask} onSolved={onSolved} />
);

const entry = <I,>(type: ExerciseType<I>, view: ComponentType<ExerciseViewProps<I>>): [string, View] => [type.id, view as View];

export const PROB_EXERCISE_VIEWS: Array<[string, View]> = [
  entry(PROB_TOTAL, TotalExercise),
  entry(PROB_DIE_COND, DieCondExercise),
  entry(PROB_INDEPENDENCE, IndependenceExercise),
  entry(PROB_BINOMIAL, BinomialExercise),
  entry(PROB_GEOMETRIC, GeometricExercise),
  entry(PROB_GAME, GameExercise),
  entry(PROB_PENALTY, PenaltyExercise),
  entry(PROB_PRODUCT, ProductExercise),
];
