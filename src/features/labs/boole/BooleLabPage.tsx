// Laboratorio de álgebra de Boole: «¿Es un álgebra de Boole?» (axiomas B1–B5 sobre estructuras
// finitas, tablas y diagrama de Hasse) y «Simplificar paso a paso» (derivaciones con leyes).
// Notación de clase: ⊕ suma, ⊙ producto, ′ complemento. Aquí ⊕ NO es la disyunción exclusiva.
import { useState } from "react";
import { useSearchParams } from "react-router";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { loadBooleDraft, saveBooleDraft, type BooleDraft, type SavedStep } from "./boole-storage.ts";
import { SimplifySection } from "./SimplifySection.tsx";
import { VerifierSection, type VerifierState } from "./VerifierSection.tsx";

type Section = "verificar" | "simplificar";

export function BooleLabPage() {
  const [params, setParams] = useSearchParams();
  const section: Section = params.get("s") === "simplificar" ? "simplificar" : "verificar";
  const [draft, setDraft] = useState<BooleDraft>(loadBooleDraft);

  const update = (next: BooleDraft) => {
    setDraft(next);
    saveBooleDraft(next);
  };

  const onSection = (v: string) => {
    if (v !== "verificar" && v !== "simplificar") return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v === "simplificar") next.set("s", "simplificar");
        else next.delete("s");
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
        <p className="text-muted">
          {section === "simplificar"
            ? "Simplifica una expresión paso a paso: escribe cada línea y la ley que usas, y la app la comprueba."
            : "Elige una estructura finita (B, ⊕, ⊙, ′, 0, 1) y decide qué axiomas B1–B5 cumple."}
        </p>
        <p className="text-[14px] text-muted">Notación: ⊕ es la suma (no el XOR), ⊙ el producto y ′ el complemento.</p>
      </div>
      <ToggleGroup
        type="single"
        value={section}
        aria-label="Sección"
        onValueChange={onSection}
        className="grid max-w-full grid-cols-2 self-start sm:inline-flex"
      >
        <ToggleGroupItem value="verificar" className="py-1 leading-tight">
          ¿Es un álgebra de Boole?
        </ToggleGroupItem>
        <ToggleGroupItem value="simplificar" className="py-1 leading-tight">
          Simplificar paso a paso
        </ToggleGroupItem>
      </ToggleGroup>
      {section === "simplificar" ? (
        <SimplifySection
          start={draft.start}
          steps={draft.steps}
          onChange={(start: string | null, steps: SavedStep[]) => update({ ...draft, start, steps })}
        />
      ) : (
        <VerifierSection state={verifier} onChange={(v) => update({ ...draft, ...v })} />
      )}
    </section>
  );
}
