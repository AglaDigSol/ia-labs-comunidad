// Laboratorio de probabilidad: «Probabilidad condicionada y Bayes» (árbol de probabilidad total, tabla
// de contingencia 2×2 y condicionada con un dado), «Independencia», «Distribuciones discretas»
// (explorador y práctica con historias), «Valor esperado y juegos» (tabla de un juego, penalización en
// un test y E[XY] con independientes) y «Simulación» (frecuencia relativa con semilla). La app corrige
// con fracciones exactas y da pistas que dicen la regla, nunca el resultado; las soluciones quedan
// detrás de «Ver la solución completa». La sección elegida va en la URL (?s=).
import { useSearchParams } from "react-router";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { ConditionalSection, DistributionsSection, ExpectationSection, IndependenceSection } from "./sections.tsx";
import { SimulationSection } from "./SimulationSection.tsx";

const SECTIONS = ["condicionada", "independencia", "distribuciones", "esperanza", "simulacion"] as const;
type Section = (typeof SECTIONS)[number];
const isSection = (x: unknown): x is Section => typeof x === "string" && (SECTIONS as readonly string[]).includes(x);

const LABELS: Record<Section, string> = {
  condicionada: "Condicionada y Bayes",
  independencia: "Independencia",
  distribuciones: "Distribuciones discretas",
  esperanza: "Valor esperado y juegos",
  simulacion: "Simulación",
};

const INTRO: Record<Section, string> = {
  condicionada: "Completa un árbol de probabilidad (probabilidad total y Bayes), una tabla de contingencia 2×2 y problemas de un dado «sabiendo que…».",
  independencia: "Con P(A), P(B) y un dato más, calcula la unión, la intersección y la condicionada, y decide si A y B son independientes.",
  distribuciones: "Explora Bernoulli, binomial, geométrica, Poisson y uniforme, y practica: qué distribución modela una historia y cuánto valen P(X = k), P(X ≥ k), E[X] y Var(X).",
  esperanza: "Rellena la tabla de un juego con dados o monedas (equilibrados o trucados) y calcula la ganancia esperada; calcula la penalización justa de un test y E[XY] con independientes.",
  simulacion: "Repite un experimento muchas veces y mira cómo la frecuencia relativa se acerca a la probabilidad.",
};

export function ProbabilityLabPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("s");
  const section: Section = isSection(raw) ? raw : "condicionada";

  const go = (s: Section) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (s === "condicionada") next.delete("s");
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
          Probabilidad
        </h1>
        <p className="text-muted">{INTRO[section]}</p>
        <p className="text-[14px] text-muted">
          Notación: P(A | B) es la probabilidad de A sabiendo B; Aᶜ, el complementario; A ∩ B, «A y B»; A ∪ B, «A o B»; E[X], la esperanza y Var(X), la
          varianza. Las respuestas, exactas (3/8) o redondeadas a dos decimales con coma (0,38), como en el examen.
        </p>
      </div>
      <ToggleGroup
        type="single"
        value={section}
        aria-label="Sección"
        onValueChange={(v) => {
          if (isSection(v)) go(v);
        }}
        className="grid max-w-full grid-cols-2 self-start sm:grid-cols-3 xl:inline-flex"
      >
        {SECTIONS.map((s) => (
          <ToggleGroupItem key={s} value={s} className="py-1 leading-tight">
            {LABELS[s]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {section === "independencia" ? (
        <IndependenceSection />
      ) : section === "distribuciones" ? (
        <DistributionsSection />
      ) : section === "esperanza" ? (
        <ExpectationSection />
      ) : section === "simulacion" ? (
        <SimulationSection />
      ) : (
        <ConditionalSection />
      )}
    </section>
  );
}
