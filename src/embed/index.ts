// Entrada de la biblioteca: lo que una app anfitriona importa de "ia-labs-comunidad".
// La app independiente (src/main.tsx) no pasa por aquí. Cambiar algo de esta API de forma
// incompatible exige subir la versión menor (ver MAINTAINING.md).

// ---------------------------------------------------------------- Área de laboratorios y páginas
export {
  LABS,
  LabsRoutes,
  type LabsActiveTab,
  type LabsExtraTab,
  type LabsRoutesProps,
} from "../features/labs/labs.tsx";
export { SymbolsPage } from "../features/labs/symbols/SymbolsPage.tsx";
export { LogicLabPage } from "../features/labs/logic/LogicLabPage.tsx";
export { MarkovLabPage } from "../features/labs/markov/MarkovLabPage.tsx";
export { BooleLabPage } from "../features/labs/boole/BooleLabPage.tsx";

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
