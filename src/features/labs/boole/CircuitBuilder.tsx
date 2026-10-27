// «Función → circuito» (visualizador): escribes una expresión y la app dibuja el circuito que sale de
// su árbol. Con «Solo NAND» o «Solo NOR» lo redibuja con una sola puerta universal y comprueba por
// tabla de verdad que sigue calculando lo mismo. No es un ejercicio evaluable: enseña el resultado.
import { Check, Keyboard, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  circuitFromExpression,
  circuitToPlain,
  circuitToTex,
  circuitTruthTable,
  GATE_NAMES,
  gateCounts,
  toNand,
  toNor,
  type GateType,
  type Netlist,
} from "../../../../shared/boole/circuit.ts";
import { booleToTex, booleVars, evalBoole, parseBoole, type BExpr } from "../../../../shared/boole/expr.ts";
import type { ParseError } from "../../../../shared/logic/parser.ts";
import { MAX_VARIABLES } from "../../../../shared/logic/truth-table.ts";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Tex } from "../../../lib/tex.tsx";
import { FormulaField, SymbolKeypad } from "../logic/FormulaInput.tsx";
import { MAX_EXPR, type BuildMode } from "./boole-storage.ts";
import { CircuitDiagram } from "./CircuitDiagram.tsx";
import { BOOLE_XOR_KEYS } from "./keys.ts";

const MAX_GATES = 60;
const EXAMPLE = "x ⊙ y′ ⊕ (x ⊕ z)′";

/** ¿Calcula el circuito lo mismo que la expresión en todas las filas? */
function sameFunction(e: BExpr, net: Netlist, vars: string[]): boolean {
  const table = circuitTruthTable(net, vars);
  const n = vars.length;
  return table.every((v, m) => v === evalBoole(e, Object.fromEntries(vars.map((x, i) => [x, ((m >> (n - 1 - i)) & 1) === 1]))));
}

const countsText = (net: Netlist) => {
  const c = gateCounts(net);
  const parts = (Object.keys(c) as GateType[]).map((t) => `${c[t]} ${GATE_NAMES[t]}`);
  return parts.length === 0 ? "ninguna puerta" : parts.join(", ");
};

export function CircuitBuilder({
  expr: saved,
  mode,
  onChange,
}: {
  expr: string;
  mode: BuildMode;
  onChange: (expr: string, mode: BuildMode) => void;
}) {
  const [text, setText] = useState(saved || EXAMPLE);
  const [error, setError] = useState<ParseError | null>(null);
  const [keypad, setKeypad] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const drawn = saved || EXAMPLE;
  const parsed = useMemo(() => parseBoole(drawn, { xor: true }), [drawn]);
  const result = useMemo(() => {
    if (!parsed.ok) return null;
    const vars = booleVars(parsed.expr);
    if (vars.length > MAX_VARIABLES) return { tooMany: true as const, vars };
    const basic = circuitFromExpression(parsed.expr);
    const net = mode === "nand" ? toNand(basic) : mode === "nor" ? toNor(basic) : basic;
    return { tooMany: false as const, vars, basic, net, equivalent: sameFunction(parsed.expr, net, vars) };
  }, [parsed, mode]);

  const draw = () => {
    if (text.length > MAX_EXPR) {
      setError({ code: "too-long", start: MAX_EXPR, end: text.length, message: `Como mucho ${MAX_EXPR} caracteres.` });
      return;
    }
    const r = parseBoole(text, { xor: true });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    onChange(text.trim(), mode);
  };

  const modeName = mode === "nand" ? "solo NAND" : mode === "nor" ? "solo NOR" : "puertas básicas";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">
        Escribe una expresión y mira el circuito que la calcula. Es un visualizador: aquí no hay nada que adivinar.
      </p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          draw();
        }}
      >
        <FormulaField
          id="build-expr"
          label="Expresión"
          value={text}
          onChange={(v) => {
            setText(v);
            setError(null);
          }}
          error={error}
          inputRef={inputRef}
          placeholder={EXAMPLE}
          notation="boole"
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" type="submit">
            Dibujar el circuito
          </Button>
          <button
            type="button"
            aria-pressed={keypad}
            onClick={() => setKeypad((k) => !k)}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-raised px-4 text-[14px] font-semibold hover:bg-sunken"
          >
            <Keyboard size={20} strokeWidth={1.75} aria-hidden="true" />
            Teclado de símbolos
          </button>
        </div>
        {keypad ? <SymbolKeypad targetRef={inputRef} onChange={setText} keys={BOOLE_XOR_KEYS} vars={["x", "y", "z", "w"]} moreVars={[]} /> : null}
      </form>

      <ToggleGroup
        type="single"
        value={mode}
        aria-label="Puertas del circuito"
        onValueChange={(v) => {
          if (v === "basicas" || v === "nand" || v === "nor") onChange(drawn, v);
        }}
        className="grid max-w-full grid-cols-3 self-start sm:inline-flex"
      >
        <ToggleGroupItem value="basicas" className="px-3 py-1 leading-tight">
          Puertas básicas
        </ToggleGroupItem>
        <ToggleGroupItem value="nand" className="px-3 py-1 leading-tight">
          Solo NAND
        </ToggleGroupItem>
        <ToggleGroupItem value="nor" className="px-3 py-1 leading-tight">
          Solo NOR
        </ToggleGroupItem>
      </ToggleGroup>

      {!parsed.ok ? (
        <p role="alert" className="text-crit">
          {parsed.error.message}
        </p>
      ) : result?.tooMany ? (
        <p role="alert" className="text-crit">{`Hay ${result.vars.length} variables; el máximo es ${MAX_VARIABLES}.`}</p>
      ) : result && result.net.gates.length > MAX_GATES ? (
        <p role="alert" className="text-warn">{`El circuito ${modeName} tendría ${result.net.gates.length} puertas; solo se dibujan hasta ${MAX_GATES}. Prueba con una expresión más corta.`}</p>
      ) : result ? (
        <div className="flex flex-col gap-3">
          <div className="max-w-full overflow-x-auto py-1 text-[17px]">
            <Tex tex={`f = ${booleToTex(parsed.expr)}`} label={`f = ${drawn}`} />
          </div>
          <CircuitDiagram
            net={result.net}
            label={`Circuito ${modeName} con entradas ${result.vars.join(", ") || "ninguna"}: f = ${circuitToPlain(result.net)}`}
          />
          <p className="text-[14px]">{`${result.net.gates.length} ${result.net.gates.length === 1 ? "puerta" : "puertas"}: ${countsText(result.net)}.`}</p>
          <p role="status" className={result.equivalent ? "flex items-start gap-1 text-[14px] text-ok" : "flex items-start gap-1 text-[14px] text-crit"}>
            {result.equivalent ? <Check size={16} aria-hidden="true" className="mt-1 shrink-0" /> : <X size={16} aria-hidden="true" className="mt-1 shrink-0" />}
            {result.equivalent
              ? `Comprobado por tabla de verdad: el circuito ${modeName} calcula la misma función que la expresión en las ${1 << result.vars.length} filas.`
              : "El circuito no coincide con la expresión (no debería pasar: avísanos con un issue)."}
          </p>
          {mode !== "basicas" ? (
            <p className="text-[14px] text-muted">
              {mode === "nand"
                ? "Con NAND: x′ = (x ⊙ x)′, x ⊙ y = ((x ⊙ y)′)′ y x ⊕ y = (x′ ⊙ y′)′. Los dobles complementos seguidos se cancelan."
                : "Con NOR: x′ = (x ⊕ x)′, x ⊕ y = ((x ⊕ y)′)′ y x ⊙ y = (x′ ⊕ y′)′. Los dobles complementos seguidos se cancelan."}
            </p>
          ) : null}
          <details className="text-[14px]">
            <summary className="flex min-h-11 cursor-pointer items-center">Fórmula leída del circuito</summary>
            <Tex display tex={`f = ${circuitToTex(result.net)}`} label="Fórmula leída del circuito" />
          </details>
        </div>
      ) : null}
    </div>
  );
}
