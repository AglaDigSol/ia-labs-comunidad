// Borradores de «Abrir en Python», guardados solo en este dispositivo.
// Una app anfitriona convierte una celda de un cuaderno o un archivo .py en un borrador nuevo con
// createDraft y navega a la pestaña Python con ?borrador={id}. La pestaña lo abre en el editor y nunca
// lo ejecuta sola. Como mucho MAX_DRAFTS por dispositivo (el más antiguo se sustituye) y el código se
// recorta a MAX_DRAFT_CODE caracteres. Nada sale del dispositivo.
// La clave de localStorage es configurable: configureLabs({ python: { draftsKey } }).
// El origen puede llevar `source` (de qué archivo del anfitrión viene, por ejemplo { kind: "repo",
// path: "notebooks/tema1.ipynb" }); la pestaña no lo usa, solo lo devuelve en las ranuras del anfitrión.
import { draftsKey } from "./python-config.ts";
export const MAX_DRAFTS = 10;
export const MAX_DRAFT_CODE = 100_000;
const MAX_NAME = 200;
/** Longitud máxima de source.kind y de source.path. */
export const MAX_SOURCE_KIND = 32;
export const MAX_SOURCE_PATH = 500;

/** De dónde viene el borrador en la app anfitriona (opcional; los borradores anteriores a 0.8.1 no lo tienen). */
export type DraftSource = { kind: string; path: string };

export type DraftOrigin =
  | { kind: "cell"; notebookTitle: string; cell: number; source?: DraftSource }
  | { kind: "file"; fileName: string; source?: DraftSource };

export type Draft = {
  id: string;
  label: string;
  origin: DraftOrigin;
  code: string;
  createdAt: string;
  /** true hasta que la pestaña Python ha mostrado una vez el aviso «abierta como borrador nuevo». */
  fresh: boolean;
};

const ID_RE = /^d_[a-z0-9]{10}$/;
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function draftLabel(origin: DraftOrigin): string {
  return origin.kind === "cell" ? `Celda ${origin.cell} · ${origin.notebookTitle}` : origin.fileName;
}

function newId(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let id = "d_";
  for (const b of bytes) id += ALPHABET[b % ALPHABET.length];
  return id;
}

const hasControl = (s: string) => [...s].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127);
const validText = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.trim() !== "" && v.length <= max && !hasControl(v);

/** ¿Es un source válido? Cadenas cortas, no vacías y sin caracteres de control. */
export function validSource(s: unknown): s is DraftSource {
  if (!s || typeof s !== "object") return false;
  const r = s as Record<string, unknown>;
  return validText(r.kind, MAX_SOURCE_KIND) && validText(r.path, MAX_SOURCE_PATH);
}

function validOrigin(o: unknown): o is DraftOrigin {
  if (!o || typeof o !== "object") return false;
  const r = o as Record<string, unknown>;
  if (r.source !== undefined && !validSource(r.source)) return false;
  if (r.kind === "cell") {
    return typeof r.notebookTitle === "string" && typeof r.cell === "number" && Number.isInteger(r.cell) && r.cell >= 0;
  }
  return r.kind === "file" && typeof r.fileName === "string";
}

function validDraft(d: unknown): d is Draft {
  if (!d || typeof d !== "object") return false;
  const r = d as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    ID_RE.test(r.id) &&
    typeof r.label === "string" &&
    validOrigin(r.origin) &&
    typeof r.code === "string" &&
    typeof r.createdAt === "string" &&
    typeof r.fresh === "boolean"
  );
}

function read(): Draft[] {
  try {
    const raw = localStorage.getItem(draftsKey());
    if (!raw) return [];
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter(validDraft).slice(0, MAX_DRAFTS) : [];
  } catch {
    return [];
  }
}

/** Guarda del más nuevo al más antiguo; si no cabe, quita los más antiguos (el más nuevo siempre queda). */
function write(list: Draft[]): void {
  let keep = list.slice(0, MAX_DRAFTS);
  for (;;) {
    try {
      localStorage.setItem(draftsKey(), JSON.stringify(keep));
      return;
    } catch {
      if (keep.length <= 1) return;
      keep = keep.slice(0, -1);
    }
  }
}

/** Del más nuevo al más antiguo. */
export function listDrafts(): Draft[] {
  return read();
}

export function getDraft(id: string): Draft | null {
  if (!ID_RE.test(id)) return null;
  return read().find((d) => d.id === id) ?? null;
}

/** Crea un borrador nuevo y devuelve su id. Un source que no es válido se descarta (el borrador se crea igual). */
export function createDraft(input: { origin: DraftOrigin; code: string }): string {
  const src = input.origin.source;
  const source = validSource(src) ? { source: { kind: src.kind, path: src.path } } : {};
  const origin: DraftOrigin =
    input.origin.kind === "cell"
      ? { kind: "cell", notebookTitle: input.origin.notebookTitle.slice(0, MAX_NAME), cell: input.origin.cell, ...source }
      : { kind: "file", fileName: input.origin.fileName.slice(0, MAX_NAME), ...source };
  const draft: Draft = {
    id: newId(),
    label: draftLabel(origin),
    origin,
    code: input.code.slice(0, MAX_DRAFT_CODE),
    createdAt: new Date().toISOString(),
    fresh: true,
  };
  write([draft, ...read()]);
  return draft.id;
}

export function updateDraftCode(id: string, code: string): void {
  const list = read();
  const d = list.find((x) => x.id === id);
  if (!d) return;
  d.code = code.slice(0, MAX_DRAFT_CODE);
  write(list);
}

/** El origen la primera vez que se abre un borrador nuevo (para el aviso); null después o si no existe. */
export function consumeFreshDraft(id: string): DraftOrigin | null {
  const list = read();
  const d = list.find((x) => x.id === id);
  if (!d || !d.fresh) return null;
  d.fresh = false;
  write(list);
  return d.origin;
}
