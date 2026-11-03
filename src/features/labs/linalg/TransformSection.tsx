// «Transformaciones en 2D»: un dibujo de la cuadrícula y el cuadrado unidad transformados por una
// matriz 2×2 (con deslizadores), las imágenes de e₁ y e₂, las direcciones propias cuando son reales y
// el determinante como área (con signo: orientación). Debajo, una práctica: escribir la matriz de una
// transformación descrita en palabras (giro, simetría, cizalla, escalado o proyección).
import { Check, Eye, SkipForward } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { LINALG_PACK } from "../../../../content/algebra-lineal/practica.ts";
import { parseGrid, type Matrix } from "../../../../shared/linalg/matrix.ts";
import { apply2, det2, describeTransform, eigenDirections2, transformMatrix, type M2, type TransformSpec } from "../../../../shared/linalg/transform2d.ts";
import { wrongCells } from "../../../../shared/linalg/rref.ts";
import { toNumber } from "../../../../shared/rational.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { blankGrid, cellKey, Hints, MatrixGrid, MatrixView, PracticeBox, Status, Verdict } from "./common.tsx";

const RANGE = 4;
/** La matriz exacta como números, para el dibujo. */
const toM2 = (M: Matrix): M2 => [
  [toNumber(M[0]![0]!), toNumber(M[0]![1]!)],
  [toNumber(M[1]![0]!), toNumber(M[1]![1]!)],
];
const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(2).replace(/0+$/, "").replace(".", ",")).replace("-", "−");

/** Dibujo de la transformación. Coordenadas del plano en [−4, 4]; el eje y hacia arriba. */
export function TransformPlot({ m }: { m: M2 }) {
  const lines: Array<[[number, number], [number, number]]> = [];
  for (let k = -RANGE; k <= RANGE; k++) {
    lines.push([apply2(m, [k, -RANGE]), apply2(m, [k, RANGE])]);
    lines.push([apply2(m, [-RANGE, k]), apply2(m, [RANGE, k])]);
  }
  const square = [apply2(m, [0, 0]), apply2(m, [1, 0]), apply2(m, [1, 1]), apply2(m, [0, 1])];
  const e1 = apply2(m, [1, 0]);
  const e2 = apply2(m, [0, 1]);
  const eig = eigenDirections2(m);
  const det = det2(m);
  const P = (p: readonly [number, number]) => `${p[0]},${-p[1]}`;
  const summary = `Cuadrícula transformada por la matriz (${fmt(m[0][0])}, ${fmt(m[0][1])}; ${fmt(m[1][0])}, ${fmt(m[1][1])}). e₁ va a (${fmt(e1[0])}, ${fmt(e1[1])}) y e₂ a (${fmt(e2[0])}, ${fmt(e2[1])}). El cuadrado unidad pasa a tener área ${fmt(Math.abs(det))}.`;
  return (
    <svg viewBox="-5 -5 10 10" className="aspect-square w-full max-w-[420px] rounded-lg border border-border bg-raised" role="img" aria-label={summary}>
      <defs>
        <clipPath id="plot-clip">
          <rect x="-5" y="-5" width="10" height="10" />
        </clipPath>
      </defs>
      <g clipPath="url(#plot-clip)" fill="none" strokeLinecap="round">
        {/* Cuadrícula original, tenue. */}
        {Array.from({ length: 2 * RANGE + 1 }, (_, i) => i - RANGE).map((k) => (
          <g key={k} stroke="var(--border)" strokeWidth={0.02}>
            <line x1={k} y1={-5} x2={k} y2={5} />
            <line x1={-5} y1={k} x2={5} y2={k} />
          </g>
        ))}
        <g stroke="var(--text-muted)" strokeWidth={0.04}>
          <line x1={-5} y1={0} x2={5} y2={0} />
          <line x1={0} y1={-5} x2={0} y2={5} />
        </g>
        {/* Cuadrícula transformada. */}
        <g stroke="var(--accent)" strokeWidth={0.03} opacity={0.55}>
          {lines.map(([a, b], i) => (
            <line key={i} x1={a[0]} y1={-a[1]} x2={b[0]} y2={-b[1]} />
          ))}
        </g>
        <polygon points={square.map(P).join(" ")} fill="var(--accent)" fillOpacity={0.25} stroke="var(--accent)" strokeWidth={0.05} />
        {eig.kind === "lines"
          ? eig.lines.map((l, i) => (
              <line key={i} x1={-8 * l.dir[0]} y1={8 * l.dir[1]} x2={8 * l.dir[0]} y2={-8 * l.dir[1]} stroke="var(--warn)" strokeWidth={0.05} strokeDasharray="0.25 0.18" />
            ))
          : null}
        <line x1={0} y1={0} x2={e1[0]} y2={-e1[1]} stroke="var(--crit)" strokeWidth={0.09} />
        <line x1={0} y1={0} x2={e2[0]} y2={-e2[1]} stroke="var(--ok)" strokeWidth={0.09} />
      </g>
      <g fontSize={0.45} fontFamily="inherit">
        <text x={e1[0] + 0.15} y={-e1[1] - 0.15} fill="var(--crit)">
          Ae₁
        </text>
        <text x={e2[0] + 0.15} y={-e2[1] - 0.15} fill="var(--ok)">
          Ae₂
        </text>
      </g>
    </svg>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="w-10 font-mono text-[16px]">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={-3}
        max={3}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 min-w-0 flex-1 accent-[var(--accent)]"
        aria-valuetext={fmt(value)}
      />
      <output htmlFor={id} className="w-12 text-right font-mono text-[16px]">
        {fmt(value)}
      </output>
    </div>
  );
}

export function TransformSection() {
  const [m, setM] = useState<M2>([
    [1, 1],
    [0, 1],
  ]);
  const [index, setIndex] = useState(0);
  const set = (i: 0 | 1, j: 0 | 1, v: number) => setM((prev) => prev.map((row, r) => row.map((x, c) => (r === i && c === j ? v : x))) as M2);
  const det = det2(m);
  const eig = eigenDirections2(m);
  const spec = LINALG_PACK.transforms[index % LINALG_PACK.transforms.length]!.spec;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-6">
        <TransformPlot m={m} />
        <fieldset className="flex max-w-[420px] flex-col gap-1">
          <legend className="mb-1 text-[14px] font-semibold">Matriz A</legend>
          <Slider label="a₁₁" value={m[0][0]} onChange={(v) => set(0, 0, v)} />
          <Slider label="a₁₂" value={m[0][1]} onChange={(v) => set(0, 1, v)} />
          <Slider label="a₂₁" value={m[1][0]} onChange={(v) => set(1, 0, v)} />
          <Slider label="a₂₂" value={m[1][1]} onChange={(v) => set(1, 1, v)} />
        </fieldset>
        <div className="flex max-w-[420px] flex-col gap-1 text-[14px]" aria-live="polite">
          <p>{`|A| = ${fmt(det)}: el cuadrado unidad pasa a tener área ${fmt(Math.abs(det))}${det < 0 ? " y se da la vuelta (cambia la orientación)" : det === 0 ? " (el plano se aplasta en una recta o un punto)" : ""}.`}</p>
          <p>
            {eig.kind === "none"
              ? "Sin direcciones propias reales: ninguna recta por el origen se queda en su sitio (los autovalores son complejos)."
              : eig.kind === "all"
                ? `Todas las direcciones son propias: A = ${fmt(eig.lambda)}·I.`
                : `Direcciones propias (líneas discontinuas): ${eig.lines.map((l) => `λ = ${fmt(Math.round(l.lambda * 100) / 100)}`).join(" y ")}.`}
          </p>
          <p className="text-muted">En rojo, la imagen de e₁ = (1, 0); en verde, la de e₂ = (0, 1): son las columnas de A.</p>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-6">
        <TransformPractice
          key={index}
          spec={spec}
          onShow={(M) => setM(toM2(M))}
        />
        <Button className="self-start" onClick={() => setIndex((k) => k + 1)}>
          <SkipForward size={16} aria-hidden="true" />
          Otra transformación
        </Button>
      </div>
    </div>
  );
}

/** Escribir la matriz de una transformación descrita en palabras. */
export function TransformPractice({ spec, onSolved, onShow }: { spec: TransformSpec; onSolved?: () => void; onShow?: (M: Matrix) => void }) {
  const target = useMemo(() => transformMatrix(spec), [spec]);
  const [grid, setGrid] = useState(() => blankGrid(2, 2));
  const [checked, setChecked] = useState(false);
  const wrong = new Set(wrongCells(target, parseGrid(grid)).map(([i, j]) => cellKey(i, j)));
  const ok = wrong.size === 0;
  return (
    <PracticeBox title="¿Qué matriz es?">
      <p className="text-[16px]">{describeTransform(spec)}</p>
      <MatrixGrid
        name="Matriz de la transformación"
        values={grid}
        flagged={checked ? wrong : undefined}
        onChange={(g) => {
          setGrid(g);
          setChecked(false);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
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
            "Las columnas de la matriz son las imágenes de e₁ = (1, 0) y de e₂ = (0, 1).",
            "Dibuja dónde acaban e₁ y e₂ con esa transformación y escribe sus coordenadas, cada una en una columna.",
          ]}
        />
      </div>
      {checked ? (
        <Status>
          {ok ? (
            <Verdict tone="ok">
              <Check size={16} aria-hidden="true" />
              ¡Correcto! Esa es la matriz de la transformación.
            </Verdict>
          ) : (
            <Verdict tone="warn">{`${4 - wrong.size} de 4 celdas bien. Revisa las marcadas.`}</Verdict>
          )}
          {ok && onShow ? (
            <Button variant="ghost" onClick={() => onShow(target)}>
              <Eye size={16} aria-hidden="true" />
              Verla en el dibujo
            </Button>
          ) : null}
        </Status>
      ) : null}
      <SolutionGate resetKey={JSON.stringify(spec)}>
        <div className="rounded-lg border border-border bg-raised p-3">
          <MatrixView M={target} label="Matriz de la transformación" />
        </div>
      </SolutionGate>
    </PracticeBox>
  );
}

