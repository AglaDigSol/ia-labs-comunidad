// Ejercicios de Python: los generadores son deterministas y válidos, y el banco de pruebas (el mismo
// código Python que corre en Pyodide) da por buena la solución de referencia en todos los casos
// generados, rechaza el código inicial y unas cuantas soluciones equivocadas a propósito, y nunca
// devuelve el valor esperado. Lo que necesita Python se ejecuta con el python3 del sistema.
import { describe, expect, it } from "vitest";
import {
  dedent,
  lit,
  makeCodeTemplate,
  PY_CODE_TEMPLATES,
  PY_CODE_TYPES,
  PY_DATA_TEMPLATE_IDS,
  PY_DATA_TYPE_IDS,
  PY_OUTPUT,
  PY_OUTPUT_TEMPLATES,
  PYTHON_EXERCISES,
  Tup,
  type PyCodeInstance,
} from "../shared/exercises/python.ts";
import { exerciseTopics, exerciseType, exercisesOfTopic, mixedType } from "../shared/exercises/registry.ts";
import { EXERCISE_LEVELS, type ExerciseLevel } from "../shared/exercises/types.ts";
import {
  allPassed,
  caseFiles,
  checkPayload,
  firstOutputDiff,
  HARNESS_PY,
  parseCheckResult,
  parseOutputResult,
  type CheckResult,
  type OutputResult,
} from "../src/features/labs/exercises/python/harness.ts";
import { hasPython3, runJobs, type Job } from "./system-python.ts";

const SEEDS = Array.from({ length: 12 }, (_, i) => (i * 2654435761 + 17) >>> 0);

const checkJob = (inst: PyCodeInstance, code: string): Job => ({ fn: "__labs_check", payload: checkPayload(inst, code), files: caseFiles(inst.cases) });

function check(jobs: Job[]): CheckResult[] {
  return runJobs<unknown>(HARNESS_PY, jobs).map((r) => {
    const parsed = parseCheckResult(JSON.stringify(r));
    if (!parsed) throw new Error(`resultado ilegible: ${JSON.stringify(r).slice(0, 200)}`);
    return parsed;
  });
}

describe("ejercicios de Python: registro", () => {
  it("solo existen con el módulo python encendido", () => {
    expect(exerciseTopics().map((t) => t.id)).not.toContain("python");
    expect(exerciseTopics({ python: true }).map((t) => t.id)).toContain("python");
    expect(exerciseType("py-cadenas")).toBeNull();
    expect(exerciseType("py-cadenas", { python: true })?.id).toBe("py-cadenas");
    expect(exercisesOfTopic("python")).toEqual([]);
    expect(exercisesOfTopic("python", { python: true }).map((t) => t.id)).toEqual(PYTHON_EXERCISES.map((t) => t.id));
    for (const level of EXERCISE_LEVELS) expect(mixedType("python", level, 7, { python: true }).topic).toBe("python");
  });

  it("al menos 25 plantillas de código, de los trece temas, y «¿Qué imprime?» en los tres niveles", () => {
    expect(PY_CODE_TEMPLATES.size).toBeGreaterThanOrEqual(25);
    const temas = new Set([...PY_CODE_TEMPLATES.values()].map((t) => t.tema));
    expect([...temas].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    for (const level of EXERCISE_LEVELS) expect(PY_OUTPUT_TEMPLATES[level].length).toBeGreaterThanOrEqual(5);
  });

  it("cada plantilla y nivel genera un enunciado completo y determinista", () => {
    for (const id of PY_CODE_TEMPLATES.keys()) {
      for (const level of EXERCISE_LEVELS) {
        for (const s of SEEDS) {
          const inst = makeCodeTemplate(id, s, level);
          expect(makeCodeTemplate(id, s, level)).toEqual(inst);
          expect(inst.template).toBe(id);
          expect(inst.statement.length).toBeGreaterThan(0);
          expect(inst.statement.join(" ")).toContain(`\`${inst.fn}`);
          // Una función o, en el tema 6, una clase.
          const head = inst.tema === 6 ? `class ${inst.fn}` : `def ${inst.fn}(`;
          expect(inst.starter).toContain(head);
          expect(inst.solution).toContain(head);
          // Los gráficos tardan más: dos casos.
          expect(inst.cases.length, `${id} ${level}`).toBeGreaterThanOrEqual(inst.tema === 11 ? 2 : 3);
          expect(inst.hints.length).toBeGreaterThanOrEqual(2);
          // Las llamadas son distintas (si no, el caso no aporta nada).
          const shown = inst.cases.map((c) => `${c.code}|${JSON.stringify(c.files ?? {})}`);
          expect(new Set(shown).size, `${id} ${level} ${s}: ${shown.join(" / ")}`).toBe(shown.length);
        }
      }
    }
  });

  it("las pistas no llevan código de la solución", () => {
    for (const id of PY_CODE_TEMPLATES.keys()) {
      for (const level of EXERCISE_LEVELS) {
        const inst = makeCodeTemplate(id, 1, level);
        const lines = inst.solution
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 10 && !l.startsWith("def ") && !l.startsWith("import "));
        for (const h of inst.hints) {
          expect(h).not.toMatch(/\bdef \w+\(|\n/);
          for (const l of lines) expect(h.includes(l), `${id} ${level}: «${l}» en la pista`).toBe(false);
        }
      }
    }
  });

  it("«¿Qué imprime?» es determinista y variado", () => {
    for (const level of EXERCISE_LEVELS) {
      const seen = new Set<string>();
      for (const s of SEEDS) {
        const inst = PY_OUTPUT.generate(s, level);
        expect(PY_OUTPUT.generate(s, level)).toEqual(inst);
        expect(inst.code.split("\n").length).toBeLessThanOrEqual(14);
        seen.add(inst.code);
      }
      expect(seen.size).toBeGreaterThan(6);
    }
  });

  it("lit escribe literales de Python", () => {
    expect(lit("it's\n")).toBe(String.raw`'it\'s\n'`);
    expect(lit([1, 2.5, true, null])).toBe("[1, 2.5, True, None]");
    expect(lit(new Tup([1]))).toBe("(1,)");
    expect(lit({ a: new Tup(["x", 2]) })).toBe("{'a': ('x', 2)}");
    expect(dedent("\n    a\n      b\n")).toBe("a\n  b\n");
  });
});

// Los temas 6 a 13 (y los de examen) tienen sus propias pruebas: tests/python-datos.test.ts.
describe.skipIf(!hasPython3)("ejercicios de Python: banco de pruebas con python3", () => {
  const all: Array<{ inst: PyCodeInstance; label: string }> = [];
  for (const t of PY_CODE_TYPES.filter((x) => !PY_DATA_TYPE_IDS.has(x.id))) for (const level of EXERCISE_LEVELS) for (const s of SEEDS) all.push({ inst: t.generate(s, level), label: `${t.id} ${level} ${s}` });
  // Y cada plantilla al menos una vez en cada nivel, aunque el azar no la elija.
  for (const id of [...PY_CODE_TEMPLATES.keys()].filter((x) => !PY_DATA_TEMPLATE_IDS.has(x))) for (const level of EXERCISE_LEVELS) for (const s of SEEDS.slice(0, 4)) all.push({ inst: makeCodeTemplate(id, s, level), label: `${id} ${level} ${s}` });

  it("la solución de referencia pasa todos los casos generados y cumple los requisitos", () => {
    const results = check(all.map(({ inst }) => checkJob(inst, inst.solution)));
    results.forEach((r, i) => {
      const bad = r.casos.map((c, k) => (c.ok ? null : `caso ${k + 1}: ${JSON.stringify(c)}`)).filter(Boolean);
      expect({ label: all[i]!.label, sintaxis: r.sintaxis, bad, reglas: r.reglas }).toEqual({
        label: all[i]!.label,
        sintaxis: null,
        bad: [],
        reglas: r.reglas.map(() => true),
      });
      expect(allPassed(r)).toBe(true);
    });
  }, 120_000);

  it("el código inicial no resuelve ningún ejercicio (y el resultado nunca lleva lo esperado)", () => {
    const jobs = all.slice(0, 120);
    const results = check(jobs.map(({ inst }) => checkJob(inst, inst.starter)));
    results.forEach((r, i) => {
      expect(allPassed(r), jobs[i]!.label).toBe(false);
      expect(r.casos.some((c) => c.interno)).toBe(false);
    });
  }, 120_000);

  // Errores típicos: cada uno debe fallar al menos un caso.
  const WRONG: Array<{ id: string; level: ExerciseLevel; code: string }> = [
    { id: "tiempo", level: "medio", code: "def a_horas(segundos):\n    return segundos // 3600, segundos // 60, segundos % 60\n" },
    { id: "booleanos", level: "medio", code: "def es_bisiesto(anio):\n    return anio % 4 == 0\n" },
    { id: "capicua", level: "medio", code: "def es_capicua(palabra):\n    return palabra == palabra[::-1]\n" },
    { id: "rebanadas", level: "avanzado", code: "def centro(texto):\n    return texto[len(texto) // 2]\n" },
    { id: "mutabilidad", level: "básico", code: "def duplicar(numeros):\n    for i in range(len(numeros)):\n        numeros[i] *= 2\n    return numeros\n" },
    { id: "mutabilidad", level: "avanzado", code: "def copiar_matriz(m):\n    return m[:]\n" },
    { id: "notas", level: "medio", code: "def calificacion(nota):\n    if nota < 5:\n        return 'Suspenso'\n    elif nota <= 7:\n        return 'Aprobado'\n    elif nota < 9:\n        return 'Notable'\n    return 'Sobresaliente'\n" },
    { id: "sumas", level: "básico", code: "def suma_hasta(n):\n    total = 0\n    for i in range(n):\n        total += i\n    return total\n" },
    { id: "digitos", level: "básico", code: "def cuenta_digitos(n):\n    return len(str(n))\n" },
    { id: "por-defecto", level: "avanzado", code: "def agregar(elemento, lista=[]):\n    lista.append(elemento)\n    return lista\n" },
    { id: "recursion", level: "básico", code: "def factorial(n):\n    r = 1\n    for i in range(2, n + 1):\n        r *= i\n    return r\n" },
    { id: "ordenar", level: "medio", code: "def por_nota(alumnos):\n    return sorted(alumnos, key=lambda a: a[1], reverse=True)\n" },
    { id: "lineas", level: "medio", code: "def lineas_no_vacias(ruta):\n    with open(ruta) as f:\n        return len(f.readlines())\n" },
    { id: "escribir", level: "básico", code: "def escribir_lineas(ruta, lineas):\n    with open(ruta, 'w') as f:\n        f.write('\\n'.join(lineas))\n" },
    { id: "csv", level: "básico", code: "def suma_columna(ruta, columna):\n    total = 0\n    with open(ruta) as f:\n        for linea in f.readlines()[1:]:\n            total += float(linea.split(',')[2])\n    return round(total, 2)\n" },
    { id: "dibujos", level: "básico", code: "def tabla(n):\n    for i in range(1, 10):\n        print(f'{n} x {i} = {n * i}')\n" },
  ];

  it("soluciones equivocadas a propósito fallan (por los casos o por los requisitos)", () => {
    const jobs = WRONG.flatMap((w) => SEEDS.slice(0, 3).map((s) => ({ w, inst: makeCodeTemplate(w.id, s, w.level) })));
    const results = check(jobs.map(({ w, inst }) => checkJob(inst, w.code)));
    results.forEach((r, i) => {
      const { w } = jobs[i]!;
      expect(allPassed(r), `${w.id} ${w.level}`).toBe(false);
      expect(r.casos.some((c) => c.interno)).toBe(false);
    });
  }, 120_000);

  // Formas equivalentes de escribir lo que pide el enunciado: tienen que pasar (las semillas de los
  // revisores en base 36, «10» = 36 y «7y» = 286, más unas cuantas). En «precio», nada de medios céntimos exactos: 85,305 € redondea
  // distinto con precio * 1.21 que con precio + precio * 21 / 100.
  const pct = (inst: PyCodeInstance, what: string) => Number(new RegExp(`${what} del (\\d+) %`).exec(inst.statement.join(" "))![1]);
  const umbralOf = (inst: PyCodeInstance) => Number(/a partir de (\d+) unidades|si se compran (\d+) unidades/.exec(inst.statement.join(" "))!.slice(1).find(Boolean));
  const precioCode = (i: PyCodeInstance): string => {
    const iva = pct(i, "IVA");
    if (i.fn === "precio_con_iva") return `def precio_con_iva(precio):\n    return round(precio + precio * ${iva} / 100, 2)\n`;
    const body = `    t = precio * unidades\n    if unidades >= ${umbralOf(i)}:\n        t = t - t * ${pct(i, "descuento")} / 100\n    t = round(t + t * ${iva} / 100, 2)\n`;
    return i.fn === "total" ? `def total(precio, unidades):\n${body}    return t\n` : `def ticket(precio, unidades):\n${body}    return f"{unidades} x {precio:.2f} € = {t:.2f} €"\n`;
  };
  const pyTipos = PY_CODE_TYPES.find((t) => t.id === "py-tipos")!;
  const RIGHT: Array<{ label: string; inst: PyCodeInstance; code: (inst: PyCodeInstance) => string }> = [
    ...EXERCISE_LEVELS.flatMap((level) => [36, 286].map((s) => ({ label: `py-tipos ${level} ${s}`, inst: pyTipos.generate(s, level), code: precioCode }))),
    ...EXERCISE_LEVELS.flatMap((level) => SEEDS.map((s) => ({ label: `precio ${level} ${s}`, inst: makeCodeTemplate("precio", s, level), code: precioCode }))),
  ];

  it("formas equivalentes de la solución también pasan", () => {
    const jobs = RIGHT.filter((w) => w.inst.template === "precio" || !w.label.startsWith("py-tipos"));
    expect(jobs.filter((w) => w.label.startsWith("py-tipos")).length).toBeGreaterThan(0);
    const results = check(jobs.map((w) => checkJob(w.inst, w.code(w.inst))));
    results.forEach((r, i) => {
      const { label } = jobs[i]!;
      expect({ label, sintaxis: r.sintaxis, ok: allPassed(r) }).toEqual({ label, sintaxis: null, ok: true });
    });
  }, 120_000);

  it("informa de errores con la línea del código, de la función que falta, del tiempo y de la sintaxis", () => {
    const inst = makeCodeTemplate("booleanos", 3, "básico");
    const [boom, missing, slow, syntax, prints] = check([
      checkJob(inst, "def es_multiplo(n):\n    x = 1\n    return n / 0\n"),
      checkJob(inst, "def otra(n):\n    return True\n"),
      checkJob(inst, "def es_multiplo(n):\n    while True:\n        pass\n"),
      checkJob(inst, "def es_multiplo(n)\n    return True\n"),
      checkJob(inst, "print('hola desde arriba')\ndef es_multiplo(n):\n    return 'sí'\n"),
    ]);
    expect(boom!.casos[0]!.error).toEqual({ tipo: "ZeroDivisionError", mensaje: "ZeroDivisionError: division by zero", linea: 3 });
    expect(missing!.falta).toBe(true);
    expect(missing!.casos.every((c) => c.falta)).toBe(true);
    expect(slow!.casos.every((c) => c.tiempo)).toBe(true);
    expect(syntax!.sintaxis?.linea).toBe(1);
    expect(syntax!.casos).toEqual([]);
    expect(prints!.superior).toBe("hola desde arriba\n");
    const wrong = prints!.casos[0]!;
    expect(wrong.ok).toBe(false);
    expect(wrong.mal).toEqual([{ que: "valor", texto: "'sí'", tipo: "str" }]);
  }, 60_000);

  it("el resultado solo trae lo que hizo el código de la persona", () => {
    const inst = makeCodeTemplate("tiempo", 5, "básico");
    const [r] = runJobs<unknown>(HARNESS_PY, [checkJob(inst, "def a_minutos(segundos):\n    return 'x'\n")]);
    // Ni los valores esperados ni la solución salen del banco de pruebas.
    const text = JSON.stringify(r);
    expect(text).not.toContain("segundos // 60");
    for (const c of inst.cases) {
      const secs = Number(/\((\d+)\)/.exec(c.code)![1]);
      expect(text).not.toContain(`[${Math.floor(secs / 60)}, ${secs % 60}]`);
    }
  });

  it("los archivos: compara lo que escribe el código y no deja nada en la carpeta del caso", () => {
    const inst = makeCodeTemplate("palabras-fichero", 2, "avanzado");
    const bad = "def frecuencias_a_fichero(entrada, salida):\n    open(salida, 'w').write('nada')\n    return 3\n";
    const [r] = check([checkJob(inst, bad)]);
    const diffs = r!.casos.flatMap((c) => c.mal ?? []).map((d) => d.que);
    expect(diffs).toContain("archivo:frecuencias.txt");
    const none = "def frecuencias_a_fichero(entrada, salida):\n    return 0\n";
    const [r2] = check([checkJob(inst, none)]);
    expect(r2!.casos[0]!.mal).toContainEqual({ que: "archivo:frecuencias.txt", texto: null });
  });

  it("«¿Qué imprime?»: cada fragmento se ejecuta sin errores y con salida", () => {
    // Las semillas del revisor (medio: 8, g, s, 24, 29 en base 36) daban un range-continue sin salida.
    const reviewer = ["8", "g", "s", "24", "29"].map((t) => parseInt(t, 36));
    const sweep = Array.from({ length: 80 }, (_, i) => i);
    const insts = EXERCISE_LEVELS.flatMap((level) => [...SEEDS, ...reviewer, ...sweep].map((s) => PY_OUTPUT.generate(s, level)));
    // Y cada plantilla al menos una vez.
    const results = runJobs<unknown>(
      HARNESS_PY,
      insts.map((i) => ({ fn: "__labs_output", payload: { codigo: i.code, segundos: 2 } })),
    ).map((r) => parseOutputResult(JSON.stringify(r)) as OutputResult);
    results.forEach((r, i) => {
      expect({ code: insts[i]!.code, sintaxis: r.sintaxis, error: r.error, tiempo: r.tiempo }).toEqual({ code: insts[i]!.code, sintaxis: null, error: null, tiempo: false });
      expect(r.salida.trim().length).toBeGreaterThan(0);
      expect(firstOutputDiff(r.salida, r.salida)).toBeNull();
    });
  }, 60_000);
});

describe("comparación de la salida de «¿Qué imprime?»", () => {
  it("ignora espacios finales y líneas vacías del final; da la primera línea distinta", () => {
    expect(firstOutputDiff("1 2\n3\n", "1 2  \n3")).toBeNull();
    expect(firstOutputDiff("1 2\n3\n", "1 2\n4\n")).toBe(2);
    expect(firstOutputDiff("1\n2\n", "1\n")).toBe(2);
    expect(firstOutputDiff("a\n", "\na")).toBe(1);
  });

  it("parseCheckResult rechaza lo que no tiene forma", () => {
    expect(parseCheckResult(undefined)).toBeNull();
    expect(parseCheckResult("no json")).toBeNull();
    expect(parseCheckResult("{}")).toBeNull();
    expect(parseCheckResult('{"casos": [{"ok": true}], "reglas": [true]}')).toEqual({ sintaxis: null, falta: false, superior: "", casos: [{ ok: true }], reglas: [true] });
  });
});

// Respuestas conocidas, calculadas a mano a partir del enunciado: la referencia de cada plantilla y
// nivel hace lo que dice el texto (con los ejemplos del propio enunciado cuando los hay).
const KNOWN: Record<string, Partial<Record<ExerciseLevel, string[]>>> = {
  tiempo: { básico: ["a_minutos(130) == (2, 10)", "a_minutos(59) == (0, 59)"], medio: ["a_horas(3725) == (1, 2, 5)"], avanzado: ["reloj(3725) == '01:02:05'", "reloj(0) == '00:00:00'"] },
  temperatura: { básico: ["celsius_a_fahrenheit(100) == 212", "celsius_a_fahrenheit(-40) == -40"], medio: ["fahrenheit_a_celsius(212) == 100", "fahrenheit_a_celsius(50) == 10"], avanzado: ["convertir(0, 'C') == 32", "convertir(212, 'F') == 100", "convertir(3, 'K') is None"] },
  "texto-numero": { básico: ["sumar_textos('12', '30') == 42"], medio: ["sumar_decimales('3,5', '1,25') == 4.75"], avanzado: ["es_entero(' -12 ')", "not es_entero('4.5')", "not es_entero('-')", "not es_entero('')", "es_entero('+3')"] },
  booleanos: { medio: ["not es_bisiesto(1900)", "es_bisiesto(2000)", "es_bisiesto(2024)", "not es_bisiesto(2023)"] },
  capicua: { básico: ["invertir('hola') == 'aloh'"], medio: ["es_capicua('Radar')", "not es_capicua('radio')"], avanzado: ["es_frase_capicua('Ana, lava lana')", "es_frase_capicua('¡!')", "not es_frase_capicua('sol mar')"] },
  vocales: { medio: ["contar_vocales('canción árbol') == 5", "contar_vocales('pingüino') == 4", "contar_vocales('AEIOU xyz') == 5"], avanzado: ["vocales_por_tipo('Casa azul') == {'a': 3, 'u': 1}", "vocales_por_tipo('xyz') == {}"] },
  iniciales: { básico: ["iniciales('lira Tomeva') == 'LT'"], medio: ["iniciales_con_puntos('lira Tomeva') == 'L. T.'"], avanzado: ["formato_cita('lira bo Tomeva') == 'Tomeva, L. B.'", "formato_cita('ana RUIZ') == 'Ruiz, A.'"] },
  rebanadas: { básico: ["extremos('paraguas', 2) == 'paas'"], medio: ["cada_k('abcdefg', 3) == 'adg'"], avanzado: ["centro('raton') == 't'", "centro('casa') == 'as'", "centro('a') == 'a'"] },
  frases: { básico: ["palabra_mas_larga('sol mar pez') == 'sol'", "palabra_mas_larga('el camino largo') == 'camino'"], medio: ["capitalizar('hola MUNDO de luz') == 'Hola Mundo De Luz'"], avanzado: ["acronimo('torre de control y radar') == 'TCR'", "acronimo('Libro DEL Mar') == 'LM'"] },
  frecuencias: { básico: ["contar(['a', 'b', 'a']) == {'a': 2, 'b': 1}"], medio: ["mas_frecuente(['x', 'y', 'y', 'x']) == 'x'", "mas_frecuente([]) is None"], avanzado: ["agrupar_por_inicial(['mar', 'luz', 'mesa', 'mar']) == {'m': ['mar', 'mesa'], 'l': ['luz']}"] },
  conjuntos: { básico: ["comunes([3, 1, 2, 3], [3, 4, 1]) == [1, 3]"], medio: ["solo_en_una([1, 2, 2], [2, 3]) == [1, 3]"], avanzado: ["sin_repetidos([3, 1, 3, 2, 1]) == [3, 1, 2]"] },
  tuplas: { básico: ["minimo_y_maximo([3, -1, 7]) == (-1, 7)"], medio: ["mejor([('a', 7), ('b', 9), ('c', 9)]) == 'b'"], avanzado: ["medias([('a', 5), ('b', 8), ('a', 6)]) == {'a': 5.5, 'b': 8.0}"] },
  mutabilidad: { básico: ["duplicar([1, 2]) == [2, 4]"], medio: ["(lambda d: (agregar_en_sitio(d, 3), d))([1]) == (None, [1, 3])"], avanzado: ["(lambda m: (copiar_matriz(m)[0].append(9), m))([[1], [2]])[1] == [[1], [2]]"] },
  notas: { básico: ["aprobado(5)", "not aprobado(4.99)"], medio: ["calificacion(4.99) == 'Suspenso'", "calificacion(7) == 'Notable'", "calificacion(9) == 'Sobresaliente'", "calificacion(6.9) == 'Aprobado'"], avanzado: ["calificacion(-1) == 'Nota no válida'", "calificacion(10) == 'Sobresaliente'", "calificacion(10.5) == 'Nota no válida'"] },
  sumas: { básico: ["suma_hasta(4) == 10", "suma_hasta(0) == 0"], medio: ["suma_multiplos(10, 3) == 18", "suma_multiplos(3, 3) == 3"], avanzado: ["suma_multiplos_de_alguno(10, 3, 5) == 23", "suma_multiplos_de_alguno(15, 3, 5) == 45"] },
  digitos: { básico: ["cuenta_digitos(0) == 1", "cuenta_digitos(12345) == 5"], medio: ["suma_digitos(472) == 13", "suma_digitos(0) == 0"], avanzado: ["pasos_collatz(6) == 8", "pasos_collatz(1) == 0"] },
  saltos: { básico: ["primer_negativo([3, -1, -2]) == 1", "primer_negativo([]) == -1"], medio: ["suma_hasta_cero([1, -5, 2, 0, 9]) == 3", "suma_hasta_cero([4, -1]) == 4"], avanzado: ["primo_desde(14) == 17", "primo_desde(1) == 2", "primo_desde(2) == 2", "primo_desde(90) == 97"] },
  enumerar: { básico: ["posiciones([1, 2, 1], 1) == [0, 2]", "posiciones([], 1) == []"], medio: ["numerar(['sol', 'mar']) == ['1. sol', '2. mar']"], avanzado: ["indices_del_maximo([1, 7, 3, 7]) == [1, 3]", "indices_del_maximo([]) == []"] },
  cremallera: { básico: ["emparejar(['a', 'b'], [1, 2]) == {'a': 1, 'b': 2}"], medio: ["sumar_listas([1, 2], [10, 20]) == [11, 22]"], avanzado: ["diferencias([3, 7, 4]) == [4, -3]", "diferencias([5]) == []"] },
  "comprension-listas": { básico: ["cuadrados(4) == [1, 4, 9, 16]"], medio: ["pares_al_cuadrado([1, 2, -4]) == [4, 16]"], avanzado: ["aplanar([[1, 2], [3]]) == [1, 2, 3]"] },
  "comprension-dict": { básico: ["longitudes(['sol', 'agua']) == {'sol': 3, 'agua': 4}"], medio: ["invertir({'a': 1, 'b': 2}) == {1: 'a', 2: 'b'}"], avanzado: ["filtrar({'a': 4, 'b': 6}, 5) == {'b': 6}"] },
  "args-kwargs": { básico: ["sumar_todos(1, 2, 3) == 6", "sumar_todos() == 0"], medio: ["media(1, 2) == 1.5", "media() == 0"], avanzado: ["ficha(talla=40, color='azul') == 'color=azul, talla=40'", "ficha() == ''"] },
  "varios-valores": { básico: ["primero_y_ultimo([1, 2, 3]) == (1, 3)"], medio: ["estadisticas([1, 2, 4]) == (1, 4, 2.33)"], avanzado: ["dividir(17, 5) == (3, 2)", "dividir(1, 0) == (None, None)"] },
  recursion: { básico: ["factorial(5) == 120", "factorial(0) == 1"], medio: ["suma_cifras(472) == 13"], avanzado: ["aplanar_todo([1, [2, [3]], 4]) == [1, 2, 3, 4]"] },
  ordenar: { básico: ["por_longitud(['mar', 'agua', 'sol']) == ['mar', 'sol', 'agua']"], medio: ["por_nota([('b', 7), ('a', 7), ('c', 9)]) == [('c', 9), ('a', 7), ('b', 7)]"], avanzado: ["mejores({'b': 5, 'a': 5, 'c': 2}, 2) == ['a', 'b']", "mejores({'a': 1}, 3) == ['a']"] },
  lambdas: { básico: ["aplicar(len, ['ab', 'c']) == [2, 1]"], medio: ["componer(lambda x: x + 1, lambda x: x * 3)(2) == 7"], avanzado: ["multiplicador(3)(5) == 15"] },
  "por-defecto": { medio: ["potencia(3) == 9", "potencia(2, 3) == 8"], avanzado: ["agregar(1) == [1] and agregar(2) == [2]"] },
};

const FILE_KNOWN: Array<{ id: string; level: ExerciseLevel; files: Record<string, string>; asserts: string[] }> = [
  { id: "lineas", level: "básico", files: { "d.txt": "a\n\nb\n" }, asserts: ["contar_lineas('d.txt') == 3"] },
  { id: "lineas", level: "medio", files: { "d.txt": "a\n  \nb\n" }, asserts: ["lineas_no_vacias('d.txt') == 2"] },
  { id: "lineas", level: "avanzado", files: { "d.txt": "Sol y mar\nluna\nSOL\n" }, asserts: ["lineas_con('d.txt', 'sol') == 2"] },
  { id: "palabras-fichero", level: "básico", files: { "t.txt": "a b\nc\n\n" }, asserts: ["contar_palabras('t.txt') == 3"] },
  { id: "palabras-fichero", level: "medio", files: { "t.txt": "Sol sol LUNA luna\n" }, asserts: ["mas_frecuente_en('t.txt') == 'luna'"] },
  { id: "palabras-fichero", level: "avanzado", files: { "t.txt": "b a\nb\n" }, asserts: ["frecuencias_a_fichero('t.txt', 'o.txt') == 2", "open('o.txt').read() == 'b: 2\\na: 1\\n'"] },
  { id: "csv", level: "básico", files: { "n.csv": "nombre,grupo,nota\nx,A,5\ny,B,6.5\n" }, asserts: ["suma_columna('n.csv', 'nota') == 11.5"] },
  { id: "csv", level: "medio", files: { "n.csv": "nombre,grupo,nota\nx,A,5\ny,B,6.5\n" }, asserts: ["filtrar_csv('n.csv', 'o.csv', 'nota', 6) == 1", "open('o.csv').read() == 'nombre,grupo,nota\\ny,B,6.5\\n'"] },
  { id: "csv", level: "avanzado", files: { "n.csv": "nombre,grupo,nota\nx,A,5\ny,B,6.5\nz,A,6\n" }, asserts: ["media_por_grupo('n.csv') == {'A': 5.5, 'B': 6.5}"] },
  { id: "escribir", level: "básico", files: {}, asserts: ["escribir_lineas('o.txt', ['a', 'b']) is None", "open('o.txt').read() == 'a\\nb\\n'"] },
  { id: "escribir", level: "medio", files: { "e.txt": "Hola\nmar\n" }, asserts: ["copiar_en_mayusculas('e.txt', 'o.txt') is None", "open('o.txt').read() == 'HOLA\\nMAR\\n'"] },
  { id: "escribir", level: "avanzado", files: { "e.txt": " a \n\nb\n" }, asserts: ["numerar_lineas('e.txt', 'o.txt') == 2", "open('o.txt').read() == '1: a\\n2: b\\n'"] },
];

const KNOWN_PY = `
import json
def __labs_known(p):
    ns = {}
    exec(p["solucion"], ns)
    return json.dumps([a for a in p["asserts"] if not eval(a, ns)])
`;

describe.skipIf(!hasPython3)("ejercicios de Python: la referencia cumple el enunciado", () => {
  it("respuestas conocidas de cada plantilla", () => {
    const jobs: Job[] = [];
    const labels: string[] = [];
    for (const [id, byLevel] of Object.entries(KNOWN)) {
      for (const [level, asserts] of Object.entries(byLevel) as Array<[ExerciseLevel, string[]]>) {
        jobs.push({ fn: "__labs_known", payload: { solucion: makeCodeTemplate(id, 1, level).solution, asserts } });
        labels.push(`${id} ${level}`);
      }
    }
    for (const k of FILE_KNOWN) {
      jobs.push({ fn: "__labs_known", payload: { solucion: makeCodeTemplate(k.id, 1, k.level).solution, asserts: k.asserts }, files: Object.entries(k.files).map(([path, text]) => ({ path, text })) });
      labels.push(`${k.id} ${k.level}`);
    }
    const failed = runJobs<string[]>(KNOWN_PY, jobs);
    expect(Object.fromEntries(labels.map((l, i) => [l, failed[i]]).filter(([, f]) => (f as string[]).length > 0))).toEqual({});
    // Todas las plantillas tienen al menos una respuesta conocida.
    const covered = new Set([...Object.keys(KNOWN), ...FILE_KNOWN.map((k) => k.id)]);
    expect([...PY_CODE_TEMPLATES.keys()].filter((id) => !covered.has(id) && !PY_DATA_TEMPLATE_IDS.has(id))).toEqual(["precio", "dibujos"]);
  });
});
