// Secciones del laboratorio de cálculo: cada una elige un ejemplo de content/calculo (o una función
// propia) y monta su práctica. Cada práctica se vuelve a montar (key) al cambiar de ejemplo, así que
// no arrastra respuestas de otro.
import { useId, useState, type ReactNode } from "react";
import { CALC_PACK } from "../../../../content/calculo/practica.ts";
import { toPlain, type Expr, type VarName } from "../../../../shared/calculus/expr.ts";
import { calcExpr } from "../../../../shared/exercises/calculus.ts";
import { Button } from "../../../components/ui/button.tsx";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { cn } from "../../../lib/cn.ts";
import { selectClass } from "../boole/AxiomPractice.tsx";
import { FunctionField, levelLabel, LEVELS, NumberField, readFunction, readNumber } from "./common.tsx";
import { DerivativePractice } from "./DerivativePractice.tsx";
import { DescentPracticeBlock, DescentSimulator } from "./DescentSection.tsx";
import { AntiderivativePractice, DefiniteIntegralPractice } from "./IntegralPractice.tsx";
import { CriticalPractice, GradientPractice } from "./MultivarPractice.tsx";
import { TangentPractice } from "./TangentPractice.tsx";

type Preset = { id: string; level: string; label: string };

/** «x^2 sen x» → «f(x) = x^2·sen(x)», para las listas. */
const fLabel = (f: string, vars: readonly VarName[] = ["x"]) => `${vars.length === 2 ? "f(x, y)" : "f(x)"} = ${toPlain(calcExpr(f, vars))}`;

/** Lista de ejemplos por nivel con «Escribir la mía»; con «propia» se enseña el formulario. */
function SourcePicker({ label, presets, value, onChange, own }: { label: string; presets: Preset[]; value: string; onChange: (id: string) => void; own: ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[14px] font-semibold">
        {label}
      </label>
      <select id={id} className={cn(selectClass, "w-full font-body")} value={value} onChange={(e) => onChange(e.target.value)}>
        {LEVELS.map((level) => {
          const items = presets.filter((p) => p.level === level);
          return items.length === 0 ? null : (
            <optgroup key={level} label={levelLabel(level)}>
              {items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          );
        })}
        <option value="propia">Escribir la mía</option>
      </select>
      {value === "propia" ? own : null}
    </div>
  );
}

/** Formulario de una función propia (y, si hace falta, números como x₀ o los límites). */
function OwnForm({
  vars = ["x"],
  numbers = [],
  onUse,
  placeholder,
}: {
  vars?: readonly VarName[];
  numbers?: Array<{ label: string; placeholder: string }>;
  onUse: (f: Expr, nums: number[], texts: string[]) => void;
  placeholder: string;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const [nums, setNums] = useState<string[]>(numbers.map(() => ""));
  const [error, setError] = useState<string | null>(null);
  const use = () => {
    const r = readFunction(text, { vars });
    if (!r.ok) return setError(r.error.message);
    const values = nums.map(readNumber);
    const bad = values.findIndex((v) => v === null);
    if (bad >= 0) return setError(`Escribe un número en «${numbers[bad]!.label}».`);
    setError(null);
    onUse(r.expr, values as number[], nums);
  };
  return (
    <div className="flex flex-col gap-2">
      <FunctionField id={`${id}-f`} label={vars.length === 2 ? "f(x, y) =" : "f(x) ="} vars={vars} value={text} onChange={setText} placeholder={placeholder} />
      {numbers.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {numbers.map((n, i) => (
            <NumberField key={n.label} label={n.label} value={nums[i] ?? ""} onChange={(v) => setNums((xs) => xs.map((x, k) => (k === i ? v : x)))} placeholder={n.placeholder} />
          ))}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-[14px] text-crit">
          {error}
        </p>
      ) : null}
      <Button className="self-start" onClick={use}>
        Usar esta función
      </Button>
    </div>
  );
}

function Layout({ side, children }: { side: ReactNode; children: ReactNode }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-4">{side}</div>
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-8">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- Derivadas

export function DerivativesSection() {
  const list = CALC_PACK.derivatives;
  const [choice, setChoice] = useState(list[0]!.id);
  const [own, setOwn] = useState<{ f: Expr; key: string } | null>(null);
  const preset = list.find((d) => d.id === choice);
  const f = preset ? calcExpr(preset.f) : (own?.f ?? null);
  const key = preset ? preset.id : `propia|${own?.key ?? ""}`;
  return (
    <Layout
      side={
        <>
          <SourcePicker
            label="Función"
            presets={list.map((d) => ({ id: d.id, level: d.level, label: fLabel(d.f) }))}
            value={choice}
            onChange={setChoice}
            own={<OwnForm placeholder="x^2·e^(3x)" onUse={(e) => setOwn({ f: e, key: toPlain(e) })} />}
          />
          <p className="text-[14px] text-muted">
            Empieza en f′(x) = (f(x))′ y aplica una regla en cada línea: lo que aún no has derivado se queda con prima, (u)′. La app comprueba cada
            línea en muchos puntos y te dice si la regla elegida es la que encaja.
          </p>
        </>
      }
    >
      {f ? <DerivativePractice key={key} f={f} /> : null}
    </Layout>
  );
}

// ---------------------------------------------------------------- Tangente

export function TangentSection() {
  const list = CALC_PACK.tangents;
  const [choice, setChoice] = useState(list[0]!.id);
  const [own, setOwn] = useState<{ f: Expr; x0: number; key: string } | null>(null);
  const preset = list.find((d) => d.id === choice);
  const item = preset ? { f: calcExpr(preset.f), x0: preset.x0, range: preset.range as [number, number], key: preset.id } : own ? { ...own, range: undefined } : null;
  return (
    <Layout
      side={
        <SourcePicker
          label="Función y punto"
          presets={list.map((d) => ({ id: d.id, level: d.level, label: `${fLabel(d.f)}, x₀ = ${d.x0}` }))}
          value={choice}
          onChange={setChoice}
          own={<OwnForm placeholder="x^3 − 2x" numbers={[{ label: "x₀", placeholder: "1" }]} onUse={(e, [x0]) => setOwn({ f: e, x0: x0!, key: `${toPlain(e)}|${x0}` })} />}
        />
      }
    >
      {item ? <TangentPractice key={item.key} f={item.f} x0={item.x0} range={item.range} /> : null}
    </Layout>
  );
}

// ---------------------------------------------------------------- Integrales

export function IntegralsSection() {
  const [kind, setKind] = useState<"primitiva" | "definida">("primitiva");
  const prims = CALC_PACK.antiderivatives;
  const defs = CALC_PACK.definite;
  const [pChoice, setPChoice] = useState(prims[0]!.id);
  const [dChoice, setDChoice] = useState(defs[0]!.id);
  const [ownP, setOwnP] = useState<{ f: Expr; key: string } | null>(null);
  const [ownD, setOwnD] = useState<{ f: Expr; a: string; b: string; key: string } | null>(null);
  const p = prims.find((x) => x.id === pChoice);
  const dd = defs.find((x) => x.id === dChoice);
  const prim = p ? { f: calcExpr(p.f), key: p.id } : ownP;
  const def = dd ? { f: calcExpr(dd.f), a: String(dd.a), b: String(dd.b), key: dd.id } : ownD;
  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        type="single"
        value={kind}
        aria-label="Tipo de integral"
        className="grid max-w-full grid-cols-2 self-start sm:inline-flex"
        onValueChange={(v) => {
          if (v === "primitiva" || v === "definida") setKind(v);
        }}
      >
        <ToggleGroupItem value="primitiva">Primitiva</ToggleGroupItem>
        <ToggleGroupItem value="definida">Integral definida</ToggleGroupItem>
      </ToggleGroup>
      {kind === "primitiva" ? (
        <Layout
          side={
            <SourcePicker
              label="Función"
              presets={prims.map((d) => ({ id: d.id, level: d.level, label: fLabel(d.f) }))}
              value={pChoice}
              onChange={setPChoice}
              own={<OwnForm placeholder="3x^2 + cos(x)" onUse={(e) => setOwnP({ f: e, key: toPlain(e) })} />}
            />
          }
        >
          {prim ? <AntiderivativePractice key={prim.key} f={prim.f} /> : null}
        </Layout>
      ) : (
        <Layout
          side={
            <SourcePicker
              label="Integral"
              presets={defs.map((d) => ({ id: d.id, level: d.level, label: `∫ de ${d.a} a ${d.b} de ${toPlain(calcExpr(d.f))}` }))}
              value={dChoice}
              onChange={setDChoice}
              own={
                <OwnForm
                  placeholder="x^2 + 1"
                  numbers={[
                    { label: "a (límite inferior)", placeholder: "0" },
                    { label: "b (límite superior)", placeholder: "2" },
                  ]}
                  onUse={(e, [a, b], texts) => {
                    if (a! < b!) setOwnD({ f: e, a: texts[0]!, b: texts[1]!, key: `${toPlain(e)}|${texts.join("|")}` });
                  }}
                />
              }
            />
          }
        >
          {def ? <DefiniteIntegralPractice key={def.key} f={def.f} a={def.a} b={def.b} /> : null}
        </Layout>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Varias variables

const XY = ["x", "y"] as const;

export function MultivarSection() {
  const [kind, setKind] = useState<"gradiente" | "criticos">("gradiente");
  const grads = CALC_PACK.multivariable;
  const crits = CALC_PACK.critical;
  const [gChoice, setGChoice] = useState(grads[0]!.id);
  const [cChoice, setCChoice] = useState(crits[0]!.id);
  const [ownG, setOwnG] = useState<{ f: Expr; point: [number, number]; key: string } | null>(null);
  const [ownC, setOwnC] = useState<{ f: Expr; key: string } | null>(null);
  const g = grads.find((x) => x.id === gChoice);
  const c = crits.find((x) => x.id === cChoice);
  const grad = g ? { f: calcExpr(g.f, XY), point: g.point as [number, number], x: g.x as [number, number], y: g.y as [number, number], key: g.id } : ownG;
  const crit = c ? { f: calcExpr(c.f, XY), x: c.x as [number, number], y: c.y as [number, number], key: c.id } : ownC;
  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        type="single"
        value={kind}
        aria-label="Práctica"
        className="grid max-w-full grid-cols-2 self-start sm:inline-flex"
        onValueChange={(v) => {
          if (v === "gradiente" || v === "criticos") setKind(v);
        }}
      >
        <ToggleGroupItem value="gradiente">Parciales y gradiente</ToggleGroupItem>
        <ToggleGroupItem value="criticos">Puntos críticos</ToggleGroupItem>
      </ToggleGroup>
      {kind === "gradiente" ? (
        <Layout
          side={
            <SourcePicker
              label="Función y punto"
              presets={grads.map((d) => ({ id: d.id, level: d.level, label: `${fLabel(d.f, XY)}, P = (${d.point.join(", ")})` }))}
              value={gChoice}
              onChange={setGChoice}
              own={
                <OwnForm
                  vars={XY}
                  placeholder="x^2 y − 3y"
                  numbers={[
                    { label: "x de P", placeholder: "1" },
                    { label: "y de P", placeholder: "2" },
                  ]}
                  onUse={(e, [px, py]) => setOwnG({ f: e, point: [px!, py!], key: `${toPlain(e)}|${px}|${py}` })}
                />
              }
            />
          }
        >
          {grad ? <GradientPractice key={grad.key} f={grad.f} point={grad.point} x={"x" in grad ? grad.x : undefined} y={"y" in grad ? grad.y : undefined} /> : null}
        </Layout>
      ) : (
        <Layout
          side={
            <>
              <SourcePicker
                label="Función"
                presets={crits.map((d) => ({ id: d.id, level: d.level, label: fLabel(d.f, XY) }))}
                value={cChoice}
                onChange={setCChoice}
                own={<OwnForm vars={XY} placeholder="x^3 − 3x + y^2" onUse={(e) => setOwnC({ f: e, key: toPlain(e) })} />}
              />
              <p className="text-[14px] text-muted">Tus puntos se dibujan en el mapa con la forma de su tipo: así ves si caen donde las curvas de nivel se cierran (extremos) o se cruzan (sillas).</p>
            </>
          }
        >
          {crit ? <CriticalPractice key={crit.key} f={crit.f} x={"x" in crit ? crit.x : undefined} y={"y" in crit ? crit.y : undefined} /> : null}
        </Layout>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Descenso

export function DescentSection() {
  return (
    <div className="flex flex-col gap-6">
      <DescentSimulator />
      <DescentPracticeBlock />
    </div>
  );
}
