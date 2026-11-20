// Ejercicios guiados: un enunciado y una lista de pasos que se comprueban uno a uno («Comprobar paso»),
// cada uno con sus pistas, sus errores típicos (una respuesta equivocada concreta con su explicación,
// que nunca dice la buena) y, al final, la solución detrás de «Ver la solución completa». Lo usan los
// tipos de tensores, factorizaciones, formas de arrays de NumPy y extremos absolutos. Aquí solo hay
// datos y la corrección; la vista (src/features/labs/exercises/guided-views.tsx) los pinta.
//
// Formatos de respuesta, los mismos que en el resto del banco: los números de una matriz o un vector
// como en el laboratorio de álgebra lineal (enteros, fracciones 3/4 o decimales con coma o punto); los
// enteros grandes como en el examen (sin separador de miles: se lee y se avisa); las formas como las
// escribe NumPy, (2, 3), (3,) o ().
import { commaWarning, equalsInteger, parseExamNumber, thousandsNote, thousandsWarning } from "../discrete/answer.ts";
import { ENTRY_ERROR, fracText, parseEntry, type Matrix } from "../linalg/matrix.ts";
import { wrongCells } from "../linalg/rref.ts";
import { cmp, equals, type Frac } from "../rational.ts";

/** Forma de un array: la lista de longitudes de sus ejes. */
export type Dims = readonly number[];

export type GuidedBlock = { kind: "p"; text: string } | { kind: "tex"; tex: string; label: string } | { kind: "code"; code: string };

export interface GuidedStatement {
  blocks: GuidedBlock[];
  /** Lo que se pide, en una frase. */
  ask: string;
}

/** Una respuesta equivocada típica y lo que se le dice a quien la escribe (sin dar la buena). */
export type Mistake<T> = { value: T; text: string };

interface StepBase {
  title: string;
  /** Pistas graduadas: la regla, nunca el resultado. */
  hints: readonly string[];
  /** Lo que se dice al acertar el paso. */
  okText: string;
}

export type GuidedOption = { id: string; text: string };

export type GuidedStep =
  | (StepBase & {
      kind: "numbers";
      /** Nombre de las celdas: «L», «q₁», «D = C⁻¹AC». */
      name: string;
      expected: Matrix;
      mistakes?: readonly Mistake<Matrix>[];
      /** Aviso sobre lo escrito cuando no es ningún error típico: «tu D no tiene la traza de A». */
      diagnose?: (typed: Matrix) => string | null;
    })
  | (StepBase & { kind: "integer"; label: string; expected: bigint; mistakes?: readonly Mistake<bigint>[] })
  | (StepBase & { kind: "shape"; expected: Dims | "error"; allowError: boolean; mistakes?: readonly Mistake<Dims | "error">[] })
  | (StepBase & { kind: "list"; label: string; expected: readonly Frac[]; mistakes?: readonly Mistake<readonly Frac[]>[] })
  | (StepBase & { kind: "labels"; items: readonly string[]; options: readonly GuidedOption[]; expected: readonly string[] })
  | (StepBase & { kind: "choice"; options: readonly GuidedOption[]; expected: string; why?: Readonly<Record<string, string>> });

export interface GuidedExercise {
  statement: GuidedStatement;
  steps: GuidedStep[];
  /** La solución completa, por líneas. */
  solution: string[];
}

export type GuidedAnswer =
  | { kind: "numbers"; cells: string[][] }
  | { kind: "integer"; text: string }
  | { kind: "shape"; text: string; error: boolean }
  | { kind: "list"; text: string }
  | { kind: "labels"; picks: string[] }
  | { kind: "choice"; pick: string | null };

export type StepVerdict = {
  ok: boolean;
  text: string;
  /** Celdas marcadas (numbers) o filas marcadas (labels), sin decir su valor. */
  cells?: Array<[number, number]>;
  rows?: number[];
};

// ---------------------------------------------------------------- Formas

export const DIMS_ERROR = "Escribe la forma como en NumPy: (2, 3), (3,) o () para un escalar, con las longitudes sin separador de miles.";
const MAX_DIMS = 8;

export const dimsText = (s: Dims) => (s.length === 1 ? `(${s[0]},)` : `(${s.join(", ")})`);
export const dimsEqual = (a: Dims, b: Dims) => a.length === b.length && a.every((x, i) => x === b[i]);
export const dimsSize = (s: Dims) => s.reduce((a, b) => a * b, 1);

/** Lee una forma: «(2, 3)», «[2, 3]», «2, 3», «(3,)», «()»; longitudes de hasta 10¹² (96000 o 96_000). */
export function parseDims(text: string): { ok: true; value: number[] } | { ok: false; error: string } {
  const t = text.trim();
  if (t.length > 120) return { ok: false, error: DIMS_ERROR };
  const inner = t.replace(/^[([]\s*/, "").replace(/\s*[)\]]$/, "");
  if (inner === "") return /^[([]\s*[)\]]$/.test(t) ? { ok: true, value: [] } : { ok: false, error: DIMS_ERROR };
  const parts = inner.split(",").map((p) => p.trim());
  // «(3,)»: la coma final de las tuplas de un elemento.
  if (parts.length > 1 && parts.at(-1) === "") parts.pop();
  if (parts.length === 0 || parts.length > MAX_DIMS || !parts.every((p) => /^\d+(?:_\d{3})*$/.test(p))) return { ok: false, error: DIMS_ERROR };
  const value = parts.map((p) => Number(p.replace(/_/g, "")));
  if (value.some((d) => !Number.isSafeInteger(d) || d > 1e12)) return { ok: false, error: DIMS_ERROR };
  return { ok: true, value };
}

// ---------------------------------------------------------------- Listas de números

/** Lee una lista de números separados por «;» (la coma es la decimal). Vacía: «ninguno», «∅» o «-». */
export function parseNumberList(text: string): { ok: true; value: Frac[] } | { ok: false; error: string } {
  const t = text.trim();
  if (/^(ninguno|ninguna|ningún|∅|\{\s*\}|-|—)$/i.test(t)) return { ok: true, value: [] };
  if (t === "") return { ok: false, error: "Escribe los números separados por punto y coma (−1; 2), o «ninguno»." };
  const parts = t.split(";").map((p) => p.trim()).filter((p) => p !== "");
  if (parts.length > 12) return { ok: false, error: "Demasiados números." };
  const out: Frac[] = [];
  for (const p of parts) {
    const r = parseEntry(p);
    if (!r.ok) return { ok: false, error: `No se lee «${p}». Separa los números con punto y coma (la coma es la decimal): −1; 2.` };
    out.push(r.value);
  }
  return { ok: true, value: out };
}

const sortedUnique = (xs: readonly Frac[]) => {
  const s = [...xs].sort(cmp);
  return s.filter((x, i) => i === 0 || !equals(x, s[i - 1]!));
};
const sameSet = (a: readonly Frac[], b: readonly Frac[]) => {
  const x = sortedUnique(a);
  const y = sortedUnique(b);
  return x.length === y.length && x.every((v, i) => equals(v, y[i]!));
};

export const fracListText = (xs: readonly Frac[]) => (xs.length === 0 ? "ninguno" : xs.map(fracText).join("; "));

// ---------------------------------------------------------------- Corrección

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const matrixEq = (a: Matrix, b: Matrix) => a.length === b.length && a.every((r, i) => r.length === b[i]!.length && r.every((x, j) => equals(x, b[i]![j]!)));

/** Corrige un paso. Nunca dice la respuesta: dice qué está mal o qué error típico parece. */
export function checkStep(step: GuidedStep, answer: GuidedAnswer): StepVerdict {
  switch (step.kind) {
    case "numbers": {
      if (answer.kind !== "numbers") throw new Error("respuesta de otro tipo");
      const parsed = answer.cells.map((row) => row.map((t) => (t.trim() === "" ? null : parseEntry(t))));
      const unreadable = parsed.flatMap((row, i) => row.flatMap((r, j) => (r !== null && !r.ok ? [[i, j] as [number, number]] : [])));
      if (unreadable.length > 0) return { ok: false, text: ENTRY_ERROR, cells: unreadable };
      const typed = parsed.map((row) => row.map((r) => (r !== null && r.ok ? r.value : null)));
      const wrong = wrongCells(step.expected, typed);
      if (wrong.length === 0) return { ok: true, text: step.okText };
      const full = typed.every((r) => r.every((x) => x !== null)) ? (typed as Matrix) : null;
      if (full) {
        const m = step.mistakes?.find((x) => matrixEq(x.value, full));
        if (m) return { ok: false, text: m.text, cells: wrong };
        const note = step.diagnose?.(full);
        if (note) return { ok: false, text: note, cells: wrong };
      }
      const cells = step.expected.length * (step.expected[0]?.length ?? 0);
      return {
        ok: false,
        text: cells === 1 ? "No es ese número: repasa la regla." : `${plural(wrong.length, "celda no coincide", "celdas no coinciden")}: están marcadas (las vacías también cuentan).`,
        cells: wrong,
      };
    }
    case "integer": {
      if (answer.kind !== "integer") throw new Error("respuesta de otro tipo");
      const r = parseExamNumber(answer.text);
      if (!r.ok) return { ok: false, text: r.error };
      const right = equalsInteger(r.value, step.expected);
      if (right) return { ok: true, text: r.plain ? `${step.okText} ${thousandsNote(r.plain)}` : step.okText };
      const m = step.mistakes?.find((x) => equalsInteger(r.value, x.value));
      const extra = r.plain ? ` ${thousandsWarning(r.plain)}` : (commaWarning(answer.text) ?? "");
      return { ok: false, text: `${m ? m.text : "No es ese número: repasa la regla."}${extra ? ` ${extra.trim()}` : ""}` };
    }
    case "shape": {
      if (answer.kind !== "shape") throw new Error("respuesta de otro tipo");
      if (answer.error) {
        if (step.expected === "error") return { ok: true, text: step.okText };
        const m = step.mistakes?.find((x) => x.value === "error");
        return { ok: false, text: m ? m.text : "Esta operación sí da un resultado: vuelve a aplicar la regla." };
      }
      const r = parseDims(answer.text);
      if (!r.ok) return { ok: false, text: r.error };
      if (step.expected !== "error" && dimsEqual(r.value, step.expected)) return { ok: true, text: step.okText };
      const m = step.mistakes?.find((x) => x.value !== "error" && dimsEqual(x.value, r.value));
      if (m) return { ok: false, text: m.text };
      if (step.expected === "error") return { ok: false, text: "Mira bien la operación: ¿se puede hacer con esa forma?" };
      if (r.value.length !== step.expected.length) return { ok: false, text: `Tu forma tiene ${plural(r.value.length, "eje", "ejes")} y el resultado tiene otro número: cuenta los ejes que quedan.` };
      return { ok: false, text: "Tiene el número de ejes correcto, pero alguna longitud no coincide." };
    }
    case "list": {
      if (answer.kind !== "list") throw new Error("respuesta de otro tipo");
      const r = parseNumberList(answer.text);
      if (!r.ok) return { ok: false, text: r.error };
      if (sameSet(r.value, step.expected)) return { ok: true, text: step.okText };
      const m = step.mistakes?.find((x) => sameSet(x.value, r.value));
      if (m) return { ok: false, text: m.text };
      const extra = r.value.some((x) => !step.expected.some((y) => equals(x, y)));
      return { ok: false, text: extra ? "Alguno de tus valores no es de la lista que se pide." : "Te falta alguno." };
    }
    case "labels": {
      if (answer.kind !== "labels") throw new Error("respuesta de otro tipo");
      const rows = step.expected.flatMap((e, i) => (answer.picks[i] !== e ? [i] : []));
      if (rows.length === 0) return { ok: true, text: step.okText };
      return { ok: false, text: `${plural(step.items.length - rows.length, "bien", "bien")} de ${step.items.length}. Los marcados no coinciden (los que no has elegido también cuentan).`, rows };
    }
    case "choice": {
      if (answer.kind !== "choice") throw new Error("respuesta de otro tipo");
      if (answer.pick === null) return { ok: false, text: "Elige una opción." };
      if (answer.pick === step.expected) return { ok: true, text: step.okText };
      return { ok: false, text: step.why?.[answer.pick] ?? "No es esa: repasa la regla." };
    }
  }
}

// ---------------------------------------------------------------- Respuestas escritas (para los tests y la vista)

const fracInput = (x: Frac) => (x.d === 1n ? x.n.toString() : `${x.n}/${x.d}`);

/** La respuesta que escribiría alguien que pone este valor en el paso. */
export function typedAnswer(step: GuidedStep, value: unknown): GuidedAnswer {
  switch (step.kind) {
    case "numbers":
      return { kind: "numbers", cells: (value as Matrix).map((r) => r.map(fracInput)) };
    case "integer":
      return { kind: "integer", text: (value as bigint).toString() };
    case "shape":
      return value === "error" ? { kind: "shape", text: "", error: true } : { kind: "shape", text: dimsText(value as Dims), error: false };
    case "list":
      return { kind: "list", text: (value as Frac[]).length === 0 ? "ninguno" : (value as Frac[]).map(fracInput).join("; ") };
    case "labels":
      return { kind: "labels", picks: [...(value as string[])] };
    case "choice":
      return { kind: "choice", pick: value as string };
  }
}

/** La respuesta correcta de un paso, escrita. */
export const rightAnswer = (step: GuidedStep): GuidedAnswer => typedAnswer(step, step.expected);

/** Respuesta vacía de un paso (como empieza la vista). */
export function blankAnswer(step: GuidedStep): GuidedAnswer {
  switch (step.kind) {
    case "numbers":
      return { kind: "numbers", cells: step.expected.map((r) => r.map(() => "")) };
    case "integer":
      return { kind: "integer", text: "" };
    case "shape":
      return { kind: "shape", text: "", error: false };
    case "list":
      return { kind: "list", text: "" };
    case "labels":
      return { kind: "labels", picks: step.items.map(() => "") };
    case "choice":
      return { kind: "choice", pick: null };
  }
}

/** Los errores típicos de un paso, como valores (para los tests). */
export function stepMistakes(step: GuidedStep): Array<{ value: unknown; text: string }> {
  switch (step.kind) {
    case "numbers":
    case "integer":
    case "shape":
    case "list":
      return [...(step.mistakes ?? [])];
    case "labels":
      return [];
    case "choice":
      return Object.entries(step.why ?? {}).map(([value, text]) => ({ value, text }));
  }
}

/** Quita los errores típicos que coinciden con la respuesta buena o se repiten (con otro texto, el primero). */
export function cleanMistakes<T>(expected: T, mistakes: ReadonlyArray<Mistake<T> | null>, same: (a: T, b: T) => boolean): Mistake<T>[] {
  const out: Mistake<T>[] = [];
  for (const m of mistakes) {
    if (!m || same(m.value, expected) || out.some((x) => same(x.value, m.value))) continue;
    out.push(m);
  }
  return out;
}

export const sameMatrix = matrixEq;
export const sameDims = (a: Dims | "error", b: Dims | "error") => (a === "error" || b === "error" ? a === b : dimsEqual(a, b));
export const sameList = sameSet;
