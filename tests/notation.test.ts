// Notación de los ejercicios frente al diccionario de símbolos (content/symbols): lo que escriben los
// enunciados, las opciones y las soluciones del banco de ejercicios y del simulacro tiene que usar la
// convención que documenta el diccionario. Casos: subconjunto propio (⊂ en estos apuntes, ⊊ solo
// como variante), ⊕ (suma booleana) frente a ⊻ (XOR), 𝒫(A), ℕ (doble trazo y sin el 0), CR, VR y PR,
// y la notación de las cadenas de Markov.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { powerSet } from "../shared/boole/algebra.ts";
import { FORMULAS } from "../shared/discrete/count.ts";
import { examBlockText } from "../shared/exam/blocks.ts";
import { EXAM_TYPE_IDS, examItem, examLevels } from "../shared/exam/items.ts";
import type { ExamBlock, ExamItem } from "../shared/exam/types.ts";
import { EXERCISE_TYPES } from "../shared/exercises/registry.ts";
import type { ExerciseTopic } from "../shared/exercises/types.ts";
import { ALL_SYMBOLS, symbolById } from "../shared/symbols/index.ts";
import { searchSymbols } from "../shared/symbols/search.ts";

const SEEDS = Array.from({ length: 12 }, (_, i) => (i * 2654435761 + 99) >>> 0);

/** Todas las cadenas de un valor (instancias generadas: enunciados, fórmulas, opciones…). */
function strings(x: unknown, out: string[] = []): string[] {
  if (typeof x === "string") out.push(x);
  else if (Array.isArray(x)) for (const v of x) strings(v, out);
  else if (x && typeof x === "object") for (const v of Object.values(x)) strings(v, out);
  return out;
}

const blockTexts = (b: ExamBlock): string[] => {
  const tex = b.kind === "math" ? [b.tex] : b.kind === "p" ? b.parts.flatMap((p) => (typeof p === "string" ? [] : [p.tex])) : b.kind === "list" ? b.items.flat().flatMap((p) => (typeof p === "string" ? [] : [p.tex])) : [];
  return [examBlockText(b), ...tex];
};

const itemTexts = (q: ExamItem): string[] => [
  ...q.stem.flatMap(blockTexts),
  ...q.solution.flatMap(blockTexts),
  q.prompt,
  q.correctText,
  ...(q.kind === "choice" ? q.options.flatMap((o) => [o.text, o.tex ?? "", o.why ?? ""]) : [q.label]),
];

/** Textos del banco (tipo, descripción e instancias) y del simulacro, por tema. */
function corpus(): Map<ExerciseTopic, string[]> {
  const out = new Map<ExerciseTopic, string[]>();
  const add = (topic: ExerciseTopic, xs: string[]) => out.set(topic, [...(out.get(topic) ?? []), ...xs]);
  for (const t of EXERCISE_TYPES) {
    if (t.topic === "python") continue;
    add(t.topic, [t.title, t.description]);
    for (const level of t.levels) for (const s of SEEDS) add(t.topic, strings(t.generate(s, level)));
  }
  for (const id of EXAM_TYPE_IDS) {
    for (const level of examLevels(id)) {
      for (const s of SEEDS.slice(0, 6)) {
        const q = examItem(id, s, level);
        if (q) add(q.topic, itemTexts(q));
      }
    }
  }
  return out;
}

const CORPUS = corpus();
const all = (...topics: ExerciseTopic[]) => (topics.length === 0 ? [...CORPUS.values()].flat() : topics.flatMap((t) => CORPUS.get(t) ?? []));
const offending = (texts: string[], re: RegExp) => [...new Set(texts.filter((t) => re.test(t)))].slice(0, 5);

/** Ficheros de código de las vistas (lo que escriben a mano los enunciados y las pistas). */
function sources(dir: string): Array<{ file: string; text: string }> {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [{ file: p, text: readFileSync(p, "utf8") }] : [];
  });
}
const VIEW_SOURCES = [...sources("src/features/labs"), ...sources("shared/exercises"), ...sources("shared/exam")];

describe("subconjunto propio: ⊂ en estos apuntes, ⊊ como variante", () => {
  it("el diccionario documenta ⊂ como la propia, explica ⊂ frente a ⊆ y tiene ficha de ⊊", () => {
    const proper = symbolById("subconjunto-propio")!;
    expect(proper.tex).toBe("A \\subset B");
    expect(proper.codeNote).toMatch(/⊆/);
    expect(proper.codeNote).toMatch(/Algunos textos usan ⊂ como ⊆/);
    const strict = symbolById("subconjunto-propio-estricto")!;
    expect(strict.tex).toBe("A \\subsetneq B");
    expect(strict.variants.some((v) => v.tex === "A \\subset B")).toBe(true);
    expect(searchSymbols(ALL_SYMBOLS, "⊊")[0]?.id).toBe("subconjunto-propio-estricto");
    expect(symbolById("subconjunto")!.tex).toBe("A \\subseteq B");
  });

  it("los ejercicios y el simulacro escriben ⊂ y ⊃, nunca ⊊ ni ⊋", () => {
    expect(offending(all(), /[⊊⊋]|\\subsetneq|\\supsetneq/)).toEqual([]);
    expect(all("conjuntos").some((t) => t.includes("⊂"))).toBe(true);
  });

  it("las vistas no escriben \\subsetneq ni \\supsetneq en TeX", () => {
    expect(VIEW_SOURCES.filter((s) => /\\\\(subsetneq|supsetneq)/.test(s.text)).map((s) => s.file)).toEqual([]);
  });
});

describe("⊕ es la suma booleana; el XOR es ⊻", () => {
  it("el diccionario separa las dos fichas", () => {
    const oplus = symbolById("oplus")!;
    expect(oplus.name).toBe("⊕ (suma booleana)");
    expect(JSON.stringify(oplus.variants)).not.toMatch(/veebar|exclusiva|XOR/);
    const xor = symbolById("disyuncion-exclusiva")!;
    expect(xor.tex).toBe("\\veebar");
    expect(xor.variants.some((v) => (v.tex ?? "").includes("\\oplus"))).toBe(false);
    expect(xor.aliases).toContain("⊻");
  });

  it("lógica y predicados no escriben ⊕; Boole no escribe ⊻", () => {
    expect(offending(all("logica", "predicados"), /⊕|\\oplus/)).toEqual([]);
    expect(all("logica").some((t) => t.includes("⊻") || t.includes("\\veebar"))).toBe(true);
    expect(offending(all("boole"), /⊻|\\veebar/)).toEqual([]);
    expect(all("boole").some((t) => t.includes("⊕"))).toBe(true);
  });
});

describe("conjunto de partes: 𝒫(A)", () => {
  it("el diccionario escribe 𝒫(A) y da P(A) como variante", () => {
    const p = symbolById("conjunto-potencia")!;
    expect(p.tex).toBe("\\mathcal{P}(A)");
    expect(p.variants.some((v) => v.text === "P(A)")).toBe(true);
  });

  it("conjuntos, combinatoria y Boole escriben 𝒫, nunca P(A) ni P({…})", () => {
    const re = /(?<![\p{L}\\])P\((?:[A-Z](?:\s*×\s*[A-Z])?|\{[^}]*\}|∅)\)/u;
    expect(offending(all("conjuntos", "combinatoria", "boole"), re)).toEqual([]);
    expect(all("conjuntos").some((t) => t.includes("𝒫"))).toBe(true);
    expect(powerSet(["a", "b"]).name.startsWith("𝒫(")).toBe(true);
  });
});

describe("ℕ: doble trazo y sin el 0", () => {
  const convention = symbolById("conjuntos-numericos")?.example?.tex ?? "(sin definir en el diccionario)";

  it("el diccionario dice qué es ℕ en estos apuntes", () => {
    expect(convention).toBe("\\mathbb{N} = \\{1, 2, 3, \\ldots\\}");
    expect(symbolById("conjuntos-numericos")!.codeNote).toMatch(/sin el 0/);
  });

  it("los ejercicios escriben ℕ (o \\mathbb{N}), nunca N a secas, y con la misma definición", () => {
    const texts = all();
    expect(offending(texts, /(?:\\in|∈)\s*N\b|(?<![\p{L}\\{])N\s*=\s*\{|\\mathbb\{N\}\s*=\s*\\\{(?!1, 2, 3, \\ldots\\\})/u)).toEqual([]);
    expect(texts.some((t) => t.includes(convention))).toBe(true);
    for (const s of VIEW_SOURCES) {
      for (const m of s.text.matchAll(/\\+mathbb\{N\} = \\+\{[^"`]*?\\+\}/g)) expect(m[0].replace(/\\\\/g, "\\"), s.file).toBe(convention);
    }
  });
});

describe("combinatoria con repetición: CR, VR y PR", () => {
  it.each([
    ["CR", "combinaciones-repeticion", "math.comb(n + k - 1, k)"],
    ["VR", "variaciones-repeticion", "n ** k"],
    ["PR", "permutaciones-repeticion", "math.factorial(n) // math.prod"],
  ] as const)("%s tiene ficha con lectura, fórmula y Python, y la misma escritura que el laboratorio", (id, symbolId, code) => {
    const e = symbolById(symbolId)!;
    expect(e.category).toBe("combinatoria-probabilidad");
    expect(e.reading.length).toBeGreaterThan(10);
    expect(e.code.some((c) => c.lib === "python" && c.code.includes(code))).toBe(true);
    // El símbolo del laboratorio (CR_{n,k}, VR_{n,k}, PR_n^{…}) es el de la ficha.
    const symbol = FORMULAS[id].tex.split(" =")[0]!;
    expect(e.tex.startsWith(symbol)).toBe(true);
    expect(searchSymbols(ALL_SYMBOLS, id)[0]?.id).toBe(symbolId);
  });

  it("cada CR, VR o PR de los ejercicios lleva a su ficha", () => {
    const used = new Set(all("combinatoria").flatMap((t) => [...t.matchAll(/\b(CR|VR|PR)\b/g)].map((m) => m[1]!)));
    expect(used.size).toBeGreaterThan(0);
    for (const id of used) expect(searchSymbols(ALL_SYMBOLS, id)[0]?.tex.startsWith(id)).toBe(true);
  });
});
