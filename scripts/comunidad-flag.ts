// ¿Lleva este build el módulo Comunidad? Lo lee vite.config.ts para definir __LABS_COMUNIDAD__.
//
// Comunidad necesita su propio servicio (/api/community), así que en el sitio público viene apagada
// (config.modules.comunidad = false). Un despliegue propio con ese servicio la enciende sin tocar el
// código construyendo con LABS_COMUNIDAD=1 (y LABS_COMUNIDAD=0 la apaga). Apagada, su código no entra
// en el build: ni chunk ni entrada en el service worker.
import { readFileSync } from "node:fs";

const CONFIG = new URL("../src/config.ts", import.meta.url);

/** Valor de `comunidad:` dentro de config.modules (la única línea que empieza así en src/config.ts). */
export function configComunidadSwitch(source: string): boolean {
  const matches = [...source.matchAll(/^\s*comunidad:\s*(true|false)\s*,/gm)];
  if (matches.length !== 1) throw new Error("src/config.ts debe tener una sola línea «comunidad: true,» o «comunidad: false,» en config.modules");
  return matches[0]![1] === "true";
}

/** LABS_COMUNIDAD: true/false si la variable lo dice; undefined si no está. */
export function comunidadFlag(env: Record<string, string | undefined> = process.env): boolean | undefined {
  const raw = env.LABS_COMUNIDAD?.trim().toLowerCase();
  if (!raw) return undefined;
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  throw new Error(`LABS_COMUNIDAD debe ser 1 o 0 (vale «${env.LABS_COMUNIDAD}»)`);
}

/** Lo que decide el build: LABS_COMUNIDAD si está; si no, config.modules.comunidad. */
export function comunidadEnabled(env: Record<string, string | undefined> = process.env, configSource?: string): boolean {
  return comunidadFlag(env) ?? configComunidadSwitch(configSource ?? readFileSync(CONFIG, "utf8"));
}
