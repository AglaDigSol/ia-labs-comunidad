import { Check, CircleDashed, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  F1,
  F1_NAMES,
  f1Table,
  type F1Name,
} from "../../../../shared/logic/f1.ts";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../../../components/ui/toggle-group.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";

type Op = "suma" | "producto";
type Answers = Partial<Record<string, F1Name>>;
type Cell = { r: F1Name; c: F1Name };

const SYMBOL: Record<Op, string> = { suma: "+", producto: "·" };
const key = (r: F1Name, c: F1Name) => `${r}|${c}`;
const headTex = (n: F1Name) => (n === "Id" ? "\\mathrm{Id}" : n);

const emptyState = () => ({
  suma: {} as Answers,
  producto: {} as Answers,
});

export function F1Explorer() {
  const [op, setOp] = useState<Op>("suma");
  const [answers, setAnswers] = useState(emptyState);
  // Snapshot of the answers at the moment of the last "Comprobar"; null = never graded.
  const [graded, setGraded] = useState<Record<Op, Answers | null>>({
    suma: null,
    producto: null,
  });
  const [revealed, setRevealed] = useState<Record<Op, boolean>>({
    suma: false,
    producto: false,
  });
  const [focus, setFocus] = useState<Cell | null>(null);

  // Used only to grade the student's cells and, after an attempt, to reveal them.
  const solution = useMemo(() => f1Table(op), [op]);
  const neutral = useMemo(
    () => F1_NAMES.find((e) => F1_NAMES.every((x) => solution[e][x] === x)),
    [solution],
  );
  const mine = answers[op];
  const snap = graded[op];
  const attempted = snap !== null;
  const correctCount = snap
    ? F1_NAMES.reduce(
        (n, r) =>
          n + F1_NAMES.filter((c) => snap[key(r, c)] === solution[r][c]).length,
        0,
      )
    : 0;
  const symbol = SYMBOL[op];

  const setCell = (r: F1Name, c: F1Name, v: string) =>
    setAnswers((prev) => {
      const next = { ...prev[op] };
      if (v === "") delete next[key(r, c)];
      else next[key(r, c)] = v as F1Name;
      return { ...prev, [op]: next };
    });

  const hl = (r: F1Name, c: F1Name) =>
    focus && (focus.r === r || focus.c === c);
  const cellMark = (r: F1Name, c: F1Name) => {
    if (!snap) return null;
    const v = snap[key(r, c)];
    if (v === undefined) return "empty" as const;
    return v === solution[r][c] ? ("ok" as const) : ("bad" as const);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-[20px] font-semibold">
          Tablas de F₁ = {"{Id, f, g, h}"}
        </h2>
        <ul className="flex flex-col gap-1 font-mono text-[14px]">
          {F1_NAMES.map((n) => (
            <li
              key={n}
            >{`${n}: ${n}(0) = ${F1[n][0]}, ${n}(1) = ${F1[n][1]}`}</li>
          ))}
        </ul>
        <p className="text-[14px] text-muted">
          Fila ∘ columna: el resultado de operar el elemento de la fila con el
          de la columna. Rellena la tabla y pulsa «Comprobar»; la app solo
          corrige, no da las respuestas.
        </p>
      </div>

      <ToggleGroup
        type="single"
        value={op}
        aria-label="Operación"
        className="self-start"
        onValueChange={(v) => {
          if (v === "suma" || v === "producto") {
            setOp(v);
            setFocus(null);
          }
        }}
      >
        <ToggleGroupItem value="suma">Suma</ToggleGroupItem>
        <ToggleGroupItem value="producto">Producto</ToggleGroupItem>
      </ToggleGroup>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="border-separate border-spacing-0">
          <caption className="sr-only">
            {op === "suma"
              ? "Tabla de la suma de F₁"
              : "Tabla del producto de F₁"}
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="bg-raised px-3 py-2 text-[16px] font-normal"
              >
                <span className="sr-only">Fila {symbol} columna</span>
                <span aria-hidden="true">{symbol}</span>
              </th>
              {F1_NAMES.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className={cn(
                    "bg-raised px-3 py-2 text-[16px] font-normal",
                    focus?.c === c && "bg-sunken",
                  )}
                >
                  <Tex tex={headTex(c)} />
                  {revealed[op] && c === neutral ? (
                    <Chip tone="outline" className="ml-1">
                      neutro
                    </Chip>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {F1_NAMES.map((r) => (
              <tr key={r}>
                <th
                  scope="row"
                  className={cn(
                    "bg-raised px-3 py-2 text-left text-[16px] font-normal",
                    focus?.r === r && "bg-sunken",
                  )}
                >
                  <Tex tex={headTex(r)} />
                  {revealed[op] && r === neutral ? (
                    <Chip tone="outline" className="ml-1">
                      neutro
                    </Chip>
                  ) : null}
                </th>
                {F1_NAMES.map((c) => {
                  const mark = cellMark(r, c);
                  return (
                    <td
                      key={c}
                      onMouseEnter={() => setFocus({ r, c })}
                      onMouseLeave={() => setFocus(null)}
                      className={cn(
                        "px-2 py-2 align-top",
                        hl(r, c) && "bg-sunken",
                      )}
                    >
                      <div className="flex flex-col items-start gap-1">
                        {revealed[op] ? (
                          <span
                            className="inline-flex min-h-11 min-w-16 items-center font-mono text-[16px]"
                            aria-label={`${r} ${symbol} ${c} = ${solution[r][c]}`}
                          >
                            {solution[r][c]}
                          </span>
                        ) : (
                          <select
                            aria-label={`${r} ${symbol} ${c}`}
                            value={mine[key(r, c)] ?? ""}
                            onChange={(e) => setCell(r, c, e.target.value)}
                            onFocus={() => setFocus({ r, c })}
                            onBlur={() => setFocus(null)}
                            className={cn(
                              "min-h-11 min-w-16 rounded-md border bg-base px-2 font-mono text-[16px]",
                              mark === "ok" && "border-ok",
                              mark === "bad" && "border-crit",
                              (mark === null || mark === "empty") &&
                                "border-border",
                            )}
                          >
                            <option value=""></option>
                            {F1_NAMES.map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        )}
                        {!revealed[op] && mark === "ok" ? (
                          <span className="inline-flex items-center gap-1 text-[14px] text-ok">
                            <Check
                              size={16}
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                            Correcto
                          </span>
                        ) : null}
                        {!revealed[op] && mark === "bad" ? (
                          <span className="inline-flex items-center gap-1 text-[14px] text-crit">
                            <X
                              size={16}
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                            Revisa
                          </span>
                        ) : null}
                        {!revealed[op] && mark === "empty" ? (
                          <span className="inline-flex items-center gap-1 text-[14px] text-muted">
                            <CircleDashed
                              size={16}
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                            Sin responder
                          </span>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="sr-only" aria-live="polite">
        {focus ? `${focus.r} ${symbol} ${focus.c}` : ""}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          onClick={() => {
            setRevealed((p) => ({ ...p, [op]: false }));
            setGraded((p) => ({ ...p, [op]: { ...mine } }));
          }}
        >
          Comprobar
        </Button>
        <Button
          variant="secondary"
          aria-disabled={!attempted}
          onClick={() => {
            if (!attempted) return;
            setRevealed((p) => ({ ...p, [op]: !p[op] }));
          }}
          className={cn(!attempted && "opacity-50")}
        >
          {revealed[op] ? "Ocultar tabla completa" : "Mostrar tabla completa"}
        </Button>
        <p aria-live="polite" className="text-[14px] font-semibold">
          {attempted ? `${correctCount} de 16 correctas` : ""}
        </p>
      </div>
      {!attempted ? (
        <p className="text-[14px] text-muted">
          La tabla completa se habilita después de pulsar «Comprobar» al menos
          una vez.
        </p>
      ) : null}
    </div>
  );
}
