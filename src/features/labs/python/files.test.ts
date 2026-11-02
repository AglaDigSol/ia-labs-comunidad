// Archivos subidos: nombres seguros, tipos y límites (20 MB cada uno, 50 MB en total, 30 archivos).
import { describe, expect, it } from "vitest";
import { checkUpload, fmtBytes, MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES, mimeFor, safeFileName } from "./files.ts";

const MB = 1024 * 1024;

describe("safeFileName", () => {
  it("solo el nombre, sin rutas, control ni punto inicial", () => {
    expect(safeFileName("C:\\Users\\x\\datos.csv")).toBe("datos.csv");
    expect(safeFileName("../../etc/passwd.txt")).toBe("passwd.txt");
    expect(safeFileName(".oculto.txt")).toBe("oculto.txt");
    expect(safeFileName("a\u0000b?.txt")).toBe("a_b_.txt");
    expect(safeFileName("notas  finales .txt")).toBe("notas finales .txt");
    expect(safeFileName("..")).toBeNull();
    expect(safeFileName("")).toBeNull();
  });

  it("recorta a 120 caracteres conservando la extensión", () => {
    const n = safeFileName(`${"x".repeat(200)}.csv`)!;
    expect(n).toHaveLength(120);
    expect(n.endsWith(".csv")).toBe(true);
  });
});

describe("checkUpload", () => {
  it("acepta CSV, TXT e imágenes", () => {
    for (const name of ["datos.csv", "texto.TXT", "foto.jpg", "img.png", "x.json", "t.tsv", "w.webp"]) {
      expect(checkUpload([], { name, size: 10 }).ok, name).toBe(true);
    }
  });

  it("rechaza otros tipos", () => {
    const r = checkUpload([], { name: "programa.exe", size: 10 });
    expect(r).toMatchObject({ ok: false, reason: "type" });
  });

  it("20 MB por archivo", () => {
    expect(checkUpload([], { name: "a.csv", size: MAX_FILE_BYTES }).ok).toBe(true);
    const r = checkUpload([], { name: "a.csv", size: MAX_FILE_BYTES + 1 });
    expect(r).toMatchObject({ ok: false, reason: "size" });
    expect(!r.ok && r.message).toBe("«a.csv» ocupa 20,0 MB; el máximo por archivo es 20,0 MB.");
  });

  it("50 MB en total; sustituir un archivo libera su tamaño", () => {
    const existing = [
      { name: "a.csv", size: 20 * MB },
      { name: "b.csv", size: 20 * MB },
    ];
    expect(checkUpload(existing, { name: "c.csv", size: 10 * MB }).ok).toBe(true);
    expect(checkUpload(existing, { name: "c.csv", size: 10 * MB + 1 })).toMatchObject({ ok: false, reason: "total" });
    expect(checkUpload(existing, { name: "a.csv", size: 20 * MB })).toEqual({ ok: true, name: "a.csv", replaces: true });
    expect(MAX_TOTAL_BYTES).toBe(50 * MB);
  });

  it(`como mucho ${MAX_FILES} archivos`, () => {
    const many = Array.from({ length: MAX_FILES }, (_, i) => ({ name: `f${i}.txt`, size: 1 }));
    expect(checkUpload(many, { name: "otro.txt", size: 1 })).toMatchObject({ ok: false, reason: "count" });
    expect(checkUpload(many, { name: "f0.txt", size: 1 }).ok).toBe(true);
  });
});

describe("formato y tipos", () => {
  it("fmtBytes en español", () => {
    expect(fmtBytes(512)).toBe("512 B");
    expect(fmtBytes(2048)).toBe("2 KB");
    expect(fmtBytes(5 * MB + MB / 2)).toBe("5,5 MB");
  });

  it("HTML y SVG se descargan como binario", () => {
    expect(mimeFor("a.csv")).toBe("text/csv");
    expect(mimeFor("mapa.html")).toBe("application/octet-stream");
    expect(mimeFor("x.svg")).toBe("application/octet-stream");
  });
});
