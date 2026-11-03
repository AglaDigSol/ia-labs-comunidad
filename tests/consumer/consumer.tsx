// Consumidor mínimo: importa solo desde la entrada del paquete. `npm run typecheck:consumer` lo
// compila con tests/consumer/tsconfig.json; si la API pública cambia, este fichero deja de compilar.
import { lazy } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import {
  ALL_SYMBOLS,
  BOOLE_PACK,
  BooleLabPage,
  CalculusLabPage,
  CALC_PACK,
  CALC_DESCENT,
  calcToPlain,
  checkDerivStep,
  criticalPoints,
  derivativeTidy,
  descentObjective,
  parseCalcExpr,
  runDescent,
  type CalcDescentInstance,
  type CalcExpr,
  type CriticalKind,
  type DerivStepRule,
  LinearAlgebraLabPage,
  LINALG_PACK,
  LINALG_EIGEN,
  analyzeSystem,
  broadcastShapes,
  checkTypedStep,
  isEigenpair,
  matrixRank,
  parseMatrix,
  type LinSystemInstance,
  type Matrix,
  type RowOp,
  type TensorOp,
  SetsLabPage,
  CombinatoricsLabPage,
  COMB_PACK,
  COMB_COMPLEXITY,
  countModel,
  parseExamNumber,
  type CombComplexityInstance,
  type CountingModel,
  type FormulaId,
  SETS_PACK,
  ExercisesPage,
  EXERCISE_TYPES,
  PYTHON_EXERCISES,
  LOGIC_TRUTH_TABLE,
  exerciseType,
  seedFromText,
  seedToText,
  type ExerciseLevel,
  type ExerciseType,
  type FormulaInstance,
  checkSetStep,
  parseSetExpr,
  solveRegions,
  type SetExpr,
  type SetLawId,
  CIRCUIT_PACK,
  checkAllAxioms,
  circuitFromExpression,
  circuitsEquivalent,
  fnStructure,
  listFn,
  toNand,
  checkStep,
  divisors,
  LAWS,
  configureLabs,
  createLocalStorageLabsAdapter,
  dueSummary,
  LabsRoutes,
  LogicLabPage,
  MarkovLabPage,
  MemoryAdapter,
  NOTATION,
  PREDICADOS_PACK,
  PredicatesLabPage,
  evaluatePred,
  parsePredicate,
  pushNegation,
  type PredFormula,
  type PredInterpretation,
  searchSymbols,
  SymbolsPage,
  USER_ID_RE,
  parseBoole,
  KARNAUGH_PACK,
  kmapLayout,
  canonicalSum,
  type KMapMode,
  type AxiomResult,
  type BExpr,
  type CardView,
  type LawId,
  type Netlist,
  type TruthVector,
  type LabsExtraTab,
  type StorageAdapter,
  type SymbolEntry,
  createDraft,
  DEFAULT_DRAFTS_KEY,
  PYODIDE_CORE,
  PYODIDE_PACKAGES,
  PYODIDE_VERSION,
  PYTHON_LAB,
  PythonLabPage,
  fileLimits,
  MAX_FILE_BYTES,
  MAX_FILES,
  MAX_TOTAL_BYTES,
  safeFilePath,
  type DraftActionsContext,
  type DraftOrigin,
  type FileInfo,
  type FileLimits,
  type PythonLabConfig,
  type WriteFilesResult,
} from "ia-labs-comunidad";

const storage: StorageAdapter = new MemoryAdapter();
configureLabs({ storage });
configureLabs({ storage: createLocalStorageLabsAdapter({ markov: "mi-app.markov" }) });
configureLabs({ storage: createLocalStorageLabsAdapter({ markov: "mi-app.markov", boole: "mi-app.boole" }) });
// Pestaña Python servida por el anfitrión: su carpeta de Pyodide, su clave de borradores y su aislamiento.
const python: PythonLabConfig = { assetBaseUrl: `/pyodide/${PYODIDE_VERSION}/`, draftsKey: "mi-app.py.drafts", crossOriginIsolated: false };
configureLabs({ storage, python });
const origin: DraftOrigin = { kind: "cell", notebookTitle: "Cuaderno", cell: 3, source: { kind: "repo", path: "notebooks/cuaderno.ipynb" } };
// Ranura en la banda del borrador: escribe los datos del cuaderno en la carpeta de trabajo de Python.
async function writeData(ctx: DraftActionsContext): Promise<WriteFilesResult> {
  const data = new TextEncoder().encode("x,y\n1,2\n").buffer;
  const from: string | undefined = ctx.draft.origin.source?.path;
  const path = safeFilePath("res/data.csv");
  return ctx.files.writeFiles(path && from ? [{ path, data }] : []);
}
configureLabs({
  storage,
  python: {
    ...python,
    maxTotalBytes: 120 * 1024 * 1024,
    renderDraftActions: (ctx) => (
      <button type="button" onClick={() => void writeData(ctx)}>
        Cargar datos ({ctx.files.list().length} de {ctx.files.limits.maxFiles})
      </button>
    ),
    renderFilesActions: ({ draft }) => (draft ? null : <span>Sin borrador</span>),
  },
});
export const limits: FileLimits = fileLimits();
export const defaults: number[] = [MAX_FILE_BYTES, MAX_TOTAL_BYTES, MAX_FILES];
export const listed = (files: FileInfo[]) => files.map((f) => f.name);
export const draftUrl = `/laboratorios/${PYTHON_LAB.path}?borrador=${createDraft({ origin, code: "print(1)" })}`;
export const defaultDraftsKey: string = DEFAULT_DRAFTS_KEY;
export const pyodideFiles: string[] = [...PYODIDE_CORE, ...PYODIDE_PACKAGES].map((f) => f.file);

const Playground = lazy(async () => ({ default: () => <p>Python</p> }));
const extra: LabsExtraTab[] = [{ id: "python", label: "Python", path: "python", element: <Playground /> }];

export function HostApp() {
  return (
    <MemoryRouter>
      <Routes>
        <Route
          path="/laboratorios/*"
          element={<LabsRoutes extraTabs={extra} renderHeaderAction={(tab) => (tab ? <span>{tab.label}</span> : null)} />}
        />
        <Route path="/estudio/*" element={<LabsRoutes python />} />
        <Route path="/python" element={<PythonLabPage />} />
        <Route path="/python-propio" element={<PythonLabPage renderDraftActions={({ draft }) => <span>{draft.label}</span>} />} />
        <Route path="/simbolos" element={<SymbolsPage />} />
        <Route path="/logica" element={<LogicLabPage />} />
        <Route path="/predicados" element={<PredicatesLabPage />} />
        <Route path="/markov" element={<MarkovLabPage />} />
        <Route path="/boole" element={<BooleLabPage />} />
        <Route path="/conjuntos" element={<SetsLabPage />} />
        <Route path="/combinatoria" element={<CombinatoricsLabPage />} />
        <Route path="/algebra-lineal" element={<LinearAlgebraLabPage />} />
        <Route path="/calculo" element={<CalculusLabPage />} />
        <Route path="/ejercicios" element={<ExercisesPage />} />
        <Route path="/ejercicios-python" element={<ExercisesPage python />} />
      </Routes>
    </MemoryRouter>
  );
}

const first: SymbolEntry | undefined = ALL_SYMBOLS[0];
export const found: SymbolEntry[] = searchSymbols(ALL_SYMBOLS, first?.name ?? "");
export const truth: "10" | "VF" = NOTATION.truthValues;
export const idOk: boolean = USER_ID_RE.test("abc123defg");
export const empty = (cards: CardView[]) => dueSummary(cards, "2026-10-27", 20).total;
export const axioms: AxiomResult[] = checkAllAxioms(divisors(30));
export const firstLaw: LawId | undefined = LAWS[0]?.id;
const parsed = parseBoole(BOOLE_PACK.practice[0]?.expr ?? "x");
export const start: BExpr | null = parsed.ok ? parsed.expr : null;
export const step = start ? checkStep(start, start, "B1") : null;
export const nand: Netlist = toNand(CIRCUIT_PACK.circuits[0]!);
export const sameNand: boolean = circuitsEquivalent(CIRCUIT_PACK.circuits[0]!, nand);
export const built: Netlist | null = start ? circuitFromExpression(start) : null;
export const f2Size: number = fnStructure(2).elements.length;
export const vectors: TruthVector[] = listFn(2).map((f) => f.vector);
export const kmapMode: KMapMode = "pos";
export const kmapRows: number = kmapLayout(["w", "x", "y", "z"]).rowCodes.length;
export const sigma: BExpr = canonicalSum(["x", "y"], [1, 2]);
export const kmapExercises: number = KARNAUGH_PACK.exercises.length;
const pred = parsePredicate(PREDICADOS_PACK.negation[0]?.formula ?? "∀x P(x)");
export const predFormula: PredFormula | null = pred.ok ? pred.formula : null;
const numbers: PredInterpretation = { domain: ["1", "2"], predicates: { P: [["2"]] } };
export const someEven: boolean = predFormula ? evaluatePred({ kind: "exists", variable: "x", body: { kind: "pred", name: "P", args: [{ name: "x" }] } }, numbers) : false;
export const negSteps: number = predFormula ? pushNegation({ kind: "not", arg: predFormula }).length : 0;
const setParsed = parseSetExpr(SETS_PACK.venn[0]?.expr ?? "A");
export const setExpr: SetExpr | null = setParsed.ok ? setParsed.expr : null;
const setLaw: SetLawId = "demorgan";
export const setStep = setExpr ? checkSetStep(setExpr, setExpr, setLaw) : null;
export const noRegions = solveRegions(["A", "B"], []).ok;
const level: ExerciseLevel = "medio";
const tableType: ExerciseType<FormulaInstance> = LOGIC_TRUTH_TABLE;
export const generated: string = tableType.generate(seedFromText(seedToText(42)) ?? 0, level).formula;
export const exerciseIds: string[] = EXERCISE_TYPES.map((t) => t.id);
export const knownType: boolean = exerciseType("conjuntos-venn") !== null;
export const pythonType: boolean = exerciseType("py-que-imprime", { python: true }) !== null;
export const pythonIds: string[] = PYTHON_EXERCISES.map((t) => t.id);
const linParsed = parseMatrix(LINALG_PACK.systems[0]?.matrix ?? "1 1");
export const linMatrix: Matrix | null = linParsed.ok ? linParsed.value : null;
export const linRank: number = linMatrix ? matrixRank(linMatrix) : 0;
export const linKind = linMatrix ? analyzeSystem(linMatrix.map((r) => r.slice(0, -1)), linMatrix.map((r) => r[r.length - 1]!)).kind : null;
const swap: RowOp = { k: "swap", i: 0, j: 1 };
export const firstOp: RowOp = swap;
export const sameStep = linMatrix ? checkTypedStep(linMatrix, linMatrix).kind : null;
export const eigenOk: boolean = isEigenpair([[{ n: 2n, d: 1n }]], [{ n: 1n, d: 1n }], { n: 2n, d: 1n });
export const eigenMatrix: number[][] = LINALG_EIGEN.generate(1, "medio").matrix;
const shapes: TensorOp = { op: "matmul", a: [2, 3], b: [3] };
export const broadcastOk: boolean = broadcastShapes(shapes.a, [1]).ok;
export const gaussInstance = (i: LinSystemInstance) => i.unknowns;
const calcParsed = parseCalcExpr(CALC_PACK.derivatives[0]?.f ?? "x^2");
export const calcF: CalcExpr | null = calcParsed.ok ? calcParsed.expr : null;
export const calcDerivative: string = calcF ? calcToPlain(derivativeTidy(calcF)) : "";
const productRule: DerivStepRule = "producto";
export const stepOk: boolean = calcF ? checkDerivStep(calcF, { k: "d", a: calcF, v: "x" }, derivativeTidy(calcF), productRule).ok : false;
const saddle = parseCalcExpr("x^2 - y^2", { vars: ["x", "y"] });
const saddleAnalysis = saddle.ok ? criticalPoints(saddle.expr) : null;
export const saddleKind: CriticalKind | null = saddleAnalysis?.ok ? (saddleAnalysis.points[0]?.kind ?? null) : null;
export const descentEnd: number[] | undefined = calcF ? runDescent(descentObjective(calcF), { alpha: 0.01, start: [1], iterations: 10 }).points.at(-1) : undefined;
export const descentInstance: CalcDescentInstance = CALC_DESCENT.generate(1, "básico");
const combModel: CountingModel = COMB_PACK.problems[0]?.model ?? { n: 3, k: 3, order: true, repetition: false };
export const combCount: bigint = countModel(combModel);
export const combFormula: FormulaId = "CR";
export const examNumberOk: boolean = parseExamNumber("12870").ok;
export const complexityInstance: CombComplexityInstance = COMB_COMPLEXITY.generate(1, "medio");
