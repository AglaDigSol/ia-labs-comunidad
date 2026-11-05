// Nota del simulacro de 01MIAR a partir de lo que dicen las comprobaciones ocultas.
//
// Reglas (las mismas que se explican en la página):
// - Ejercicio corto (1,25 puntos): proporcional a los casos ocultos correctos. Si no se cumple algún
//   requisito del enunciado (en una línea, generador, sin bucles, sin bibliotecas…), la mitad. Se
//   redondea a 0,25, como redondearía quien corrige.
// - Paso del proyecto: proporcional a sus comprobaciones (cada valor comparado cuenta una y cada
//   comprobación con nombre, como «la figura mide 12 × 4», otra), redondeado a 0,25. Un error que
//   viene de un paso anterior no se paga dos veces: el paso se corrige también con la solución de
//   referencia de los pasos anteriores y su propio código, y vale la mejor de las dos notas.
// - Nota final: la suma (sobre 10), con dos decimales.
import type { PyExam, PyExamShort, PyExamStep } from "./types.ts";
import { PYEXAM_SHORT_POINTS } from "./types.ts";

/** Redondea a 0,25 (al más cercano). */
export const roundQuarter = (x: number): number => Math.round(x * 4 + 1e-9) / 4;

/** Lo que dicen las pruebas ocultas de un ejercicio corto (null: no se pudo corregir, o error de sintaxis). */
export interface PyExamShortOutcome {
  cases: boolean[];
  rules: boolean[];
}

/** Puntos de un ejercicio corto. */
export function scoreShort(o: PyExamShortOutcome | null, max = PYEXAM_SHORT_POINTS): number {
  if (!o || o.cases.length === 0) return 0;
  const ok = o.cases.filter(Boolean).length / o.cases.length;
  const factor = o.rules.every(Boolean) ? 1 : 0.5;
  return roundQuarter(max * ok * factor);
}

/** Puntos de un paso: proporcional a sus comprobaciones correctas. */
export function scoreStep(points: number, units: readonly boolean[]): number {
  if (units.length === 0) return 0;
  return roundQuarter((points * units.filter(Boolean).length) / units.length);
}

/** Lo que se comprueba en cada unidad de un ejercicio corto: los casos ocultos y después los requisitos. */
export function shortUnitLabels(s: PyExamShort): string[] {
  return [...s.check.cases.map((_, i) => `Prueba oculta ${i + 1}`), ...(s.check.rules ?? []).map((r) => `Requisito: ${r.label}`)];
}

/** Lo que se comprueba en cada unidad de un paso: cada valor comparado y cada comprobación con nombre. */
export function stepUnitLabels(st: PyExamStep): string[] {
  return st.cases.flatMap((c) => [...(c.value === false ? [] : [c.label]), ...(c.checks ?? []).map((k) => k.label)]);
}

/** Etiquetas de las unidades de cada parte (cortos y pasos). */
export const pyExamUnitLabels = (exam: PyExam): string[][] => [...exam.shorts.map(shortUnitLabels), ...exam.project.steps.map(stepUnitLabels)];

/** Puntos máximos de cada parte. */
export const pyExamPartPoints = (exam: PyExam): number[] => [...exam.shorts.map(() => PYEXAM_SHORT_POINTS), ...exam.project.steps.map((s) => s.points)];

/** La nota (sobre 10, con dos decimales) a partir de los puntos de cada parte. */
export const pyExamTotal = (points: readonly number[]): number => Math.round(points.reduce((a, b) => a + b, 0) * 100) / 100;

/** Unidades fallidas (índices) de una lista de resultados. */
export const failedUnits = (units: readonly boolean[]): number[] => units.flatMap((ok, i) => (ok ? [] : [i]));

/** Unidades de un ejercicio corto, en el orden de shortUnitLabels (sin resultado: todas fallidas). */
export function shortUnits(s: PyExamShort, o: PyExamShortOutcome | null): boolean[] {
  const n = s.check.cases.length;
  const r = (s.check.rules ?? []).length;
  if (!o) return Array.from({ length: n + r }, () => false);
  return [...Array.from({ length: n }, (_, i) => o.cases[i] === true), ...Array.from({ length: r }, (_, i) => o.rules[i] === true)];
}
