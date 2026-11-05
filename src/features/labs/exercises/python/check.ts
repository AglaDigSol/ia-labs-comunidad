// «Comprobar» de los ejercicios de Python, en el worker: escribe los archivos de entrada de cada caso
// con la API de archivos (ejercicio/caso<k>/…), ejecuta el banco de pruebas con límite de tiempo y
// vacía la carpeta de trabajo al terminar. Si el ejercicio usa pandas, matplotlib o seaborn, antes los
// carga (la primera vez se descargan) con un límite más largo, para que la descarga no cuente en el de
// la comprobación; las figuras que deja abiertas el banco (la del primer caso con gráfico) vuelven
// con el resultado para enseñarlas.
import type { PyCodeInstance } from "../../../../../shared/exercises/python.ts";
import type { PyClient, RunOutcome } from "../../python/py-client.ts";
import {
  buildCheckProgram,
  buildOutputProgram,
  caseFiles,
  checkPayload,
  CHECK_TIMEOUT_MS,
  importsOf,
  parseCheckResult,
  parseOutputResult,
  type CheckResult,
  type OutputResult,
} from "./harness.ts";

export type Outcome<R> = { kind: "result"; result: R; figures?: string[] } | { kind: "timeout"; seconds: number } | { kind: "failed"; message: string };

/** Límite para cargar los paquetes de un ejercicio (la primera vez se descargan: pandas y matplotlib pesan). */
export const PACKAGES_TIMEOUT_MS = 240_000;
/** Límite de la comprobación de un ejercicio con paquetes (pandas es más lento que Python puro). */
export const DATA_CHECK_TIMEOUT_MS = 90_000;

const COPY_UNREADABLE = "No se ha podido leer el resultado de la comprobación. Vuelve a intentarlo.";

function outcomeOf<R>(o: RunOutcome, parse: (raw: string | undefined) => R | null): Outcome<R> {
  switch (o.kind) {
    case "done": {
      const result = parse(o.value);
      if (!result) return { kind: "failed", message: COPY_UNREADABLE };
      return o.figures.length > 0 ? { kind: "result", result, figures: o.figures } : { kind: "result", result };
    }
    case "timeout":
      return { kind: "timeout", seconds: o.seconds };
    case "stopped":
      return { kind: "failed", message: "La comprobación se ha detenido." };
    case "error":
      return { kind: "failed", message: o.message };
  }
}

const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

/**
 * Carga e importa los paquetes del ejercicio (sin ellos, nada). Devuelve null si todo va bien o el
 * fallo, que se enseña igual que el de una comprobación.
 */
export async function preparePackages(client: PyClient, instance: PyCodeInstance): Promise<Outcome<never> | null> {
  const mods = instance.packages ?? [];
  if (mods.length === 0) return null;
  const program = mods.map((m) => `import ${m}`).join("\n");
  const o = await client.run(program, PACKAGES_TIMEOUT_MS, () => {}, [], {});
  if (o.kind === "done") return null;
  if (o.kind === "timeout") return { kind: "timeout", seconds: o.seconds };
  if (o.kind === "stopped") return { kind: "failed", message: "La comprobación se ha detenido." };
  return { kind: "failed", message: `No se han podido cargar ${mods.join(", ")}: ${o.message.split("\n").at(-1) ?? o.message}` };
}

/** En qué está la comprobación: cargando los paquetes del ejercicio o ejecutando los casos. */
export type CheckStage = "paquetes" | "casos";

/** Comprueba el código de la persona con los casos del ejercicio. */
export async function checkCode(client: PyClient, instance: PyCodeInstance, code: string, onStage: (s: CheckStage) => void = () => {}): Promise<Outcome<CheckResult>> {
  try {
    if (instance.packages?.length) onStage("paquetes");
    const failed = await preparePackages(client, instance);
    if (failed) return failed;
  } catch (e) {
    return { kind: "failed", message: e instanceof Error ? e.message : String(e) };
  }
  onStage("casos");
  client.clearFiles();
  for (const f of caseFiles(instance.cases)) client.upload(f.path, bytes(f.text));
  try {
    const limit = instance.packages?.length ? DATA_CHECK_TIMEOUT_MS : CHECK_TIMEOUT_MS;
    const o = await client.run(buildCheckProgram(checkPayload(instance, code)), limit, () => {}, [], { capture: true, imports: importsOf(instance, code) });
    return outcomeOf(o, parseCheckResult);
  } catch (e) {
    return { kind: "failed", message: e instanceof Error ? e.message : String(e) };
  } finally {
    client.clearFiles();
  }
}

/** Ejecuta un fragmento de «¿Qué imprime?» y devuelve lo que imprime (no se muestra hasta acertar). */
export async function runSnippet(client: PyClient, code: string): Promise<Outcome<OutputResult>> {
  try {
    const o = await client.run(buildOutputProgram(code), CHECK_TIMEOUT_MS, () => {}, [], { capture: true, imports: code });
    return outcomeOf(o, parseOutputResult);
  } catch (e) {
    return { kind: "failed", message: e instanceof Error ? e.message : String(e) };
  }
}
