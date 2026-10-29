// Dominio e interpretación: un dominio de ejemplo o propio (hasta 5 elementos) y la extensión de cada
// predicado, con casillas: una columna por predicado de un argumento y una rejilla x × y por cada
// predicado de dos argumentos.
import { useState } from "react";
import { parseDomain, tupleKey, type PredInterpretation } from "../../../../shared/predicates/evaluate.ts";
import type { DomainPreset } from "../../../../shared/predicates/schema.ts";
import { PREDICADOS_PACK } from "../../../../content/predicados/practica.ts";
import { cn } from "../../../lib/cn.ts";
import { selectClass } from "../boole/AxiomPractice.tsx";
import { MAX_UI_DOMAIN } from "./common.tsx";

export type DomainState = {
  /** Dominio de ejemplo del que se partió (null: propio). */
  presetId: string | null;
  /** Se ha cambiado algo del ejemplo: los significados de los predicados ya no valen. */
  modified: boolean;
  domain: string[];
  /** Extensiones: nombre del predicado → claves de tupla («2», «1,3»). */
  ext: Record<string, string[]>;
};

export function presetState(p: DomainPreset): DomainState {
  return {
    presetId: p.id,
    modified: false,
    domain: [...p.domain],
    ext: Object.fromEntries(p.predicates.map((q) => [q.name, q.extension.map(tupleKey)])),
  };
}

export const DEFAULT_DOMAIN = presetState(PREDICADOS_PACK.domains[0]!);

export const presetOf = (s: DomainState) => PREDICADOS_PACK.domains.find((d) => d.id === s.presetId) ?? null;

export function toInterpretation(s: DomainState): PredInterpretation {
  return {
    domain: s.domain,
    predicates: Object.fromEntries(Object.entries(s.ext).map(([name, keys]) => [name, keys.map((k) => k.split(","))])),
  };
}

/** Clave estable de la interpretación (para reiniciar la práctica cuando cambia). */
export const interpretationKey = (s: DomainState) =>
  `${s.domain.join(",")}|${Object.entries(s.ext)
    .map(([n, k]) => `${n}:${[...k].sort().join(";")}`)
    .sort()
    .join("|")}`;

const cellClass = "h-11 w-11 text-center align-middle";

export function DomainEditor({
  state,
  onChange,
  predicates,
}: {
  state: DomainState;
  onChange: (s: DomainState) => void;
  /** Predicados que hay que poder editar (los de la fórmula o los del ejemplo). */
  predicates: Array<{ name: string; arity: number }>;
}) {
  const [text, setText] = useState(state.domain.join(", "));
  const [error, setError] = useState<string | null>(null);
  const preset = presetOf(state);
  const meaning = (name: string) =>
    preset && !state.modified ? preset.predicates.find((p) => p.name === name)?.meaning ?? null : null;

  const choosePreset = (id: string) => {
    const p = PREDICADOS_PACK.domains.find((d) => d.id === id);
    if (!p) return;
    setText(p.domain.join(", "));
    setError(null);
    onChange(presetState(p));
  };

  const editDomain = (value: string) => {
    setText(value);
    const r = parseDomain(value, MAX_UI_DOMAIN);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setError(null);
    // Se conservan las tuplas cuyos elementos siguen en el dominio.
    const keep = (k: string) => k.split(",").every((e) => r.domain.includes(e));
    const ext = Object.fromEntries(Object.entries(state.ext).map(([n, keys]) => [n, keys.filter(keep)]));
    if (r.domain.join(",") !== state.domain.join(",")) onChange({ ...state, modified: true, domain: r.domain, ext });
  };

  const toggle = (name: string, key: string) => {
    const keys = state.ext[name] ?? [];
    const next = keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key];
    onChange({ ...state, modified: true, ext: { ...state.ext, [name]: next } });
  };
  const has = (name: string, key: string) => (state.ext[name] ?? []).includes(key);

  const unary = predicates.filter((p) => p.arity === 1);
  const binary = predicates.filter((p) => p.arity === 2);
  const others = predicates.filter((p) => p.arity > 2);

  return (
    <section aria-labelledby="pred-domain-title" className="flex flex-col gap-3">
      <h2 id="pred-domain-title" className="font-display text-[20px] font-semibold">
        Dominio e interpretación
      </h2>
      <label htmlFor="pred-preset" className="text-[14px] font-semibold">
        Dominio de ejemplo
      </label>
      <select id="pred-preset" className={cn(selectClass, "w-full font-body")} value={state.presetId ?? ""} onChange={(e) => choosePreset(e.target.value)}>
        {state.presetId === null ? <option value="">Propio</option> : null}
        {PREDICADOS_PACK.domains.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      {preset ? (
        <p className="text-[14px] text-muted">
          {preset.description}
          {state.modified ? " (Lo has modificado.)" : ""}
        </p>
      ) : null}
      <label htmlFor="pred-domain" className="text-[14px] font-semibold">
        Elementos del dominio D
      </label>
      <input
        id="pred-domain"
        type="text"
        value={text}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "pred-domain-error" : "pred-domain-help"}
        onChange={(e) => editDomain(e.target.value)}
        className={cn("h-12 w-full rounded-md border bg-sunken px-3 font-mono text-[16px]", error ? "border-crit" : "border-border")}
      />
      {error ? (
        <p id="pred-domain-error" role="alert" className="text-[14px] text-crit">
          {error}
        </p>
      ) : (
        <p id="pred-domain-help" className="text-[14px] text-muted">
          {`Separados por comas, hasta ${MAX_UI_DOMAIN}: números (1, 2, 3) o letras de la a a la t. Las letras u–z son variables. Los elementos también sirven como constantes en las fórmulas: P(2).`}
        </p>
      )}

      {predicates.length === 0 ? (
        <p className="text-[14px] text-muted">Escribe una fórmula para editar las extensiones de sus predicados.</p>
      ) : null}

      {unary.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-0">
            <caption className="mb-1 text-left text-[14px] font-semibold">Predicados de un argumento: marca los elementos que los cumplen</caption>
            <thead>
              <tr>
                <th scope="col" className="px-2 font-mono font-normal text-muted">
                  x
                </th>
                {unary.map((p) => (
                  <th key={p.name} scope="col" className="px-2 font-mono font-normal">
                    {`${p.name}(x)`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.domain.map((d) => (
                <tr key={d}>
                  <th scope="row" className="px-2 font-mono font-normal">
                    {d}
                  </th>
                  {unary.map((p) => (
                    <td key={p.name} className={cellClass}>
                      <input
                        type="checkbox"
                        aria-label={`${p.name}(${d})`}
                        checked={has(p.name, d)}
                        onChange={() => toggle(p.name, d)}
                        className="h-5 w-5 accent-[var(--accent)]"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="mt-1 text-[14px] text-muted">
            {unary.map((p) => {
              const m = meaning(p.name);
              return m ? <li key={p.name}>{`${p.name}(x): ${m}`}</li> : null;
            })}
          </ul>
        </div>
      ) : null}

      {binary.map((p) => {
        const m = meaning(p.name);
        return (
          <div key={p.name} className="overflow-x-auto">
            <table className="border-separate border-spacing-0">
              <caption className="mb-1 text-left text-[14px] font-semibold">
                {`${p.name}(x, y)${m ? `: ${m}` : ""}. Fila x, columna y`}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="px-2 font-mono font-normal text-muted">
                    x \ y
                  </th>
                  {state.domain.map((y) => (
                    <th key={y} scope="col" className="px-2 font-mono font-normal">
                      {y}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.domain.map((x) => (
                  <tr key={x}>
                    <th scope="row" className="px-2 font-mono font-normal">
                      {x}
                    </th>
                    {state.domain.map((y) => (
                      <td key={y} className={cellClass}>
                        <input
                          type="checkbox"
                          aria-label={`${p.name}(${x}, ${y})`}
                          checked={has(p.name, `${x},${y}`)}
                          onChange={() => toggle(p.name, `${x},${y}`)}
                          className="h-5 w-5 accent-[var(--accent)]"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {others.length > 0 ? (
        <p className="text-[14px] text-warn">
          {`Aquí solo se editan predicados de uno o dos argumentos; ${others.map((p) => p.name).join(", ")} tiene más y se toma vacío.`}
        </p>
      ) : null}
    </section>
  );
}
