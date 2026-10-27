// «¿Es un álgebra de Boole?»: eliges una estructura finita (predefinida, producto o personalizada),
// ves sus tablas y su diagrama de Hasse y compruebas los axiomas B1–B5.
import { Check, X } from "lucide-react";
import { useMemo } from "react";
import {
  AXIOM_ARITY,
  AXIOM_NAMES,
  checkAllAxioms,
  customLabels,
  customStructure,
  defaultCustomTables,
  MAX_CUSTOM_ELEMENTS,
  MAX_ELEMENTS,
  validateStructure,
  type FiniteStructure,
} from "../../../../shared/boole/algebra.ts";
import {
  PRESET_IDS,
  presetStructure,
  productOfPresets,
  type PresetId,
  type StructureKind,
} from "../../../../shared/boole/presets.ts";
import { BOOLE_PACK } from "../../../../content/boole/practica.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { cn } from "../../../lib/cn.ts";
import { AxiomPractice, selectClass } from "./AxiomPractice.tsx";
import type { CustomTables } from "./boole-storage.ts";
import { tupleText, violationText } from "./describe.ts";
import { HasseDiagram } from "./HasseDiagram.tsx";
import { OperationTables } from "./OperationTables.tsx";

export type VerifierState = { kind: StructureKind; p1: PresetId; p2: PresetId; custom: CustomTables | null };

const presetName = (id: PresetId) => BOOLE_PACK.presets[id].name;

function resize(t: CustomTables, n: number): CustomTables {
  if (t.comp.length === n) return t;
  return defaultCustomTables(n);
}

function CustomEditor({ tables, onChange }: { tables: CustomTables; onChange: (t: CustomTables) => void }) {
  const n = tables.comp.length;
  const labels = customLabels(n);
  const setCell = (op: "plus" | "times", a: number, b: number, v: number) =>
    onChange({ ...tables, [op]: tables[op].map((row, i) => (i !== a ? row : row.map((x, j) => (j === b ? v : x)))) });
  const opSelect = (value: number, label: string, set: (v: number) => void) => (
    <select aria-label={label} className={selectClass} value={value} onChange={(e) => set(Number(e.target.value))}>
      {labels.map((l, i) => (
        <option key={i} value={i}>
          {l}
        </option>
      ))}
    </select>
  );
  const grid = (op: "plus" | "times", sym: string) => (
    <div className="max-w-full overflow-x-auto">
      <table className="border-collapse">
        <caption className="pb-1 text-left text-[14px] font-semibold">{`Tabla de ${sym}`}</caption>
        <thead>
          <tr>
            <th scope="col" className="px-1 font-mono">
              {sym}
            </th>
            {labels.map((l) => (
              <th key={l} scope="col" className="px-1 font-mono">
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((la, a) => (
            <tr key={la}>
              <th scope="row" className="px-1 font-mono">
                {la}
              </th>
              {labels.map((lb, b) => (
                <td key={lb} className="p-0.5">
                  {opSelect(tables[op][a]![b]!, `${la} ${sym} ${lb}`, (v) => setCell(op, a, b, v))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-2">
      <label className="flex items-center gap-2 text-[14px] font-semibold">
        Número de elementos
        <select
          className={selectClass}
          value={n}
          onChange={(e) => onChange(resize(tables, Number(e.target.value)))}
        >
          {Array.from({ length: MAX_CUSTOM_ELEMENTS - 1 }, (_, i) => i + 2).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      {grid("plus", "⊕")}
      {grid("times", "⊙")}
      <div className="max-w-full overflow-x-auto">
        <table className="border-collapse">
          <caption className="pb-1 text-left text-[14px] font-semibold">Complemento ′</caption>
          <tbody>
            <tr>
              {labels.map((l, a) => (
                <td key={l} className="p-0.5 text-center">
                  <span className="block font-mono">{`${l}′`}</span>
                  {opSelect(tables.comp[a]!, `complemento de ${l}`, (v) =>
                    onChange({ ...tables, comp: tables.comp.map((x, i) => (i === a ? v : x)) }),
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="self-start text-[14px] text-accent underline underline-offset-4"
        onClick={() => onChange(defaultCustomTables(n))}
      >
        Restablecer las tablas
      </button>
    </div>
  );
}

function buildStructure(st: VerifierState): { s: FiniteStructure | null; error: string | null } {
  if (st.kind === "producto") {
    const s = productOfPresets(st.p1, st.p2);
    if (!s) {
      const n = presetStructure(st.p1).elements.length * presetStructure(st.p2).elements.length;
      return { s: null, error: `El producto tendría ${n} elementos; el máximo es ${MAX_ELEMENTS}. Elige estructuras más pequeñas.` };
    }
    return { s, error: null };
  }
  if (st.kind === "personalizada") {
    const s = customStructure(st.custom ?? defaultCustomTables(4));
    return { s, error: validateStructure(s) };
  }
  return { s: presetStructure(st.kind), error: null };
}

function AxiomSolution({ structure: s }: { structure: FiniteStructure }) {
  const results = checkAllAxioms(s);
  const boole = results.every((r) => r.holds);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
      <h3 className="font-display text-[18px] font-semibold">Solución completa</h3>
      <ul className="flex flex-col gap-1 text-[14px]">
        {results.map((r) => (
          <li key={r.axiom} className="flex items-start gap-2">
            {r.holds ? (
              <Check size={16} aria-hidden="true" className="mt-1 shrink-0 text-ok" />
            ) : (
              <X size={16} aria-hidden="true" className="mt-1 shrink-0 text-crit" />
            )}
            <span>
              <strong>{AXIOM_NAMES[r.axiom]}</strong>
              {r.holds
                ? ": se cumple para todos los elementos."
                : `: no se cumple. Primer contraejemplo, con ${tupleText(s, AXIOM_ARITY[r.axiom], r.counterexample!.a, r.counterexample!.b, r.counterexample!.c)}: ${violationText(s, r.counterexample!)}`}
            </span>
          </li>
        ))}
      </ul>
      <p className="font-semibold">{boole ? `${s.name} es un álgebra de Boole.` : `${s.name} no es un álgebra de Boole.`}</p>
    </div>
  );
}

export function VerifierSection({ state, onChange }: { state: VerifierState; onChange: (s: VerifierState) => void }) {
  const { s, error } = useMemo(() => buildStructure(state), [state]);
  const description =
    state.kind === "producto" ? BOOLE_PACK.product : state.kind === "personalizada" ? BOOLE_PACK.custom : BOOLE_PACK.presets[state.kind].description;
  const resetKey = s ? JSON.stringify([s.name, s.plus, s.times, s.comp, s.zero, s.one]) : "none";

  const presetOptions = PRESET_IDS.map((id) => (
    <option key={id} value={id}>
      {presetName(id)}
    </option>
  ));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-5">
        <label htmlFor="boole-structure" className="text-[14px] font-semibold">
          Estructura (B, ⊕, ⊙, ′, 0, 1)
        </label>
        <select
          id="boole-structure"
          className={cn(selectClass, "w-full font-body")}
          value={state.kind}
          onChange={(e) => onChange({ ...state, kind: e.target.value as StructureKind })}
        >
          <optgroup label="Predefinidas">{presetOptions}</optgroup>
          <optgroup label="Construir">
            <option value="producto">Producto B₁ × B₂</option>
            <option value="personalizada">Personalizada (hasta 4 elementos)</option>
          </optgroup>
        </select>
        <p className="text-[14px] text-muted">{description}</p>
        {state.kind === "producto" ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-[14px] font-semibold">
              B₁
              <select
                className={cn(selectClass, "font-body")}
                value={state.p1}
                onChange={(e) => onChange({ ...state, p1: e.target.value as PresetId })}
              >
                {presetOptions}
              </select>
            </label>
            <span aria-hidden="true">×</span>
            <label className="flex items-center gap-1 text-[14px] font-semibold">
              B₂
              <select
                className={cn(selectClass, "font-body")}
                value={state.p2}
                onChange={(e) => onChange({ ...state, p2: e.target.value as PresetId })}
              >
                {presetOptions}
              </select>
            </label>
          </div>
        ) : null}
        {state.kind === "personalizada" ? (
          <CustomEditor
            tables={state.custom ?? defaultCustomTables(4)}
            onChange={(custom) => onChange({ ...state, custom })}
          />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
        {error || !s ? (
          <p role="alert" className="text-crit">
            {error}
          </p>
        ) : (
          <>
            <h2 className="font-display text-[20px] font-semibold">{`${s.name} · ${s.elements.length} elementos`}</h2>
            <OperationTables structure={s} />
            <HasseDiagram structure={s} />
            <AxiomPractice structure={s} resetKey={resetKey} />
            <SolutionGate resetKey={resetKey}>
              <AxiomSolution structure={s} />
            </SolutionGate>
          </>
        )}
      </div>
    </div>
  );
}
