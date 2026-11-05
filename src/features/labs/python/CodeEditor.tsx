// Editor de código de los ejercicios de Python y del cuaderno del simulacro de 01MIAR: un textarea con
// los números de línea al lado (sin bibliotecas de editor).
import { useEffect, useRef, type KeyboardEvent } from "react";

/**
 * Editor sencillo: números de línea, Tab inserta cuatro espacios (Esc y después Tab sale) y Ctrl+Intro
 * llama a onSubmit (comprobar o ejecutar la celda). `describedBy`: el id del texto que explica las teclas.
 * `minRows`: alto mínimo, en líneas.
 */
export function CodeEditor({
  value,
  onChange,
  onSubmit,
  label,
  describedBy,
  minRows = 8,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  label: string;
  describedBy?: string;
  minRows?: number;
}) {
  const gutter = useRef<HTMLDivElement | null>(null);
  const area = useRef<HTMLTextAreaElement | null>(null);
  const caret = useRef<number | null>(null);
  const esc = useRef(false);
  useEffect(() => {
    if (caret.current === null || !area.current) return;
    area.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [value]);
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSubmit();
      return;
    }
    if (e.key === "Escape") {
      esc.current = true;
      return;
    }
    if (e.key === "Tab" && !e.shiftKey && !esc.current && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: t } = e.currentTarget;
      caret.current = s + 4;
      onChange(`${value.slice(0, s)}    ${value.slice(t)}`);
      return;
    }
    esc.current = false;
  }
  const lines = value.split("\n").length;
  return (
    <div className="flex overflow-hidden rounded-lg border border-border bg-sunken focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
      <div ref={gutter} aria-hidden="true" className="mono select-none overflow-hidden border-r border-border px-2 py-3 text-right text-[16px] leading-[1.5] text-muted">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <textarea
        ref={area}
        aria-label={label}
        aria-describedby={describedBy}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        onScroll={(e) => {
          if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
        }}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        wrap="off"
        rows={Math.max(minRows, lines + 1)}
        className="mono w-full resize-y whitespace-pre bg-transparent px-3 py-3 text-[16px] leading-[1.5] text-fg outline-none"
      />
    </div>
  );
}
