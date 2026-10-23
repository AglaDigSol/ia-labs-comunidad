import { useEffect, useRef, useState } from "react";
import {
  CATEGORY_LABELS,
  SYMBOL_CATEGORIES,
  type SymbolCategory,
  type SymbolEntry,
} from "../../../../shared/symbols/types.ts";
import { Chip } from "../../../components/ui/chip.tsx";
import { Tex } from "../../../lib/tex.tsx";

const FIRST_PAINT_ROWS = 20;

function Row({
  entry,
  selected,
  tabbable,
  onSelect,
}: {
  entry: SymbolEntry;
  selected: boolean;
  tabbable: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <li className="border-b border-border">
      <button
        type="button"
        data-symbol-id={entry.id}
        aria-current={selected ? "true" : undefined}
        tabIndex={tabbable ? 0 : -1}
        onClick={() => onSelect(entry.id)}
        className={`flex min-h-14 w-full items-center gap-3 px-2 py-2 text-left hover:bg-sunken ${
          selected ? "bg-accent-soft" : ""
        }`}
      >
        {/* Fixed-width glyph column: long formulas get a smaller size and are clipped,
            never drawn over the name. The card shows them at full size. */}
        <span
          className={`flex w-24 shrink-0 items-center justify-center overflow-hidden whitespace-nowrap ${glyphSize(entry.tex)}`}
        >
          <Tex tex={entry.tex} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">{entry.name}</span>
          <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">
            {CATEGORY_LABELS[entry.category]}
          </span>
        </span>
        {entry.session === "posterior" ? null : (
          <Chip tone="outline" className="font-mono">
            S{entry.session}
          </Chip>
        )}
      </button>
    </li>
  );
}

// Visual length of the TeX source, ignoring command names' backslashes and braces.
function glyphSize(tex: string): string {
  const n = tex.replace(/\\[a-zA-Z]+/g, "x").replace(/[{}\s]/g, "").length;
  if (n <= 4) return "text-[20px]";
  if (n <= 9) return "text-[16px]";
  return "text-[12px]";
}

export function SymbolList({
  entries,
  selectedId,
  grouped,
  onSelect,
}: {
  entries: SymbolEntry[];
  selectedId: string | null;
  grouped: boolean;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // First paint renders only the first rows (KaTeX is the cost); the rest follows right after.
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setExpanded(true), 0);
    return () => clearTimeout(t);
  }, []);
  const visible = expanded ? entries : entries.slice(0, FIRST_PAINT_ROWS);
  const tabbableId = entries.some((e) => e.id === selectedId) ? selectedId : entries[0]?.id;

  function onKeyDown(ev: React.KeyboardEvent) {
    if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
    const rows = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("[data-symbol-id]") ?? []);
    const i = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (i === -1) return;
    ev.preventDefault();
    rows[Math.min(rows.length - 1, Math.max(0, i + (ev.key === "ArrowDown" ? 1 : -1)))]?.focus();
  }

  const renderRows = (list: SymbolEntry[]) =>
    list.map((e) => (
      <Row key={e.id} entry={e} selected={e.id === selectedId} tabbable={e.id === tabbableId} onSelect={onSelect} />
    ));

  return (
    <div ref={ref} onKeyDown={onKeyDown} className="border-t border-border">
      {grouped ? (
        SYMBOL_CATEGORIES.map((c: SymbolCategory) => {
          const rows = visible.filter((e) => e.category === c);
          if (rows.length === 0) return null;
          return (
            <div key={c}>
              <h2 className="sticky top-0 z-10 bg-base px-2 py-1 text-[12px] font-semibold uppercase tracking-wide text-muted">
                {CATEGORY_LABELS[c]}
              </h2>
              <ul>{renderRows(rows)}</ul>
            </div>
          );
        })
      ) : (
        <ul>{renderRows(visible)}</ul>
      )}
    </div>
  );
}
