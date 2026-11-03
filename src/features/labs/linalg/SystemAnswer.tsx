// Clasificar un sistema A·x = b (Rouché–Frobenius) y escribir su solución: única (un número por
// incógnita) o paramétrica (expresiones como 2 − t, con los parámetros que quieras). La app corrige
// la clasificación, los rangos (si se piden) y la solución sin enseñarla: vale cualquier
// parametrización que describa el mismo conjunto de soluciones.
import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { fracText, parseEntry, type Matrix, type Vector } from "../../../../shared/linalg/matrix.ts";
import {
  affineText,
  analyzeSystem,
  checkParametric,
  parseAffine,
  SYSTEM_KIND_LABELS,
  type Affine,
  type SystemAnalysis,
  type SystemKind,
} from "../../../../shared/linalg/systems.ts";
import { equals, ZERO } from "../../../../shared/rational.ts";
import { Button } from "../../../components/ui/button.tsx";
import { Input } from "../../../components/ui/input.tsx";
import { cn } from "../../../lib/cn.ts";
import { Hints, Status, Verdict } from "./common.tsx";

const SUB = "₀₁₂₃₄₅₆₇₈₉";
export const unknownName = (j: number) => `x${[...String(j + 1)].map((d) => SUB[Number(d)]).join("")}`;
const KINDS: SystemKind[] = ["determinado", "indeterminado", "incompatible"];
const PARAMS = ["t", "s", "r", "u"];

const HINTS = [
  "Rouché–Frobenius: si rg A ≠ rg (A|b), el sistema es incompatible; si son iguales y valen el número de incógnitas, es compatible determinado; si son iguales y menores, compatible indeterminado.",
  "En la forma escalonada, rg A es el número de filas no nulas de la parte de A, y rg (A|b) el de filas no nulas de toda la matriz ampliada.",
  "Si es indeterminado, las incógnitas sin pivote son libres: dales un parámetro (t, s…) y despeja las demás de abajo arriba.",
];

/** La solución general como texto: «x₁ = 2 − t, x₂ = t». Para la solución completa. */
export function solutionLines(a: SystemAnalysis): string[] {
  if (a.kind === "incompatible") return [];
  if (a.kind === "determinado") return a.x.map((v, j) => `${unknownName(j)} = ${fracText(v)}`);
  return a.particular.map((p, j) => {
    const coefs = new Map(a.directions.map((d, k) => [PARAMS[k]!, d[j]!] as const).filter(([, c]) => !equals(c, ZERO)));
    return `${unknownName(j)} = ${affineText({ constant: p, coefs }, fracText)}`;
  });
}

/** Rangos, clasificación y solución, para dentro de SolutionGate. */
export function SystemSolution({ analysis: a }: { analysis: SystemAnalysis }) {
  return (
    <div className="flex flex-col gap-2 text-[14px]">
      <p>{`rg A = ${a.rankA}, rg (A|b) = ${a.rankAb}, n = ${a.n} incógnitas.`}</p>
      <p className="font-semibold">
        {a.kind === "incompatible"
          ? "rg A ≠ rg (A|b): sistema incompatible, sin solución."
          : a.kind === "determinado"
            ? "rg A = rg (A|b) = n: sistema compatible determinado, solución única."
            : `rg A = rg (A|b) < n: sistema compatible indeterminado, con ${a.n - a.rankA} ${a.n - a.rankA === 1 ? "parámetro" : "parámetros"}.`}
      </p>
      {solutionLines(a).length > 0 ? <p className="font-mono text-[16px]">{solutionLines(a).join(", ")}</p> : null}
    </div>
  );
}

export function SystemAnswer({
  A,
  b,
  askRanks = false,
  onSolved,
}: {
  A: Matrix;
  b: Vector;
  /** Pedir también rg A y rg (A|b). */
  askRanks?: boolean;
  onSolved?: () => void;
}) {
  const n = A[0]?.length ?? 0;
  const truth = useMemo(() => analyzeSystem(A, b), [A, b]);
  const [kind, setKind] = useState<SystemKind | null>(null);
  const [rankA, setRankA] = useState("");
  const [rankAb, setRankAb] = useState("");
  const [xs, setXs] = useState<string[]>(() => Array.from({ length: n }, () => ""));
  const [checked, setChecked] = useState(false);
  const touch = () => setChecked(false);

  const intOf = (t: string) => (/^\s*\d+\s*$/.test(t) ? Number(t) : null);
  const rankAOk = !askRanks || intOf(rankA) === truth.rankA;
  const rankAbOk = !askRanks || intOf(rankAb) === truth.rankAb;
  const kindOk = kind === truth.kind;

  const solution = useMemo(() => {
    if (!kindOk || kind === "incompatible") return { ok: kindOk, messages: [] as string[], flagged: new Set<number>() };
    if (truth.kind === "determinado") {
      const flagged = new Set<number>();
      let blank = false;
      xs.forEach((t, j) => {
        if (t.trim() === "") blank = true;
        const r = parseEntry(t);
        if (!r.ok || !equals(r.value, truth.x[j]!)) flagged.add(j);
      });
      const messages = blank ? ["Escribe el valor de cada incógnita."] : flagged.size > 0 ? [`${n - flagged.size} de ${n} incógnitas bien.`] : [];
      return { ok: flagged.size === 0, messages, flagged };
    }
    const parsed = xs.map((t) => parseAffine(t));
    const bad = new Set(parsed.flatMap((p, j) => (p.ok ? [] : [j])));
    if (bad.size > 0) {
      return { ok: false, messages: ["Escribe cada incógnita como un número o una expresión con parámetros, como 2 − t o 1/2 + 3s."], flagged: bad };
    }
    const c = checkParametric(
      A,
      b,
      parsed.map((p) => (p as { value: Affine }).value),
    );
    const messages: string[] = [];
    if (!c.particularOk) messages.push("Con todos los parámetros a 0 no sale una solución del sistema: revisa los términos sin parámetro.");
    c.directionsOk.forEach((ok, k) => {
      if (!ok) messages.push(`Los coeficientes de ${c.params[k]} no dan una solución del sistema homogéneo A·x = 0.`);
    });
    if (c.params.length !== c.expectedParams) messages.push("El número de parámetros tiene que ser el número de incógnitas menos rg A.");
    else if (!c.independent) messages.push("Dos parámetros dan la misma dirección: sobra uno.");
    return { ok: c.ok, messages, flagged: new Set<number>() };
  }, [kindOk, kind, truth, xs, n, A, b]);

  const solved = rankAOk && rankAbOk && kindOk && solution.ok;

  return (
    <div className="flex flex-col gap-3">
      {askRanks ? (
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["rg A", rankA, setRankA, rankAOk],
              ["rg (A|b)", rankAb, setRankAb, rankAbOk],
            ] as const
          ).map(([label, value, set, ok]) => (
            <label key={label} className="flex flex-col gap-1 text-[14px] font-semibold">
              {label}
              <Input
                inputMode="numeric"
                autoComplete="off"
                className={cn("w-24 font-mono", checked && !ok && "border-crit")}
                aria-invalid={checked && !ok ? true : undefined}
                value={value}
                onChange={(e) => {
                  set(e.target.value.slice(0, 4));
                  touch();
                }}
              />
            </label>
          ))}
        </div>
      ) : null}
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-[14px] font-semibold">¿Cómo es el sistema?</legend>
        <div className="flex flex-wrap gap-x-4">
          {KINDS.map((k) => (
            <label key={k} className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name={`system-kind-${n}`}
                checked={kind === k}
                onChange={() => {
                  setKind(k);
                  touch();
                }}
              />
              {SYSTEM_KIND_LABELS[k]}
            </label>
          ))}
        </div>
      </fieldset>
      {kind === "determinado" || kind === "indeterminado" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[14px] font-semibold">
            {kind === "determinado" ? "La solución" : "La solución general (con parámetros t, s…)"}
          </legend>
          <div className="flex flex-wrap gap-3">
            {xs.map((t, j) => {
              const bad = checked && solution.flagged.has(j);
              return (
                <label key={j} className="flex items-center gap-2 font-mono text-[16px]">
                  {`${unknownName(j)} =`}
                  <Input
                    autoComplete="off"
                    spellCheck={false}
                    className={cn("font-mono", kind === "determinado" ? "w-24" : "w-40", bad && "border-crit")}
                    aria-invalid={bad ? true : undefined}
                    placeholder={kind === "indeterminado" ? "2 − t" : undefined}
                    value={t}
                    onChange={(e) => {
                      setXs((prev) => prev.map((x, k) => (k === j ? e.target.value.slice(0, 80) : x)));
                      touch();
                    }}
                  />
                </label>
              );
            })}
          </div>
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
          Comprobar la solución
        </Button>
        <Hints hints={HINTS} />
      </div>
      {checked ? (
        <Status>
          {askRanks && !rankAOk ? <Verdict tone="warn">rg A no es correcto.</Verdict> : null}
          {askRanks && !rankAbOk ? <Verdict tone="warn">rg (A|b) no es correcto.</Verdict> : null}
          {kind === null ? (
            <span>Elige cómo es el sistema.</span>
          ) : !kindOk ? (
            <Verdict tone="warn">La clasificación no es correcta: compara rg A, rg (A|b) y el número de incógnitas.</Verdict>
          ) : solved ? (
            <Verdict tone="ok">
              <Check size={16} aria-hidden="true" />
              {kind === "incompatible" ? "¡Correcto! El sistema es incompatible: no tiene solución." : "¡Correcto! La clasificación y la solución están bien."}
            </Verdict>
          ) : (
            <>
              <Verdict tone="ok">{`La clasificación es correcta: ${SYSTEM_KIND_LABELS[kind].toLowerCase()}.`}</Verdict>
              {solution.messages.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </>
          )}
        </Status>
      ) : null}
    </div>
  );
}
