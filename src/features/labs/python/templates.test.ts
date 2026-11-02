// Plantillas: catálogo, contenido genérico (sin respuestas de actividades evaluables) y que compilan
// y se ejecutan con el Python real de node_modules/pyodide.
import type { PyodideInterface } from "pyodide";
import { beforeAll, describe, expect, it } from "vitest";
import { TEMPLATES } from "./templates.ts";

const byId = (id: string) => {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`falta la plantilla ${id}`);
  return t.code;
};

/** Las que trabajan con archivos: crean el suyo si no lo has subido. */
const WITH_FILES = new Set(["ficheros", "pandas-csv"]);

describe("TEMPLATES: catálogo", () => {
  it("ids y etiquetas exactas y en orden", () => {
    expect(TEMPLATES.map((t) => [t.id, t.label])).toEqual([
      ["blank", "En blanco"],
      ["tipos", "Tipos de datos"],
      ["control", "Control de flujo"],
      ["funciones", "Funciones"],
      ["generadores", "Generadores"],
      ["ficheros", "Ficheros"],
      ["numpy", "NumPy básico"],
      ["vectorizacion", "Vectorización NumPy"],
      ["minmax", "Min-Max"],
      ["pandas", "Limpieza con pandas"],
      ["pandas-csv", "pandas con tu CSV"],
      ["seaborn", "Gráficos con seaborn"],
      ["perceptron", "PerceptronSimple"],
    ]);
  });

  it("ninguna plantilla menciona Evidencias, soluciones ni entregables", () => {
    for (const t of TEMPLATES) expect(t.code).not.toMatch(/evidencia|soluci[oó]n|entregable/i);
  });

  it("sin URL ni internet; solo «Ficheros» y «pandas con tu CSV» usan archivos, y crean el suyo si falta", () => {
    for (const t of TEMPLATES) {
      expect(t.code).not.toMatch(/https?:\/\/|sns\.load_dataset\(|urlopen\(|requests\./);
      if (WITH_FILES.has(t.id)) {
        expect(t.code).toMatch(/os\.path\.exists\(NOMBRE\)/);
        expect(t.code).toContain("Subir archivo");
      } else {
        expect(t.code).not.toMatch(/read_csv|read_excel|open\(|np\.load|loadtxt|\.csv|\.xlsx/);
      }
    }
  });

  it("menos de 80 líneas, sangría de 4 espacios y sin tabuladores", () => {
    for (const t of TEMPLATES) {
      const lines = t.code.split("\n");
      expect(lines.length, t.id).toBeLessThan(80);
      expect(t.code).not.toContain("\t");
      for (const l of lines) expect(/^( *)/.exec(l)![1]!.length % 4, `${t.id}: ${l}`).toBe(0);
    }
  });

  it("las plantillas no vacías llevan comentarios en español", () => {
    for (const t of TEMPLATES.filter((x) => x.id !== "blank")) {
      expect(t.code).toMatch(/^# /m);
      expect(t.code.match(/^\s*# /gm)!.length, t.id).toBeGreaterThanOrEqual(3);
    }
  });

  it("Min-Max: escala a [0, 1] a mano, lo compara con la versión vectorizada y grafica antes/después", () => {
    const c = byId("minmax");
    expect(c).toContain("import numpy as np");
    expect(c).toContain("import matplotlib.pyplot as plt");
    expect(c).toMatch(/for .* in /);
    expect(c).toMatch(/np\.allclose/);
  });

  it("PerceptronSimple: clase con fit/predict, regla w ← w + η(y − ŷ)x, tabla AND y frontera", () => {
    const c = byId("perceptron");
    expect(c).toMatch(/class PerceptronSimple/);
    expect(c).toContain("w ← w + η(y − ŷ)x");
    expect(c).toMatch(/np\.array\(\[\[0, 0\], \[0, 1\], \[1, 0\], \[1, 1\]\]\)/);
  });

  it("Limpieza con pandas: DataFrame en línea con NaN, duplicados y números en texto", () => {
    const c = byId("pandas");
    for (const s of ["pd.DataFrame", "np.nan", "dropna", "fillna", "drop_duplicates", "astype"]) expect(c).toContain(s);
  });

  it("las básicas de 01MIAR cubren lo suyo", () => {
    for (const s of ["type(", "isinstance(", "int(", "set(", "is b"]) expect(byId("tipos")).toContain(s);
    for (const s of ["elif", "while", "break", "continue", "enumerate", "zip"]) expect(byId("control")).toContain(s);
    for (const s of ["def ", "*valores", "**datos", "lambda", "factorial"]) expect(byId("funciones")).toContain(s);
    for (const s of ["with open", "encoding=\"utf-8\"", "os.listdir"]) expect(byId("ficheros")).toContain(s);
    for (const s of ["reshape", "axis=0", "@", "default_rng"]) expect(byId("numpy")).toContain(s);
    for (const s of ["pd.read_csv(NOMBRE", "groupby", "to_csv"]) expect(byId("pandas-csv")).toContain(s);
    for (const s of ["import seaborn as sns", "sns.regplot", "sns.boxplot", "plt.show()"]) expect(byId("seaborn")).toContain(s);
  });
});

describe("TEMPLATES: con el Python real de node_modules/pyodide", () => {
  let py: PyodideInterface;
  let out: string[] = [];

  beforeAll(async () => {
    try {
      const { loadPyodide } = await import("pyodide");
      // Ruta del paquete instalado (sin imports node: en el tsconfig de la app).
      const indexURL = decodeURIComponent(new URL("../../../../node_modules/pyodide/", import.meta.url).pathname);
      py = await loadPyodide({ indexURL });
      py.setStdout({ batched: (s: string) => out.push(s) });
    } catch (e) {
      throw new Error(`No se pudo cargar Pyodide desde node_modules/pyodide: ${String(e)}. Ejecuta npm ci --ignore-scripts.`, { cause: e });
    }
  }, 60_000);

  const runTemplate = (id: string) => {
    out = [];
    const globals = py.globals.get("dict")();
    py.runPython(byId(id), { globals });
    globals.destroy();
    return out;
  };

  it("es Python 3.12, como declaran los cuadernos del curso", () => {
    expect(String(py.runPython("import sys\nf'{sys.version_info[0]}.{sys.version_info[1]}'"))).toBe("3.12");
  });

  for (const t of TEMPLATES) {
    it(`compila «${t.label}»`, () => {
      py.globals.set("__labs_src", t.code);
      expect(py.runPython(`compile(__labs_src, "<template>", "exec") is not None`)).toBe(true);
    });
  }

  it("«Generadores» se ejecuta sin errores", () => {
    const o = runTemplate("generadores");
    expect(o).toContain("Cuenta atrás: [5, 4, 3, 2, 1]");
    expect(o).toContain("Segunda suma del generador: 0");
  });

  it("«Tipos de datos», «Control de flujo» y «Funciones» se ejecutan sin errores", () => {
    expect(runTemplate("tipos")).toContain("a == b: True | a is b: False");
    expect(runTemplate("control")).toContain("Suma de aprobadas: 29.75");
    expect(runTemplate("funciones")).toContain("[1, 1, 2, 6, 24, 120, 720]");
  });

  it("«Ficheros» crea notas.txt si falta, lo lee y escribe resumen.txt", () => {
    py.runPython("import os\nos.chdir('/tmp')\nfor f in ('notas.txt', 'resumen.txt'):\n    os.path.exists(f) and os.remove(f)");
    const o = runTemplate("ficheros");
    expect(o).toContain("No había notas.txt y se ha creado uno de ejemplo.");
    expect(o.join("\n")).toContain("Marta: 9.25 (aprobado)");
    expect(String(py.runPython("open('resumen.txt', encoding='utf-8').read().splitlines()[0]"))).toBe("Marta: 9.25 (aprobado)");
    // Con un archivo «subido» (ya en la carpeta), lo usa en vez de crear otro.
    py.runPython("open('notas.txt', 'w', encoding='utf-8').write('Eva;8\\nmal formato\\n')");
    const again = runTemplate("ficheros").join("\n");
    expect(again).not.toContain("No había");
    expect(again).toContain("Línea 2 con formato incorrecto");
    expect(again).toContain("Eva: 8.00 (aprobado)");
  });
});
