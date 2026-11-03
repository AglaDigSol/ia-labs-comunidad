// «Independencia lineal y bases»: dados unos vectores, el estudiante decide si son independientes, da
// la dimensión del subespacio que generan y una base (vale cualquier base, no solo la que sale al
// escalonar). La app corrige cada parte y señala qué vector de la base propuesta no está en el
// subespacio, sin decir cuál habría que poner.
import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { fracText, matrixTranspose, parseMatrix, vectorText, type Vector } from "../../../../shared/linalg/matrix.ts";
import { rref } from "../../../../shared/linalg/rref.ts";
import { checkBasis, dependenceRelation, spanBasisIndices, vectorsRank } from "../../../../shared/linalg/spaces.ts";
import { isZero, ONE, equals, neg } from "../../../../shared/rational.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Input } from "../../../components/ui/input.tsx";
import { Textarea } from "../../../components/ui/textarea.tsx";
import { cn } from "../../../lib/cn.ts";
import { Hints, MatrixView, PracticeBox, Status, Verdict } from "./common.tsx";

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const vName = (k: number) => `v${[...String(k + 1)].map((d) => SUB[Number(d)]).join("")}`;

export function IndependencePractice({ vectors, onSolved }: { vectors: Vector[]; onSolved?: () => void }) {
  const dim = vectors[0]?.length ?? 0;
  const rank = useMemo(() => vectorsRank(vectors), [vectors]);
  const independent = rank === vectors.length;
  const span = `⟨${vectors.map((_, k) => vName(k)).join(", ")}⟩`;
  const [claim, setClaim] = useState<"si" | "no" | null>(null);
  const [dimText, setDimText] = useState("");
  const [basisText, setBasisText] = useState("");
  const [checked, setChecked] = useState(false);
  const touch = () => setChecked(false);

  const claimOk = claim !== null && (claim === "si") === independent;
  const dimValue = /^\s*\d+\s*$/.test(dimText) ? Number(dimText) : null;
  const dimOk = dimValue === rank;
  const basis = useMemo(() => {
    const r = parseMatrix(basisText);
    if (!r.ok) return { error: basisText.trim() === "" ? "Escribe una base: un vector por línea." : r.error };
    if (r.value[0]!.length !== dim) return { error: `Cada vector de la base tiene que tener ${dim} componentes.` };
    return { check: checkBasis(r.value, vectors) };
  }, [basisText, dim, vectors]);
  const solved = claimOk && dimOk && "check" in basis && basis.check!.ok;

  return (
    <PracticeBox title="Independencia, dimensión y base">
      <ul className="flex flex-col gap-1 font-mono text-[16px]">
        {vectors.map((v, k) => (
          <li key={k}>{`${vName(k)} = ${vectorText(v)}`}</li>
        ))}
      </ul>
      <fieldset className="flex flex-wrap gap-x-4">
        <legend className="mb-1 text-[14px] font-semibold">¿Son linealmente independientes?</legend>
        {(["si", "no"] as const).map((v) => (
          <label key={v} className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name={`independencia-${vectors.length}-${dim}`}
              checked={claim === v}
              onChange={() => {
                setClaim(v);
                touch();
              }}
            />
            {v === "si" ? "Sí, son independientes" : "No, son dependientes"}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-1">
        <label htmlFor="indep-dim" className="text-[14px] font-semibold">
          {`dim ${span} =`}
        </label>
        <Input
          id="indep-dim"
          inputMode="numeric"
          autoComplete="off"
          className={cn("w-24 font-mono", checked && !dimOk && "border-crit")}
          aria-invalid={checked && !dimOk ? true : undefined}
          value={dimText}
          onChange={(e) => {
            setDimText(e.target.value.slice(0, 3));
            touch();
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="indep-basis" className="text-[14px] font-semibold">
          {`Una base de ${span}`}
        </label>
        <Textarea
          id="indep-basis"
          className="font-mono"
          spellCheck={false}
          placeholder={"1 0 2\n0 1 -1"}
          aria-describedby="indep-basis-help"
          aria-invalid={checked && !("check" in basis && basis.check!.ok) ? true : undefined}
          value={basisText}
          onChange={(e) => {
            setBasisText(e.target.value.slice(0, 300));
            touch();
          }}
        />
        <p id="indep-basis-help" className="text-[14px] text-muted">
          Un vector por línea, con las componentes separadas por espacios. Vale cualquier base del subespacio.
        </p>
      </div>
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
            "Pon los vectores como filas de una matriz y escalónala: su rango es la dimensión del subespacio que generan.",
            "Son independientes si y solo si el rango es igual al número de vectores.",
            "Una base: las filas no nulas de la escalonada, o los vectores dados que corresponden a columnas pivote (si los pones como columnas).",
          ]}
        />
      </div>
      {checked ? (
        <Status>
          {claim === null ? (
            <span>Decide si son independientes.</span>
          ) : (
            <Verdict tone={claimOk ? "ok" : "warn"}>{claimOk ? "La respuesta sobre la independencia es correcta." : "Revisa la independencia: compara el rango con el número de vectores."}</Verdict>
          )}
          {dimValue === null ? (
            <span>Escribe la dimensión.</span>
          ) : (
            <Verdict tone={dimOk ? "ok" : "warn"}>{dimOk ? "La dimensión es correcta." : "La dimensión no es correcta: es el rango de los vectores."}</Verdict>
          )}
          {"error" in basis ? (
            <span className="text-crit">{basis.error}</span>
          ) : basis.check!.ok ? (
            <Verdict tone="ok">
              <Check size={16} aria-hidden="true" />
              {`Tu base es una base de ${span}.`}
            </Verdict>
          ) : (
            <>
              {basis.check!.inSpan.some((x) => !x) ? (
                <span>{`No están en ${span}: ${basis.check!.inSpan.flatMap((x, k) => (x ? [] : [`el vector ${k + 1} de tu base`])).join(", ")}.`}</span>
              ) : null}
              {!basis.check!.independent ? <span>Los vectores de tu base no son independientes.</span> : null}
              {basis.check!.inSpan.every(Boolean) && basis.check!.independent ? <span>Una base tiene tantos vectores como la dimensión del subespacio.</span> : null}
            </>
          )}
          {solved ? (
            <Verdict tone="ok">
              <Check size={16} aria-hidden="true" />
              ¡Todo correcto!
            </Verdict>
          ) : null}
        </Status>
      ) : null}
      <SolutionGate>
        <IndependenceSolution vectors={vectors} />
      </SolutionGate>
    </PracticeBox>
  );
}

function IndependenceSolution({ vectors }: { vectors: Vector[] }) {
  const R = rref(matrixTranspose(vectors.map((v) => [...v])));
  const idx = spanBasisIndices(vectors);
  const rel = dependenceRelation(vectors);
  const relText = rel
    ? rel
        .map((c, k) => ({ c, k }))
        .filter(({ c }) => !isZero(c))
        .map(({ c, k }, pos) => {
          const negative = c.n < 0n;
          const abs = negative ? neg(c) : c;
          const coef = equals(abs, ONE) ? "" : `${fracText(abs)}·`;
          return `${pos === 0 ? (negative ? "−" : "") : negative ? " − " : " + "}${coef}${vName(k)}`;
        })
        .join("")
    : null;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3 text-[14px]">
      <p>Con los vectores como columnas, la forma escalonada reducida es:</p>
      <MatrixView M={R.matrix} label="Forma escalonada reducida" />
      <p>{`Rango ${R.pivots.length}: dim = ${R.pivots.length}. ${R.pivots.length === vectors.length ? "Son linealmente independientes." : "Son linealmente dependientes."}`}</p>
      <p>{`Una base: ${idx.map((k) => vName(k)).join(", ")} (las columnas pivote).`}</p>
      {relText ? <p className="font-mono">{`Relación de dependencia: ${relText} = 0`}</p> : null}
    </div>
  );
}
