// «Supuestos» del diagrama de Venn: una lista de relaciones (A ⊆ B, A ∩ C = ∅…) que se dan por
// ciertas. El diagrama marca las regiones que obligan a estar vacías y, con dos conjuntos, ofrece
// dibujarlos anidados o separados. Las relaciones se leen y se analizan en shared/sets/relations.ts.
import { Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import type { ParseError } from "../../../../shared/logic/parser.ts";
import {
  MAX_HYPOTHESES,
  parseSetHypotheses,
  relationSpoken,
  relationToPlain,
  relationToTex,
  type NestedShape,
  type SetRelation,
} from "../../../../shared/sets/relations.ts";
import { Button } from "../../../components/ui/button.tsx";
import { Tex } from "../../../lib/tex.tsx";
import { HOW_TO_WRITE_RELATIONS, SetExprField } from "./shared.tsx";

/** Texto de la casilla de dibujo anidado según la forma. */
export const NESTED_LABEL: Record<NestedShape, string> = {
  "A-en-B": "Dibujar anidados (A dentro de B)",
  "B-en-A": "Dibujar anidados (B dentro de A)",
  separados: "Dibujar separados (A y B disjuntos)",
  iguales: "Dibujar un solo círculo (A = B)",
};

/** Muestra de la trama de las regiones vacías por hipótesis, con su texto (no solo el color). */
export function EmptyLegend({ regions, practice = false }: { regions: string[]; practice?: boolean }) {
  const id = `venn-empty-legend-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  if (regions.length === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-2 text-[14px]">
      <svg width={28} height={20} viewBox="0 0 28 20" aria-hidden="true" className="shrink-0">
        <defs>
          <pattern id={id} patternUnits="userSpaceOnUse" width={10} height={10}>
            <rect width={10} height={10} className="fill-sunken" />
            <path d="M 0 0 L 10 10 M 10 0 L 0 10" className="stroke-muted" strokeWidth={1} />
          </pattern>
        </defs>
        <rect x={0.5} y={0.5} width={27} height={19} rx={3} fill={`url(#${id})`} className="stroke-border" />
      </svg>
      <span>{`Vacías por hipótesis (rayado cruzado y ∅): ${regions.join("; ")}.${practice ? " No cuentan al comprobar." : ""}`}</span>
    </p>
  );
}

/** Lista de supuestos con su campo para añadir más. */
export function HypothesesEditor({
  value,
  onChange,
  contradiction,
}: {
  value: readonly SetRelation[];
  onChange: (next: SetRelation[]) => void;
  /** Los supuestos se contradicen: ningún diagrama los cumple. */
  contradiction: boolean;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<ParseError | null>(null);
  const add = () => {
    const r = parseSetHypotheses(text);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    if (r.relations.length === 0) {
      setError({ code: "empty", start: 0, end: 0, message: "Escribe un supuesto, como A ⊆ B." });
      return;
    }
    const known = new Set(value.map(relationToPlain));
    const fresh = r.relations.filter((x) => !known.has(relationToPlain(x)));
    if (value.length + fresh.length > MAX_HYPOTHESES) {
      setError({ code: "too-long", start: 0, end: text.length, message: `Como mucho ${MAX_HYPOTHESES} supuestos.` });
      return;
    }
    setError(null);
    setText("");
    onChange([...value, ...fresh]);
  };
  return (
    <section aria-labelledby="hypotheses-title" className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <h2 id="hypotheses-title" className="font-display text-[18px] font-semibold">
        Supuestos
      </h2>
      <p className="text-[14px] text-muted">
        Relaciones que das por ciertas, como A ⊆ B o A ∩ C = ∅. El diagrama marca las regiones que quedan vacías.
      </p>
      {value.length > 0 ? (
        <ul aria-label="Supuestos" className="flex flex-col gap-1">
          {value.map((h, i) => (
            <li key={relationToPlain(h)} className="flex flex-wrap items-center gap-2">
              <Tex tex={relationToTex(h)} label={relationSpoken(h)} />
              <Button variant="ghost" aria-label={`Quitar el supuesto ${relationToPlain(h)}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <Trash2 size={16} aria-hidden="true" />
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px]">Ninguno: cualquier región puede tener elementos.</p>
      )}
      {contradiction ? (
        <p role="alert" className="text-[14px] text-crit">
          Estos supuestos se contradicen: ningún diagrama los cumple. Quita alguno.
        </p>
      ) : null}
      <SetExprField
        id="venn-hypothesis"
        label="Nuevo supuesto"
        value={text}
        onChange={(v) => {
          setText(v);
          setError(null);
        }}
        error={error}
        placeholder="A ⊆ B"
      />
      <Button variant="secondary" className="self-start" onClick={add} disabled={value.length >= MAX_HYPOTHESES}>
        <Plus size={16} aria-hidden="true" />
        Añadir supuesto
      </Button>
      <details className="text-[14px]">
        <summary className="flex min-h-11 cursor-pointer items-center">Cómo escribir relaciones</summary>
        <p className="pb-2 text-muted">{HOW_TO_WRITE_RELATIONS}</p>
      </details>
    </section>
  );
}
