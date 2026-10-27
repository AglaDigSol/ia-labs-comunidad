// Laboratorio de álgebra de Boole: «¿Es un álgebra de Boole?» (axiomas B1–B5 sobre estructuras
// finitas, tablas y diagrama de Hasse), «Simplificar paso a paso» (derivaciones con leyes), «Puertas y
// circuitos» (circuito → función, función → circuito con NAND/NOR y referencia de puertas) y
// «Funciones Fₙ» (F₁ y F₂). Notación de clase: ⊕ suma, ⊙ producto, ′ complemento. Aquí ⊕ NO es la
// disyunción exclusiva (que se escribe ⊻).
import { useState } from "react";
import { useSearchParams } from "react-router";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { loadBooleDraft, saveBooleDraft, type BooleDraft, type SavedStep } from "./boole-storage.ts";
import { CircuitsSection, isCircuitsView, type CircuitsView } from "./CircuitsSection.tsx";
import { FnSection } from "./FnSection.tsx";
import { SimplifySection } from "./SimplifySection.tsx";
import { VerifierSection, type VerifierState } from "./VerifierSection.tsx";

const SECTIONS = ["verificar", "simplificar", "circuitos", "funciones"] as const;
type Section = (typeof SECTIONS)[number];
const isSection = (x: unknown): x is Section => typeof x === "string" && (SECTIONS as readonly string[]).includes(x);

const INTRO: Record<Section, string> = {
  verificar: "Elige una estructura finita (B, ⊕, ⊙, ′, 0, 1) y decide qué axiomas B1–B5 cumple.",
  simplificar: "Simplifica una expresión paso a paso: escribe cada línea y la ley que usas, y la app la comprueba.",
  circuitos: "Lee circuitos de puertas lógicas, escribe la función que calculan y mira cómo se construye uno a partir de una expresión.",
  funciones: "Las funciones booleanas de una y dos variables forman álgebras de Boole con las operaciones punto a punto.",
};

export function BooleLabPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("s");
  const section: Section = isSection(raw) ? raw : "verificar";
  const rawView = params.get("v");
  const view: CircuitsView = isCircuitsView(rawView) ? rawView : "practica";
  const [draft, setDraft] = useState<BooleDraft>(loadBooleDraft);

  const update = (next: BooleDraft) => {
    setDraft(next);
    saveBooleDraft(next);
  };

  const go = (s: Section, v?: CircuitsView) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (s === "verificar") next.delete("s");
        else next.set("s", s);
        if (s === "circuitos" && v && v !== "practica") next.set("v", v);
        else next.delete("v");
        return next;
      },
      { replace: true },
    );
  };

  const verifier: VerifierState = { kind: draft.kind, p1: draft.p1, p2: draft.p2, custom: draft.custom };

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 tabIndex={-1} className="font-display text-[28px] font-semibold leading-[1.2]">
          Álgebra de Boole
        </h1>
        <p className="text-muted">{INTRO[section]}</p>
        <p className="text-[14px] text-muted">
          Notación: ⊕ es la suma (no el XOR), ⊙ el producto y ′ el complemento. El XOR se escribe ⊻.
        </p>
      </div>
      <ToggleGroup
        type="single"
        value={section}
        aria-label="Sección"
        onValueChange={(v) => {
          if (isSection(v)) go(v);
        }}
        className="grid max-w-full grid-cols-2 self-start lg:inline-flex"
      >
        <ToggleGroupItem value="verificar" className="py-1 leading-tight">
          ¿Es un álgebra de Boole?
        </ToggleGroupItem>
        <ToggleGroupItem value="simplificar" className="py-1 leading-tight">
          Simplificar paso a paso
        </ToggleGroupItem>
        <ToggleGroupItem value="circuitos" className="py-1 leading-tight">
          Puertas y circuitos
        </ToggleGroupItem>
        <ToggleGroupItem value="funciones" className="py-1 leading-tight">
          Funciones Fₙ
        </ToggleGroupItem>
      </ToggleGroup>
      {section === "simplificar" ? (
        <SimplifySection
          start={draft.start}
          steps={draft.steps}
          onChange={(start: string | null, steps: SavedStep[]) => update({ ...draft, start, steps })}
        />
      ) : section === "circuitos" ? (
        <CircuitsSection
          view={view}
          onView={(v) => go("circuitos", v)}
          circuit={draft.circuit}
          onCircuit={(circuit) => update({ ...draft, circuit })}
          build={draft.build}
          buildMode={draft.buildMode}
          onBuild={(build, buildMode) => update({ ...draft, build, buildMode })}
        />
      ) : section === "funciones" ? (
        <FnSection
          f2={draft.f2}
          onF2={(f2) => update({ ...draft, f2 })}
          onOpenVerifier={() => {
            update({ ...draft, kind: "f2" });
            go("verificar");
          }}
        />
      ) : (
        <VerifierSection state={verifier} onChange={(v) => update({ ...draft, ...v })} />
      )}
    </section>
  );
}
