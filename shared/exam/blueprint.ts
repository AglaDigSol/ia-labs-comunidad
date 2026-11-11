// Plantillas del simulacro: qué temas entran y cuántas preguntas de cada uno, como en el examen final
// de 02MIAR (2025-26: 20 preguntas en 2 horas, unas 2/3 de opción múltiple y 1/3 numéricas). Cada
// bloque tiene una lista de tipos del banco con su peso; buildExam elige los tipos (sin repetir
// mientras se pueda), los niveles (sobre todo medio) y las semillas, todo a partir de una sola semilla:
// la misma semilla y la misma configuración dan el mismo examen.
import { createRng, MAX_SEED, type Rng } from "../exercises/random.ts";
import type { ExerciseLevel } from "../exercises/types.ts";
import { examItem, examLevels } from "./items.ts";
import type { ExamItem } from "./types.ts";

/** Bloques del examen, en el orden del enunciado. */
export const EXAM_SECTIONS = [
  { id: "logica", label: "Lógica proposicional", types: { "logica-equivalentes": 3, "logica-formalizar": 3, "logica-clasificar": 3, "logica-tabla": 1, "logica-formas-normales": 1 } },
  { id: "predicados", label: "Lógica de predicados", types: { "predicados-negar-frase": 3, "predicados-conjuntos-numericos": 3 } },
  { id: "conjuntos", label: "Conjuntos y funciones", types: { "conjuntos-cardinal": 2, "conjuntos-iguales": 3, "conjuntos-relaciones": 3, "combinatoria-funciones": 3, "conjuntos-partes": 1 } },
  { id: "combinatoria", label: "Combinatoria", types: { "combinatoria-problema": 4, "combinatoria-modelo": 2 } },
  { id: "complejidad", label: "Complejidad", types: { "combinatoria-complejidad": 3, "combinatoria-p-np": 1 } },
  { id: "limites", label: "Límites y continuidad", types: { "calculo-trozos": 3, "calculo-lhopital": 2, "calculo-dominio": 1, "calculo-biseccion": 1 } },
  { id: "derivadas", label: "Derivadas y regla de la cadena", types: { "calculo-cadena": 3, "calculo-gradiente": 2, "calculo-tangente": 2 } },
  { id: "integrales", label: "Integrales", types: { "calculo-integral": 2, "calculo-partes": 2 } },
  { id: "criticos", label: "Puntos críticos", types: { "calculo-criticos-test": 3, "calculo-criticos": 2 } },
  { id: "descenso", label: "Descenso de gradiente", types: { "calculo-cuenca": 3, "calculo-descenso": 2 } },
  {
    id: "algebra",
    label: "Álgebra lineal",
    types: { "algebra-det-propiedades": 2, "algebra-teoria": 3, "algebra-normas": 2, "algebra-tensor-rango": 2, "algebra-rouche-test": 2, "algebra-determinante": 1, "algebra-independencia": 1, "algebra-producto": 1 },
  },
  {
    id: "probabilidad",
    label: "Probabilidad",
    types: { "probabilidad-total": 2, "probabilidad-dado": 3, "probabilidad-independencia": 3, "probabilidad-juego": 2, "probabilidad-binomial": 2, "probabilidad-geometrica": 1, "probabilidad-penalizacion": 1, "probabilidad-producto": 1 },
  },
  // Cadenas de Markov: no entra en «Completo» ni en «Rápido», que siguen el reparto de FULL_BLUEPRINT
  // (2025-26); se elige en «Por temas».
  { id: "markov", label: "Cadenas de Markov", types: { "markov-evolucion": 2, "markov-estacionaria": 2, "markov-clasificacion": 2, "markov-absorcion": 2 } },
] as const satisfies ReadonlyArray<{ id: string; label: string; types: Readonly<Record<string, number>> }>;

export type ExamSectionId = (typeof EXAM_SECTIONS)[number]["id"];
export const EXAM_SECTION_IDS: readonly ExamSectionId[] = EXAM_SECTIONS.map((s) => s.id);
export const isExamSectionId = (x: unknown): x is ExamSectionId => typeof x === "string" && (EXAM_SECTION_IDS as readonly string[]).includes(x);
export const examSectionLabel = (id: ExamSectionId): string => EXAM_SECTIONS.find((s) => s.id === id)!.label;

/** Cuántas preguntas de cada bloque. */
export type ExamBlueprint = Partial<Record<ExamSectionId, number>>;

/** «Completo»: las 20 preguntas del examen de 2025-26. */
export const FULL_BLUEPRINT: ExamBlueprint = {
  logica: 2,
  predicados: 2,
  conjuntos: 1,
  combinatoria: 2,
  complejidad: 1,
  limites: 1,
  derivadas: 2,
  integrales: 1,
  criticos: 1,
  descenso: 1,
  algebra: 3,
  probabilidad: 3,
};

/** «Rápido»: 10 preguntas, una muestra de todo. */
export const QUICK_BLUEPRINT: ExamBlueprint = {
  logica: 1,
  predicados: 1,
  conjuntos: 1,
  combinatoria: 1,
  derivadas: 1,
  integrales: 1,
  algebra: 2,
  probabilidad: 2,
};

export const blueprintSize = (b: ExamBlueprint): number => Object.values(b).reduce<number>((s, n) => s + (n ?? 0), 0);

/** Límites de «Por temas». */
export const MIN_EXAM_QUESTIONS = 1;
export const MAX_EXAM_QUESTIONS = 30;
export const MIN_EXAM_MINUTES = 5;
export const MAX_EXAM_MINUTES = 180;

/**
 * «Por temas»: `count` preguntas repartidas entre los bloques elegidos en proporción al examen
 * completo (método del mayor resto), con al menos una de cada bloque si caben.
 */
export function topicsBlueprint(sections: readonly ExamSectionId[], count: number): ExamBlueprint {
  const chosen = EXAM_SECTION_IDS.filter((s) => sections.includes(s));
  const n = Math.max(MIN_EXAM_QUESTIONS, Math.min(MAX_EXAM_QUESTIONS, Math.round(count)));
  if (chosen.length === 0) return {};
  const weight = (s: ExamSectionId) => FULL_BLUEPRINT[s] ?? 1;
  const total = chosen.reduce((acc, s) => acc + weight(s), 0);
  const out: Record<string, number> = {};
  const base = n >= chosen.length ? 1 : 0;
  let left = n - base * chosen.length;
  const share = chosen.map((s) => ({ s, exact: (left * weight(s)) / total }));
  for (const x of share) {
    out[x.s] = base + Math.floor(x.exact);
  }
  left -= share.reduce((acc, x) => acc + Math.floor(x.exact), 0);
  // El resto, a los de mayor parte decimal (y, a igualdad, en el orden del examen).
  const byRest = [...share].sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)) || EXAM_SECTION_IDS.indexOf(a.s) - EXAM_SECTION_IDS.indexOf(b.s));
  for (let i = 0; i < left; i++) out[byRest[i % byRest.length]!.s] = (out[byRest[i % byRest.length]!.s] ?? 0) + 1;
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v > 0)) as ExamBlueprint;
}

export type ExamOrder = "tema" | "barajado";

export interface BuildExamOptions {
  /** «tema»: por bloques, como el examen; «barajado»: en cualquier orden. */
  order?: ExamOrder;
}

/** Una pregunta del examen con su bloque. */
export type ExamQuestion = ExamItem & { section: ExamSectionId };

/** Nivel al azar: sobre todo medio, algo de básico y de avanzado. */
function pickLevel(rng: Rng, allowed: readonly ExerciseLevel[]): ExerciseLevel {
  const r = rng.next();
  const want: ExerciseLevel = r < 0.2 ? "básico" : r < 0.8 ? "medio" : "avanzado";
  if (allowed.includes(want)) return want;
  return allowed.includes("medio") ? "medio" : allowed[0]!;
}

function weightedPick(rng: Rng, entries: ReadonlyArray<[string, number]>): string {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let x = rng.next() * total;
  for (const [id, w] of entries) {
    x -= w;
    if (x < 0) return id;
  }
  return entries[entries.length - 1]![0];
}

/**
 * El examen de una semilla y una plantilla. Los tipos de cada bloque se eligen por peso y sin repetir
 * dentro del examen mientras queden tipos sin usar en el bloque; cada pregunta lleva su propia
 * semilla. Determinista: misma semilla y plantilla, mismo examen.
 */
export function buildExam(seed: number, blueprint: ExamBlueprint, opts: BuildExamOptions = {}): ExamQuestion[] {
  const rng = createRng(seed);
  const used = new Set<string>();
  const out: ExamQuestion[] = [];
  for (const section of EXAM_SECTIONS) {
    const count = Math.max(0, Math.floor(blueprint[section.id] ?? 0));
    const entries = Object.entries(section.types) as Array<[string, number]>;
    for (let i = 0; i < count; i++) {
      const fresh = entries.filter(([id]) => !used.has(id));
      const typeId = weightedPick(rng, fresh.length > 0 ? fresh : entries);
      used.add(typeId);
      const level = pickLevel(rng, examLevels(typeId));
      const qSeed = rng.int(0, MAX_SEED);
      const item = examItem(typeId, qSeed, level);
      if (item) out.push({ ...item, id: `${out.length + 1}-${item.id}`, section: section.id });
    }
  }
  return opts.order === "barajado" ? rng.shuffle(out) : out;
}
