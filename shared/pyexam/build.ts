// Generación del simulacro de 01MIAR: con una semilla, siempre el mismo examen. Cuatro ejercicios
// cortos de familias distintas (uno de Python sin bibliotecas, uno de datos con pandas, uno de NumPy y
// otro cualquiera de los que quedan; nivel medio o avanzado) y el proyecto de datos, que se alterna con
// la semilla (ventas o incidencias).
import { rngFor } from "../exercises/random.ts";
import { buildPyExamProject } from "./project.ts";
import { PYEXAM_FAMILY_GROUPS, PYEXAM_LEVELS, PYEXAM_SHORT_MAKERS } from "./short.ts";
import { PYEXAM_FAMILIES, PYEXAM_SHORT_POINTS, type PyExam, type PyExamFamily } from "./types.ts";

/** Las cuatro familias de una semilla, en el orden de PYEXAM_FAMILIES. */
export function pyExamFamilies(seed: number): PyExamFamily[] {
  const rng = rngFor("pyexam:familias", seed);
  const chosen = new Set<PyExamFamily>([rng.pick(PYEXAM_FAMILY_GROUPS.python), rng.pick(PYEXAM_FAMILY_GROUPS.datos), rng.pick(PYEXAM_FAMILY_GROUPS.numpy)]);
  chosen.add(rng.pick(PYEXAM_FAMILIES.filter((f) => !chosen.has(f))));
  return PYEXAM_FAMILIES.filter((f) => chosen.has(f));
}

/** El simulacro de una semilla (determinista). */
export function buildPyExam(seed: number): PyExam {
  const s = seed >>> 0;
  const shorts = pyExamFamilies(s).map((family) => {
    const rng = rngFor(`pyexam:${family}`, s);
    return PYEXAM_SHORT_MAKERS[family](rng, rng.pick(PYEXAM_LEVELS));
  });
  return { seed: s, shorts, project: buildPyExamProject(s, rngFor("pyexam:proyecto", s)) };
}

/** Puntos del proyecto por paso (suman 5). */
export const pyExamStepPoints = (exam: PyExam): number[] => exam.project.steps.map((st) => st.points);

/** La nota máxima (10): cuatro cortos y el proyecto. */
export const pyExamMaxScore = (exam: PyExam): number => exam.shorts.length * PYEXAM_SHORT_POINTS + pyExamStepPoints(exam).reduce((a, b) => a + b, 0);

/** Todos los archivos de datos que usa el enunciado (los del proyecto y los de los cortos). */
export function pyExamFiles(exam: PyExam): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of exam.shorts) Object.assign(out, s.files);
  Object.assign(out, exam.project.files);
  return out;
}
