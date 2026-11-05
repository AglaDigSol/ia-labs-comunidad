// Simulacro de 01MIAR con el python3 del sistema (numpy, pandas, matplotlib y seaborn): en cada examen
// generado, las soluciones de referencia sacan un 10 con las comprobaciones ocultas y pasan los assert a
// la vista del cuaderno (ejecutado celda a celda con el kernel, como en la página); las respuestas
// equivocadas típicas pierden los puntos que deben (entre ellas, el precio del «primer visto» en vez de
// la moda) y un error de un paso no se paga dos veces. Sin python3 o sin esos paquetes, se saltan.
import { describe, expect, it } from "vitest";
import { buildPyExam, pyExamCells, pyExamFiles, pyExamParts, type PyExam } from "../shared/pyexam/index.ts";
import { combineGrading, gradeLots, interpretLots, parseGradeResults, PYEXAM_GRADE_PY, stepsToIsolate, type PyExamGrading } from "../src/features/labs/pyexam/grade.ts";
import { KERNEL_PY, parseKernelReply, type KernelReply } from "../src/features/labs/pyexam/kernel.ts";
import { hasPlots, runJobs } from "./system-python.ts";

const SEEDS = [0, 1, 2, 3, 10, 11, 4242, 98765];

/** Las respuestas de referencia: la solución de cada corto y de cada paso. */
const refCode = (exam: PyExam): string[] => [...exam.shorts.map((s) => s.check.solution), ...exam.project.steps.map((s) => s.solution)];

/** Corrige como gradePyExam, pero con el python3 del sistema (las dos pasadas). */
function grade(exam: PyExam, code: Array<string | null>): PyExamGrading {
  const pass = (p: ReturnType<typeof gradeLots>) => {
    const raw = runJobs<unknown>(PYEXAM_GRADE_PY, [{ fn: "__labs_simulacro", payload: p.lots.map((l) => ({ dir: l.dir, payload: l.payload, figuras: l.figures })), files: p.lots.flatMap((l) => l.files) }], 600_000)[0];
    const results = parseGradeResults(JSON.stringify(raw), p.lots.length);
    if (!results) throw new Error("resultado ilegible");
    return interpretLots(exam, p.refs, results);
  };
  const first = pass(gradeLots(exam, code, "primera"));
  const again = stepsToIsolate(exam, code, first);
  const isolated = again.length > 0 ? pass(gradeLots(exam, code, "aislado", again)) : new Map();
  return combineGrading(exam, code, first, isolated);
}

// Ejecuta las celdas en orden con el kernel del cuaderno (en el mismo proceso, como el worker).
const NOTEBOOK_DRIVER = `${KERNEL_PY}
def __labs_cuaderno(p):
    out = []
    for i, c in enumerate(p["celdas"], 1):
        out.append(_json.loads(__labs_celda({"codigo": c, "nombre": "<celda " + str(i) + ">", "kernel": p.get("kernel", "k1"), "nuevo": i == 1})))
    return _json.dumps(out)
`;

function runNotebook(exam: PyExam, code: Array<string | null>): KernelReply[] {
  const cells = pyExamCells(exam).flatMap((c) => (c.kind === "md" ? [] : [c.kind === "code" ? (code[c.slot] ?? c.starter) : c.code]));
  const files = Object.entries(pyExamFiles(exam)).map(([path, text]) => ({ path, text }));
  const raw = runJobs<unknown[]>(NOTEBOOK_DRIVER, [{ fn: "__labs_cuaderno", payload: { celdas: cells }, files }], 300_000)[0]!;
  return (raw as unknown[]).map((r) => parseKernelReply(JSON.stringify(r))!);
}

describe.skipIf(!hasPlots)("simulacro de 01MIAR con python3", () => {
  it("las soluciones de referencia sacan un 10 y pasan los assert a la vista", { timeout: 600_000 }, () => {
    for (const seed of SEEDS) {
      const exam = buildPyExam(seed);
      const code = refCode(exam);
      const g = grade(exam, code);
      const bad = g.parts.flatMap((p, i) => p.units.filter((u) => !u.ok).map((u) => `${i}: ${u.label} ${u.detail.join(" ")} ${p.note ?? ""}`));
      expect(bad, `semilla ${seed}`).toEqual([]);
      expect(g.result.score, `semilla ${seed}`).toBe(10);
      // Las figuras de los pasos de gráficos vuelven para enseñarlas.
      exam.project.steps.forEach((st, k) => {
        if (st.plot) expect(g.parts[exam.shorts.length + k]!.figures.length, `semilla ${seed}, paso ${st.letter}`).toBeGreaterThan(0);
      });
      const replies = runNotebook(exam, code);
      const errors = replies.flatMap((r, i) => (r.error ? [`celda ${i + 1}: ${r.error.traza.split("\n").at(-1)}`] : []));
      expect(errors, `semilla ${seed}`).toEqual([]);
    }
  });

  it("en blanco: un 0, y los assert a la vista fallan", { timeout: 300_000 }, () => {
    const exam = buildPyExam(2);
    const blank = Array.from({ length: pyExamParts(exam) }, () => null);
    const g = grade(exam, blank);
    expect(g.result.score).toBe(0);
    const replies = runNotebook(exam, blank);
    expect(replies.filter((r) => r.error).length).toBeGreaterThan(5);
  });

  it("el precio del «primer visto» pierde el paso D y no se paga dos veces en los siguientes", { timeout: 300_000 }, () => {
    const exam = buildPyExam(2);
    expect(exam.project.kind).toBe("ventas");
    const code: Array<string | null> = refCode(exam);
    const n = exam.shorts.length;
    const d = exam.project.steps.findIndex((s) => s.letter === "D");
    code[n + d] = 'precios = df.dropna(subset=["precio"]).groupby("articulo")["precio"].first()\ndf["precio"] = df["precio"].fillna(df["articulo"].map(precios))\n';
    const g = grade(exam, code);
    expect(g.parts[n + d]!.points).toBe(0);
    expect(g.parts[n + d]!.units.every((u) => !u.ok)).toBe(true);
    // Lo que no casa son valores: la explicación es la de la persona, nunca el valor esperado.
    expect(g.parts[n + d]!.units[0]!.detail.join(" ")).toMatch(/Hay algún valor distinto|Tu resultado/);
    // E (total = precio × cantidad) arrastra el error, pero se corrige también con la referencia de D.
    expect(g.parts[n + d + 1]!.points).toBe(exam.project.steps[d + 1]!.points);
    expect(g.parts[n + d + 1]!.mode).toBe("aislado");
    expect(g.result.score).toBe(10 - exam.project.steps[d]!.points);
  });

  it("errores típicos de los cortos y de los gráficos pierden sus puntos", { timeout: 300_000 }, () => {
    const exam = buildPyExam(2);
    const code: Array<string | null> = refCode(exam);
    const n = exam.shorts.length;
    // Un corto con un bucle en vez de lo que se pide, o que devuelve otra cosa.
    const i = exam.shorts.findIndex((s) => s.family === "algoritmo");
    expect(i).toBeGreaterThanOrEqual(0);
    code[i] = "def fusionar(a, b):\n    return sorted(a + b)\n";
    // Los barplots sin estimator="sum" (la media por defecto) y con otro tamaño.
    const j = exam.project.steps.findIndex((s) => s.letter === "J");
    code[n + j] = exam.project.steps[j]!.solution.replace(/, estimator="sum"/g, "").replace("figsize=(12, 4)", "figsize=(10, 4)");
    const g = grade(exam, code);
    // Todos los casos bien, pero usa sorted: la mitad (1,25 × 0,5 → 0,75 redondeado a 0,25).
    expect(g.parts[i]!.points).toBe(0.75);
    expect(g.parts[i]!.units.filter((u) => !u.ok).map((u) => u.label)).toEqual(["Requisito: Sin sorted()"]);
    const fails = g.parts[n + j]!.units.filter((u) => !u.ok).map((u) => u.label);
    expect(fails).toContain("La figura mide 12 × 4 pulgadas");
    expect(fails.some((l) => l.includes("estimator"))).toBe(true);
    expect(g.parts[n + j]!.points).toBeLessThan(exam.project.steps[j]!.points);
  });
});
