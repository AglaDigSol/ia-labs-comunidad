// Secciones del laboratorio de álgebra lineal que eligen un ejemplo de content/algebra-lineal (o una
// matriz propia) y montan la práctica correspondiente. Cada práctica se vuelve a montar (key) al
// cambiar de ejemplo, así que no arrastra respuestas de otro.
import { useState } from "react";
import { LINALG_PACK } from "../../../../content/algebra-lineal/practica.ts";
import { isSquareMatrix, parseMatrix, type Matrix } from "../../../../shared/linalg/matrix.ts";
import { shapeText, tensorOpCode } from "../../../../shared/linalg/tensors.ts";
import { Button } from "../../../components/ui/button.tsx";
import { Textarea } from "../../../components/ui/textarea.tsx";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { cn } from "../../../lib/cn.ts";
import { selectClass } from "../boole/AxiomPractice.tsx";
import { dimText, HOW_TO_WRITE_MATRIX, levelLabel, LEVELS, MatrixSource, presetMatrix, type Preset } from "./common.tsx";
import { EigenPractice } from "./EigenPractice.tsx";
import { GaussPractice } from "./GaussPractice.tsx";
import { IndependencePractice } from "./IndependencePractice.tsx";
import { DeterminantPractice, InversePractice, ProductPractice, RankPractice } from "./OperationsPractice.tsx";
import { BroadcastChecker, ShapePractice } from "./TensorPractice.tsx";
import { TensorVocabulary } from "./TheorySection.tsx";

/** «(3 1; 5 2)»: la matriz en una línea, para las listas de ejemplos. */
const inline = (text: string) => `(${text.split("\n").join("; ")})`;

/** Estado común: un ejemplo elegido o una matriz propia. */
function useSource(first: string, read: (id: string) => Matrix) {
  const [choice, setChoice] = useState(first);
  const [own, setOwn] = useState<{ M: Matrix; key: string } | null>(null);
  const matrix = choice === "propia" ? (own?.M ?? null) : read(choice);
  const key = choice === "propia" ? `propia|${own?.key ?? ""}` : choice;
  return { choice, setChoice, setOwn, matrix, key };
}

// ---------------------------------------------------------------- Gauss-Jordan

export function GaussSection() {
  const systems = LINALG_PACK.systems;
  const read = (id: string) => presetMatrix(systems.find((s) => s.id === id)!.matrix);
  const src = useSource(systems[0]!.id, read);
  const [augmented, setAugmented] = useState(true);
  const presets: Preset[] = systems.map((s) => ({ id: s.id, label: s.title, level: s.level }));
  const isOwn = src.choice === "propia";
  const unknowns = !isOwn || augmented ? (src.matrix ? src.matrix[0]!.length - 1 : 0) : null;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-4">
        <MatrixSource
          id="gauss-source"
          label="Sistema (matriz ampliada A | b)"
          presets={presets}
          value={src.choice}
          onPreset={src.setChoice}
          onOwn={(M, text) => src.setOwn({ M, key: text })}
          check={(M) => (M[0]!.length < 2 ? "Escribe al menos dos columnas." : null)}
          placeholder={"1 1 5\n2 -1 1"}
        />
        {isOwn ? (
          <label className="flex min-h-11 items-center gap-2 text-[14px]">
            <input type="checkbox" checked={augmented} onChange={(e) => setAugmented(e.target.checked)} />
            La última columna son los términos independientes (b)
          </label>
        ) : null}
        <p className="text-[14px] text-muted">
          Lleva la matriz a la forma escalonada reducida: un pivote 1 en cada fila no nula, con ceros encima y debajo. Luego clasifica el
          sistema con Rouché–Frobenius.
        </p>
      </div>
      <div className="min-w-0 lg:col-span-8">
        {src.matrix ? <GaussPractice key={`${src.key}|${String(augmented)}`} start={src.matrix} unknowns={unknowns} /> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Operaciones

const OPS = ["producto", "determinante", "rango", "inversa"] as const;
type Op = (typeof OPS)[number];
const OP_LABEL: Record<Op, string> = { producto: "Producto", determinante: "Determinante", rango: "Rango", inversa: "Inversa" };

function ProductSource() {
  const products = LINALG_PACK.products;
  const [choice, setChoice] = useState(products[0]!.id);
  const [aText, setAText] = useState("");
  const [bText, setBText] = useState("");
  const [own, setOwn] = useState<{ a: Matrix; b: Matrix; key: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const preset = products.find((p) => p.id === choice);
  const pair = preset ? { a: presetMatrix(preset.a), b: presetMatrix(preset.b), key: preset.id } : own;
  const use = () => {
    const a = parseMatrix(aText);
    const b = parseMatrix(bText);
    if (!a.ok) return setError(`A: ${a.error}`);
    if (!b.ok) return setError(`B: ${b.error}`);
    if (a.value[0]!.length !== b.value.length) {
      return setError(`A es ${dimText(a.value)} y B es ${dimText(b.value)}: para A·B, las columnas de A tienen que ser tantas como las filas de B.`);
    }
    setError(null);
    setOwn({ a: a.value, b: b.value, key: `${aText}|${bText}` });
  };
  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-2 lg:col-span-4">
        <label htmlFor="product-source" className="text-[14px] font-semibold">
          Matrices
        </label>
        <select id="product-source" className={cn(selectClass, "w-full font-body")} value={choice} onChange={(e) => setChoice(e.target.value)}>
          {LEVELS.map((level) => (
            <optgroup key={level} label={levelLabel(level)}>
              {products
                .filter((p) => p.level === level)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {`${inline(p.a)} · ${inline(p.b)}`}
                  </option>
                ))}
            </optgroup>
          ))}
          <option value="propia">Escribir las mías</option>
        </select>
        {choice === "propia" ? (
          <>
            {(
              [
                ["A", aText, setAText],
                ["B", bText, setBText],
              ] as const
            ).map(([name, value, set]) => (
              <label key={name} className="flex flex-col gap-1 text-[14px] font-semibold">
                {name}
                <Textarea className="font-mono" spellCheck={false} value={value} onChange={(e) => set(e.target.value.slice(0, 300))} />
              </label>
            ))}
            <p className="text-[14px] text-muted">{HOW_TO_WRITE_MATRIX}</p>
            {error ? (
              <p role="alert" className="text-[14px] text-crit">
                {error}
              </p>
            ) : null}
            <Button className="self-start" onClick={use}>
              Usar estas matrices
            </Button>
          </>
        ) : null}
      </div>
      <div className="min-w-0 lg:col-span-8">{pair ? <ProductPractice key={pair.key} a={pair.a} b={pair.b} /> : null}</div>
    </div>
  );
}

function SquareSource({ op }: { op: Exclude<Op, "producto"> }) {
  const square = LINALG_PACK.square;
  const read = (id: string) => presetMatrix(square.find((s) => s.id === id)!.matrix);
  const src = useSource(square[0]!.id, read);
  const presets: Preset[] = square.map((s) => ({ id: s.id, label: inline(s.matrix), level: s.level }));
  const Practice = op === "determinante" ? DeterminantPractice : op === "rango" ? RankPractice : InversePractice;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-4">
        <MatrixSource
          id={`${op}-source`}
          label="Matriz A"
          presets={presets}
          value={src.choice}
          onPreset={src.setChoice}
          onOwn={(M, text) => src.setOwn({ M, key: text })}
          check={op === "rango" ? undefined : (M) => (isSquareMatrix(M) ? null : `A es ${dimText(M)}: tiene que ser cuadrada.`)}
        />
      </div>
      <div className="min-w-0 lg:col-span-8">{src.matrix ? <Practice key={`${op}|${src.key}`} a={src.matrix} /> : null}</div>
    </div>
  );
}

export function OperationsSection() {
  const [op, setOp] = useState<Op>("producto");
  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        type="single"
        value={op}
        aria-label="Operación"
        className="grid max-w-full grid-cols-2 self-start sm:inline-flex"
        onValueChange={(v) => {
          const next = OPS.find((x) => x === v);
          if (next) setOp(next);
        }}
      >
        {OPS.map((o) => (
          <ToggleGroupItem key={o} value={o}>
            {OP_LABEL[o]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {op === "producto" ? <ProductSource /> : <SquareSource key={op} op={op} />}
    </div>
  );
}

// ---------------------------------------------------------------- Independencia

export function IndependenceSection() {
  const sets = LINALG_PACK.vectors;
  const read = (id: string) => presetMatrix(sets.find((s) => s.id === id)!.vectors);
  const src = useSource(sets[0]!.id, read);
  const presets: Preset[] = sets.map((s) => ({ id: s.id, label: s.vectors.split("\n").map((v) => `(${v.split(" ").join(", ")})`).join(", "), level: s.level }));
  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-4">
        <MatrixSource
          id="indep-source"
          label="Vectores (uno por línea)"
          presets={presets}
          value={src.choice}
          onPreset={src.setChoice}
          onOwn={(M, text) => src.setOwn({ M, key: text })}
          placeholder={"1 0 2\n2 1 1"}
        />
      </div>
      <div className="min-w-0 lg:col-span-8">{src.matrix ? <IndependencePractice key={src.key} vectors={src.matrix} /> : null}</div>
    </div>
  );
}

// ---------------------------------------------------------------- Autovalores

export function EigenSection() {
  const list = LINALG_PACK.eigen;
  const read = (id: string) => presetMatrix(list.find((s) => s.id === id)!.matrix);
  const src = useSource(list[0]!.id, read);
  const presets: Preset[] = list.map((s) => ({ id: s.id, label: inline(s.matrix), level: s.level }));
  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-4">
        <MatrixSource
          id="eigen-source"
          label="Matriz A"
          presets={presets}
          value={src.choice}
          onPreset={src.setChoice}
          onOwn={(M, text) => src.setOwn({ M, key: text })}
          check={(M) => (!isSquareMatrix(M) ? `A es ${dimText(M)}: tiene que ser cuadrada.` : M.length > 4 ? "Para practicar, como mucho 4×4." : null)}
        />
      </div>
      <div className="min-w-0 lg:col-span-8">{src.matrix ? <EigenPractice key={src.key} a={src.matrix} /> : null}</div>
    </div>
  );
}

// ---------------------------------------------------------------- Tensores

export function TensorSection() {
  const list = LINALG_PACK.tensors;
  const [choice, setChoice] = useState(list[0]!.id);
  const item = list.find((t) => t.id === choice)!;
  const label = (q: (typeof list)[number]["q"]) =>
    `${tensorOpCode(q)} con a ${shapeText(q.a)}${q.op === "suma" || q.op === "matmul" ? ` y b ${shapeText(q.b)}` : ""}`;
  return (
    <div className="flex flex-col gap-6">
      <TensorVocabulary />
      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-3 lg:col-span-6">
          <label htmlFor="tensor-source" className="text-[14px] font-semibold">
            Pregunta
          </label>
          <select id="tensor-source" className={cn(selectClass, "w-full font-body")} value={choice} onChange={(e) => setChoice(e.target.value)}>
            {LEVELS.map((level) => (
              <optgroup key={level} label={levelLabel(level)}>
                {list
                  .filter((t) => t.level === level)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {label(t.q)}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <ShapePractice key={choice} q={item.q} />
        </div>
        <div className="min-w-0 lg:col-span-6">
          <BroadcastChecker />
        </div>
      </div>
    </div>
  );
}
