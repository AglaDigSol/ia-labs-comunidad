// «Karnaugh y formas canónicas»: se elige una función (un ejercicio de content/boole/karnaugh.ts, una
// expresión, un vector de verdad o un mapa en blanco) y se practica con ella en dos partes: «Σm y ΠM»
// (listas de índices y formas canónicas) y «Mapa de Karnaugh» (agrupar los 1 o los 0). La función se
// guarda en el borrador del laboratorio; las respuestas no.
import { useMemo, useRef, useState } from "react";
import { booleVector, indexListText, vectorFromLists } from "../../../../shared/boole/canonical.ts";
import { booleToPlain, booleToTex, booleVars, parseBoole } from "../../../../shared/boole/expr.ts";
import { KMAP_MAX_VARS, KMAP_MIN_VARS } from "../../../../shared/boole/karnaugh.ts";
import type { KarnaughExercise } from "../../../../shared/boole/schema.ts";
import type { ParseError } from "../../../../shared/logic/parser.ts";
import { KARNAUGH_PACK } from "../../../../content/boole/karnaugh.ts";
import { Button } from "../../../components/ui/button.tsx";
import { Input } from "../../../components/ui/input.tsx";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { FormulaField } from "../logic/FormulaInput.tsx";
import { selectClass } from "./AxiomPractice.tsx";
import { MAX_EXPR, type KmapDraft } from "./boole-storage.ts";
import { CanonicalPractice } from "./CanonicalPractice.tsx";
import { KarnaughPractice } from "./KarnaughPractice.tsx";

export type KarnaughView = "canonicas" | "mapa";
export const isKarnaughView = (x: unknown): x is KarnaughView => x === "canonicas" || x === "mapa";

/** Variables por defecto de un vector o de un mapa en blanco. */
const DEFAULT_VARS: Record<number, string[]> = { 2: ["x", "y"], 3: ["x", "y", "z"], 4: ["w", "x", "y", "z"] };
const BLANKS = [2, 3, 4] as const;

/** Enunciado de un ejercicio: su expresión o «f(x, y, z) = Σm(…) + d(…)». */
export function exerciseText(e: KarnaughExercise): string {
  return "expr" in e ? e.expr : `f(${e.vars.join(", ")}) = ${indexListText("sop", e.ones, e.dontCares)}`;
}

/** Función de un ejercicio, lista para el borrador. */
export function exerciseDraft(e: KarnaughExercise): KmapDraft {
  if ("expr" in e) {
    const r = parseBoole(e.expr);
    // El contenido se valida en tests/content.test.ts: aquí siempre se lee.
    if (!r.ok) throw new Error(`karnaugh: ${e.id} no se lee`);
    const vars = booleVars(r.expr);
    return { choice: e.id, vars, vector: booleVector(r.expr, vars), expr: null };
  }
  return { choice: e.id, vars: e.vars, vector: vectorFromLists(e.vars.length, e.ones, e.dontCares), expr: null };
}

/** Lee un vector escrito: 0, 1, X o - (indiferencia); se ignoran espacios, comas y puntos. */
function readVector(text: string): { ok: true; vector: string; n: number } | { ok: false; message: string } {
  const clean = text.replace(/[\s,;.]/g, "").toUpperCase().replace(/-/g, "X");
  if (!/^[01X]*$/.test(clean)) return { ok: false, message: "Usa solo 0, 1 y X (o - para las indiferencias)." };
  const n = Math.log2(clean.length);
  if (!Number.isInteger(n) || n < KMAP_MIN_VARS || n > KMAP_MAX_VARS) {
    return { ok: false, message: `El vector tiene ${clean.length} valores: tienen que ser 4, 8 o 16 (2, 3 o 4 variables).` };
  }
  return { ok: true, vector: clean, n };
}

export function KarnaughSection({
  view,
  onView,
  kmap,
  onKmap,
}: {
  view: KarnaughView;
  onView: (v: KarnaughView) => void;
  kmap: KmapDraft | null;
  onKmap: (k: KmapDraft) => void;
}) {
  const first = useMemo(() => exerciseDraft(KARNAUGH_PACK.exercises[0]!), []);
  const current = kmap ?? first;
  const [pick, setPick] = useState(current.choice);
  const [expr, setExpr] = useState(current.expr ?? "");
  const [exprError, setExprError] = useState<ParseError | null>(null);
  const [vectorText, setVectorText] = useState(current.choice === "vector" ? current.vector : "");
  const [vectorError, setVectorError] = useState<string | null>(null);
  // Cambia cada vez que se pulsa «Usar esta función»: reinicia la práctica del mapa.
  const [loads, setLoads] = useState(0);
  const exprRef = useRef<HTMLInputElement>(null);

  const use = () => {
    const ex = KARNAUGH_PACK.exercises.find((e) => e.id === pick);
    if (ex) {
      onKmap(exerciseDraft(ex));
    } else if (pick === "expresion") {
      if (expr.length > MAX_EXPR) {
        setExprError({ code: "too-long", start: MAX_EXPR, end: expr.length, message: `Como mucho ${MAX_EXPR} caracteres.` });
        return;
      }
      const r = parseBoole(expr);
      if (!r.ok) {
        setExprError(r.error);
        return;
      }
      const vars = booleVars(r.expr);
      if (vars.length < KMAP_MIN_VARS || vars.length > KMAP_MAX_VARS) {
        setExprError({
          code: "too-long",
          start: 0,
          end: expr.length,
          message: `Usa entre ${KMAP_MIN_VARS} y ${KMAP_MAX_VARS} variables (esta tiene ${vars.length}).`,
        });
        return;
      }
      setExprError(null);
      onKmap({ choice: "expresion", vars, vector: booleVector(r.expr, vars), expr: expr.trim() });
    } else if (pick === "vector") {
      const r = readVector(vectorText);
      if (!r.ok) {
        setVectorError(r.message);
        return;
      }
      setVectorError(null);
      onKmap({ choice: "vector", vars: DEFAULT_VARS[r.n]!, vector: r.vector, expr: null });
    } else if (pick.startsWith("blanco-")) {
      const n = Number(pick.slice(7));
      onKmap({ choice: pick, vars: DEFAULT_VARS[n]!, vector: "0".repeat(1 << n), expr: null });
    } else {
      return;
    }
    setLoads((k) => k + 1);
  };

  const edit = (vector: string) => {
    setPick("mapa");
    onKmap({ choice: "mapa", vars: current.vars, vector, expr: null });
  };

  const ex = KARNAUGH_PACK.exercises.find((e) => e.id === current.choice);
  const fname = `f(${current.vars.join(", ")})`;
  let statement;
  if (ex && "expr" in ex) {
    const r = parseBoole(ex.expr);
    statement = r.ok ? <Tex tex={`${fname} = ${booleToTex(r.expr)}`} label={`${fname} = ${booleToPlain(r.expr)}`} /> : null;
  } else if (ex) {
    statement = <span className="font-mono">{exerciseText(ex)}</span>;
  } else if (current.choice === "expresion" && current.expr) {
    const r = parseBoole(current.expr);
    statement = r.ok ? <Tex tex={`${fname} = ${booleToTex(r.expr)}`} label={`${fname} = ${booleToPlain(r.expr)}`} /> : null;
  } else {
    statement = (
      <span>
        {current.choice === "vector" ? "Vector de verdad de " : "Vector del mapa que has rellenado, "}
        <span className="font-mono">{`${fname}: ${current.vector}`}</span>
      </span>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-5">
        <h2 className="font-display text-[20px] font-semibold">Función</h2>
        <label htmlFor="kmap-choice" className="text-[14px] font-semibold">
          Elige un ejercicio o escribe tu función
        </label>
        <select
          id="kmap-choice"
          className={cn(selectClass, "w-full font-body")}
          value={pick}
          onChange={(e) => {
            setPick(e.target.value);
            setExprError(null);
            setVectorError(null);
          }}
        >
          {(["básico", "medio", "avanzado"] as const).map((level) => (
            <optgroup key={level} label={level[0]!.toUpperCase() + level.slice(1)}>
              {KARNAUGH_PACK.exercises
                .filter((e) => e.level === level)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {exerciseText(e)}
                  </option>
                ))}
            </optgroup>
          ))}
          <optgroup label="La tuya">
            <option value="expresion">Escribir una expresión</option>
            <option value="vector">Escribir el vector de verdad</option>
            {BLANKS.map((n) => (
              <option key={n} value={`blanco-${n}`}>{`Mapa en blanco de ${n} variables`}</option>
            ))}
            {pick === "mapa" ? <option value="mapa">El mapa que has rellenado</option> : null}
          </optgroup>
        </select>
        {pick === "expresion" ? (
          <FormulaField
            id="kmap-expr"
            label="Tu expresión (de 2 a 4 variables)"
            value={expr}
            onChange={(v) => {
              setExpr(v);
              setExprError(null);
            }}
            error={exprError}
            inputRef={exprRef}
            placeholder="x ⊙ y′ ⊕ z"
            notation="boole"
          />
        ) : pick === "vector" ? (
          <div className="flex flex-col gap-1">
            <label htmlFor="kmap-vector" className="text-[14px] font-semibold">
              Vector de verdad (0, 1 o X; 4, 8 o 16 valores)
            </label>
            <Input
              id="kmap-vector"
              value={vectorText}
              onChange={(e) => {
                setVectorText(e.target.value);
                setVectorError(null);
              }}
              placeholder="0110 1X01"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={vectorError !== null}
              aria-describedby={vectorError ? "kmap-vector-error" : undefined}
              className="font-mono"
            />
            {vectorError ? (
              <p id="kmap-vector-error" role="alert" className="text-[14px] text-crit">
                {vectorError}
              </p>
            ) : (
              <p className="text-[14px] text-muted">
                El primer valor es la fila 0…0 y el último la 1…1, con la primera variable como bit alto.
              </p>
            )}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={use} disabled={pick === "mapa"}>
            Usar esta función
          </Button>
        </div>
        <div className="flex flex-col gap-1 rounded-md border border-border bg-raised p-3">
          <p className="text-[14px] text-muted">Función actual</p>
          <div className="max-w-full overflow-x-auto py-1 text-[16px]">{statement}</div>
        </div>
        <details className="text-[14px]">
          <summary className="flex min-h-11 cursor-pointer items-center">Cómo se numeran las filas</summary>
          <p className="pb-2 text-muted">
            Cada fila de la tabla de verdad tiene un índice: su número en binario, con la primera variable como bit
            alto. Con x, y, z, la fila x = 1, y = 0, z = 1 es la 101, es decir, la 5. Ese índice es el del mintérmino m₅
            y el del maxtérmino M₅, y es el número pequeño de cada celda del mapa.
          </p>
        </details>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
        <ToggleGroup
          type="single"
          value={view}
          aria-label="Parte"
          onValueChange={(v) => {
            if (isKarnaughView(v)) onView(v);
          }}
          className="self-start"
        >
          <ToggleGroupItem value="canonicas" className="px-3 py-1 leading-tight">
            Σm y ΠM
          </ToggleGroupItem>
          <ToggleGroupItem value="mapa" className="px-3 py-1 leading-tight">
            Mapa de Karnaugh
          </ToggleGroupItem>
        </ToggleGroup>
        {view === "canonicas" ? (
          <CanonicalPractice vars={current.vars} vector={current.vector} />
        ) : (
          <KarnaughPractice
            key={loads}
            vars={current.vars}
            vector={current.vector}
            onEdit={edit}
            startEditing={current.choice.startsWith("blanco-")}
          />
        )}
      </div>
    </div>
  );
}
