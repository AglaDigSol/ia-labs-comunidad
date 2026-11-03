// Intentos del simulacro de examen: se guardan como JSON en la clave «exam» de labs-storage.ts
// (localStorage «ia-labs.exam.v1» por defecto, o el almacén que inyecte la app anfitriona con
// configureLabs). Se valida al leer con parseExamStore: si no encaja, se empieza de cero.
import { EMPTY_EXAM_STORE, parseExamStore, serializeExamStore, type ExamStore } from "../../../../shared/exam/attempt.ts";
import { readLabItem, writeLabItem } from "../labs-storage.ts";

export function loadExamStore(): ExamStore {
  const raw = readLabItem("exam");
  return (raw !== null && parseExamStore(raw)) || EMPTY_EXAM_STORE;
}

export function saveExamStore(store: ExamStore): void {
  writeLabItem("exam", serializeExamStore(store));
}
