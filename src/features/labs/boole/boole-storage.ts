// Borrador del laboratorio de álgebra de Boole (estructura elegida, tablas personalizadas, la
// derivación en curso, el circuito elegido, la expresión del visualizador de circuitos y la función
// de F₂ que se practica). Se guarda como JSON en la clave «boole» de labs-storage.ts (localStorage por
// defecto, o el almacén que inyecte la app anfitriona). Todo se valida al leer: si algo no encaja, se
// descarta el borrador. Versión 2 (0.5.0): los borradores de la versión 1 se leen y se completan con
// los valores por defecto de los campos nuevos.
import { MAX_CUSTOM_ELEMENTS } from "../../../../shared/boole/algebra.ts";
import { isLawId, type LawId } from "../../../../shared/boole/laws.ts";
import { isPresetId, isStructureKind, type PresetId, type StructureKind } from "../../../../shared/boole/presets.ts";
import { readLabItem, writeLabItem } from "../labs-storage.ts";

const MAX_BYTES = 8 * 1024;
export const MAX_STEPS = 30;
export const MAX_EXPR = 200;

export type CustomTables = { plus: number[][]; times: number[][]; comp: number[] };
export type SavedStep = { expr: string; law: LawId };

export const BUILD_MODES = ["basicas", "nand", "nor"] as const;
export type BuildMode = (typeof BUILD_MODES)[number];
const isBuildMode = (x: unknown): x is BuildMode => typeof x === "string" && (BUILD_MODES as readonly string[]).includes(x);

export interface BooleDraft {
  v: 2;
  kind: StructureKind;
  p1: PresetId;
  p2: PresetId;
  custom: CustomTables | null;
  start: string | null;
  steps: SavedStep[];
  /** Circuito elegido en «Circuito → función» (id de content/boole/circuitos.ts). */
  circuit: string | null;
  /** Expresión del visualizador «Función → circuito» y puertas con que se dibuja. */
  build: string;
  buildMode: BuildMode;
  /** Función de F₂ que se practica (índice 0–15 de su vector de verdad), o null. */
  f2: number | null;
}

export const EMPTY_DRAFT: BooleDraft = {
  v: 2,
  kind: "dos",
  p1: "dos",
  p2: "partes-1",
  custom: null,
  start: null,
  steps: [],
  circuit: null,
  build: "",
  buildMode: "basicas",
  f2: null,
};

const isIdx = (x: unknown, n: number) => Number.isInteger(x) && (x as number) >= 0 && (x as number) < n;

function parseCustom(x: unknown): CustomTables | null {
  if (typeof x !== "object" || x === null) return null;
  const c = x as Record<string, unknown>;
  if (!Array.isArray(c.comp)) return null;
  const n = c.comp.length;
  if (n < 2 || n > MAX_CUSTOM_ELEMENTS || !c.comp.every((v) => isIdx(v, n))) return null;
  const table = (t: unknown): t is number[][] =>
    Array.isArray(t) && t.length === n && t.every((row) => Array.isArray(row) && row.length === n && row.every((v) => isIdx(v, n)));
  if (!table(c.plus) || !table(c.times)) return null;
  return { plus: c.plus, times: c.times, comp: c.comp as number[] };
}

export function parseBooleDraft(raw: string): BooleDraft | null {
  if (raw.length > MAX_BYTES) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if ((d.v !== 1 && d.v !== 2) || !isStructureKind(d.kind) || !isPresetId(d.p1) || !isPresetId(d.p2)) return null;
  const custom = d.custom === null ? null : parseCustom(d.custom);
  if (d.custom !== null && custom === null) return null;
  if (d.start !== null && (typeof d.start !== "string" || d.start.length > MAX_EXPR)) return null;
  if (!Array.isArray(d.steps) || d.steps.length > MAX_STEPS) return null;
  const steps: SavedStep[] = [];
  for (const s of d.steps) {
    if (typeof s !== "object" || s === null) return null;
    const st = s as Record<string, unknown>;
    if (typeof st.expr !== "string" || st.expr.length > MAX_EXPR || !isLawId(st.law)) return null;
    steps.push({ expr: st.expr, law: st.law });
  }
  const base = { v: 2 as const, kind: d.kind, p1: d.p1, p2: d.p2, custom, start: d.start as string | null, steps };
  // Versión 1: aún no había circuitos ni Fₙ.
  if (d.v === 1) return { ...EMPTY_DRAFT, ...base };
  if (d.circuit !== null && (typeof d.circuit !== "string" || !/^[a-z0-9-]{1,60}$/.test(d.circuit))) return null;
  if (typeof d.build !== "string" || d.build.length > MAX_EXPR || !isBuildMode(d.buildMode)) return null;
  if (d.f2 !== null && !(Number.isInteger(d.f2) && (d.f2 as number) >= 0 && (d.f2 as number) < 16)) return null;
  return { ...base, circuit: d.circuit as string | null, build: d.build, buildMode: d.buildMode, f2: d.f2 as number | null };
}

export function loadBooleDraft(): BooleDraft {
  const raw = readLabItem("boole");
  return (raw !== null && parseBooleDraft(raw)) || EMPTY_DRAFT;
}

export function saveBooleDraft(d: BooleDraft): void {
  writeLabItem("boole", JSON.stringify(d));
}
