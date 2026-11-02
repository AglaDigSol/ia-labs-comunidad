// Borradores de «Abrir en Python», guardados solo en este dispositivo.
// Una app anfitriona convierte una celda de un cuaderno o un archivo .py en un borrador nuevo con
// createDraft y navega a la pestaña Python con ?borrador={id}. La pestaña lo abre en el editor y nunca
// lo ejecuta sola. Como mucho MAX_DRAFTS por dispositivo (el más antiguo se sustituye) y el código se
// recorta a MAX_DRAFT_CODE caracteres. Nada sale del dispositivo.
// La clave de localStorage es configurable: configureLabs({ python: { draftsKey } }).
import { draftsKey } from "./python-config.ts";
export const MAX_DRAFTS = 10;
export const MAX_DRAFT_CODE = 100_000;
const MAX_NAME = 200;

export type DraftOrigin = { kind: "cell"; notebookTitle: string; cell: number } | { kind: "file"; fileName: string };

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

function validOrigin(o: unknown): o is DraftOrigin {
  if (!o || typeof o !== "object") return false;
  const r = o as Record<string, unknown>;
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

export function createDraft(input: { origin: DraftOrigin; code: string }): string {
  const origin: DraftOrigin =
    input.origin.kind === "cell"
      ? { kind: "cell", notebookTitle: input.origin.notebookTitle.slice(0, MAX_NAME), cell: input.origin.cell }
      : { kind: "file", fileName: input.origin.fileName.slice(0, MAX_NAME) };
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
