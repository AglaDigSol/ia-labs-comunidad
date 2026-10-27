// Tablas de ⊕ y ⊙ y fila de ′ de una estructura finita (solo lectura).
import type { FiniteStructure } from "../../../../shared/boole/algebra.ts";

const cell = "border border-border px-2 py-1 text-center font-mono text-[14px]";

function OpTable({ s, op, table }: { s: FiniteStructure; op: "⊕" | "⊙"; table: number[][] }) {
  return (
    <div className="max-w-full overflow-x-auto" tabIndex={0} role="group" aria-label={`Tabla de ${op}`}>
      <table className="border-collapse">
        <caption className="pb-1 text-left text-[14px] font-semibold">{`Tabla de ${op}`}</caption>
        <thead>
          <tr>
            <th scope="col" className={`${cell} bg-sunken`}>
              {op}
            </th>
            {s.elements.map((e) => (
              <th key={e} scope="col" className={`${cell} bg-sunken font-semibold`}>
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.map((row, a) => (
            <tr key={a}>
              <th scope="row" className={`${cell} bg-sunken font-semibold`}>
                {s.elements[a]}
              </th>
              {row.map((v, b) => (
                <td key={b} className={cell}>
                  {s.elements[v]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OperationTables({ structure: s }: { structure: FiniteStructure }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-4">
        <OpTable s={s} op="⊕" table={s.plus} />
        <OpTable s={s} op="⊙" table={s.times} />
      </div>
      <div className="max-w-full overflow-x-auto" tabIndex={0} role="group" aria-label="Complemento">
        <table className="border-collapse">
          <caption className="pb-1 text-left text-[14px] font-semibold">Complemento ′</caption>
          <tbody>
            <tr>
              <th scope="row" className={`${cell} bg-sunken`}>
                a
              </th>
              {s.elements.map((e) => (
                <td key={e} className={`${cell} bg-sunken font-semibold`}>
                  {e}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className={`${cell} bg-sunken`}>
                a′
              </th>
              {s.comp.map((v, a) => (
                <td key={a} className={cell}>
                  {s.elements[v]}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[14px] text-muted">{`0 = ${s.elements[s.zero]}, 1 = ${s.elements[s.one]}.`}</p>
    </div>
  );
}
