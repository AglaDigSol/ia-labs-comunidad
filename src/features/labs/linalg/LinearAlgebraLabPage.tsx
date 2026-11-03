// Laboratorio de álgebra lineal: «Gauss-Jordan paso a paso» (operaciones elementales comprobadas en
// cada paso y clasificación del sistema con Rouché–Frobenius), «Operaciones con matrices» (producto,
// determinante, rango e inversa), «Independencia y bases», «Autovalores y autovectores»,
// «Transformaciones en 2D» (dibujo interactivo y matriz de una transformación descrita) y «Tensores»
// (rango y dimensión de un tensor y formas con las reglas de NumPy) y «Propiedades y teoría»
// (determinantes, verdadero o falso sobre matrices, normas y sistemas tipo test). Todo con racionales exactos. La app corrige y da pistas; las
// soluciones quedan detrás de «Ver la solución completa». La sección elegida va en la URL (?s=).
import { useSearchParams } from "react-router";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { EigenSection, GaussSection, IndependenceSection, OperationsSection, TensorSection } from "./sections.tsx";
import { TheorySection } from "./TheorySection.tsx";
import { TransformSection } from "./TransformSection.tsx";

const SECTIONS = ["gauss", "operaciones", "independencia", "autovalores", "transformaciones", "tensores", "teoria"] as const;
type Section = (typeof SECTIONS)[number];
const isSection = (x: unknown): x is Section => typeof x === "string" && (SECTIONS as readonly string[]).includes(x);

const LABELS: Record<Section, string> = {
  gauss: "Gauss-Jordan paso a paso",
  operaciones: "Operaciones con matrices",
  independencia: "Independencia y bases",
  autovalores: "Autovalores y autovectores",
  transformaciones: "Transformaciones en 2D",
  tensores: "Tensores",
  teoria: "Propiedades y teoría",
};

const INTRO: Record<Section, string> = {
  gauss: "Resuelve un sistema por Gauss-Jordan: aplica una operación elemental en cada paso y la app la comprueba antes de seguir.",
  operaciones: "Calcula productos, determinantes, rangos e inversas y comprueba tu resultado celda a celda.",
  independencia: "Decide si unos vectores son linealmente independientes, la dimensión del subespacio que generan y una base.",
  autovalores: "Encuentra el polinomio característico, los autovalores y un autovector de cada uno, y compruébalos con A·v = λ·v.",
  transformaciones: "Mira qué hace una matriz 2×2 con el plano y escribe la matriz de una transformación descrita en palabras.",
  tensores: "Rango y dimensión de un tensor (con la terminología del curso) y la forma (shape) de un resultado en NumPy: emisión, producto @, sum(axis), reshape y traspuesta.",
  teoria: "Propiedades del determinante, verdadero o falso sobre matrices (regulares, simétricas, definidas positivas, diagonalizables), normas y clasificación de sistemas, con preguntas como las del examen.",
};

export function LinearAlgebraLabPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("s");
  const section: Section = isSection(raw) ? raw : "gauss";

  const go = (s: Section) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (s === "gauss") next.delete("s");
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
          Álgebra lineal
        </h1>
        <p className="text-muted">{INTRO[section]}</p>
        <p className="text-[14px] text-muted">
          Notación: Fᵢ es la fila i; Fᵢ ↔ Fⱼ intercambia filas, Fᵢ ← k·Fᵢ multiplica por k ≠ 0 y Fᵢ ← Fᵢ + k·Fⱼ suma k veces otra fila. rg es
          el rango, |A| el determinante y (A|b) la matriz ampliada. Los números pueden ser fracciones: 3/4, −1/2.
        </p>
      </div>
      <ToggleGroup
        type="single"
        value={section}
        aria-label="Sección"
        onValueChange={(v) => {
          if (isSection(v)) go(v);
        }}
        className="grid max-w-full grid-cols-2 self-start sm:grid-cols-4 xl:grid-cols-7"
      >
        {SECTIONS.map((s) => (
          <ToggleGroupItem key={s} value={s} className="py-1 leading-tight">
            {LABELS[s]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {section === "operaciones" ? (
        <OperationsSection />
      ) : section === "independencia" ? (
        <IndependenceSection />
      ) : section === "autovalores" ? (
        <EigenSection />
      ) : section === "transformaciones" ? (
        <TransformSection />
      ) : section === "tensores" ? (
        <TensorSection />
      ) : section === "teoria" ? (
        <TheorySection />
      ) : (
        <GaussSection />
      )}
    </section>
  );
}
