// Piezas para escribir enunciados y soluciones del simulacro (ExamBlock) sin React: párrafos con
// fórmulas en línea, fórmulas destacadas, listas y pseudocódigo. El TeX lo escribe siempre el código.
import type { ExamBlock, ExamInline } from "./types.ts";

/** Párrafo. */
export const examP = (...parts: ExamInline[]): ExamBlock => ({ kind: "p", parts });
/** Párrafo en negrita (la pregunta, un dato importante). */
export const examStrong = (...parts: ExamInline[]): ExamBlock => ({ kind: "p", parts, strong: true });
/** Párrafo secundario (una aclaración). */
export const examMuted = (...parts: ExamInline[]): ExamBlock => ({ kind: "p", parts, muted: true });
/** Fórmula destacada. */
export const examMath = (tex: string, label: string): ExamBlock => ({ kind: "math", tex, label });
/** Fórmula en línea. */
export const examTex = (tex: string, label: string): ExamInline => ({ tex, label });
/** Lista. */
export const examList = (items: ExamInline[][]): ExamBlock => ({ kind: "list", items });
/** Pseudocódigo. */
export const examCode = (lines: string[], label = "Pseudocódigo"): ExamBlock => ({ kind: "code", lines, label });

/** Texto plano de un bloque (para buscar, para tests y para lectores de pantalla). */
export function examBlockText(b: ExamBlock): string {
  const inline = (x: ExamInline) => (typeof x === "string" ? x : x.label);
  switch (b.kind) {
    case "p":
      return b.parts.map(inline).join("");
    case "math":
      return b.label;
    case "list":
      return b.items.map((it) => it.map(inline).join("")).join("\n");
    case "code":
      return b.lines.join("\n");
  }
}

/** Una matriz de enteros en TeX (pmatrix). */
export const intMatrixTex = (M: readonly (readonly number[])[]): string =>
  `\\begin{pmatrix} ${M.map((r) => r.join(" & ")).join(" \\\\ ")} \\end{pmatrix}`;

/** La misma matriz en texto: «(1 2; 3 4)». */
export const intMatrixText = (M: readonly (readonly number[])[]): string => `(${M.map((r) => r.join(" ")).join("; ")})`.replace(/-/g, "−");

/** Entero con el signo menos tipográfico. */
export const intText = (n: number | bigint): string => String(n).replace("-", "−");
