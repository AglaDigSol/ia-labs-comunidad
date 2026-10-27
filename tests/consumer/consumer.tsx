// Consumidor mínimo: importa solo desde la entrada del paquete. `npm run typecheck:consumer` lo
// compila con tests/consumer/tsconfig.json; si la API pública cambia, este fichero deja de compilar.
import { lazy } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import {
  ALL_SYMBOLS,
  BOOLE_PACK,
  BooleLabPage,
  checkAllAxioms,
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
  searchSymbols,
  SymbolsPage,
  USER_ID_RE,
  parseBoole,
  type AxiomResult,
  type BExpr,
  type CardView,
  type LawId,
  type LabsExtraTab,
  type StorageAdapter,
  type SymbolEntry,
} from "ia-labs-comunidad";

const storage: StorageAdapter = new MemoryAdapter();
configureLabs({ storage });
configureLabs({ storage: createLocalStorageLabsAdapter({ markov: "mi-app.markov" }) });
configureLabs({ storage: createLocalStorageLabsAdapter({ markov: "mi-app.markov", boole: "mi-app.boole" }) });

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
        <Route path="/simbolos" element={<SymbolsPage />} />
        <Route path="/logica" element={<LogicLabPage />} />
        <Route path="/markov" element={<MarkovLabPage />} />
        <Route path="/boole" element={<BooleLabPage />} />
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
