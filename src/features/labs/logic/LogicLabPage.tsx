import {
  Ban,
  CheckCircle2,
  GitBranch,
  GraduationCap,
  Info,
  Keyboard,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toPlain, toTex, type Node } from "../../../../shared/logic/ast.ts";
import {
  MAX_FORMULA_LENGTH,
  parseFormula,
  type ParseError,
} from "../../../../shared/logic/parser.ts";
import {
  buildTable,
  classify,
  MAX_VARIABLES,
  type Table,
} from "../../../../shared/logic/truth-table.ts";
import { NOTATION } from "../../../../content/notation/index.ts";
import { Chip } from "../../../components/ui/chip.tsx";
import { Switch } from "../../../components/ui/switch.tsx";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../../../components/ui/toggle-group.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { CompareMode } from "./CompareMode.tsx";
import { F1Explorer } from "./F1Explorer.tsx";
import { FormulaField, SymbolKeypad } from "./FormulaInput.tsx";
import { NormalForms } from "./NormalForms.tsx";
import { TruthTable, type TruthFormat } from "./TruthTable.tsx";

const FORMAT_KEY = "ia-labs.logic-format";
const EXAMPLES = ["p → q", "¬(p ∧ q)", "(p → q) ↔ (¬q → ¬p)"];
const DEBOUNCE_MS = 400;

function readFormat(vParam: string | null): TruthFormat {
  if (vParam === "vf") return "VF";
  if (vParam === "01") return "10";
  try {
    const stored = localStorage.getItem(FORMAT_KEY);
    if (stored === "10" || stored === "VF") return stored;
  } catch {
    // storage unavailable: use the default
  }
  return NOTATION.truthValues;
}

const VERDICT = {
  tautologia: { label: "Tautología", tone: "ok", Icon: ShieldCheck },
  contradiccion: { label: "Contradicción", tone: "crit", Icon: Ban },
  contingencia: { label: "Contingencia", tone: "warn", Icon: GitBranch },
} as const;

function AcademicLogicCheck({
  kind,
  trueCount,
  total,
  ast,
}: {
  kind: "tautologia" | "contradiccion" | "contingencia";
  trueCount: number;
  total: number;
  ast: Node;
}) {
  const [selected, setSelected] = useState<
    "tautologia" | "contradiccion" | "contingencia" | null
  >(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setSelected(null);
    setChecked(false);
  }, [ast]);

  const isCorrect = selected === kind;

  const hint = useMemo(() => {
    if (!checked || isCorrect) return null;
    if (kind === "tautologia") {
      return "Pista: Intenta buscar si alguna asignación produce Falso (0). Si en todos los casos la fórmula es Verdadera, es una tautología.";
    }
    if (kind === "contradiccion") {
      return "Pista: Intenta buscar si alguna asignación produce Verdadero (1). Si no es posible hacerla verdadera, es una contradicción.";
    }
    return "Pista: Evalúa interpretaciones con valores opuestos. Si el resultado cambia según las variables, es una contingencia.";
  }, [checked, isCorrect, kind]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-4">
      <div className="flex items-center gap-2">
        <GraduationCap size={18} className="text-accent" aria-hidden="true" />
        <h3 className="font-display text-[15px] font-semibold">
          Comprueba tu respuesta
        </h3>
      </div>
      <p className="text-[14px] text-muted">
        Clasifica esta fórmula antes de consultar la tabla completa:
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: "tautologia", label: "Es tautología" },
            { id: "contingencia", label: "Es contingencia" },
            { id: "contradiccion", label: "Es contradicción" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            aria-pressed={selected === opt.id}
            onClick={() => {
              setSelected(opt.id);
              setChecked(false);
            }}
            className={cn(
              "inline-flex min-h-9 items-center rounded-md border px-3 text-[14px] font-medium transition-colors",
              selected === opt.id
                ? "border-accent bg-accent/15 text-accent font-semibold"
                : "border-border bg-sunken hover:bg-raised",
            )}
          >
            {opt.label}
          </button>
        ))}
        <button
          type="button"
          disabled={!selected}
          onClick={() => setChecked(true)}
          className="inline-flex min-h-9 items-center rounded-md bg-accent px-3 text-[14px] font-semibold text-accent-contrast hover:opacity-90 disabled:opacity-40"
        >
          Comprobar
        </button>
      </div>

      {checked ? (
        <div className="pt-1">
          {isCorrect ? (
            <Chip tone="ok" className="text-[13px]">
              <CheckCircle2 size={16} aria-hidden="true" />
              ¡Correcto! Es una{" "}
              {kind === "tautologia"
                ? "tautología"
                : kind === "contradiccion"
                  ? "contradicción"
                  : "contingencia"}{" "}
              ({trueCount} de {total} interpretaciones verdaderas).
            </Chip>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Chip tone="warn" className="text-[13px]">
                No coincide. Inténtalo de nuevo.
              </Chip>
              {hint ? <p className="text-[13px] text-muted">{hint}</p> : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

type Shown = { ast: Node; table: Table };

function SingleMode({
  format,
  formatToggle,
}: {
  format: TruthFormat;
  formatToggle: React.ReactNode;
}) {
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(() => {
    const f = params.get("f") ?? "";
    return f.length <= MAX_FORMULA_LENGTH ? f : "";
  });
  const [settled, setSettled] = useState(text);
  const [subOverride, setSubOverride] = useState<boolean | null>(null);
  const [keypad, setKeypad] = useState(true);
  const [lastValid, setLastValid] = useState<Shown | null>(null);
  const [showSolution, setShowSolution] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSettled(text);
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (text) next.set("f", text);
          else next.delete("f");
          return next.toString() === prev.toString() ? prev : next;
        },
        { replace: true },
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text, setParams]);

  const parsed = useMemo(() => parseFormula(text), [text]);
  const built = useMemo(
    () =>
      parsed.ok ? { ast: parsed.ast, table: buildTable(parsed.ast) } : null,
    [parsed],
  );
  const shown: Shown | null =
    built && built.table.ok ? { ast: built.ast, table: built.table } : null;

  useEffect(() => {
    if (shown) setLastValid(shown);
  }, [built]); // eslint-disable-line react-hooks/exhaustive-deps

  const empty = text.trim() === "";
  const error: ParseError | null =
    !parsed.ok && !empty && settled === text ? parsed.error : null;
  const tooMany = built && !built.table.ok ? built.table.count : null;
  const dimmed = !parsed.ok ? lastValid : null;
  const current = shown ?? dimmed;

  const subCount = current
    ? Math.max(0, current.table.subformulas.length - 1)
    : 0;
  const showSub = subOverride ?? subCount <= 5;

  const verdict = shown ? classify(shown.table.rows) : null;
  const V = verdict ? VERDICT[verdict.kind] : null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="flex flex-col gap-3 lg:col-span-5">
        <FormulaField
          id="formula"
          label="Fórmula"
          value={text}
          onChange={setText}
          error={error}
          inputRef={inputRef}
        />
        <button
          type="button"
          aria-pressed={keypad}
          onClick={() => setKeypad((k) => !k)}
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-md border border-border bg-raised px-4 text-[14px] font-semibold hover:bg-sunken"
        >
          <Keyboard size={20} strokeWidth={1.75} aria-hidden="true" />
          Teclado de símbolos
        </button>
        {keypad ? (
          <SymbolKeypad targetRef={inputRef} onChange={setText} />
        ) : null}
        <details className="text-[14px]">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2">
            <Info size={16} strokeWidth={1.75} aria-hidden="true" />
            Ver precedencia
          </summary>
          <p className="pb-2 text-muted">Precedencia: ¬, ∧, ∨, ⊻, →, ↔</p>
        </details>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
        {empty ? (
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-[20px] font-semibold">
              Escribe una fórmula
            </h2>
            <p className="text-muted">
              Por ejemplo: p → q, ¬(p ∧ q) o p ↔ q. Puedes usar el teclado de
              símbolos o escribir ~, &amp;, |, -&gt;, &lt;-&gt;.
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setText(ex)}
                  className="inline-flex min-h-11 items-center rounded-md border border-border px-3 font-mono text-[16px] hover:bg-sunken"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : tooMany !== null ? (
          <div className="flex flex-col items-start gap-2">
            <Chip tone="warn">Demasiadas variables</Chip>
            <p>
              Esta fórmula tiene {tooMany} variables y la tabla tendría{" "}
              {2 ** tooMany} filas. El límite es {MAX_VARIABLES} variables (
              {2 ** MAX_VARIABLES} filas). Simplifica la fórmula o usa menos
              variables.
            </p>
          </div>
        ) : current ? (
          <div className={cn("flex flex-col gap-4", dimmed && "opacity-60")}>
            {shown && verdict ? (
              <AcademicLogicCheck
                kind={verdict.kind}
                trueCount={verdict.trueCount}
                total={verdict.total}
                ast={shown.ast}
              />
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-sunken/40 px-3 py-2">
              <div className="flex items-center gap-2 text-[13px] text-muted">
                <Info size={16} aria-hidden="true" />
                <span>
                  Aviso de integridad: contrasta tus resultados tras intentar resolver el ejercicio por ti mismo.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowSolution((s) => !s)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-raised px-3 text-[13px] font-medium hover:bg-sunken"
              >
                {showSolution ? "Ocultar solución detallada" : "Ver la solución completa"}
              </button>
            </div>

            {showSolution ? (
              <>
                {V && verdict ? (
                  <div
                    aria-live="polite"
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-raised p-3"
                  >
                    <Chip
                      tone={V.tone}
                      className="text-[20px] font-semibold leading-[1.2]"
                    >
                      <V.Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                      {V.label}
                    </Chip>
                    <span>
                      Verdadera en {verdict.trueCount} de {verdict.total} filas
                    </span>
                  </div>
                ) : null}
                <Tex
                  display
                  tex={toTex(current.ast)}
                  label="Fórmula normalizada"
                  className="text-[20px]"
                />
                <div className="flex flex-wrap items-center gap-4">
                  {formatToggle}
                  {subCount > 0 ? (
                    <Switch
                      label="Mostrar pasos intermedios"
                      checked={showSub}
                      onCheckedChange={setSubOverride}
                    />
                  ) : null}
                </div>
                <TruthTable
                  table={current.table}
                  format={format}
                  showSub={showSub}
                  caption={`Tabla de verdad de ${toPlain(current.ast)}: ${current.table.rows.length} filas`}
                />
                <NormalForms table={current.table} />
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type Mode = "una" | "comparar";

export function LogicLabPage() {
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get("m") === "comparar" ? "comparar" : "una";
  const tab: "tabla" | "f1" = params.get("t") === "f1" ? "f1" : "tabla";
  const [format, setFormat] = useState<TruthFormat>(() =>
    readFormat(params.get("v")),
  );

  const onFormat = (v: string) => {
    if (v !== "10" && v !== "VF") return;
    setFormat(v);
    try {
      localStorage.setItem(FORMAT_KEY, v);
    } catch {
      // ignore
    }
  };
  const onMode = (v: string) => {
    if (v !== "una" && v !== "comparar") return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v === "comparar") next.set("m", "comparar");
        else {
          next.delete("m");
          next.delete("g");
        }
        return next;
      },
      { replace: true },
    );
  };

  const onTab = (v: string) => {
    if (v !== "tabla" && v !== "f1") return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v === "f1") next.set("t", "f1");
        else next.delete("t");
        return next;
      },
      { replace: true },
    );
  };

  const formatToggle = (
    <ToggleGroup
      type="single"
      value={format}
      aria-label="Formato de valores"
      onValueChange={onFormat}
    >
      <ToggleGroupItem value="10">1 / 0</ToggleGroupItem>
      <ToggleGroupItem value="VF">V / F</ToggleGroupItem>
    </ToggleGroup>
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1
          tabIndex={-1}
          className="font-display text-[28px] font-semibold leading-[1.2]"
        >
          Laboratorio de lógica
        </h1>
        <p className="text-muted">
          {tab === "f1"
            ? "Practica las tablas de suma y producto del espacio F₁."
            : mode === "comparar"
              ? "Compara dos fórmulas y mira en qué filas difieren."
              : "Escribe una fórmula proposicional y comprueba su tabla de verdad."}
        </p>
      </div>
      <ToggleGroup
        type="single"
        value={tab}
        aria-label="Sección"
        onValueChange={onTab}
        className="self-start"
      >
        <ToggleGroupItem value="tabla">Tabla de verdad</ToggleGroupItem>
        <ToggleGroupItem value="f1">Espacio F₁</ToggleGroupItem>
      </ToggleGroup>
      {tab === "f1" ? (
        <F1Explorer />
      ) : (
        <>
          <ToggleGroup
            type="single"
            value={mode}
            aria-label="Modo"
            onValueChange={onMode}
            className="self-start"
          >
            <ToggleGroupItem value="una">Una fórmula</ToggleGroupItem>
            <ToggleGroupItem value="comparar">Comparar</ToggleGroupItem>
          </ToggleGroup>
          {mode === "comparar" ? (
            <CompareMode format={format} formatToggle={formatToggle} />
          ) : (
            <SingleMode format={format} formatToggle={formatToggle} />
          )}
        </>
      )}
    </section>
  );
}
