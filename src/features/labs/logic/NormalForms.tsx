import {
  canonicalForms,
  formatFND,
  formatFNC,
  type Formatted,
} from "../../../../shared/logic/canonical.ts";
import type { Table } from "../../../../shared/logic/truth-table.ts";
import { Tex } from "../../../lib/tex.tsx";

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const sub = (n: number) => [...String(n)].map((d) => SUB[Number(d)]!).join("");

function openByDefault(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(min-width: 1024px)").matches
    : false;
}

function Block({
  title,
  kind,
  indices,
  formatted,
  emptyText,
}: {
  title: string;
  kind: "m" | "M";
  indices: number[];
  formatted: Formatted;
  emptyText: string;
}) {
  const word = kind === "m" ? "Minterms" : "Maxterms";
  return (
    <details open={openByDefault()} className="rounded-lg border border-border bg-raised px-3">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2">
        <h3 className="font-display text-[16px] font-semibold">{title}</h3>
      </summary>
      <div className="flex flex-col gap-3 pb-3">
        {indices.length === 0 ? (
          <p>{emptyText}</p>
        ) : (
          <>
            <Tex tex={formatted.compact} />
            <p>{`${word}: ${indices.map((i) => `${kind}${sub(i)}`).join(", ")}`}</p>
            <ul className="flex max-h-60 flex-col gap-1 overflow-auto font-mono text-[14px]">
              {formatted.terms.map((t) => (
                <li key={t.index} className="flex flex-wrap gap-2">
                  <span>{`${kind}${sub(t.index)} =`}</span>
                  <span>{kind === "M" ? `(${t.plain})` : t.plain}</span>
                </li>
              ))}
            </ul>
            <Tex display tex={formatted.tex} label={`${title}, expresión completa`} />
          </>
        )}
      </div>
    </details>
  );
}

export function NormalForms({ table }: { table: Table }) {
  const { minterms, maxterms } = canonicalForms(table);
  const fnd = formatFND(table.vars, minterms, "logica");
  const fnc = formatFNC(table.vars, maxterms, "logica");
  return (
    <div className="flex flex-col gap-3">
      <Block
        title="Forma normal disyuntiva (FND)"
        kind="m"
        indices={minterms}
        formatted={fnd}
        emptyText="Sin minterms: la fórmula es una contradicción."
      />
      <Block
        title="Forma normal conjuntiva (FNC)"
        kind="M"
        indices={maxterms}
        formatted={fnc}
        emptyText="Sin maxterms: la fórmula es una tautología."
      />
      <p className="text-[14px] text-muted">
        Formas canónicas sin simplificar: la app no minimiza la expresión.
      </p>
    </div>
  );
}
