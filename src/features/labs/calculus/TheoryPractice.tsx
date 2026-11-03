// Prácticas de teoría de cálculo, con el formato del examen: opción múltiple a)–d) (a veces con
// «Ninguna de las otras» o varias correctas) y respuestas numéricas (exactas o redondeadas a dos
// decimales con coma). Cada una recibe la instancia generada (shared/exercises/calculus.ts) y la
// usan tanto la sección «Límites y continuidad» y «Varias variables» del laboratorio como el banco de
// ejercicios. Las pistas dicen la regla, nunca el resultado; la solución, tras SolutionGate.
import { Check } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";
import { criticalPoints1D } from "../../../../shared/calculus/basins.ts";
import { bisectionInterval, bisectionIterations, bisectionLength } from "../../../../shared/calculus/bisection.ts";
import { boundTex, boundText, boundValue, closedTex, closedText, closedValue, partsAntiderivative, partsChoice, partsIntegrand } from "../../../../shared/calculus/byparts.ts";
import { compile, toSpoken, toTex } from "../../../../shared/calculus/expr.ts";
import { numberMatches, numberMatchesRounded, parseNumberAnswer, ROUNDING_NOTE } from "../../../../shared/calculus/integrals.ts";
import { limitText, type LimitValue } from "../../../../shared/calculus/limits.ts";
import {
  basinQuestion,
  bisectionOf,
  calcExpr,
  chainAnswer,
  criticalAskText,
  criticalChoiceQuestion,
  curveTex,
  domainQuestion,
  lhopitalOf,
  niceTex,
  niceText,
  partsIntegral,
  partsQuestion,
  PIECEWISE_ASK,
  piecewiseQuestion,
  type CalcBasinInstance,
  type CalcBisectionInstance,
  type CalcChainInstance,
  type CalcCriticalChoiceInstance,
  type CalcDomainInstance,
  type CalcLhopitalInstance,
  type CalcPartsInstance,
  type CalcPiecewiseInstance,
} from "../../../../shared/exercises/calculus.ts";
import { ChoicePractice } from "../../../components/practice/ChoiceQuestion.tsx";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { selectClass } from "../boole/AxiomPractice.tsx";
import { FunctionPlot } from "./charts.tsx";
import { FnTex, Hints, NumberField, PracticeBox, Status, Verdict } from "./common.tsx";

type Props<I> = { instance: I; onSolved?: () => void };
const key = (x: unknown) => JSON.stringify(x);

// ---------------------------------------------------------------- Respuestas numéricas

export type NumericField = { label: string; expected: number };

/**
 * Uno o varios números con «Comprobar»: cada campo mal se marca sin decir su valor. `rounding`
 * «dos» acepta, como en el examen, el valor redondeado a dos decimales con coma (o exacto).
 */
export function NumericAnswers({
  fields,
  rounding = "tres",
  hints,
  onSolved,
  prefix,
  extra,
  children,
}: {
  fields: readonly NumericField[];
  rounding?: "tres" | "dos";
  hints: readonly string[];
  onSolved?: () => void;
  /** Algo que va antes de los números (otro campo, como la forma de la indeterminación). */
  prefix?: (showing: boolean) => ReactNode;
  /** Ese otro campo: su valor (para saber si ha cambiado), si está bien y qué decir si no. */
  extra?: { value: string; ok: boolean; message: string };
  children?: ReactNode;
}) {
  const [values, setValues] = useState<string[]>(fields.map(() => ""));
  const [checked, setChecked] = useState<string | null>(null);
  const ok = fields.map((f, i) => {
    const r = parseNumberAnswer(values[i] ?? "");
    return r.ok && (rounding === "dos" ? numberMatchesRounded(r, f.expected) : numberMatches(r, f.expected));
  });
  const stateKey = `${extra?.value ?? ""}#${values.join("|")}`;
  const showing = checked === stateKey;
  const allOk = ok.every(Boolean) && (extra?.ok ?? true);
  return (
    <div className="flex flex-col gap-3">
      {prefix?.(showing)}
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f, i) => (
          <NumberField
            key={f.label}
            label={f.label}
            value={values[i] ?? ""}
            invalid={showing && !ok[i]}
            onChange={(v) => setValues((xs) => xs.map((x, k) => (k === i ? v : x)))}
          />
        ))}
      </div>
      <p className="text-[14px] text-muted">{rounding === "dos" ? ROUNDING_NOTE : "Exacta (3/4, e, ln 2, π/2) o con tres decimales."}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={() => {
            setChecked(stateKey);
            if (allOk) onSolved?.();
          }}
        >
          <Check size={16} aria-hidden="true" />
          Comprobar
        </Button>
        <Hints hints={hints} />
      </div>
      {showing ? (
        <Status>
          {allOk ? (
            <Verdict tone="ok">
              <Check size={16} aria-hidden="true" />
              ¡Correcto!
            </Verdict>
          ) : (
            <>
              {ok.every(Boolean) ? null : (
                <Verdict tone="warn">{fields.length === 1 ? "No es ese número. Revisa el procedimiento con la pista." : `${ok.filter(Boolean).length} de ${fields.length} bien. Revisa los campos marcados.`}</Verdict>
              )}
              {extra && !extra.ok ? <Verdict tone="warn">{extra.message}</Verdict> : null}
            </>
          )}
        </Status>
      ) : null}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- Función a trozos

function piecewiseTex(inst: CalcPiecewiseInstance): { tex: string; label: string } {
  const L = calcExpr(inst.left);
  const R = calcExpr(inst.right);
  const a = niceTex(inst.a);
  const A = niceText(inst.a);
  const separate = inst.at !== "izquierda" && inst.at !== "derecha";
  if (separate && inst.left === inst.right) {
    return {
      tex: `f(x) = \\begin{cases} ${toTex(L)} & \\text{si } x \\neq ${a} \\\\ ${toTex(calcExpr(inst.at))} & \\text{si } x = ${a} \\end{cases}`,
      label: `f de x igual a ${toSpoken(L)} si x distinto de ${A}, y ${inst.at} si x igual a ${A}`,
    };
  }
  const lt = inst.at === "izquierda" ? "\\le" : "<";
  const gt = inst.at === "derecha" ? "\\ge" : ">";
  const mid = separate ? ` \\\\ ${toTex(calcExpr(inst.at))} & \\text{si } x = ${a}` : "";
  return {
    tex: `f(x) = \\begin{cases} ${toTex(L)} & \\text{si } x ${lt} ${a}${mid} \\\\ ${toTex(R)} & \\text{si } x ${gt} ${a} \\end{cases}`,
    label: `f de x igual a ${toSpoken(L)} si x ${inst.at === "izquierda" ? "menor o igual que" : "menor que"} ${A}${separate ? `; ${inst.at} si x igual a ${A}` : ""}; y ${toSpoken(R)} si x ${inst.at === "derecha" ? "mayor o igual que" : "mayor que"} ${A}`,
  };
}

const PIECEWISE_HINTS = [
  "Límite por la izquierda: usa la fórmula de los x < a; por la derecha, la de los x > a. Si sale 0/0, simplifica o usa L'Hôpital.",
  "El límite en a existe si los dos laterales existen y valen lo mismo. Continua: además, ese límite es f(a).",
  "Derivable en a: tiene que ser continua y las dos derivadas laterales (la derivada de cada trozo, en a) tienen que coincidir.",
];

export function PiecewisePractice({ instance, onSolved }: Props<CalcPiecewiseInstance>) {
  const q = useMemo(() => piecewiseQuestion(instance), [instance]);
  const t = piecewiseTex(instance);
  return (
    <PracticeBox title="Función a trozos">
      <Tex display tex={t.tex} label={t.label} className="text-[18px]" />
      <ChoicePractice legend={PIECEWISE_ASK[instance.ask]} question={q} seedKey={key(instance)} onSolved={onSolved} actions={<Hints hints={PIECEWISE_HINTS} />} />
    </PracticeBox>
  );
}

// ---------------------------------------------------------------- L'Hôpital

const FORMS = [
  { id: "0/0", label: "0/0" },
  { id: "∞/∞", label: "∞/∞" },
  { id: "no", label: "No es una indeterminación" },
] as const;

const atTex = (at: number | "+inf") => (at === "+inf" ? "+\\infty" : niceTex(at));
const limTex = (l: LimitValue) => (l.kind === "finito" ? niceTex(l.value) : l.kind === "infinito" ? (l.sign > 0 ? "+\\infty" : "-\\infty") : "\\nexists");

export function LhopitalPractice({ instance, onSolved }: Props<CalcLhopitalInstance>) {
  const id = useId();
  const r = useMemo(() => lhopitalOf(instance)!, [instance]);
  const num = calcExpr(instance.num);
  const den = calcExpr(instance.den);
  const [form, setForm] = useState("");
  const value = r.result.kind === "finito" ? r.result.value : NaN;
  const formOk = form === (r.steps[0]!.form ?? "no");
  const lim = `\\lim_{x\\to ${atTex(instance.at)}}`;
  return (
    <PracticeBox title="Límite con L'Hôpital">
      <Tex display tex={`${lim} \\frac{${toTex(num)}}{${toTex(den)}}`} label={`Límite cuando x tiende a ${instance.at === "+inf" ? "más infinito" : instance.at} de ${toSpoken(num)} entre ${toSpoken(den)}`} className="text-[20px]" />
      <NumericAnswers
        fields={[{ label: "Límite =", expected: value }]}
        onSolved={onSolved}
        extra={{ value: form, ok: formOk, message: "Revisa la forma: sustituye en el numerador y en el denominador por separado." }}
        prefix={(showing) => (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-form`} className="text-[14px] font-semibold">
              Al sustituir, ¿qué forma da?
            </label>
            <select
              id={`${id}-form`}
              className={cn(selectClass, "w-full font-body sm:w-72", showing && !formOk && "border-2 border-crit")}
              aria-invalid={showing && !formOk ? true : undefined}
              value={form}
              onChange={(e) => setForm(e.target.value)}
            >
              <option value="">Elige…</option>
              {FORMS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        )}
        hints={[
          "Sustituye x por el punto (o mira hacia dónde van numerador y denominador si x → ∞). Si los dos van a 0, o los dos a ∞, es una indeterminación.",
          "L'Hôpital: lím f/g = lím f′/g′. Deriva numerador y denominador por separado (no es la derivada del cociente).",
          "Si al derivar sigue siendo indeterminado, vuelve a aplicarla.",
        ]}
      />
      <SolutionGate resetKey={key(instance)}>
        <ol className="flex list-decimal flex-col gap-2 rounded-lg border border-border bg-raised p-3 pl-8 text-[16px]" aria-label="Pasos de L'Hôpital">
          {r.steps.map((s, i) => (
            <li key={i}>
              <Tex
                display
                tex={`${lim} \\frac{${toTex(s.num)}}{${toTex(s.den)}} \\;\\to\\; \\frac{${limTex(s.numLimit)}}{${limTex(s.denLimit)}}`}
                label={`Paso ${i + 1}: ${toSpoken(s.num)} entre ${toSpoken(s.den)}; tienden a ${limitText(s.numLimit, niceText)} y ${limitText(s.denLimit, niceText)}`}
              />
              <span className="text-[14px] text-muted">{s.form ? `Forma ${s.form}: se derivan numerador y denominador.` : `Ya no es indeterminado: el límite es ${limitText(r.result, niceText)}.`}</span>
            </li>
          ))}
        </ol>
      </SolutionGate>
    </PracticeBox>
  );
}

// ---------------------------------------------------------------- Dominio

export function DomainPractice({ instance, onSolved }: Props<CalcDomainInstance>) {
  const f = calcExpr(instance.f);
  const q = useMemo(() => domainQuestion(instance), [instance]);
  return (
    <PracticeBox title="Dominio de definición">
      <FnTex e={f} lhs="f(x)" display className="text-[20px]" />
      <ChoicePractice
        legend="¿Cuál es el dominio de f?"
        question={q}
        seedKey={key(instance)}
        onSolved={onSolved}
        actions={
          <Hints
            hints={[
              "√u pide u ≥ 0; ln u pide u > 0; un cociente pide denominador ≠ 0. Escribe todas las condiciones y júntalas (todas a la vez).",
              "Para u = k² − x² ≥ 0, mira el signo de la parábola: es positiva entre sus raíces.",
              "Corchete [ si el extremo está incluido (√0 = 0 vale); paréntesis ( si no (ln 0 o dividir entre 0 no valen).",
            ]}
          />
        }
      />
    </PracticeBox>
  );
}

// ---------------------------------------------------------------- Bisección

export function BisectionPractice({ instance, onSolved }: Props<CalcBisectionInstance>) {
  const f = calcExpr(instance.f);
  const steps = useMemo(() => bisectionOf(instance, Math.max(instance.k, 1))!, [instance]);
  const iters = instance.ask === "iteraciones" ? bisectionIterations(instance.a, instance.b, instance.eps) : 0;
  const [lo, hi] = bisectionInterval(steps);
  const ab = `[${niceText(instance.a)}, ${niceText(instance.b)}]`;
  const question =
    instance.ask === "longitud"
      ? `Se aplica el método de bisección a f en ${ab}. ¿Cuánto mide el intervalo tras ${instance.k} iteraciones?`
      : instance.ask === "intervalo"
        ? `Aplica ${instance.k} iteraciones del método de bisección a f en ${ab}. ¿En qué intervalo [aₖ, bₖ] queda la raíz?`
        : `Con el método de bisección en ${ab}, ¿cuántas iteraciones hacen falta como mínimo para que el intervalo mida menos de ε = ${String(instance.eps).replace(".", ",")}?`;
  const fields: NumericField[] =
    instance.ask === "longitud"
      ? [{ label: "Longitud =", expected: bisectionLength(instance.a, instance.b, instance.k) }]
      : instance.ask === "intervalo"
        ? [
            { label: `a${instance.k === 2 ? "₂" : "₃"} =`, expected: lo },
            { label: `b${instance.k === 2 ? "₂" : "₃"} =`, expected: hi },
          ]
        : [{ label: "Iteraciones =", expected: iters }];
  const fmt = (v: number) => niceText(v);
  return (
    <PracticeBox title="Método de bisección">
      <FnTex e={f} lhs="f(x)" display className="text-[18px]" />
      <p>{question}</p>
      <NumericAnswers
        fields={fields}
        onSolved={onSolved}
        hints={[
          "Bolzano: si f es continua y f(a) y f(b) tienen signos distintos, hay una raíz en (a, b).",
          "Cada iteración: m = (a + b)/2; te quedas con la mitad en la que f cambia de signo ([a, m] o [m, b]).",
          "Tras k iteraciones el intervalo mide (b − a)/2ᵏ.",
        ]}
      />
      <SolutionGate resetKey={key(instance)}>
        {instance.ask === "iteraciones" ? (
          <p className="rounded-lg border border-border bg-raised p-3">{`(b − a)/2ᵏ < ε: con k = ${iters - 1} mide ${fmt(bisectionLength(instance.a, instance.b, iters - 1))}; con k = ${iters}, ${fmt(bisectionLength(instance.a, instance.b, iters))}. Hacen falta ${iters}.`}</p>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <table className="border-collapse text-center font-mono text-[14px]">
              <caption className="pb-1 text-left font-body">Iteraciones de la bisección</caption>
              <thead>
                <tr>
                  {["k", "a", "b", "m", "signo de f(m)", "se queda con"].map((h) => (
                    <th key={h} scope="col" className="border border-border bg-sunken px-2 py-1">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {steps.map((s, i) => (
                  <tr key={i}>
                    <td className="border border-border px-2 py-1">{i + 1}</td>
                    <td className="border border-border px-2 py-1">{fmt(s.a)}</td>
                    <td className="border border-border px-2 py-1">{fmt(s.b)}</td>
                    <td className="border border-border px-2 py-1">{fmt(s.m)}</td>
                    <td className="border border-border px-2 py-1">{s.fm > 0 ? "+" : s.fm < 0 ? "−" : "0"}</td>
                    <td className="border border-border px-2 py-1">{s.keep === "izquierda" ? `[${fmt(s.a)}, ${fmt(s.m)}]` : s.keep === "derecha" ? `[${fmt(s.m)}, ${fmt(s.b)}]` : "raíz"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SolutionGate>
    </PracticeBox>
  );
}

// ---------------------------------------------------------------- Regla de la cadena

const vecTex = (v: readonly number[]) => `(${v.map(niceTex).join(",\\ ")})`;
const vecText = (v: readonly number[]) => `(${v.map(niceText).join(", ")})`;

function ChainStatement({ inst }: { inst: CalcChainInstance }) {
  const h = inst.outer;
  const c = h === "f" ? "g" : "f";
  if (inst.kind === "jacobiana") {
    const m = inst.map.map((t) => calcExpr(t, ["x", "y"]));
    return (
      <div className="flex flex-col gap-2">
        <p>{`Sean ${c}: ℝ² → ℝ² y ${h}: ℝ² → ℝ diferenciables, con`}</p>
        <Tex display tex={`${c}(x, y) = \\left(${toTex(m[0]!)},\\ ${toTex(m[1]!)}\\right)`} label={`${c} de x, y igual a ${toSpoken(m[0]!)} coma ${toSpoken(m[1]!)}`} className="text-[18px]" />
        <Tex
          display
          tex={`\\nabla ${h}\\big(${c}${vecTex(inst.p)}\\big) = ${vecTex(inst.grad)}`}
          label={`gradiente de ${h} en ${c} de ${vecText(inst.p)} igual a ${vecText(inst.grad)}`}
          className="text-[18px]"
        />
        <p>
          Calcula <Tex tex={`\\frac{\\partial (${h}\\circ ${c})}{\\partial x} + \\frac{\\partial (${h}\\circ ${c})}{\\partial y}`} label={`la suma de las dos parciales de ${h} compuesta con ${c}`} /> en el punto {vecText(inst.p)}.
        </p>
      </div>
    );
  }
  const t0 = niceTex(inst.t0);
  return (
    <div className="flex flex-col gap-2">
      <p>{`Sean ${c}: ℝ → ℝ² y ${h}: ℝ² → ℝ diferenciables, con:`}</p>
      {inst.curve ? (
        <Tex display tex={`${c}(t) = \\left(${curveTex(inst.curve[0])},\\ ${curveTex(inst.curve[1])}\\right)`} label={`${c} de t igual a ${inst.curve[0]} coma ${inst.curve[1]}`} className="text-[18px]" />
      ) : (
        <Tex
          display
          tex={`${c}(${t0}) = ${vecTex(inst.point)},\\quad ${c}'(${t0}) = ${vecTex(inst.velocity)}`}
          label={`${c} de ${inst.t0} igual a ${vecText(inst.point)}; ${c} prima de ${inst.t0} igual a ${vecText(inst.velocity)}`}
          className="text-[18px]"
        />
      )}
      {inst.h ? (
        <FnTex e={calcExpr(inst.h, ["x", "y"])} lhs={`${h}(x, y)`} display className="text-[18px]" />
      ) : (
        <ul className="flex flex-col gap-1">
          {[
            { at: inst.point, g: inst.grad! },
            ...(inst.decoy ? [{ at: inst.decoy.at, g: inst.decoy.grad }] : []),
          ]
            .sort((a, b) => a.at[0] - b.at[0] || a.at[1] - b.at[1])
            .map((d) => (
              <li key={d.at.join()}>
                <Tex
                  tex={`\\frac{\\partial ${h}}{\\partial x}${vecTex(d.at)} = ${niceTex(d.g[0])},\\quad \\frac{\\partial ${h}}{\\partial y}${vecTex(d.at)} = ${niceTex(d.g[1])}`}
                  label={`derivada parcial de ${h} respecto de x en ${vecText(d.at)} igual a ${niceText(d.g[0])}; respecto de y, ${niceText(d.g[1])}`}
                />
              </li>
            ))}
        </ul>
      )}
      <p>
        Calcula <Tex tex={`[${h}\\circ ${c}]'(${t0})`} label={`la derivada de ${h} compuesta con ${c} en ${inst.t0}`} />.
      </p>
    </div>
  );
}

export function ChainPractice({ instance, onSolved }: Props<CalcChainInstance>) {
  const value = chainAnswer(instance);
  const h = instance.outer;
  const c = h === "f" ? "g" : "f";
  return (
    <PracticeBox title="Regla de la cadena">
      <ChainStatement inst={instance} />
      <NumericAnswers
        fields={[{ label: "Resultado =", expected: value }]}
        onSolved={onSolved}
        hints={
          instance.kind === "jacobiana"
            ? [
                `∇(${h}∘${c})(p) = ∇${h}(${c}(p)) · J${c}(p): el gradiente (fila) por la matriz jacobiana de ${c}.`,
                `J${c} tiene en cada fila las parciales de una componente de ${c}: (∂${c}₁/∂x, ∂${c}₁/∂y) y (∂${c}₂/∂x, ∂${c}₂/∂y), evaluadas en p.`,
              ]
            : [
                `Primero mira qué composición tiene sentido: ${c} va de ℝ a ℝ² y ${h} de ℝ² a ℝ, así que es ${h}∘${c}.`,
                `[${h}∘${c}]′(t) = ∇${h}(${c}(t)) · ${c}′(t): el gradiente se evalúa en el punto ${c}(t), no en t.`,
                "El producto escalar: ∂h/∂x · c₁′ + ∂h/∂y · c₂′.",
              ]
        }
      />
      <SolutionGate resetKey={key(instance)}>
        <p className="rounded-lg border border-border bg-raised p-3">
          {instance.kind === "jacobiana"
            ? `Con la jacobiana de ${c} en ${vecText(instance.p)}, ∂/∂x + ∂/∂y = ${niceText(value)}.`
            : `${c}(t₀) = ${vecText(instance.point)}, ${c}′(t₀) = ${vecText(instance.velocity)}; ∇${h} en ${vecText(instance.point)} por ${c}′(t₀) = ${niceText(value)}.`}
        </p>
      </SolutionGate>
    </PracticeBox>
  );
}

// ---------------------------------------------------------------- Cuenca del descenso

export function BasinPractice({ instance, onSolved }: Props<CalcBasinInstance>) {
  const f = calcExpr(instance.f);
  const q = useMemo(() => basinQuestion(instance), [instance]);
  const crit = criticalPoints1D(f) ?? [];
  const xs = crit.map((c) => Number(c.x.n) / Number(c.x.d));
  // Un poco más allá de los puntos críticos (y de x₀): lo justo para ver los valles.
  const lo = Math.min(...xs, instance.ask === "destino" ? instance.x0 : Infinity) - 1;
  const hi = Math.max(...xs, instance.ask === "destino" ? instance.x0 : -Infinity) + 1;
  const fx = compile(f);
  const legend =
    instance.ask === "destino"
      ? `Con una tasa de aprendizaje α pequeña, ¿adónde lleva el descenso de gradiente empezando en x₀ = ${niceText(instance.x0)}?`
      : `Con una tasa de aprendizaje α pequeña, ¿para qué puntos de partida x₀ converge el descenso de gradiente a x = ${niceText(instance.target)}?`;
  return (
    <PracticeBox title="Descenso de gradiente: ¿adónde converge?">
      <FnTex e={f} lhs="f(x)" display className="text-[18px]" />
      <FunctionPlot
        xRange={[lo, hi]}
        curves={[{ id: "f", label: "f", f: fx, style: "solid", color: "var(--text)" }]}
        markers={instance.ask === "destino" ? [{ x: instance.x0, y: fx(instance.x0), shape: "circle", color: "var(--accent)", label: "x₀" }] : []}
        label={`Gráfica de f(x) = ${toSpoken(f)} entre x = ${niceText(Math.round(lo))} y x = ${niceText(Math.round(hi))}${instance.ask === "destino" ? `, con el punto de partida x₀ = ${niceText(instance.x0)} marcado` : ""}.`}
      />
      <ChoicePractice
        legend={legend}
        question={q}
        seedKey={key(instance)}
        onSolved={onSolved}
        actions={
          <Hints
            hints={[
              "Cada paso es x ← x − α·f′(x): si f′(x) > 0 va hacia la izquierda; si f′(x) < 0, hacia la derecha. Siempre cuesta abajo.",
              "Con α pequeño se para en el primer punto crítico que encuentra bajando: el fondo del valle en el que empieza.",
              "La cuenca de un mínimo va de un máximo vecino al otro (sin incluirlos: en un máximo, f′ = 0 y no se mueve). Si a un lado no hay máximo, llega hasta ±∞.",
            ]}
          />
        }
      />
    </PracticeBox>
  );
}

// ---------------------------------------------------------------- Puntos críticos tipo test

export function CriticalChoicePractice({ instance, onSolved }: Props<CalcCriticalChoiceInstance>) {
  const f = calcExpr(instance.f, ["x", "y"]);
  const q = useMemo(() => criticalChoiceQuestion(instance), [instance]);
  return (
    <PracticeBox title="Puntos críticos (tipo test)">
      <FnTex e={f} lhs="f(x, y)" display className="text-[18px]" />
      <ChoicePractice
        legend={criticalAskText(instance)}
        question={q}
        seedKey={key(instance)}
        onSolved={onSolved}
        actions={
          <Hints
            hints={[
              "Punto crítico: ∂f/∂x = 0 y ∂f/∂y = 0 a la vez. Sustituye cada punto en las dos parciales.",
              "Hessiana: |H| = f_xx·f_yy − f_xy². |H| > 0 y f_xx > 0: mínimo; |H| > 0 y f_xx < 0: máximo; |H| < 0: silla.",
              "Si una parcial no puede valer 0 nunca (por ejemplo, k·eˣ), no hay puntos críticos.",
            ]}
          />
        }
      />
    </PracticeBox>
  );
}

// ---------------------------------------------------------------- Integración por partes

export function PartsPractice({ instance, onSolved }: Props<CalcPartsInstance>) {
  const integrand = calcExpr(partsIntegrand(instance.fam, instance.k, instance.a));
  const cf = partsIntegral(instance);
  const choice = partsChoice(instance.fam, instance.a);
  const F = partsAntiderivative(instance.fam, instance.k, instance.a);
  const q = useMemo(() => (instance.answer === "opciones" ? partsQuestion(instance) : null), [instance]);
  const tex = `\\int_{${boundTex(instance.lo)}}^{${boundTex(instance.hi)}} ${toTex(integrand)}\\, dx`;
  const hints = [
    "Por partes: ∫ u dv = u·v − ∫ v du. Elige como u lo que se simplifica al derivar (ln x, o x frente a eˣ, sen x, cos x).",
    `Aquí: u = ${choice.u}, dv = ${choice.dv}; entonces du = ${choice.du} y v = ${choice.v}.`,
    "Regla de Barrow: F(límite de arriba) − F(límite de abajo), aunque el de arriba sea el menor (el signo cambia solo). ln 1 = 0, ln e = 1, cos π = −1.",
  ];
  return (
    <PracticeBox title="Integración por partes">
      <Tex display tex={tex} label={`Integral entre ${boundText(instance.lo)} y ${boundText(instance.hi)} de ${toSpoken(integrand)}`} className="text-[20px]" />
      {q ? (
        <ChoicePractice legend="¿Cuánto vale la integral?" question={q} seedKey={key(instance)} onSolved={onSolved} actions={<Hints hints={hints} />} />
      ) : (
        <NumericAnswers rounding="dos" fields={[{ label: "Integral =", expected: closedValue(cf) }]} onSolved={onSolved} hints={hints} />
      )}
      <SolutionGate resetKey={key(instance)}>
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-raised p-3 text-[16px]">
          <FnTex e={F} lhs="F(x)" display />
          <Tex display tex={`${tex} = ${closedTex(cf)} \\approx ${niceTex(Number(closedValue(cf).toFixed(4)))}`} label={`La integral vale ${closedText(cf)}`} />
          <span className="text-[14px] text-muted">{`F(${boundText(instance.hi)}) − F(${boundText(instance.lo)}), con ${boundText(instance.hi)} ≈ ${niceText(Number(boundValue(instance.hi).toFixed(4)))}.`}</span>
        </div>
      </SolutionGate>
    </PracticeBox>
  );
}
