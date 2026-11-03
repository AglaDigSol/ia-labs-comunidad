// «Límites y continuidad»: funciones a trozos (límites laterales, continuidad y derivabilidad),
// límites con L'Hôpital, dominio de definición y método de bisección. Cada práctica es un ejercicio
// generado (nivel y «Otro ejercicio»), con el formato del examen, y encima el resumen de las reglas.
import { useState } from "react";
import { CALC_BISECTION, CALC_DOMAIN, CALC_LHOPITAL, CALC_PIECEWISE } from "../../../../shared/exercises/calculus.ts";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { GeneratedPractice } from "../exercises/GeneratedPractice.tsx";
import { BisectionPractice, DomainPractice, LhopitalPractice, PiecewisePractice } from "./TheoryPractice.tsx";

const KINDS = ["trozos", "lhopital", "dominio", "biseccion"] as const;
type Kind = (typeof KINDS)[number];
const LABEL: Record<Kind, string> = { trozos: "Funciones a trozos", lhopital: "L'Hôpital", dominio: "Dominio", biseccion: "Bisección" };

/** Las reglas de cada práctica, como se dan en clase. */
const RULES: Record<Kind, string[]> = {
  trozos: [
    "Límites laterales: lím x→a⁻ usa la fórmula de los x < a; lím x→a⁺, la de los x > a.",
    "Existe lím x→a f(x) si y solo si existen los dos laterales y son iguales.",
    "f es continua en a si existe el límite y vale f(a). Si el límite existe pero no es f(a), la discontinuidad es evitable; si los laterales son distintos, es de salto.",
    "f es derivable en a si es continua y las derivadas laterales coinciden: f′(a⁻) = f′(a⁺). Derivable ⇒ continua, pero no al revés (|x| en 0).",
  ],
  lhopital: [
    "Si al sustituir sale 0/0 o ∞/∞, lím f(x)/g(x) = lím f′(x)/g′(x) (si este existe).",
    "Se derivan numerador y denominador por separado: no es la regla del cociente.",
    "Si vuelve a salir indeterminado, se aplica otra vez. Si no es una indeterminación (por ejemplo 3/0 o 2/5), no se puede aplicar.",
  ],
  dominio: [
    "√u: u ≥ 0. ln u: u > 0. Un cociente: denominador ≠ 0. Polinomios, eˣ, sen y cos: todo ℝ.",
    "El dominio es la intersección de todas las condiciones. Se escribe con intervalos: [ ] incluye el extremo y ( ) no.",
  ],
  biseccion: [
    "Bolzano: f continua en [a, b] y f(a)·f(b) < 0 ⇒ hay una raíz en (a, b).",
    "Cada iteración: m = (a + b)/2 y nos quedamos con [a, m] si f(a)·f(m) < 0 o con [m, b] si no.",
    "Tras k iteraciones el intervalo mide (b − a)/2ᵏ; para que mida menos que ε hace falta k > log₂((b − a)/ε).",
  ],
};

export function LimitsSection() {
  const [kind, setKind] = useState<Kind>("trozos");
  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        type="single"
        value={kind}
        aria-label="Práctica"
        className="grid max-w-full grid-cols-2 self-start sm:inline-flex"
        onValueChange={(v) => {
          const k = KINDS.find((x) => x === v);
          if (k) setKind(k);
        }}
      >
        {KINDS.map((k) => (
          <ToggleGroupItem key={k} value={k}>
            {LABEL[k]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="grid items-start gap-6 lg:grid-cols-12">
        <section aria-label="Reglas" className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-sunken p-3 text-[14px] lg:col-span-4">
          <h2 className="font-display text-[18px] font-semibold">Reglas</h2>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {RULES[kind].map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
        <div className="min-w-0 lg:col-span-8">
          {kind === "trozos" ? (
            <GeneratedPractice type={CALC_PIECEWISE} View={PiecewisePractice} />
          ) : kind === "lhopital" ? (
            <GeneratedPractice type={CALC_LHOPITAL} View={LhopitalPractice} />
          ) : kind === "dominio" ? (
            <GeneratedPractice type={CALC_DOMAIN} View={DomainPractice} />
          ) : (
            <GeneratedPractice type={CALC_BISECTION} View={BisectionPractice} />
          )}
        </div>
      </div>
    </div>
  );
}
