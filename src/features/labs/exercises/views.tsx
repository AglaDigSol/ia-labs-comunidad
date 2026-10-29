// Vistas del banco de ejercicios: para cada tipo, el enunciado de la instancia generada, la práctica
// del laboratorio correspondiente (la misma que en su pestaña) y, cuando la práctica no la trae, la
// solución completa detrás de SolutionGate. Cada vista llama a onSolved cuando la práctica confirma
// una respuesta correcta. Para un tipo nuevo: un componente aquí y una entrada en EXERCISE_VIEWS.
import { useMemo, useState, type ComponentType } from "react";
import { booleVector, indexListText, vectorDontCares, vectorOnes } from "../../../../shared/boole/canonical.ts";
import { booleToPlain, booleToTex, parseBoole } from "../../../../shared/boole/expr.ts";
import { BOOLE_CANONICAL, BOOLE_KARNAUGH, BOOLE_SIMPLIFY, type BooleExprInstance, type BooleFunctionInstance, type BooleVectorInstance } from "../../../../shared/exercises/boole.ts";
import {
  LOGIC_CLASSIFY,
  LOGIC_EQUIVALENCE,
  LOGIC_NORMAL_FORMS,
  LOGIC_TRUTH_TABLE,
  type FormulaInstance,
  type PairInstance,
} from "../../../../shared/exercises/logic.ts";
import {
  PRED_EVALUATE,
  PRED_NEGATE,
  toPredInterpretation,
  type PredEvalInstance,
  type PredNegateInstance,
} from "../../../../shared/exercises/predicates.ts";
import {
  SETS_CARDINAL,
  SETS_EQUAL,
  SETS_PARTS,
  SETS_PROOF,
  SETS_VENN,
  type SetExprInstance,
  type SetPairInstance,
  type SetsCardinalInstance,
  type SetsPartsInstance,
} from "../../../../shared/exercises/sets.ts";
import type { ExerciseType } from "../../../../shared/exercises/types.ts";
import { collectVars, toPlain, toTex, type Node } from "../../../../shared/logic/ast.ts";
import { compareFormulas } from "../../../../shared/logic/compare.ts";
import { parseFormula } from "../../../../shared/logic/parser.ts";
import { buildTable, classify, type Table } from "../../../../shared/logic/truth-table.ts";
import { predToPlain, predToTex, type PredFormula } from "../../../../shared/predicates/ast.ts";
import { parsePredicate } from "../../../../shared/predicates/parser.ts";
import { parseSetExpr, setToPlain, setToTex, type SetExpr } from "../../../../shared/sets/expr.ts";
import type { SavedStep } from "../boole/boole-storage.ts";
import { NOTATION } from "../../../../content/notation/index.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { Tex } from "../../../lib/tex.tsx";
import { CanonicalPractice } from "../boole/CanonicalPractice.tsx";
import { KarnaughPractice } from "../boole/KarnaughPractice.tsx";
import { SimplifyDerivation } from "../boole/SimplifySection.tsx";
import { readLabItem } from "../labs-storage.ts";
import { ComparePractice } from "../logic/ComparePractice.tsx";
import { TruthPractice } from "../logic/TruthPractice.tsx";
import { TruthTable, type TruthFormat } from "../logic/TruthTable.tsx";
import { describeDomain } from "../predicates/common.tsx";
import { EvalPractice, type EvalMode } from "../predicates/EvalPractice.tsx";
import { EvalSolution } from "../predicates/EvaluateSection.tsx";
import { NegationPractice } from "../predicates/NegateSection.tsx";
import { CardinalProblem } from "../sets/CardinalSection.tsx";
import { EqualityQuestion, SetProof } from "../sets/LawsSection.tsx";
import { PartsPractice } from "../sets/PartsSection.tsx";
import { ShadePractice } from "../sets/VennSection.tsx";

export type ExerciseViewProps<I> = { instance: I; onSolved: () => void };
type View = ComponentType<ExerciseViewProps<unknown>>;

// Las instancias las genera el propio código (shared/exercises): si una no se lee, es un error de
// programación, no de la persona; los tests de validez lo cubren.
function logicOf(text: string): Node {
  const r = parseFormula(text);
  if (!r.ok) throw new Error(`ejercicio ilegible: ${text}`);
  return r.ast;
}
function tableOf(node: Node, order?: "false-first"): Table {
  const t = buildTable(node, order ? { order } : {});
  if (!t.ok) throw new Error("demasiadas variables");
  return t;
}
function predOf(text: string): PredFormula {
  const r = parsePredicate(text);
  if (!r.ok) throw new Error(`ejercicio ilegible: ${text}`);
  return r.formula;
}
function setOf(text: string): SetExpr {
  const r = parseSetExpr(text);
  if (!r.ok) throw new Error(`ejercicio ilegible: ${text}`);
  return r.expr;
}

/** Formato de las tablas de verdad: el que eligió la persona en el laboratorio de lógica. */
function truthFormat(): TruthFormat {
  const stored = readLabItem("logicFormat");
  return stored === "10" || stored === "VF" ? stored : NOTATION.truthValues;
}

function Statement({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">{children}</div>;
}

const VERDICT = { tautologia: "Tautología", contradiccion: "Contradicción", contingencia: "Contingencia" } as const;

// ---------------------------------------------------------------- Lógica

function TruthTableSolution({ table, formula, format }: { table: Table; formula: string; format: TruthFormat }) {
  const v = classify(table.rows);
  return (
    <div className="flex flex-col gap-3">
      <p>
        <Chip tone={v.kind === "tautologia" ? "ok" : v.kind === "contradiccion" ? "crit" : "warn"}>{VERDICT[v.kind]}</Chip>{" "}
        {`Verdadera en ${v.trueCount} de ${v.total} filas.`}
      </p>
      <TruthTable table={table} format={format} showSub caption={`Tabla de verdad de ${formula}: ${table.rows.length} filas`} />
    </div>
  );
}

function LogicTableExercise({ instance, onSolved, mode }: ExerciseViewProps<FormulaInstance> & { mode: "pasos" | "resultado" }) {
  const node = useMemo(() => logicOf(instance.formula), [instance.formula]);
  const table = useMemo(() => tableOf(node), [node]);
  const format = useMemo(truthFormat, []);
  const plain = toPlain(node);
  return (
    <>
      <Statement>
        <p className="text-[14px] text-muted">
          {mode === "pasos"
            ? "Construye la tabla de verdad de esta fórmula paso a paso y clasifícala."
            : "Rellena la columna del resultado y decide si es una tautología, una contradicción o una contingencia."}
        </p>
        <Tex display tex={toTex(node)} label={`Fórmula: ${plain}`} className="text-[20px]" />
      </Statement>
      <TruthPractice table={table} format={format} formula={plain} fixedMode={mode} onSolved={onSolved} />
      <SolutionGate resetKey={plain}>
        <TruthTableSolution table={table} formula={plain} format={format} />
      </SolutionGate>
    </>
  );
}

const TruthTableExercise = (p: ExerciseViewProps<FormulaInstance>) => <LogicTableExercise {...p} mode="pasos" />;
const ClassifyExercise = (p: ExerciseViewProps<FormulaInstance>) => <LogicTableExercise {...p} mode="resultado" />;

function EquivalenceExercise({ instance, onSolved }: ExerciseViewProps<PairInstance>) {
  const a = useMemo(() => logicOf(instance.a), [instance.a]);
  const b = useMemo(() => logicOf(instance.b), [instance.b]);
  const cmp = useMemo(() => compareFormulas(a, b), [a, b]);
  const format = useMemo(truthFormat, []);
  if (!cmp.ok) throw new Error("demasiadas variables");
  const key = `${instance.a}|${instance.b}`;
  return (
    <>
      <Statement>
        <p className="text-[14px] text-muted">¿Son equivalentes estas dos fórmulas? ¿En cuántas filas de la tabla difieren?</p>
        <Tex display tex={`A = ${toTex(a)}`} label={`Fórmula A: ${toPlain(a)}`} className="text-[18px]" />
        <Tex display tex={`B = ${toTex(b)}`} label={`Fórmula B: ${toPlain(b)}`} className="text-[18px]" />
      </Statement>
      <ComparePractice equivalent={cmp.equivalent} differing={cmp.differing} total={cmp.rows.length} resetKey={key} onSolved={onSolved} />
      <SolutionGate resetKey={key}>
        <div className="flex flex-col gap-3">
          <p>
            {cmp.equivalent ? (
              <Chip tone="ok">Equivalentes</Chip>
            ) : (
              <Chip tone="crit">{`No equivalentes: difieren en ${cmp.differing} ${cmp.differing === 1 ? "fila" : "filas"}`}</Chip>
            )}
          </p>
          <TruthTable compare={{ vars: cmp.vars, rows: cmp.rows }} format={format} caption={`Comparación de A y B: ${cmp.rows.length} filas`} />
        </div>
      </SolutionGate>
    </>
  );
}

function NormalFormsExercise({ instance, onSolved }: ExerciseViewProps<FormulaInstance>) {
  const node = useMemo(() => logicOf(instance.formula), [instance.formula]);
  const vars = useMemo(() => collectVars(node), [node]);
  // Vector en el orden de los índices: fila 0 = todas falsas, la primera variable es el bit alto.
  const vector = useMemo(() => tableOf(node, "false-first").rows.map((r) => (r.result ? "1" : "0")).join(""), [node]);
  return (
    <>
      <Statement>
        <p className="text-[14px] text-muted">{`Escribe la forma normal disyuntiva y la conjuntiva de esta fórmula, con las variables ${vars.join(", ")} en este orden.`}</p>
        <Tex display tex={`\\varphi = ${toTex(node)}`} label={`φ = ${toPlain(node)}`} className="text-[20px]" />
      </Statement>
      <CanonicalPractice vars={vars} vector={vector} notation="logica" onSolved={onSolved} />
    </>
  );
}

// ---------------------------------------------------------------- Predicados

function InterpretationView({ instance }: { instance: PredEvalInstance }) {
  const d = instance.domain;
  return (
    <div className="flex flex-col gap-2 text-[14px]">
      <p className="font-mono text-[16px]">{`D = ${describeDomain(d)}`}</p>
      {instance.predicates.map((p) =>
        p.arity === 1 ? (
          <p key={p.name} className="font-mono text-[16px]">{`${p.name} = ${describeDomain(p.extension.map((t) => t[0]!))}`}</p>
        ) : (
          <div key={p.name} className="max-w-full overflow-x-auto">
            <table className="border-collapse text-center font-mono">
              <caption className="pb-1 text-left font-body">{`${p.name}(x, y): marcada si se cumple (fila x, columna y)`}</caption>
              <thead>
                <tr>
                  <th scope="col" className="h-11 w-11 border border-border bg-sunken">
                    <span className="sr-only">x \ y</span>
                  </th>
                  {d.map((y) => (
                    <th key={y} scope="col" className="h-11 w-11 border border-border bg-sunken">
                      {y}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.map((x) => (
                  <tr key={x}>
                    <th scope="row" className="h-11 w-11 border border-border bg-sunken">
                      {x}
                    </th>
                    {d.map((y) => {
                      const on = p.extension.some((t) => t[0] === x && t[1] === y);
                      return (
                        <td key={y} className="h-11 w-11 border border-border">
                          <span aria-hidden="true">{on ? "●" : ""}</span>
                          <span className="sr-only">{`${p.name}(${x}, ${y}) ${on ? "se cumple" : "no se cumple"}`}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      )}
    </div>
  );
}

function PredEvaluateExercise({ instance, onSolved }: ExerciseViewProps<PredEvalInstance>) {
  const formula = useMemo(() => predOf(instance.formula), [instance.formula]);
  const interp = useMemo(() => toPredInterpretation(instance), [instance]);
  const [mode, setMode] = useState<EvalMode>("pasos");
  return (
    <>
      <Statement>
        <p className="text-[14px] text-muted">¿Es verdadero este enunciado en el dominio D con esta interpretación?</p>
        <Tex display tex={predToTex(formula)} label={`Fórmula: ${predToPlain(formula)}`} className="text-[20px]" />
        <InterpretationView instance={instance} />
      </Statement>
      <EvalPractice formula={formula} interp={interp} mode={mode} onMode={setMode} onSolved={onSolved} />
      <SolutionGate resetKey={instance.formula}>
        <EvalSolution formula={formula} interp={interp} />
      </SolutionGate>
    </>
  );
}

/** Dominio en el que se comprueba cada paso de la negación (todas las interpretaciones, o una muestra). */
const NEGATION_DOMAIN = { domain: ["1", "2", "3"], predicates: {} };

function PredNegateExercise({ instance, onSolved }: ExerciseViewProps<PredNegateInstance>) {
  const formula = useMemo(() => predOf(instance.formula), [instance.formula]);
  const start = useMemo<PredFormula>(() => ({ kind: "not", arg: formula }), [formula]);
  return (
    <>
      <Statement>
        <p className="text-[14px] text-muted">
          {`Niega esta fórmula llevando ¬ hacia dentro, una ley en cada línea, hasta que solo afecte a fórmulas atómicas. Cada paso se comprueba en D = ${describeDomain(NEGATION_DOMAIN.domain)} con todas las interpretaciones de los predicados (o una muestra amplia).`}
        </p>
        <Tex display tex={`\\lnot\\left(${predToTex(formula)}\\right)`} label={`Negación de ${predToPlain(formula)}`} className="text-[20px]" />
      </Statement>
      <NegationPractice start={start} interp={NEGATION_DOMAIN} onSolved={onSolved} />
    </>
  );
}

// ---------------------------------------------------------------- Conjuntos

function VennExercise({ instance, onSolved }: ExerciseViewProps<SetExprInstance>) {
  const expr = useMemo(() => setOf(instance.expr), [instance.expr]);
  return <ShadePractice expr={expr} onSolved={onSolved} />;
}

function SetsEqualExercise({ instance, onSolved }: ExerciseViewProps<SetPairInstance>) {
  const left = useMemo(() => setOf(instance.left), [instance.left]);
  const right = useMemo(() => setOf(instance.right), [instance.right]);
  return <EqualityQuestion left={left} right={right} onSolved={onSolved} />;
}

function SetsProofExercise({ instance, onSolved }: ExerciseViewProps<SetPairInstance>) {
  const left = useMemo(() => setOf(instance.left), [instance.left]);
  const right = useMemo(() => setOf(instance.right), [instance.right]);
  return (
    <>
      <Statement>
        <p className="text-[14px] text-muted">Demuestra la igualdad: parte del lado izquierdo y aplica una ley en cada paso hasta llegar al derecho.</p>
        <Tex display tex={`${setToTex(left)} = ${setToTex(right)}`} label={`${setToPlain(left)} = ${setToPlain(right)}`} className="text-[20px]" />
      </Statement>
      <SetProof start={left} target={right} onSolved={onSolved} />
    </>
  );
}

const SetsCardinalExercise = ({ instance, onSolved }: ExerciseViewProps<SetsCardinalInstance>) => (
  <CardinalProblem problem={instance} onSolved={onSolved} />
);

const SetsPartsExercise = ({ instance, onSolved }: ExerciseViewProps<SetsPartsInstance>) => (
  <PartsPractice mode={instance.mode} a={instance.a} b={instance.b} onSolved={onSolved} />
);

// ---------------------------------------------------------------- Boole

function BooleCanonicalExercise({ instance, onSolved }: ExerciseViewProps<BooleFunctionInstance>) {
  const expr = useMemo(() => {
    const r = parseBoole(instance.expr);
    if (!r.ok) throw new Error(`ejercicio ilegible: ${instance.expr}`);
    return r.expr;
  }, [instance.expr]);
  const vector = useMemo(() => booleVector(expr, instance.vars), [expr, instance.vars]);
  const f = `f(${instance.vars.join(", ")})`;
  return (
    <>
      <Statement>
        <p className="text-[14px] text-muted">{`Escribe Σm y ΠM de esta función (índices con ${instance.vars[0]} como bit más alto) y, si quieres, sus formas canónicas.`}</p>
        <Tex display tex={`${f} = ${booleToTex(expr)}`} label={`${f} = ${booleToPlain(expr)}`} className="text-[20px]" />
      </Statement>
      <CanonicalPractice vars={instance.vars} vector={vector} onSolved={onSolved} />
    </>
  );
}

function BooleKarnaughExercise({ instance, onSolved }: ExerciseViewProps<BooleVectorInstance>) {
  const { vars, vector } = instance;
  const text = `f(${vars.join(", ")}) = ${indexListText("sop", vectorOnes(vector), vectorDontCares(vector))}`;
  return (
    <>
      <Statement>
        <p className="text-[14px] text-muted">
          Agrupa en el mapa para obtener la suma de productos mínima (o, si lo prefieres, el producto de sumas mínimo).
        </p>
        <p className="font-mono text-[18px]">{text}</p>
      </Statement>
      <KarnaughPractice vars={vars} vector={vector} onSolved={onSolved} />
    </>
  );
}

function BooleSimplifyExercise({ instance, onSolved }: ExerciseViewProps<BooleExprInstance>) {
  const [steps, setSteps] = useState<SavedStep[]>([]);
  return (
    <>
      <Statement>
        <p className="text-[14px] text-muted">
          Simplifica la expresión: escribe cada paso y la ley que aplicas. Cuando no puedas quitar más literales, pulsa «He
          terminado».
        </p>
        <p className="font-mono text-[18px]">{instance.expr}</p>
      </Statement>
      <SimplifyDerivation start={instance.expr} steps={steps} onSteps={setSteps} onSolved={onSolved} />
    </>
  );
}

// ---------------------------------------------------------------- Registro de vistas

const entry = <I,>(type: ExerciseType<I>, view: ComponentType<ExerciseViewProps<I>>): [string, View] => [type.id, view as View];

export const EXERCISE_VIEWS: Readonly<Record<string, View>> = Object.fromEntries([
  entry(LOGIC_TRUTH_TABLE, TruthTableExercise),
  entry(LOGIC_CLASSIFY, ClassifyExercise),
  entry(LOGIC_EQUIVALENCE, EquivalenceExercise),
  entry(LOGIC_NORMAL_FORMS, NormalFormsExercise),
  entry(PRED_EVALUATE, PredEvaluateExercise),
  entry(PRED_NEGATE, PredNegateExercise),
  entry(SETS_VENN, VennExercise),
  entry(SETS_EQUAL, SetsEqualExercise),
  entry(SETS_PROOF, SetsProofExercise),
  entry(SETS_CARDINAL, SetsCardinalExercise),
  entry(SETS_PARTS, SetsPartsExercise),
  entry(BOOLE_CANONICAL, BooleCanonicalExercise),
  entry(BOOLE_KARNAUGH, BooleKarnaughExercise),
  entry(BOOLE_SIMPLIFY, BooleSimplifyExercise),
]);
