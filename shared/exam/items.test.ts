// Preguntas de examen a partir del banco: con muchas semillas, cada tipo y nivel da una pregunta válida
// (cuatro opciones distintas con una sola correcta, o un número bien definido que se corrige con las
// reglas de la coma y del redondeo), determinista y con su enlace a «Practicar».
import { describe, expect, it } from "vitest";
import { exerciseType } from "../exercises/registry.ts";
import { seedFromText } from "../exercises/random.ts";
import { levelFromSlug } from "../exercises/types.ts";
import { examBlockText } from "./blocks.ts";
import { EXAM_ADAPTERS, EXAM_TYPE_IDS, examItem, examLevels, examTypeSummary } from "./items.ts";
import { expectedFrac, numericMatches, parseExamDecimal } from "./numeric.ts";
import { decodeChoiceAnswer, encodeChoiceAnswer, isAnswered, type ExamItem } from "./types.ts";

const SEEDS = Array.from({ length: 25 }, (_, i) => (i * 2654435761 + 17) >>> 0);

/** La respuesta correcta tal como la escribiría alguien (la primera cifra del texto de la solución). */
const typedCorrect = (it: Extract<ExamItem, { kind: "numeric" }>) => it.correctText.split(" ")[0]!;

describe("registro del simulacro", () => {
  it("cubre los temas del examen y deja fuera Python y Boole", () => {
    const topics = new Set(EXAM_ADAPTERS.map((a) => a.type.topic));
    for (const t of ["logica", "predicados", "conjuntos", "combinatoria", "algebra-lineal", "calculo", "probabilidad"]) expect(topics.has(t as never)).toBe(true);
    expect(topics.has("python")).toBe(false);
    expect(topics.has("boole")).toBe(false);
    expect(new Set(EXAM_TYPE_IDS).size).toBe(EXAM_TYPE_IDS.length);
    expect(EXAM_TYPE_IDS.length).toBeGreaterThanOrEqual(40);
    for (const id of EXAM_TYPE_IDS) expect(exerciseType(id)).not.toBeNull();
    expect(examTypeSummary().every((s) => s.ask.length > 10 && s.levels.length > 0)).toBe(true);
  });
});

describe.each(EXAM_TYPE_IDS)("%s", (typeId) => {
  it("da preguntas válidas en todos sus niveles", () => {
    for (const level of examLevels(typeId)) {
      for (const seed of SEEDS) {
        const item = examItem(typeId, seed, level);
        expect(item, `${typeId} ${level} ${seed}`).not.toBeNull();
        const it2 = item!;
        expect(it2.typeId).toBe(typeId);
        expect(it2.level).toBe(level);
        expect(it2.prompt.length).toBeGreaterThan(3);
        // Determinista.
        expect(examItem(typeId, seed, level)!.id).toBe(it2.id);
        // El enlace de práctica reproduce la misma instancia.
        const p = new URLSearchParams(it2.practiceLink.slice(1));
        expect(p.get("t")).toBe(typeId);
        expect(levelFromSlug(p.get("n"))).toBe(level);
        expect(seedFromText(p.get("s"))).toBe(it2.seed);
        // Nada vacío en el enunciado.
        for (const b of it2.stem) expect(examBlockText(b).trim().length).toBeGreaterThan(0);
        expect(it2.grade(null)).toBe(false);
        expect(it2.grade("")).toBe(false);
        if (it2.kind === "choice") {
          expect(it2.mode).toBe("single");
          expect(it2.options).toHaveLength(4);
          expect(it2.options.map((o) => o.letter)).toEqual(["a", "b", "c", "d"]);
          expect(new Set(it2.options.map((o) => o.text)).size).toBe(4);
          const right = it2.options.filter((o) => o.correct);
          expect(right).toHaveLength(1);
          expect(it2.grade(encodeChoiceAnswer([right[0]!.id]))).toBe(true);
          for (const o of it2.options.filter((x) => !x.correct)) expect(it2.grade(o.id)).toBe(false);
          expect(it2.grade(encodeChoiceAnswer(it2.options.map((o) => o.id)))).toBe(false);
          expect(it2.correctText.startsWith(`${right[0]!.letter})`)).toBe(true);
        } else {
          const typed = typedCorrect(it2);
          expect(it2.grade(typed), `${it2.id}: ${it2.correctText}`).toBe(true);
          // Con punto en vez de coma también vale.
          expect(it2.grade(typed.replace(",", "."))).toBe(true);
          // Una centésima más ya no (ni una unidad más, en un entero).
          const d = parseExamDecimal(typed)!;
          const bump = d.scale === 0 ? `${d.units + 1n}` : `${(Number(d.units) / 10 ** d.scale + 0.01).toFixed(2).replace(".", ",")}`;
          expect(it2.grade(bump), `${it2.id}: ${bump}`).toBe(false);
          expect(it2.grade("abc")).toBe(false);
          // El ejemplo de la indicación de formato nunca es la respuesta.
          const example = /por ejemplo, ([^)]+)\)/.exec(it2.formatNote)![1]!;
          expect(it2.grade(example)).toBe(false);
          if (it2.format === "entero") expect(d.scale).toBe(0);
        }
      }
    }
  });
});

describe("respuestas numéricas", () => {
  it("lee cifras con coma o punto, sin separador de miles", () => {
    expect(parseExamDecimal("12870")).toEqual({ units: 12870n, scale: 0, dot: false });
    expect(parseExamDecimal("−0,25")).toEqual({ units: -25n, scale: 2, dot: false });
    expect(parseExamDecimal("3.5")).toEqual({ units: 35n, scale: 1, dot: true });
    expect(parseExamDecimal("12 870")).toBeNull();
    expect(parseExamDecimal("3/8")).toBeNull();
    expect(parseExamDecimal("")).toBeNull();
  });

  it("dos decimales: redondeo correcto, no truncado; el valor exacto vale", () => {
    const third = { n: 1n, d: 3n };
    const twoThirds = { n: 2n, d: 3n };
    expect(numericMatches("0,33", third, "dos-decimales")).toBe(true);
    expect(numericMatches("0,333", third, "dos-decimales")).toBe(true);
    expect(numericMatches("0,3", third, "dos-decimales")).toBe(false);
    expect(numericMatches("0,67", twoThirds, "dos-decimales")).toBe(true);
    expect(numericMatches("0,66", twoThirds, "dos-decimales")).toBe(false);
    expect(numericMatches("0,5", { n: 1n, d: 2n }, "dos-decimales")).toBe(true);
    expect(numericMatches("0,50", { n: 1n, d: 2n }, "dos-decimales")).toBe(true);
    expect(numericMatches("0,38", { n: 3n, d: 8n }, "dos-decimales")).toBe(true);
    expect(numericMatches("0,375", { n: 3n, d: 8n }, "dos-decimales")).toBe(true);
    expect(numericMatches("0,37", { n: 3n, d: 8n }, "dos-decimales")).toBe(false);
    expect(numericMatches("−1,25", { n: -5n, d: 4n }, "dos-decimales")).toBe(true);
    expect(numericMatches("2,72", Math.E, "dos-decimales")).toBe(true);
    expect(numericMatches("2,71", Math.E, "dos-decimales")).toBe(false);
  });

  it("entero y exacto: el valor exacto, con o sin ceros decimales", () => {
    expect(numericMatches("12870", 12870n, "entero")).toBe(true);
    expect(numericMatches("12870,0", 12870n, "entero")).toBe(true);
    expect(numericMatches("12.870", 12870n, "entero")).toBe(false);
    expect(numericMatches("1,25", { n: 5n, d: 4n }, "exacto")).toBe(true);
    expect(numericMatches("1,3", { n: 5n, d: 4n }, "exacto")).toBe(false);
    expect(expectedFrac(0.75)).toEqual({ n: 3n, d: 4n });
  });

  it("codifica las respuestas de opción múltiple", () => {
    expect(decodeChoiceAnswer(encodeChoiceAnswer(["a", "c"]))).toEqual(["a", "c"]);
    expect(decodeChoiceAnswer(null)).toEqual([]);
    expect(isAnswered({ kind: "choice" }, "")).toBe(false);
    expect(isAnswered({ kind: "numeric" }, "  ")).toBe(false);
    expect(isAnswered({ kind: "numeric" }, "3")).toBe(true);
  });

  it("admite «selecciona la o las correctas» solo si se pide", () => {
    // El avanzado de «Teoría de matrices» siempre es de varias correctas.
    const t = exerciseType("algebra-teoria")!;
    expect(t.levels).toContain("avanzado");
    expect(examLevels("algebra-teoria")).not.toContain("avanzado");
    const multi = examItem("combinatoria-funciones", 5, "medio", { allowMulti: true });
    expect(multi).not.toBeNull();
  });
});
