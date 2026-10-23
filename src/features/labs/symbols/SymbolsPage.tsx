import { ArrowLeft, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { ALL_SYMBOLS, symbolById } from "../../../../shared/symbols/index.ts";
import { searchSymbols } from "../../../../shared/symbols/search.ts";
import { CATEGORY_LABELS, SYMBOL_CATEGORIES, type SymbolCategory } from "../../../../shared/symbols/types.ts";
import { Button } from "../../../components/ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog.tsx";
import { Input } from "../../../components/ui/input.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select.tsx";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { cancelSpeech } from "../../../lib/speech.ts";
import { SymbolCard } from "./SymbolCard.tsx";
import { SymbolList } from "./SymbolList.tsx";

const DEBOUNCE_MS = 150;
const ALL = "todas";
const CHIP = "rounded-full border border-border bg-raised px-3 whitespace-nowrap";

// Without matchMedia (tests, very old browsers) the desktop/tablet branch is used,
// so exactly one filter control and one card instance exist at any time.
function useMediaQuery(query: string): boolean {
  const read = () => (typeof window.matchMedia !== "function" ? true : window.matchMedia(query).matches);
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const on = () => setMatches(mql.matches);
    on();
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, [query]);
  return matches;
}

function validCategory(c: string | null): SymbolCategory | null {
  return c && (SYMBOL_CATEGORIES as string[]).includes(c) ? (c as SymbolCategory) : null;
}

export function SymbolsPage() {
  const [params, setParams] = useSearchParams();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const tablet = useMediaQuery("(min-width: 640px)");

  const category = validCategory(params.get("c"));
  const selected = (() => {
    const s = params.get("s");
    return s ? (symbolById(s) ?? null) : null;
  })();

  const [input, setInput] = useState(() => (params.get("q") ?? "").slice(0, 100));
  const [query, setQuery] = useState(input);

  useEffect(() => {
    const t = setTimeout(() => setQuery(input), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  const patch = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(changes)) {
            if (v === null || v === "") next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  // Last q written to the URL; avoids a second, stale-snapshot navigation after Quitar filtros.
  const writtenQ = useRef(params.get("q") ?? "");
  useEffect(() => {
    if (query.trim() === writtenQ.current) return;
    writtenQ.current = query.trim();
    patch({ q: query.trim() });
  }, [query, patch]);

  // Switching symbol stops any audio (the card unmounts too, this covers the deep-link case).
  useEffect(() => {
    cancelSpeech();
  }, [selected?.id]);
  useEffect(() => () => cancelSpeech(), []);

  const results = useMemo(() => searchSymbols(ALL_SYMBOLS, query, category), [query, category]);

  // Desktop shows the card beside the list: never leave it empty while there are results,
  // and follow the filter when the selected symbol drops out of the visible results.
  const firstId = results[0]?.id ?? null;
  const selectedVisible = selected ? results.some((r) => r.id === selected.id) : false;
  useEffect(() => {
    if (desktop && firstId && !selectedVisible) patch({ s: firstId });
  }, [desktop, selectedVisible, firstId, patch]);

  const select = (id: string) => patch({ s: id });
  const clearFilters = () => {
    setInput("");
    setQuery("");
    writtenQ.current = "";
    patch({ q: null, c: null });
  };

  const categoryControl = tablet ? (
    <ToggleGroup
      type="single"
      aria-label="Categoría"
      value={category ?? ALL}
      onValueChange={(v) => {
        if (v) patch({ c: v === ALL ? null : v });
      }}
      className="flex flex-wrap gap-2 overflow-visible rounded-none border-0 bg-transparent"
    >
      <ToggleGroupItem value={ALL} className={CHIP}>
        Todas
      </ToggleGroupItem>
      {SYMBOL_CATEGORIES.map((c) => (
        <ToggleGroupItem key={c} value={c} className={CHIP}>
          {CATEGORY_LABELS[c]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  ) : (
    <Select value={category ?? ALL} onValueChange={(v) => patch({ c: v === ALL ? null : v })}>
      <SelectTrigger aria-label="Categoría">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Todas</SelectItem>
        {SYMBOL_CATEGORIES.map((c) => (
          <SelectItem key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 tabIndex={-1} className="font-display text-[28px] font-semibold leading-[1.2]">
          Diccionario de simbología
        </h1>
        <p className="text-muted">Busca un símbolo, cómo se lee en clase y su equivalente en Python.</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-5">
          <div className="relative">
            <Search
              size={16}
              strokeWidth={1.75}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <Input
              type="search"
              aria-label="Buscar en el diccionario"
              placeholder="Buscar símbolo o palabra (por ejemplo, implicación)"
              value={input}
              maxLength={100}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              lang="es"
              onChange={(e) => setInput(e.target.value)}
              className="min-h-11 pl-9"
            />
          </div>
          {categoryControl}
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted" aria-live="polite">
            {results.length === 1 ? "1 símbolo" : `${results.length} símbolos`}
          </p>
          {results.length === 0 ? (
            <div className="flex flex-col items-start gap-2 border-t border-border pt-4">
              <p className="font-semibold">No hay símbolos con esa búsqueda</p>
              <p className="text-muted">Prueba con otra palabra, con el símbolo mismo o quita los filtros.</p>
              <Button onClick={clearFilters}>Quitar filtros</Button>
            </div>
          ) : (
            <SymbolList
              entries={results}
              selectedId={selected?.id ?? null}
              grouped={!category && !query.trim()}
              onSelect={select}
            />
          )}
        </div>

        {desktop ? (
          <div className="min-w-0 lg:sticky lg:top-4 lg:col-span-7">
            {selected ? (
              <SymbolCard key={selected.id} entry={selected} onSelectRelated={select} />
            ) : (
              <div className="rounded-lg border border-border bg-raised p-6">
                <p className="font-semibold">Elige un símbolo</p>
                <p className="text-muted">Selecciona una fila de la lista para ver su ficha.</p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {!desktop && selected ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) patch({ s: null });
          }}
        >
          <DialogContent
            aria-describedby={undefined}
            className="inset-0 h-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none"
            style={{ left: 0, top: 0, width: "100%", transform: "none" }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              document.querySelector<HTMLElement>(`[data-symbol-id="${selected.id}"]`)?.focus();
            }}
          >
            <Button variant="ghost" className="w-fit" onClick={() => patch({ s: null })}>
              <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
              Volver a la lista
            </Button>
            <DialogTitle>{selected.name}</DialogTitle>
            <DialogDescription className="sr-only">Ficha del símbolo</DialogDescription>
            <SymbolCard key={selected.id} entry={selected} onSelectRelated={select} hideName />
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}
