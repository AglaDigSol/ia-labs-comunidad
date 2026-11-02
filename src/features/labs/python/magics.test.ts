// Órdenes mágicas: la transformación (conserva las líneas) y que el resultado funciona con el Python
// real de node_modules/pyodide.
import type { PyodideInterface } from "pyodide";
import { beforeAll, describe, expect, it } from "vitest";
import { MAGICS_PY, transformMagics } from "./magics.ts";

const ok = (code: string) => {
  const r = transformMagics(code);
  if (!r.ok) throw new Error(r.message);
  return r;
};
const fail = (code: string) => {
  const r = transformMagics(code);
  if (r.ok) throw new Error("se esperaba un error");
  return r;
};

describe("transformMagics", () => {
  it("sin órdenes mágicas devuelve el código igual", () => {
    const code = "x = 5 % 3\nprint(f'{x}%')\n";
    expect(ok(code)).toEqual({ ok: true, code, used: [] });
  });

  it("%matplotlib inline no hace nada y conserva la sangría", () => {
    expect(ok("%matplotlib inline\nimport math").code).toBe("pass  # %matplotlib: los gráficos ya salen debajo\nimport math");
    expect(ok("if True:\n    %matplotlib inline").code.split("\n")[1]).toMatch(/^ {4}pass/);
  });

  it("%time envuelve la instrucción en la misma línea", () => {
    const r = ok("a = 1\n    %time b = sum(range(10))\nprint(b)");
    expect(r.code.split("\n")).toEqual(["a = 1", "    _labs_t0 = _labs_clock(); b = sum(range(10)); _labs_report(_labs_t0)", "print(b)"]);
    expect(r.used).toEqual(["%time"]);
  });

  it("%timeit con -n y -r pasa la instrucción como cadena", () => {
    expect(ok("%timeit -n 100 -r 5 sorted(xs)").code).toBe('_labs_timeit("sorted(xs)", globals(), number=100, repeat=5)');
    expect(ok('%timeit x = "a\\\\b"').code).toBe('_labs_timeit("x = \\"a\\\\\\\\b\\"", globals(), number=None, repeat=None)');
  });

  it("%%time mide la celda entera sin mover las líneas", () => {
    const r = ok("%%time\nx = 1\ny = 2");
    expect(r.code.split("\n")).toEqual(["_labs_t0 = _labs_clock()", "x = 1", "y = 2", "_labs_report(_labs_t0)"]);
  });

  it("%%timeit repite el resto de la celda; las líneas siguientes quedan vacías", () => {
    const r = ok("\n%%timeit -r 2 import math\nmath.sqrt(2)\nmath.pi");
    const lines = r.code.split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe('_labs_timeit("math.sqrt(2)\\nmath.pi", globals(), setup="import math", number=None, repeat=2)');
    expect(lines.slice(2)).toEqual(["", ""]);
  });

  it("un «%» dentro de una cadena de varias líneas no es una orden", () => {
    const code = 'texto = """\n%time no es orden\n"""\nprint(texto)';
    expect(ok(code).code).toBe(code);
  });

  it("órdenes no admitidas: error en español con su nombre y su línea", () => {
    expect(fail("x = 1\n%pip install seaborn")).toMatchObject({ magic: "%pip", line: 2 });
    expect(fail("%pip install seaborn").message).toContain("no se pueden instalar paquetes");
    expect(fail("!pip install numpy")).toMatchObject({ magic: "!pip" });
    expect(fail("!ls -la")).toMatchObject({ magic: "!ls", message: expect.stringContaining("orden de terminal") });
    const cap = fail("%%capture\nprint(1)");
    expect(cap).toMatchObject({ magic: "%%capture", line: 1 });
    expect(cap.message).toBe(
      "La orden mágica «%%capture» no está disponible en este entorno. Se admiten %time, %timeit, %%time, %%timeit y %matplotlib inline.",
    );
    expect(fail("print(1)\n%%time")).toMatchObject({ magic: "%%time", line: 2 });
    expect(fail("%load_ext autoreload")).toMatchObject({ magic: "%load_ext" });
    expect(fail("%timeit -q sum([])").message).toContain("solo admite las opciones -n y -r");
    expect(fail("%time").message).toContain("Escribe la instrucción");
  });
});

describe("órdenes mágicas con el Python real", () => {
  let py: PyodideInterface;
  let out: string[] = [];

  beforeAll(async () => {
    const { loadPyodide } = await import("pyodide");
    const indexURL = decodeURIComponent(new URL("../../../../node_modules/pyodide/", import.meta.url).pathname);
    py = await loadPyodide({ indexURL });
    py.setStdout({ batched: (s: string) => out.push(s) });
    py.runPython(`import sys, types\n_m = types.ModuleType("_labs_magics")\nexec(${JSON.stringify(MAGICS_PY)}, _m.__dict__)\nsys.modules["_labs_magics"] = _m`);
  }, 60_000);

  const run = (code: string) => {
    out = [];
    const globals = py.globals.get("dict")();
    globals.update(py.pyimport("_labs_magics").EXPORTS);
    py.runPython(ok(code).code, { globals });
    globals.destroy();
    return out;
  };

  it("%time ejecuta la instrucción y escribe los tiempos", () => {
    const o = run("%time total = sum(range(1000))\nprint(total)");
    expect(o[0]).toMatch(/^Tiempo de CPU: .+ · Tiempo real: .+ (s|ms|µs|ns)$/);
    expect(o[1]).toBe("499500");
  });

  it("%timeit y %%timeit usan las variables de la celda", () => {
    expect(run("xs = list(range(50))\n%timeit -n 5 -r 2 sorted(xs)")[0]).toMatch(
      /^.+ ± .+ por bucle \(media ± desv\. típica de 2 ejecuciones, 5 bucles cada una\)$/,
    );
    expect(run("%%timeit -n 3 -r 1 import math\nmath.sqrt(2)")[0]).toMatch(/de 1 ejecución, 3 bucles cada una\)$/);
  });

  it("%%time mide la celda y un error conserva su línea", () => {
    expect(run("%%time\na = 2\nprint(a * 21)")).toEqual(["42", expect.stringMatching(/^Tiempo de CPU/)]);
    expect(() => run("%%time\nx = 1\nundefined_name")).toThrow(/line 3/);
  });

  it("%time dentro de un método de una clase (sin name mangling)", () => {
    expect(run("class A:\n    def f(self):\n        %time y = 3\n        return y\nprint(A().f())").at(-1)).toBe("3");
  });
});
