// «Descenso de gradiente»: el simulador (f(x) con la curva y sus iteraciones, o f(x, y) con las curvas
// de nivel y el camino) con α, el punto de partida, las iteraciones y el método (simple, con momento
// o Adam), la tabla de las primeras iteraciones y qué ha pasado (converge, oscila, diverge, se queda en
// un mínimo local o en una silla). Debajo, una práctica: hacer a mano x₁ y x₂, comprobados con números
// exactos; al acertar se abren las ideas clave.
import { Check, SkipForward } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { CALC_PACK } from "../../../../content/calculo/practica.ts";
import { exactDescentSteps, MAX_ITERATIONS, METHOD_LABEL, METHODS, objective, oscillates, runDescent, type DescentRun, type Method } from "../../../../shared/calculus/descent.ts";
import { compile, decimalText, toSpoken, toTex, type Expr, type VarName } from "../../../../shared/calculus/expr.ts";
import { derivative } from "../../../../shared/calculus/derive.ts";
import { tidy } from "../../../../shared/calculus/simplify.ts";
import { alphaFrac, calcExpr, CALC_DESCENT, type CalcDescentInstance } from "../../../../shared/exercises/calculus.ts";
import { randomSeed } from "../../../../shared/exercises/random.ts";
import type { ExerciseLevel } from "../../../../shared/exercises/types.ts";
import { toNumber } from "../../../../shared/rational.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { selectClass } from "../boole/AxiomPractice.tsx";
import { ContourPlot, FunctionPlot, LegendItem } from "./charts.tsx";
import { FnTex, FunctionField, Hints, levelLabel, LEVELS, NumberField, PracticeBox, readFunction, readNumber, Status, Verdict } from "./common.tsx";
import { numTex } from "./TangentPractice.tsx";

const ALPHAS = [0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.08, 0.09, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 0.9, 1, 1.05, 1.1];
const fmt = (v: number) => decimalText(v, 4);
const pointText = (p: readonly number[]) => (p.length === 1 ? fmt(p[0]!) : `(${p.map(fmt).join("; ")})`);

/** Ideas clave del descenso de gradiente (se abren al acertar la práctica o tras simular). */
export const DESCENT_IDEAS = [
  "Cada paso va en contra del gradiente: x ← x − α·∇f(x). Donde ∇f = 0 (un mínimo, un máximo o una silla) se para.",
  "α demasiado grande: el paso se pasa del mínimo; oscila de un lado a otro y, si es mayor que el límite (en f = x², α > 1), diverge.",
  "α demasiado pequeño: siempre baja, pero muy despacio; hacen falta muchísimas iteraciones.",
  "En un valle alargado (mal condicionado) el descenso simple va en zigzag por la dirección empinada y avanza poco por la plana; el momento acumula velocidad en la dirección buena y llega mucho antes.",
  "Con varios mínimos, el descenso cae en el mínimo local más cercano al punto de partida: no garantiza el mínimo global.",
  "En un punto de silla el gradiente también es 0: si empiezas justo en su eje se queda ahí; con un poco de desvío, se escapa.",
];

function explainRun(run: DescentRun, inBox: boolean, method: Method): string {
  const last = run.points[run.points.length - 1]!;
  const where = `${run.dim === 1 ? "x" : "(x, y)"} ≈ ${pointText(last)}, f ≈ ${fmt(run.values[run.values.length - 1]!)}`;
  if (run.status === "diverge") return `Diverge en la iteración ${run.stoppedAt}: los pasos crecen sin control. α es demasiado grande para esta función, o f no tiene mínimo en esa dirección.`;
  if (run.status === "converge") return `Converge en ${run.stoppedAt} iteraciones (‖∇f‖ < 10⁻⁶) a ${where}.`;
  const osc = oscillates(run, 0) || (run.dim === 2 && oscillates(run, 1));
  const parts = [`Tras ${run.stoppedAt} iteraciones aún no ha convergido: ${where}, ‖∇f‖ ≈ ${fmt(run.gradNorms[run.gradNorms.length - 1]!)}.`];
  if (!inBox) parts.push("El camino se sale del dibujo.");
  if (osc && method === "gd") parts.push("Oscila de un lado a otro: α está cerca del límite de estabilidad.");
  else if (run.gradNorms[run.gradNorms.length - 1]! > 1e-3) parts.push("Prueba con más iteraciones, otro α u otro método.");
  return parts.join(" ");
}

type Dim = "1" | "2";

export function DescentSimulator() {
  const id = useId();
  const [dim, setDim] = useState<Dim>("2");
  const presets = dim === "1" ? CALC_PACK.descent1 : CALC_PACK.descent2;
  const [choice, setChoice] = useState<string>(CALC_PACK.descent2[1]!.id);
  const [own, setOwn] = useState("");
  const preset = presets.find((p) => p.id === choice);
  const [alpha, setAlpha] = useState(preset?.alpha ?? 0.1);
  const [start, setStart] = useState<string[]>(() => (preset ? [preset.start].flat().map(String) : ["1", "1"]));
  const [iterations, setIterations] = useState(preset?.iterations ?? 50);
  const [method, setMethod] = useState<Method>("gd");

  const vars: VarName[] = dim === "1" ? ["x"] : ["x", "y"];
  const ownParsed = useMemo(() => (choice === "propia" && own.trim() !== "" ? readFunction(own, { vars: dim === "1" ? ["x"] : ["x", "y"] }) : null), [choice, own, dim]);
  const fText = preset?.f ?? null;
  const f: Expr | null = useMemo(() => (fText ? calcExpr(fText, dim === "1" ? ["x"] : ["x", "y"]) : null), [fText, dim]);
  const fn = preset ? f : ownParsed?.ok ? ownParsed.expr : null;
  const xr = preset ? (dim === "1" ? (preset as (typeof CALC_PACK.descent1)[number]).range : (preset as (typeof CALC_PACK.descent2)[number]).x) : ([-3, 3] as [number, number]);
  const yr = preset && dim === "2" ? (preset as (typeof CALC_PACK.descent2)[number]).y : ([-3, 3] as [number, number]);

  const pick = (nextDim: Dim, nextId: string) => {
    const list = nextDim === "1" ? CALC_PACK.descent1 : CALC_PACK.descent2;
    const p = list.find((q) => q.id === nextId);
    setChoice(nextId);
    if (p) {
      setAlpha(p.alpha);
      setStart([p.start].flat().map(String));
      setIterations(p.iterations);
    } else setStart(nextDim === "1" ? ["1"] : ["1", "1"]);
  };

  const startKey = start.slice(0, dim === "1" ? 1 : 2).join("|");
  const obj = useMemo(() => (fn ? objective(fn, dim === "1" ? 1 : 2) : null), [fn, dim]);
  const run = useMemo(() => {
    const nums = startKey.split("|").map((t) => readNumber(t));
    if (!obj || !nums.every((v): v is number => v !== null && Math.abs(v) <= 1e3)) return null;
    return runDescent(obj, { alpha, start: nums, iterations, method });
  }, [obj, alpha, startKey, iterations, method]);
  const last = run ? run.points[run.points.length - 1]! : null;
  const inBox = last ? last[0]! >= xr[0] && last[0]! <= xr[1] && (dim === "1" || (last[1]! >= yr[0] && last[1]! <= yr[1])) : true;
  const alphaIndex = ALPHAS.reduce((best, a, i) => (Math.abs(a - alpha) < Math.abs(ALPHAS[best]! - alpha) ? i : best), 0);
  const F2 = useMemo(() => (fn && dim === "2" ? compile(fn) : null), [fn, dim]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-3 lg:col-span-5">
          <ToggleGroup
            type="single"
            value={dim}
            aria-label="Variables"
            className="grid max-w-full grid-cols-2 self-start sm:inline-flex"
            onValueChange={(v) => {
              if (v !== "1" && v !== "2") return;
              setDim(v);
              pick(v, (v === "1" ? CALC_PACK.descent1 : CALC_PACK.descent2)[0]!.id);
            }}
          >
            <ToggleGroupItem value="1">Una variable: f(x)</ToggleGroupItem>
            <ToggleGroupItem value="2">Dos variables: f(x, y)</ToggleGroupItem>
          </ToggleGroup>
          <label htmlFor={`${id}-f`} className="text-[14px] font-semibold">
            Función
          </label>
          <select id={`${id}-f`} className={cn(selectClass, "w-full font-body")} value={choice} onChange={(e) => pick(dim, e.target.value)}>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
            <option value="propia">Escribir la mía</option>
          </select>
          {choice === "propia" ? (
            <FunctionField id={`${id}-own`} label={dim === "1" ? "f(x) =" : "f(x, y) ="} vars={vars} value={own} onChange={setOwn} placeholder={dim === "1" ? "x^4 − 2x^2" : "x^2 + 4y^2"} />
          ) : null}
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-alpha`} className="text-[14px] font-semibold">
              Tasa de aprendizaje α
            </label>
            <div className="flex items-center gap-2">
              <input
                id={`${id}-alpha`}
                type="range"
                min={0}
                max={ALPHAS.length - 1}
                step={1}
                value={alphaIndex}
                aria-valuetext={decimalText(ALPHAS[alphaIndex]!, 4)}
                onChange={(e) => setAlpha(ALPHAS[Number(e.target.value)]!)}
                className="h-11 min-w-0 flex-1 accent-[var(--accent)]"
              />
              <output htmlFor={`${id}-alpha`} className="w-16 text-right font-mono">
                {decimalText(alpha, 4)}
              </output>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(dim === "1" ? ["x₀"] : ["x₀", "y₀"]).map((name, i) => (
              <NumberField
                key={name}
                label={`Punto de partida ${name}`}
                value={start[i] ?? ""}
                invalid={readNumber(start[i] ?? "") === null}
                onChange={(v) => setStart((s) => s.map((x, k) => (k === i ? v : x)))}
              />
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-it`} className="text-[14px] font-semibold">
              Iteraciones
            </label>
            <div className="flex items-center gap-2">
              <input id={`${id}-it`} type="range" min={1} max={MAX_ITERATIONS} value={iterations} onChange={(e) => setIterations(Number(e.target.value))} className="h-11 min-w-0 flex-1 accent-[var(--accent)]" />
              <output htmlFor={`${id}-it`} className="w-16 text-right font-mono">
                {iterations}
              </output>
            </div>
          </div>
          <label htmlFor={`${id}-m`} className="text-[14px] font-semibold">
            Método
          </label>
          <select id={`${id}-m`} className={cn(selectClass, "w-full font-body")} value={method} onChange={(e) => setMethod(METHODS.find((m) => m === e.target.value) ?? "gd")}>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m === "momentum" ? `${METHOD_LABEL[m]} (β = 0,9)` : METHOD_LABEL[m]}
              </option>
            ))}
          </select>
          <Tex
            display
            tex={
              method === "gd"
                ? "x_{k+1} = x_k - \\alpha\\,\\nabla f(x_k)"
                : method === "momentum"
                  ? "v_{k+1} = \\beta\\,v_k - \\alpha\\,\\nabla f(x_k),\\quad x_{k+1} = x_k + v_{k+1}"
                  : "x_{k+1} = x_k - \\alpha\\,\\frac{\\hat m_k}{\\sqrt{\\hat v_k} + \\varepsilon}"
            }
            label={method === "gd" ? "x sub k más 1 igual a x sub k menos alfa por el gradiente de f en x sub k" : method === "momentum" ? "con momento: la velocidad acumula los gradientes anteriores" : "Adam: el paso se divide por la raíz de la media de los gradientes al cuadrado"}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-3 lg:col-span-7">
          {fn && run ? (
            <>
              {dim === "1" ? (
                <FunctionPlot
                  xRange={xr}
                  curves={[{ id: "f", label: "f", f: compile(fn), style: "solid", color: "var(--text)" }]}
                  path={run.points.slice(0, 201).map((p, i) => [p[0]!, run.values[i]!])}
                  label={`Gráfica de f(x) = ${toSpoken(fn)} con ${run.points.length - 1} iteraciones del descenso desde x₀ = ${fmt(run.points[0]![0]!)}. ${explainRun(run, inBox, method)}`}
                />
              ) : F2 ? (
                <ContourPlot
                  f={F2}
                  xRange={xr}
                  yRange={yr}
                  path={run.points.slice(0, 501)}
                  label={`Curvas de nivel de f(x, y) = ${toSpoken(fn)} con el camino del descenso desde ${pointText(run.points[0]!)}. ${explainRun(run, inBox, method)}`}
                />
              ) : null}
              <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Leyenda">
                {dim === "1" ? <LegendItem label="f(x)" color="var(--text)" style="solid" /> : <LegendItem label="Curvas de nivel" color="var(--text-muted)" style="solid" />}
                <LegendItem label="Punto de partida" color="var(--crit)" shape="square" />
                <LegendItem label="Iteraciones" color="var(--crit)" shape="circle" />
                <LegendItem label="Último punto" color="var(--crit)" shape="ring" />
              </ul>
              <Status>
                <Verdict tone={run.status === "converge" ? "ok" : run.status === "diverge" ? "crit" : "warn"}>{explainRun(run, inBox, method)}</Verdict>
              </Status>
              <IterationsTable run={run} />
            </>
          ) : (
            <p className="text-[14px] text-muted">{choice === "propia" ? "Escribe una función para simular." : "Escribe un punto de partida válido."}</p>
          )}
          <details className="text-[14px]">
            <summary className="flex min-h-11 cursor-pointer items-center">Qué mirar</summary>
            <ul className="list-disc pl-6">
              {DESCENT_IDEAS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}

function IterationsTable({ run }: { run: DescentRun }) {
  const rows = run.points.slice(0, 11);
  return (
    <details>
      <summary className="flex min-h-11 cursor-pointer items-center text-[14px]">Ver las primeras iteraciones</summary>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-left text-[14px]">
          <thead>
            <tr>
              <th scope="col" className="p-2">
                k
              </th>
              <th scope="col" className="p-2">
                {run.dim === 1 ? "xₖ" : "(xₖ; yₖ)"}
              </th>
              <th scope="col" className="p-2">
                f
              </th>
              <th scope="col" className="p-2">
                ‖∇f‖
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, k) => (
              <tr key={k} className="border-t border-border">
                <th scope="row" className="p-2 font-mono">
                  {k}
                </th>
                <td className="p-2 font-mono">{pointText(p)}</td>
                <td className="p-2 font-mono">{fmt(run.values[k]!)}</td>
                <td className="p-2 font-mono">{fmt(run.gradNorms[k]!)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------- Práctica: pasos a mano

/** ¿El número escrito es el exacto, o el exacto redondeado a 4 decimales? */
const stepOk = (text: string, exact: number) => {
  const v = readNumber(text);
  return v !== null && Math.abs(v - exact) <= 5e-5 + 1e-12;
};

export function DescentStepPractice({ instance, onSolved }: { instance: CalcDescentInstance; onSolved?: () => void }) {
  const two = instance.start.length === 2;
  const f = useMemo(() => calcExpr(instance.f, instance.start.length === 2 ? ["x", "y"] : ["x"]), [instance]);
  const steps = useMemo(() => exactDescentSteps(f, instance.start.map((s) => alphaFrac(s)), alphaFrac(instance.alpha), instance.steps), [f, instance]);
  const exact = steps ? steps.map((p) => p.map(toNumber)) : [];
  const count = instance.steps;
  const [values, setValues] = useState<string[][]>(() => Array.from({ length: count }, () => (two ? ["", ""] : [""])));
  const [checked, setChecked] = useState(false);
  const oks = values.map((row, k) => row.map((t, i) => stepOk(t, exact[k + 1]?.[i] ?? NaN)));
  const solved = oks.every((r) => r.every(Boolean));
  const grads = two ? [tidy(derivative(f, "x")), tidy(derivative(f, "y"))] : [tidy(derivative(f, "x"))];
  const sub = (k: number) => `${k}`.replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)]!);
  return (
    <PracticeBox title="Calcula tú los primeros pasos">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <FnTex e={f} lhs={two ? "f(x, y)" : "f(x)"} className="text-[18px]" />
        <Tex
          tex={`${two ? "(x_0, y_0)" : "x_0"} = ${two ? `(${instance.start.join(", ")})` : instance.start[0]},\\quad \\alpha = ${numTex(instance.alpha).replace(".", "{,}")}`}
          label={`punto de partida ${instance.start.join(", ")}; alfa ${decimalText(instance.alpha)}`}
          className="text-[18px]"
        />
      </div>
      <Tex display tex={two ? "(x_{k+1}, y_{k+1}) = (x_k, y_k) - \\alpha\\,\\nabla f(x_k, y_k)" : "x_{k+1} = x_k - \\alpha\\, f'(x_k)"} label="regla del descenso de gradiente" />
      {values.map((row, k) => (
        <fieldset key={k} className="flex flex-col gap-1">
          <legend className="text-[14px] font-semibold">{two ? `(x${sub(k + 1)}, y${sub(k + 1)})` : `x${sub(k + 1)}`}</legend>
          <div className={cn("grid gap-3", two ? "grid-cols-2" : "grid-cols-1 sm:max-w-xs")}>
            {row.map((t, i) => (
              <NumberField
                key={i}
                label={`${i === 0 ? "x" : "y"}${sub(k + 1)} =`}
                value={t}
                invalid={checked && !oks[k]![i]!}
                onChange={(v) => {
                  setValues((vs) => vs.map((r, kk) => (kk === k ? r.map((x, ii) => (ii === i ? v : x)) : r)));
                  setChecked(false);
                }}
                placeholder="1,6"
              />
            ))}
          </div>
        </fieldset>
      ))}
      <p className="text-[14px] text-muted">Con todos los decimales (o redondeado a cuatro).</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={() => {
            setChecked(true);
            if (solved) onSolved?.();
          }}
        >
          <Check size={16} aria-hidden="true" />
          Comprobar
        </Button>
        <Hints
          hints={[
            two ? "Calcula el gradiente ∇f = (∂f/∂x, ∂f/∂y) y evalúalo en el punto actual." : "Deriva f y evalúa f′ en el punto actual.",
            "Multiplica por α y réstalo del punto actual: ese es el siguiente punto.",
            "Para el segundo paso, repite desde el punto que acabas de calcular (no desde el de partida).",
          ]}
        />
      </div>
      {checked ? (
        <Status>
          {solved ? (
            <Verdict tone="ok">
              <Check size={16} aria-hidden="true" />
              ¡Correcto! Así es como avanza el descenso de gradiente.
            </Verdict>
          ) : (
            <Verdict tone="warn">{`${oks.flat().filter(Boolean).length} de ${oks.flat().length} bien. Revisa los marcados${oks[0]!.every(Boolean) ? ": el primer paso ya está bien" : ""}.`}</Verdict>
          )}
        </Status>
      ) : null}
      {checked && solved ? (
        <section aria-label="Ideas clave" className="rounded-lg border border-border p-3 text-[14px]">
          <h3 className="mb-1 font-display text-[18px] font-semibold">Ideas clave</h3>
          <ul className="list-disc pl-6">
            {DESCENT_IDEAS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <SolutionGate resetKey={JSON.stringify(instance)}>
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-raised p-3">
          <Tex
            display
            tex={two ? `\\nabla f = \\left(${toTex(grads[0]!)},\\ ${toTex(grads[1]!)}\\right)` : `f'(x) = ${toTex(grads[0]!)}`}
            label={two ? `gradiente: ${toSpoken(grads[0]!)}; ${toSpoken(grads[1]!)}` : `f prima: ${toSpoken(grads[0]!)}`}
          />
          <ul className="flex flex-col gap-1 font-mono text-[14px]">
            {exact.map((p, k) => (
              <li key={k}>{`${two ? `(x${sub(k)}, y${sub(k)})` : `x${sub(k)}`} = ${pointText(p)}`}</li>
            ))}
          </ul>
        </div>
      </SolutionGate>
    </PracticeBox>
  );
}

/** La práctica con ejercicios generados: nivel y «Otro ejercicio». */
export function DescentPracticeBlock() {
  const [level, setLevel] = useState<ExerciseLevel>("básico");
  const [seed, setSeed] = useState(1);
  const instance = useMemo(() => CALC_DESCENT.generate(seed, level), [seed, level]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          value={level}
          aria-label="Nivel"
          className="grid max-w-full grid-cols-3 self-start sm:inline-flex"
          onValueChange={(v) => {
            const l = LEVELS.find((x) => x === v);
            if (l) setLevel(l);
          }}
        >
          {LEVELS.map((l) => (
            <ToggleGroupItem key={l} value={l}>
              {levelLabel(l)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button onClick={() => setSeed(randomSeed())}>
          <SkipForward size={16} aria-hidden="true" />
          Otro ejercicio
        </Button>
      </div>
      <DescentStepPractice key={`${seed}|${level}`} instance={instance} />
    </div>
  );
}
