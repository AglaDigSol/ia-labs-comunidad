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

// Varias celdas seguidas en el mismo proceso, con el kernel que se pida en cada una.
const KERNEL_DRIVER = `${KERNEL_PY}
def __labs_celdas(p):
    return _json.dumps([_json.loads(__labs_celda(c)) for c in p["celdas"]])
`;
const cell = (codigo: string, i: number, kernel = "k1", nuevo = false) => ({ codigo, nombre: `<celda ${i}>`, kernel, nuevo });
const runCells = (cells: ReturnType<typeof cell>[]) =>
  (runJobs<unknown[]>(KERNEL_DRIVER, [{ fn: "__labs_celdas", payload: { celdas: cells } }])[0] as unknown[]).map((r) => parseKernelReply(JSON.stringify(r))!);

describe.skipIf(!hasPlots)("kernel del cuaderno con python3", () => {
  it("las celdas comparten variables en orden; reiniciar las borra; un kernel perdido se avisa", () => {
    const r = runCells([cell("a = 41", 1, "k1", true), cell("a + 1", 2), cell("b = a * 2;", 3), cell("b", 4), cell("a", 5, "k2", true), cell("c = 1", 6, "k9")]);
    expect(r[0]!.valor).toBeNull();
    expect(r[1]!.valor).toEqual({ tipo: "texto", texto: "42" });
    expect(r[2]!.valor).toBeNull(); // con ; al final no se muestra, como en Jupyter
    expect(r[3]!.valor).toEqual({ tipo: "texto", texto: "82" });
    expect(r[4]!.error!.tipo).toBe("NameError");
    expect(r[4]!.error!.traza).toMatch(/<celda 5>/);
    expect(r[4]!.perdido).toBe(false);
    expect(r[5]!.perdido).toBe(true);
    expect(r[5]!.kernel).toBe("k9");
  });

  it("una tabla vuelve como datos en texto, recortada como en Jupyter; los errores, con su línea", () => {
    const r = runCells([
      cell('import numpy as np\nimport pandas as pd\ndf = pd.DataFrame({"x": range(30), "y": ["<b>no</b>"] * 30, "z": [np.nan] * 30})\ndf', 1, "k1", true),
      cell('df["x"].head(3)', 2),
      cell("def f():\n    return 1 / 0\nf()", 3),
      cell("def g(:\n    pass", 4),
    ]);
    const t = r[0]!.valor!;
    expect(t.tipo).toBe("tabla");
    if (t.tipo !== "tabla") return;
    expect(t.forma).toEqual([30, 3]);
    expect(t.columnas).toEqual(["x", "y", "z"]);
    expect(t.indice).toHaveLength(15);
    expect(t.corteFilas).toBe(10);
    expect(t.filas[0]).toEqual(["0", "<b>no</b>", "NaN"]);
    expect(t.indice.at(-1)).toBe("29");
    const s = r[1]!.valor!;
    expect(s.tipo === "tabla" && s.serie && s.columnas[0] === "x" && s.filas.length === 3).toBe(true);
    expect(r[2]!.error!.tipo).toBe("ZeroDivisionError");
    expect(r[2]!.error!.linea).toBe(2);
    expect(r[2]!.error!.traza).toContain("return 1 / 0");
    expect(r[3]!.error!.tipo).toBe("SyntaxError");
    expect(r[3]!.error!.linea).toBe(1);
  });
});

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
