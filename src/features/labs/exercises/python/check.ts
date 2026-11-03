// «Comprobar» de los ejercicios de Python, en el worker: escribe los archivos de entrada de cada caso
// con la API de archivos (ejercicio/caso<k>/…), ejecuta el banco de pruebas con límite de tiempo y
// vacía la carpeta de trabajo al terminar.
import type { PyCodeInstance } from "../../../../../shared/exercises/python.ts";
import type { PyClient, RunOutcome } from "../../python/py-client.ts";
import {
  buildCheckProgram,
  buildOutputProgram,
  caseFiles,
  checkPayload,
  CHECK_TIMEOUT_MS,
  parseCheckResult,
  parseOutputResult,
  type CheckResult,
  type OutputResult,
} from "./harness.ts";

export type Outcome<R> = { kind: "result"; result: R } | { kind: "timeout"; seconds: number } | { kind: "failed"; message: string };

const COPY_UNREADABLE = "No se ha podido leer el resultado de la comprobación. Vuelve a intentarlo.";

function outcomeOf<R>(o: RunOutcome, parse: (raw: string | undefined) => R | null): Outcome<R> {
  switch (o.kind) {
    case "done": {
      const result = parse(o.value);
      return result ? { kind: "result", result } : { kind: "failed", message: COPY_UNREADABLE };
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

/** Comprueba el código de la persona con los casos del ejercicio. */
export async function checkCode(client: PyClient, instance: PyCodeInstance, code: string): Promise<Outcome<CheckResult>> {
  client.clearFiles();
  for (const f of caseFiles(instance.cases)) client.upload(f.path, bytes(f.text));
  try {
    const o = await client.run(buildCheckProgram(checkPayload(instance, code)), CHECK_TIMEOUT_MS, () => {}, [], { capture: true, imports: code });
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
