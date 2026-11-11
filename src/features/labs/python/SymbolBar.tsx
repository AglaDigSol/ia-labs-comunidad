// Barra de símbolos para pantallas táctiles: el teclado del iPad y del móvil esconde : ( ) [ ] " _ y no
// tiene Tab. Cada botón inserta el símbolo donde está el cursor del editor y deja el foco en él (el
// teclado no se cierra). Tab inserta la sangría del editor (cuatro espacios), como la tecla Tab.
import { useEffect, useState, type RefObject } from "react";

/** La sangría que inserta Tab en el editor. */
export const INDENT = "    ";

export const SYMBOLS: ReadonlyArray<{ text: string; label: string; name: string }> = [
  { text: ":", label: ":", name: "Insertar dos puntos" },
  { text: "(", label: "(", name: "Insertar paréntesis de apertura" },
  { text: ")", label: ")", name: "Insertar paréntesis de cierre" },
  { text: "[", label: "[", name: "Insertar corchete de apertura" },
  { text: "]", label: "]", name: "Insertar corchete de cierre" },
  { text: '"', label: '"', name: "Insertar comillas" },
  { text: "_", label: "_", name: "Insertar guion bajo" },
  { text: INDENT, label: "Tab", name: "Insertar sangría (Tab)" },
];

/** Pone `text` en lugar de la selección [start, end) y devuelve el texto y la posición del cursor. */
export function insertAt(value: string, start: number, end: number, text: string): { value: string; caret: number } {
  const s = Math.max(0, Math.min(start, value.length));
  const e = Math.max(s, Math.min(end, value.length));
  return { value: value.slice(0, s) + text + value.slice(e), caret: s + text.length };
}

/**
 * ¿Coincide la media query? Sin matchMedia (pruebas, navegadores muy antiguos) devuelve `fallback`.
 */
export function useMediaQuery(query: string, fallback: boolean): boolean {
  const read = () => (typeof window === "undefined" || typeof window.matchMedia !== "function" ? fallback : window.matchMedia(query).matches);
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const on = () => setMatches(mql.matches);
    on();
    mql.addEventListener?.("change", on);
    return () => mql.removeEventListener?.("change", on);
  }, [query]);
  return matches;
}

/**
 * La fila de botones. `onInsert` recibe el texto; el foco no sale del editor porque los botones no lo
 * toman al pulsarlos (preventDefault en pointerdown y mousedown) y, por si acaso, se le devuelve.
 */
export function SymbolBar({ target, onInsert }: { target: RefObject<HTMLTextAreaElement | null>; onInsert: (text: string) => void }) {
  const keep = (e: { preventDefault: () => void }) => e.preventDefault();
  return (
    <div role="toolbar" aria-label="Símbolos de Python" className="flex flex-wrap gap-1" data-symbol-bar="">
      {SYMBOLS.map((s) => (
        <button
          key={s.name}
          type="button"
          aria-label={s.name}
          onPointerDown={keep}
          onMouseDown={keep}
          onClick={() => {
            onInsert(s.text);
            target.current?.focus();
          }}
          className="mono flex h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center rounded-md border border-border bg-raised px-3 text-[16px] text-fg hover:bg-sunken"
        >
          <span aria-hidden="true">{s.label}</span>
        </button>
      ))}
    </div>
  );
}
