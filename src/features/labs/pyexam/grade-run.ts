// La corrección del simulacro de 01MIAR en el worker de Pyodide (los programas y su lectura están en
// grade.ts): carga los paquetes, escribe los archivos de cada lote en la carpeta «simulacro/», ejecuta
// la tanda y los borra. Si la tanda se pasa del tiempo (o Python se reinicia), se repite lote a lote,
// para que el atasco solo cuente en su parte.
import type { PyExam } from "../../../../shared/pyexam/index.ts";
import type { PyClient, RunOutcome } from "../python/py-client.ts";
import { combineGrading, gradeLots, gradeProgram, interpretLots, parseGradeResults, stepsToIsolate, type GradeLot, type LotResult, type PartReport, type PyExamGrading } from "./grade.ts";

/** Límites del worker: cargar los paquetes, una tanda entera y una parte suelta. */
export const GRADE_PACKAGES_TIMEOUT_MS = 240_000;
export const GRADE_BATCH_TIMEOUT_MS = 240_000;
export const GRADE_PART_TIMEOUT_MS = 90_000;

const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;
const packagesOf = (exam: PyExam) => [...new Set([...exam.project.packages, ...exam.shorts.flatMap((s) => s.check.packages ?? [])])];

export type GradeStage = "paquetes" | "corrigiendo" | "repitiendo";

/** Una tanda: escribe sus archivos, la ejecuta y los borra. Si se pasa del tiempo, lote a lote. */
async function runLots(client: PyClient, lots: readonly GradeLot[], imports: string): Promise<LotResult[]> {
  const paths: string[] = [];
  for (const l of lots) {
    for (const f of l.files) {
      client.upload(f.path, bytes(f.text));
      paths.push(f.path);
    }
  }
  const once = async (part: readonly GradeLot[], limit: number): Promise<LotResult[] | RunOutcome> => {
    const o = await client.run(gradeProgram(part), limit, () => {}, [], { capture: true, imports });
    if (o.kind !== "done") return o;
    return parseGradeResults(o.value, part.length) ?? { kind: "error", message: "No se ha podido leer el resultado de la corrección.", line: null, ms: 0, files: null };
  };
  try {
    const all = await once(lots, GRADE_BATCH_TIMEOUT_MS);
    if (Array.isArray(all)) return all;
    // Algo se ha atascado (o Python se ha reiniciado): parte a parte, para que solo cuente en la suya.
    const out: LotResult[] = [];
    for (const l of lots) {
      const one = await once([l], GRADE_PART_TIMEOUT_MS);
      if (Array.isArray(one)) out.push(one[0]!);
      else out.push({ check: null, figures: [], failure: one.kind === "timeout" ? `superó el límite de ${one.seconds} s y se detuvo` : one.kind === "error" ? (one.message.split("\n").at(-1) ?? one.message) : "se ha detenido" });
    }
    return out;
  } finally {
    for (const p of paths) client.removeFile(p);
  }
}

/** Corrige un intento en el worker. Devuelve null si no se pueden cargar los paquetes. */
export async function gradePyExam(client: PyClient, exam: PyExam, code: ReadonlyArray<string | null> | null, onStage: (s: GradeStage) => void = () => {}): Promise<PyExamGrading | null> {
  onStage("paquetes");
  const pre = await client.run(packagesOf(exam).map((m) => `import ${m}`).join("\n"), GRADE_PACKAGES_TIMEOUT_MS, () => {}, [], {});
  if (pre.kind !== "done") return null;
  const imports = [...packagesOf(exam).map((m) => `import ${m}`), ...(code ?? []).filter((c): c is string => c !== null)].join("\n");
  onStage("corrigiendo");
  const a = gradeLots(exam, code, "primera");
  const first = interpretLots(exam, a.refs, await runLots(client, a.lots, imports));
  const again = stepsToIsolate(exam, code, first);
  let isolated = new Map<number, PartReport>();
  if (again.length > 0) {
    onStage("repitiendo");
    const b = gradeLots(exam, code, "aislado", again);
    isolated = interpretLots(exam, b.refs, await runLots(client, b.lots, imports));
  }
  return combineGrading(exam, code, first, isolated);
}
