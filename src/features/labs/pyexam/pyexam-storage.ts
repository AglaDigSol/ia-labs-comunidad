// Intentos del simulacro de 01MIAR: se guardan como JSON en la clave «pyexam» de labs-storage.ts
// (localStorage «ia-labs.pyexam.v1» por defecto, o el almacén que inyecte la app anfitriona con
// configureLabs), aparte de los del simulacro de 02MIAR («exam»). Se valida al leer con
// parsePyExamStore: si no encaja, se empieza de cero.
import { EMPTY_PYEXAM_STORE, parsePyExamStore, serializePyExamStore, type PyExamStore } from "../../../../shared/pyexam/attempt.ts";
import { readLabItem, writeLabItem } from "../labs-storage.ts";

export function loadPyExamStore(): PyExamStore {
  const raw = readLabItem("pyexam");
  return (raw !== null && parsePyExamStore(raw)) || EMPTY_PYEXAM_STORE;
}

export function savePyExamStore(store: PyExamStore): void {
  writeLabItem("pyexam", serializePyExamStore(store));
}
