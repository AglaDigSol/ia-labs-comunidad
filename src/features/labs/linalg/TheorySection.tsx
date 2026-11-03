// «Propiedades y teoría»: propiedades del determinante, verdadero o falso sobre matrices y vectores,
// normas y clasificación de sistemas, con ejercicios generados y el resumen de las reglas al lado. Y,
// para «Tensores», el vocabulario del curso (rango y dimensión de un tensor frente a ndim y shape de
// NumPy) con su práctica.
import { useState } from "react";
import { LINALG_DET_RULES, LINALG_NORMS, LINALG_ROUCHE_CHOICE, LINALG_TENSOR_VOCAB, LINALG_THEORY } from "../../../../shared/exercises/linalg.ts";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { Tex } from "../../../lib/tex.tsx";
import { GeneratedPractice } from "../exercises/GeneratedPractice.tsx";
import { DetRulesPractice, MatrixTheoryPractice, NormsPractice, RoucheChoicePractice, TensorVocabPractice } from "./TheoryPractice.tsx";

const KINDS = ["determinante", "matrices", "normas", "sistemas"] as const;
type Kind = (typeof KINDS)[number];
const LABEL: Record<Kind, string> = { determinante: "Determinante", matrices: "Matrices: verdadero o falso", normas: "Normas", sistemas: "Sistemas tipo test" };

const RULES: Record<Kind, string[]> = {
  determinante: [
    "det(kA) = kⁿ·det A (A de n×n): el número sale una vez por cada fila.",
    "det(AB) = det A·det B; det(A⁻¹) = 1/det A; det(Aᵀ) = det A; det(Aᵐ) = (det A)ᵐ.",
    "Si A es diagonalizable (o triangular), det A es el producto de sus autovalores.",
    "Con una sola entrada no nula por fila y columna: ± el producto de esas entradas, con el signo de la permutación. La antidiagonal de unos n×n tiene det = (−1)^(n(n−1)/2).",
    "No hay regla para la suma: det(A + B) no es det A + det B.",
  ],
  matrices: [
    "Regular (invertible) ⇔ det A ≠ 0 ⇔ rg A = n ⇔ 0 no es autovalor. Puede no ser diagonalizable y sus autovalores pueden tener cualquier signo.",
    "Simétrica (A = Aᵀ) ⇒ diagonalizable en ℝ con autovalores reales (teorema espectral). En 2×2, det < 0 ⇒ autovalores de distinto signo.",
    "Definida positiva ⇔ todos los autovalores > 0 ⇒ det > 0, traza > 0 y regular.",
    "No regular ⇔ det A = 0 ⇔ rg A < n; entonces A² tampoco es regular y A·x = 0 tiene infinitas soluciones.",
    "Para descartar una afirmación basta un contraejemplo: I, −I, diag(1, 0), (1 1; 0 1).",
  ],
  normas: [
    "‖v‖₁ = Σ|vᵢ|, ‖v‖₂ = √(Σvᵢ²), ‖v‖∞ = máx |vᵢ|; siempre ‖v‖∞ ≤ ‖v‖₂ ≤ ‖v‖₁.",
    "u·v = Σuᵢvᵢ; u y v son ortogonales si u·v = 0. v·v = ‖v‖₂², así que v·v = 0 ⇒ v = 0.",
    "‖k·v‖ = |k|·‖v‖ y ‖u + v‖ ≤ ‖u‖ + ‖v‖ (desigualdad triangular).",
  ],
  sistemas: [
    "Rouché–Frobenius: rg A ≠ rg (A|b) ⇒ incompatible.",
    "rg A = rg (A|b) = n (incógnitas) ⇒ compatible determinado.",
    "rg A = rg (A|b) < n ⇒ compatible indeterminado con n − rg A parámetros.",
  ],
};

export function TheorySection() {
  const [kind, setKind] = useState<Kind>("determinante");
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
          <ToggleGroupItem key={k} value={k} className="py-1 leading-tight">
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
          {kind === "determinante" ? (
            <GeneratedPractice type={LINALG_DET_RULES} View={DetRulesPractice} />
          ) : kind === "matrices" ? (
            <GeneratedPractice type={LINALG_THEORY} View={MatrixTheoryPractice} />
          ) : kind === "normas" ? (
            <GeneratedPractice type={LINALG_NORMS} View={NormsPractice} />
          ) : (
            <GeneratedPractice type={LINALG_ROUCHE_CHOICE} View={RoucheChoicePractice} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Vocabulario de tensores del curso, con la equivalencia en NumPy, y su práctica. */
export function TensorVocabulary() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <section aria-labelledby="tensor-vocab" className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-sunken p-3 text-[14px] lg:col-span-6">
        <h2 id="tensor-vocab" className="font-display text-[18px] font-semibold">
          Vocabulario: rango y dimensión
        </h2>
        <p>
          En la asignatura, un tensor <Tex tex="A \in \mathbb{R}^{5\times 5\times 5\times 5}" label="A en R elevado a 5 por 5 por 5 por 5" /> se llama{" "}
          <strong>tensor de rango 4 y dimensión 5</strong>:
        </p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            <strong>Rango</strong> = número de índices (también se dice orden). En NumPy es <code className="font-mono">A.ndim</code>: aquí, 4.
          </li>
          <li>
            <strong>Dimensión</strong> = cuántos valores toma cada índice. En NumPy, cada número de <code className="font-mono">A.shape</code>: aquí, (5, 5, 5, 5).
          </li>
          <li>Tiene 5⁴ = 625 componentes (A.size). Un escalar es de rango 0, un vector de ℝⁿ de rango 1 y una matriz n×n de rango 2 y dimensión n.</li>
        </ul>
        <p className="rounded-md border border-border bg-raised p-2">
          Ojo: este «rango de un tensor» <strong>no es el rango de una matriz</strong> (rg, el número de filas independientes). Una matriz 3×3 con rg = 1
          sigue siendo un tensor de rango 2 y dimensión 3.
        </p>
        <pre className="overflow-x-auto rounded-md bg-raised p-2 font-mono text-[14px]">{`A = np.zeros((5, 5, 5, 5))
A.ndim   # 4  → rango 4
A.shape  # (5, 5, 5, 5)  → dimensión 5
A.size   # 625 = 5**4`}</pre>
      </section>
      <div className="min-w-0 lg:col-span-6">
        <GeneratedPractice type={LINALG_TENSOR_VOCAB} View={TensorVocabPractice} />
      </div>
    </div>
  );
}
