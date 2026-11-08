// Una tabla de pandas tal como la devuelve el kernel (pyexam/kernel.ts): el texto de cada celda en una
// tabla de verdad, nunca HTML. La usan el cuaderno del simulacro y la pestaña Python.
import type { KernelValue } from "./kernel.ts";

/** Una tabla de pandas: el texto de cada celda en una tabla de verdad (con … donde se recorta). */
export function TableOutput({ value }: { value: Extract<KernelValue, { tipo: "tabla" }> }) {
  const [n, m] = value.forma;
  const cols = value.columnas.map((c, j) => ({ c, j }));
  const withCut = <T,>(xs: T[], cut: number | null, gap: T): T[] => (cut === null ? xs : [...xs.slice(0, cut), gap, ...xs.slice(cut)]);
  const headers = withCut<{ c: string; j: number } | null>(cols, value.corteCols, null);
  const rows = withCut<number | null>(value.indice.map((_, i) => i), value.corteFilas, null);
  const caption = value.serie ? `Series: ${n} ${n === 1 ? "valor" : "valores"}` : `DataFrame: ${n} ${n === 1 ? "fila" : "filas"} × ${m} ${m === 1 ? "columna" : "columnas"}`;
  return (
    <div className="max-w-full overflow-x-auto rounded-md border border-border">
      <table className="mono border-collapse text-[14px]">
        <caption className="px-2 py-1 text-left font-body text-[14px] text-muted">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="border-b border-border px-2 py-1" />
            {headers.map((h, k) => (
              <th key={k} scope="col" className="border-b border-border px-2 py-1 text-right font-semibold">
                {h === null ? "…" : h.c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((i, k) => (
            <tr key={k} className="even:bg-sunken">
              <th scope="row" className="px-2 py-0.5 text-left font-semibold">
                {i === null ? "…" : value.indice[i]}
              </th>
              {headers.map((h, x) => (
                <td key={x} className="whitespace-pre px-2 py-0.5 text-right">
                  {i === null || h === null ? "…" : value.filas[i]![h.j]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
