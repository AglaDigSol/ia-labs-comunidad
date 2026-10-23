import { ChevronLeft, ChevronRight, Delete, X } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { NOTATION } from "../../../../content/notation/index.ts";
import type { ParseError } from "../../../../shared/logic/parser.ts";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { cn } from "../../../lib/cn.ts";


export function FormulaField({
  id,
  label,
  value,
  onChange,
  error,
  inputRef,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: ParseError | null;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const mirror = useRef<HTMLDivElement>(null);
  const [undo, setUndo] = useState<string | null>(null);
  useEffect(() => {
    if (undo === null) return;
    const t = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(t);
  }, [undo]);

  const msgId = `${id}-error`;
  const start = error ? Math.min(error.start, value.length) : 0;
  const end = error ? Math.max(Math.min(error.end, value.length), start) : 0;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[14px] font-semibold">
        {label}
      </label>
      <div className="flex items-center gap-1">
        <div className="relative min-w-0 flex-1">
          <div
            ref={mirror}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre rounded-md border border-transparent bg-sunken px-3 py-[11px] font-mono text-[16px] leading-[24px] text-transparent"
          >
            {error ? (
              <>
                {value.slice(0, start)}
                <span className="underline decoration-crit decoration-wavy decoration-2 underline-offset-4">
                  {value.slice(start, end) || " "}
                </span>
                {value.slice(end)}
              </>
            ) : (
              value
            )}
          </div>
          <input
            id={id}
            ref={inputRef}
            type="text"
            value={value}
            lang="es"
            inputMode="text"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? msgId : undefined}
            onChange={(e) => onChange(e.target.value)}
            onScroll={(e) => {
              if (mirror.current) mirror.current.scrollLeft = e.currentTarget.scrollLeft;
            }}
            className={cn(
              "relative h-12 w-full rounded-md border bg-transparent px-3 font-mono text-[16px] text-fg placeholder:text-muted",
              error ? "border-crit" : "border-border",
            )}
            placeholder="p → q"
          />
        </div>
        <button
          type="button"
          aria-label="Borrar fórmula"
          title="Borrar fórmula"
          disabled={value === ""}
          onClick={() => {
            setUndo(value);
            onChange("");
            inputRef.current?.focus();
          }}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-fg hover:bg-sunken disabled:pointer-events-none disabled:opacity-50"
        >
          <X size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      {error ? (
        <p id={msgId} role="alert" className="text-[14px] text-crit">
          {error.message}
        </p>
      ) : null}
      {undo !== null ? (
        <p className="flex items-center gap-2 text-[14px] text-muted" role="status">
          Fórmula borrada.
          <Button
            variant="ghost"
            onClick={() => {
              onChange(undo);
              setUndo(null);
            }}
          >
            Deshacer
          </Button>
        </p>
      ) : null}
      {value.includes("⊕") ? (
        <div className="flex flex-col items-start gap-2">
          <Chip tone="info" className="whitespace-normal font-normal">
            {NOTATION.oplus.note}
          </Chip>
          <Button variant="secondary" onClick={() => onChange(value.replaceAll("⊕", NOTATION.oplus.replaceWith))}>
            {NOTATION.oplus.actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const KEYS: Array<{ glyph: string; label: string }> = [
  { glyph: "¬", label: "negación" },
  { glyph: "∧", label: "conjunción" },
  { glyph: "∨", label: "disyunción" },
  { glyph: "⊻", label: "o exclusivo («o … o»)" },
  { glyph: "→", label: "implicación" },
  { glyph: "↔", label: "bicondicional" },
  { glyph: "(", label: "abrir paréntesis" },
  { glyph: ")", label: "cerrar paréntesis" },
];
const VARS = ["p", "q", "r", "s"];
const MORE_VARS = ["t", "u", "v", "w"];

const keyClass =
  "inline-flex h-12 w-12 items-center justify-center rounded-md border border-border bg-base font-mono text-[20px] text-fg [touch-action:manipulation] hover:bg-sunken active:bg-accent-soft pointer-fine:h-11 pointer-fine:w-11";

export function SymbolKeypad({
  targetRef,
  onChange,
}: {
  targetRef: RefObject<HTMLInputElement | null>;
  onChange: (v: string) => void;
}) {
  const [more, setMore] = useState(false);

  const apply = (edit: (value: string, s: number, e: number) => { value: string; caret: number }) => {
    const el = targetRef.current;
    if (!el) return;
    const s = el.selectionStart ?? el.value.length;
    const e = el.selectionEnd ?? s;
    const next = edit(el.value, s, e);
    onChange(next.value);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    }, 0);
  };
  const insert = (text: string) =>
    apply((v, s, e) => ({ value: v.slice(0, s) + text + v.slice(e), caret: s + text.length }));
  const backspace = () =>
    apply((v, s, e) =>
      s !== e
        ? { value: v.slice(0, s) + v.slice(e), caret: s }
        : s === 0
          ? { value: v, caret: 0 }
          : { value: v.slice(0, s - 1) + v.slice(s), caret: s - 1 },
    );
  const move = (d: number) =>
    apply((v, s) => ({ value: v, caret: Math.max(0, Math.min(v.length, s + d)) }));

  const keep = {
    onPointerDown: (e: React.PointerEvent) => e.preventDefault(),
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
  };

  return (
    <div
      role="group"
      aria-label="Teclado de símbolos"
      className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 flex flex-col gap-2 rounded-lg border border-border bg-raised p-2 lg:static"
    >
      <div className="flex flex-wrap gap-1">
        {KEYS.map((k) => (
          <button
            key={k.glyph}
            type="button"
            aria-label={k.label}
            title={k.label}
            className={keyClass}
            {...keep}
            onClick={() => insert(k.glyph)}
          >
            {k.glyph}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {VARS.map((v) => (
          <button
            key={v}
            type="button"
            aria-label={`variable ${v}`}
            title={`variable ${v}`}
            className={keyClass}
            {...keep}
            onClick={() => insert(v)}
          >
            {v}
          </button>
        ))}
        <button
          type="button"
          aria-label="más variables"
          title="más variables"
          aria-expanded={more}
          className={cn(keyClass, "w-auto px-2 text-[14px]")}
          {...keep}
          onClick={() => setMore((m) => !m)}
        >
          + var
        </button>
        {more
          ? MORE_VARS.map((v) => (
              <button
                key={v}
                type="button"
                aria-label={`variable ${v}`}
                title={`variable ${v}`}
                className={keyClass}
                {...keep}
                onClick={() => insert(v)}
              >
                {v}
              </button>
            ))
          : null}
        <button
          type="button"
          aria-label="Mover cursor a la izquierda"
          title="Mover cursor a la izquierda"
          className={keyClass}
          {...keep}
          onClick={() => move(-1)}
        >
          <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Mover cursor a la derecha"
          title="Mover cursor a la derecha"
          className={keyClass}
          {...keep}
          onClick={() => move(1)}
        >
          <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Borrar carácter"
          title="Borrar carácter"
          className={keyClass}
          {...keep}
          onClick={backspace}
        >
          <Delete size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
