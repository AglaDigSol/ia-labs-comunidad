// «Operaciones con matrices»: producto, determinante, rango e inversa. El estudiante escribe el
// resultado (la matriz celda a celda o el número) y «Comprobar» marca las celdas que no coinciden sin
// decir su valor. Las pistas dan la regla; el desarrollo completo queda tras «Ver la solución completa».
import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { cofactor, matrixDeterminant, minor, sarrusTerms } from "../../../../shared/linalg/det.ts";
import { fracText, identityMatrix, matrixProduct, parseEntry, parseGrid, type Matrix } from "../../../../shared/linalg/matrix.ts";
import { matrixInverse, matrixRank, rowOpTex, rowOpText, rref, wrongCells } from "../../../../shared/linalg/rref.ts";
import { equals, isZero, mul, neg, type Frac } from "../../../../shared/rational.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Input } from "../../../components/ui/input.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { blankGrid, cellKey, dimText, Hints, MatrixGrid, MatrixView, plural, PracticeBox, Status, Verdict } from "./common.tsx";

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const sub = (n: number) => [...String(n)].map((d) => SUB[Number(d)]).join("");
/** «(−3)» si es negativo, para escribir productos. */
const factor = (x: Frac) => (x.n < 0n ? `(${fracText(x)})` : fracText(x));

/** Corrige una cuadrícula frente a la matriz correcta: celdas mal (incluidas las vacías). */
function gridCheck(expected: Matrix, grid: string[][]) {
  const wrong = wrongCells(expected, parseGrid(grid));
  const total = expected.length * (expected[0]?.length ?? 0);
  return { wrong: new Set(wrong.map(([i, j]) => cellKey(i, j))), right: total - wrong.length, total };
}

function GridVerdict({ right, total, okText }: { right: number; total: number; okText: string }) {
  return right === total ? (
    <Verdict tone="ok">
      <Check size={16} aria-hidden="true" />
      {okText}
    </Verdict>
  ) : (
    <Verdict tone="warn">{`${plural(right, "celda bien", "celdas bien")} de ${total}. Las marcadas no coinciden (las vacías también cuentan).`}</Verdict>
  );
}

// ---------------------------------------------------------------- Producto

export function ProductPractice({ a, b, onSolved }: { a: Matrix; b: Matrix; onSolved?: () => void }) {
  const m = a.length;
  const n = b[0]?.length ?? 0;
  const product = useMemo(() => matrixProduct(a, b), [a, b]);
  const [grid, setGrid] = useState(() => blankGrid(m, n));
  const [checked, setChecked] = useState(false);
  const result = gridCheck(product, grid);
  return (
    <PracticeBox title="Calcula A·B">
      <div className="flex flex-wrap items-center gap-4">
        <MatrixView M={a} label={`A, ${dimText(a)}`} />
        <MatrixView M={b} label={`B, ${dimText(b)}`} />
      </div>
      <p className="text-[14px] text-muted">{`A es ${dimText(a)} y B es ${dimText(b)}, así que A·B es ${m}×${n}.`}</p>
      <MatrixGrid
        name="A·B"
        values={grid}
        flagged={checked ? result.wrong : undefined}
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
            if (result.right === result.total) onSolved?.();
          }}
        >
          <Check size={16} aria-hidden="true" />
          Comprobar
        </Button>
        <Hints
          hints={[
            "El elemento de la fila i y la columna j de A·B es la fila i de A por la columna j de B: multiplica elemento a elemento y suma.",
            "Por ejemplo, c₁₂ = a₁₁·b₁₂ + a₁₂·b₂₂ + …: recorres la fila 1 de A y la columna 2 de B a la vez.",
            "Cuidado con los signos: un producto de dos negativos es positivo.",
          ]}
        />
      </div>
      {checked ? (
        <Status>
          <GridVerdict {...result} okText="¡Correcto! Ese es el producto A·B." />
        </Status>
      ) : null}
      <SolutionGate>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
          <MatrixView M={product} label="A·B" />
          <ul className="flex flex-col gap-1 font-mono text-[14px]">
            {product.map((row, i) =>
              row.map((x, j) => (
                <li key={cellKey(i, j)}>{`c${sub(i + 1)}${sub(j + 1)} = ${a[i]!.map((v, k) => `${factor(v)}·${factor(b[k]![j]!)}`).join(" + ")} = ${fracText(x)}`}</li>
              )),
            )}
          </ul>
        </div>
      </SolutionGate>
    </PracticeBox>
  );
}

// ---------------------------------------------------------------- Determinante

/** Fila o columna con más ceros (para desarrollar por ella). */
function bestLine(M: Matrix): { kind: "fila" | "columna"; index: number } {
  const n = M.length;
  let best = { kind: "fila" as "fila" | "columna", index: 0, zeros: -1 };
  for (let i = 0; i < n; i++) {
    const rz = M[i]!.filter(isZero).length;
    if (rz > best.zeros) best = { kind: "fila", index: i, zeros: rz };
    const cz = M.filter((r) => isZero(r[i]!)).length;
    if (cz > best.zeros) best = { kind: "columna", index: i, zeros: cz };
  }
  return { kind: best.kind, index: best.index };
}

function DeterminantSolution({ M }: { M: Matrix }) {
  const det = matrixDeterminant(M);
  if (M.length === 1) return <p className="font-mono">{`|A| = ${fracText(det)}`}</p>;
  if (M.length === 2) {
    const [[a, b], [c, d]] = M as [[Frac, Frac], [Frac, Frac]];
    return <p className="font-mono text-[14px]">{`|A| = ${factor(a)}·${factor(d)} − ${factor(b)}·${factor(c)} = ${fracText(det)}`}</p>;
  }
  if (M.length === 3) {
    const terms = sarrusTerms(M);
    const text = terms.map((t, k) => `${k === 0 ? "" : t.sign > 0 ? " + " : " − "}${t.factors.map(factor).join("·")}`).join("");
    return (
      <div className="flex flex-col gap-1 text-[14px]">
        <p>Regla de Sarrus: las tres diagonales hacia la derecha suman y las tres hacia la izquierda restan.</p>
        <p className="font-mono">{`|A| = ${text} = ${fracText(det)}`}</p>
      </div>
    );
  }
  const line = bestLine(M);
  const terms = M.map((_, k) => {
    const [i, j] = line.kind === "fila" ? [line.index, k] : [k, line.index];
    return { i, j, a: M[i]![j]! };
  }).filter((t) => !isZero(t.a));
  return (
    <div className="flex flex-col gap-1 text-[14px]">
      <p>{`Desarrollo por la ${line.kind} ${line.index + 1}, la que tiene más ceros: |A| = Σ aᵢⱼ · Aᵢⱼ, con Aᵢⱼ = (−1)^(i+j) · |Mᵢⱼ|.`}</p>
      <ul className="flex flex-col gap-1 font-mono">
        {terms.map(({ i, j, a }) => (
          <li key={cellKey(i, j)}>
            {`a${sub(i + 1)}${sub(j + 1)} · A${sub(i + 1)}${sub(j + 1)} = ${factor(a)} · ${(i + j) % 2 === 0 ? "" : "(−1) · "}${factor(matrixDeterminant(minor(M, i, j)))} = ${fracText(mul(a, cofactor(M, i, j)))}`}
          </li>
        ))}
      </ul>
      <p className="font-mono">{`|A| = ${fracText(det)}`}</p>
    </div>
  );
}

export function DeterminantPractice({ a, onSolved }: { a: Matrix; onSolved?: () => void }) {
  const det = useMemo(() => matrixDeterminant(a), [a]);
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(false);
  const parsed = parseEntry(text);
  const ok = parsed.ok && equals(parsed.value, det);
  const flipped = parsed.ok && !isZero(det) && equals(parsed.value, neg(det));
  const n = a.length;
  const hints =
    n === 2
      ? ["En 2×2: |A| = a₁₁·a₂₂ − a₁₂·a₂₁ (diagonal principal menos diagonal secundaria)."]
      : n === 3
        ? [
            "En 3×3 puedes usar la regla de Sarrus: tres productos con signo + y tres con signo −.",
            "O desarrolla por la fila o columna con más ceros: |A| = Σ aᵢⱼ·(−1)^(i+j)·|Mᵢⱼ|.",
          ]
        : [
            "Desarrolla por la fila o columna con más ceros: |A| = Σ aᵢⱼ·(−1)^(i+j)·|Mᵢⱼ|.",
            "Fᵢ ← Fᵢ + k·Fⱼ no cambia el determinante: úsala para hacer más ceros antes de desarrollar.",
            "Intercambiar dos filas cambia el signo; multiplicar una fila por k multiplica el determinante por k.",
          ];
  return (
    <PracticeBox title="Calcula el determinante">
      <MatrixView M={a} det label={`|A|, ${dimText(a)}`} />
      <div className="flex flex-col gap-1">
        <label htmlFor="det-answer" className="text-[14px] font-semibold">
          |A| =
        </label>
        <Input
          id="det-answer"
          autoComplete="off"
          className={cn("w-32 font-mono", checked && !ok && "border-crit")}
          aria-invalid={checked && !ok ? true : undefined}
          value={text}
          onChange={(e) => {
            setText(e.target.value.slice(0, 24));
            setChecked(false);
          }}
        />
      </div>
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
        <Hints hints={hints} />
      </div>
      {checked ? (
        <Status>
          {!parsed.ok ? (
            <span className="text-crit">{parsed.error}</span>
          ) : ok ? (
            <Verdict tone="ok">
              <Check size={16} aria-hidden="true" />
              {`¡Correcto! |A| = ${fracText(det)}${isZero(det) ? ": A no es invertible." : "."}`}
            </Verdict>
          ) : (
            <Verdict tone="warn">
              {flipped ? "Te ha salido el signo cambiado: revisa los signos (−1)^(i+j) o los productos que restan." : "No es el determinante: revisa las cuentas."}
            </Verdict>
          )}
        </Status>
      ) : null}
      <SolutionGate>
        <div className="rounded-lg border border-border bg-raised p-3">
          <DeterminantSolution M={a} />
        </div>
      </SolutionGate>
    </PracticeBox>
  );
}

// ---------------------------------------------------------------- Rango

export function RankPractice({ a, onSolved }: { a: Matrix; onSolved?: () => void }) {
  const rank = useMemo(() => matrixRank(a), [a]);
  const R = useMemo(() => rref(a), [a]);
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(false);
  const value = /^\s*\d+\s*$/.test(text) ? Number(text) : null;
  const ok = value === rank;
  return (
    <PracticeBox title="Calcula el rango">
      <MatrixView M={a} label={`A, ${dimText(a)}`} />
      <div className="flex flex-col gap-1">
        <label htmlFor="rank-answer" className="text-[14px] font-semibold">
          rg A =
        </label>
        <Input
          id="rank-answer"
          inputMode="numeric"
          autoComplete="off"
          className={cn("w-24 font-mono", checked && !ok && "border-crit")}
          aria-invalid={checked && !ok ? true : undefined}
          value={text}
          onChange={(e) => {
            setText(e.target.value.slice(0, 4));
            setChecked(false);
          }}
        />
      </div>
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
            "El rango es el número de filas (o columnas) linealmente independientes.",
            "Escalona la matriz con operaciones elementales: el rango es el número de filas no nulas que quedan.",
            "En una matriz cuadrada, |A| ≠ 0 significa rango máximo.",
          ]}
        />
      </div>
      {checked ? (
        <Status>
          {value === null ? (
            <span>Escribe un número natural.</span>
          ) : ok ? (
            <Verdict tone="ok">
              <Check size={16} aria-hidden="true" />
              {`¡Correcto! rg A = ${rank}.`}
            </Verdict>
          ) : (
            <Verdict tone="warn">{value > Math.min(a.length, a[0]?.length ?? 0) ? "El rango no puede ser mayor que el número de filas ni que el de columnas." : "No es el rango: escalona la matriz y cuenta las filas no nulas."}</Verdict>
          )}
        </Status>
      ) : null}
      <SolutionGate>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3 text-[14px]">
          <p>Forma escalonada reducida:</p>
          <MatrixView M={R.matrix} label="Forma escalonada reducida de A" />
          <p>{`Tiene ${plural(rank, "fila no nula", "filas no nulas")} (pivotes en las columnas ${R.pivots.map((c) => c + 1).join(", ") || "—"}): rg A = ${rank}.`}</p>
        </div>
      </SolutionGate>
    </PracticeBox>
  );
}

// ---------------------------------------------------------------- Inversa

export function InversePractice({ a, onSolved }: { a: Matrix; onSolved?: () => void }) {
  const n = a.length;
  const inv = useMemo(() => matrixInverse(a), [a]);
  const [claim, setClaim] = useState<"si" | "no" | null>(null);
  const [grid, setGrid] = useState(() => blankGrid(n, n));
  const [checked, setChecked] = useState(false);
  const result = inv ? gridCheck(inv.inverse, grid) : null;
  const claimOk = claim !== null && (claim === "si") === (inv !== null);
  const solved = claimOk && (inv === null || result!.right === result!.total);
  return (
    <PracticeBox title="Calcula la inversa">
      <MatrixView M={a} label={`A, ${dimText(a)}`} />
      <fieldset className="flex flex-wrap gap-x-4">
        <legend className="mb-1 text-[14px] font-semibold">¿Es A invertible?</legend>
        {(["si", "no"] as const).map((v) => (
          <label key={v} className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name={`inversa-${n}`}
              checked={claim === v}
              onChange={() => {
                setClaim(v);
                setChecked(false);
              }}
            />
            {v === "si" ? "Sí" : "No"}
          </label>
        ))}
      </fieldset>
      {claim === "si" ? (
        <MatrixGrid
          name="A⁻¹"
          values={grid}
          flagged={checked && claimOk && result ? result.wrong : undefined}
          onChange={(g) => {
            setGrid(g);
            setChecked(false);
          }}
        />
      ) : null}
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
            "A es invertible si y solo si |A| ≠ 0.",
            "Gauss-Jordan sobre (A | I): cuando a la izquierda quede I, a la derecha tendrás A⁻¹.",
            n === 2 ? "En 2×2: A⁻¹ = (1/|A|)·( a₂₂ −a₁₂ ; −a₂₁ a₁₁ )." : "O con la adjunta: A⁻¹ = (1/|A|)·Adj(A)ᵀ.",
            "Comprueba tu resultado: A·A⁻¹ tiene que dar la identidad.",
          ]}
        />
      </div>
      {checked ? (
        <Status>
          {claim === null ? (
            <span>Decide primero si A es invertible.</span>
          ) : !claimOk ? (
            <Verdict tone="warn">Revisa si A es invertible: calcula su determinante.</Verdict>
          ) : inv === null ? (
            <Verdict tone="ok">
              <Check size={16} aria-hidden="true" />
              ¡Correcto! |A| = 0, así que A no tiene inversa.
            </Verdict>
          ) : (
            <GridVerdict {...result!} okText="¡Correcto! Esa es A⁻¹: A·A⁻¹ = I." />
          )}
        </Status>
      ) : null}
      <SolutionGate>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3 text-[14px]">
          {inv === null ? (
            <p>{`|A| = 0: A no es invertible (rg A = ${matrixRank(a)} < ${n}).`}</p>
          ) : (
            <>
              <p>{`|A| = ${fracText(matrixDeterminant(a))} ≠ 0. Gauss-Jordan sobre (A | I):`}</p>
              <ol className="flex flex-col gap-1 pl-6 [list-style:decimal]">
                {inv.ops.map((o, k) => (
                  <li key={k}>
                    <Tex tex={rowOpTex(o)} label={rowOpText(o)} />
                  </li>
                ))}
              </ol>
              <MatrixView M={inv.steps[inv.steps.length - 1] ?? a.map((r, i) => [...r, ...identityMatrix(n)[i]!])} bar={n} label="(I | A⁻¹)" className="text-[16px]" />
              <MatrixView M={inv.inverse} label="A⁻¹" />
            </>
          )}
        </div>
      </SolutionGate>
    </PracticeBox>
  );
}
