// «Comprueba tu respuesta» del simulador de Markov: el usuario escribe su vₙ, su π o su u₀ y la app
// lo compara con el resultado exacto (fracciones) sin enseñárselo. Acepta fracciones, decimales con
// coma o punto y redondeos a 4 decimales.
import { Check, Lightbulb, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Mat, Vec } from "../../../../shared/markov/matrix.ts";
import { inverseProblem, stationary } from "../../../../shared/markov/systems.ts";
import { parseNumber, toNumber } from "../../../../shared/rational.ts";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { Input } from "../../../components/ui/input.tsx";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";

type Target = "vn" | "pi" | "u0";

/** Tolerancia: medio diezmilésimo, para aceptar respuestas redondeadas a 4 decimales. */
export const TOLERANCE = 0.00005;

export function closeEnough(text: string, exact: number): boolean | null {
  const p = parseNumber(text);
  if (!p.ok) return null;
  return Math.abs(toNumber(p.value) - exact) <= TOLERANCE;
}

const HINTS: Record<Target, string[]> = {
  vn: [
    "Cada paso es un producto fila por matriz: v₁ = v₀ · P, v₂ = v₁ · P…",
    "La componente j de v₁ es la suma de v₀(i) · P(i, j) para todos los estados i: lo que llega al estado j desde cada estado.",
    "Comprueba al final que tu vector suma 1: si no, hay un error de cuentas.",
  ],
  pi: [
    "π es un vector fila que no cambia al multiplicar por P: π · P = π.",
    "Escribe el sistema (Pᵀ − I) · πᵀ = 0 y sustituye una de las ecuaciones por π₁ + π₂ + … = 1.",
    "Resuélvelo por sustitución o por Gauss; todas las componentes deben ser ≥ 0 y sumar 1.",
  ],
  u0: [
    "Buscas el vector u₀ que, tras un paso, da v: u₀ · P = v.",
    "Si P es invertible, u₀ = v · P⁻¹; si no, plantea el sistema u₀ · P = v.",
    "Revisa el resultado: puede tener componentes negativas, y entonces u₀ no es una distribución de probabilidad.",
  ],
};

export function MarkovPractice({
  names,
  matrix,
  vectors,
  n,
  v,
  onV,
}: {
  names: string[];
  /** Matriz válida (estocástica por filas) o null. */
  matrix: Mat | null;
  /** Vectores v₀…vₙ de la evolución, o null si v₀ no es válido. */
  vectors: Vec[] | null;
  n: number;
  /** Vector v del problema inverso (texto) y su editor. */
  v: string[];
  onV: (j: number, text: string) => void;
}) {
  const [target, setTarget] = useState<Target>("vn");
  const [answer, setAnswer] = useState<Record<Target, string[]>>({ vn: [], pi: [], u0: [] });
  const [checked, setChecked] = useState(false);
  const [hints, setHints] = useState(0);
  const size = names.length;

  const exact = useMemo((): { values: number[] } | { problem: string } => {
    if (!matrix) return { problem: "Primero corrige la matriz P." };
    if (target === "vn") {
      if (!vectors) return { problem: "Primero escribe un v₀ válido (suma 1, sin negativos)." };
      return { values: vectors[n]!.map(toNumber) };
    }
    if (target === "pi") {
      const r = stationary(matrix);
      if (r.kind === "unique") return { values: r.pi.map(toNumber) };
      return { problem: "Esta matriz no tiene una única distribución estacionaria: no hay un π que comprobar." };
    }
    const parsed = v.map((x) => parseNumber(x));
    if (!parsed.every((p) => p.ok)) return { problem: "Escribe primero el vector v." };
    const r = inverseProblem(matrix, parsed.map((p) => (p as { value: Vec[number] }).value));
    if (r.kind === "solved") return { values: r.u0.map(toNumber) };
    return { problem: "P no es invertible: el problema inverso no tiene solución única." };
  }, [matrix, vectors, n, target, v]);

  const mine = Array.from({ length: size }, (_, j) => answer[target][j] ?? "");
  const marks = "values" in exact ? mine.map((t, j) => (t.trim() === "" ? null : closeEnough(t, exact.values[j]!))) : [];
  const allRight = checked && marks.length === size && marks.every((m) => m === true);
  const label = target === "vn" ? `v${toSub(n)}` : target === "pi" ? "π" : "u₀";

  const setCell = (j: number, text: string) => {
    setChecked(false);
    setAnswer((prev) => {
      const row = Array.from({ length: size }, (_, k) => prev[target][k] ?? "");
      row[j] = text.slice(0, 32);
      return { ...prev, [target]: row };
    });
  };

  return (
    <section aria-labelledby="markov-practice-title" className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3">
      <h2 id="markov-practice-title" className="font-display text-[20px] font-semibold">
        Comprueba tu respuesta
      </h2>
      <p className="text-[14px] text-muted">
        Calcula tú el resultado, escríbelo (fracción o decimal, por ejemplo 1/4 o 0,25) y pulsa «Comprobar».
      </p>
      <ToggleGroup
        type="single"
        value={target}
        aria-label="Qué quieres comprobar"
        className="self-start"
        onValueChange={(x) => {
          if (x === "vn" || x === "pi" || x === "u0") {
            setTarget(x);
            setChecked(false);
            setHints(0);
          }
        }}
      >
        <ToggleGroupItem value="vn">{`Evolución v${toSub(n)}`}</ToggleGroupItem>
        <ToggleGroupItem value="pi">Estacionaria π</ToggleGroupItem>
        <ToggleGroupItem value="u0">Inverso u₀</ToggleGroupItem>
      </ToggleGroup>

      {target === "u0" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-[14px] font-semibold">Vector v (resultado tras un paso)</legend>
          <div className="flex flex-wrap gap-2">
            {names.map((nm, j) => (
              <label key={j} className="flex flex-col gap-1 text-[14px]">
                {`v(${j + 1}) · ${nm}`}
                <Input className="mono w-28" inputMode="decimal" value={v[j] ?? ""} onChange={(e) => onV(j, e.target.value)} />
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-[14px] font-semibold">{`Tu ${label}`}</legend>
        <div className="flex flex-wrap gap-2">
          {names.map((nm, j) => (
            <label key={j} className="flex flex-col gap-1 text-[14px]">
              {`${label}(${j + 1}) · ${nm}`}
              <span className="flex items-center gap-1">
                <Input
                  className="mono w-28"
                  inputMode="decimal"
                  autoComplete="off"
                  value={mine[j]}
                  aria-invalid={checked && marks[j] === false ? true : undefined}
                  onChange={(e) => setCell(j, e.target.value)}
                />
                {checked && marks[j] === true ? <Check size={16} aria-label="Correcta" className="text-ok" /> : null}
                {checked && marks[j] === false ? <X size={16} aria-label="Incorrecta" className="text-crit" /> : null}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => setChecked(true)}>
          Comprobar
        </Button>
        <Button variant="ghost" disabled={hints >= HINTS[target].length} onClick={() => setHints((h) => h + 1)}>
          <Lightbulb size={16} aria-hidden="true" />
          {hints === 0 ? "Dame una pista" : "Otra pista"}
        </Button>
      </div>
      {hints > 0 ? (
        <ol className="list-decimal pl-6 text-[14px]">
          {HINTS[target].slice(0, hints).map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ol>
      ) : null}
      {checked ? (
        <div role="status" className="flex flex-col items-start gap-1 text-[14px]">
          {"problem" in exact ? (
            <Chip tone="info">{exact.problem}</Chip>
          ) : allRight ? (
            <Chip tone="ok">
              <Check size={16} aria-hidden="true" />
              {`¡Correcto! Tu ${label} coincide con el resultado exacto.`}
            </Chip>
          ) : (
            <>
              <Chip tone="warn">{`${marks.filter((m) => m === true).length} de ${size} componentes correctas`}</Chip>
              {marks.some((m) => m === null) ? <span>Rellena todas las componentes con un número válido.</span> : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

const SUB = "₀₁₂₃₄₅₆₇₈₉";
function toSub(k: number): string {
  return String(k)
    .split("")
    .map((d) => SUB[Number(d)])
    .join("");
}
