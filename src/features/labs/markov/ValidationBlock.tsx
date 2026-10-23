import { Check, X } from "lucide-react";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { cn } from "../../../lib/cn.ts";

export interface RowReport {
  name: string;
  /** Display text of the row sum, or null while the row has unparsed cells. */
  sumText: string | null;
  sumOk: boolean;
  messages: string[];
  invalid: boolean;
  /** DOM id of the first failing cell (or first cell of the row). */
  targetId: string;
}

export type Verdict = "ok" | "bad" | "incomplete";

export function ValidationBlock({ verdict, rows }: { verdict: Verdict; rows: RowReport[] }) {
  return (
    <section aria-labelledby="markov-valid-title" className="@container flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="markov-valid-title" className="font-display text-[20px] font-semibold">
          ¿Es estocástica?
        </h2>
        <span aria-live="polite">
          {verdict === "ok" ? (
            <Chip tone="ok">
              <Check size={16} strokeWidth={1.75} aria-hidden="true" />
              Estocástica por filas
            </Chip>
          ) : verdict === "bad" ? (
            <Chip tone="crit">
              <X size={16} strokeWidth={1.75} aria-hidden="true" />
              No es estocástica por filas
            </Chip>
          ) : (
            <Chip tone="info">Completa la matriz para comprobarla</Chip>
          )}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li
            key={i}
            className={cn(
              "flex min-h-14 flex-col gap-2 rounded-md border border-border bg-raised p-3 @[40rem]:flex-row @[40rem]:items-center",
              r.invalid && "border-l-4 border-l-crit",
              !r.invalid && r.sumText !== null && "opacity-70",
            )}
          >
            <span className="min-w-28 font-semibold">{r.name}</span>
            {r.sumText !== null ? (
              <Chip tone={r.sumOk ? "ok" : "crit"} className="self-start font-mono">
                {`Suma ${r.sumText}`}
              </Chip>
            ) : (
              <span className="text-[14px] text-muted">Fila incompleta</span>
            )}
            <div className="flex flex-1 flex-col gap-1">
              {r.messages.map((m, k) => (
                <p key={k} className="text-[14px]">
                  {m}
                </p>
              ))}
            </div>
            {r.invalid ? (
              <Button
                onClick={() => {
                  const el = document.getElementById(r.targetId);
                  if (el instanceof HTMLInputElement) {
                    el.focus();
                    el.select();
                  }
                }}
              >
                Ir a la celda
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
