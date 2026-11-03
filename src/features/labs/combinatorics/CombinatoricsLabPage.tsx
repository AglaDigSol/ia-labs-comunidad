// Laboratorio de combinatoria: «¿Qué fórmula es?» (guía para decidir el modelo y el número, los dos
// comprobados), «Calculadora guiada» (una herramienta aparte de la práctica), «Funciones y cardinales»
// (afirmaciones sobre f: A → B según |A| y |B|) y «Complejidad» (orden O grande de pseudocódigo y de
// costes, y verdadero o falso sobre P y NP). La app corrige y da pistas que dicen la regla, nunca el
// número; las soluciones quedan detrás de «Ver la solución completa». La sección va en la URL (?s=).
import { useSearchParams } from "react-router";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { CalculatorSection } from "./CalculatorSection.tsx";
import { ComplexitySection, FormulaSection, FunctionsSection } from "./sections.tsx";

const SECTIONS = ["formula", "calculadora", "funciones", "complejidad"] as const;
type Section = (typeof SECTIONS)[number];
const isSection = (x: unknown): x is Section => typeof x === "string" && (SECTIONS as readonly string[]).includes(x);

const LABELS: Record<Section, string> = {
  formula: "¿Qué fórmula es?",
  calculadora: "Calculadora guiada",
  funciones: "Funciones y cardinales",
  complejidad: "Complejidad",
};

const INTRO: Record<Section, string> = {
  formula: "Lee el problema, decide si importa el orden y si se repiten los elementos, elige el modelo y calcula el número: la app comprueba las dos cosas.",
  calculadora: "Elige una fórmula y escribe n y k: verás la fórmula con tus datos y su valor exacto, por grande que sea.",
  funciones: "Con |A| y |B|, ¿puede f: A → B ser inyectiva, sobreyectiva o biyectiva? ¿Lo es necesariamente? ¿Cuántas funciones hay?",
  complejidad: "Estima el orden O grande de un fragmento de pseudocódigo o de un coste, y repasa qué significan P, NP y NP-completo.",
};

export function CombinatoricsLabPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("s");
  const section: Section = isSection(raw) ? raw : "formula";

  const go = (s: Section) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (s === "formula") next.delete("s");
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
          Combinatoria
        </h1>
        <p className="text-muted">{INTRO[section]}</p>
        <p className="text-[14px] text-muted">
          Notación: Pₙ = n! son las permutaciones y PRₙ, las permutaciones con repetición; Vₙ,ₖ las variaciones y VRₙ,ₖ con repetición; Cₙ,ₖ las
          combinaciones y CRₙ,ₖ con repetición. O(·) es el orden de complejidad.
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
        {SECTIONS.map((s) => (
          <ToggleGroupItem key={s} value={s} className="py-1 leading-tight">
            {LABELS[s]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {section === "calculadora" ? <CalculatorSection /> : section === "funciones" ? <FunctionsSection /> : section === "complejidad" ? <ComplexitySection /> : <FormulaSection />}
    </section>
  );
}
