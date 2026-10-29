// «Σm y ΠM»: la persona escribe la lista de mintérminos Σm(…), la de maxtérminos ΠM(…) y, si quiere,
// las dos formas canónicas, y «Comprobar» corrige cada campo por separado. Dice qué índices sobran
// (los que ha escrito) y cuántos faltan, nunca cuáles. Con indiferencias (X), las X no van en ninguna
// de las dos listas. La tabla con los índices y las formas canónicas quedan detrás de «Ver la solución
// completa». Con notation="logica" (banco de ejercicios) se escriben la FND y la FNC con ¬, ∧ y ∨, y
// la solución usa la misma notación.
import { Check, Lightbulb, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  canonicalProduct,
  canonicalShape,
  canonicalSum,
  compareIndexList,
  indexListText,
  maxtermSum,
  mintermProduct,
  readIndexList,
  rowBits,
  vectorDontCares,
  vectorOnes,
  vectorZeros,
  type IndexListCheck,
} from "../../../../shared/boole/canonical.ts";
import {
  booleToPlain,
  booleToTex,
  booleVars,
  fromLogicNode,
  normalizeBoole,
  parseBoole,
  type BooleParseResult,
} from "../../../../shared/boole/expr.ts";
import { formatFNC, formatFND } from "../../../../shared/logic/canonical.ts";
import { parseFormula, type ParseError } from "../../../../shared/logic/parser.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Input } from "../../../components/ui/input.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { FormulaField } from "../logic/FormulaInput.tsx";
import { MAX_EXPR } from "./boole-storage.ts";

type Kind = "sop" | "pos";
type Verdict = { ok: boolean; text: string } | null;
const cell = "border border-border px-2 py-1 text-center font-mono text-[14px]";

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const sub = (k: number) => [...String(k)].map((d) => SUB[Number(d)]).join("");

/** «Sobran: 4, 6. Te faltan 2 índices.» */
function listVerdict(c: IndexListCheck, kind: Kind): string {
  if (c.ok) return kind === "sop" ? "Σm correcto." : "ΠM correcto.";
  const parts: string[] = [];
  if (c.extra.length > 0) parts.push(`${c.extra.length === 1 ? "Sobra" : "Sobran"}: ${c.extra.join(", ")}.`);
  if (c.dontCares.length > 0) {
    parts.push(
      `${c.dontCares.length === 1 ? `El ${c.dontCares[0]} es una indiferencia (X)` : `${c.dontCares.join(", ")} son indiferencias (X)`}: no van ni en Σm ni en ΠM.`,
    );
  }
  if (c.missing > 0) parts.push(c.missing === 1 ? "Te falta 1 índice." : `Te faltan ${c.missing} índices.`);
  return parts.join(" ");
}

function Result({ verdict, label }: { verdict: Verdict; label: string }) {
  if (!verdict) return null;
  return (
    <p className={cn("flex items-start gap-1 text-[14px]", verdict.ok ? "text-ok" : "text-crit")}>
      {verdict.ok ? <Check size={16} aria-hidden="true" className="mt-0.5 shrink-0" /> : <X size={16} aria-hidden="true" className="mt-0.5 shrink-0" />}
      <span>
        <span className="sr-only">{`${label}: `}</span>
        {verdict.text}
      </span>
    </p>
  );
}

export type CanonicalNotation = "boole" | "logica";

/** Lee una forma normal escrita con ¬, ∧ y ∨ (sin →, ↔ ni ⊻) como expresión de Boole. */
function parseLogicForm(text: string): BooleParseResult {
  const r = parseFormula(text);
  if (!r.ok) return r;
  const e = fromLogicNode(r.ast);
  if (!e) {
    const at = Math.max(0, text.search(/[⊻⊕^→⇒↔⇔≡⊃⟶⟷]|->|<->|=>|<=>|\bxor\b/i));
    return { ok: false, error: { code: "unexpected-token", start: at, end: at + 1, message: "En una forma normal solo se usan ¬, ∧ y ∨." } };
  }
  return { ok: true, expr: normalizeBoole(e), node: r.ast };
}

export function CanonicalPractice({
  vars,
  vector,
  notation = "boole",
  onSolved,
}: {
  vars: string[];
  vector: string;
  /** «boole»: ⊕, ⊙ y ′ (laboratorio de Boole); «logica»: FND y FNC con ¬, ∧ y ∨. */
  notation?: CanonicalNotation;
  /** Se llama al comprobar respuestas correctas: las dos listas (Boole) o las dos formas (lógica), sin ningún error. */
  onSolved?: () => void;
}) {
  const logica = notation === "logica";
  const n = vars.length;
  const ones = useMemo(() => vectorOnes(vector), [vector]);
  const zeros = useMemo(() => vectorZeros(vector), [vector]);
  const dc = useMemo(() => vectorDontCares(vector), [vector]);
  const id = useId();
  const [sigma, setSigma] = useState("");
  const [pi, setPi] = useState("");
  const [sop, setSop] = useState("");
  const [pos, setPos] = useState("");
  const [sopError, setSopError] = useState<ParseError | null>(null);
  const [posError, setPosError] = useState<ParseError | null>(null);
  const [verdicts, setVerdicts] = useState<Record<"sigma" | "pi" | "sop" | "pos", Verdict> | null>(null);
  const [hints, setHints] = useState(0);
  const sopRef = useRef<HTMLInputElement>(null);
  const posRef = useRef<HTMLInputElement>(null);

  // Otra función: se empieza de cero.
  useEffect(() => {
    setSigma("");
    setPi("");
    setSop("");
    setPos("");
    setSopError(null);
    setPosError(null);
    setVerdicts(null);
    setHints(0);
  }, [vector, vars]);

  const checkList = (text: string, kind: Kind): Verdict => {
    if (text.trim() === "") return null;
    const r = readIndexList(text, n);
    if (!r.ok) return { ok: false, text: r.message };
    const c = compareIndexList(r.indices, kind === "sop" ? ones : zeros, dc);
    return { ok: c.ok, text: listVerdict(c, kind) };
  };

  const checkExpr = (text: string, kind: Kind, setError: (e: ParseError | null) => void): Verdict => {
    if (text.trim() === "") {
      setError(null);
      return null;
    }
    if (text.length > MAX_EXPR) {
      setError({ code: "too-long", start: MAX_EXPR, end: text.length, message: `Como mucho ${MAX_EXPR} caracteres.` });
      return null;
    }
    const r = logica ? parseLogicForm(text) : parseBoole(text);
    if (!r.ok) {
      setError(r.error);
      return null;
    }
    const bad = booleVars(r.expr).find((v) => !vars.includes(v));
    if (bad) {
      const at = Math.max(0, text.indexOf(bad));
      setError({ code: "unexpected-token", start: at, end: at + bad.length, message: `Usa solo las variables ${vars.join(", ")} («${bad}» no lo es).` });
      return null;
    }
    setError(null);
    const shape = canonicalShape(r.expr, vars, kind);
    const termName = kind === "sop" ? "mintérmino" : "maxtérmino";
    if (!shape.ok) {
      const texts: Record<typeof shape.reason, string> = {
        "not-two-level": logica
          ? kind === "sop"
            ? "No es una disyunción de conjunciones: escribe mintérminos unidos con ∨."
            : "No es una conjunción de disyunciones: escribe maxtérminos, entre paréntesis, unidos con ∧."
          : kind === "sop"
            ? "No es una suma de productos: escribe mintérminos sumados con ⊕."
            : "No es un producto de sumas: escribe maxtérminos, entre paréntesis, multiplicados con ⊙.",
        "incomplete-term": `Cada ${kind === "sop" ? (logica ? "conjunción" : "producto") : logica ? "disyunción" : "suma"} debe llevar las ${n} variables (${vars.join(", ")}) una sola vez, con o sin ′.`,
        "repeated-term": `Hay un ${termName} repetido.`,
      };
      return { ok: false, text: texts[shape.reason] };
    }
    const c = compareIndexList(shape.indices, kind === "sop" ? ones : zeros, dc);
    if (c.ok) {
      const name = logica ? (kind === "sop" ? "Forma normal disyuntiva" : "Forma normal conjuntiva") : kind === "sop" ? "Forma canónica disyuntiva" : "Forma canónica conjuntiva";
      return { ok: true, text: `${name} correcta.` };
    }
    const wrong = [...c.extra, ...c.dontCares];
    const parts = [logica ? "Tiene forma normal, pero no es la de φ." : "Tiene forma canónica, pero no es la de f."];
    const sym = kind === "sop" ? "m" : "M";
    if (wrong.length > 0) parts.push(`${wrong.length === 1 ? `Sobra ${sym}${sub(wrong[0]!)}` : `Sobran ${wrong.map((k) => sym + sub(k)).join(", ")}`}.`);
    if (c.missing > 0) parts.push(c.missing === 1 ? `Te falta 1 ${termName}.` : `Te faltan ${c.missing} ${termName}s.`);
    return { ok: false, text: parts.join(" ") };
  };

  const check = () => {
    const next = {
      sigma: checkList(sigma, "sop"),
      pi: checkList(pi, "pos"),
      sop: checkExpr(sop, "sop", setSopError),
      pos: checkExpr(pos, "pos", setPosError),
    };
    setVerdicts(next);
    const main = logica ? [next.sop, next.pos] : [next.sigma, next.pi];
    const noErrors = Object.values(next).every((v) => v === null || v.ok);
    if (noErrors && main.every((v) => v?.ok)) onSolved?.();
  };

  const answered = verdicts ? Object.values(verdicts).filter((v) => v !== null) : [];
  const allRight = answered.length > 0 && answered.every((v) => v!.ok);
  const listsRight = verdicts?.sigma?.ok && verdicts.pi?.ok;

  const ex = n === 2 ? 1 : 5;
  const hintList = [
    `Calcula f en cada fila, de ${"0".repeat(n)} a ${"1".repeat(n)}: el índice de una fila es su número en binario, con ${vars[0]} como bit más alto (por ejemplo, ${rowBits(n, ex)} es la fila ${ex}).`,
    `Los índices en los que f vale 1 van en Σm y en los que vale 0, en ΠM: entre las dos listas están todos los índices de 0 a ${(1 << n) - 1}, una sola vez.${dc.length > 0 ? " Las X no van en ninguna." : ""}`,
    logica
      ? `En el mintérmino mᵢ cada variable va tal cual si su bit es 1 y negada si es 0, unidas con ∧; en el maxtérmino Mᵢ es al revés y se unen con ∨: m${sub(ex)} = ${formatFND(vars, [ex], "logica").plain} y M${sub(ex)} = ${formatFNC(vars, [ex], "logica").plain}.`
      : `En el mintérmino mᵢ cada variable va tal cual si su bit es 1 y con ′ si es 0, y se multiplican; en el maxtérmino Mᵢ es al revés y se suman: m${sub(ex)} = ${booleToPlain(mintermProduct(vars, ex))} y M${sub(ex)} = ${booleToPlain(maxtermSum(vars, ex))}.`,
  ];
  const fnd = formatFND(vars, ones, "logica");
  const fnc = formatFNC(vars, zeros, "logica");

  const canonicalSop = canonicalSum(vars, ones);
  const canonicalPos = canonicalProduct(vars, zeros);

  return (
    <section aria-labelledby="canonical-practice-title" className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3">
      <h2 id="canonical-practice-title" className="font-display text-[20px] font-semibold">
        {logica ? "Comprueba tu respuesta: FND y FNC" : "Comprueba tu respuesta: Σm y ΠM"}
      </h2>
      <p className="text-[14px] text-muted">
        {logica
          ? `Escribe la forma normal disyuntiva (FND) y la conjuntiva (FNC) con ¬, ∧ y ∨ usando ${vars.join(", ")}, con cada variable una vez en cada término. Los índices Σm(…) y ΠM(…) te ayudan a llegar a ellas.`
          : `Escribe los índices separados por comas (por ejemplo, Σm(1, 3, 5)). Las formas canónicas son opcionales: escríbelas con ⊕, ⊙ y ′ usando ${vars.join(", ")}.${dc.length > 0 ? " Esta función tiene indiferencias (X): no van ni en Σm ni en ΠM." : ""}`}
      </p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-sigma`} className="text-[14px] font-semibold">
            Mintérminos: Σm(…)
          </label>
          <Input
            id={`${id}-sigma`}
            value={sigma}
            onChange={(e) => setSigma(e.target.value)}
            placeholder="Σm(1, 3, 5)"
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
          <Result verdict={verdicts?.sigma ?? null} label="Σm" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-pi`} className="text-[14px] font-semibold">
            Maxtérminos: ΠM(…)
          </label>
          <Input
            id={`${id}-pi`}
            value={pi}
            onChange={(e) => setPi(e.target.value)}
            placeholder="ΠM(0, 2, 4)"
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
          <Result verdict={verdicts?.pi ?? null} label="ΠM" />
        </div>
        {logica ? (
          <div className="flex flex-col gap-3">
            <p className="text-[14px] font-semibold">Formas normales</p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <FormulaField
                id={`${id}-sop`}
                label={logica ? "Forma normal disyuntiva (FND): φ ≡" : "Suma de mintérminos: f ="}
                value={sop}
                onChange={(t) => {
                  setSop(t);
                  setSopError(null);
                }}
                error={sopError}
                inputRef={sopRef}
                placeholder={logica ? "(¬p ∧ q) ∨ (p ∧ ¬q)" : "x′ ⊙ y ⊙ z ⊕ x ⊙ y′ ⊙ z"}
                notation={notation}
              />
              <Result verdict={verdicts?.sop ?? null} label={logica ? "FND" : "Suma de mintérminos"} />
            </div>
            <div className="flex flex-col gap-1">
              <FormulaField
                id={`${id}-pos`}
                label={logica ? "Forma normal conjuntiva (FNC): φ ≡" : "Producto de maxtérminos: f ="}
                value={pos}
                onChange={(t) => {
                  setPos(t);
                  setPosError(null);
                }}
                error={posError}
                inputRef={posRef}
                placeholder={logica ? "(p ∨ q) ∧ (¬p ∨ ¬q)" : "(x ⊕ y ⊕ z) ⊙ (x′ ⊕ y ⊕ z)"}
                notation={notation}
              />
              <Result verdict={verdicts?.pos ?? null} label={logica ? "FNC" : "Producto de maxtérminos"} />
            </div>
          </div>
          </div>
        ) : (
          <details className="flex flex-col gap-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-[14px] font-semibold">
              Formas canónicas (opcional)
            </summary>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <FormulaField
                id={`${id}-sop`}
                label={logica ? "Forma normal disyuntiva (FND): φ ≡" : "Suma de mintérminos: f ="}
                value={sop}
                onChange={(t) => {
                  setSop(t);
                  setSopError(null);
                }}
                error={sopError}
                inputRef={sopRef}
                placeholder={logica ? "(¬p ∧ q) ∨ (p ∧ ¬q)" : "x′ ⊙ y ⊙ z ⊕ x ⊙ y′ ⊙ z"}
                notation={notation}
              />
              <Result verdict={verdicts?.sop ?? null} label={logica ? "FND" : "Suma de mintérminos"} />
            </div>
            <div className="flex flex-col gap-1">
              <FormulaField
                id={`${id}-pos`}
                label={logica ? "Forma normal conjuntiva (FNC): φ ≡" : "Producto de maxtérminos: f ="}
                value={pos}
                onChange={(t) => {
                  setPos(t);
                  setPosError(null);
                }}
                error={posError}
                inputRef={posRef}
                placeholder={logica ? "(p ∨ q) ∧ (¬p ∨ ¬q)" : "(x ⊕ y ⊕ z) ⊙ (x′ ⊕ y ⊕ z)"}
                notation={notation}
              />
              <Result verdict={verdicts?.pos ?? null} label={logica ? "FNC" : "Producto de maxtérminos"} />
            </div>
          </div>
          </details>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" type="submit">
            <Check size={16} aria-hidden="true" />
            Comprobar
          </Button>
          <Button variant="ghost" disabled={hints >= hintList.length} onClick={() => setHints((h) => h + 1)}>
            <Lightbulb size={16} aria-hidden="true" />
            {hints === 0 ? "Dame una pista" : "Otra pista"}
          </Button>
        </div>
      </form>
      {hints > 0 ? (
        <ol className="list-decimal pl-6 text-[14px]">
          {hintList.slice(0, hints).map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ol>
      ) : null}
      <div role="status" className="text-[14px]">
        {verdicts === null ? null : answered.length === 0 ? (
          <p>Escribe al menos una de las respuestas.</p>
        ) : allRight ? (
          <p className="font-semibold text-ok">
            {listsRight && answered.length === 4
              ? "¡Correcto! Las dos listas y las dos formas canónicas."
              : `¡Correcto! ${answered.length === 1 ? "Tu respuesta está bien" : `Tus ${answered.length} respuestas están bien`}.`}
          </p>
        ) : (
          <p className="font-semibold text-warn">{`${answered.filter((v) => v!.ok).length} de ${answered.length} respuestas correctas.`}</p>
        )}
      </div>

      <SolutionGate resetKey={`${vars.join(",")}|${vector}`}>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
          <h3 className="font-display text-[18px] font-semibold">{logica ? "Formas normales" : "Formas canónicas"}</h3>
          <div className="max-w-full overflow-x-auto">
            <table className="border-collapse">
              <caption className="sr-only">{`Tabla de verdad de f(${vars.join(", ")}) con los índices`}</caption>
              <thead>
                <tr>
                  <th scope="col" className={`${cell} bg-sunken`}>
                    i
                  </th>
                  {vars.map((v) => (
                    <th key={v} scope="col" className={`${cell} bg-sunken`}>
                      {v}
                    </th>
                  ))}
                  <th scope="col" className={`${cell} bg-sunken`}>
                    f
                  </th>
                  <th scope="col" className={`${cell} bg-sunken font-body`}>
                    Término
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...vector].map((f, m) => (
                  <tr key={m}>
                    <th scope="row" className={cell}>
                      {m}
                    </th>
                    {[...rowBits(n, m)].map((b, i) => (
                      <td key={i} className={cell}>
                        {b}
                      </td>
                    ))}
                    <td className={`${cell} font-semibold`}>{f}</td>
                    <td className={`${cell} whitespace-nowrap text-left`}>
                      {f === "X"
                        ? "indiferencia"
                        : f === "1"
                          ? `m${sub(m)} = ${logica ? formatFND(vars, [m], "logica").plain : booleToPlain(mintermProduct(vars, m))}`
                          : `M${sub(m)} = ${logica ? formatFNC(vars, [m], "logica").plain : booleToPlain(maxtermSum(vars, m))}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="font-mono text-[16px]">{`f = ${indexListText("sop", ones, dc)}`}</p>
          <p className="font-mono text-[16px]">{`f = ${indexListText("pos", zeros, dc)}`}</p>
          {logica ? (
            <>
              <p className="text-[14px] font-semibold">Forma normal disyuntiva (FND):</p>
              <div className="max-w-full overflow-x-auto">
                <Tex display tex={`\\varphi \\equiv ${fnd.tex}`} label={`FND: ${fnd.plain}`} />
              </div>
              <p className="text-[14px] font-semibold">Forma normal conjuntiva (FNC):</p>
              <div className="max-w-full overflow-x-auto">
                <Tex display tex={`\\varphi \\equiv ${fnc.tex}`} label={`FNC: ${fnc.plain}`} />
              </div>
            </>
          ) : (
            <>
              <p className="text-[14px] font-semibold">Suma de mintérminos:</p>
              <div className="max-w-full overflow-x-auto">
                <Tex display tex={`f = ${booleToTex(canonicalSop)}`} label={`Suma de mintérminos: f = ${booleToPlain(canonicalSop)}`} />
              </div>
              <p className="text-[14px] font-semibold">Producto de maxtérminos:</p>
              <div className="max-w-full overflow-x-auto">
                <Tex display tex={`f = ${booleToTex(canonicalPos)}`} label={`Producto de maxtérminos: f = ${booleToPlain(canonicalPos)}`} />
              </div>
            </>
          )}
        </div>
      </SolutionGate>
    </section>
  );
}
