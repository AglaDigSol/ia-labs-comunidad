// Laboratorio de cálculo: «Derivadas paso a paso» (una regla por línea, comprobada en cada paso),
// «Recta tangente y gráfica», «Integrales» (primitivas comprobadas derivando, integrales definidas y
// sumas de Riemann), «Varias variables» (parciales, gradiente, curvas de nivel y puntos críticos con
// la hessiana) y «Descenso de gradiente» (simulador en una y dos variables y pasos a mano). La app
// corrige y da pistas que dicen la regla, nunca el resultado; las soluciones quedan detrás de «Ver la
// solución completa». La sección elegida va en la URL (?s=).
import { useSearchParams } from "react-router";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { DerivativesSection, DescentSection, IntegralsSection, MultivarSection, TangentSection } from "./sections.tsx";

const SECTIONS = ["derivadas", "tangente", "integrales", "varias-variables", "descenso"] as const;
type Section = (typeof SECTIONS)[number];
const isSection = (x: unknown): x is Section => typeof x === "string" && (SECTIONS as readonly string[]).includes(x);

const LABELS: Record<Section, string> = {
  derivadas: "Derivadas paso a paso",
  tangente: "Recta tangente y gráfica",
  integrales: "Integrales",
  "varias-variables": "Varias variables",
  descenso: "Descenso de gradiente",
};

const INTRO: Record<Section, string> = {
  derivadas: "Deriva aplicando una regla en cada línea (suma, producto, cociente, potencia, cadena…): la app comprueba cada paso y la regla que eliges.",
  tangente: "Mira f y f′ en la misma gráfica, calcula la pendiente en un punto y escribe la recta tangente: se dibuja para que veas si toca la curva.",
  integrales: "Escribe una primitiva (se comprueba derivándola) o calcula una integral definida, y mira cómo las sumas de Riemann se acercan al área.",
  "varias-variables": "Calcula derivadas parciales y el gradiente sobre el mapa de curvas de nivel, y encuentra y clasifica los puntos críticos con la hessiana.",
  descenso: "Simula el descenso de gradiente con distintos α, puntos de partida y métodos, y haz tú a mano los primeros pasos.",
};

export function CalculusLabPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("s");
  const section: Section = isSection(raw) ? raw : "derivadas";

  const go = (s: Section) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (s === "derivadas") next.delete("s");
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
          Cálculo
        </h1>
        <p className="text-muted">{INTRO[section]}</p>
        <p className="text-[14px] text-muted">
          Notación: f′(x) es la derivada; (u)′, una derivada que aún no has hecho; ∂f/∂x, la parcial respecto de x; ∇f = (∂f/∂x, ∂f/∂y), el
          gradiente; H, la hessiana y |H| su determinante; α, la tasa de aprendizaje. Se escribe x^2, 2x, sen(x), e^x, ln(x) y sqrt(x).
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
      {section === "tangente" ? (
        <TangentSection />
      ) : section === "integrales" ? (
        <IntegralsSection />
      ) : section === "varias-variables" ? (
        <MultivarSection />
      ) : section === "descenso" ? (
        <DescentSection />
      ) : (
        <DerivativesSection />
      )}
    </section>
  );
}
