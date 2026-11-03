// Paquetes de Python que se publican junto al sitio cuando la pestaña Python está activada.
//
// TypeScript puro, sin DOM ni Node: lo importan el worker (para saber qué instalar al ver un import)
// y los scripts de build (scripts/pyodide-manifest.ts y scripts/vendor-pyodide.ts).
//
// 1) LOCK_ROOTS: paquetes de la distribución oficial de Pyodide. Se publican ellos y todas sus
//    dependencias según pyodide-lock.json, con el SHA-256 del propio lock.
// 2) EXTRA_WHEELS: wheels de Python puro que Pyodide no trae, fijados aquí con versión exacta, tamaño
//    y SHA-256 de PyPI. Se descargan y verifican igual, se sirven desde el mismo origen y se instalan
//    con micropip (deps=False, lista explícita) la primera vez que el código los importa.

export { PYODIDE_PYTHON, PYODIDE_VERSION } from "./version.ts";

/** Raíces del lock: se publican con todas sus dependencias. */
export const LOCK_ROOTS = [
  "numpy",
  "pandas",
  "matplotlib",
  "scipy",
  "scikit-learn",
  "pillow",
  "nltk",
  "beautifulsoup4",
  "opencv-python",
  "pytest",
  "regex",
  "lxml",
  "statsmodels",
  "wordcloud",
  "micropip",
  // Dependencias de los wheels extra (folium e ipytest), también del lock.
  "requests",
  "jinja2",
  "xyzservices",
  "ipython",
] as const;

export interface ExtraWheel {
  /** Nombre del proyecto en PyPI. */
  name: string;
  version: string;
  file: string;
  size: number;
  sha256: string;
  /** URL oficial de PyPI (solo para el build; el navegador lo pide al mismo origen). */
  url: string;
  /** Módulos que lo activan (`import seaborn`). Vacío si solo es dependencia de otro wheel extra. */
  imports: string[];
  /** Paquetes del lock que necesita (se cargan antes con loadPackage). */
  lockDeps: string[];
  /** Otros wheels extra que necesita (se instalan en la misma llamada a micropip). */
  wheelDeps: string[];
}

export const EXTRA_WHEELS: readonly ExtraWheel[] = [
  {
    name: "seaborn",
    version: "0.13.2",
    file: "seaborn-0.13.2-py3-none-any.whl",
    size: 294_914,
    sha256: "636f8336facf092165e27924f223d3c62ca560b1f2bb5dff7ab7fad265361987",
    url: "https://files.pythonhosted.org/packages/83/11/00d3c3dfc25ad54e731d91449895a79e4bf2384dc3ac01809010ba88f6d5/seaborn-0.13.2-py3-none-any.whl",
    imports: ["seaborn"],
    lockDeps: ["numpy", "pandas", "matplotlib"],
    wheelDeps: [],
  },
  {
    name: "branca",
    version: "0.8.2",
    file: "branca-0.8.2-py3-none-any.whl",
    size: 26_193,
    sha256: "2ebaef3983e3312733c1ae2b793b0a8ba3e1c4edeb7598e10328505280cf2f7c",
    url: "https://files.pythonhosted.org/packages/7e/50/fc9680058e63161f2f63165b84c957a0df1415431104c408e8104a3a18ef/branca-0.8.2-py3-none-any.whl",
    imports: ["branca"],
    lockDeps: ["jinja2"],
    wheelDeps: [],
  },
  {
    name: "folium",
    version: "0.20.0",
    file: "folium-0.20.0-py2.py3-none-any.whl",
    size: 113_394,
    sha256: "f0bc2a92acde20bca56367aa5c1c376c433f450608d058daebab2fc9bf8198bf",
    url: "https://files.pythonhosted.org/packages/b5/a8/5f764f333204db0390362a4356d03a43626997f26818a0e9396f1b3bd8c9/folium-0.20.0-py2.py3-none-any.whl",
    imports: ["folium"],
    lockDeps: ["jinja2", "numpy", "requests", "xyzservices"],
    wheelDeps: ["branca"],
  },
  {
    name: "ipytest",
    version: "0.14.2",
    file: "ipytest-0.14.2-py3-none-any.whl",
    size: 18_327,
    sha256: "236b2d41ad0943310f5a9b7a7d03a627e6abd3ceb481b13fcd03d17292fd69b2",
    url: "https://files.pythonhosted.org/packages/2b/f3/d86f2aaf3c5187a323be202c71b3856d9cc9587a6f44d432159ae1b25988/ipytest-0.14.2-py3-none-any.whl",
    imports: ["ipytest"],
    lockDeps: ["ipython", "packaging", "pytest"],
    wheelDeps: [],
  },
];

/** Wheel extra que activa un módulo importado, o null. */
export function extraForImport(module: string): ExtraWheel | null {
  return EXTRA_WHEELS.find((w) => w.imports.includes(module)) ?? null;
}

/** El wheel y los extra de los que depende, en orden de instalación (dependencias primero). */
export function extraClosure(wheel: ExtraWheel): ExtraWheel[] {
  const out: ExtraWheel[] = [];
  const visit = (w: ExtraWheel) => {
    if (out.includes(w)) return;
    for (const dep of w.wheelDeps) {
      const d = EXTRA_WHEELS.find((x) => x.name === dep);
      if (d) visit(d);
    }
    out.push(w);
  };
  visit(wheel);
  return out;
}

/** Nombre normalizado de un proyecto (PEP 503): «prompt_toolkit» y «Prompt-Toolkit» son el mismo. */
export const normalizeName = (name: string) => name.toLowerCase().replace(/[-_.]+/g, "-");

/** Archivo del núcleo de Pyodide (copiado de node_modules/pyodide). */
export interface CoreAsset {
  file: string;
  size: number;
  sha256: string;
}

/** Paquete del lock que se publica: su wheel (o .zip de biblioteca compartida) y sus dependencias. */
export interface LockAsset extends CoreAsset {
  /** Nombre en pyodide-lock.json. */
  name: string;
  /** Dependencias directas, con el nombre que tienen en el lock. */
  depends: string[];
}

/** Bytes de un paquete del lock y de todas sus dependencias (lo que baja el primer import). */
export function closureBytes(packages: readonly LockAsset[], roots: readonly string[], skip: ReadonlySet<string> = new Set()): number {
  const byName = new Map(packages.map((p) => [normalizeName(p.name), p]));
  const seen = new Set<string>();
  const stack = roots.map(normalizeName);
  let total = 0;
  while (stack.length > 0) {
    const n = stack.pop()!;
    if (seen.has(n) || skip.has(n)) continue;
    seen.add(n);
    const p = byName.get(n);
    if (!p) continue;
    total += p.size;
    stack.push(...p.depends.map(normalizeName));
  }
  return total;
}
