// Tabla única de asignaturas del máster: código, nombre largo, nombre corto y etiqueta de una palabra.
// La usan el calendario, las flashcards, la calculadora de notas, los simulacros y los laboratorios,
// y la exporta la entrada del paquete para que una app anfitriona no escriba los nombres a mano.
// Fuente: guías docentes del curso 2026-2027 (las mismas que citan content/calendario/2026-27.ts y
// content/courses/). tests/subjects.test.ts comprueba que el contenido usa estos nombres.

export interface Subject {
  /** Código de la asignatura en la VIU: «01MIAR». */
  code: string;
  /** Nombre largo, como en la guía docente. */
  name: string;
  /** Nombre corto, para textos y listas: «Python para la IA». */
  short: string;
  /** Una palabra, para chips y botones estrechos: «Python». */
  tag: string;
}

export const SUBJECTS = [
  { code: "01MIAR", name: "Python para la Inteligencia Artificial", short: "Python para la IA", tag: "Python" },
  { code: "02MIAR", name: "Matemáticas para la Inteligencia Artificial", short: "Matemáticas para la IA", tag: "Matemáticas" },
] as const satisfies readonly Subject[];

export type SubjectCode = (typeof SUBJECTS)[number]["code"];

/** La asignatura de un código, o null si la tabla no la conoce. */
export function subjectByCode(code: string): Subject | null {
  return SUBJECTS.find((s) => s.code === code) ?? null;
}

/** La asignatura de un código que la tabla conoce (para el código propio, no para datos de fuera). */
export function subject(code: SubjectCode): Subject {
  return SUBJECTS.find((s) => s.code === code)!;
}

/**
 * Texto de una asignatura: «02MIAR · Matemáticas para la IA» (short, por defecto), «02MIAR · Matemáticas
 * para la Inteligencia Artificial» (long) o «02MIAR · Matemáticas» (tag). Un código desconocido se
 * devuelve tal cual.
 */
export function subjectLabel(code: string, form: "short" | "long" | "tag" = "short"): string {
  const s = subjectByCode(code);
  if (!s) return code;
  return `${s.code} · ${form === "long" ? s.name : form === "tag" ? s.tag : s.short}`;
}
