import { lazy, Suspense, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation, useParams } from "react-router";
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

/** Pestaña adicional que una app anfitriona añade después de los tres laboratorios. */
export interface LabsExtraTab {
  /** Identificador único (no puede coincidir con simbolos, logica ni markov). */
  id: string;
  /** Texto de la pestaña. */
  label: string;
  /** Ruta relativa a la del área de laboratorios, sin barra inicial (por ejemplo, "python"). */
  path: string;
  /** Lo que se muestra en esa ruta. Puede ser un componente perezoso: hay un Suspense alrededor. */
  element: ReactNode;
}

/** Pestaña activa, para quien pinta una acción en la cabecera. */
export type LabsActiveTab = { id: string; label: string };

export interface LabsRoutesProps {
  /** Pestañas propias de la app anfitriona, en este orden, tras Simbología, Lógica y Markov. */
  extraTabs?: LabsExtraTab[];
  /** Acción opcional a la derecha del título «Laboratorios» (recibe la pestaña activa o null). */
  renderHeaderAction?: (active: LabsActiveTab | null) => ReactNode;
  /**
   * Ruta donde está montada el área, por ejemplo "/laboratorios". Normalmente no hace falta: se deduce
   * de la ruta padre con comodín (<Route path="/laboratorios/*" />).
   */
  basePath?: string;
}

const SymbolsPage = lazy(() => import("./symbols/SymbolsPage.tsx").then((m) => ({ default: m.SymbolsPage })));
const LogicLabPage = lazy(() => import("./logic/LogicLabPage.tsx").then((m) => ({ default: m.LogicLabPage })));
const MarkovLabPage = lazy(() => import("./markov/MarkovLabPage.tsx").then((m) => ({ default: m.MarkovLabPage })));

function LabFallback() {
  return <div aria-busy="true" className="min-h-[240px] animate-pulse rounded-md bg-sunken motion-reduce:animate-none" />;
}

type Tab = { id: string; path: string; label: string };

const trimSlashes = (p: string) => p.replace(/^\/+|\/+$/g, "");

/**
 * Ruta donde está montada el área (por ejemplo, "/laboratorios"). Se deduce de la ruta padre con
 * comodín ("/laboratorios/*"): la URL actual menos lo que captura el comodín.
 */
function useLabsBase(basePath: string | undefined): string {
  const { pathname } = useLocation();
  const splat = useParams()["*"];
  if (basePath !== undefined) return `/${trimSlashes(basePath)}`.replace(/^\/$/, "");
  if (splat === undefined) return "/laboratorios";
  const base = splat === "" ? pathname : pathname.slice(0, pathname.length - splat.length);
  return base.replace(/\/+$/, "");
}

const isActive = (pathname: string, to: string) => pathname === to || pathname.startsWith(`${to}/`);

function LabTab({ tab, to, active }: { tab: Tab; to: string; active: boolean }) {
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
      {tab.label}
    </Link>
  );
}

const RESERVED = new Set<string>(LABS.flatMap((l) => [l.id, l.path]));

export function LabsRoutes({ extraTabs = [], renderHeaderAction, basePath }: LabsRoutesProps = {}) {
  const { pathname } = useLocation();
  const base = useLabsBase(basePath);
  const extras = extraTabs
    .map((t) => ({ ...t, path: trimSlashes(t.path) }))
    .filter((t) => t.path !== "" && !RESERVED.has(t.id) && !RESERVED.has(t.path));
  const tabs: Tab[] = [...LABS, ...extras.map(({ id, label, path }) => ({ id, label, path }))];
  const hrefOf = (tab: Tab) => `${base}/${tab.path}`;
  const activeTab = tabs.find((tab) => isActive(pathname, hrefOf(tab))) ?? null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[14px] font-semibold text-muted">Laboratorios</p>
          {renderHeaderAction?.(activeTab ? { id: activeTab.id, label: activeTab.label } : null)}
        </div>
        <nav
          aria-label="Laboratorios"
          role="tablist"
          className="sticky top-12 z-20 flex gap-1 overflow-x-auto border-b border-border bg-base lg:static"
        >
          {tabs.map((tab) => (
            <LabTab key={tab.id} tab={tab} to={hrefOf(tab)} active={tab === activeTab} />
          ))}
        </nav>
      </div>
      <Suspense fallback={<LabFallback />}>
        <Routes>
          <Route index element={<Navigate to="simbolos" replace />} />
          <Route path="simbolos" element={<SymbolsPage />} />
          <Route path="logica" element={<LogicLabPage />} />
          <Route path="markov" element={<MarkovLabPage />} />
          {extras.map((t) => (
            <Route key={t.id} path={`${t.path}/*`} element={t.element} />
          ))}
          <Route path="*" element={<Navigate to="simbolos" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
