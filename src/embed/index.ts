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
export { ExercisesPage } from "../features/labs/exercises/ExercisesPage.tsx";
export { MarkovLabPage } from "../features/labs/markov/MarkovLabPage.tsx";
export { BooleLabPage } from "../features/labs/boole/BooleLabPage.tsx";
export { LinearAlgebraLabPage } from "../features/labs/linalg/LinearAlgebraLabPage.tsx";
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

export * from "../../shared/exercises/types.ts";
export * from "../../shared/exercises/random.ts";
export * from "../../shared/exercises/logic.ts";
export * from "../../shared/exercises/predicates.ts";
export * from "../../shared/exercises/sets.ts";
export * from "../../shared/exercises/boole.ts";
export * from "../../shared/exercises/linalg.ts";
export * from "../../shared/exercises/registry.ts";

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
export { LINALG_PACK } from "../../content/algebra-lineal/practica.ts";
