// Tipos del simulacro de 01MIAR («Python para la IA»): un examen como un cuaderno de Jupyter, con
// cuatro ejercicios cortos (1,25 puntos cada uno) y un proyecto de datos (5 puntos) en pasos A, B, C…
//
// Cada ejercicio corto y cada paso tiene su enunciado, la celda de la solución («Tu solución AQUÍ»), la
// celda «Test Use Case» con asserts a la vista (como en el examen real: se pueden ejecutar durante el
// intento) y las comprobaciones ocultas, que solo se ejecutan al entregar con el banco de pruebas de los
// ejercicios (harness.ts): comparan con la solución de referencia y nunca enseñan el valor esperado.
import type { PyCase, PyCodeInstance, PyCompareOptions, PyCheck } from "../exercises/python-common.ts";
import type { ExerciseLevel } from "../exercises/types.ts";

/** Familias de los ejercicios cortos (como las del examen). */
export const PYEXAM_FAMILIES = ["bug", "una-linea", "algoritmo", "generador", "nulos", "parsear", "numpy", "sistemas"] as const;
export type PyExamFamily = (typeof PYEXAM_FAMILIES)[number];

/** A qué tipo del banco de ejercicios lleva «Practicar este tipo» (con su nivel). */
export interface PyExamPractice {
  type: string;
  level: ExerciseLevel;
}

/** Un ejercicio corto: enunciado, celda inicial, celda de test visible y comprobación oculta. */
export interface PyExamShort {
  family: PyExamFamily;
  title: string;
  /** Párrafos del enunciado; lo que va entre `comillas invertidas` es código. */
  statement: string[];
  /** Contenido inicial de la celda de la solución (la cabecera, o el código con el error que hay que corregir). */
  starter: string;
  /** Celda «Test Use Case»: asserts a la vista, que se ejecutan en el mismo kernel que la solución. */
  test: string;
  /** Archivos de datos que usa el enunciado (nombre → CSV), en la carpeta del cuaderno. */
  files: Record<string, string>;
  /**
   * La comprobación oculta: la solución de referencia, los casos (con otros datos), los requisitos
   * del enunciado y los paquetes. Su `fn` es la función que se define.
   */
  check: PyCodeInstance;
  practice: PyExamPractice;
}

/** Una comprobación oculta de un paso del proyecto: el código que se evalúa y qué se mira. */
export interface PyExamStepCase {
  /** Código del caso (la última línea es la expresión que se compara, p. ej. «precios»). */
  code: string;
  /** Qué se comprueba, para los resultados: «La Series `precios` es la que pide el paso». */
  label: string;
  /** Si se compara el valor con el de la referencia (por defecto, sí). Los de gráficos solo llevan checks. */
  value?: boolean;
  options?: PyCompareOptions;
  checks?: PyCheck[];
}

/** Un paso (A, B, C…) del proyecto de datos. */
export interface PyExamStep {
  letter: string;
  title: string;
  /** Puntos del paso (en múltiplos de 0,25). */
  points: number;
  statement: string[];
  /** Lo que tiene que quedar definido al final del paso (variables, la figura…), para el enunciado. */
  artefacts: string[];
  /** Celda «Test Use Case» del paso. */
  test: string;
  /** La solución de referencia de este paso (se ejecuta tras la de los pasos anteriores). */
  solution: string;
  /** Comprobaciones ocultas. */
  cases: PyExamStepCase[];
  /** ¿Dibuja una figura? */
  plot: boolean;
  practice: PyExamPractice;
}

export type PyExamProjectKind = "ventas" | "incidencias";

export interface PyExamProject {
  kind: PyExamProjectKind;
  title: string;
  /** Presentación del proyecto (párrafos). */
  intro: string[];
  /** Archivos de datos (nombre → CSV), en la carpeta del cuaderno. */
  files: Record<string, string>;
  /** Celda de solo lectura con los import, como la primera celda del proyecto en el examen. */
  setup: string;
  steps: PyExamStep[];
  /** Paquetes que se cargan antes de corregir. */
  packages: string[];
}

export interface PyExam {
  seed: number;
  shorts: PyExamShort[];
  project: PyExamProject;
}

/** Puntos de cada ejercicio corto y del proyecto. */
export const PYEXAM_SHORT_POINTS = 1.25;
export const PYEXAM_PROJECT_POINTS = 5;
/** Duración del examen, en minutos (como el final, con proctoring). */
export const PYEXAM_MINUTES = 120;

/** Un caso oculto ya listo para el banco de pruebas (para los pasos, con valor o solo comprobaciones). */
export const stepCaseToPyCase = (c: PyExamStepCase): PyCase => {
  const out: PyCase = { code: c.code, compare: c.value === false ? [] : ["valor"] };
  if (c.options) out.options = c.options;
  if (c.checks?.length) out.checks = c.checks;
  return out;
};
