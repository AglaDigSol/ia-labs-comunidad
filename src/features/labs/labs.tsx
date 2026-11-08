import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router";
import { LabsIntro } from "./LabsIntro.tsx";
import { LabTabs } from "./LabTabs.tsx";

/** Pestañas del área, en orden. «Ejercicios» (el banco de ejercicios de todos los temas) va la última. */
export const LABS: Array<{
  id: "simbolos" | "logica" | "predicados" | "conjuntos" | "combinatoria" | "markov" | "boole" | "algebra-lineal" | "calculo" | "probabilidad" | "ejercicios";
  path: string;
  label: "Simbología" | "Lógica" | "Predicados" | "Conjuntos" | "Combinatoria" | "Markov" | "Álgebra de Boole" | "Álgebra lineal" | "Cálculo" | "Probabilidad" | "Ejercicios";
}> = [
  { id: "simbolos", path: "simbolos", label: "Simbología" },
  { id: "logica", path: "logica", label: "Lógica" },
  { id: "predicados", path: "predicados", label: "Predicados" },
  { id: "conjuntos", path: "conjuntos", label: "Conjuntos" },
  { id: "combinatoria", path: "combinatoria", label: "Combinatoria" },
  { id: "boole", path: "boole", label: "Álgebra de Boole" },
  { id: "algebra-lineal", path: "algebra-lineal", label: "Álgebra lineal" },
  { id: "calculo", path: "calculo", label: "Cálculo" },
  { id: "probabilidad", path: "probabilidad", label: "Probabilidad" },
  { id: "markov", path: "markov", label: "Markov" },
  { id: "ejercicios", path: "ejercicios", label: "Ejercicios" },
];

/**
 * Pestaña opcional «Python» (Python en el navegador con Pyodide). Va después de «Ejercicios» y antes
 * de las pestañas del anfitrión. Está apagada por defecto: se enciende con <LabsRoutes python />.
 * Su id y su ruta («python») quedan reservados: con la pestaña encendida, una pestaña extra con ese
 * id o esa ruta se descarta.
 */
export const PYTHON_LAB = { id: "python", path: "python", label: "Python" } as const;

/** Pestaña adicional que una app anfitriona añade después de los laboratorios. */
export interface LabsExtraTab {
  /** Identificador único (no puede coincidir con simbolos, logica, predicados, conjuntos, combinatoria, boole, algebra-lineal, calculo, probabilidad, markov ni ejercicios). */
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
  /** Pestañas propias de la app anfitriona, en este orden, tras Simbología, Lógica, Predicados, Conjuntos, Combinatoria, Álgebra de Boole, Álgebra lineal, Cálculo, Probabilidad, Markov y Ejercicios (y Python, si está encendida). */
  extraTabs?: LabsExtraTab[];
  /**
   * Enciende la pestaña «Python» (por defecto, apagada). Apagada no hay pestaña ni ruta, y su código
   * no se descarga. La carpeta de Pyodide y los borradores se configuran con configureLabs({ python }).
   */
  python?: boolean;
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
const PredicatesLabPage = lazy(() =>
  import("./predicates/PredicatesLabPage.tsx").then((m) => ({ default: m.PredicatesLabPage })),
);
const MarkovLabPage = lazy(() => import("./markov/MarkovLabPage.tsx").then((m) => ({ default: m.MarkovLabPage })));
const SetsLabPage = lazy(() => import("./sets/SetsLabPage.tsx").then((m) => ({ default: m.SetsLabPage })));
const CombinatoricsLabPage = lazy(() =>
  import("./combinatorics/CombinatoricsLabPage.tsx").then((m) => ({ default: m.CombinatoricsLabPage })),
);
const BooleLabPage = lazy(() => import("./boole/BooleLabPage.tsx").then((m) => ({ default: m.BooleLabPage })));
const LinearAlgebraLabPage = lazy(() =>
  import("./linalg/LinearAlgebraLabPage.tsx").then((m) => ({ default: m.LinearAlgebraLabPage })),
);
const CalculusLabPage = lazy(() => import("./calculus/CalculusLabPage.tsx").then((m) => ({ default: m.CalculusLabPage })));
const ProbabilityLabPage = lazy(() =>
  import("./probability/ProbabilityLabPage.tsx").then((m) => ({ default: m.ProbabilityLabPage })),
);
const ExercisesPage = lazy(() => import("./exercises/ExercisesPage.tsx").then((m) => ({ default: m.ExercisesPage })));
const ExamSimulatorPage = lazy(() => import("./exam/ExamSimulatorPage.tsx").then((m) => ({ default: m.ExamSimulatorPage })));

// __LABS_PYTHON__ lo define vite.config.ts en la app independiente (LABS_PYTHON=1 o
// config.modules.python). Si vale false, este import desaparece del build: ni chunk ni worker. En una
// app anfitriona no está definido y el chunk existe, pero solo se descarga con la pestaña encendida.
declare const __LABS_PYTHON__: boolean | undefined;
const PythonLabPage = (typeof __LABS_PYTHON__ === "boolean" ? __LABS_PYTHON__ : true)
  ? lazy(() => import("./python/PythonLabPage.tsx").then((m) => ({ default: m.PythonLabPage })))
  : null;
// El simulacro de 01MIAR: dentro de la pestaña Python (…/python/simulacro), con el mismo interruptor.
const PyExamPage = (typeof __LABS_PYTHON__ === "boolean" ? __LABS_PYTHON__ : true)
  ? lazy(() => import("./pyexam/PyExamPage.tsx").then((m) => ({ default: m.PyExamPage })))
  : null;

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

const RESERVED = new Set<string>(LABS.flatMap((l) => [l.id, l.path]));
const RESERVED_WITH_PYTHON = new Set<string>([...RESERVED, PYTHON_LAB.id, PYTHON_LAB.path]);

export function LabsRoutes({ extraTabs = [], renderHeaderAction, basePath, python = false }: LabsRoutesProps = {}) {
  const { pathname } = useLocation();
  const base = useLabsBase(basePath);
  const withPython = python && PythonLabPage !== null;
  const reserved = withPython ? RESERVED_WITH_PYTHON : RESERVED;
  const extras = extraTabs
    .map((t) => ({ ...t, path: trimSlashes(t.path) }))
    .filter((t) => t.path !== "" && !reserved.has(t.id) && !reserved.has(t.path));
  const tabs: Tab[] = [
    ...LABS,
    ...(withPython ? [PYTHON_LAB] : []),
    ...extras.map(({ id, label, path }) => ({ id, label, path })),
  ];
  const hrefOf = (tab: Tab) => `${base}/${tab.path}`;
  const activeTab = tabs.find((tab) => isActive(pathname, hrefOf(tab))) ?? null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[14px] font-semibold text-muted">Laboratorios</p>
          {renderHeaderAction?.(activeTab ? { id: activeTab.id, label: activeTab.label } : null)}
        </div>
        <LabTabs tabs={tabs.map((tab) => ({ id: tab.id, label: tab.label, to: hrefOf(tab) }))} activeId={activeTab?.id ?? null} />
      </div>
      {/* La orientación no aparece dentro de un simulacro. */}
      {/\/simulacro\/?$/.test(pathname) ? null : <LabsIntro base={base} python={withPython} />}
      <Suspense fallback={<LabFallback />}>
        <Routes>
          <Route index element={<Navigate to="simbolos" replace />} />
          <Route path="simbolos" element={<SymbolsPage />} />
          <Route path="logica" element={<LogicLabPage />} />
          <Route path="predicados" element={<PredicatesLabPage />} />
          <Route path="conjuntos" element={<SetsLabPage />} />
          <Route path="combinatoria" element={<CombinatoricsLabPage />} />
          <Route path="markov" element={<MarkovLabPage />} />
          <Route path="boole" element={<BooleLabPage />} />
          <Route path="algebra-lineal" element={<LinearAlgebraLabPage />} />
          <Route path="calculo" element={<CalculusLabPage />} />
          <Route path="probabilidad" element={<ProbabilityLabPage />} />
          <Route path="ejercicios" element={<ExercisesPage python={withPython} />} />
          {/* El simulacro de examen va dentro de «Ejercicios» (sin pestaña propia). */}
          <Route path="ejercicios/simulacro" element={<ExamSimulatorPage />} />
          {withPython && PythonLabPage && <Route path={PYTHON_LAB.path} element={<PythonLabPage />} />}
          {/* El simulacro de 01MIAR va dentro de «Python» (sin pestaña propia). */}
          {withPython && PyExamPage && <Route path={`${PYTHON_LAB.path}/simulacro`} element={<PyExamPage />} />}
          {extras.map((t) => (
            <Route key={t.id} path={`${t.path}/*`} element={t.element} />
          ))}
          {/* Absoluta: una ruta relativa desde «*» se añadiría a la URL desconocida una y otra vez. */}
          <Route path="*" element={<Navigate to={`${base}/simbolos`} replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
