// ¿Lleva este build la pestaña Python? Lo leen vite.config.ts (para definir __LABS_PYTHON__) y los
// scripts que se ejecutan tras `vite build` (vendor-pyodide.ts y check-python.ts), así que los tres
// deciden lo mismo.
//
// LABS_PYTHON=1 (o true) la enciende y LABS_PYTHON=0 (o false) la apaga sin tocar el código; sin la
// variable manda config.modules.python de src/config.ts (false por defecto).
import { readFileSync } from "node:fs";

const CONFIG = new URL("../src/config.ts", import.meta.url);

/** Valor de `python:` dentro de config.modules (la única línea que empieza así en src/config.ts). */
export function configPythonSwitch(source: string): boolean {
  const matches = [...source.matchAll(/^\s*python:\s*(true|false)\s*,/gm)];
  if (matches.length !== 1) throw new Error("src/config.ts debe tener una sola línea «python: true,» o «python: false,» en config.modules");
  return matches[0]![1] === "true";
}

export function pythonEnabled(env: Record<string, string | undefined> = process.env, configSource?: string): boolean {
  const raw = env.LABS_PYTHON?.trim().toLowerCase();
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  if (raw) throw new Error(`LABS_PYTHON debe ser 1 o 0 (vale «${env.LABS_PYTHON}»)`);
  return configPythonSwitch(configSource ?? readFileSync(CONFIG, "utf8"));
}
