// Simulacro de 01MIAR sin Python: generación determinista, familias y puntos, el cuaderno y su .ipynb
// (lo esencial de nbformat 4.5), la nota (redondeos), los intentos (entrega, validación al leer y
// tamaño) y los programas de la corrección (sin ejecutarlos).
import { describe, expect, it } from "vitest";
import { combineGrading, gradeLots, gradeProgram, joinCells, parseGradeResults } from "../src/features/labs/pyexam/grade.ts";
import { cellProgram, parseKernelReply } from "../src/features/labs/pyexam/kernel.ts";
import {
  buildPyExam,
  EMPTY_PYEXAM_STORE,
  finishPyExamAttempt,
  ipynbSource,
  MAX_PYEXAM_CODE,
  MAX_PYEXAM_HISTORY,
  MAX_PYEXAM_STORE_BYTES,
  parsePyExamStore,
  PYEXAM_FAMILIES,
  PYEXAM_FAMILY_GROUPS,
  pyExamCells,
  pyExamFamilies,
  pyExamFiles,
  pyExamMaxScore,
  pyExamNotebook,
  pyExamNotebookJson,
  pyExamNotebookName,
  pyExamPartPoints,
  pyExamParts,
  pyExamStarters,
  pyExamUnitLabels,
  recordPyExamAttempt,
  roundQuarter,
  scoreShort,
  scoreStep,
  serializePyExamStore,
  setPyExamCode,
  setPyExamResult,
  startPyExamAttempt,
  type PyExamAttempt,
  type PyExamStore,
} from "../shared/pyexam/index.ts";

const SEEDS = Array.from({ length: 60 }, (_, i) => (i * 2654435761 + 3) >>> 0);

describe("generación", () => {
  it("determinista: la misma semilla da el mismo examen", () => {
    for (const s of SEEDS.slice(0, 10)) expect(JSON.stringify(buildPyExam(s))).toBe(JSON.stringify(buildPyExam(s)));
    expect(JSON.stringify(buildPyExam(1))).not.toBe(JSON.stringify(buildPyExam(2)));
  });

  it("cuatro cortos de familias distintas (uno de Python, uno de datos y uno de NumPy), nivel medio o avanzado", () => {
    const seen = new Set<string>();
    for (const s of SEEDS) {
      const fams = pyExamFamilies(s);
      expect(new Set(fams).size).toBe(4);
      for (const g of Object.values(PYEXAM_FAMILY_GROUPS)) expect(fams.some((f) => g.includes(f))).toBe(true);
      const exam = buildPyExam(s);
      expect(exam.shorts.map((x) => x.family)).toEqual(fams);
      for (const sh of exam.shorts) {
        expect(["medio", "avanzado"]).toContain(sh.practice.level);
        expect(sh.practice.type).toMatch(/^py-/);
        expect(sh.check.cases.length).toBeGreaterThanOrEqual(3);
        expect(sh.test).toMatch(/assert /);
        expect(sh.check.solution).toContain(`def ${sh.check.fn}(`);
        seen.add(sh.family);
      }
    }
    expect([...seen].sort()).toEqual([...PYEXAM_FAMILIES].sort());
  });

  it("los puntos suman 10: 1,25 por corto y 5 el proyecto, en 6 a 10 pasos de 0,25 en 0,25 (gráficos, 1 a 1,5)", () => {
    const kinds = new Set<string>();
    for (const s of SEEDS) {
      const exam = buildPyExam(s);
      kinds.add(exam.project.kind);
      expect(exam.project.kind).toBe(s % 2 === 0 ? "ventas" : "incidencias");
      expect(pyExamMaxScore(exam)).toBe(10);
      const steps = exam.project.steps;
      expect(steps.length).toBeGreaterThanOrEqual(6);
      expect(steps.length).toBeLessThanOrEqual(10);
      expect(steps.map((x) => x.letter).join("")).toBe("ABCDEFGHIJ".slice(0, steps.length));
      expect(steps.reduce((a, x) => a + x.points, 0)).toBe(5);
      for (const st of steps) expect((st.points * 4) % 1).toBe(0);
      const plots = steps.filter((x) => x.plot).reduce((a, x) => a + x.points, 0);
      expect(plots).toBeGreaterThanOrEqual(1);
      expect(plots).toBeLessThanOrEqual(1.5);
      for (const st of steps) {
        expect(st.cases.length).toBeGreaterThan(0);
        expect(st.artefacts.length).toBeGreaterThan(0);
        if (st.plot) expect(st.cases.every((c) => c.value === false && (c.checks ?? []).some((k) => k.kind === "fig-una"))).toBe(true);
      }
    }
    expect([...kinds].sort()).toEqual(["incidencias", "ventas"]);
  });

  it("los datos tienen los nombres que usa el enunciado y no hay datos reales", () => {
    for (const s of SEEDS.slice(0, 12)) {
      const exam = buildPyExam(s);
      const files = pyExamFiles(exam);
      for (const name of Object.keys(files)) expect(name).toMatch(/^[a-z]+\.csv$/);
      const text = [...exam.project.intro, ...exam.project.steps.flatMap((x) => [...x.statement, x.test]), ...exam.shorts.flatMap((x) => [...x.statement, x.test])].join("\n");
      for (const name of Object.keys(exam.project.files)) expect(text).toContain(name);
      expect(text + Object.values(files).join("\n")).not.toMatch(/\w@\w|https?:|\/home\/|\/Users\//);
    }
  });
});

describe("cuaderno y .ipynb", () => {
  it("celdas: enunciado, solución y test por parte; la de import del proyecto; ids únicos", () => {
    const exam = buildPyExam(4);
    const cells = pyExamCells(exam);
    const ids = cells.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const parts = pyExamParts(exam);
    expect(cells.filter((c) => c.kind === "code").map((c) => (c.kind === "code" ? c.slot : -1))).toEqual(Array.from({ length: parts }, (_, i) => i));
    expect(cells.filter((c) => c.kind === "test")).toHaveLength(parts);
    expect(cells.filter((c) => c.kind === "setup")).toHaveLength(1);
    expect(pyExamStarters(exam)).toHaveLength(parts);
    expect(pyExamStarters(exam).slice(exam.shorts.length).every((s) => s.includes("tu solución AQUÍ"))).toBe(true);
  });

  it(".ipynb válido: nbformat 4.5, python3 y 3.12, celdas con id, fuente en líneas, código sin salidas", () => {
    for (const s of [0, 1, 7]) {
      const exam = buildPyExam(s);
      const nb = JSON.parse(pyExamNotebookJson(exam));
      expect(Object.keys(nb).sort()).toEqual(["cells", "metadata", "nbformat", "nbformat_minor"]);
      expect(nb.nbformat).toBe(4);
      expect(nb.nbformat_minor).toBe(5);
      expect(nb.metadata.kernelspec).toEqual({ display_name: "Python 3", language: "python", name: "python3" });
      expect(nb.metadata.language_info.name).toBe("python");
      expect(nb.metadata.language_info.version).toMatch(/^3\.12/);
      const ids = new Set<string>();
      for (const c of nb.cells) {
        expect(["markdown", "code"]).toContain(c.cell_type);
        expect(c.id).toMatch(/^[a-zA-Z0-9-_]{1,64}$/);
        ids.add(c.id);
        expect(typeof c.metadata).toBe("object");
        expect(Array.isArray(c.source)).toBe(true);
        c.source.forEach((l: string, i: number) => {
          expect(typeof l).toBe("string");
          if (i < c.source.length - 1) expect(l.endsWith("\n")).toBe(true);
          expect(l.slice(0, -1)).not.toContain("\n");
        });
        if (c.cell_type === "code") {
          expect(c.outputs).toEqual([]);
          expect(c.execution_count).toBeNull();
        } else {
          expect(c.outputs).toBeUndefined();
          expect(c.execution_count).toBeUndefined();
        }
      }
      expect(ids.size).toBe(nb.cells.length);
      const tests = nb.cells.filter((c: { metadata: { tags?: string[] } }) => c.metadata.tags?.includes("test-use-case"));
      expect(tests).toHaveLength(pyExamParts(exam));
      expect(tests.every((c: { source: string[]; metadata: { editable: boolean } }) => c.source[0] === "# Test Use Case\n" && c.metadata.editable === false)).toBe(true);
      // La introducción dice qué datos poner junto al cuaderno.
      expect(nb.cells[0].source.join("")).toContain(Object.keys(pyExamFiles(exam))[0]);
    }
  });

  it("con las respuestas: el código de la persona en su celda; sin tocar, el inicial", () => {
    const exam = buildPyExam(3);
    const code: Array<string | null> = Array.from({ length: pyExamParts(exam) }, () => null);
    code[1] = "def x():\n    return 1";
    const nb = pyExamNotebook(exam, code);
    const sol = nb.cells.filter((c) => c.id.endsWith("-solucion"));
    expect(sol[1]!.source).toEqual(["def x():\n", "    return 1"]);
    expect(sol[0]!.source.join("")).toBe(pyExamStarters(exam)[0]!.replace(/\n+$/, ""));
    expect(pyExamNotebookName(exam, true)).toBe(`simulacro-01miar-${(3).toString(36)}-respuestas.ipynb`);
    expect(ipynbSource("a\r\nb\n\n")).toEqual(["a\n", "b"]);
    expect(ipynbSource("")).toEqual([]);
  });
});

describe("nota", () => {
  it("corto: proporcional por caso, la mitad sin un requisito, redondeado a 0,25", () => {
    expect(scoreShort({ cases: [true, true, true, true], rules: [true] })).toBe(1.25);
    expect(scoreShort({ cases: [true, true, true, false], rules: [] })).toBe(1);
    expect(scoreShort({ cases: [true, false, false], rules: [true] })).toBe(0.5);
    expect(scoreShort({ cases: [true, true, true, true], rules: [false] })).toBe(0.75);
    expect(scoreShort({ cases: [false, false], rules: [] })).toBe(0);
    expect(scoreShort(null)).toBe(0);
    expect(roundQuarter(0.125)).toBe(0.25);
    expect(roundQuarter(0.124)).toBe(0);
  });

  it("paso: proporcional a sus comprobaciones", () => {
    expect(scoreStep(0.75, [true, true])).toBe(0.75);
    expect(scoreStep(0.75, [true, false])).toBe(0.5);
    expect(scoreStep(0.5, [true, true, true, false, false, false, false, false])).toBe(0.25);
    expect(scoreStep(0.5, [])).toBe(0);
  });

  it("las unidades de cada parte tienen etiqueta (las de los pasos, sin valores esperados)", () => {
    const exam = buildPyExam(6);
    const labels = pyExamUnitLabels(exam);
    expect(labels).toHaveLength(pyExamParts(exam));
    expect(labels.every((l) => l.length > 0)).toBe(true);
    expect(pyExamPartPoints(exam).reduce((a, b) => a + b, 0)).toBe(10);
  });

  it("una celda sin tocar vale 0 aunque pase sus comprobaciones", () => {
    const exam = buildPyExam(6);
    const parts = pyExamParts(exam);
    const full = new Map(Array.from({ length: parts }, (_, i) => [i, { points: pyExamPartPoints(exam)[i]!, units: [{ label: "x", ok: true, detail: [] }], figures: [], mode: "corto" as const, note: null }]));
    const code: Array<string | null> = Array.from({ length: parts }, (_, i) => (i === 0 ? null : "x"));
    const g = combineGrading(exam, code, full, new Map());
    expect(g.result.points[0]).toBe(0);
    expect(g.result.score).toBe(10 - 1.25);
    expect(g.result.failed[0]).toEqual([0]);
    expect(g.parts[0]!.note).toMatch(/^Sin contestar/);
  });
});

describe("intentos", () => {
  const exam = buildPyExam(8);
  const starters = pyExamStarters(exam);
  const t0 = Date.UTC(2026, 10, 5, 10);
  const fresh = () => startPyExamAttempt(8, pyExamParts(exam), t0);

  it("el código se guarda compacto (null si es el inicial) y con límite", () => {
    let a = fresh();
    a = setPyExamCode(a, starters, 2, "print(1)")!;
    expect(a.code![2]).toBe("print(1)");
    a = setPyExamCode(a, starters, 2, starters[2]!)!;
    expect(a.code!.every((c) => c === null)).toBe(true);
    expect(setPyExamCode(a, starters, 0, "x".repeat(MAX_PYEXAM_CODE))).toBeNull();
  });

  it("entregar: a tiempo, a mano; tarde, a la hora del final y automática", () => {
    const a = fresh();
    expect(finishPyExamAttempt(a, t0 + 60_000)).toMatchObject({ finishedAt: t0 + 60_000, auto: false, result: null });
    expect(finishPyExamAttempt(a, t0 + 5 * 3600_000)).toMatchObject({ finishedAt: t0 + 2 * 3600_000, auto: true });
    expect(finishPyExamAttempt(a, t0 + 60_000, true).auto).toBe(true);
  });

  it("se valida al leer: lo que no encaja se descarta entero", () => {
    const a = fresh();
    const ok = serializePyExamStore({ active: a, history: [] });
    expect(parsePyExamStore(ok)).toEqual({ active: a, history: [] });
    const bad = (patch: Partial<PyExamAttempt>) => serializePyExamStore({ active: { ...a, ...patch }, history: [] });
    expect(parsePyExamStore(bad({ seed: -1 }))).toBeNull();
    expect(parsePyExamStore(bad({ id: "<script>" }))).toBeNull();
    expect(parsePyExamStore(bad({ finishedAt: t0 }))).toBeNull();
    expect(parsePyExamStore(bad({ code: [1 as unknown as string] }))).toBeNull();
    expect(parsePyExamStore(bad({ result: { score: 5, points: [5], failed: [[]] } }))).toBeNull();
    expect(parsePyExamStore("{")).toBeNull();
    expect(parsePyExamStore(JSON.stringify({ v: 2, active: null, history: [] }))).toBeNull();
    const done = finishPyExamAttempt(a, t0 + 1000);
    const graded = setPyExamResult(recordPyExamAttempt({ active: a, history: [] }, done), done.id, { score: 11, points: [11], failed: [[]] });
    expect(parsePyExamStore(serializePyExamStore(graded))).toBeNull();
  });

  it("cabe en «Exportar mis datos»: el historial pierde primero el código y después los intentos más antiguos", () => {
    let store: PyExamStore = EMPTY_PYEXAM_STORE;
    const big = "y = 1\n".repeat(Math.floor(MAX_PYEXAM_CODE / 10));
    for (let i = 0; i < 40; i++) {
      let a = startPyExamAttempt(8, pyExamParts(exam), t0 + i * 1000);
      a = setPyExamCode(a, starters, 0, big)!;
      const done = finishPyExamAttempt(a, t0 + i * 1000 + 500);
      store = setPyExamResult(recordPyExamAttempt(store, done), done.id, { score: 7.5, points: pyExamPartPoints(exam).map(() => 0.5), failed: pyExamPartPoints(exam).map(() => [0, 1]) });
    }
    let active = startPyExamAttempt(8, pyExamParts(exam), t0 + 99_000);
    active = setPyExamCode(active, starters, 1, big)!;
    store = { ...store, active };
    expect(store.history).toHaveLength(MAX_PYEXAM_HISTORY);
    expect(store.history.filter((h) => h.code !== null)).toHaveLength(3);
    const text = serializePyExamStore(store);
    expect(text.length).toBeLessThanOrEqual(MAX_PYEXAM_STORE_BYTES);
    expect(text.length).toBeLessThanOrEqual(16 * 1024);
    const back = parsePyExamStore(text)!;
    expect(back.active).toEqual(active);
    expect(back.history.length).toBeGreaterThan(5);
    expect(back.history[0]!.result!.score).toBe(7.5);
  });
});

describe("programas (sin ejecutarlos)", () => {
  it("joinCells: cierra las figuras entre celdas y dice dónde empieza cada una", () => {
    const j = joinCells(["a = 1\n", "b = 2\nc = 3", "%matplotlib inline\nd = 4\n"]);
    expect(j.starts).toEqual([1, 3, 6]);
    const lines = j.code.split("\n");
    expect(lines[0]).toBe("a = 1");
    expect(lines[1]).toContain('close("all")');
    expect(lines[2]).toBe("b = 2");
    expect(lines[5]).toMatch(/^pass/);
    expect(lines[6]).toBe("d = 4");
    const t = joinCells(["%time x = 1\n"]);
    expect(t.code).toContain("def _labs_timeit");
    expect(t.code.split("\n")[t.starts[0]! - 1]).toContain("_labs_clock()");
  });

  it("los lotes: los cortos con sus casos y cada paso con el cuaderno hasta él; en «aislado», la referencia de los anteriores", () => {
    const exam = buildPyExam(2);
    const code = pyExamStarters(exam).map((_, i) => `# mío ${i}\n`);
    const a = gradeLots(exam, code, "primera");
    expect(a.lots).toHaveLength(pyExamParts(exam));
    const n = exam.shorts.length;
    expect(a.lots[n + 2]!.payload.codigo).toContain("# mío 4");
    expect(a.lots[n + 2]!.payload.codigo).toContain("# mío 6");
    expect(a.lots[n + 2]!.payload.codigo).not.toContain("# mío 7");
    expect(a.lots[n + 2]!.payload.solucion).toContain(exam.project.steps[2]!.solution.trim());
    // Los datos del proyecto se escriben una vez por carpeta de caso.
    expect(a.lots.flatMap((l) => l.files).filter((f) => f.path.endsWith("/ventas.csv")).length).toBe(Math.max(...exam.project.steps.map((s) => s.cases.length)));
    const b = gradeLots(exam, code, "aislado", [3]);
    expect(b.lots).toHaveLength(1);
    expect(b.lots[0]!.payload.codigo).toContain(exam.project.steps[2]!.solution.trim());
    expect(b.lots[0]!.payload.codigo).toContain("# mío 7");
    expect(b.lots[0]!.payload.codigo).not.toContain("# mío 6");
    expect(gradeProgram(b.lots)).toMatch(/__labs_simulacro\(_json\.loads\(/);
    expect(parseGradeResults("[]", 1)).toBeNull();
    expect(parseGradeResults('[{"fallo": {"mensaje": "x"}, "png": ["<img>"]}]', 1)).toEqual([{ check: null, figures: [], failure: "x" }]);
  });

  it("kernel: el programa de una celda y su respuesta, validada (sin HTML)", () => {
    const p = cellProgram("x = 1\nx", 3, "k1", true);
    expect(p.error).toBeNull();
    expect(p.program).toContain("__labs_celda(");
    expect(p.imports).toBe("x = 1\nx");
    expect(cellProgram("!ls", 1, "k1", false).error).toMatch(/^Línea 1: /);
    expect(parseKernelReply('{"kernel": "k1", "perdido": false, "valor": {"tipo": "texto", "texto": "2"}, "error": null}')).toEqual({ kernel: "k1", perdido: false, valor: { tipo: "texto", texto: "2" }, error: null });
    const table = { tipo: "tabla", serie: false, forma: [1, 1], columnas: ["a"], indice: ["0"], filas: [["<b>1</b>"]], corteFilas: null, corteCols: null };
    expect(parseKernelReply(JSON.stringify({ kernel: "k", perdido: false, valor: table, error: null }))!.valor).toEqual(table);
    expect(parseKernelReply(JSON.stringify({ kernel: "k", perdido: false, valor: { ...table, filas: [[1]] }, error: null }))!.valor).toBeNull();
    expect(parseKernelReply("no")).toBeNull();
  });
});
