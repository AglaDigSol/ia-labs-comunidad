// Laboratorio de conjuntos: «Diagrama de Venn» (sombrear regiones y calcular con elementos),
// «Comprobar una igualdad» (demostración con leyes paso a paso y «¿Son iguales?» con contraejemplo),
// «Cardinales e inclusión–exclusión» (problemas de enunciado, región a región) y «Partes y producto
// cartesiano». Notación de clase: ∪, ∩, ∖, Δ, Aᶜ, ∅ y U. La app corrige y da pistas; las soluciones
// quedan detrás de «Ver la solución completa». La sección elegida va en la URL (?s=).
import { useSearchParams } from "react-router";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { CardinalSection } from "./CardinalSection.tsx";
import { LawsSection } from "./LawsSection.tsx";
import { PartsSection } from "./PartsSection.tsx";
import { VennSection } from "./VennSection.tsx";

const SECTIONS = ["venn", "igualdades", "cardinales", "partes"] as const;
type Section = (typeof SECTIONS)[number];
const isSection = (x: unknown): x is Section => typeof x === "string" && (SECTIONS as readonly string[]).includes(x);

const INTRO: Record<Section, string> = {
  venn: "Sombrea en el diagrama de Venn las regiones de una expresión, o calcúlala con conjuntos dados por sus elementos.",
  igualdades: "Demuestra una igualdad de conjuntos aplicando una ley en cada paso, o decide si dos expresiones son iguales.",
  cardinales: "Resuelve problemas de recuento: rellena el diagrama de Venn de dentro hacia fuera con la inclusión–exclusión.",
  partes: "Escribe el conjunto de partes 𝒫(A) o el producto cartesiano A × B, y cuántos elementos tienen.",
};

export function SetsLabPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("s");
  const section: Section = isSection(raw) ? raw : "venn";

  const go = (s: Section) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (s === "venn") next.delete("s");
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
          Conjuntos
        </h1>
        <p className="text-muted">{INTRO[section]}</p>
        <p className="text-[14px] text-muted">
          Notación: ∪ unión, ∩ intersección, ∖ diferencia, Δ diferencia simétrica, Aᶜ complementario, ∅ vacío y U el
          universal.
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
        <ToggleGroupItem value="venn" className="py-1 leading-tight">
          Diagrama de Venn
        </ToggleGroupItem>
        <ToggleGroupItem value="igualdades" className="py-1 leading-tight">
          Comprobar una igualdad
        </ToggleGroupItem>
        <ToggleGroupItem value="cardinales" className="py-1 leading-tight">
          Cardinales e inclusión–exclusión
        </ToggleGroupItem>
        <ToggleGroupItem value="partes" className="py-1 leading-tight">
          Partes y producto cartesiano
        </ToggleGroupItem>
      </ToggleGroup>
      {section === "igualdades" ? (
        <LawsSection />
      ) : section === "cardinales" ? (
        <CardinalSection />
      ) : section === "partes" ? (
        <PartsSection />
      ) : (
        <VennSection />
      )}
    </section>
  );
}
