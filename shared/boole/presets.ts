// Estructuras predefinidas del verificador. Las descripciones viven en content/boole/practica.ts.
import { cube, divisors, MAX_ELEMENTS, powerSet, product, twoElement, type FiniteStructure } from "./algebra.ts";
import { fnStructure } from "./fn.ts";

export const PRESET_IDS = [
  "dos",
  "partes-1",
  "partes-2",
  "partes-3",
  "cubo-2",
  "cubo-3",
  "div-6",
  "div-8",
  "div-12",
  "div-30",
  "f2",
] as const;
export type PresetId = (typeof PRESET_IDS)[number];

/** Opciones del selector: las predefinidas, el producto de dos y la personalizada. */
export const STRUCTURE_KINDS = [...PRESET_IDS, "producto", "personalizada"] as const;
export type StructureKind = (typeof STRUCTURE_KINDS)[number];

export const isPresetId = (x: unknown): x is PresetId => typeof x === "string" && (PRESET_IDS as readonly string[]).includes(x);
export const isStructureKind = (x: unknown): x is StructureKind =>
  typeof x === "string" && (STRUCTURE_KINDS as readonly string[]).includes(x);

export function presetStructure(id: PresetId): FiniteStructure {
  switch (id) {
    case "dos":
      return twoElement();
    case "partes-1":
      return powerSet(["a"]);
    case "partes-2":
      return powerSet(["a", "b"]);
    case "partes-3":
      return powerSet(["a", "b", "c"]);
    case "cubo-2":
      return cube(2);
    case "cubo-3":
      return cube(3);
    case "div-6":
      return divisors(6);
    case "div-8":
      return divisors(8);
    case "div-12":
      return divisors(12);
    case "div-30":
      return divisors(30);
    case "f2":
      return fnStructure(2);
  }
}

/** Producto de dos predefinidas, o null si pasa de MAX_ELEMENTS elementos. */
export function productOfPresets(a: PresetId, b: PresetId): FiniteStructure | null {
  const s1 = presetStructure(a);
  const s2 = presetStructure(b);
  if (s1.elements.length * s2.elements.length > MAX_ELEMENTS) return null;
  return product(s1, s2);
}
