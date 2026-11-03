// Paso a paso: el trazador (Python puro, el mismo que corre en Pyodide) se ejecuta con el python3 del
// sistema. Líneas y orden de los pasos, variables por marco, alias por id(), valores devueltos,
// salida acumulada, input(), errores y los tres límites.
import { describe, expect, it } from "vitest";
import { dedent } from "../shared/exercises/python.ts";
import { aliasText, parseTrace, stepText, TRACER_PY, tracePayload, type Trace } from "../src/features/labs/python/tracer.ts";
import { hasPython3, runJobs } from "./system-python.ts";

function trace(code: string, stdin: string[] = [], limits: Parameters<typeof tracePayload>[2] = {}): Trace {
  const [raw] = runJobs<unknown>(TRACER_PY, [{ fn: "__labs_trace", payload: tracePayload(code, stdin, limits) }]);
  const t = parseTrace(JSON.stringify(raw));
  if (!t) throw new Error(`traza ilegible: ${JSON.stringify(raw).slice(0, 300)}`);
  return t;
}

const vars = (t: Trace, step: number, frame = 0) => Object.fromEntries(t.pasos[step]!.marcos[frame]!.variables.map((v) => [v.nombre, v.valor]));

describe.skipIf(!hasPython3)("trazador con python3", () => {
  it("un bucle de 5 líneas: una parada antes de cada línea, variables y salida acumulada", () => {
    const t = trace(
      dedent(`
        total = 0
        for i in range(3):
            total += i
            print(i, total)
        print("fin", total)
      `),
    );
    expect(t.error).toBeNull();
    expect(t.limite).toBeNull();
    expect(t.pasos.map((s) => s.linea)).toEqual([1, 2, 3, 4, 2, 3, 4, 2, 3, 4, 2, 5, 5]);
    expect(t.pasos.at(-1)!.evento).toBe("fin");
    expect(vars(t, 0)).toEqual({});
    expect(vars(t, 3)).toEqual({ total: "0", i: "0" });
    expect(vars(t, 12)).toEqual({ total: "3", i: "2" });
    expect(t.salida).toBe("0 0\n1 1\n2 3\nfin 3\n");
    // Lo impreso antes de cada paso: al llegar a la línea 4 de la segunda vuelta ya está «0 0».
    expect(t.salida.slice(0, t.pasos[6]!.salida)).toBe("0 0\n");
    expect(stepText(t, 0)).toBe("Paso 1 de 13: se va a ejecutar la línea 1.");
    expect(stepText(t, 12)).toBe("Paso 13 de 13: fin del programa.");
  });

  it("llamadas: un marco por función, el valor que devuelve y el alias con la lista de fuera", () => {
    const t = trace(
      dedent(`
        def doblar(lista):
            lista.append(len(lista))
            return lista * 2

        datos = [7]
        copia = datos
        r = doblar(datos)
      `),
    );
    const inside = t.pasos.find((s) => s.marcos.length === 2)!;
    expect(inside.marcos.map((m) => m.nombre)).toEqual(["<module>", "doblar"]);
    const lista = inside.marcos[1]!.variables.find((v) => v.nombre === "lista")!;
    expect(lista.clase).toBe("lista");
    expect(aliasText(lista, inside.marcos, 1)).toBe("misma lista que datos en Programa principal");
    const copia = inside.marcos[0]!.variables.find((v) => v.nombre === "copia")!;
    expect(aliasText(copia, inside.marcos, 0)).toBe("misma lista que datos");
    // La función se muestra como tal, no como su repr.
    expect(inside.marcos[0]!.variables.find((v) => v.nombre === "doblar")!.valor).toBe("función doblar");
    const ret = t.pasos.find((s) => s.evento === "return")!;
    expect(ret.devuelve).toBe("[7, 1, 7, 1]");
    expect(stepText(t, t.pasos.indexOf(ret))).toMatch(/función doblar devuelve \[7, 1, 7, 1\] \(línea 3\)/);
    const end = t.pasos.at(-1)!;
    expect(Object.fromEntries(end.marcos[0]!.variables.map((v) => [v.nombre, v.valor]))).toMatchObject({ datos: "[7, 1]", r: "[7, 1, 7, 1]" });
  });

  it("recorta los repr largos y no muestra módulos ni nombres internos", () => {
    const t = trace("import math\nxs = list(range(100))\ns = 'a' * 500\n__oculta = 1\nfin = True\n");
    const end = vars(t, t.pasos.length - 1);
    expect(Object.keys(end)).toEqual(["xs", "s", "fin"]);
    expect(end.xs).toBe("[0, 1, 2, 3, 4, 5, 6, 7, ...]");
    expect(end.s!.length).toBeLessThanOrEqual(120);
  });

  it("input() lee la entrada y la muestra en la salida", () => {
    const t = trace("n = input('¿N? ')\nprint(n * 2)\n", ["ab"]);
    expect(t.salida).toBe("¿N? ab\nabab\n");
    const t2 = trace("input()\n");
    expect(t2.error?.mensaje).toBe("EOFError: EOF when reading a line");
  });

  it("un error: la línea, el mensaje y un último paso que lo señala; la función sale sin devolver", () => {
    const t = trace("def f(x):\n    return 10 / x\n\ny = f(0)\n");
    expect(t.error).toEqual({ mensaje: "ZeroDivisionError: division by zero", linea: 2 });
    expect(t.pasos.some((s) => s.evento === "return")).toBe(false);
    expect(t.pasos.some((s) => s.evento === "sale")).toBe(true);
    expect(t.pasos.at(-1)!.evento).toBe("error");
    expect(stepText(t, t.pasos.length - 1)).toMatch(/error en la línea 2: ZeroDivisionError/);
  });

  it("una excepción capturada dentro de la función no la marca como error", () => {
    const t = trace("def f():\n    try:\n        1 / 0\n    except ZeroDivisionError:\n        return -1\n\nr = f()\n");
    expect(t.error).toBeNull();
    expect(t.pasos.find((s) => s.evento === "return")!.devuelve).toBe("-1");
  });

  it("errores de sintaxis: sin pasos y con la línea", () => {
    const t = trace("x = 1\nif x\n    print(x)\n");
    expect(t.sintaxis?.linea).toBe(2);
    expect(t.pasos).toEqual([]);
  });

  it("límites: pasos, salida y tiempo", () => {
    const steps = trace("i = 0\nwhile True:\n    i += 1\n", [], { pasos: 50 });
    expect(steps.limite).toBe("pasos");
    expect(steps.pasos).toHaveLength(50);
    const out = trace("while True:\n    print('x' * 100)\n", [], { salida: 1000 });
    expect(out.limite).toBe("salida");
    expect(out.salida.length).toBe(1000);
    const time = trace("i = 0\nwhile True:\n    i += 1\n", [], { pasos: 10_000_000, segundos: 0.3 });
    expect(time.limite).toBe("tiempo");
  });
});

describe("parseTrace", () => {
  it("rechaza lo que no tiene forma", () => {
    expect(parseTrace(undefined)).toBeNull();
    expect(parseTrace("{")).toBeNull();
    expect(parseTrace('{"pasos": [{"linea": 0}], "salida": ""}')).toBeNull();
    expect(parseTrace('{"pasos": [], "salida": "", "limite": "otro"}')).toEqual({ pasos: [], salida: "", limite: null, error: null, sintaxis: null });
  });
});
