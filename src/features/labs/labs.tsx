import { lazy, Suspense } from "react";
import { Link, Navigate, Route, Routes, useMatch } from "react-router";
import { cn } from "../../lib/cn.ts";

export const LABS: Array<{
  id: "simbolos" | "logica" | "markov";
  path: string;
  label: "Simbología" | "Lógica" | "Markov";
}> = [
  { id: "simbolos", path: "simbolos", label: "Simbología" },
  { id: "logica", path: "logica", label: "Lógica" },
  { id: "markov", path: "markov", label: "Markov" },
];

const SymbolsPage = lazy(() => import("./symbols/SymbolsPage.tsx").then((m) => ({ default: m.SymbolsPage })));
const LogicLabPage = lazy(() => import("./logic/LogicLabPage.tsx").then((m) => ({ default: m.LogicLabPage })));
const MarkovLabPage = lazy(() => import("./markov/MarkovLabPage.tsx").then((m) => ({ default: m.MarkovLabPage })));

function LabFallback() {
  return <div aria-busy="true" className="min-h-[240px] animate-pulse rounded-md bg-sunken motion-reduce:animate-none" />;
}

function LabTab({ lab }: { lab: (typeof LABS)[number] }) {
  const to = `/laboratorios/${lab.path}`;
  const active = useMatch(`${to}/*`) !== null;
  return (
    <Link
      to={to}
      role="tab"
      aria-selected={active}
      className={cn(
        "flex min-h-11 items-center border-b-2 px-4 text-[14px]",
        active ? "border-accent font-semibold text-fg" : "border-transparent text-muted hover:text-fg",
      )}
    >
      {lab.label}
    </Link>
  );
}

export function LabsRoutes() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col">
        <p className="text-[14px] font-semibold text-muted">Laboratorios</p>
        <nav
          aria-label="Laboratorios"
          role="tablist"
          className="sticky top-12 z-20 flex gap-1 overflow-x-auto border-b border-border bg-base lg:static"
        >
          {LABS.map((lab) => (
            <LabTab key={lab.id} lab={lab} />
          ))}
        </nav>
      </div>
      <Suspense fallback={<LabFallback />}>
        <Routes>
          <Route index element={<Navigate to="simbolos" replace />} />
          <Route path="simbolos" element={<SymbolsPage />} />
          <Route path="logica" element={<LogicLabPage />} />
          <Route path="markov" element={<MarkovLabPage />} />
          <Route path="*" element={<Navigate to="simbolos" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
