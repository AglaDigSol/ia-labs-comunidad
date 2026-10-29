// Laboratorio de lógica de predicados: «Evaluar en un dominio» (interpretación con casillas, valor de
// un enunciado paso a paso y testigos o contraejemplos), «Negar paso a paso» (leyes de la negación,
// comprobadas en cada línea) y «Traducir» (frases a fórmulas, comparadas en dominios pequeños). El
// dominio y la interpretación se comparten entre secciones; la sección va en la URL (?s=).
import { useState } from "react";
import { useSearchParams } from "react-router";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { DEFAULT_DOMAIN, toInterpretation, type DomainState } from "./DomainEditor.tsx";
import { EvaluateSection } from "./EvaluateSection.tsx";
import { NegateSection } from "./NegateSection.tsx";
import { TranslateSection } from "./TranslateSection.tsx";

const SECTIONS = ["evaluar", "negar", "traducir"] as const;
type Section = (typeof SECTIONS)[number];
const isSection = (x: unknown): x is Section => typeof x === "string" && (SECTIONS as readonly string[]).includes(x);

const INTRO: Record<Section, string> = {
  evaluar: "Define un dominio finito y qué elementos cumplen cada predicado, y decide si una fórmula es verdadera en él.",
  negar: "Niega una fórmula llevando ¬ hacia dentro, una ley cada vez, hasta que solo afecte a fórmulas atómicas.",
  traducir: "Traduce frases en castellano a fórmulas con cuantificadores y comprueba si dicen lo mismo.",
};

export function PredicatesLabPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("s");
  const section: Section = isSection(raw) ? raw : "evaluar";
  const [domain, setDomain] = useState<DomainState>(DEFAULT_DOMAIN);

  const go = (s: Section) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (s === "evaluar") next.delete("s");
        else next.set("s", s);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 tabIndex={-1} className="font-display text-[28px] font-semibold leading-[1.2]">
          Lógica de predicados
        </h1>
        <p className="text-muted">{INTRO[section]}</p>
      </div>
      <ToggleGroup
        type="single"
        value={section}
        aria-label="Sección"
        onValueChange={(v) => {
          if (isSection(v)) go(v);
        }}
        className="grid max-w-full grid-cols-1 self-start sm:inline-flex"
      >
        <ToggleGroupItem value="evaluar" className="py-1 leading-tight">
          Evaluar en un dominio
        </ToggleGroupItem>
        <ToggleGroupItem value="negar" className="py-1 leading-tight">
          Negar paso a paso
        </ToggleGroupItem>
        <ToggleGroupItem value="traducir" className="py-1 leading-tight">
          Traducir
        </ToggleGroupItem>
      </ToggleGroup>
      {section === "evaluar" ? (
        <EvaluateSection domain={domain} onDomain={setDomain} />
      ) : section === "negar" ? (
        <NegateSection interp={toInterpretation(domain)} />
      ) : (
        <TranslateSection />
      )}
    </section>
  );
}
