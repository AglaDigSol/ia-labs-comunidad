import { Fragment } from "react";
import { ArrowRightToLine, Check } from "lucide-react";
import { toPlain, toTex } from "../../../../shared/logic/ast.ts";
import type { CompareRow } from "../../../../shared/logic/compare.ts";
import type { Table } from "../../../../shared/logic/truth-table.ts";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";

export type TruthFormat = "10" | "VF";

export type CompareData = { vars: string[]; rows: CompareRow[]; onlyDiffering?: boolean };

const fmt = (v: boolean, format: TruthFormat) =>
  format === "10" ? (v ? "1" : "0") : v ? "V" : "F";

const headBase = "sticky top-0 z-10 bg-raised px-3 py-2 text-[16px] font-normal";

export function TruthTable({
  table,
  compare,
  format,
  showSub = false,
  caption,
}: {
  table?: Table;
  compare?: CompareData;
  format: TruthFormat;
  showSub?: boolean;
  caption?: string;
}) {
  const valueCell = (v: boolean, extra?: string) => (
    <td
      className={cn(
        "px-3 py-2 text-center",
        v ? "font-semibold text-fg" : "font-normal text-muted",
        extra,
      )}
    >
      {fmt(v, format)}
    </td>
  );

  const rowHead = (n: number, extra?: string) => (
    <th
      scope="row"
      className={cn(
        "sticky left-0 z-10 w-10 min-w-10 bg-base px-2 py-2 text-[14px] font-normal text-muted",
        extra,
      )}
    >
      {n}
    </th>
  );

  const corner = (
    <th
      scope="col"
      className="sticky left-0 top-0 z-20 w-10 min-w-10 bg-raised px-2 py-2 text-[14px] font-normal text-muted"
    >
      <span className="sr-only">Fila</span>
      <span aria-hidden="true">#</span>
    </th>
  );

  if (compare) {
    const rows = compare.rows
      .map((row, k) => ({ row, k }))
      .filter(({ row }) => !compare.onlyDiffering || !row.equal);
    return (
      <div className="max-h-[60dvh] overflow-auto rounded-md border border-border">
        <table className="w-full border-separate border-spacing-0 font-mono tabular-nums">
          <caption className="sr-only">
            {caption ?? `Tabla comparada con ${rows.length} filas`}
          </caption>
          <thead>
            <tr>
              {corner}
              {compare.vars.map((v) => (
                <th key={v} scope="col" className={headBase}>
                  <Tex tex={toTex({ kind: "var", name: v })} />
                </th>
              ))}
              <th scope="col" className={cn(headBase, "border-l border-l-border")}>
                A
              </th>
              <th scope="col" className={headBase}>
                B
              </th>
              <th scope="col" className={cn(headBase, "text-[14px] font-semibold")}>
                Coinciden
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ row, k }) => (
              <tr
                key={row.minterm}
                data-equal={row.equal ? "true" : "false"}
                className={cn(row.equal ? "hover:bg-sunken" : "bg-crit-bg")}
              >
                {rowHead(k + 1, row.equal ? undefined : "border-l-4 border-l-crit")}
                {row.values.map((v, i) => (
                  <Fragment key={i}>{valueCell(v)}</Fragment>
                ))}
                {valueCell(row.a, "border-l border-l-border")}
                {valueCell(row.b)}
                <td className="px-3 py-2 text-center">
                  {row.equal ? (
                    <span className="inline-flex items-center gap-1 text-ok">
                      <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                      <span aria-hidden="true">=</span>
                      <span className="sr-only">coinciden</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-crit">
                      <span>≠</span>
                      <span className="sr-only">no coinciden</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!table) return null;
  const subs = showSub ? table.subformulas : [];
  // The root is the last subformula; it is already shown as Resultado.
  const shownSubs = subs.slice(0, Math.max(0, subs.length - 1));
  return (
    <div className="max-h-[60dvh] overflow-auto rounded-md border border-border">
      <table className="w-full border-separate border-spacing-0 font-mono tabular-nums">
        <caption className="sr-only">
          {caption ?? `Tabla de verdad con ${table.rows.length} filas`}
        </caption>
        <thead>
          <tr>
            {corner}
            {table.vars.map((v) => (
              <th key={v} scope="col" className={headBase}>
                <Tex tex={toTex({ kind: "var", name: v })} />
              </th>
            ))}
            {shownSubs.map((s, i) => (
              <th key={i} scope="col" aria-label={toPlain(s)} className={headBase}>
                <Tex tex={toTex(s)} />
              </th>
            ))}
            <th
              scope="col"
              className="sticky right-0 top-0 z-20 border-x border-t-2 border-x-fg border-t-fg bg-raised px-3 py-2 text-[14px] font-semibold"
            >
              <span className="inline-flex items-center gap-1">
                Resultado
                <ArrowRightToLine size={16} strokeWidth={1.75} aria-hidden="true" />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, k) => (
            <tr key={row.minterm} className="hover:bg-sunken">
              {rowHead(k + 1)}
              {row.values.map((v, i) => (
                <Fragment key={i}>{valueCell(v)}</Fragment>
              ))}
              {shownSubs.map((_, i) => (
                <Fragment key={i}>{valueCell(row.sub[i] ?? false)}</Fragment>
              ))}
              {valueCell(row.result, "sticky right-0 border-x border-x-fg bg-raised")}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
