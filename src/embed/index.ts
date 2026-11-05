// Entrada de la biblioteca: lo que una app anfitriona importa de "ia-labs-comunidad".
// La app independiente (src/main.tsx) no pasa por aquí. Cambiar algo de esta API de forma
// incompatible exige subir la versión menor (ver MAINTAINING.md).

// ---------------------------------------------------------------- Área de laboratorios y páginas
export {
  LABS,
  LabsRoutes,
  PYTHON_LAB,
  type LabsActiveTab,
  type LabsExtraTab,
  type LabsRoutesProps,
} from "../features/labs/labs.tsx";
export { SymbolsPage } from "../features/labs/symbols/SymbolsPage.tsx";
export { LogicLabPage } from "../features/labs/logic/LogicLabPage.tsx";
export { PredicatesLabPage } from "../features/labs/predicates/PredicatesLabPage.tsx";
export { SetsLabPage } from "../features/labs/sets/SetsLabPage.tsx";
export { CombinatoricsLabPage } from "../features/labs/combinatorics/CombinatoricsLabPage.tsx";
export { ExercisesPage, type ExercisesPageProps } from "../features/labs/exercises/ExercisesPage.tsx";
// Simulacro de examen (02MIAR). En LabsRoutes va en «ejercicios/simulacro»; montado aparte,
// `exercisesPath` dice dónde está el banco de ejercicios para «Practicar este tipo».
export {
  clockText,
  durationText,
  ExamSimulatorPage,
  INTEGRITY_EXAM_NOTE,
  type ExamSimulatorPageProps,
} from "../features/labs/exam/ExamSimulatorPage.tsx";
export { ExamBlocks } from "../features/labs/exam/ExamBlocks.tsx";
// Preguntas de opción múltiple (a–d, «Ninguna de las otras», varias correctas) y campo numérico neutro.
export {
  CHOICE_INSTRUCTIONS,
  ChoiceOptions,
  ChoicePractice,
  ChoiceSolution,
  OptionContent,
} from "../components/practice/ChoiceQuestion.tsx";
export { NumericField } from "../components/practice/NumericField.tsx";
export { MarkovLabPage } from "../features/labs/markov/MarkovLabPage.tsx";
export { BooleLabPage } from "../features/labs/boole/BooleLabPage.tsx";
export { LinearAlgebraLabPage } from "../features/labs/linalg/LinearAlgebraLabPage.tsx";
export { CalculusLabPage } from "../features/labs/calculus/CalculusLabPage.tsx";
export { ProbabilityLabPage } from "../features/labs/probability/ProbabilityLabPage.tsx";
// Pestaña Python (opcional): mejor con <LabsRoutes python />; PythonLabPage sirve para montarla
// en otra ruta. Pyodide (worker y runtime) solo se descarga al abrirla y pulsar «Cargar Python».
// Las ranuras (renderDraftActions, renderFilesActions) dan al anfitrión writeFiles para escribir
// archivos en la carpeta de trabajo de Python (en memoria; nunca se ejecutan solos).
export { PythonLabPage, type PythonLabPageProps } from "../features/labs/python/PythonLabPage.tsx";
export {
  createDraft,
  draftLabel,
  getDraft,
  listDrafts,
  MAX_DRAFT_CODE,
  MAX_DRAFTS,
  MAX_SOURCE_KIND,
  MAX_SOURCE_PATH,
  type Draft,
  type DraftOrigin,
  type DraftSource,
} from "../features/labs/python/drafts.ts";
export {
  CAP_FILE_BYTES,
  CAP_FILES,
  CAP_TOTAL_BYTES,
  DEFAULT_DRAFTS_KEY,
  fileLimits,
  MAX_FILE_BYTES,
  MAX_FILES,
  MAX_TOTAL_BYTES,
  type DraftActionsContext,
  type FileLimits,
  type FilesActionsContext,
  type PythonFilesApi,
  type PythonLabConfig,
  type SkippedFile,
  type WriteFilesResult,
} from "../features/labs/python/python-config.ts";
export { safeFilePath, type FileInfo } from "../features/labs/python/files.ts";
export { EXTRA_WHEELS, type CoreAsset, type ExtraWheel, type LockAsset } from "../features/labs/python/packages.ts";
export { PYODIDE_PYTHON, PYODIDE_VERSION } from "../features/labs/python/version.ts";
export { PYODIDE_CORE, PYODIDE_LOCK_SHA256, PYODIDE_PACKAGES } from "../features/labs/python/pyodide-manifest.ts";

// ---------------------------------------------------------------- Configuración y almacenamiento
export {
  configureLabs,
  createLocalStorageLabsAdapter,
  DEFAULT_LABS_KEYS,
  type LabsConfig,
  type LabsStorageKey,
} from "../features/labs/labs-storage.ts";
export { LocalStorageAdapter, MemoryAdapter, type StorageAdapter } from "../lib/storage-adapter.ts";

// ---------------------------------------------------------------- Motores (TypeScript puro)
export * from "../../shared/symbols/index.ts";
export * from "../../shared/symbols/search.ts";
export * from "../../shared/symbols/types.ts";
export * from "../../shared/symbols/schema.ts";

export * from "../../shared/logic/ast.ts";
export * from "../../shared/logic/parser.ts";
export * from "../../shared/logic/truth-table.ts";
export * from "../../shared/logic/canonical.ts";
export * from "../../shared/logic/compare.ts";
export * from "../../shared/logic/f1.ts";
export * from "../../shared/logic/notation.ts";

export * from "../../shared/sets/expr.ts";
export * from "../../shared/sets/laws.ts";
export * from "../../shared/sets/cardinal.ts";
export * from "../../shared/sets/finite.ts";
export * from "../../shared/sets/schema.ts";
export * from "../../shared/discrete/count.ts";
export * from "../../shared/discrete/answer.ts";
export * from "../../shared/discrete/bigo.ts";
export * from "../../shared/discrete/algorithms.ts";
export * from "../../shared/discrete/functions.ts";
export * from "../../shared/discrete/pnp.ts";
export * from "../../shared/discrete/schema.ts";

export * from "../../shared/exercises/types.ts";
export * from "../../shared/exercises/random.ts";
export * from "../../shared/exercises/logic.ts";
export * from "../../shared/exercises/predicates.ts";
export * from "../../shared/exercises/logic-extra.ts";
export { isNegation, NEGATION_DOMAINS, type NegationDraft, type NegationOption } from "../../shared/exercises/logic-extra-negation.ts";
export * from "../../shared/exercises/sets.ts";
export * from "../../shared/exercises/discrete.ts";
export * from "../../shared/exercises/boole.ts";
export * from "../../shared/exercises/linalg.ts";
export * from "../../shared/exercises/calculus.ts";
export * from "../../shared/exercises/probability.ts";
export * from "../../shared/exercises/registry.ts";
export * from "../../shared/exercises/choice.ts";

// Simulacro de examen: preguntas, plantillas, nota e intentos.
export * from "../../shared/exam/types.ts";
export * from "../../shared/exam/numeric.ts";
export * from "../../shared/exam/blocks.ts";
export * from "../../shared/exam/adapter.ts";
export * from "../../shared/exam/items.ts";
export * from "../../shared/exam/blueprint.ts";
export * from "../../shared/exam/grading.ts";
export * from "../../shared/exam/attempt.ts";
// Ejercicios de Python (solo se muestran con <LabsRoutes python /> o <ExercisesPage python />). Los
// conjuntos de datos sintéticos de los temas 8 a 13 se importan de "ia-labs-comunidad/shared/pydata/index.ts".
export {
  PYTHON_EXERCISES,
  PY_CODE_TYPES,
  PY_OUTPUT,
  PY_TEMAS,
  type PyCase,
  type PyCheck,
  type PyCheckKind,
  type PyCompareOptions,
  type PyCodeInstance,
  type PyInstance,
  type PyOutputInstance,
  type PyRule,
  type PyTema,
} from "../../shared/exercises/python.ts";

export * from "../../shared/markov/matrix.ts";
export * from "../../shared/markov/evolution.ts";
export * from "../../shared/markov/systems.ts";
export * from "../../shared/markov/validate.ts";

export * from "../../shared/boole/expr.ts";
export * from "../../shared/boole/algebra.ts";
export * from "../../shared/boole/laws.ts";
export * from "../../shared/boole/rewrite.ts";
export * from "../../shared/boole/minimize.ts";
export * from "../../shared/boole/presets.ts";
export * from "../../shared/boole/schema.ts";
export * from "../../shared/boole/circuit.ts";
export * from "../../shared/boole/fn.ts";
export * from "../../shared/boole/canonical.ts";
export * from "../../shared/boole/karnaugh.ts";

export * from "../../shared/linalg/matrix.ts";
export * from "../../shared/linalg/det.ts";
export * from "../../shared/linalg/rref.ts";
export * from "../../shared/linalg/systems.ts";
export * from "../../shared/linalg/spaces.ts";
export * from "../../shared/linalg/eigen.ts";
export * from "../../shared/linalg/transform2d.ts";
export * from "../../shared/linalg/tensors.ts";
export * from "../../shared/linalg/schema.ts";

// Cálculo: con nombres propios donde chocarían con la lógica o los racionales (toPlain, add…).
export {
  FUNCTIONS as CALC_FUNCTIONS,
  compile as calcCompile,
  decimalText,
  evaluate as calcEvaluate,
  exprVars as calcVars,
  hasD,
  toPlain as calcToPlain,
  toSpoken as calcToSpoken,
  toTex as calcToTex,
  type Env as CalcEnv,
  type Expr as CalcExpr,
  type FnName as CalcFnName,
  type VarName as CalcVarName,
} from "../../shared/calculus/expr.ts";
export {
  HOW_TO_WRITE_FUNCTION,
  MAX_EXPR_TEXT as MAX_CALC_TEXT,
  parseExpr as parseCalcExpr,
  type CalcParse,
  type CalcParseError,
} from "../../shared/calculus/parser.ts";
export { canonKey as calcCanonKey, simplify as calcSimplify, tidy as calcTidy } from "../../shared/calculus/simplify.ts";
export {
  derivative,
  derivativeRaw,
  derivativeTidy,
  expandD,
  gradient,
  hessian,
  resolveD,
  RULE_BY_ID as DERIVATIVE_RULE_BY_ID,
  RULES as DERIVATIVE_RULES,
  rulesFor,
  type RuleId as DerivativeRuleId,
} from "../../shared/calculus/derive.ts";
export {
  differByConstant,
  equivalent as calcEquivalent,
  isEquivalent as calcIsEquivalent,
  type Equivalence as CalcEquivalence,
} from "../../shared/calculus/equivalence.ts";
export {
  checkDerivStep,
  derivationSteps,
  nextRuleHints,
  pendingDerivatives,
  type SolutionStep as DerivSolutionStep,
  type StepCheck as DerivStepCheck,
  type StepRule as DerivStepRule,
} from "../../shared/calculus/steps.ts";
export {
  checkAntiderivative,
  definiteIntegral,
  numberMatches,
  parseNumberAnswer,
  RIEMANN_LABEL,
  riemannSum,
  simpson,
  stripConstant,
  type AntiderivativeCheck,
  type NumberAnswer,
  type Riemann,
  type RiemannRule,
} from "../../shared/calculus/integrals.ts";
export { antiderivative } from "../../shared/calculus/antiderivative.ts";
export {
  classifyHessian,
  CRITICAL_LABEL,
  criticalPoints,
  hessianAt,
  isCriticalPoint,
  type CriticalAnalysis,
  type CriticalKind,
  type Hessian2,
  type Point2,
} from "../../shared/calculus/critical.ts";
export {
  exactDescentSteps,
  iterationsTo,
  MAX_ITERATIONS as MAX_DESCENT_ITERATIONS,
  METHOD_LABEL as DESCENT_METHOD_LABEL,
  METHODS as DESCENT_METHODS,
  objective as descentObjective,
  oscillates,
  runDescent,
  type DescentOptions,
  type DescentRun,
  type DescentStatus,
  type Method as DescentMethod,
  type Objective as DescentObjective,
} from "../../shared/calculus/descent.ts";
export { exprToPoly, polyDerivative, polyEval2, polyToExpr, type Poly2 } from "../../shared/calculus/poly.ts";
export { contourLevels, contourSegments, gradientField, sampleCurve, sampleGrid } from "../../shared/calculus/plot.ts";
export * from "../../shared/calculus/schema.ts";

// Probabilidad (las fracciones exactas son las de rational.ts).
export * from "../../shared/probability/answer.ts";
export * from "../../shared/probability/events.ts";
export * from "../../shared/probability/conditional.ts";
export * from "../../shared/probability/distributions.ts";
export * from "../../shared/probability/variable.ts";
export * from "../../shared/probability/continuous.ts";
export * from "../../shared/probability/simulation.ts";
export * from "../../shared/probability/format.ts";
export * from "../../shared/probability/schema.ts";

export * from "../../shared/predicates/ast.ts";
export * from "../../shared/predicates/parser.ts";
export * from "../../shared/predicates/evaluate.ts";
export * from "../../shared/predicates/equivalence.ts";
export * from "../../shared/predicates/negation.ts";
export * from "../../shared/predicates/schema.ts";

export * from "../../shared/rational.ts";

export * from "../../shared/srs/sm2.ts";
export * from "../../shared/srs/decks.ts";
export * from "../../shared/srs/due.ts";
export * from "../../shared/srs/types.ts";

// ---------------------------------------------------------------- Contenido (CC BY 4.0)
export { SYMBOL_PACKS, type SymbolPack } from "../../content/symbols/index.ts";
export { NOTATION } from "../../content/notation/index.ts";
export { BOOLE_PACK } from "../../content/boole/practica.ts";
export { CIRCUIT_PACK } from "../../content/boole/circuitos.ts";
export { KARNAUGH_PACK } from "../../content/boole/karnaugh.ts";
export { PREDICADOS_PACK } from "../../content/predicados/practica.ts";
export { SETS_PACK } from "../../content/conjuntos/practica.ts";
export { COMB_PACK } from "../../content/combinatoria/practica.ts";
export { LINALG_PACK } from "../../content/algebra-lineal/practica.ts";
export { CALC_PACK } from "../../content/calculo/practica.ts";
export { PROB_PACK } from "../../content/probabilidad/practica.ts";
