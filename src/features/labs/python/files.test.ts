// Archivos subidos y del anfitrión: nombres y rutas seguros, tipos y límites (20 MB cada uno, 50 MB
// en total y 30 archivos por defecto; el anfitrión los puede cambiar, acotados).
import { afterEach, describe, expect, it } from "vitest";
import { configureLabs } from "../labs-storage.ts";
import {
  baseName,
  checkHostFile,
  checkUpload,
  fmtBytes,
  MAX_FILE_BYTES,
  MAX_FILES,
  MAX_PATH_DEPTH,
  MAX_TOTAL_BYTES,
  mimeFor,
  safeFileName,
  safeFilePath,
} from "./files.ts";
import { CAP_FILE_BYTES, CAP_FILES, CAP_TOTAL_BYTES, fileLimits } from "./python-config.ts";

afterEach(() => configureLabs());

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

describe("safeFilePath (rutas del anfitrión)", () => {
  it.each([
    ["datos.csv", "datos.csv"],
    ["datos/ventas.csv", "datos/ventas.csv"],
    ["img/tema/a b.png", "img/tema/a b.png"],
    ["modelos/red.caffemodel", "modelos/red.caffemodel"],
    ["programa.py", "programa.py"],
    ["cafe\u0301.txt", "caf\u00e9.txt"],
  ])("acepta %j", (raw, want) => {
    expect(safeFilePath(raw)).toBe(want);
  });

  it.each([
    "",
    "/etc/passwd",
    "../fuera.txt",
    "datos/../../fuera.txt",
    "datos/./a.csv",
    "./a.csv",
    "datos//a.csv",
    "datos/",
    "datos\\a.csv",
    "C:\\datos\\a.csv",
    "c:/datos.csv",
    ".oculto",
    "datos/.git/config",
    "a\u0000b.txt",
    "a\nb.txt",
    "a\u007fb.txt",
    " datos/a.csv",
    "datos /a.csv",
    "a?.txt",
    "a*.txt",
    `${"x".repeat(121)}.txt`,
    `${Array.from({ length: MAX_PATH_DEPTH }, () => "d").join("/")}/a.txt`,
    `${Array.from({ length: 4 }, () => "d".repeat(100)).join("/")}/a.txt`,
  ])("rechaza %j", (raw) => {
    expect(safeFilePath(raw)).toBeNull();
  });

  it("rechaza lo que no es una cadena", () => {
    for (const v of [null, undefined, 3, {}, ["a"]]) expect(safeFilePath(v)).toBeNull();
  });

  it("baseName da el nombre con el que se descarga", () => {
    expect(baseName("datos/ventas.csv")).toBe("ventas.csv");
    expect(baseName("a.txt")).toBe("a.txt");
  });
});

describe("checkHostFile", () => {
  it("cualquier extensión y con carpetas; la misma ruta sustituye", () => {
    for (const path of ["datos/data.csv", "modelos/red.prototxt", "programa.py", "x.bin"]) {
      expect(checkHostFile([], { path, size: 10 }), path).toEqual({ ok: true, name: path, replaces: false });
    }
    expect(checkHostFile([{ name: "datos/data.csv", size: 5 }], { path: "datos/data.csv", size: 10 })).toMatchObject({ ok: true, replaces: true });
  });

  it("una ruta no válida: reason name, con la ruta legible en el mensaje", () => {
    const r = checkHostFile([], { path: "../a\u0000.csv", size: 1 });
    expect(r).toEqual({ ok: false, reason: "name", message: "«../a?.csv» no es una ruta válida dentro de la carpeta de trabajo." });
  });

  it("una ruta no puede ser archivo y carpeta a la vez", () => {
    expect(checkHostFile([{ name: "datos", size: 1 }], { path: "datos/a.csv", size: 1 })).toMatchObject({ ok: false, reason: "name" });
    expect(checkHostFile([{ name: "datos/a.csv", size: 1 }], { path: "datos", size: 1 })).toMatchObject({ ok: false, reason: "name" });
    expect(checkUpload([{ name: "datos.csv/a.csv", size: 1 }], { name: "datos.csv", size: 1 })).toMatchObject({ ok: false, reason: "name" });
    expect(checkHostFile([{ name: "datos2/a.csv", size: 1 }], { path: "datos/a.csv", size: 1 }).ok).toBe(true);
  });

  it("los mismos límites que las subidas, con lo que ya hay", () => {
    expect(checkHostFile([], { path: "a.bin", size: MAX_FILE_BYTES + 1 })).toMatchObject({ ok: false, reason: "size" });
    expect(checkHostFile([{ name: "a.csv", size: 40 * MB }], { path: "res/b.csv", size: 11 * MB })).toMatchObject({ ok: false, reason: "total" });
    const many = Array.from({ length: MAX_FILES }, (_, i) => ({ name: `f${i}.txt`, size: 1 }));
    expect(checkHostFile(many, { path: "res/otro.txt", size: 1 })).toMatchObject({ ok: false, reason: "count" });
  });
});

describe("límites configurables", () => {
  it("por defecto 20 MB, 50 MB y 30 archivos", () => {
    expect(fileLimits()).toEqual({ maxFileBytes: 20 * MB, maxTotalBytes: 50 * MB, maxFiles: 30 });
  });

  it("el anfitrión los cambia con configureLabs, acotados a 50 MB, 200 MB y 500", () => {
    configureLabs({ python: { maxTotalBytes: 120 * MB, maxFileBytes: 30 * MB, maxFiles: 100 } });
    expect(fileLimits()).toEqual({ maxFileBytes: 30 * MB, maxTotalBytes: 120 * MB, maxFiles: 100 });
    expect(checkHostFile([{ name: "a.bin", size: 45 * MB }], { path: "res/b.bin", size: 25 * MB }).ok).toBe(true);
    expect(checkUpload([], { name: "a.csv", size: 25 * MB }).ok).toBe(true);
    configureLabs({ python: { maxTotalBytes: 10_000 * MB, maxFileBytes: 1e12, maxFiles: 1e6 } });
    expect(fileLimits()).toEqual({ maxFileBytes: CAP_FILE_BYTES, maxTotalBytes: CAP_TOTAL_BYTES, maxFiles: CAP_FILES });
    expect([CAP_FILE_BYTES, CAP_TOTAL_BYTES, CAP_FILES]).toEqual([50 * MB, 200 * MB, 500]);
  });

  it("valores no válidos vuelven al de por defecto; configureLabs() los restablece", () => {
    configureLabs({ python: { maxTotalBytes: -1, maxFileBytes: Number.NaN, maxFiles: "40" as unknown as number } });
    expect(fileLimits()).toEqual({ maxFileBytes: MAX_FILE_BYTES, maxTotalBytes: MAX_TOTAL_BYTES, maxFiles: MAX_FILES });
    configureLabs({ python: { maxFiles: 5.7 } });
    expect(fileLimits().maxFiles).toBe(5);
    configureLabs();
    expect(fileLimits().maxFiles).toBe(MAX_FILES);
  });

  it("un límite más bajo también vale (los mensajes dicen el efectivo)", () => {
    configureLabs({ python: { maxFileBytes: MB } });
    expect(checkUpload([], { name: "a.csv", size: 2 * MB })).toMatchObject({
      ok: false,
      message: "«a.csv» ocupa 2,0 MB; el máximo por archivo es 1,0 MB.",
    });
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
