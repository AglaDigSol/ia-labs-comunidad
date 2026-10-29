// «Exportar / Importar mis datos»: copia JSON de todo lo que la app guarda en este navegador.
import { z } from "zod";
import { DEFAULT_LABS_KEYS } from "../features/labs/labs-storage.ts";
import { t } from "../i18n/index.ts";
import { importKv, snapshotKv, type ImportReport } from "./kv-store.ts";

export const BACKUP_APP = "ia-labs-comunidad";
export const BACKUP_VERSION = 1;
/** Claves de localStorage ajenas al almacén KV que también viajan en la copia. */
export const EXTRA_KEYS = [
  DEFAULT_LABS_KEYS.markov,
  DEFAULT_LABS_KEYS.logicFormat,
  DEFAULT_LABS_KEYS.boole,
  DEFAULT_LABS_KEYS.exercises,
] as const;

const BackupSchema = z.strictObject({
  app: z.literal(BACKUP_APP),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string().max(40),
  data: z.record(z.string().max(200), z.unknown()),
  extras: z.partialRecord(z.enum(EXTRA_KEYS), z.string().max(16 * 1024)).optional(),
});
export type Backup = z.infer<typeof BackupSchema>;

function readExtra(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function buildBackup(now: Date = new Date()): Backup {
  const extras: Record<string, string> = {};
  for (const k of EXTRA_KEYS) {
    const v = readExtra(k);
    if (v !== null) extras[k] = v;
  }
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data: snapshotKv(), extras };
}

export function backupFileName(now: Date = new Date()): string {
  return `ia-labs-datos-${now.toISOString().slice(0, 10)}.json`;
}

export type RestoreResult = { ok: true; report: ImportReport } | { ok: false; error: string };

export const IMPORT_ERROR = t.settings.invalidFile;

export function restoreBackup(text: string, mode: "replace" | "merge"): RestoreResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: IMPORT_ERROR };
  }
  const parsed = BackupSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: IMPORT_ERROR };
  const report = importKv(parsed.data.data, mode);
  for (const [k, v] of Object.entries(parsed.data.extras ?? {})) {
    try {
      localStorage.setItem(k, v);
    } catch {
      // almacenamiento no disponible
    }
  }
  return { ok: true, report };
}
