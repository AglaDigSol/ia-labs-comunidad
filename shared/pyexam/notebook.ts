// El simulacro como cuaderno: la lista de celdas (enunciados en markdown, celdas de solución
// editables, la de los import del proyecto y las «Test Use Case» de solo lectura) que pinta la página,
// y su exportación a .ipynb (nbformat 4.5, kernel python3, Python 3.12) para abrirlo en Jupyter o
// Colab, en blanco o con el código de la persona. Los CSV no van dentro: se descargan aparte y el
// cuaderno dice dónde ponerlos. TypeScript puro.
import { seedToText } from "../exercises/random.ts";
import { pyExamFiles } from "./build.ts";
import { PYEXAM_MINUTES, PYEXAM_PROJECT_POINTS, PYEXAM_SHORT_POINTS, type PyExam } from "./types.ts";

export const PYEXAM_TITLE = "Simulacro de 01MIAR · Python para la IA";
export const PYEXAM_INTEGRITY_NOTE = "Es un simulacro para practicar; no es el examen oficial ni lo sustituye.";

/**
 * Una celda. `part` es el ejercicio o paso al que pertenece: 0 a 3 los cortos y 4 + i el paso i del
 * proyecto (null en la presentación). Las celdas de solución tienen `slot` = `part`: el índice de su
 * código en las respuestas.
 */
export type PyExamCell =
  | { kind: "md"; id: string; part: number | null; level: 1 | 2 | 3; title: string; text: string[] }
  | { kind: "code"; id: string; part: number; slot: number; starter: string }
  | { kind: "setup"; id: string; part: number; code: string }
  | { kind: "test"; id: string; part: number; code: string };

/** «1,25», «0,5». */
export const pointsText = (x: number): string => String(Math.round(x * 100) / 100).replace(".", ",");
const pts = (x: number) => `${pointsText(x)} ${x === 1 ? "punto" : "puntos"}`;

/** Número de partes que se corrigen (y de celdas de solución): los cortos y los pasos. */
export const pyExamParts = (exam: PyExam): number => exam.shorts.length + exam.project.steps.length;

/** El nombre de una parte: «Ejercicio 2» o «Paso C». */
export function pyExamPartName(exam: PyExam, part: number): string {
  if (part < exam.shorts.length) return `Ejercicio ${part + 1}`;
  return `Paso ${exam.project.steps[part - exam.shorts.length]?.letter ?? "?"}`;
}

/** Los archivos de datos, en el orden en que se citan. */
export const pyExamFileNames = (exam: PyExam): string[] => Object.keys(pyExamFiles(exam));

export function pyExamInstructions(exam: PyExam): string[] {
  const n = exam.shorts.length;
  return [
    `Cinco ejercicios en ${PYEXAM_MINUTES / 60} horas: ${n} cortos de ${pointsText(PYEXAM_SHORT_POINTS)} puntos cada uno y un proyecto de datos de ${PYEXAM_PROJECT_POINTS} puntos, en pasos. La nota es sobre 10.`,
    "Escribe cada solución en su celda («Tu solución AQUÍ») y ejecuta la celda «Test Use Case» que va debajo: son pruebas a la vista. Al entregar, cada ejercicio se corrige además con pruebas ocultas con otros datos.",
    `Los datos están en la carpeta del cuaderno: ${pyExamFileNames(exam).map((f) => `\`${f}\``).join(", ")}.`,
    PYEXAM_INTEGRITY_NOTE,
  ];
}

/** Las celdas del cuaderno, en orden. */
export function pyExamCells(exam: PyExam): PyExamCell[] {
  const cells: PyExamCell[] = [{ kind: "md", id: "intro", part: null, level: 1, title: PYEXAM_TITLE, text: pyExamInstructions(exam) }];
  exam.shorts.forEach((s, i) => {
    const k = i + 1;
    cells.push({ kind: "md", id: `e${k}-enunciado`, part: i, level: 2, title: `Ejercicio ${k}. ${s.title} (${pts(PYEXAM_SHORT_POINTS)})`, text: s.statement });
    cells.push({ kind: "code", id: `e${k}-solucion`, part: i, slot: i, starter: s.starter });
    cells.push({ kind: "test", id: `e${k}-test`, part: i, code: s.test });
  });
  const p = exam.project;
  const first = exam.shorts.length;
  const k = exam.shorts.length + 1;
  cells.push({
    kind: "md",
    id: `e${k}-enunciado`,
    part: first,
    level: 2,
    title: `Ejercicio ${k}. Proyecto de datos: ${p.title} (${pts(PYEXAM_PROJECT_POINTS)})`,
    text: [...p.intro, `Archivos: ${Object.keys(p.files).map((f) => `\`${f}\``).join(" y ")}.`],
  });
  cells.push({ kind: "setup", id: `e${k}-import`, part: first, code: p.setup });
  p.steps.forEach((st, i) => {
    const part = first + i;
    const l = st.letter.toLowerCase();
    const leave = `Al final del paso deben quedar definidos: ${st.artefacts.map((a) => `\`${a}\``).join(", ")}.`;
    cells.push({ kind: "md", id: `paso-${l}-enunciado`, part, level: 3, title: `Paso ${st.letter}. ${st.title} (${pts(st.points)})`, text: [...st.statement, leave] });
    cells.push({ kind: "code", id: `paso-${l}-solucion`, part, slot: part, starter: `# Paso ${st.letter}: tu solución AQUÍ\n` });
    cells.push({ kind: "test", id: `paso-${l}-test`, part, code: st.test });
  });
  return cells;
}

/** El código inicial de cada celda de solución (el índice es el slot). */
export const pyExamStarters = (exam: PyExam): string[] =>
  pyExamCells(exam)
    .filter((c): c is Extract<PyExamCell, { kind: "code" }> => c.kind === "code")
    .map((c) => c.starter);

/** El código de una celda: el de la persona o, si no lo ha cambiado (null), el inicial. */
export const slotCode = (starters: readonly string[], code: ReadonlyArray<string | null> | null, slot: number): string => code?.[slot] ?? starters[slot] ?? "";

// ---------------------------------------------------------------- .ipynb

export interface IpynbCell {
  cell_type: "markdown" | "code";
  id: string;
  metadata: Record<string, unknown>;
  source: string[];
  execution_count?: null;
  outputs?: never[];
}

export interface Ipynb {
  cells: IpynbCell[];
  metadata: Record<string, unknown>;
  nbformat: 4;
  nbformat_minor: 5;
}

/** El texto de una celda como lo guarda Jupyter: una cadena por línea, con su salto (menos la última). */
export function ipynbSource(text: string): string[] {
  const t = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  if (t === "") return [];
  const ls = t.split("\n");
  return ls.map((l, i) => (i < ls.length - 1 ? `${l}\n` : l));
}

const LOCKED = { editable: false, deletable: false };

/** El cuaderno: en blanco (code null) o con el código de la persona. */
export function pyExamNotebook(exam: PyExam, code: ReadonlyArray<string | null> | null = null): Ipynb {
  const starters = pyExamStarters(exam);
  const md = (id: string, text: string): IpynbCell => ({ cell_type: "markdown", id, metadata: {}, source: ipynbSource(text) });
  const codeCell = (id: string, text: string, metadata: Record<string, unknown> = {}): IpynbCell => ({ cell_type: "code", id, metadata, source: ipynbSource(text), execution_count: null, outputs: [] });
  const files = pyExamFileNames(exam);
  const cells: IpynbCell[] = pyExamCells(exam).map((c) => {
    switch (c.kind) {
      case "md": {
        const extra =
          c.part === null
            ? [`Antes de empezar, descarga los datos desde el simulacro («Descargar los datos (.csv)») y pon ${files.length === 1 ? "el archivo" : "los archivos"} en la misma carpeta que este cuaderno.`, `Código del simulacro: \`${seedToText(exam.seed)}\`.`]
            : [];
        return md(c.id, [`${"#".repeat(c.level)} ${c.title}`, ...c.text, ...extra].join("\n\n"));
      }
      case "code":
        return codeCell(c.id, slotCode(starters, code, c.slot));
      case "setup":
        return codeCell(c.id, c.code, { ...LOCKED });
      case "test":
        return codeCell(c.id, `# Test Use Case\n${c.code}`, { ...LOCKED, tags: ["test-use-case"] });
    }
  });
  return {
    cells,
    metadata: {
      kernelspec: { display_name: "Python 3", language: "python", name: "python3" },
      language_info: {
        name: "python",
        version: "3.12",
        file_extension: ".py",
        mimetype: "text/x-python",
        codemirror_mode: { name: "ipython", version: 3 },
        nbconvert_exporter: "python",
        pygments_lexer: "ipython3",
      },
    },
    nbformat: 4,
    nbformat_minor: 5,
  };
}

/** El .ipynb como texto (con la sangría de un espacio que usa Jupyter). */
export const pyExamNotebookJson = (exam: PyExam, code: ReadonlyArray<string | null> | null = null): string => `${JSON.stringify(pyExamNotebook(exam, code), null, 1)}\n`;

/** «simulacro-01miar-3k9x.ipynb» o «simulacro-01miar-3k9x-respuestas.ipynb». */
export const pyExamNotebookName = (exam: PyExam, answers: boolean): string => `simulacro-01miar-${seedToText(exam.seed)}${answers ? "-respuestas" : ""}.ipynb`;
