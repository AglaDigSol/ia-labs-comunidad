// Plantillas, generación del examen, nota (con y sin penalización) e intentos guardados.
import { describe, expect, it } from "vitest";
import {
  attemptDeadline,
  attemptRemaining,
  configExam,
  configFromSearch,
  configMinutes,
  configQuestions,
  configToSearch,
  defaultExamConfig,
  finishAttempt,
  MAX_EXAM_HISTORY,
  MAX_EXAM_STORE_BYTES,
  parseExamStore,
  recordAttempt,
  serializeExamStore,
  startAttempt,
  type ExamStore,
} from "./attempt.ts";
import { blueprintSize, buildExam, EXAM_SECTION_IDS, EXAM_SECTIONS, FULL_BLUEPRINT, QUICK_BLUEPRINT, topicsBlueprint } from "./blueprint.ts";
import { scoreExam, scoreText } from "./grading.ts";
import { EXAM_TYPE_IDS } from "./items.ts";
import { encodeChoiceAnswer, type ExamItem } from "./types.ts";

/** La respuesta correcta de una pregunta, escrita como la escribiría alguien. */
function rightAnswer(q: ExamItem): string {
  return q.kind === "choice" ? encodeChoiceAnswer(q.options.filter((o) => o.correct).map((o) => o.id)) : q.correctText.split(" ")[0]!;
}
function wrongAnswer(q: ExamItem): string {
  return q.kind === "choice" ? q.options.find((o) => !o.correct)!.id : "999999,99";
}

describe("plantillas", () => {
  it("el examen completo tiene 20 preguntas y el rápido 10", () => {
    expect(blueprintSize(FULL_BLUEPRINT)).toBe(20);
    expect(blueprintSize(QUICK_BLUEPRINT)).toBe(10);
  });

  it("todos los tipos de los bloques tienen adaptador y cada tipo está en un solo bloque", () => {
    const ids = EXAM_SECTIONS.flatMap((s) => Object.keys(s.types));
    for (const id of ids) expect(EXAM_TYPE_IDS).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("«Por temas» reparte en proporción, con al menos una por bloque si caben", () => {
    const b = topicsBlueprint(["probabilidad", "algebra", "logica"], 12);
    expect(blueprintSize(b)).toBe(12);
    expect(b.probabilidad).toBeGreaterThanOrEqual(4);
    expect(b.logica).toBeGreaterThanOrEqual(2);
    expect(blueprintSize(topicsBlueprint(EXAM_SECTION_IDS, 5))).toBe(5);
    expect(blueprintSize(topicsBlueprint(["integrales"], 30))).toBe(30);
    expect(topicsBlueprint([], 10)).toEqual({});
    for (const n of [1, 7, 13, 30]) expect(blueprintSize(topicsBlueprint(["logica", "descenso", "criticos", "probabilidad"], n))).toBe(n);
  });
});

describe("buildExam", () => {
  it("es determinista, respeta los recuentos por bloque y no repite tipos si se puede", () => {
    for (const seed of [1, 42, 123456, 0xffffffff]) {
      const a = buildExam(seed, FULL_BLUEPRINT);
      expect(a).toHaveLength(20);
      expect(buildExam(seed, FULL_BLUEPRINT).map((q) => q.id)).toEqual(a.map((q) => q.id));
      for (const s of EXAM_SECTION_IDS) expect(a.filter((q) => q.section === s)).toHaveLength(FULL_BLUEPRINT[s] ?? 0);
      expect(new Set(a.map((q) => q.typeId)).size).toBe(20);
      // Por bloques, en el orden del examen.
      const order = a.map((q) => EXAM_SECTION_IDS.indexOf(q.section));
      expect([...order].sort((x, y) => x - y)).toEqual(order);
    }
    expect(buildExam(1, FULL_BLUEPRINT).map((q) => q.id)).not.toEqual(buildExam(2, FULL_BLUEPRINT).map((q) => q.id));
  });

  it("mezcla tipos de opción múltiple y numéricos, con niveles sobre todo medios", () => {
    let choice = 0;
    let total = 0;
    const levels = { básico: 0, medio: 0, avanzado: 0 };
    for (let seed = 0; seed < 15; seed++) {
      for (const q of buildExam(seed * 977, FULL_BLUEPRINT)) {
        total++;
        if (q.kind === "choice") choice++;
        levels[q.level]++;
      }
    }
    expect(choice / total).toBeGreaterThan(0.45);
    expect(choice / total).toBeLessThan(0.8);
    expect(levels.medio).toBeGreaterThan(levels.básico);
    expect(levels.medio).toBeGreaterThan(levels.avanzado);
    expect(levels.básico).toBeGreaterThan(0);
  });

  it("repite tipos solo cuando el bloque no tiene bastantes", () => {
    const qs = buildExam(9, { integrales: 5 });
    expect(qs).toHaveLength(5);
    expect(new Set(qs.map((q) => q.typeId))).toEqual(new Set(["calculo-integral", "calculo-partes"]));
    expect(new Set(qs.map((q) => q.id)).size).toBe(5);
  });

  it("barajado: las mismas preguntas en otro orden", () => {
    const a = buildExam(77, FULL_BLUEPRINT);
    const b = buildExam(77, FULL_BLUEPRINT, { order: "barajado" });
    expect(new Set(b.map((q) => q.id))).toEqual(new Set(a.map((q) => q.id)));
    expect(b.map((q) => q.id)).not.toEqual(a.map((q) => q.id));
  });
});

describe("scoreExam", () => {
  const qs = buildExam(5, QUICK_BLUEPRINT);
  it("cada pregunta vale 10/N; sin penalización un fallo vale 0", () => {
    expect(scoreExam(qs, qs.map(rightAnswer), false).score).toBeCloseTo(10);
    const half = qs.map((q, i) => (i < 5 ? rightAnswer(q) : wrongAnswer(q)));
    const s = scoreExam(qs, half, false);
    expect(s.score).toBeCloseTo(5);
    expect([s.correct, s.wrong, s.blank]).toEqual([5, 5, 0]);
    expect(scoreExam(qs, [], false)).toMatchObject({ score: 0, blank: 10 });
  });

  it("con penalización, un fallo resta un tercio de la pregunta; en blanco, nada; nunca baja de 0", () => {
    const answers = qs.map((q, i) => (i < 6 ? rightAnswer(q) : i < 9 ? wrongAnswer(q) : null));
    const s = scoreExam(qs, answers, true);
    expect(s.score).toBeCloseTo(6 - 3 / 3);
    expect(scoreExam(qs, qs.map(wrongAnswer), true).score).toBe(0);
    expect(scoreText(s.score)).toBe("5,00");
  });

  it("desglosa por bloques", () => {
    const s = scoreExam(qs, qs.map(rightAnswer), false);
    expect(s.sections.map((x) => x.section)).toEqual(Object.keys(QUICK_BLUEPRINT));
    expect(s.sections.reduce((a, x) => a + x.total, 0)).toBe(10);
    expect(s.sections.find((x) => x.section === "algebra")).toMatchObject({ total: 2, correct: 2, max: 2 });
  });
});

describe("configuración en la URL", () => {
  it("ida y vuelta", () => {
    const c = { ...defaultExamConfig(123456, "temas"), sections: ["logica", "probabilidad"] as const, count: 8, minutes: 40, order: "barajado" as const, penalty: true };
    const back = configFromSearch(configToSearch({ ...c, sections: [...c.sections] }));
    expect(back).toEqual({ ...c, sections: ["logica", "probabilidad"] });
    expect(configFromSearch(new URLSearchParams("modo=completo&s=abc"))).toMatchObject({ mode: "completo", order: "tema", penalty: false });
    expect(configFromSearch(new URLSearchParams("modo=otro&s=abc"))).toBeNull();
    expect(configFromSearch(new URLSearchParams("modo=rapido"))).toBeNull();
    expect(configMinutes(defaultExamConfig(1))).toBe(120);
    expect(configMinutes(defaultExamConfig(1, "rapido"))).toBe(60);
    expect(configQuestions(defaultExamConfig(1, "rapido"))).toBe(10);
  });
});

describe("intentos e historial", () => {
  const config = defaultExamConfig(99, "rapido");
  const qs = configExam(config);
  const t0 = Date.UTC(2026, 10, 3, 18, 0);

  it("el tiempo cuenta desde el inicio y no se para", () => {
    const a = startAttempt(config, qs.length, t0);
    expect(attemptDeadline(a)).toBe(t0 + 3_600_000);
    expect(attemptRemaining(a, t0 + 600_000)).toBe(3_000_000);
    expect(attemptRemaining(a, t0 + 5_000_000)).toBe(0);
  });

  it("entregar fuera de tiempo cuenta como automático y con la hora del final", () => {
    const a = { ...startAttempt(config, qs.length, t0), answers: qs.map(rightAnswer) };
    const done = finishAttempt(a, qs, t0 + 9_000_000);
    expect(done.finishedAt).toBe(t0 + 3_600_000);
    expect(done.result).toMatchObject({ score: 10, auto: true, correct: 10 });
    const early = finishAttempt(a, qs, t0 + 1000);
    expect(early.result?.auto).toBe(false);
    expect(early.finishedAt).toBe(t0 + 1000);
  });

  it("se guarda y se lee; lo que no encaja se descarta", () => {
    const active = { ...startAttempt(config, qs.length, t0), flagged: [2], current: 3 };
    let store: ExamStore = { active, history: [] };
    store = recordAttempt(store, finishAttempt({ ...active, answers: qs.map(rightAnswer) }, qs, t0 + 1000));
    expect(store.active).toBeNull();
    const raw = serializeExamStore(store);
    expect(parseExamStore(raw)).toEqual(store);
    expect(parseExamStore(serializeExamStore({ active, history: [] }))).toEqual({ active, history: [] });
    expect(parseExamStore("no es json")).toBeNull();
    expect(parseExamStore(JSON.stringify({ v: 2, active: null, history: [] }))).toBeNull();
    expect(parseExamStore(JSON.stringify({ v: 1, active: { ...active, finishedAt: 5 }, history: [] }))).toBeNull();
    expect(parseExamStore(JSON.stringify({ v: 1, active: { ...active, config: { ...active.config, mode: "x" } }, history: [] }))).toBeNull();
    expect(parseExamStore(JSON.stringify({ v: 1, active: { ...active, answers: ["x".repeat(500)] }, history: [] }))).toBeNull();
    expect(parseExamStore(JSON.stringify({ v: 1, active: { ...active, flagged: [99] }, history: [] }))).toBeNull();
  });

  it("el historial tiene un límite y cabe en «Exportar mis datos»", () => {
    let store: ExamStore = { active: null, history: [] };
    const big = defaultExamConfig(1, "temas");
    big.count = 30;
    for (let i = 0; i < MAX_EXAM_HISTORY + 5; i++) {
      const a = { ...startAttempt({ ...big, seed: i }, 30, t0 + i * 10_000), answers: Array.from({ length: 30 }, () => "1234567890,12345") };
      store = recordAttempt(store, { ...a, finishedAt: a.startedAt + 1000, result: { score: 5, correct: 15, wrong: 15, blank: 0, auto: false, sections: [["logica", 1, 2]] } });
    }
    expect(store.history).toHaveLength(MAX_EXAM_HISTORY);
    expect(store.history.filter((h) => h.answers !== null)).toHaveLength(5);
    const raw = serializeExamStore(store);
    expect(raw.length).toBeLessThanOrEqual(MAX_EXAM_STORE_BYTES);
    expect(parseExamStore(raw)).not.toBeNull();
  });
});
