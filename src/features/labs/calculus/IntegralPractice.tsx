// «Integrales»: una primitiva se comprueba derivándola (vale cualquier constante: + C), y una integral
// definida se compara con su valor numérico (Simpson adaptativo), escrita con tres decimales o exacta
// (16/3, e − 1, ln 2). Debajo, los rectángulos de Riemann (extremo izquierdo, derecho o punto medio)
// para ver cómo la suma se acerca al área al aumentar n; los valores de las sumas se enseñan cuando
// la integral ya está bien (antes darían la respuesta).
import { Check } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { antiderivative } from "../../../../shared/calculus/antiderivative.ts";
import { compile, decimalText, toSpoken, toTex, type Expr } from "../../../../shared/calculus/expr.ts";
import { checkAntiderivative, definiteIntegral, RIEMANN_LABEL, riemannSum, type RiemannRule } from "../../../../shared/calculus/integrals.ts";
import { parseExpr } from "../../../../shared/calculus/parser.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { Tex } from "../../../lib/tex.tsx";
import { FunctionPlot, LegendItem } from "./charts.tsx";
import { FunctionField, Hints, HowToWrite, NumberField, PracticeBox, Status, Verdict } from "./common.tsx";
import { numberOk, numTex, numText } from "./TangentPractice.tsx";

const INTEGRAL_RULES = [
  "Linealidad: ∫(a·f + b·g) dx = a·∫f dx + b·∫g dx.",
  "∫xⁿ dx = xⁿ⁺¹/(n + 1) + C si n ≠ −1; ∫1/x dx = ln|x| + C.",
  "∫eˣ dx = eˣ + C; ∫sen x dx = −cos x + C; ∫cos x dx = sen x + C.",
  "Con u = a·x + b: ∫f(a·x + b) dx = F(a·x + b)/a + C (por ejemplo, ∫e³ˣ dx = e³ˣ/3 + C).",
  "Comprueba tu primitiva derivándola: tienes que volver a f.",
];

/** Un límite de integración como texto («π/2», «e») a número y a TeX. */
export function boundOf(text: string): { value: number; tex: string } {
  const r = parseExpr(text);
  if (!r.ok) throw new Error(`límite ilegible: ${text}`);
  return { value: compile(r.expr)(0), tex: toTex(r.expr) };
}

export function AntiderivativePractice({ f, onSolved }: { f: Expr; onSolved?: () => void }) {
  const id = useId();
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(false);
  const result = checked ? checkAntiderivative(text, f) : null;
  const F = useMemo(() => antiderivative(f), [f]);
  return (
    <PracticeBox title="Primitiva">
      <Tex display tex={`\\int ${wrapIntegrand(f)}\\,dx`} label={`integral de ${toSpoken(f)} diferencial de x`} className="text-[20px]" />
      <FunctionField
        id={`${id}-F`}
        label="F(x) ="
        value={text}
        onChange={(v) => {
          setText(v);
          setChecked(false);
        }}
        invalid={result !== null && !result.ok && result.reason === "wrong"}
        placeholder="x^3/3 + sen(x) + C"
      />
      <HowToWrite extra="La constante de integración se escribe al final: + C." />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={text.trim() === ""}
          onClick={() => {
            setChecked(true);
            if (checkAntiderivative(text, f).ok) onSolved?.();
          }}
        >
          <Check size={16} aria-hidden="true" />
          Comprobar
        </Button>
        <Hints hints={INTEGRAL_RULES} />
      </div>
      {result ? (
        <Status>
          {result.ok ? (
            <Verdict tone="ok">
              <Check size={16} aria-hidden="true" />
              {result.hadConstant ? "¡Correcto! Al derivar tu F vuelves a f." : "¡Correcto! Al derivar tu F vuelves a f. No olvides la constante: ∫ f dx = F(x) + C."}
            </Verdict>
          ) : result.reason === "parse" ? (
            <span className="text-crit">{result.error.message}</span>
          ) : result.reason === "wrong" ? (
            <Verdict tone="warn">Al derivar tu F no sale f: revisa cada término (deriva tu respuesta para ver dónde falla).</Verdict>
          ) : (
            <Verdict tone="warn">No lo puedo comprobar: tu expresión no está definida en casi ningún punto.</Verdict>
          )}
        </Status>
      ) : null}
      <SolutionGate resetKey={toSpoken(f)}>
        <div className="rounded-lg border border-border bg-raised p-3">
          {F ? (
            <Tex display tex={`\\int ${wrapIntegrand(f)}\\,dx = ${toTex(F)} + C`} label={`Una primitiva: ${toSpoken(F)} más C`} />
          ) : (
            <p className="text-[14px]">Esta primitiva no es inmediata y la app no la sabe escribir; compruébala derivando.</p>
          )}
        </div>
      </SolutionGate>
    </PracticeBox>
  );
}

/** El integrando, entre paréntesis si es una suma. */
const wrapIntegrand = (f: Expr) => (f.k === "add" ? `\\left(${toTex(f)}\\right)` : toTex(f));

export function DefiniteIntegralPractice({ f, a, b, onSolved }: { f: Expr; a: string; b: string; onSolved?: () => void }) {
  const A = boundOf(a);
  const B = boundOf(b);
  const exact = useMemo(() => definiteIntegral(f, A.value, B.value), [f, A.value, B.value]);
  const F = useMemo(() => antiderivative(f), [f]);
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(false);
  const ok = numberOk(text, exact);
  const integral = `\\int_{${A.tex}}^{${B.tex}} ${wrapIntegrand(f)}\\,dx`;
  return (
    <PracticeBox title="Integral definida">
      <Tex display tex={integral} label={`integral de ${a} a ${b} de ${toSpoken(f)} diferencial de x`} className="text-[20px]" />
      <NumberField
        label="Valor"
        value={text}
        invalid={checked && !ok}
        onChange={(v) => {
          setText(v);
          setChecked(false);
        }}
        placeholder="16/3 o 5,333"
        className="max-w-xs"
      />
      <p className="text-[14px] text-muted">Exacto (16/3, e − 1, ln 2, π/4) o con tres decimales.</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={text.trim() === ""}
          onClick={() => {
            setChecked(true);
            if (ok) onSolved?.();
          }}
        >
          <Check size={16} aria-hidden="true" />
          Comprobar
        </Button>
        <Hints
          hints={[
            "Regla de Barrow: si F es una primitiva de f, ∫ₐᵇ f(x) dx = F(b) − F(a).",
            "Primero busca F (la constante C se va al restar), luego sustituye los dos límites.",
            ...INTEGRAL_RULES.slice(0, 3),
          ]}
        />
      </div>
      {checked ? (
        <Status>
          {ok ? (
            <Verdict tone="ok">
              <Check size={16} aria-hidden="true" />
              ¡Correcto!
            </Verdict>
          ) : (
            <Verdict tone="warn">No es el valor de la integral. Revisa la primitiva y el signo de F(b) − F(a).</Verdict>
          )}
        </Status>
      ) : null}
      <RiemannExplorer f={f} a={A.value} b={B.value} showSums={checked && ok} />
      <SolutionGate resetKey={`${toSpoken(f)}|${a}|${b}`}>
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-raised p-3">
          {F ? (
            <Tex
              display
              tex={`${integral} = \\Big[${toTex(F)}\\Big]_{${A.tex}}^{${B.tex}} ${numText(exact).includes(",") ? "\\approx" : "="} ${numTex(exact)}`}
              label={`Con la primitiva ${toSpoken(F)}, vale ${decimalText(exact, 4)}`}
            />
          ) : (
            <p>{`Vale aproximadamente ${decimalText(exact, 4)}.`}</p>
          )}
        </div>
      </SolutionGate>
    </PracticeBox>
  );
}

/** Rectángulos de Riemann con n y la regla elegidos. */
export function RiemannExplorer({ f, a, b, showSums = true }: { f: Expr; a: number; b: number; showSums?: boolean }) {
  const id = useId();
  const fx = useMemo(() => compile(f), [f]);
  const [n, setN] = useState(4);
  const [rule, setRule] = useState<RiemannRule>("izquierda");
  const sum = useMemo(() => riemannSum(fx, a, b, n, rule), [fx, a, b, n, rule]);
  const pad = (b - a) * 0.1;
  const table = [2, 4, 8, 16, 32].map((k) => ({ k, s: riemannSum(fx, a, b, k, rule).sum }));
  return (
    <section aria-labelledby={`${id}-t`} className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <h3 id={`${id}-t`} className="font-display text-[18px] font-semibold">
        Sumas de Riemann
      </h3>
      <ToggleGroup
        type="single"
        value={rule}
        aria-label="Altura de cada rectángulo"
        className="grid max-w-full grid-cols-1 self-start sm:inline-flex"
        onValueChange={(v) => {
          if (v === "izquierda" || v === "derecha" || v === "medio") setRule(v);
        }}
      >
        {(["izquierda", "derecha", "medio"] as const).map((r) => (
          <ToggleGroupItem key={r} value={r}>
            {RIEMANN_LABEL[r]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="flex items-center gap-2">
        <label htmlFor={`${id}-n`} className="w-28 text-[14px] font-semibold">
          Rectángulos
        </label>
        <input id={`${id}-n`} type="range" min={1} max={50} value={n} onChange={(e) => setN(Number(e.target.value))} className="h-11 min-w-0 flex-1 accent-[var(--accent)]" />
        <output htmlFor={`${id}-n`} className="w-10 text-right font-mono">
          {n}
        </output>
      </div>
      <FunctionPlot
        xRange={[a - pad, b + pad]}
        curves={[{ id: "f", label: "f", f: fx, style: "solid", color: "var(--text)" }]}
        rects={sum.rects}
        label={`Gráfica de f(x) = ${toSpoken(f)} con ${n} rectángulos (${RIEMANN_LABEL[rule].toLowerCase()}) entre ${decimalText(a)} y ${decimalText(b)}.`}
      />
      <ul className="flex flex-wrap gap-x-4" aria-label="Leyenda">
        <LegendItem label="f(x)" color="var(--text)" style="solid" />
        <li className="inline-flex items-center gap-2 text-[14px]">
          <svg width="18" height="14" aria-hidden="true">
            <rect x="1" y="1" width="16" height="12" fill="var(--accent)" fillOpacity={0.16} stroke="var(--accent)" />
          </svg>
          Rectángulos (con signo: por debajo del eje cuentan en negativo)
        </li>
      </ul>
      {showSums ? (
        <>
          <p className="text-[14px]" aria-live="polite">
            <Tex tex={`S_{${n}} \\approx ${decimalText(sum.sum, 4).replace(",", "{,}")}`} label={`S sub ${n} aproximadamente ${decimalText(sum.sum, 4)}`} />
          </p>
          <details className="text-[14px]">
            <summary className="flex min-h-11 cursor-pointer items-center">Ver cómo se acercan al aumentar n</summary>
            <table className="w-auto text-left">
              <thead>
                <tr>
                  <th scope="col" className="p-2">
                    n
                  </th>
                  <th scope="col" className="p-2">
                    Sₙ
                  </th>
                </tr>
              </thead>
              <tbody>
                {table.map((r) => (
                  <tr key={r.k} className="border-t border-border">
                    <th scope="row" className="p-2 font-mono">
                      {r.k}
                    </th>
                    <td className="p-2 font-mono">{decimalText(r.s, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      ) : (
        <p className="text-[14px] text-muted">Mira cómo los rectángulos cubren mejor el área al aumentar n. Los valores de las sumas Sₙ aparecen cuando aciertes la integral.</p>
      )}
    </section>
  );
}

