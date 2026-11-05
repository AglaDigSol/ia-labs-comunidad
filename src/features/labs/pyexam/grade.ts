// Corrección del simulacro de 01MIAR con el banco de pruebas de los ejercicios (harness.ts): cada
// ejercicio corto es una comprobación como la de «Comprobar» (su solución de referencia, sus casos
// ocultos con otros datos y sus requisitos) y cada paso del proyecto, otra, en la que el «código» es
// el de la persona desde la celda de los import hasta ese paso (como al ejecutar el cuaderno en orden)
// y la referencia, la de los mismos pasos. Si un paso falla, se corrige otra vez con la referencia de
// los pasos anteriores y el código de ese paso (el error arrastrado no cuenta dos veces) y vale la
// mejor. Entre celda y celda se cierran las figuras, como en Jupyter: cada paso de gráficos mira solo
// la suya. Todo va en una sola ejecución del worker (y otra para los pasos que se repiten); si una
// se pasa del tiempo, se corrige parte a parte.
//
// Nada de esto se ejecuta durante el intento: solo al entregar (o al «Volver a corregir»). Aquí, los
// programas y cómo se leen sus resultados (sin el worker: las pruebas lo usan con el python3 del
// sistema); en grade-run.ts, la ejecución en el worker.
import {
  failedUnits,
  pyExamTotal,
  scoreShort,
  scoreStep,
  shortUnitLabels,
  shortUnits,
  stepCaseToPyCase,
  stepUnitLabels,
  type PyExam,
  type PyExamResult,
  type PyExamShortOutcome,
  type PyExamStep,
} from "../../../../shared/pyexam/index.ts";
import { slotCode, pyExamStarters } from "../../../../shared/pyexam/notebook.ts";
import type { PyCodeInstance } from "../../../../shared/exercises/python.ts";
import { MAGICS_PY, transformMagics } from "../python/magics.ts";
import { CASE_SECONDS, caseFiles, checkPayload, HARNESS_PY, parseCheckResult, type CaseResult, type CheckPayload, type CheckResult } from "../exercises/python/harness.ts";
import { caseDetail } from "../exercises/python/report.ts";

/** Segundos por caso de un paso del proyecto (todo el cuaderno hasta el paso, con pandas y gráficos). */
export const STEP_SECONDS = 12;
/** Carpeta (relativa a la de trabajo) de los archivos de la corrección. */
export const GRADE_DIR = "simulacro";

// Tras __labs_check, las figuras que deja abiertas (la del primer caso con gráfico) se guardan como
// PNG en base64 y se cierran, para que no se mezclen con las del lote siguiente.
export const PYEXAM_GRADE_PY = String.raw`${HARNESS_PY}

def _png_abiertas():
    plt = _mod("matplotlib.pyplot")
    if plt is None:
        return []
    import base64 as _b64, warnings as _warnings
    out = []
    for n in plt.get_fignums():
        buf = _io.BytesIO()
        with _warnings.catch_warnings():
            _warnings.simplefilter("ignore")
            plt.figure(n).savefig(buf, format="png", dpi=80, bbox_inches="tight", facecolor="white")
        out.append(_b64.b64encode(buf.getvalue()).decode())
    plt.close("all")
    return out

def __labs_simulacro(lotes):
    base = _os.getcwd()
    out = []
    for lote in lotes:
        try:
            carpeta = _os.path.join(base, lote["dir"])
            _os.makedirs(carpeta, exist_ok=True)
            _os.chdir(carpeta)
            r = _json.loads(__labs_check(lote["payload"]))
        except BaseException as e:
            r = {"fallo": _error(e)}
        finally:
            _os.chdir(base)
        try:
            r["png"] = _png_abiertas() if lote.get("figuras") else []
        except BaseException:
            r["png"] = []
        plt = _mod("matplotlib.pyplot")
        if plt is not None:
            plt.close("all")
        out.append(r)
    return _json.dumps(out)
`;

// Entre dos celdas: cierra las figuras (como el backend inline de Jupyter al acabar cada celda).
const CLOSE_FIGURES = '__import__("sys").modules.get("matplotlib.pyplot") and __import__("sys").modules["matplotlib.pyplot"].close("all")';

/** Varias celdas en un solo programa, con la línea en la que empieza cada una (desde 1). */
export function joinCells(cells: readonly string[]): { code: string; starts: number[] } {
  const starts: number[] = [];
  let line = 1;
  let magics = false;
  const parts = cells.map((c, i) => {
    const t = transformMagics(c);
    if (t.ok && t.used.some((u) => u !== "%matplotlib")) magics = true;
    const body = `${(t.ok ? t.code : c).replace(/\s+$/, "")}\n`;
    const piece = i < cells.length - 1 ? `${body}${CLOSE_FIGURES}\n` : body;
    starts.push(line);
    line += piece.split("\n").length - 1;
    return piece;
  });
  if (!magics) return { code: parts.join(""), starts };
  // %time y %timeit: sus funciones, delante (y las líneas se desplazan).
  const head = `${MAGICS_PY.replace(/^\n/, "")}\n`;
  const shift = head.split("\n").length - 1;
  return { code: head + parts.join(""), starts: starts.map((s) => s + shift) };
}

/** Un lote: una comprobación del banco de pruebas en su carpeta. */
export type GradeLot = { dir: string; payload: CheckPayload; figures: boolean; files: Array<{ path: string; text: string }> };

/** Qué se corrige en cada lote (para leer el resultado). */
type LotRef = { part: number; mode: "corto" | "acumulado" | "aislado"; starts: number[] };

const fnOfStep = (st: PyExamStep) => st.artefacts.find((a) => a !== "df") ?? st.artefacts[0] ?? "df";

/** Comprobación de un paso como una instancia del banco de pruebas. */
function stepInstance(exam: PyExam, k: number, solution: string): PyCodeInstance {
  const st = exam.project.steps[k]!;
  return {
    kind: "code", tema: 12, template: `pyexam-paso-${st.letter}`, title: st.title, statement: [], fn: fnOfStep(st), starter: "", hints: [], solution,
    cases: st.cases.map(stepCaseToPyCase),
    packages: exam.project.packages, seconds: STEP_SECONDS,
  };
}

/**
 * Los lotes de la corrección. `pass` «primera»: los cortos y cada paso con el cuaderno de la persona;
 * «aislado»: los pasos de `steps`, con la referencia de los anteriores y el código del paso.
 */
export function gradeLots(exam: PyExam, code: ReadonlyArray<string | null> | null, pass: "primera" | "aislado", steps: readonly number[] = []): { lots: GradeLot[]; refs: LotRef[] } {
  const starters = pyExamStarters(exam);
  const n = exam.shorts.length;
  const lots: GradeLot[] = [];
  const refs: LotRef[] = [];
  const projectDir = `${GRADE_DIR}/proyecto`;
  // Los datos del proyecto, una vez en cada carpeta de caso (todos los pasos usan los mismos).
  const maxCases = Math.max(...exam.project.steps.map((s) => s.cases.length));
  const projectFiles = Array.from({ length: maxCases }, (_, i) => Object.entries(exam.project.files).map(([name, text]) => ({ path: `${projectDir}/ejercicio/caso${i + 1}/${name}`, text }))).flat();
  if (pass === "primera") {
    exam.shorts.forEach((s, i) => {
      const dir = `${GRADE_DIR}/e${i + 1}`;
      const { code: student, starts } = joinCells([slotCode(starters, code, i)]);
      lots.push({ dir, payload: checkPayload(s.check, student), figures: false, files: caseFiles(s.check.cases).map((f) => ({ path: `${dir}/${f.path}`, text: f.text })) });
      refs.push({ part: i, mode: "corto", starts });
    });
  }
  const ref = exam.project.steps.map((st) => st.solution);
  const todo = pass === "primera" ? exam.project.steps.map((_, k) => k) : steps;
  todo.forEach((k, j) => {
    const st = exam.project.steps[k]!;
    const solution = joinCells([exam.project.setup, ...ref.slice(0, k + 1)]).code;
    const mine = Array.from({ length: k + 1 }, (_, i) => slotCode(starters, code, n + i));
    const cells = pass === "primera" ? [exam.project.setup, ...mine] : [exam.project.setup, ...ref.slice(0, k), mine[k]!];
    const joined = joinCells(cells);
    const files = j === 0 ? projectFiles : [];
    lots.push({ dir: projectDir, payload: checkPayload(stepInstance(exam, k, solution), joined.code), figures: st.plot, files });
    refs.push({ part: n + k, mode: pass === "primera" ? "acumulado" : "aislado", starts: joined.starts });
  });
  return { lots, refs };
}

/** El programa de una tanda: el banco y la llamada, cuyo valor (un str con JSON) es una lista de resultados. */
export function gradeProgram(lots: readonly GradeLot[]): string {
  const data = lots.map((l) => ({ dir: l.dir, payload: l.payload, figuras: l.figures }));
  return `${PYEXAM_GRADE_PY}\n__labs_simulacro(_json.loads(${JSON.stringify(JSON.stringify(data))}))\n`;
}

/** El resultado de un lote: lo que dice el banco (o null si no se pudo comprobar) y las figuras. */
export type LotResult = { check: CheckResult | null; figures: string[]; failure: string | null };

/** Lee la lista que devuelve __labs_simulacro (como JSON); null si no tiene la forma esperada. */
export function parseGradeResults(raw: string | undefined, count: number): LotResult[] | null {
  if (typeof raw !== "string") return null;
  let d: unknown;
  try {
    d = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(d) || d.length !== count) return null;
  return d.map((x: unknown) => {
    const o = (typeof x === "object" && x !== null ? x : {}) as Record<string, unknown>;
    const png = Array.isArray(o.png) ? o.png.filter((p): p is string => typeof p === "string" && /^[A-Za-z0-9+/=]+$/.test(p)) : [];
    const fallo = typeof o.fallo === "object" && o.fallo !== null ? String((o.fallo as Record<string, unknown>).mensaje ?? "error") : null;
    return { check: fallo ? null : parseCheckResult(JSON.stringify(o)), figures: png, failure: fallo };
  });
}

// ---------------------------------------------------------------- Interpretar

/** Una comprobación oculta en los resultados: lo que se mira, si se cumple y, si no, qué hizo tu código. */
export type UnitReport = { label: string; ok: boolean; detail: string[] };

export interface PartReport {
  points: number;
  units: UnitReport[];
  /** Tus figuras (las del paso de gráficos). */
  figures: string[];
  /** Cómo se corrigió el paso: con tu cuaderno o con la referencia de los pasos anteriores. */
  mode: "corto" | "acumulado" | "aislado";
  /** Un aviso general: error de sintaxis, falta la función, no se pudo comprobar… */
  note: string | null;
}

export interface PyExamGrading {
  result: PyExamResult;
  parts: PartReport[];
}

/** «paso C, línea 3» a partir de la línea del programa unido. */
function where(exam: PyExam, ref: LotRef, line: number | null): string {
  if (line === null) return "";
  if (ref.mode === "corto") return ` (línea ${line - ref.starts[0]! + 1} de tu celda)`;
  // starts: [import, paso A, …]; en «aislado», el último es el paso corregido.
  let cell = 0;
  for (let i = 0; i < ref.starts.length; i++) if (line >= ref.starts[i]!) cell = i;
  if (cell === 0) return " (en la celda de los import)";
  const k = ref.mode === "aislado" ? ref.part - exam.shorts.length : cell - 1;
  if (ref.mode === "aislado" && cell !== ref.starts.length - 1) return " (en la solución de referencia de un paso anterior)";
  return ` (paso ${exam.project.steps[k]?.letter ?? "?"}, línea ${line - ref.starts[cell]! + 1})`;
}

function caseText(exam: PyExam, ref: LotRef, c: CaseResult, seconds: number): string[] {
  if (c.error) return [`Tu código lanzó ${c.error.mensaje}${where(exam, ref, c.error.linea)}.`];
  return caseDetail(c, seconds);
}

function noteOf(exam: PyExam, ref: LotRef, r: LotResult, fn: string): string | null {
  if (r.failure) return `No se ha podido comprobar: ${r.failure}`;
  if (!r.check) return "No se ha podido leer el resultado de la comprobación.";
  if (r.check.sintaxis) return `Tu código tiene un error de sintaxis${where(exam, ref, r.check.sintaxis.linea)}: ${r.check.sintaxis.mensaje}.`;
  if (r.check.falta) return `No encuentro \`${fn}\`: ${ref.mode === "corto" ? "defínela con ese nombre exacto" : "el paso tiene que dejarla definida con ese nombre exacto"}.`;
  return null;
}

function shortReport(exam: PyExam, i: number, ref: LotRef, r: LotResult): PartReport {
  const s = exam.shorts[i]!;
  const labels = shortUnitLabels(s);
  const ok = r.check && !r.check.sintaxis;
  const outcome: PyExamShortOutcome | null = ok ? { cases: r.check!.casos.map((c) => c.ok), rules: r.check!.reglas } : null;
  const units = shortUnits(s, outcome);
  const nc = s.check.cases.length;
  const seconds = s.check.seconds ?? CASE_SECONDS;
  return {
    points: scoreShort(outcome),
    units: units.map((u, k) => ({ label: labels[k]!, ok: u, detail: !u && ok && k < nc && r.check!.casos[k] ? caseText(exam, ref, r.check!.casos[k]!, seconds) : [] })),
    figures: [],
    mode: "corto",
    note: noteOf(exam, ref, r, s.check.fn),
  };
}

/** Unidades de un paso: el valor de cada caso (si se compara) y cada comprobación con nombre. */
function stepReport(exam: PyExam, k: number, ref: LotRef, r: LotResult): PartReport {
  const st = exam.project.steps[k]!;
  const labels = stepUnitLabels(st);
  const units: UnitReport[] = [];
  const usable = r.check && !r.check.sintaxis;
  st.cases.forEach((c, ci) => {
    const res = usable ? r.check!.casos[ci] : undefined;
    const broken = !res || !!res.interno || !!res.tiempo || !!res.falta || !!res.error;
    const why = res && broken && !res.ok ? caseText(exam, ref, res, STEP_SECONDS) : [];
    if (c.value !== false) {
      const bad = broken || (res.mal ?? []).some((d) => d.que === "valor");
      units.push({ label: labels[units.length]!, ok: !bad, detail: bad ? (broken ? why : caseDetail({ ...res!, ok: false, mal: (res!.mal ?? []).filter((d) => d.que === "valor") }, STEP_SECONDS)) : [] });
    }
    (c.checks ?? []).forEach((_, x) => {
      const out = res?.checks?.[x];
      const good = !broken && out?.ok === true;
      units.push({ label: labels[units.length]!, ok: good, detail: good ? [] : broken ? why : out?.tuyo ? [`Lo tuyo: ${out.tuyo}`] : [] });
    });
  });
  return { points: scoreStep(st.points, units.map((u) => u.ok)), units, figures: r.figures, mode: ref.mode, note: noteOf(exam, ref, r, fnOfStep(st)) };
}

/** Lee los resultados de una tanda en informes por parte. */
export function interpretLots(exam: PyExam, refs: readonly LotRef[], results: readonly LotResult[]): Map<number, PartReport> {
  const out = new Map<number, PartReport>();
  refs.forEach((ref, i) => {
    const r = results[i]!;
    const rep = ref.mode === "corto" ? shortReport(exam, ref.part, ref, r) : stepReport(exam, ref.part - exam.shorts.length, ref, r);
    out.set(ref.part, rep);
  });
  return out;
}

/** El mejor de los dos informes de un paso (a igualdad, el de tu cuaderno; tus figuras, si las hay). */
export function betterStep(a: PartReport, b: PartReport | undefined): PartReport {
  if (!b) return a;
  const best = b.points > a.points ? b : a;
  return best.figures.length > 0 ? best : { ...best, figures: a.figures.length > 0 ? a.figures : b.figures };
}

/** Pasos que hay que repetir con la referencia de los anteriores: los que no tienen todo bien y cuyo código ha cambiado. */
export function stepsToIsolate(exam: PyExam, code: ReadonlyArray<string | null> | null, first: ReadonlyMap<number, PartReport>): number[] {
  const n = exam.shorts.length;
  return exam.project.steps.flatMap((st, k) => {
    const rep = first.get(n + k);
    const touched = code?.[n + k] !== null && code?.[n + k] !== undefined;
    return rep && rep.points < st.points && touched && k > 0 ? [k] : [];
  });
}

export const COPY_BLANK = "Sin contestar: la celda sigue como al principio.";

/**
 * La nota y los informes, con los dos pases. Una celda sin tocar vale 0 aunque sus comprobaciones
 * pasen (por ejemplo, porque otra celda ya hizo su trabajo o porque la cabecera vacía devuelve None).
 */
export function combineGrading(exam: PyExam, code: ReadonlyArray<string | null> | null, first: ReadonlyMap<number, PartReport>, isolated: ReadonlyMap<number, PartReport>): PyExamGrading {
  const total = exam.shorts.length + exam.project.steps.length;
  const parts: PartReport[] = Array.from({ length: total }, (_, i) => {
    const a = first.get(i) ?? { points: 0, units: [], figures: [], mode: i < exam.shorts.length ? "corto" : "acumulado", note: "No se ha podido comprobar." };
    const best = i < exam.shorts.length ? a : betterStep(a, isolated.get(i));
    if (code?.[i] !== null && code?.[i] !== undefined) return best;
    return { ...best, points: 0, units: best.units.map((u) => ({ ...u, ok: false, detail: [] })), figures: [], note: COPY_BLANK };
  });
  const points = parts.map((p) => p.points);
  return { result: { score: pyExamTotal(points), points, failed: parts.map((p) => failedUnits(p.units.map((u) => u.ok))) }, parts };
}
