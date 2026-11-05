// Textos del resultado de una comprobación de Python (los ejercicios y el simulacro de 01MIAR): por qué
// no coincide un valor, una tabla o un array y qué le pasó a cada caso. Siempre describen lo que hizo
// el código de la persona, nunca el valor esperado.
import { CASE_SECONDS, type CaseDiff, type CaseResult, type DataDetail } from "./harness.ts";

/** Por qué no coincide una tabla, una serie o un array (con lo que hizo la persona, nunca lo esperado). */
export function detailText(d: DataDetail): string {
  const tuyo = d.tuyo ?? "";
  switch (d.clave) {
    case "forma":
      return `La forma (filas, columnas) no es la que debe salir: la tuya es ${tuyo}.`;
    case "columnas":
      return `Las columnas no son las que pide el enunciado: las tuyas son ${tuyo}.`;
    case "tipos":
      return `Alguna columna no tiene el tipo que pide el enunciado: ${tuyo}.`;
    case "indice":
      return tuyo ? `El índice no es el que debe salir (el tuyo: ${tuyo}).` : "El índice no es el que debe salir.";
    case "orden":
      return "Las filas son las que deben salir, pero en otro orden.";
    case "nulos":
      return tuyo.includes(":") ? `Los valores perdidos (NaN) no coinciden. Los tuyos, por columna: ${tuyo}.` : `Los valores perdidos (NaN) no coinciden: tu array tiene ${tuyo}.`;
    case "valores": {
      const where = `${d.donde ? ` en ${d.donde}` : ""}${d.fila !== undefined ? `, ${d.fila + 1}.ª fila` : ""}`;
      return `Hay algún valor distinto${where}${tuyo ? ` (el tuyo: ${tuyo})` : ""}.`;
    }
    case "tipo":
      return `No es del tipo que pide el enunciado: es ${tuyo || "otra cosa"}.`;
    default:
      return "No coincide con lo que debe salir.";
  }
}

export function diffText(d: CaseDiff): string {
  if (d.que === "valor") {
    const base = `Tu resultado: ${d.texto ?? "None"}${d.tipo ? ` (de tipo ${d.tipo}: revisa qué tipo pide el enunciado)` : ""}`;
    return d.detalle ? `${detailText(d.detalle)}\n${base}` : base;
  }
  if (d.que === "salida") return d.texto === "''" ? "Tu código no imprime nada." : `Tu salida: ${d.texto}`;
  const name = d.que.slice("archivo:".length);
  return d.texto === null ? `No has creado el archivo ${name}.` : `Tu archivo ${name}: ${d.texto}`;
}

/** Qué le pasó a un caso que no es correcto (vacío si lo es). `seconds`: el límite de cada caso. */
export function caseDetail(c: CaseResult, seconds = CASE_SECONDS): string[] {
  if (c.ok) return [];
  if (c.interno) return ["No se ha podido comprobar este caso."];
  if (c.tiempo) return [`Superó el límite de ${seconds} s: ¿hay un bucle que no termina?`];
  if (c.falta) return ["Falta la función."];
  if (c.error) return [`Tu código lanzó ${c.error.mensaje}${c.error.linea ? ` (línea ${c.error.linea} de tu código)` : ""}.`];
  return (c.mal ?? []).map(diffText);
}
