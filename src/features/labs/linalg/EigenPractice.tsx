// «Autovalores y autovectores»: el estudiante escribe (si quiere) el polinomio característico, los
// autovalores y un autovector de cada uno. La app comprueba el polinomio (vale det(A − λI) o
// det(λI − A), desarrollado o factorizado), cada autovalor y cada vector con A·v = λ·v, así que vale
// cualquier múltiplo no nulo. Nunca dice qué autovalor falta ni qué vector poner.
import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { eigenspace, eigenvalues, isCharPolynomial, isEigenpair, charPolynomial, parsePolynomial, polyTex, polyText } from "../../../../shared/linalg/eigen.ts";
import { fracText, matrixVector, parseEntry, parseMatrix, vectorText, type Matrix, type Vector } from "../../../../shared/linalg/matrix.ts";
import { equals, type Frac } from "../../../../shared/rational.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Input } from "../../../components/ui/input.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { dimText, Hints, MatrixView, PracticeBox, Status, Verdict } from "./common.tsx";

/** Lista de números separada por «;», espacios o «, » (la coma pegada a cifras es decimal). */
export function parseNumberList(text: string): { ok: true; values: Frac[] } | { ok: false } {
  const parts = text
    .replace(/,\s+/g, ";")
    .split(/[;\s]+/)
    .filter((p) => p !== "");
  if (parts.length === 0 || parts.length > 8) return { ok: false };
  const values: Frac[] = [];
  for (const p of parts) {
    const r = parseEntry(p);
    if (!r.ok) return { ok: false };
    if (!values.some((v) => equals(v, r.value))) values.push(r.value);
  }
  return { ok: true, values };
}

function parseVector(text: string, n: number): Vector | null {
  const r = parseMatrix(text);
  if (!r.ok) return null;
  const flat = r.value.length === 1 ? r.value[0]! : r.value.every((row) => row.length === 1) ? r.value.map((row) => row[0]!) : null;
  return flat && flat.length === n ? flat : null;
}

export function EigenPractice({ a, onSolved }: { a: Matrix; onSolved?: () => void }) {
  const n = a.length;
  const ev = useMemo(() => eigenvalues(a), [a]);
  const [polyInput, setPolyInput] = useState("");
  const [polyChecked, setPolyChecked] = useState(false);
  const [valuesText, setValuesText] = useState("");
  const [vectors, setVectors] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const touch = () => setChecked(false);

  const list = parseNumberList(valuesText);
  const mine = list.ok ? list.values : [];
  const isRoot = (x: Frac) => ev.roots.some((r) => equals(r.value, x));
  const extra = mine.filter((x) => !isRoot(x));
  const missing = ev.roots.filter((r) => !mine.some((x) => equals(x, r.value))).length;
  const keyOf = (x: Frac) => `${x.n}/${x.d}`;
  const vectorOk = (x: Frac) => {
    const v = parseVector(vectors[keyOf(x)] ?? "", n);
    return v !== null && isEigenpair(a, v, x);
  };
  const solved = ev.complete && list.ok && extra.length === 0 && missing === 0 && mine.every(vectorOk);

  const poly = parsePolynomial(polyInput);
  const polyOk = poly.ok && isCharPolynomial(a, poly.value);

  return (
    <PracticeBox title="Autovalores y autovectores">
      <MatrixView M={a} label={`A, ${dimText(a)}`} />
      {!ev.complete ? (
        <Status>
          <Verdict tone="warn">
            Esta matriz tiene autovalores irracionales o complejos: aquí se practica con autovalores racionales. Puedes comprobar el polinomio característico.
          </Verdict>
        </Status>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="eigen-poly" className="text-[14px] font-semibold">
          Polinomio característico p(λ) = det(A − λI) (opcional)
        </label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="eigen-poly"
            autoComplete="off"
            spellCheck={false}
            className={cn("max-w-sm font-mono", polyChecked && !polyOk && "border-crit")}
            aria-invalid={polyChecked && !polyOk ? true : undefined}
            placeholder="λ² − 5λ + 6"
            value={polyInput}
            onChange={(e) => {
              setPolyInput(e.target.value.slice(0, 120));
              setPolyChecked(false);
            }}
          />
          <Button onClick={() => setPolyChecked(true)}>Comprobar el polinomio</Button>
        </div>
        <p className="text-[14px] text-muted">Desarrollado o factorizado: λ^2 − 5λ + 6 o (λ − 2)(λ − 3). También vale det(λI − A).</p>
        {polyChecked ? (
          <Status>
            {!poly.ok ? (
              <span className="text-crit">{poly.error}</span>
            ) : polyOk ? (
              <Verdict tone="ok">
                <Check size={16} aria-hidden="true" />
                ¡Correcto! Ese es el polinomio característico.
              </Verdict>
            ) : (
              <Verdict tone="warn">{`No es det(A − λI): revisa las cuentas. Tiene que ser de grado ${n}.`}</Verdict>
            )}
          </Status>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="eigen-values" className="text-[14px] font-semibold">
          Autovalores
        </label>
        <Input
          id="eigen-values"
          autoComplete="off"
          spellCheck={false}
          className={cn("max-w-sm font-mono", checked && !(list.ok && extra.length === 0 && missing === 0) && "border-crit")}
          placeholder="2; −1"
          aria-describedby="eigen-values-help"
          value={valuesText}
          onChange={(e) => {
            setValuesText(e.target.value.slice(0, 80));
            touch();
          }}
        />
        <p id="eigen-values-help" className="text-[14px] text-muted">
          Sepáralos con punto y coma o espacios. Un autovalor doble se escribe una vez.
        </p>
      </div>

      {mine.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[14px] font-semibold">Un autovector de cada autovalor</legend>
          {mine.map((x) => {
            const k = keyOf(x);
            const bad = checked && isRoot(x) && !vectorOk(x);
            return (
              <label key={k} className="flex flex-wrap items-center gap-2 font-mono text-[16px]">
                {`λ = ${fracText(x)}: v =`}
                <Input
                  autoComplete="off"
                  spellCheck={false}
                  className={cn("w-44 font-mono", bad && "border-crit")}
                  aria-invalid={bad ? true : undefined}
                  placeholder={n === 2 ? "1 −1" : "1 0 −1"}
                  value={vectors[k] ?? ""}
                  onChange={(e) => {
                    const t = e.target.value.slice(0, 60);
                    setVectors((prev) => ({ ...prev, [k]: t }));
                    touch();
                  }}
                />
              </label>
            );
          })}
        </fieldset>
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
            "Los autovalores son las raíces del polinomio característico p(λ) = det(A − λI).",
            n === 2 ? "En 2×2: p(λ) = λ² − tr(A)·λ + |A|, con tr(A) la suma de la diagonal." : "En 3×3, desarrolla det(A − λI) por la fila o columna con más ceros; prueba como raíces los divisores del término independiente.",
            "Para cada λ, resuelve (A − λI)·v = 0: cualquier vector no nulo de ese núcleo es un autovector.",
            "Comprueba cada vector: A·v tiene que ser λ·v.",
          ]}
        />
      </div>
      {checked ? (
        <Status>
          {!list.ok ? (
            <span className="text-crit">Escribe los autovalores como números separados por punto y coma.</span>
          ) : (
            <>
              {extra.map((x) => (
                <span key={keyOf(x)}>{`λ = ${fracText(x)} no es autovalor: det(A − ${fracText(x)}·I) ≠ 0.`}</span>
              ))}
              {missing > 0 ? <span>{missing === 1 ? "Te falta 1 autovalor." : `Te faltan ${missing} autovalores.`}</span> : null}
              {mine.filter(isRoot).map((x) => {
                const v = parseVector(vectors[keyOf(x)] ?? "", n);
                if (v === null) return <span key={keyOf(x)}>{`Escribe un vector de ${n} componentes para λ = ${fracText(x)}.`}</span>;
                if (v.every((c) => c.n === 0n)) return <span key={keyOf(x)}>{`El vector nulo nunca es autovector (λ = ${fracText(x)}).`}</span>;
                return isEigenpair(a, v, x) ? (
                  <Verdict key={keyOf(x)} tone="ok">{`λ = ${fracText(x)}: A·v = ${vectorText(matrixVector(a, v))} = ${fracText(x)}·v. Bien.`}</Verdict>
                ) : (
                  <span key={keyOf(x)}>{`El vector para λ = ${fracText(x)} no cumple A·v = λ·v.`}</span>
                );
              })}
              {solved ? (
                <Verdict tone="ok">
                  <Check size={16} aria-hidden="true" />
                  ¡Correcto! Todos los autovalores, cada uno con un autovector.
                </Verdict>
              ) : null}
            </>
          )}
        </Status>
      ) : null}
      <SolutionGate>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3 text-[14px]">
          <Tex display tex={`\\det(\\lambda I - A) = ${polyTex(charPolynomial(a))}`} label={`det(λI − A) = ${polyText(charPolynomial(a))}`} />
          {ev.roots.length === 0 ? <p>No tiene autovalores racionales.</p> : null}
          <ul className="flex flex-col gap-1">
            {ev.roots.map((r) => {
              const basis = eigenspace(a, r.value);
              return (
                <li key={keyOf(r.value)}>
                  {`λ = ${fracText(r.value)}${r.mult > 1 ? ` (multiplicidad ${r.mult})` : ""}: autoespacio generado por ${basis.map(vectorText).join(", ")}; dimensión ${basis.length}.`}
                </li>
              );
            })}
          </ul>
          {!ev.complete ? <p>El resto de raíces no son racionales.</p> : null}
        </div>
      </SolutionGate>
    </PracticeBox>
  );
}
