// Asignaturas de la calculadora de notas (contenido, CC BY-SA 4.0). Para añadir una, crea un fichero
// como 01MIAR.ts y añádelo a esta lista. tests/content.test.ts valida que los pesos sumen 100 %.
import type { Course } from "../../shared/courses/types.ts";
import { MIAR01 } from "./01MIAR.ts";
import { MIAR02 } from "./02MIAR.ts";

export const COURSES: Course[] = [MIAR01, MIAR02];
