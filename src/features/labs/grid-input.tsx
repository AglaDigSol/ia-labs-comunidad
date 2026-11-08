// Entrada con el teclado en las rejillas de valores (tablas de verdad, instancias de predicados, mapa de
// Karnaugh al cambiar valores): una sola parada de tabulación por rejilla (tabindex itinerante), las
// flechas para moverse entre casillas editables y una tecla para cada valor. Nació de las sugerencias
// del grupo: rellenar tablas de 16 o 32 filas casilla a casilla con el ratón cansa.
//
// Teclas: V, T o 1 → verdadero; F o 0 → falso; X o - → indiferencia (solo donde se admite); Retroceso
// o Supr → vacío. Espacio e Intro siguen haciendo lo de siempre (el clic del botón: ? → V → F → ?).
// Tras escribir un valor, el foco baja a la fila siguiente de la misma columna («Avanzar al escribir»,
// encendido por defecto y recordado en este dispositivo); en la última fila se queda. ↑ ↓ cambian de
// fila, ← → de columna (si hay varias editables), Inicio y Fin van a la primera y a la última fila y
// Re Pág / Av Pág saltan 8 filas. El ratón y el tacto no cambian, y no se abre ningún teclado en el
// móvil: las casillas siguen siendo botones.
//
// Accesibilidad: la tabla lleva role="grid" (como el mapa de Karnaugh), así los lectores de pantalla
// pasan al modo de foco y las flechas llegan a la rejilla; cada casilla sigue siendo un botón con su
// etiqueta completa («Fila 2 (p = V, q = F), columna p → q: sin responder») y las cabeceras siguen
// siendo cabeceras de columna. Las instrucciones van en la propia página y en aria-describedby.
import { useCallback, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { readLabItem, writeLabItem } from "./labs-storage.ts";

/** Valor de una casilla: verdadero, falso, indiferencia (X) o vacío. */
export type CellValue = boolean | "X" | null;

/** Salto de Re Pág / Av Pág, en filas. */
export const PAGE_ROWS = 8;

/**
 * Lo que significa una tecla en una casilla: `{ value }` (también `null`, vaciar) o null si la tecla
 * no es de valor. La X solo cuenta con `allowX`. Con Ctrl, Alt o Cmd no es de valor (atajos del
 * navegador).
 */
export function cellKeyValue(
  e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">,
  allowX = false,
): { value: CellValue } | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  switch (e.key) {
    case "v":
    case "V":
    case "t":
    case "T":
    case "1":
      return { value: true };
    case "f":
    case "F":
    case "0":
      return { value: false };
    case "x":
    case "X":
    case "-":
      return allowX ? { value: "X" } : null;
    case "Backspace":
    case "Delete":
      return { value: null };
    default:
      return null;
  }
}

// ---------------------------------------------------------------- «Avanzar al escribir»

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const readAdvance = () => readLabItem("gridAdvance") !== "0";

/** ¿Baja el foco a la fila siguiente al escribir un valor? Encendido salvo que se haya apagado. */
export function useGridAdvance(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, readAdvance, () => true);
  const set = useCallback((v: boolean) => {
    writeLabItem("gridAdvance", v ? "1" : "0");
    listeners.forEach((fn) => fn());
  }, []);
  return [on, set];
}

// ---------------------------------------------------------------- Rejilla

/** Una casilla editable: su fila y su columna en la tabla (las que no se editan no cuentan). */
export type CellPos = { row: number; col: number };

const keyOf = (p: CellPos) => `${p.row}:${p.col}`;

export interface CellGrid {
  /** Props de la casilla (botón) de esa posición: ref, tabIndex y teclado. */
  cellProps(pos: CellPos): {
    ref: (el: HTMLButtonElement | null) => void;
    tabIndex: number;
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
    onFocus: () => void;
    "aria-describedby": string;
  };
  /** Lleva el foco a la primera casilla editable (al añadir una columna o un paso). */
  focusFirst(): void;
  /** Id del texto de los atajos (para GridShortcuts y aria-describedby). */
  hintId: string;
}

/**
 * Teclado de una rejilla de casillas editables. `cells` son las editables ahora mismo (en cualquier
 * orden); `onValue` recibe el valor de una tecla (o null al borrar).
 */
export function useCellGrid({
  cells,
  onValue,
  allowX = false,
}: {
  cells: readonly CellPos[];
  onValue: (pos: CellPos, value: CellValue) => void;
  allowX?: boolean;
}): CellGrid {
  const hintId = `grid-hint-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const [advance] = useGridAdvance();
  const [active, setActive] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const keys = new Set(cells.map(keyOf));
  // La casilla con tabindex 0: la última enfocada si sigue siendo editable; si no, la primera.
  const sorted = [...cells].sort((a, b) => a.col - b.col || a.row - b.row);
  const current = active !== null && keys.has(active) ? active : sorted[0] ? keyOf(sorted[0]) : null;

  const go = (to: CellPos | undefined) => {
    if (!to) return;
    const k = keyOf(to);
    setActive(k);
    refs.current.get(k)?.focus();
  };

  // Casillas de la misma columna (por fila) y de la misma fila (por columna).
  const column = (c: number) => cells.filter((p) => p.col === c).sort((a, b) => a.row - b.row);
  const row = (r: number) => cells.filter((p) => p.row === r).sort((a, b) => a.col - b.col);
  const below = (p: CellPos) => column(p.col).find((q) => q.row > p.row);

  const onKeyDown = (pos: CellPos) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const typed = cellKeyValue(e, allowX);
    if (typed) {
      e.preventDefault();
      onValue(pos, typed.value);
      if (advance && typed.value !== null) go(below(pos));
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const col = column(pos.col);
    const line = row(pos.row);
    let to: CellPos | undefined;
    switch (e.key) {
      case "ArrowDown":
        to = below(pos);
        break;
      case "ArrowUp":
        to = col.filter((q) => q.row < pos.row).pop();
        break;
      case "ArrowRight":
        to = line.find((q) => q.col > pos.col);
        break;
      case "ArrowLeft":
        to = line.filter((q) => q.col < pos.col).pop();
        break;
      case "Home":
        to = col[0];
        break;
      case "End":
        to = col[col.length - 1];
        break;
      case "PageDown":
        to = col.filter((q) => q.row > pos.row && q.row <= pos.row + PAGE_ROWS).pop() ?? below(pos);
        break;
      case "PageUp":
        to = col.find((q) => q.row < pos.row && q.row >= pos.row - PAGE_ROWS) ?? col.filter((q) => q.row < pos.row).pop();
        break;
      default:
        return;
    }
    // Las flechas nunca desplazan la página, aunque no haya casilla a la que ir.
    e.preventDefault();
    go(to);
  };

  return {
    hintId,
    cellProps: (pos) => {
      const k = keyOf(pos);
      return {
        ref: (el) => {
          if (el) refs.current.set(k, el);
          else refs.current.delete(k);
        },
        tabIndex: k === current ? 0 : -1,
        onKeyDown: onKeyDown(pos),
        onFocus: () => setActive(k),
        "aria-describedby": hintId,
      };
    },
    focusFirst: () => go(sorted[0]),
  };
}

// ---------------------------------------------------------------- Aviso de los atajos

/** «V/F (o 1/0)» o «1/0 (o V/F)», según el formato de la tabla. */
export function answerKeysText(format: "VF" | "10" | "01X"): string {
  if (format === "01X") return "0, 1 o X";
  return format === "10" ? "1/0 (o V/F)" : "V/F (o 1/0)";
}

/**
 * El aviso de los atajos (una vez por rejilla) con el desplegable «Atajos de teclado» y la opción
 * «Avanzar al escribir». `id` es el de la rejilla (grid.hintId), al que apuntan sus casillas.
 */
export function GridShortcuts({
  id,
  format,
  allowX = false,
  clear = true,
  columns = false,
}: {
  id: string;
  /** Formato de los valores: V/F, 1/0 o el del mapa de Karnaugh (0, 1 o X). */
  format: "VF" | "10" | "01X";
  /** ¿Se admite la X (indiferencia)? */
  allowX?: boolean;
  /** ¿Se puede vaciar una casilla? (En el mapa de Karnaugh no hay casillas vacías.) */
  clear?: boolean;
  /** ¿Hay varias columnas editables a la vez? */
  columns?: boolean;
}) {
  const [advance, setAdvance] = useGridAdvance();
  // El contenido solo se monta abierto: así no cuenta como lista ni como casilla mientras está plegado.
  const [open, setOpen] = useState(false);
  const yes = format === "10" ? "1" : "V";
  const no = format === "10" ? "0" : "F";
  return (
    <div className="flex flex-col gap-1 text-[14px] text-muted">
      <p id={id}>
        {`Atajos: ${answerKeysText(format)} para responder, flechas para moverte${clear ? ", Supr para borrar" : ""}.`}
      </p>
      <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-fg">Atajos de teclado</summary>
        {open ? (
          <>
            <ul className="flex list-disc flex-col gap-1 pb-2 pl-6">
              {format === "01X" ? (
                <li>1 (o V) pone un 1, 0 (o F) pone un 0 y X (o -) pone una indiferencia.</li>
              ) : (
                <>
                  <li>{`${yes === "1" ? "1, V o T" : "V, T o 1"}: verdadero (${yes}).`}</li>
                  <li>{`${no === "0" ? "0 o F" : "F o 0"}: falso (${no}).`}</li>
                  {allowX ? <li>X o -: indiferencia (X).</li> : null}
                </>
              )}
              {clear ? <li>Retroceso o Supr: deja la casilla vacía.</li> : null}
              <li>Espacio o Intro: cambia el valor como un clic.</li>
              {format === "01X" ? (
                <li>Flechas: la celda vecina; Inicio y Fin: primera y última columna de la fila.</li>
              ) : (
                <>
                  <li>{columns ? "↑ ↓: fila anterior o siguiente; ← →: otra columna." : "↑ ↓: fila anterior o siguiente."}</li>
                  <li>{`Inicio y Fin: primera y última fila; Re Pág y Av Pág: ${PAGE_ROWS} filas arriba o abajo.`}</li>
                </>
              )}
              <li>{format === "01X" ? "Tabulador: sale del mapa (todo el mapa es una sola parada)." : "Tabulador: sale de la tabla (toda la tabla es una sola parada)."}</li>
            </ul>
            <label className="flex min-h-11 items-center gap-2 text-fg">
              <input type="checkbox" className="h-5 w-5" checked={advance} onChange={(e) => setAdvance(e.target.checked)} />
              Avanzar al escribir
            </label>
            <p className="pb-2">Al escribir un valor, el foco baja a la fila siguiente de la misma columna. Se recuerda en este dispositivo.</p>
          </>
        ) : null}
      </details>
    </div>
  );
}
