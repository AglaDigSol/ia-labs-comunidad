// «Comprueba tu respuesta» para los axiomas B1–B5: para cada uno marcas «se cumple» o «no se cumple»
// (con un contraejemplo a, b, c). La app corrige y, tras un intento fallido, da pistas progresivas.
import { Check, Lightbulb, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AXIOM_ARITY,
  AXIOM_IDS,
  AXIOM_NAMES,
  IDENTITIES,
  checkAllAxioms,
  counterexampleFor,
  type AxiomId,
  type FiniteStructure,
} from "../../../../shared/boole/algebra.ts";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { cn } from "../../../lib/cn.ts";
import { holdsText, tupleText, violationText } from "./describe.ts";

type Claim = "si" | "no" | null;
type Answer = { claim: Claim; pick: [number, number, number] };
const blank = (): Answer => ({ claim: null, pick: [0, 0, 0] });
const VARS = ["a", "b", "c"] as const;

export const selectClass =
  "min-h-11 rounded-md border border-border bg-raised px-2 font-mono text-[16px] text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function AxiomPractice({ structure: s, resetKey }: { structure: FiniteStructure; resetKey: string }) {
  const results = useMemo(() => checkAllAxioms(s), [s]);
  const [answers, setAnswers] = useState<Record<AxiomId, Answer>>(() => ({
    B1: blank(),
    B2: blank(),
    B3: blank(),
    B4: blank(),
    B5: blank(),
  }));
  const [checked, setChecked] = useState(false);
  const [failed, setFailed] = useState<Partial<Record<AxiomId, boolean>>>({});
  const [hints, setHints] = useState<Partial<Record<AxiomId, number>>>({});
  useEffect(() => {
    setAnswers({ B1: blank(), B2: blank(), B3: blank(), B4: blank(), B5: blank() });
    setChecked(false);
    setFailed({});
    setHints({});
  }, [resetKey]);

  const L = (i: number) => s.elements[i]!;
  const truth = Object.fromEntries(results.map((r) => [r.axiom, r])) as Record<AxiomId, (typeof results)[number]>;

  const verdict = (id: AxiomId) => {
    const a = answers[id];
    const r = truth[id];
    if (a.claim === null) return { ok: false, kind: "missing" as const };
    if (a.claim === "si") return { ok: r.holds, kind: r.holds ? ("right-holds" as const) : ("wrong-holds" as const) };
    const v = counterexampleFor(s, id, ...a.pick);
    if (v) return { ok: true, kind: "right-ce" as const, violation: v };
    return { ok: false, kind: r.holds ? ("wrong-fails" as const) : ("bad-ce" as const) };
  };

  const update = (id: AxiomId, next: Partial<Answer>) => {
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], ...next } }));
    setChecked(false);
  };

  const onCheck = () => {
    setChecked(true);
    setFailed((prev) => {
      const next = { ...prev };
      for (const id of AXIOM_IDS) if (verdict(id).kind === "wrong-holds") next[id] = true;
      return next;
    });
  };

  const hintsFor = (id: AxiomId): string[] => {
    const ce = truth[id].counterexample;
    if (!ce) return [];
    const identity = IDENTITIES[ce.identity];
    if (ce.identity === "B3≠") return [`Revisa ${id}: mira qué elementos hacen de 0 y de 1.`];
    const arity = AXIOM_ARITY[id];
    const list = [`Revisa ${id}: fíjate en la identidad ${identity.text}.`, `Revisa ${id} con a = ${L(ce.a)}.`];
    if (arity > 1) list.push(`Revisa ${id} con ${tupleText(s, arity, ce.a, ce.b, ce.c)}.`);
    return list;
  };

  const all = AXIOM_IDS.map((id) => verdict(id));
  const allRight = checked && all.every((v) => v.ok);
  const isBoole = results.every((r) => r.holds);

  return (
    <section aria-labelledby="axiom-practice-title" className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3">
      <h2 id="axiom-practice-title" className="font-display text-[20px] font-semibold">
        Comprueba tu respuesta
      </h2>
      <p className="text-[14px] text-muted">
        Para cada axioma, decide si se cumple en esta estructura. Si no se cumple, elige un contraejemplo y pulsa
        «Comprobar».
      </p>
      <ol className="flex flex-col gap-3">
        {AXIOM_IDS.map((id, k) => {
          const a = answers[id];
          const v = all[k]!;
          const arity = AXIOM_ARITY[id];
          const level = hints[id] ?? 0;
          const hintList = hintsFor(id);
          return (
            <li key={id} className="flex flex-col gap-2 rounded-md border border-border p-2">
              <fieldset className="flex flex-col gap-2">
                <legend className="text-[16px] font-semibold">{AXIOM_NAMES[id]}</legend>
                <div className="flex flex-wrap gap-x-4">
                  {(["si", "no"] as const).map((c) => (
                    <label key={c} className="flex min-h-11 items-center gap-2">
                      <input
                        type="radio"
                        name={`claim-${id}`}
                        checked={a.claim === c}
                        onChange={() => update(id, { claim: c })}
                      />
                      {c === "si" ? "Se cumple" : "No se cumple"}
                    </label>
                  ))}
                </div>
                {a.claim === "no" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px]">Contraejemplo:</span>
                    {VARS.slice(0, arity).map((name, j) => (
                      <label key={name} className="flex items-center gap-1 font-mono">
                        {name} =
                        <select
                          aria-label={`${id}: elemento ${name}`}
                          className={selectClass}
                          value={a.pick[j]}
                          onChange={(e) => {
                            const pick = [...a.pick] as [number, number, number];
                            pick[j] = Number(e.target.value);
                            update(id, { pick });
                          }}
                        >
                          {s.elements.map((el, i) => (
                            <option key={i} value={i}>
                              {el}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                ) : null}
              </fieldset>
              {checked && v.kind !== "missing" ? (
                <div className="flex flex-col items-start gap-1 text-[14px]" data-testid={`verdict-${id}`}>
                  <span className={cn("inline-flex items-center gap-1 font-semibold", v.ok ? "text-ok" : "text-crit")}>
                    {v.ok ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
                    {v.ok ? "Correcto" : "No es correcto"}
                  </span>
                  {v.kind === "right-ce" && v.violation ? (
                    <span>{`Con ${tupleText(s, arity, ...a.pick)}: ${violationText(s, v.violation)}`}</span>
                  ) : v.kind === "wrong-holds" ? (
                    <span>Hay elementos para los que este axioma falla.</span>
                  ) : v.kind === "wrong-fails" ? (
                    <span>{`Este axioma se cumple: con ${tupleText(s, arity, ...a.pick)}, ${holdsText(s, id, ...a.pick)}.`}</span>
                  ) : v.kind === "bad-ce" ? (
                    <span>{`Con ${tupleText(s, arity, ...a.pick)} se cumple (${holdsText(s, id, ...a.pick)}). Prueba con otros elementos.`}</span>
                  ) : null}
                </div>
              ) : null}
              {failed[id] && hintList.length > 0 ? (
                <div className="flex flex-col items-start gap-1">
                  <Button
                    variant="ghost"
                    disabled={level >= hintList.length}
                    onClick={() => setHints((h) => ({ ...h, [id]: level + 1 }))}
                  >
                    <Lightbulb size={16} aria-hidden="true" />
                    {level === 0 ? `Pista para ${id}` : `Otra pista para ${id}`}
                  </Button>
                  {level > 0 ? (
                    <ol className="list-decimal pl-6 text-[14px]">
                      {hintList.slice(0, level).map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ol>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div>
        <Button variant="primary" onClick={onCheck}>
          Comprobar
        </Button>
      </div>
      {checked ? (
        <div role="status" className="flex flex-col items-start gap-1 text-[14px]">
          {allRight ? (
            <Chip tone="ok">
              <Check size={16} aria-hidden="true" />
              {isBoole
                ? "¡Correcto! Se cumplen B1–B5: es un álgebra de Boole."
                : "¡Correcto! Falla al menos un axioma: no es un álgebra de Boole."}
            </Chip>
          ) : (
            <>
              <Chip tone="warn">{`${all.filter((v) => v.ok).length} de 5 axiomas bien`}</Chip>
              {all.some((v) => v.kind === "missing") ? <span>Marca una respuesta en cada axioma.</span> : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
