// Avisos en español para los errores típicos en el navegador.
import { describe, expect, it } from "vitest";
import { COPY_NO_INTERNET, COPY_STDIN_EMPTY, hintsFor, isNetworkError, moduleHint } from "./messages.ts";

const notFound = (m: string) => `Traceback (most recent call last):\n  File "<exec>", line 1, in <module>\nModuleNotFoundError: No module named '${m}'`;

describe("bibliotecas no disponibles", () => {
  it("TensorFlow, Keras, PyTorch y PyTomography tienen su aviso", () => {
    expect(moduleHint(notFound("tensorflow"))).toBe("TensorFlow no funciona en el navegador. Usa Google Colab o un entorno local con Python 3.12");
    expect(moduleHint(notFound("tensorflow.keras"))).toMatch(/^TensorFlow no funciona/);
    expect(moduleHint(notFound("keras"))).toMatch(/^Keras necesita TensorFlow/);
    expect(moduleHint(notFound("torch"))).toBe("PyTorch no funciona en el navegador. Usa Google Colab o un entorno local con Python 3.12");
    expect(moduleHint(notFound("torchvision"))).toMatch(/^torchvision necesita PyTorch/);
    expect(moduleHint(notFound("pytomography"))).toBe(
      "PyTomography necesita PyTorch, que no funciona en el navegador. Usa Google Colab o un entorno local con Python 3.12",
    );
  });

  it("otro paquete: aviso genérico con lo incluido", () => {
    const h = moduleHint(notFound("sympy"))!;
    expect(h).toMatch(/^El paquete «sympy» no está incluido en este entorno\. Incluidos: numpy, pandas/);
    expect(h).toContain("Google Colab");
  });

  it("sin ModuleNotFoundError no hay aviso", () => {
    expect(moduleHint("NameError: name 'x' is not defined")).toBeNull();
  });
});

describe("sin internet", () => {
  const cases = [
    "urllib.error.URLError: <urlopen error [Errno 23] Host is unreachable>",
    "requests.exceptions.ConnectionError: HTTPSConnectionPool(host='x', port=443)",
    "pyodide.ffi.JsException: TypeError: Failed to fetch",
    "OSError: [Errno 50] Protocol not available",
    "[nltk_data] Error loading punkt: <urlopen error [Errno 23]>",
    "LookupError: \n  Resource punkt not found.\n  Please use the NLTK Downloader to obtain the resource:",
  ];
  for (const c of cases) it(`reconoce «${c.split("\n")[0]!.slice(0, 40)}…»`, () => expect(isNetworkError(c)).toBe(true));

  it("no confunde otros errores", () => {
    expect(isNetworkError("ZeroDivisionError: division by zero")).toBe(false);
    expect(isNetworkError("FileNotFoundError: [Errno 44] No such file or directory: 'datos.csv'")).toBe(false);
  });

  it("el texto del aviso", () => {
    expect(COPY_NO_INTERNET).toBe("Este entorno no accede a internet: descarga el archivo y súbelo con «Subir archivo»");
  });
});

describe("hintsFor", () => {
  it("nltk.download no lanza: el aviso sale de la salida", () => {
    expect(hintsFor({ output: "[nltk_data] Error loading stopwords: <urlopen error>\n" })).toEqual([COPY_NO_INTERNET]);
  });

  it("input() sin líneas: EOFError con su aviso", () => {
    expect(hintsFor({ error: "EOFError: EOF when reading a line" })).toEqual([COPY_STDIN_EMPTY]);
  });

  it("como mucho uno de cada tipo y nada si todo fue bien", () => {
    expect(hintsFor({ error: notFound("torch"), output: "Failed to fetch\nFailed to fetch" })).toHaveLength(2);
    expect(hintsFor({ output: "45\n" })).toEqual([]);
  });
});
