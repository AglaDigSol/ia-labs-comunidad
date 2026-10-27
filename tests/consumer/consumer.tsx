// Consumidor mínimo: importa solo desde la entrada del paquete. `npm run typecheck:consumer` lo
// compila con tests/consumer/tsconfig.json; si la API pública cambia, este fichero deja de compilar.
import { lazy } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import {
  ALL_SYMBOLS,
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
  type CardView,
  type LabsExtraTab,
  type StorageAdapter,
  type SymbolEntry,
} from "ia-labs-comunidad";

const storage: StorageAdapter = new MemoryAdapter();
configureLabs({ storage });
configureLabs({ storage: createLocalStorageLabsAdapter({ markov: "mi-app.markov" }) });

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
      </Routes>
    </MemoryRouter>
  );
}

const first: SymbolEntry | undefined = ALL_SYMBOLS[0];
export const found: SymbolEntry[] = searchSymbols(ALL_SYMBOLS, first?.name ?? "");
export const truth: "10" | "VF" = NOTATION.truthValues;
export const idOk: boolean = USER_ID_RE.test("abc123defg");
export const empty = (cards: CardView[]) => dueSummary(cards, "2026-10-27", 20).total;
