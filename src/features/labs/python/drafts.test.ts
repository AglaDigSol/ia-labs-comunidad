// @vitest-environment jsdom
// Borradores de «Abrir en Python»: límites, aviso de una vez, datos corruptos y clave configurable.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configureLabs } from "../labs-storage.ts";
import {
  consumeFreshDraft,
  createDraft,
  draftLabel,
  getDraft,
  listDrafts,
  MAX_DRAFT_CODE,
  MAX_DRAFTS,
  MAX_SOURCE_PATH,
  updateDraftCode,
  validSource,
} from "./drafts.ts";
import { DEFAULT_DRAFTS_KEY } from "./python-config.ts";

const DRAFTS_KEY = DEFAULT_DRAFTS_KEY;

beforeEach(() => localStorage.clear());
afterEach(() => {
  localStorage.clear();
  configureLabs();
});

const cell = (n: number) => ({ kind: "cell" as const, notebookTitle: "Tensores", cell: n });

describe("drafts", () => {
  it("crea con id d_ + 10 [a-z0-9], etiqueta y fresh; lista del más nuevo al más antiguo", () => {
    const a = createDraft({ origin: cell(1), code: "a = 1" });
    const b = createDraft({ origin: { kind: "file", fileName: "utils.py" }, code: "b = 2" });
    expect(a).toMatch(/^d_[a-z0-9]{10}$/);
    expect(listDrafts().map((d) => d.id)).toEqual([b, a]);
    expect(getDraft(a)).toMatchObject({ label: "Celda 1 · Tensores", code: "a = 1", fresh: true });
    expect(getDraft(b)!.label).toBe("utils.py");
    expect(draftLabel(cell(12))).toBe("Celda 12 · Tensores");
    expect(JSON.parse(localStorage.getItem(DRAFTS_KEY)!)).toHaveLength(2);
  });

  it(`guarda como máximo ${MAX_DRAFTS}: el undécimo sustituye al más antiguo`, () => {
    const ids = Array.from({ length: 11 }, (_, i) => createDraft({ origin: cell(i + 1), code: `x = ${i}` }));
    const list = listDrafts();
    expect(list).toHaveLength(10);
    expect(getDraft(ids[0]!)).toBeNull();
    expect(list[0]!.id).toBe(ids[10]);
    expect(list[9]!.id).toBe(ids[1]);
  });

  it("recorta el código a 100 000 caracteres", () => {
    const id = createDraft({ origin: cell(1), code: "x".repeat(150_000) });
    expect(getDraft(id)!.code).toHaveLength(MAX_DRAFT_CODE);
    updateDraftCode(id, "y".repeat(120_000));
    expect(getDraft(id)!.code).toHaveLength(MAX_DRAFT_CODE);
  });

  it("consumeFreshDraft devuelve el origen una sola vez", () => {
    const id = createDraft({ origin: cell(12), code: "z" });
    expect(consumeFreshDraft(id)).toEqual(cell(12));
    expect(consumeFreshDraft(id)).toBeNull();
    expect(getDraft(id)!.fresh).toBe(false);
    expect(consumeFreshDraft("d_noexiste00")).toBeNull();
  });

  it("updateDraftCode guarda la edición; un id desconocido no hace nada", () => {
    const id = createDraft({ origin: cell(3), code: "a" });
    updateDraftCode(id, "b");
    expect(getDraft(id)!.code).toBe("b");
    updateDraftCode("d_zzzzzzzzzz", "c");
    expect(listDrafts()).toHaveLength(1);
  });

  it("datos corruptos o ajenos en localStorage se ignoran sin lanzar", () => {
    localStorage.setItem(DRAFTS_KEY, "{no json");
    expect(listDrafts()).toEqual([]);
    localStorage.setItem(
      DRAFTS_KEY,
      JSON.stringify([{ id: "x" }, { id: "d_abcdefghij", label: 1 }, null, "s", { id: "d_0123456789", label: "ok", origin: { kind: "file", fileName: "a.py" }, code: "1", createdAt: "2026-10-28T00:00:00.000Z", fresh: false }]),
    );
    expect(listDrafts().map((d) => d.id)).toEqual(["d_0123456789"]);
    expect(getDraft("__proto__")).toBeNull();
  });

  it("origin.source: se guarda y se devuelve; uno no válido se descarta", () => {
    const source = { kind: "repo", path: "notebooks/tema1.ipynb" };
    const a = createDraft({ origin: { ...cell(4), source }, code: "a" });
    const b = createDraft({ origin: { kind: "file", fileName: "utils.py", source: { kind: "repo", path: "src/utils.py" } }, code: "b" });
    expect(getDraft(a)!.origin).toEqual({ ...cell(4), source });
    expect(getDraft(b)!.origin).toEqual({ kind: "file", fileName: "utils.py", source: { kind: "repo", path: "src/utils.py" } });
    expect(getDraft(a)!.label).toBe("Celda 4 · Tensores");
    expect(consumeFreshDraft(a)).toEqual({ ...cell(4), source });
    for (const bad of [{ kind: "", path: "x" }, { kind: "repo", path: "a\u0000b" }, { kind: "x".repeat(33), path: "a" }, { kind: "repo", path: "x".repeat(MAX_SOURCE_PATH + 1) }, { kind: "repo" }]) {
      expect(validSource(bad), JSON.stringify(bad)).toBe(false);
      const id = createDraft({ origin: { ...cell(1), source: bad as { kind: string; path: string } }, code: "c" });
      expect(getDraft(id)!.origin).toEqual(cell(1));
    }
    // Los campos que sobran no se copian.
    const c = createDraft({ origin: { ...cell(2), source: { kind: "repo", path: "a.ipynb", token: "x" } as never }, code: "d" });
    expect(getDraft(c)!.origin.source).toEqual({ kind: "repo", path: "a.ipynb" });
  });

  it("los borradores anteriores (sin source) siguen siendo válidos; un source corrupto invalida el borrador", () => {
    const old = { id: "d_0123456789", label: "Celda 1 · T", origin: { kind: "cell", notebookTitle: "T", cell: 1 }, code: "1", createdAt: "2026-10-28T00:00:00.000Z", fresh: false };
    const bad = { ...old, id: "d_abcdefghij", origin: { ...old.origin, source: { kind: 1, path: "x" } } };
    localStorage.setItem(DRAFTS_KEY, JSON.stringify([old, bad]));
    expect(listDrafts().map((d) => d.id)).toEqual(["d_0123456789"]);
    expect(getDraft("d_0123456789")!.origin.source).toBeUndefined();
  });

  it("la clave por defecto es ia-labs.py.drafts y una app anfitriona puede usar la suya", () => {
    expect(DRAFTS_KEY).toBe("ia-labs.py.drafts");
    configureLabs({ python: { draftsKey: "mi-app.py.drafts" } });
    const id = createDraft({ origin: cell(2), code: "y = 2" });
    expect(localStorage.getItem("ia-labs.py.drafts")).toBeNull();
    expect(JSON.parse(localStorage.getItem("mi-app.py.drafts")!)[0].id).toBe(id);
    expect(getDraft(id)!.code).toBe("y = 2");
    configureLabs();
    expect(getDraft(id)).toBeNull();
  });
});
