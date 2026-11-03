// «Tensores»: formas (shapes) con las reglas de NumPy. La práctica da las formas de a (y b) y una
// operación (a + b, a @ b, a.sum(axis=k), a.reshape(…), a.T); el estudiante escribe la forma del
// resultado o dice que da un error. Tras acertar se explica la regla eje a eje; si no, la explicación
// queda tras «Ver la solución completa». El comprobador de emisión explica, para dos formas que elige
// el estudiante, qué ejes coinciden y cuáles se repiten.
import { Check } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { broadcastDimText, broadcastShapes, parseShape, shapeEquals, shapeText, tensorOpCode, tensorOpResult, type TensorOp } from "../../../../shared/linalg/tensors.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Input } from "../../../components/ui/input.tsx";
import { cn } from "../../../lib/cn.ts";
import { Hints, PracticeBox, Status, Verdict } from "./common.tsx";

const HINTS: Record<TensorOp["op"], string[]> = {
  suma: [
    "Emisión (broadcasting): alinea las dos formas por la derecha y compara eje a eje.",
    "En cada eje, las longitudes tienen que ser iguales o una de ellas 1 (que se repite). Si a una forma le faltan ejes, se le añaden unos por la izquierda.",
  ],
  matmul: [
    "a @ b multiplica matrices: el último eje de a tiene que coincidir con el penúltimo de b, y ese eje desaparece.",
    "Los ejes de delante (lotes) se emiten como en la suma. Un vector 1-D se trata como fila (a la izquierda) o columna (a la derecha) y ese 1 se quita al final.",
  ],
  sum: [
    "a.sum(axis=k) suma a lo largo del eje k: ese eje desaparece (o se queda con longitud 1 con keepdims=True).",
    "Los ejes se cuentan desde 0; axis=−1 es el último. Sin axis se suma todo y queda un escalar.",
  ],
  reshape: [
    "reshape no cambia el número de elementos: el producto de las longitudes tiene que ser el mismo.",
    "Un −1 deja que NumPy calcule esa longitud: el número de elementos dividido entre el resto.",
  ],
  T: ["a.T invierte el orden de los ejes: (m, n) pasa a (n, m)."],
};

/** Las líneas de Python del enunciado. */
export function tensorStatement(q: TensorOp): string {
  const lines = [`a.shape == ${shapeText(q.a)}`];
  if (q.op === "suma" || q.op === "matmul") lines.push(`b.shape == ${shapeText(q.b)}`);
  lines.push(`(${tensorOpCode(q)}).shape  # ¿?`);
  return lines.join("\n");
}

export function ShapePractice({ q, onSolved }: { q: TensorOp; onSolved?: () => void }) {
  const uid = useId();
  const truth = useMemo(() => tensorOpResult(q), [q]);
  const [claim, setClaim] = useState<"forma" | "error" | null>(null);
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(false);
  const parsed = parseShape(text);
  const ok = claim === "error" ? !truth.ok : claim === "forma" && truth.ok && parsed.ok && shapeEquals(parsed.value, truth.shape);
  const explanation = (
    <ul className="flex flex-col gap-1 text-[14px]">
      {truth.explain.map((line, k) => (
        <li key={k}>{line}</li>
      ))}
    </ul>
  );
  return (
    <PracticeBox title="¿Qué forma tiene el resultado?">
      <pre className="overflow-x-auto rounded-md bg-sunken p-3 font-mono text-[16px]">{tensorStatement(q)}</pre>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[14px] font-semibold">Resultado</legend>
        <label className="flex min-h-11 flex-wrap items-center gap-2">
          <input
            type="radio"
            name={`${uid}-claim`}
            checked={claim === "forma"}
            onChange={() => {
              setClaim("forma");
              setChecked(false);
            }}
          />
          Tiene forma
          <Input
            aria-label="Forma del resultado"
            autoComplete="off"
            spellCheck={false}
            className={cn("w-40 font-mono", checked && claim === "forma" && !ok && "border-crit")}
            placeholder="(2, 3)"
            value={text}
            onFocus={() => setClaim("forma")}
            onChange={(e) => {
              setText(e.target.value.slice(0, 60));
              setClaim("forma");
              setChecked(false);
            }}
          />
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="radio"
            name={`${uid}-claim`}
            checked={claim === "error"}
            onChange={() => {
              setClaim("error");
              setChecked(false);
            }}
          />
          NumPy da un error
        </label>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={() => {
            setChecked(true);
            if (ok) onSolved?.();
          }}
        >
          <Check size={16} aria-hidden="true" />
          Comprobar
        </Button>
        <Hints hints={HINTS[q.op]} />
      </div>
      {checked ? (
        <Status>
          {claim === null ? (
            <span>Escribe la forma o marca que da un error.</span>
          ) : claim === "forma" && !parsed.ok ? (
            <span className="text-crit">{parsed.error}</span>
          ) : ok ? (
            <>
              <Verdict tone="ok">
                <Check size={16} aria-hidden="true" />
                {truth.ok ? `¡Correcto! La forma es ${shapeText(truth.shape)}.` : "¡Correcto! NumPy da un error."}
              </Verdict>
              {explanation}
            </>
          ) : (
            <Verdict tone="warn">{claim === "error" ? "Esta operación sí da un resultado: vuelve a aplicar la regla." : "No es esa forma: vuelve a aplicar la regla eje a eje."}</Verdict>
          )}
        </Status>
      ) : null}
      <SolutionGate resetKey={JSON.stringify(q)}>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
          <p className="font-semibold">{truth.ok ? `Resultado: ${shapeText(truth.shape)}` : "Resultado: error"}</p>
          {explanation}
        </div>
      </SolutionGate>
    </PracticeBox>
  );
}

/** Comprobador de emisión: para dos formas cualesquiera, la tabla eje a eje. */
export function BroadcastChecker() {
  const [aText, setAText] = useState("(8, 1, 6)");
  const [bText, setBText] = useState("(7, 1)");
  const a = parseShape(aText);
  const b = parseShape(bText);
  const r = a.ok && b.ok ? broadcastShapes(a.value, b.value) : null;
  return (
    <PracticeBox title="Comprobador de emisión">
      <p className="text-[14px] text-muted">Escribe dos formas y mira, eje a eje, si se pueden emitir (como en a + b).</p>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-[14px] font-semibold">
          a.shape
          <Input className="w-40 font-mono" autoComplete="off" spellCheck={false} value={aText} onChange={(e) => setAText(e.target.value.slice(0, 60))} />
        </label>
        <label className="flex flex-col gap-1 text-[14px] font-semibold">
          b.shape
          <Input className="w-40 font-mono" autoComplete="off" spellCheck={false} value={bText} onChange={(e) => setBText(e.target.value.slice(0, 60))} />
        </label>
      </div>
      {!a.ok || !b.ok ? (
        <p role="alert" className="text-[14px] text-crit">
          {a.ok ? b.ok ? null : b.error : a.error}
        </p>
      ) : r ? (
        <div className="flex flex-col gap-2" aria-live="polite">
          <div className="max-w-full overflow-x-auto">
            <table className="border-collapse text-center font-mono text-[14px]">
              <caption className="pb-1 text-left font-body">Ejes alineados por la derecha</caption>
              <thead>
                <tr>
                  <th scope="col" className="border border-border bg-sunken px-2 py-1 font-body">
                    Eje
                  </th>
                  <th scope="col" className="border border-border bg-sunken px-2 py-1">
                    a
                  </th>
                  <th scope="col" className="border border-border bg-sunken px-2 py-1">
                    b
                  </th>
                  <th scope="col" className="border border-border bg-sunken px-2 py-1 font-body">
                    Resultado
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.dims.map((d, k) => (
                  <tr key={k}>
                    <th scope="row" className="border border-border px-2 py-1">
                      {String(k - r.dims.length).replace("-", "−")}
                    </th>
                    <td className="border border-border px-2 py-1">{d.a ?? "—"}</td>
                    <td className="border border-border px-2 py-1">{d.b ?? "—"}</td>
                    <td className={cn("border border-border px-2 py-1", d.rule === "incompatible" && "text-crit")}>{d.result ?? "✗"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col gap-1 text-[14px]">
            {r.dims.map((d, k) => (
              <li key={k}>{`Eje ${String(k - r.dims.length).replace("-", "−")}: ${broadcastDimText(d)}`}</li>
            ))}
          </ul>
          <p className="font-semibold">{r.ok ? `a + b tiene forma ${shapeText(r.shape)}.` : "No se pueden emitir: NumPy da un error."}</p>
        </div>
      ) : null}
    </PracticeBox>
  );
}
