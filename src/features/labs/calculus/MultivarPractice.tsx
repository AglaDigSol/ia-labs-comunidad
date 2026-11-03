// «Varias variables»: derivadas parciales y gradiente en un punto, con el mapa de curvas de nivel y
// las flechas del gradiente (perpendiculares a las curvas, hacia donde f crece); y puntos críticos
// clasificados con la hessiana. Se corrige cada campo sin decir su valor; los puntos que escribe la
// persona se dibujan en el mapa con la forma de su clasificación.
import { Check, Plus, Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { CRITICAL_LABEL, criticalPoints, type CriticalKind } from "../../../../shared/calculus/critical.ts";
import { derivative, hessian } from "../../../../shared/calculus/derive.ts";
import { equivalent } from "../../../../shared/calculus/equivalence.ts";
import { compile, decimalText, toSpoken, toTex, type Expr } from "../../../../shared/calculus/expr.ts";
import { tidy } from "../../../../shared/calculus/simplify.ts";
import { fracTex, fracText } from "../../../../shared/linalg/matrix.ts";
import { toNumber } from "../../../../shared/rational.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { selectClass } from "../boole/AxiomPractice.tsx";
import { ContourPlot, LegendItem, type Marker, type Shape } from "./charts.tsx";
import { FnTex, FunctionField, Hints, HowToWrite, NumberField, PracticeBox, readFunction, readNumber, Status, Verdict } from "./common.tsx";
import { numberOk, numTex } from "./TangentPractice.tsx";

const XY = ["x", "y"] as const;

/** Rango por defecto alrededor de un punto. */
const around = (c: number): [number, number] => [c - 3, c + 3];

function useField2(f: Expr) {
  return useMemo(() => {
    const fx = derivative(f, "x");
    const fy = derivative(f, "y");
    const F = compile(f);
    const gx = compile(fx);
    const gy = compile(fy);
    return { fx, fy, F, grad: (x: number, y: number): [number, number] => [gx(x, y), gy(x, y)] };
  }, [f]);
}

export function GradientPractice({ f, point, x, y, onSolved }: { f: Expr; point: [number, number]; x?: [number, number]; y?: [number, number]; onSolved?: () => void }) {
  const id = useId();
  const field = useField2(f);
  const xr = useMemo(() => x ?? around(point[0]), [x, point]);
  const yr = useMemo(() => y ?? around(point[1]), [y, point]);
  const [dx, setDx] = useState("");
  const [dy, setDy] = useState("");
  const [g1, setG1] = useState("");
  const [g2, setG2] = useState("");
  const [arrows, setArrows] = useState(true);
  const [checked, setChecked] = useState(false);
  const touch = () => setChecked(false);
  const okExpr = (text: string, target: Expr) => {
    const r = readFunction(text, { vars: XY });
    return r.ok && equivalent(r.expr, target, XY).kind === "equal";
  };
  const [vx, vy] = field.grad(point[0], point[1]);
  const okDx = okExpr(dx, field.fx);
  const okDy = okExpr(dy, field.fy);
  const okG1 = numberOk(g1, vx);
  const okG2 = numberOk(g2, vy);
  const all = [okDx, okDy, okG1, okG2];
  const solved = all.every(Boolean);
  const p = `(${decimalText(point[0])}, ${decimalText(point[1])})`;
  return (
    <PracticeBox title="Derivadas parciales y gradiente">
      <div className="flex flex-wrap items-baseline gap-x-4">
        <FnTex e={f} lhs="f(x, y)" className="text-[18px]" />
        <Tex tex={`P = (${numTex(point[0])}, ${numTex(point[1])})`} label={`punto P ${p}`} className="text-[18px]" />
      </div>
      <ContourPlot
        f={field.F}
        grad={field.grad}
        arrows={arrows}
        xRange={xr}
        yRange={yr}
        markers={[{ x: point[0], y: point[1], shape: "diamond", color: "var(--crit)", label: "P" }]}
        label={`Curvas de nivel de f(x, y) = ${toSpoken(f)} para x entre ${decimalText(xr[0])} y ${decimalText(xr[1])} e y entre ${decimalText(yr[0])} y ${decimalText(yr[1])}${arrows ? ", con flechas en la dirección del gradiente" : ""}. El punto P ${p} está marcado con un rombo.`}
      />
      <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Leyenda">
        <LegendItem label="Curvas de nivel" color="var(--text-muted)" style="solid" />
        {arrows ? <LegendItem label="Dirección de ∇f (hacia donde f crece)" color="var(--accent)" style="solid" /> : null}
        <LegendItem label="P" color="var(--crit)" shape="diamond" />
      </ul>
      <label className="flex min-h-11 items-center gap-2 text-[14px]">
        <input type="checkbox" checked={arrows} onChange={(e) => setArrows(e.target.checked)} className="h-5 w-5" />
        Flechas del gradiente
      </label>
      <FunctionField id={`${id}-dx`} label="∂f/∂x =" value={dx} vars={XY} onChange={(v) => (setDx(v), touch())} invalid={checked && !okDx} />
      <FunctionField id={`${id}-dy`} label="∂f/∂y =" value={dy} vars={XY} onChange={(v) => (setDy(v), touch())} invalid={checked && !okDy} />
      <fieldset className="flex flex-col gap-1">
        <legend className="text-[14px] font-semibold">
          <Tex tex="\nabla f(P)" label="Gradiente de f en P" /> = (… , …)
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Primera componente" value={g1} invalid={checked && !okG1} onChange={(v) => (setG1(v), touch())} />
          <NumberField label="Segunda componente" value={g2} invalid={checked && !okG2} onChange={(v) => (setG2(v), touch())} />
        </div>
      </fieldset>
      <HowToWrite extra="Aquí hay dos variables: x e y (x y es x·y)." />
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
            "∂f/∂x: deriva respecto de x como si y fuera un número (una constante). ∂f/∂y, al revés.",
            "∇f = (∂f/∂x, ∂f/∂y). Para ∇f(P), sustituye x e y por las coordenadas de P en cada parcial.",
            "El gradiente apunta hacia donde f crece más deprisa y es perpendicular a la curva de nivel que pasa por el punto.",
          ]}
        />
      </div>
      {checked ? (
        <Status>
          {solved ? (
            <Verdict tone="ok">
              <Check size={16} aria-hidden="true" />
              ¡Correcto! Las dos parciales y el gradiente en P.
            </Verdict>
          ) : (
            <Verdict tone="warn">{`${all.filter(Boolean).length} de 4 bien. Revisa los campos marcados.`}</Verdict>
          )}
        </Status>
      ) : null}
      <SolutionGate resetKey={`${toSpoken(f)}|${p}`}>
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-raised p-3">
          <Tex display tex={`\\frac{\\partial f}{\\partial x} = ${toTex(tidy(field.fx))},\\qquad \\frac{\\partial f}{\\partial y} = ${toTex(tidy(field.fy))}`} label={`derivada parcial respecto de x: ${toSpoken(tidy(field.fx))}; respecto de y: ${toSpoken(tidy(field.fy))}`} />
          <Tex display tex={`\\nabla f(P) = \\left(${numTex(vx)}, ${numTex(vy)}\\right)`} label={`gradiente en P: (${decimalText(vx)}, ${decimalText(vy)})`} />
        </div>
      </SolutionGate>
    </PracticeBox>
  );
}

// ---------------------------------------------------------------- Puntos críticos

const KINDS: CriticalKind[] = ["minimo", "maximo", "silla", "no-concluyente"];
export const KIND_SHAPE: Record<CriticalKind, Shape> = { minimo: "circle", maximo: "triangle", silla: "cross", "no-concluyente": "ring" };
const isKind = (x: string): x is CriticalKind => (KINDS as string[]).includes(x);

type Row = { x: string; y: string; kind: CriticalKind | ""; det: string };
const blankRow = (): Row => ({ x: "", y: "", kind: "", det: "" });

export function CriticalPractice({ f, x, y, onSolved }: { f: Expr; x?: [number, number]; y?: [number, number]; onSolved?: () => void }) {
  const id = useId();
  const field = useField2(f);
  const analysis = useMemo(() => criticalPoints(f), [f]);
  const H = useMemo(() => hessian(f).map((r) => r.map(tidy)), [f]);
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [checked, setChecked] = useState(false);
  const xr = useMemo<[number, number]>(() => x ?? [-3, 3], [x]);
  const yr = useMemo<[number, number]>(() => y ?? [-3, 3], [y]);
  const set = (i: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
    setChecked(false);
  };

  const pts = analysis.ok ? analysis.points.map((p) => ({ ...p, nx: toNumber(p.x), ny: toNumber(p.y), ndet: toNumber(p.det) })) : [];
  const evals = rows.map((r) => {
    const vx = readNumber(r.x);
    const vy = readNumber(r.y);
    const match = vx === null || vy === null ? null : (pts.find((p) => Math.abs(p.nx - vx) < 1e-9 && Math.abs(p.ny - vy) < 1e-9) ?? null);
    return {
      read: vx !== null && vy !== null,
      match,
      kindOk: match !== null && r.kind === match.kind,
      detOk: r.det.trim() === "" ? null : match !== null && numberOk(r.det, match.ndet),
    };
  });
  const matched = new Set(evals.map((e) => e.match).filter((m) => m !== null));
  const duplicates = evals.filter((e) => e.match !== null).length - matched.size;
  const missing = pts.length - matched.size;
  const solved = analysis.ok && evals.every((e) => e.match && e.kindOk && e.detOk !== false) && missing === 0 && duplicates === 0;

  const markers: Marker[] = rows.flatMap((r, i) => {
    const vx = readNumber(r.x);
    const vy = readNumber(r.y);
    return vx === null || vy === null ? [] : [{ x: vx, y: vy, shape: r.kind ? KIND_SHAPE[r.kind] : "square", color: "var(--crit)", label: `${i + 1}` }];
  });

  return (
    <PracticeBox title="Puntos críticos y hessiana">
      <FnTex e={f} lhs="f(x, y)" className="text-[18px]" />
      <ContourPlot
        f={field.F}
        xRange={xr}
        yRange={yr}
        markers={markers}
        label={`Curvas de nivel de f(x, y) = ${toSpoken(f)}. ${markers.length === 0 ? "Aún no has marcado puntos." : `Tus puntos: ${rows
          .map((r, i) => (readNumber(r.x) === null || readNumber(r.y) === null ? null : `${i + 1}: (${r.x}, ${r.y})${r.kind ? `, ${CRITICAL_LABEL[r.kind].toLowerCase()}` : ""}`))
          .filter(Boolean)
          .join("; ")}.`}`}
      />
      <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Leyenda">
        <LegendItem label="Mínimo" color="var(--crit)" shape="circle" />
        <LegendItem label="Máximo" color="var(--crit)" shape="triangle" />
        <LegendItem label="Silla" color="var(--crit)" shape="cross" />
        <LegendItem label="Sin clasificar" color="var(--crit)" shape="square" />
      </ul>
      {!analysis.ok ? (
        <Status>
          <Verdict tone="warn">
            {analysis.reason === "not-polynomial"
              ? "Para buscar los puntos críticos, usa un polinomio en x e y."
              : analysis.reason === "irrational"
                ? "Esta función tiene puntos críticos con coordenadas irracionales: aquí se practica con puntos racionales."
                : analysis.reason === "infinite"
                  ? "Esta función tiene infinitos puntos críticos (una recta o curva entera)."
                  : "No sé resolver ∇f = 0 para esta función: prueba con un polinomio de grado ≤ 3 en el que una parcial sea de grado 1 en x o en y."}
          </Verdict>
        </Status>
      ) : null}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-[14px] font-semibold">Tus puntos críticos</legend>
        {rows.map((r, i) => {
          const e = evals[i]!;
          const badPoint = checked && (!e.read || !e.match);
          return (
            <div key={i} role="group" aria-label={`Punto ${i + 1}`} className="flex flex-col gap-2 rounded-md border border-border p-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <NumberField label={`x (punto ${i + 1})`} value={r.x} invalid={badPoint} onChange={(v) => set(i, { x: v })} />
                <NumberField label={`y (punto ${i + 1})`} value={r.y} invalid={badPoint} onChange={(v) => set(i, { y: v })} />
                <div className="flex min-w-0 flex-col gap-1">
                  <label htmlFor={`${id}-k${i}`} className="text-[14px] font-semibold">
                    Tipo
                  </label>
                  <select
                    id={`${id}-k${i}`}
                    className={cn(selectClass, "w-full font-body", checked && e.match && !e.kindOk && "border-2 border-crit")}
                    aria-invalid={checked && e.match !== null && !e.kindOk ? true : undefined}
                    value={r.kind}
                    onChange={(ev) => set(i, { kind: isKind(ev.target.value) ? ev.target.value : "" })}
                  >
                    <option value="">Elige…</option>
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {CRITICAL_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <NumberField label="|H| (opcional)" value={r.det} invalid={checked && e.detOk === false} onChange={(v) => set(i, { det: v })} />
              </div>
              <Button
                variant="ghost"
                className="self-start"
                disabled={rows.length === 1}
                aria-label={`Quitar el punto ${i + 1}`}
                onClick={() => {
                  setRows((rs) => rs.filter((_, k) => k !== i));
                  setChecked(false);
                }}
              >
                <Trash2 size={16} aria-hidden="true" />
                Quitar
              </Button>
            </div>
          );
        })}
        <Button
          className="self-start"
          disabled={rows.length >= 6}
          onClick={() => {
            setRows((rs) => [...rs, blankRow()]);
            setChecked(false);
          }}
        >
          <Plus size={16} aria-hidden="true" />
          Añadir un punto
        </Button>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={!analysis.ok}
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
            "Los puntos críticos son las soluciones del sistema ∂f/∂x = 0, ∂f/∂y = 0.",
            "Despeja una variable en la ecuación más sencilla y sustitúyela en la otra.",
            "En cada punto, la hessiana es H = (fxx fxy; fxy fyy) y |H| = fxx·fyy − fxy².",
            "|H| > 0 y fxx > 0: mínimo local; |H| > 0 y fxx < 0: máximo local; |H| < 0: punto de silla; |H| = 0: el criterio no decide.",
          ]}
        />
      </div>
      {checked && analysis.ok ? (
        <Status>
          {evals.map((e, i) =>
            !e.read ? (
              <span key={i}>{`Punto ${i + 1}: escribe sus dos coordenadas.`}</span>
            ) : !e.match ? (
              <span key={i}>{`Punto ${i + 1}: no es un punto crítico (∇f no se anula ahí).`}</span>
            ) : !e.kindOk ? (
              <span key={i}>{`Punto ${i + 1}: es crítico, pero revisa su clasificación con |H| y fxx.`}</span>
            ) : e.detOk === false ? (
              <span key={i}>{`Punto ${i + 1}: bien clasificado, pero |H| no vale eso.`}</span>
            ) : (
              <span key={i}>{`Punto ${i + 1}: correcto.`}</span>
            ),
          )}
          {duplicates > 0 ? <span>Has repetido algún punto.</span> : null}
          {missing > 0 ? <span>{missing === 1 ? "Te falta 1 punto crítico." : `Te faltan ${missing} puntos críticos.`}</span> : null}
          {solved ? (
            <Verdict tone="ok">
              <Check size={16} aria-hidden="true" />
              ¡Correcto! Todos los puntos críticos, bien clasificados.
            </Verdict>
          ) : null}
        </Status>
      ) : null}
      <SolutionGate resetKey={toSpoken(f)}>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3 text-[14px]">
          <Tex display tex={`\\frac{\\partial f}{\\partial x} = ${toTex(tidy(field.fx))} = 0,\\qquad \\frac{\\partial f}{\\partial y} = ${toTex(tidy(field.fy))} = 0`} label={`Sistema: ${toSpoken(tidy(field.fx))} = 0 y ${toSpoken(tidy(field.fy))} = 0`} />
          <Tex display tex={`H(x, y) = \\begin{pmatrix} ${toTex(H[0]![0]!)} & ${toTex(H[0]![1]!)} \\\\ ${toTex(H[1]![0]!)} & ${toTex(H[1]![1]!)} \\end{pmatrix}`} label={`Hessiana: fxx = ${toSpoken(H[0]![0]!)}, fxy = ${toSpoken(H[0]![1]!)}, fyy = ${toSpoken(H[1]![1]!)}`} />
          {analysis.ok ? (
            <ul className="flex flex-col gap-1">
              {analysis.points.map((p) => (
                <li key={`${fracText(p.x)},${fracText(p.y)}`}>
                  <Tex tex={`(${fracTex(p.x)}, ${fracTex(p.y)}):\\ |H| = ${fracTex(p.det)},\\ f_{xx} = ${fracTex(p.H[0][0])}`} label={`(${fracText(p.x)}, ${fracText(p.y)}): |H| = ${fracText(p.det)}, fxx = ${fracText(p.H[0][0])}`} />
                  {` → ${CRITICAL_LABEL[p.kind]}`}
                </li>
              ))}
              {analysis.points.length === 0 ? <li>No tiene puntos críticos.</li> : null}
            </ul>
          ) : null}
        </div>
      </SolutionGate>
    </PracticeBox>
  );
}
