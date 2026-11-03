// «Recta tangente y gráfica»: la gráfica de f (continua) y de f′ (discontinua), el punto (x₀, f(x₀))
// y la recta que escribe la persona (de puntos), para ver si toca la curva sin cortarla. Se piden
// f(x₀), la pendiente f′(x₀) y la recta y = f(x₀) + f′(x₀)(x − x₀); cada campo se marca si está mal,
// sin decir el valor. La solución, detrás de «Ver la solución completa».
import { Check } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { derivative, derivativeTidy } from "../../../../shared/calculus/derive.ts";
import { compile, decimalText, exprVars, toSpoken, type Expr } from "../../../../shared/calculus/expr.ts";
import { parseNumberAnswer, numberMatches } from "../../../../shared/calculus/integrals.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Tex } from "../../../lib/tex.tsx";
import { FunctionPlot, LegendItem, type Curve } from "./charts.tsx";
import { FnTex, FunctionField, Hints, NumberField, PracticeBox, readFunction, Status, Verdict } from "./common.tsx";

/** Un número como fracción si es cómoda (3/4) o con decimales (0,5403). */
export function numText(v: number): string {
  for (let d = 1; d <= 12; d++) {
    const n = Math.round(v * d);
    if (Math.abs(v * d - n) < 1e-9) return (d === 1 ? String(n) : `${n}/${d}`).replace("-", "−");
  }
  return decimalText(v, 4);
}
export function numTex(v: number): string {
  for (let d = 1; d <= 12; d++) {
    const n = Math.round(v * d);
    if (Math.abs(v * d - n) < 1e-9) return d === 1 ? String(n) : `${n < 0 ? "-" : ""}\\frac{${Math.abs(n)}}{${d}}`;
  }
  return decimalText(v, 4).replace("−", "-").replace(",", "{,}");
}

/** ¿El número escrito vale lo esperado? (decimales con tres cifras o valor exacto). */
export function numberOk(text: string, expected: number): boolean {
  const r = parseNumberAnswer(text);
  return r.ok && numberMatches(r, expected);
}

/** y = m·x + b, como texto de libro. */
export function lineTex(m: number, b: number): string {
  const mx = m === 0 ? "" : m === 1 ? "x" : m === -1 ? "-x" : `${numTex(m)}x`;
  if (mx === "") return numTex(b);
  return b === 0 ? mx : `${mx} ${b < 0 ? "-" : "+"} ${numTex(Math.abs(b))}`;
}

export function TangentPractice({ f, x0, range, onSolved }: { f: Expr; x0: number; range?: [number, number]; onSolved?: () => void }) {
  const id = useId();
  const fx = useMemo(() => compile(f), [f]);
  const dfExpr = useMemo(() => derivative(f), [f]);
  const dfx = useMemo(() => compile(dfExpr), [dfExpr]);
  const y0 = fx(x0);
  const m = dfx(x0);
  const xr: [number, number] = range ?? [x0 - 3, x0 + 3];
  const [value, setValue] = useState("");
  const [slope, setSlope] = useState("");
  const [line, setLine] = useState("");
  const [checked, setChecked] = useState(false);

  const parsedLine = line.trim() === "" ? null : readFunction(line);
  const lineFn = parsedLine?.ok && exprVars(parsedLine.expr).every((v) => v === "x") ? compile(parsedLine.expr) : null;
  const valueOk = numberOk(value, y0);
  const slopeOk = numberOk(slope, m);
  // La recta: vale f(x₀) en x₀, sube m por cada unidad y es recta (segunda diferencia nula).
  const lineOk = (() => {
    if (!lineFn) return false;
    const a = lineFn(x0);
    const b = lineFn(x0 + 1);
    const c = lineFn(x0 + 2);
    const tol = (v: number) => 2e-3 * Math.max(1, Math.abs(v));
    return Math.abs(a - y0) <= tol(y0) && Math.abs(b - a - m) <= tol(m) && Math.abs(c - 2 * b + a) <= 1e-6 * Math.max(1, Math.abs(a));
  })();
  const solved = valueOk && slopeOk && lineOk;
  const touch = () => setChecked(false);

  const curves: Curve[] = [
    { id: "f", label: "f", f: fx, style: "solid", color: "var(--text)" },
    { id: "df", label: "f′", f: dfx, style: "dashed", color: "var(--accent)", width: 2 },
    ...(lineFn ? [{ id: "recta", label: "recta", f: lineFn, style: "dotted" as const, color: "var(--warn)", width: 3 }] : []),
  ];
  const summary = `Gráfica de f(x) = ${toSpoken(f)} y de su derivada entre x = ${decimalText(xr[0])} y x = ${decimalText(xr[1])}, con el punto de abscisa x₀ = ${decimalText(x0)} marcado${lineFn ? " y tu recta" : ""}.`;

  return (
    <PracticeBox title="Recta tangente">
      <div className="flex flex-wrap items-baseline gap-x-4">
        <FnTex e={f} lhs="f(x)" className="text-[18px]" />
        <Tex tex={`x_0 = ${numTex(x0)}`} label={`x sub cero igual a ${decimalText(x0)}`} className="text-[18px]" />
      </div>
      <FunctionPlot xRange={xr} curves={curves} markers={Number.isFinite(y0) ? [{ x: x0, y: y0, shape: "circle", color: "var(--accent)", label: "(x₀, f(x₀))" }] : []} label={summary} />
      <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Leyenda">
        <LegendItem label="f(x)" color="var(--text)" style="solid" />
        <LegendItem label="f′(x)" color="var(--accent)" style="dashed" />
        <LegendItem label={solved && checked ? "Recta tangente (tuya)" : "Tu recta"} color="var(--warn)" style="dotted" />
        <LegendItem label="(x₀, f(x₀))" color="var(--accent)" shape="circle" />
      </ul>
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField label="f(x₀) =" value={value} invalid={checked && !valueOk} onChange={(v) => (setValue(v), touch())} />
        <NumberField label="Pendiente f′(x₀) =" value={slope} invalid={checked && !slopeOk} onChange={(v) => (setSlope(v), touch())} />
      </div>
      <FunctionField id={`${id}-line`} label="Recta tangente: y =" value={line} onChange={(v) => (setLine(v), touch())} invalid={checked && !lineOk} />
      <p className="text-[14px] text-muted">Los números, exactos (3/4, e, ln 2) o con tres decimales.</p>
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
            "f(x₀): sustituye x por x₀ en f.",
            "La pendiente de la recta tangente en x₀ es la derivada en ese punto: deriva f y sustituye x = x₀.",
            "Ecuación punto-pendiente: y = f(x₀) + f′(x₀)·(x − x₀). Si quieres, desarrolla hasta y = m·x + b.",
            "En el dibujo, la tangente toca la curva en (x₀, f(x₀)) y allí tiene su misma inclinación.",
          ]}
        />
      </div>
      {checked ? (
        <Status>
          {solved ? (
            <Verdict tone="ok">
              <Check size={16} aria-hidden="true" />
              ¡Correcto! Tu recta es la tangente: toca la curva en (x₀, f(x₀)) con la misma pendiente.
            </Verdict>
          ) : (
            <Verdict tone="warn">{`${[valueOk, slopeOk, lineOk].filter(Boolean).length} de 3 bien. Revisa los campos marcados.`}</Verdict>
          )}
          {!lineOk && parsedLine && !parsedLine.ok ? <span className="text-crit">{parsedLine.error.message}</span> : null}
          {!lineOk && parsedLine?.ok && !lineFn ? <span>La recta solo puede depender de x.</span> : null}
        </Status>
      ) : null}
      <SolutionGate resetKey={`${toSpoken(f)}|${x0}`}>
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-raised p-3 text-[16px]">
          <FnTex e={derivativeTidy(f)} lhs="f'(x)" display />
          <Tex display tex={`f(x_0) = ${numTex(y0)},\\quad f'(x_0) = ${numTex(m)}`} label={`f de x cero igual a ${numText(y0)}; f prima de x cero igual a ${numText(m)}`} />
          <Tex display tex={`y = ${lineTex(m, y0 - m * x0)}`} label={`Recta tangente: y igual a ${numText(m)} por x más ${numText(y0 - m * x0)}`} />
        </div>
      </SolutionGate>
    </PracticeBox>
  );
}
