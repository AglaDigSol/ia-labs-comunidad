// Lo último del diagrama de Venn de «Sombrear regiones» (la expresión elegida o escrita y los
// supuestos), para que no se pierda al recargar. Se guarda con labs-storage.ts (clave `sets`), como
// texto: la expresión y cada supuesto en su forma escrita, que se vuelven a leer al cargar.
import { MAX_SET_EXPR_LENGTH } from "../../../../shared/sets/expr.ts";
import { MAX_HYPOTHESES } from "../../../../shared/sets/relations.ts";
import { readLabItem, writeLabItem } from "../labs-storage.ts";

export type VennDraft = {
  v: 1;
  /** Id de la expresión de la lista, o «propia». */
  choice: string;
  /** Lo escrito en «Tu expresión». */
  own: string;
  /** La expresión en uso (con «propia», la última que se aceptó). */
  expr: string;
  /** Supuestos, cada uno como texto (A ⊆ B). */
  hyps: string[];
};

const MAX_BYTES = 8 * 1024;
const str = (x: unknown, max: number): x is string => typeof x === "string" && x.length <= max;

export function parseVennDraft(raw: string | null): VennDraft | null {
  if (raw === null || raw.length > MAX_BYTES) return null;
  let d: unknown;
  try {
    d = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof d !== "object" || d === null) return null;
  const o = d as Record<string, unknown>;
  if (o.v !== 1 || !str(o.choice, 64) || !str(o.own, MAX_SET_EXPR_LENGTH) || !str(o.expr, MAX_SET_EXPR_LENGTH)) return null;
  if (!Array.isArray(o.hyps) || o.hyps.length > MAX_HYPOTHESES || !o.hyps.every((h) => str(h, 2 * MAX_SET_EXPR_LENGTH))) return null;
  return { v: 1, choice: o.choice, own: o.own, expr: o.expr, hyps: o.hyps as string[] };
}

export const loadVennDraft = (): VennDraft | null => parseVennDraft(readLabItem("sets"));

export function saveVennDraft(d: Omit<VennDraft, "v">): void {
  writeLabItem("sets", JSON.stringify({ v: 1, ...d }));
}
