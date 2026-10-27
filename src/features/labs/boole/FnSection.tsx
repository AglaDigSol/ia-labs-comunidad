// «Funciones Fₙ»: F₁ (las cuatro funciones de una variable, con los nombres de content/notation) con
// la práctica de rellenar las tablas de ⊕, ⊙ y ′, y F₂ (las dieciséis de dos variables) con la práctica
// «escribe una expresión para este vector de verdad», la lista completa y el enlace al verificador.
import { Check, CircleDashed, ShieldCheck, Shuffle, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { firstDifference } from "../../../../shared/boole/circuit.ts";
import { booleToTex, booleVars, parseBoole } from "../../../../shared/boole/expr.ts";
import { NOTATION } from "../../../../content/notation/index.ts";
import { enumerateFn, fnExpression, fnName, fnRows, fnStructure, FN_VARS, listFn } from "../../../../shared/boole/fn.ts";
import type { ParseError } from "../../../../shared/logic/parser.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { FormulaField } from "../logic/FormulaInput.tsx";
import { MAX_EXPR } from "./boole-storage.ts";
import { rowText } from "./keys.ts";
import { OperationTables } from "./OperationTables.tsx";

type Op = "plus" | "times" | "comp";
const OP_SYMBOL: Record<Op, string> = { plus: "⊕", times: "⊙", comp: "′" };
const cell = "border border-border px-2 py-1 text-center font-mono text-[14px]";

function Mark({ mark }: { mark: "ok" | "bad" | "empty" | null }) {
  if (mark === "ok")
    return (
      <span className="inline-flex items-center gap-1 text-[13px] text-ok">
        <Check size={14} aria-hidden="true" />
        Bien
      </span>
    );
  if (mark === "bad")
    return (
      <span className="inline-flex items-center gap-1 text-[13px] text-crit">
        <X size={14} aria-hidden="true" />
        Revisa
      </span>
    );
  if (mark === "empty")
    return (
      <span className="inline-flex items-center gap-1 text-[13px] text-muted">
        <CircleDashed size={14} aria-hidden="true" />
        Vacía
      </span>
    );
  return null;
}

function F1Practice() {
  const s = useMemo(() => fnStructure(1), []);
  const names = s.elements;
  const vectors = names.map((_, i) => i);
  const [op, setOp] = useState<Op>("plus");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [graded, setGraded] = useState<Partial<Record<Op, Record<string, number>>>>({});
  const key = (o: Op, a: number, b = 0) => `${o}|${a}|${b}`;
  const truth = (o: Op, a: number, b = 0) => (o === "plus" ? s.plus[a]![b]! : o === "times" ? s.times[a]![b]! : s.comp[a]!);
  const snap = graded[op];
  const mark = (a: number, b = 0): "ok" | "bad" | "empty" | null => {
    if (!snap) return null;
    const v = snap[key(op, a, b)];
    return v === undefined ? "empty" : v === truth(op, a, b) ? "ok" : "bad";
  };
  const cells = op === "comp" ? vectors.map((a) => [a, 0] as const) : vectors.flatMap((a) => vectors.map((b) => [a, b] as const));
  const correct = snap ? cells.filter(([a, b]) => snap[key(op, a, b)] === truth(op, a, b)).length : 0;
  const select = (a: number, b: number, label: string) => {
    const m = mark(a, b);
    return (
      <div className="flex flex-col items-center gap-0.5">
        <select
          aria-label={label}
          value={answers[key(op, a, b)] ?? ""}
          onChange={(e) =>
            setAnswers((prev) => {
              const next = { ...prev };
              if (e.target.value === "") delete next[key(op, a, b)];
              else next[key(op, a, b)] = Number(e.target.value);
              return next;
            })
          }
          className={cn(
            "min-h-11 min-w-14 rounded-md border bg-base px-1 font-mono text-[16px]",
            m === "ok" ? "border-ok" : m === "bad" ? "border-crit" : "border-border",
          )}
        >
          <option value=""></option>
          {names.map((n, i) => (
            <option key={n} value={i}>
              {n}
            </option>
          ))}
        </select>
        <Mark mark={m} />
      </div>
    );
  };
  return (
    <section aria-labelledby="f1-practice-title" className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3">
      <h3 id="f1-practice-title" className="font-display text-[18px] font-semibold">
        Comprueba tu respuesta: (F₁, ⊕, ⊙, ′)
      </h3>
      <p className="text-[14px] text-muted">
        Las operaciones van punto a punto: (u ⊕ v)(x) = u(x) ⊕ v(x). Rellena cada tabla con el nombre del resultado y pulsa
        «Comprobar».
      </p>
      <ToggleGroup
        type="single"
        value={op}
        aria-label="Tabla"
        onValueChange={(v) => {
          if (v === "plus" || v === "times" || v === "comp") setOp(v);
        }}
        className="self-start"
      >
        <ToggleGroupItem value="plus">Suma ⊕</ToggleGroupItem>
        <ToggleGroupItem value="times">Producto ⊙</ToggleGroupItem>
        <ToggleGroupItem value="comp">Complemento ′</ToggleGroupItem>
      </ToggleGroup>
      <div className="max-w-full overflow-x-auto">
        {op === "comp" ? (
          <table className="border-collapse">
            <caption className="sr-only">Complemento en F₁</caption>
            <tbody>
              <tr>
                <th scope="row" className={`${cell} bg-sunken`}>
                  u
                </th>
                {names.map((n) => (
                  <td key={n} className={`${cell} bg-sunken font-semibold`}>
                    {n}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className={`${cell} bg-sunken`}>
                  u′
                </th>
                {vectors.map((a) => (
                  <td key={a} className="p-1">
                    {select(a, 0, `${names[a]}′`)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        ) : (
          <table className="border-collapse">
            <caption className="sr-only">{`Tabla de ${OP_SYMBOL[op]} en F₁`}</caption>
            <thead>
              <tr>
                <th scope="col" className={`${cell} bg-sunken`}>
                  {OP_SYMBOL[op]}
                </th>
                {names.map((n) => (
                  <th key={n} scope="col" className={`${cell} bg-sunken`}>
                    {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vectors.map((a) => (
                <tr key={a}>
                  <th scope="row" className={`${cell} bg-sunken`}>
                    {names[a]}
                  </th>
                  {vectors.map((b) => (
                    <td key={b} className="p-1">
                      {select(a, b, `${names[a]} ${OP_SYMBOL[op]} ${names[b]}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          onClick={() =>
            setGraded((g) => ({ ...g, [op]: Object.fromEntries(Object.entries(answers).filter(([k]) => k.startsWith(`${op}|`))) }))
          }
        >
          Comprobar
        </Button>
        <span role="status" className="text-[14px] font-semibold">
          {snap
            ? correct === cells.length
              ? `¡Correcto! ${correct} de ${cells.length}.`
              : `${correct} de ${cells.length} correctas`
            : ""}
        </span>
      </div>
      <SolutionGate>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
          <h4 className="font-display text-[16px] font-semibold">Tablas de F₁</h4>
          <OperationTables structure={s} />
        </div>
      </SolutionGate>
    </section>
  );
}

function F2Practice({ index, onIndex }: { index: number | null; onIndex: (i: number) => void }) {
  const all = useMemo(() => enumerateFn(2), []);
  const pick = (avoid: number | null) => {
    let i = Math.floor(Math.random() * all.length);
    if (i === avoid) i = (i + 1 + Math.floor(Math.random() * (all.length - 1))) % all.length;
    onIndex(i);
  };
  useEffect(() => {
    if (index === null) pick(null);
    // Solo al montar sin función guardada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const v = index === null ? null : all[index]!;
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<ParseError | null>(null);
  const [result, setResult] = useState<{ ok: true } | { ok: false; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setAnswer("");
    setError(null);
    setResult(null);
  }, [index]);
  if (!v) return null;
  const vars = FN_VARS[2];
  const rows = fnRows(2);

  const check = () => {
    if (answer.length > MAX_EXPR) {
      setError({ code: "too-long", start: MAX_EXPR, end: answer.length, message: `Como mucho ${MAX_EXPR} caracteres.` });
      return;
    }
    const r = parseBoole(answer, { xor: true });
    if (!r.ok) {
      setError(r.error);
      setResult(null);
      return;
    }
    const bad = booleVars(r.expr).find((x) => !vars.includes(x));
    if (bad) {
      const at = Math.max(0, answer.indexOf(bad));
      setError({ code: "unexpected-token", start: at, end: at + bad.length, message: `Usa solo las variables x e y («${bad}» no lo es).` });
      setResult(null);
      return;
    }
    setError(null);
    const d = firstDifference(fnExpression(v), r.expr, vars);
    setResult(
      d
        ? { ok: false, text: `No es esta función. Con ${rowText(vars, d.values)}, f vale ${d.expected ? 1 : 0} y tu expresión da ${d.given ? 1 : 0}.` }
        : { ok: true },
    );
  };

  return (
    <section aria-labelledby="f2-practice-title" className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3">
      <h3 id="f2-practice-title" className="font-display text-[18px] font-semibold">
        Comprueba tu respuesta: escribe una expresión
      </h3>
      <p className="text-[14px] text-muted">
        Escribe una expresión en x e y (con ⊕, ⊙, ′ y, si quieres, ⊻) cuya tabla de verdad sea esta. Cualquier
        expresión equivalente vale.
      </p>
      <div className="flex flex-wrap items-start gap-4">
        <table className="border-collapse" aria-label={`Función que buscas: vector de verdad ${v}`}>
          <thead>
            <tr>
              <th scope="col" className={`${cell} bg-sunken`}>
                x
              </th>
              <th scope="col" className={`${cell} bg-sunken`}>
                y
              </th>
              <th scope="col" className={`${cell} bg-sunken`}>
                f(x, y)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, m) => (
              <tr key={m}>
                <td className={cell}>{r[0] ? 1 : 0}</td>
                <td className={cell}>{r[1] ? 1 : 0}</td>
                <td className={`${cell} font-semibold`}>{v[m]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[14px]">
          Vector de verdad: <span className="font-mono font-semibold">{v}</span>
        </p>
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
      >
        <FormulaField
          id="f2-answer"
          label="f(x, y) ="
          value={answer}
          onChange={(t) => {
            setAnswer(t);
            setError(null);
            setResult(null);
          }}
          error={error}
          inputRef={inputRef}
          placeholder="x′ ⊙ y"
          notation="boole"
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" type="submit">
            <Check size={16} aria-hidden="true" />
            Comprobar
          </Button>
          <Button variant="ghost" onClick={() => pick(index)}>
            <Shuffle size={16} aria-hidden="true" />
            Otra función
          </Button>
        </div>
      </form>
      <div role="status" className="text-[14px]">
        {result?.ok ? (
          <Chip tone="ok" className="whitespace-normal">
            <Check size={16} aria-hidden="true" />
            {`¡Correcto! Coincide en las 4 filas. Es «${fnName(v)}».`}
          </Chip>
        ) : result ? (
          <p className="text-crit">{result.text}</p>
        ) : null}
      </div>
      <SolutionGate resetKey={v}>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
          <h4 className="font-display text-[16px] font-semibold">Solución</h4>
          <p className="text-[14px]">{`Nombre: ${fnName(v)}. Suma de productos mínima:`}</p>
          <Tex display tex={`f(x, y) = ${booleToTex(fnExpression(v))}`} label="Expresión mínima" />
        </div>
      </SolutionGate>
    </section>
  );
}

function F2List() {
  const entries = useMemo(() => listFn(2), []);
  return (
    <details className="rounded-lg border border-border bg-raised p-3">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Las 16 funciones de F₂</summary>
      <p className="flex items-start gap-2 pb-2 text-[14px] text-muted">
        <ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" className="mt-1 shrink-0" />
        Esta lista incluye las soluciones de la práctica: ábrela cuando hayas terminado.
      </p>
      <div className="max-w-full overflow-x-auto" tabIndex={0} role="group" aria-label="Tabla de las 16 funciones de F₂">
        <table className="border-collapse">
          <caption className="sr-only">Funciones de dos variables con su vector de verdad, su expresión y su nombre</caption>
          <thead>
            <tr>
              <th scope="col" className={`${cell} bg-sunken`}>
                f(0,0) f(0,1) f(1,0) f(1,1)
              </th>
              <th scope="col" className={`${cell} bg-sunken`}>
                Expresión mínima
              </th>
              <th scope="col" className={`${cell} bg-sunken`}>
                Nombre
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.vector}>
                <td className={`${cell} tracking-[0.3em]`}>{e.vector}</td>
                <td className={`${cell} whitespace-nowrap`}>
                  <Tex tex={booleToTex(e.expr)} label={e.plain} />
                </td>
                <td className={`${cell} text-left font-body`}>{e.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function FnSection({
  f2,
  onF2,
  onOpenVerifier,
}: {
  f2: number | null;
  onF2: (i: number) => void;
  onOpenVerifier: () => void;
}) {
  const f1 = NOTATION.f1.map((e) => [e.values.join(""), e.name] as const);
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="f1-title" className="flex flex-col gap-3">
        <h2 id="f1-title" className="font-display text-[20px] font-semibold">
          F₁: funciones de una variable
        </h2>
        <p className="text-[14px] text-muted">
          {`Hay 2^(2¹) = ${f1.length} funciones u: {0, 1} → {0, 1}. Cada una se describe con sus valores (u(0), u(1)).`}
        </p>
        <ul className="flex flex-col gap-1 font-mono text-[14px]">
          {f1.map(([v, n]) => (
            <li key={n}>{`${n}: ${n}(0) = ${v[0]}, ${n}(1) = ${v[1]}`}</li>
          ))}
        </ul>
        <F1Practice />
      </section>

      <section aria-labelledby="f2-title" className="flex flex-col gap-3">
        <h2 id="f2-title" className="font-display text-[20px] font-semibold">
          F₂: funciones de dos variables
        </h2>
        <p className="text-[14px] text-muted">
          Hay 2^(2²) = 16 funciones f: {"{0, 1}²"} → {"{0, 1}"}. Cada una es su vector de verdad (f(0,0), f(0,1), f(1,0),
          f(1,1)).
        </p>
        <F2Practice index={f2} onIndex={onF2} />
        <F2List />
        <div className="flex flex-col items-start gap-2 rounded-lg border border-border p-3">
          <h3 className="font-display text-[18px] font-semibold">¿Es (F₂, ⊕, ⊙, ′) un álgebra de Boole?</h3>
          <p className="text-[14px] text-muted">
            Con las operaciones punto a punto, F₂ tiene 16 elementos, el 0 es 0000 y el 1 es 1111. Compruébalo tú mismo con
            los axiomas B1–B5 en el verificador.
          </p>
          <Button variant="secondary" onClick={onOpenVerifier}>
            Abrir F₂ en «¿Es un álgebra de Boole?»
          </Button>
        </div>
      </section>
    </div>
  );
}
