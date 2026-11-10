// Configuración del sitio y registro de módulos (tipo plugin).
//
// 1) Interruptores: pon a false un módulo opcional para publicar el sitio sin él. Desaparece de la
//    navegación y de las rutas, y su código (un chunk perezoso) no se descarga nunca. Python es la
//    excepción: viene apagado y es una pestaña de Laboratorios, no un módulo de la navegación.
// 2) Registro: cada módulo declara su id, su ruta, su entrada de navegación, su componente perezoso y
//    el contenido de content/ que usa. Para añadir un módulo nuevo, añade una entrada a MODULES.
import { CalendarDays, Calculator, FlaskConical, Layers, Settings } from "lucide-react";
import { createElement, lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { LabsRoutesProps } from "./features/labs/labs.tsx";
import { t } from "./i18n/index.ts";

export const config = {
  modules: {
    /** Calendario de clases y entregas con zona horaria y .ics suscribible. */
    calendario: true,
    /** Flashcards con repaso espaciado SM-2 (barajas del diccionario y barajas propias). */
    flashcards: true,
    /** Calculadora de notas (mínimo 5,0 por bloque y menciones). */
    calculadora: true,
    /**
     * Pestaña «Python» de Laboratorios: Python 3.12 en el navegador con Pyodide. Apagada por defecto
     * porque publica unos 120 MB de paquetes en dist/pyodide/. Se enciende aquí (true) o, sin tocar el
     * código, construyendo con LABS_PYTHON=1 (y LABS_PYTHON=0 la apaga). Ver «Python (opcional)» en
     * el README.
     */
    python: false,
  },
} as const;

/** Módulos opcionales de la navegación (Python no lo es: es una pestaña de Laboratorios). */
export type OptionalModuleId = Exclude<keyof typeof config.modules, "python">;

// vite.config.ts lo define al construir: config.modules.python, salvo que LABS_PYTHON diga otra cosa.
declare const __LABS_PYTHON__: boolean | undefined;

/** ¿Lleva el sitio la pestaña Python? En las pruebas (sin build), lo que diga config.modules.python. */
/** Dirección de las guías de estudio (VITE_GUIDES_URL, en el build). Vacía: sin enlace. */
export const GUIDES_URL: string | undefined = import.meta.env.VITE_GUIDES_URL;

export const PYTHON_TAB: boolean = typeof __LABS_PYTHON__ === "boolean" ? __LABS_PYTHON__ : config.modules.python;

type Icon = ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean | "true"; className?: string }>;

export interface AppModule {
  id: "laboratorios" | OptionalModuleId | "ajustes";
  /** Ruta base (sin la base del sitio). Con «/*» si el módulo tiene subrutas. */
  path: string;
  nav: { label: string; short: string; icon: Icon; /** Activo solo en la ruta exacta. */ end: boolean };
  component: LazyExoticComponent<ComponentType>;
  /** Carpetas de content/ que usa (documentación para quien contribuye). */
  content: string[];
  /** Si es opcional, se activa o desactiva con config.modules. */
  optional: boolean;
}

const lazyNamed = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));

export const MODULES: AppModule[] = [
  {
    id: "laboratorios",
    path: "/laboratorios/*",
    nav: { label: t.nav.labs, short: t.nav.labsShort, icon: FlaskConical, end: false },
    component: lazy(() =>
      import("./features/labs/labs.tsx").then((m) => {
        const Labs = m.LabsRoutes as ComponentType<LabsRoutesProps>;
        return { default: () => createElement(Labs, { python: PYTHON_TAB, guidesUrl: GUIDES_URL }) };
      }),
    ),
    content: ["content/symbols", "content/notation"],
    optional: false,
  },
  {
    id: "calendario",
    path: "/calendario",
    nav: { label: t.nav.calendar, short: t.nav.calendarShort, icon: CalendarDays, end: true },
    component: lazyNamed(() => import("./features/calendar/CalendarPage.tsx"), "CalendarPage"),
    content: ["content/calendario"],
    optional: true,
  },
  {
    id: "flashcards",
    path: "/flashcards/*",
    nav: { label: t.nav.flashcards, short: t.nav.flashcardsShort, icon: Layers, end: false },
    component: lazyNamed(() => import("./features/cards/CardsRoutes.tsx"), "CardsRoutes"),
    content: ["content/symbols", "content/courses"],
    optional: true,
  },
  {
    id: "calculadora",
    path: "/notas",
    nav: { label: t.nav.grades, short: t.nav.gradesShort, icon: Calculator, end: true },
    component: lazyNamed(() => import("./features/grades/GradesPage.tsx"), "GradesPage"),
    content: ["content/courses"],
    optional: true,
  },
  {
    id: "ajustes",
    path: "/ajustes",
    nav: { label: t.nav.settings, short: t.nav.settingsShort, icon: Settings, end: true },
    component: lazyNamed(() => import("./features/settings/SettingsPage.tsx"), "SettingsPage"),
    content: [],
    optional: false,
  },
];

/** Módulos activos según los interruptores. */
export function activeModules(switches: Record<OptionalModuleId, boolean> = config.modules): AppModule[] {
  return MODULES.filter((m) => !m.optional || switches[m.id as OptionalModuleId]);
}

/** Ruta de navegación de un módulo: su path sin el sufijo «/*». */
export const navPath = (m: AppModule) => m.path.replace(/\/\*$/, "");

export const REPO_URL = "https://github.com/AglaDigSol/ia-labs-comunidad";
