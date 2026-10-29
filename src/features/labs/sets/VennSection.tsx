// «Diagrama de Venn»: dos modos.
// - «Sombrear regiones»: eliges o escribes una expresión y marcas en el diagrama las regiones que
//   crees que denota. «Comprobar» señala las regiones mal marcadas (de más o de menos) sin decir cuál
//   es la respuesta; la solución queda detrás de «Ver la solución completa».
// - «Con elementos»: el universo y A, B, C por extensión; calculas el conjunto resultado y la app lo
//   corrige: marca los elementos que sobran y dice cuántos faltan, nunca cuáles.
import { Check, Eraser, Lightbulb } from "lucide-react";
import { useMemo, useState } from "react";
import { SETS_PACK } from "../../../../content/conjuntos/practica.ts";
import {
  elementRegion,
  evalSetFinite,
  parseSetExpr,
  regionExpr,
  regionLabel,
  SET_NAMES,
  setRegions,
  setToPlain,
  setToTex,
  setVars,
  vennVars,
  type FiniteSets,
  type SetExpr,
  type SetName,
} from "../../../../shared/sets/expr.ts";
import { checkElements, parseElementList } from "../../../../shared/sets/finite.ts";
import type { ParseError } from "../../../../shared/logic/parser.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Input } from "../../../components/ui/input.tsx";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { selectClass } from "../boole/AxiomPractice.tsx";
import { HOW_TO_WRITE, operationRules, plural, SetExprField, Status, subexpressions, Verdict } from "./shared.tsx";
import { regionOrder } from "./venn-geometry.ts";
import { VennDiagram } from "./VennDiagram.tsx";

type Mode = "regiones" | "elementos";
const LEVELS = ["básico", "medio", "avanzado"] as const;

export function VennSection() {
  const [mode, setMode] = useState<Mode>("regiones");
  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        type="single"
        value={mode}
        aria-label="Modo del diagrama"
        onValueChange={(v) => {
          if (v === "regiones" || v === "elementos") setMode(v);
        }}
        className="self-start"
      >
        <ToggleGroupItem value="regiones">Sombrear regiones</ToggleGroupItem>
        <ToggleGroupItem value="elementos">Con elementos</ToggleGroupItem>
      </ToggleGroup>
      {mode === "regiones" ? <RegionsPractice /> : <ElementsPractice />}
    </div>
  );
}

// ---------------------------------------------------------------- Sombrear regiones

function RegionsPractice() {
  const [choice, setChoice] = useState<string>(SETS_PACK.venn[0]!.id);
  const [own, setOwn] = useState("");
  const [ownError, setOwnError] = useState<ParseError | null>(null);
  const [expr, setExpr] = useState<SetExpr | null>(() => {
    const r = parseSetExpr(SETS_PACK.venn[0]!.expr);
    return r.ok ? r.expr : null;
  });

  const pick = (id: string) => {
    setChoice(id);
    setOwnError(null);
    if (id === "propia") return;
    const r = parseSetExpr(SETS_PACK.venn.find((v) => v.id === id)!.expr);
    if (r.ok) setExpr(r.expr);
  };
  const useOwn = () => {
    const r = parseSetExpr(own);
    if (!r.ok) {
      setOwnError(r.error);
      return;
    }
    setOwnError(null);
    setExpr(r.expr);
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-5">
        <label htmlFor="venn-choice" className="text-[14px] font-semibold">
          Expresión
        </label>
        <select id="venn-choice" className={cn(selectClass, "w-full font-body")} value={choice} onChange={(e) => pick(e.target.value)}>
          {LEVELS.map((level) => (
            <optgroup key={level} label={level[0]!.toUpperCase() + level.slice(1)}>
              {SETS_PACK.venn
                .filter((v) => v.level === level)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.expr}
                  </option>
                ))}
            </optgroup>
          ))}
          <option value="propia">Escribir la mía</option>
        </select>
        {choice === "propia" ? (
          <>
            <SetExprField
              id="venn-own"
              label="Tu expresión"
              value={own}
              onChange={(v) => {
                setOwn(v);
                setOwnError(null);
              }}
              error={ownError}
            />
            <Button variant="secondary" className="self-start" onClick={useOwn}>
              Usar esta expresión
            </Button>
          </>
        ) : null}
        <details className="text-[14px]">
          <summary className="flex min-h-11 cursor-pointer items-center">Cómo escribir</summary>
          <p className="pb-2 text-muted">{HOW_TO_WRITE}</p>
        </details>
      </div>
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
        {expr ? <ShadePractice key={setToPlain(expr)} expr={expr} /> : null}
      </div>
    </div>
  );
}

function ShadePractice({ expr }: { expr: SetExpr }) {
  const vars = useMemo(() => vennVars(expr), [expr]);
  const n = vars.length as 2 | 3;
  const truth = useMemo(() => setRegions(expr, vars), [expr, vars]);
  const [marks, setMarks] = useState<boolean[]>(() => truth.map(() => false));
  const [checked, setChecked] = useState(false);
  const [hints, setHints] = useState(0);
  const plain = setToPlain(expr);

  const wrong = marks.map((m, r) => m !== truth[r]);
  const bad = wrong.filter(Boolean).length;
  const extra = marks.filter((m, r) => m && !truth[r]).length;
  const missing = marks.filter((m, r) => !m && truth[r]).length;
  const subs = subexpressions(expr);
  const hintList = [
    subs.length > 1
      ? `Trabaja por partes, de dentro hacia fuera: ${subs.join(", luego ")}.`
      : "Marca las regiones que quedan dentro del conjunto que nombra la expresión.",
    ...operationRules(expr),
  ];

  const toggle = (r: number) => {
    setMarks((prev) => prev.map((m, i) => (i === r ? !m : m)));
    setChecked(false);
  };

  return (
    <>
      <section aria-labelledby="shade-title" className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3">
        <h2 id="shade-title" className="font-display text-[20px] font-semibold">
          Sombrea la expresión
        </h2>
        <div className="max-w-full overflow-x-auto py-1 text-[20px]">
          <Tex tex={setToTex(expr)} label={plain} />
        </div>
        <p className="text-[14px] text-muted">
          Pulsa cada región (o enfócala con el tabulador y pulsa Espacio) para marcarla o desmarcarla. Las marcadas se ven
          rayadas.
        </p>
        <VennDiagram
          n={n}
          selected={marks}
          onToggle={toggle}
          wrong={checked ? wrong : undefined}
          label={`Tu diagrama de Venn para ${plain}`}
        />
        <p className="text-[14px] text-muted">
          {`Marcadas: ${
            regionOrder(n)
              .filter((r) => marks[r])
              .map((r) => regionLabel(vars, r))
              .join("; ") || "ninguna"
          }.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setChecked(true)}>
            <Check size={16} aria-hidden="true" />
            Comprobar
          </Button>
          <Button variant="ghost" disabled={hints >= hintList.length} onClick={() => setHints((h) => h + 1)}>
            <Lightbulb size={16} aria-hidden="true" />
            {hints === 0 ? "Dame una pista" : "Otra pista"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setMarks(truth.map(() => false));
              setChecked(false);
            }}
          >
            <Eraser size={16} aria-hidden="true" />
            Borrar las marcas
          </Button>
        </div>
        {hints > 0 ? (
          <ol className="list-decimal pl-6 text-[14px]">
            {hintList.slice(0, hints).map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ol>
        ) : null}
        {checked ? (
          <Status>
            {bad === 0 ? (
              <Verdict tone="ok">
                <Check size={16} aria-hidden="true" />
                {`¡Correcto! Esas son las regiones de ${plain}.`}
              </Verdict>
            ) : (
              <>
                <Verdict tone="warn">{`${truth.length - bad} de ${truth.length} regiones bien`}</Verdict>
                <span>
                  {[
                    extra > 0 ? `${plural(extra, "región marcada no debería estarlo", "regiones marcadas no deberían estarlo")}` : null,
                    missing > 0 ? `${plural(missing, "región sin marcar debería estar marcada", "regiones sin marcar deberían estar marcadas")}` : null,
                  ]
                    .filter(Boolean)
                    .join("; ")}
                  . Las señaladas con ✕ están mal.
                </span>
              </>
            )}
          </Status>
        ) : null}
      </section>
      <SolutionGate resetKey={plain}>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
          <h3 className="font-display text-[18px] font-semibold">Regiones de la expresión</h3>
          <VennDiagram n={n} selected={truth} label={`Solución: diagrama de Venn de ${plain}`} />
          {truth.some(Boolean) ? (
            <>
              <p className="text-[14px]">Como unión de regiones:</p>
              <ul className="flex flex-col gap-1">
                {regionOrder(n)
                  .filter((r) => truth[r])
                  .map((r) => (
                    <li key={r}>
                      <Tex tex={setToTex(regionExpr(vars, r))} label={regionLabel(vars, r)} />
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <p className="text-[14px]">Ninguna región: la expresión es el conjunto vacío.</p>
          )}
        </div>
      </SolutionGate>
    </>
  );
}

// ---------------------------------------------------------------- Con elementos

type DataText = { universe: string; A: string; B: string; C: string };

function textsOf(id: string): DataText {
  const d = SETS_PACK.elements.find((e) => e.id === id)!;
  return { universe: d.universe, A: d.sets.A, B: d.sets.B, C: d.sets.C ?? "" };
}

/** Lee el universo y los conjuntos; devuelve los datos o el primer problema que encuentra. */
function readData(t: DataText): { ok: true; data: FiniteSets; named: SetName[] } | { ok: false; error: string } {
  const u = parseElementList(t.universe);
  if (!u.ok) return { ok: false, error: `Universo U: ${u.error}` };
  if (u.value.elements.length === 0) return { ok: false, error: "El universo U no puede estar vacío." };
  const sets: FiniteSets["sets"] = {};
  const named: SetName[] = [];
  for (const name of SET_NAMES) {
    if (name === "C" && t.C.trim() === "") continue;
    const s = parseElementList(t[name]);
    if (!s.ok) return { ok: false, error: `${name}: ${s.error}` };
    const out = s.value.elements.filter((x) => !u.value.elements.includes(x));
    if (out.length > 0) return { ok: false, error: `${name} tiene elementos que no están en U: ${out.join(", ")}.` };
    sets[name] = s.value.elements;
    named.push(name);
  }
  return { ok: true, data: { universe: u.value.elements, sets }, named };
}

function ElementsPractice() {
  const [dataset, setDataset] = useState<string>(SETS_PACK.elements[0]!.id);
  const [texts, setTexts] = useState<DataText>(() => textsOf(SETS_PACK.elements[0]!.id));
  const [exprChoice, setExprChoice] = useState("0");
  const [own, setOwn] = useState("");
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [hints, setHints] = useState(0);

  const item = SETS_PACK.elements.find((e) => e.id === dataset)!;
  const read = useMemo(() => readData(texts), [texts]);
  const exprText = exprChoice === "propia" ? own : (item.exprs[Number(exprChoice)] ?? item.exprs[0]!);
  const parsed = useMemo(() => parseSetExpr(exprText), [exprText]);
  const exprError: ParseError | null =
    !parsed.ok && exprChoice === "propia" && own !== ""
      ? parsed.error
      : parsed.ok && read.ok && setVars(parsed.expr).some((v) => !read.named.includes(v))
        ? { code: "unexpected-token", start: 0, end: exprText.length, message: "La expresión usa C, pero C no tiene elementos definidos." }
        : null;
  const ready = read.ok && parsed.ok && exprError === null;
  const result = ready ? evalSetFinite(parsed.expr, read.data) : null;
  const reset = () => {
    setChecked(false);
    setHints(0);
  };

  const mine = parseElementList(answer);
  const check = mine.ok && result ? checkElements(mine.value.elements, result) : null;
  const resetKey = `${dataset}|${JSON.stringify(texts)}|${exprText}`;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-5">
        <label htmlFor="elements-dataset" className="text-[14px] font-semibold">
          Datos de partida
        </label>
        <select
          id="elements-dataset"
          className={cn(selectClass, "w-full font-body")}
          value={dataset}
          onChange={(e) => {
            setDataset(e.target.value);
            setTexts(textsOf(e.target.value));
            setExprChoice("0");
            setAnswer("");
            reset();
          }}
        >
          {SETS_PACK.elements.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        {(["universe", ...SET_NAMES] as const).map((k) => (
          <div key={k} className="flex flex-col gap-1">
            <label htmlFor={`elements-${k}`} className="text-[14px] font-semibold">
              {k === "universe" ? "Universo U" : k === "C" ? "C (opcional)" : k}
            </label>
            <Input
              id={`elements-${k}`}
              className="font-mono"
              value={texts[k]}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                setTexts((t) => ({ ...t, [k]: e.target.value }));
                reset();
              }}
            />
          </div>
        ))}
        <p className="text-[14px] text-muted">Elementos separados por comas, con o sin llaves.</p>
        {!read.ok ? (
          <p role="alert" className="text-[14px] text-crit">
            {read.error}
          </p>
        ) : null}
      </div>

      <section aria-labelledby="elements-title" className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-raised p-3 lg:col-span-7">
        <h2 id="elements-title" className="font-display text-[20px] font-semibold">
          Calcula el conjunto
        </h2>
        <label htmlFor="elements-expr" className="text-[14px] font-semibold">
          Expresión
        </label>
        <select
          id="elements-expr"
          className={cn(selectClass, "w-full font-body")}
          value={exprChoice}
          onChange={(e) => {
            setExprChoice(e.target.value);
            setAnswer("");
            reset();
          }}
        >
          {item.exprs.map((x, i) => (
            <option key={x} value={String(i)}>
              {x}
            </option>
          ))}
          <option value="propia">Escribir la mía</option>
        </select>
        {exprChoice === "propia" ? (
          <SetExprField
            id="elements-own"
            label="Tu expresión"
            value={own}
            onChange={(v) => {
              setOwn(v);
              reset();
            }}
            error={exprError}
          />
        ) : exprError ? (
          <p role="alert" className="text-[14px] text-crit">
            {exprError.message}
          </p>
        ) : null}
        {parsed.ok ? (
          <div className="max-w-full overflow-x-auto py-1 text-[20px]">
            <Tex tex={setToTex(parsed.expr)} label={setToPlain(parsed.expr)} />
          </div>
        ) : null}
        <div className="flex flex-col gap-1">
          <label htmlFor="elements-answer" className="text-[14px] font-semibold">
            Tu resultado
          </label>
          <Input
            id="elements-answer"
            className="font-mono"
            placeholder="{1, 3, 5} o ∅"
            value={answer}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={checked && check !== null && !check.correct ? true : undefined}
            onChange={(e) => {
              setAnswer(e.target.value);
              setChecked(false);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={!ready} onClick={() => setChecked(true)}>
            <Check size={16} aria-hidden="true" />
            Comprobar
          </Button>
          <Button variant="ghost" disabled={hints >= 2 || !ready} onClick={() => setHints((h) => h + 1)}>
            <Lightbulb size={16} aria-hidden="true" />
            {hints === 0 ? "Dame una pista" : "Otra pista"}
          </Button>
        </div>
        {hints > 0 && parsed.ok ? (
          <ol className="list-decimal pl-6 text-[14px]">
            <li>Recorre los elementos de U uno a uno y decide, para cada uno, en qué conjuntos está.</li>
            {hints > 1 ? <li>{operationRules(parsed.expr).join(" ")}</li> : null}
          </ol>
        ) : null}
        {checked ? (
          <Status>
            {!mine.ok ? (
              <span className="text-crit">{mine.error}</span>
            ) : check?.correct ? (
              <Verdict tone="ok">
                <Check size={16} aria-hidden="true" />
                ¡Correcto! Ese es el conjunto.
              </Verdict>
            ) : check ? (
              <>
                <Verdict tone="warn">{`${plural(check.right, "elemento bien", "elementos bien")}`}</Verdict>
                {check.wrong.length > 0 ? (
                  <span>{`No pertenecen al resultado: ${check.wrong.map((i) => mine.value.elements[i]).join(", ")}.`}</span>
                ) : null}
                {check.missing > 0 ? <span>{`Te ${check.missing === 1 ? "falta 1 elemento" : `faltan ${check.missing} elementos`}.`}</span> : null}
              </>
            ) : null}
            {mine.ok && mine.value.repeated.length > 0 ? (
              <span className="text-muted">{`Un conjunto no repite elementos: ${mine.value.repeated.join(", ")} aparece más de una vez.`}</span>
            ) : null}
          </Status>
        ) : null}
        {ready && result ? (
          <SolutionGate resetKey={resetKey}>
            <ElementsSolution expr={parsed.expr} data={read.data} named={read.named} result={result} />
          </SolutionGate>
        ) : null}
      </section>
    </div>
  );
}

function ElementsSolution({ expr, data, named, result }: { expr: SetExpr; data: FiniteSets; named: SetName[]; result: string[] }) {
  const vars = named.length === 3 ? named : (["A", "B"] as SetName[]);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
      <h3 className="font-display text-[18px] font-semibold">Resultado</h3>
      <p className="font-mono text-[16px]">{`${setToPlain(expr)} = ${result.length === 0 ? "∅" : `{${result.join(", ")}}`}`}</p>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0 text-center text-[14px]">
          <caption className="sr-only">Pertenencia de cada elemento del universo</caption>
          <thead>
            <tr>
              <th scope="col" className="px-3 py-2 text-left">
                Elemento
              </th>
              {named.map((v) => (
                <th key={v} scope="col" className="px-3 py-2 font-mono">
                  {`∈ ${v}`}
                </th>
              ))}
              <th scope="col" className="px-3 py-2 text-left">
                Región
              </th>
              <th scope="col" className="px-3 py-2">
                En el resultado
              </th>
            </tr>
          </thead>
          <tbody>
            {data.universe.map((el) => (
              <tr key={el} className="border-t border-border">
                <th scope="row" className="px-3 py-1 text-left font-mono font-normal">
                  {el}
                </th>
                {named.map((v) => (
                  <td key={v} className="px-3 py-1">
                    {data.sets[v]?.includes(el) ? "sí" : "no"}
                  </td>
                ))}
                <td className="px-3 py-1 text-left font-mono">{regionLabel(vars, elementRegion(el, vars, data))}</td>
                <td className="px-3 py-1 font-semibold">{result.includes(el) ? "sí" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
