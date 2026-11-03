// Piezas compartidas por las secciones del laboratorio de álgebra lineal: la cuadrícula para escribir
// una matriz (celdas con nombre, flechas del teclado, pegar desde una hoja de cálculo y celdas
// marcadas sin decir su valor), la matriz en KaTeX, el campo de texto para una matriz propia, el
// selector de ejemplos y la lista de pistas.
import { Lightbulb, OctagonAlert } from "lucide-react";
import { useId, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import { matrixLabel, matrixTex, parseMatrix, type Matrix } from "../../../../shared/linalg/matrix.ts";
import { Button } from "../../../components/ui/button.tsx";
import { Textarea } from "../../../components/ui/textarea.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { selectClass } from "../boole/AxiomPractice.tsx";

export { plural, Status, Verdict } from "../sets/shared.tsx";

export const MAX_CELL_TEXT = 24;
export const LEVELS = ["básico", "medio", "avanzado"] as const;
export const levelLabel = (l: string) => l[0]!.toUpperCase() + l.slice(1);

export const HOW_TO_WRITE_NUMBERS = "Enteros, fracciones (3/4, −1/2) o decimales con coma o punto (0,5 o 0.5).";
export const HOW_TO_WRITE_MATRIX =
  "Una fila por línea (o separadas por ;) y los números separados por espacios. La coma pegada a cifras es la decimal: 0,5.";

/** Cuadrícula vacía de rows × cols. */
export const blankGrid = (rows: number, cols: number): string[][] => Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));

export const cellKey = (i: number, j: number) => `${i}-${j}`;

/** Matriz en KaTeX con su lectura para lectores de pantalla. */
export function MatrixView({ M, bar, label, det = false, className }: { M: Matrix; bar?: number; label: string; det?: boolean; className?: string }) {
  return (
    <Tex
      display
      tex={matrixTex(M, { bar, delim: det ? "det" : "paren" })}
      label={`${label}: ${matrixLabel(M)}`}
      className={cn("text-[18px]", className)}
    />
  );
}

/**
 * Cuadrícula editable: cada celda se llama «<nombre>, fila i, columna j». Las flechas mueven entre
 * celdas (Enter baja) y pegar varias líneas o tabuladores rellena a partir de la celda. Las celdas de
 * `flagged` se marcan como incorrectas (borde, icono y aria-invalid) sin enseñar ningún valor.
 */
export function MatrixGrid({
  name,
  values,
  onChange,
  flagged,
  bar,
  disabled = false,
}: {
  /** Nombre de la matriz para las etiquetas: «A·B», «A⁻¹», «Tu matriz». */
  name: string;
  values: string[][];
  onChange: (next: string[][]) => void;
  flagged?: ReadonlySet<string>;
  /** Raya de matriz ampliada antes de esta columna. */
  bar?: number;
  disabled?: boolean;
}) {
  const uid = useId();
  const rows = values.length;
  const cols = values[0]?.length ?? 0;
  const idOf = (i: number, j: number) => `${uid}-${i}-${j}`;
  const focus = (i: number, j: number) => {
    const el = document.getElementById(idOf(i, j));
    if (el instanceof HTMLInputElement) {
      el.focus();
      el.select();
    }
  };
  const set = (i: number, j: number, text: string) =>
    onChange(values.map((row, r) => (r === i ? row.map((c, k) => (k === j ? text.slice(0, MAX_CELL_TEXT) : c)) : row)));

  const onKey = (e: KeyboardEvent<HTMLInputElement>, i: number, j: number) => {
    const el = e.currentTarget;
    let ti = i;
    let tj = j;
    if (e.key === "ArrowDown" || e.key === "Enter") ti = Math.min(rows - 1, i + 1);
    else if (e.key === "ArrowUp") ti = Math.max(0, i - 1);
    else if (e.key === "ArrowRight" && el.selectionStart === el.value.length) tj = Math.min(cols - 1, j + 1);
    else if (e.key === "ArrowLeft" && el.selectionStart === 0) tj = Math.max(0, j - 1);
    else return;
    e.preventDefault();
    focus(ti, tj);
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>, i: number, j: number) => {
    const text = e.clipboardData.getData("text");
    if (!/[\t\n]/.test(text)) return;
    e.preventDefault();
    const lines = text.split(/\r?\n/);
    if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
    onChange(
      values.map((row, r) => {
        const line = lines[r - i];
        if (r < i || line === undefined) return row;
        const cells = line.split(/\t| +/);
        return row.map((c, k) => {
          const v = cells[k - j];
          return k < j || v === undefined ? c : v.trim().slice(0, MAX_CELL_TEXT);
        });
      }),
    );
  };

  return (
    <div className="max-w-full overflow-x-auto">
      <div
        role="group"
        aria-label={name}
        className="inline-grid gap-1.5 p-0.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(3.25rem, 4.5rem))` }}
      >
        {values.map((row, i) =>
          row.map((val, j) => {
            const bad = flagged?.has(cellKey(i, j)) ?? false;
            return (
              <div key={cellKey(i, j)} className={cn("relative", bar !== undefined && j === bar && "ml-2 border-l-2 border-border pl-2")}>
                <input
                  id={idOf(i, j)}
                  aria-label={`${name}, fila ${i + 1}, columna ${j + 1}`}
                  aria-invalid={bad ? "true" : undefined}
                  inputMode="text"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={disabled}
                  value={val}
                  onChange={(e) => set(i, j, e.target.value)}
                  onKeyDown={(e) => onKey(e, i, j)}
                  onPaste={(e) => onPaste(e, i, j)}
                  className={cn(
                    "h-11 w-full min-w-0 rounded-md border bg-raised px-1.5 text-right font-mono text-[16px] text-fg disabled:opacity-60",
                    bad ? "border-2 border-crit" : "border-border",
                  )}
                />
                {bad ? (
                  <OctagonAlert size={14} strokeWidth={1.75} aria-hidden="true" className="pointer-events-none absolute left-1 top-1 text-crit" />
                ) : null}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

/** Lista de pistas que se van abriendo de una en una. Las pistas dicen la regla, nunca el resultado. */
export function Hints({ hints, label = "Dame una pista" }: { hints: readonly string[]; label?: string }) {
  const [shown, setShown] = useState(0);
  const [lastKey, setLastKey] = useState(hints.join("|"));
  // Si cambian las pistas (otro ejercicio u otro paso), se vuelven a cerrar.
  const key = hints.join("|");
  if (key !== lastKey) {
    setLastKey(key);
    setShown(0);
  }
  return (
    <>
      <Button variant="ghost" disabled={shown >= hints.length} onClick={() => setShown((h) => h + 1)}>
        <Lightbulb size={16} aria-hidden="true" />
        {shown === 0 ? label : "Otra pista"}
      </Button>
      {shown > 0 ? (
        <ol className="w-full list-decimal pl-6 text-[14px]">
          {hints.slice(0, shown).map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ol>
      ) : null}
    </>
  );
}

/** Caja de una práctica, con su título. */
export function PracticeBox({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-raised p-3", className)}>
      <h2 id={id} className="font-display text-[20px] font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export type Preset = { id: string; label: string; level: string };

/**
 * Elegir un ejemplo (agrupado por nivel) o escribir una matriz propia. `onMatrix` recibe la matriz
 * leída del ejemplo o del texto; `check` puede rechazarla con un mensaje (por ejemplo, «tiene que
 * ser cuadrada»).
 */
export function MatrixSource({
  id,
  label,
  presets,
  value,
  onPreset,
  onOwn,
  check,
  placeholder = "1 2\n3 4",
}: {
  id: string;
  label: string;
  presets: readonly Preset[];
  /** Id del ejemplo elegido o «propia». */
  value: string;
  onPreset: (id: string) => void;
  onOwn: (M: Matrix, text: string) => void;
  check?: (M: Matrix) => string | null;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const use = () => {
    const r = parseMatrix(text);
    if (!r.ok) return setError(r.error);
    const problem = check?.(r.value) ?? null;
    if (problem) return setError(problem);
    setError(null);
    onOwn(r.value, text);
  };
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[14px] font-semibold">
        {label}
      </label>
      <select id={id} className={cn(selectClass, "w-full font-body")} value={value} onChange={(e) => onPreset(e.target.value)}>
        {LEVELS.map((level) => {
          const items = presets.filter((p) => p.level === level);
          return items.length === 0 ? null : (
            <optgroup key={level} label={levelLabel(level)}>
              {items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          );
        })}
        <option value="propia">Escribir la mía</option>
      </select>
      {value === "propia" ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-text`} className="text-[14px] font-semibold">
            Tu matriz
          </label>
          <Textarea
            id={`${id}-text`}
            className="font-mono"
            value={text}
            spellCheck={false}
            placeholder={placeholder}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-help`}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
          />
          <p id={`${id}-help`} className="text-[14px] text-muted">
            {`${HOW_TO_WRITE_MATRIX} ${HOW_TO_WRITE_NUMBERS}`}
          </p>
          {error ? (
            <p role="alert" className="text-[14px] text-crit">
              {error}
            </p>
          ) : null}
          <Button className="self-start" onClick={use}>
            Usar esta matriz
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Lee la matriz de un ejemplo del contenido (validado en los tests: si falla, es un error de programación). */
export function presetMatrix(text: string): Matrix {
  const r = parseMatrix(text);
  if (!r.ok) throw new Error(`ejemplo ilegible: ${text}`);
  return r.value;
}

/** «2×3». */
export const dimText = (M: Matrix) => `${M.length}×${M[0]?.length ?? 0}`;
