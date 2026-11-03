// Operaciones del worker sobre la carpeta de trabajo con un FS falso (como el de Emscripten): carpetas,
// lista recursiva, lectura, borrado y «Vaciar archivos», sin salir nunca de la carpeta.
import { describe, expect, it } from "vitest";
import { clearTree, listTree, MAX_LISTED, readTree, relParts, removeTree, writeTree, type TreeFS } from "./fs-tree.ts";

const FILE = 0o100000;
const DIR = 0o040000;
const ROOT = "/home/pyodide";

/** FS en memoria con el comportamiento de Emscripten que importa aquí (readdir con «.» y «..»). */
class FakeFS implements TreeFS {
  nodes = new Map<string, { dir: true } | { dir: false; data: Uint8Array }>([
    ["/", { dir: true }],
    ["/home", { dir: true }],
    [ROOT, { dir: true }],
  ]);
  private parent = (p: string) => p.slice(0, p.lastIndexOf("/")) || "/";
  private need(p: string) {
    const n = this.nodes.get(p);
    if (!n) throw new Error(`ENOENT ${p}`);
    return n;
  }
  readdir(p: string) {
    if (!this.need(p).dir) throw new Error("ENOTDIR");
    const kids = [...this.nodes.keys()].filter((k) => k !== p && this.parent(k) === p).map((k) => k.slice(p.length + 1));
    return [".", "..", ...kids];
  }
  stat(p: string) {
    const n = this.need(p);
    return { mode: n.dir ? DIR : FILE, size: n.dir ? 4096 : n.data.byteLength };
  }
  isFile = (m: number) => m === FILE;
  isDir = (m: number) => m === DIR;
  mkdirTree(p: string) {
    let cur = "";
    for (const part of p.split("/").filter(Boolean)) {
      cur += `/${part}`;
      const n = this.nodes.get(cur);
      if (n && !n.dir) throw new Error("EEXIST");
      if (!n) this.nodes.set(cur, { dir: true });
    }
  }
  writeFile(p: string, data: Uint8Array) {
    if (!this.need(this.parent(p)).dir) throw new Error("ENOTDIR");
    if (this.nodes.get(p)?.dir) throw new Error("EISDIR");
    this.nodes.set(p, { dir: false, data });
  }
  readFile(p: string) {
    const n = this.need(p);
    if (n.dir) throw new Error("EISDIR");
    return n.data;
  }
  unlink(p: string) {
    if (this.need(p).dir) throw new Error("EISDIR");
    this.nodes.delete(p);
  }
  rmdir(p: string) {
    if (this.readdir(p).length > 2) throw new Error("ENOTEMPTY");
    this.nodes.delete(p);
  }
}

const bytes = (s: string) => new TextEncoder().encode(s);
const text = (b: Uint8Array | null) => (b ? new TextDecoder().decode(b) : null);

describe("fs-tree", () => {
  it("writeTree crea las carpetas y escribe dentro de la carpeta de trabajo", () => {
    const fs = new FakeFS();
    writeTree(fs, ROOT, "res/data.csv", bytes("a,b\n1,2\n"));
    writeTree(fs, ROOT, "img/tema/x.png", bytes("PNG"));
    writeTree(fs, ROOT, "notas.txt", bytes("hola"));
    expect(fs.nodes.get(`${ROOT}/res`)).toEqual({ dir: true });
    expect(text(readTree(fs, ROOT, "res/data.csv"))).toBe("a,b\n1,2\n");
    expect(text(readTree(fs, ROOT, "img/tema/x.png"))).toBe("PNG");
    // Sustituir: el mismo archivo con otro contenido.
    writeTree(fs, ROOT, "res/data.csv", bytes("x"));
    expect(text(readTree(fs, ROOT, "res/data.csv"))).toBe("x");
  });

  it("writeTree rechaza rutas que salen de la carpeta o no son seguras, sin tocar el FS", () => {
    const fs = new FakeFS();
    const before = [...fs.nodes.keys()];
    for (const bad of ["../fuera.txt", "/etc/passwd", "a/../../b", "a//b", ".oculto", "a\\b", "a\u0000b", "./a"]) {
      expect(() => writeTree(fs, ROOT, bad, bytes("x")), bad).toThrow(/ruta no válida/);
    }
    expect([...fs.nodes.keys()]).toEqual(before);
  });

  it("writeTree lanza si una carpeta de la ruta ya es un archivo", () => {
    const fs = new FakeFS();
    writeTree(fs, ROOT, "res", bytes("soy un archivo"));
    expect(() => writeTree(fs, ROOT, "res/a.csv", bytes("x"))).toThrow();
  });

  it("listTree es recursiva, ordenada, con rutas relativas, y salta lo oculto", () => {
    const fs = new FakeFS();
    writeTree(fs, ROOT, "res/data.csv", bytes("123"));
    writeTree(fs, ROOT, "res/sub/b.txt", bytes("1"));
    writeTree(fs, ROOT, "a.txt", bytes("12"));
    fs.mkdirTree(`${ROOT}/.cache/matplotlib`);
    fs.writeFile(`${ROOT}/.cache/matplotlib/fontlist.json`, bytes("{}"));
    fs.mkdirTree(`${ROOT}/vacia`);
    expect(listTree(fs, ROOT)).toEqual([
      { name: "a.txt", size: 2 },
      { name: "res/data.csv", size: 3 },
      { name: "res/sub/b.txt", size: 1 },
    ]);
  });

  it(`listTree devuelve como mucho ${MAX_LISTED} archivos y no baja más de 8 niveles`, () => {
    const fs = new FakeFS();
    for (let i = 0; i < 12; i++) writeTree(fs, ROOT, `f${String(i).padStart(2, "0")}.txt`, bytes("x"));
    expect(listTree(fs, ROOT, 5)).toHaveLength(5);
    fs.mkdirTree(`${ROOT}/1/2/3/4/5/6/7/8/9`);
    fs.writeFile(`${ROOT}/1/2/3/4/5/6/7/8/9/hondo.txt`, bytes("x"));
    fs.writeFile(`${ROOT}/1/2/3/4/5/6/7/ok.txt`, bytes("x"));
    const names = listTree(fs, ROOT).map((f) => f.name);
    expect(names).toContain("1/2/3/4/5/6/7/ok.txt");
    expect(names.some((n) => n.endsWith("hondo.txt"))).toBe(false);
  });

  it("readTree: archivos anidados y los que crea el código; null para carpetas, ausentes y rutas que salen", () => {
    const fs = new FakeFS();
    writeTree(fs, ROOT, "res/data.csv", bytes("ok"));
    fs.writeFile(`${ROOT}/resultado?.csv`, bytes("del código"));
    fs.writeFile("/home/secreto.txt", bytes("no"));
    expect(text(readTree(fs, ROOT, "res/data.csv"))).toBe("ok");
    expect(text(readTree(fs, ROOT, "resultado?.csv"))).toBe("del código");
    expect(readTree(fs, ROOT, "res")).toBeNull();
    expect(readTree(fs, ROOT, "no.txt")).toBeNull();
    expect(readTree(fs, ROOT, "../secreto.txt")).toBeNull();
    expect(readTree(fs, ROOT, "/home/secreto.txt")).toBeNull();
    expect(relParts("a/./b")).toBeNull();
    expect(relParts("a/b")).toEqual(["a", "b"]);
  });

  it("removeTree borra el archivo y las carpetas que se quedan vacías, nunca la carpeta de trabajo", () => {
    const fs = new FakeFS();
    writeTree(fs, ROOT, "res/sub/a.csv", bytes("1"));
    writeTree(fs, ROOT, "res/b.csv", bytes("2"));
    expect(removeTree(fs, ROOT, "res/sub/a.csv")).toBe(true);
    expect(fs.nodes.has(`${ROOT}/res/sub`)).toBe(false);
    expect(fs.nodes.has(`${ROOT}/res`)).toBe(true);
    expect(removeTree(fs, ROOT, "res/b.csv")).toBe(true);
    expect(fs.nodes.has(`${ROOT}/res`)).toBe(false);
    expect(fs.nodes.has(ROOT)).toBe(true);
    expect(removeTree(fs, ROOT, "res/b.csv")).toBe(false);
    expect(removeTree(fs, ROOT, "..")).toBe(false);
  });

  it("clearTree vacía lo visible (con carpetas) y deja lo oculto", () => {
    const fs = new FakeFS();
    writeTree(fs, ROOT, "res/data.csv", bytes("1"));
    writeTree(fs, ROOT, "img/oop/x.png", bytes("2"));
    writeTree(fs, ROOT, "datos.csv", bytes("3"));
    fs.mkdirTree(`${ROOT}/.config`);
    fs.writeFile(`${ROOT}/.config/x`, bytes("4"));
    clearTree(fs, ROOT);
    expect(listTree(fs, ROOT)).toEqual([]);
    expect([...fs.nodes.keys()].filter((k) => k.startsWith(`${ROOT}/`)).sort()).toEqual([`${ROOT}/.config`, `${ROOT}/.config/x`]);
  });
});
