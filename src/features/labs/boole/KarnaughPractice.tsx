// «Mapa de Karnaugh»: la persona marca los grupos (seleccionando sus celdas) y la app valida cada uno
// (rectángulo de 1, 2, 4, 8 o 16 celdas, con vuelta por los bordes, sin ceros al agrupar unos) y
// escribe su término. «Comprobar» dice si la agrupación cubre todo y si es mínima, sin enseñar la
// mínima; las pistas señalan un 1 sin cubrir o un grupo mejorable, nunca la solución, que queda detrás
// de «Ver la solución completa». También se agrupan los 0 (producto de sumas) y, con «Cambiar su
// valor», cada celda pasa por 0 → 1 → X.
import { Check, Lightbulb, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { booleToPlain, booleToTex } from "../../../../shared/boole/expr.ts";
import {
  checkKMapGroups,
  groupLiterals,
  implicantCells,
  kmapExpression,
  kmapLayout,
  kmapPosition,
  kmapSolution,
  kmapTerm,
  readKMapGroup,
  type KMapCheck,
  type KMapMode,
} from "../../../../shared/boole/karnaugh.ts";
import type { Implicant } from "../../../../shared/boole/minimize.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { cellPlace, GroupBadge, KarnaughMap } from "./KarnaughMap.tsx";

type Tool = "agrupar" | "editar";
type Message = { tone: "ok" | "warn" | "crit"; text: string } | null;

const NEXT_VALUE: Record<string, string> = { "0": "1", "1": "X", X: "0" };
const MAX_GROUPS = 16;

/** «literal» / «literales», «grupo» / «grupos». */
const count = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;

export function KarnaughPractice({
  vars,
  vector,
  onEdit,
  startEditing = false,
}: {
  vars: string[];
  vector: string;
  /** Nuevo vector tras cambiar una celda a mano. */
  onEdit: (vector: string) => void;
  /** Empezar con «Cambiar su valor» (mapa en blanco). */
  startEditing?: boolean;
}) {
  const layout = useMemo(() => kmapLayout(vars), [vars]);
  const n = vars.length;
  const [mode, setMode] = useState<KMapMode>("sop");
  const [tool, setTool] = useState<Tool>(startEditing ? "editar" : "agrupar");
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [groups, setGroups] = useState<Implicant[]>([]);
  const [message, setMessage] = useState<Message>(null);
  const [result, setResult] = useState<KMapCheck | null>(null);
  const [hints, setHints] = useState(0);

  const target = mode === "sop" ? "1" : "0";
  const other = mode === "sop" ? "0" : "1";
  const hasX = vector.includes("X");

  const reset = () => {
    setSelection(new Set());
    setGroups([]);
    setMessage(null);
    setResult(null);
    setHints(0);
  };
  // Otra función, una celda cambiada u otro modo: la agrupación ya no vale.
  useEffect(() => {
    setSelection(new Set());
    setGroups([]);
    setMessage(null);
    setResult(null);
    setHints(0);
  }, [vector, mode]);

  const place = (m: number) => {
    const p = kmapPosition(layout, m);
    return cellPlace(layout, p.row, p.col);
  };

  const activate = (m: number) => {
    if (tool === "editar") {
      onEdit(vector.slice(0, m) + NEXT_VALUE[vector[m]!]! + vector.slice(m + 1));
      return;
    }
    setMessage(null);
    setResult(null);
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  };

  const createGroup = () => {
    setResult(null);
    const cells = [...selection];
    const r = readKMapGroup(vector, cells, mode);
    if (!r.ok) {
      const texts: Record<typeof r.issue, string> = {
        empty: "Selecciona primero las celdas del grupo.",
        size: `La selección tiene ${cells.length} celdas: un grupo tiene 1, 2, 4, 8 o 16.`,
        shape: "Esas celdas no forman un rectángulo. Recuerda que los bordes opuestos se tocan: un grupo puede dar la vuelta.",
        "wrong-cell": `El grupo incluye un ${other} (${r.cell === undefined ? "" : place(r.cell)}): solo puede tener ${target} y X.`,
        "no-target": `Ese grupo solo tiene X: tiene que cubrir al menos un ${target}.`,
      };
      setMessage({ tone: "crit", text: texts[r.issue] });
      return;
    }
    const same = groups.findIndex((g) => g.care === r.implicant.care && g.value === r.implicant.value);
    if (same >= 0) {
      setMessage({ tone: "warn", text: `Ese grupo ya está: es el grupo ${same + 1}.` });
      return;
    }
    if (groups.length >= MAX_GROUPS) {
      setMessage({ tone: "warn", text: `Como mucho ${MAX_GROUPS} grupos.` });
      return;
    }
    const term = booleToPlain(kmapTerm(vars, r.implicant, mode));
    setGroups((g) => [...g, r.implicant]);
    setSelection(new Set());
    setMessage({ tone: "ok", text: `Grupo ${groups.length + 1} creado: ${term} (${count(cells.length, "celda", "celdas")}).` });
  };

  const removeGroup = (i: number) => {
    setGroups((g) => g.filter((_, j) => j !== i));
    setMessage({ tone: "ok", text: `Grupo ${i + 1} quitado.` });
    setResult(null);
  };

  const live = useMemo(() => checkKMapGroups(vector, groups, mode), [vector, groups, mode]);
  const mine = kmapExpression(vars, groups, mode);
  const solution = useMemo(() => kmapSolution(vector, mode), [vector, mode]);
  const what = mode === "sop" ? "los 1" : "los 0";
  const nothing = !vector.includes(target);

  // La pista que depende de cómo va la agrupación: nunca dice qué grupos hacer.
  const liveHint = (): string => {
    if (live.uncovered.length > 0) {
      // El primero en orden de lectura del mapa (filas y luego columnas).
      const first = [...live.uncovered].sort((a, b) => {
        const pa = kmapPosition(layout, a);
        const pb = kmapPosition(layout, b);
        return pa.row - pb.row || pa.col - pb.col;
      })[0]!;
      return `Aún no cubres el ${target} de la ${place(first)}.`;
    }
    if (live.redundant.length > 0) {
      return `El grupo ${live.redundant[0]! + 1} sobra: ${what} que cubre ya están en otros grupos.`;
    }
    if (live.enlargeable.length > 0) {
      return `El grupo ${live.enlargeable[0]! + 1} cabe dentro de un grupo mayor: prueba a agrandarlo.`;
    }
    if (live.status === "not-minimal") {
      return `Tus grupos son lo más grandes posible y ninguno sobra, pero hay otra combinación con menos literales: fíjate en ${what} que pueden ir en más de un grupo.`;
    }
    return nothing ? `No hay ningún ${target}: no hace falta ningún grupo.` : "Tu agrupación ya es mínima: pulsa «Comprobar».";
  };
  const hintList = [
    `Busca grupos lo más grandes posible (16, 8, 4, 2 celdas) y recuerda que los bordes opuestos del mapa se tocan: la primera y la última columna son vecinas, y también la primera y la última fila.`,
    ...(hasX ? [`Las X puedes meterlas en un grupo si lo agrandan, pero no hace falta cubrirlas.`] : []),
    liveHint(),
  ];

  const check = () => {
    setMessage(null);
    setResult(live);
  };

  const resultView = (c: KMapCheck) => {
    if (c.status === "incomplete") {
      const k = c.uncovered.length;
      return (
        <Chip tone="warn" className="whitespace-normal">
          {k === 1 ? `Te falta por cubrir un ${target}.` : `Te faltan por cubrir ${k} celdas con ${target}.`}
        </Chip>
      );
    }
    if (c.status === "not-minimal") {
      const fewerGroups = c.literals === c.minimal.literals;
      return (
        <>
          <Chip tone="warn" className="whitespace-normal">
            {`Cubres todos ${what}, pero hay una agrupación más simple.`}
          </Chip>
          <span className="text-[14px]">
            {fewerGroups
              ? `Tu agrupación tiene ${count(c.terms, "grupo", "grupos")}; con los mismos literales se puede hacer con menos.`
              : `Tu agrupación tiene ${count(c.literals, "literal", "literales")}; la mínima tiene ${c.minimal.literals}.`}
          </span>
        </>
      );
    }
    return (
      <Chip tone="ok" className="whitespace-normal">
        <Check size={16} aria-hidden="true" />
        {nothing
          ? `¡Correcto! No hay ningún ${target}: f = ${mode === "sop" ? 0 : 1}.`
          : `¡Correcto! Agrupación mínima: ${count(c.terms, "grupo", "grupos")} y ${count(c.literals, "literal", "literales")}.`}
      </Chip>
    );
  };

  const kind = mode === "sop" ? "Suma de productos" : "Producto de sumas";

  return (
    <section aria-labelledby="kmap-practice-title" className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3">
      <h2 id="kmap-practice-title" className="font-display text-[20px] font-semibold">
        Comprueba tu respuesta: agrupa en el mapa
      </h2>
      <div className="flex flex-wrap gap-3">
        <ToggleGroup
          type="single"
          value={mode}
          aria-label="Qué agrupas"
          onValueChange={(v) => {
            if (v === "sop" || v === "pos") setMode(v);
          }}
          className="grid max-w-full grid-cols-2 self-start sm:inline-flex"
        >
          <ToggleGroupItem value="sop" className="px-3 py-1 leading-tight">
            Los 1 (suma de productos)
          </ToggleGroupItem>
          <ToggleGroupItem value="pos" className="px-3 py-1 leading-tight">
            Los 0 (producto de sumas)
          </ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup
          type="single"
          value={tool}
          aria-label="Al pulsar una celda"
          onValueChange={(v) => {
            if (v === "agrupar" || v === "editar") {
              setTool(v);
              setSelection(new Set());
            }
          }}
          className="self-start"
        >
          <ToggleGroupItem value="agrupar">Agrupar</ToggleGroupItem>
          <ToggleGroupItem value="editar">Cambiar su valor</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <p className="text-[14px] text-muted">
        {tool === "agrupar"
          ? `Pulsa las celdas de un grupo y luego «Crear grupo». Un grupo es un rectángulo de 1, 2, 4, 8 o 16 celdas con ${what} (y, si quieres, X) que puede dar la vuelta por los bordes. Muévete por el mapa con las flechas.`
          : "Cada pulsación cambia la celda: 0 → 1 → X → 0. Al cambiar el mapa se borran los grupos."}
      </p>

      <KarnaughMap
        layout={layout}
        vector={vector}
        caption={`Mapa de Karnaugh de f(${vars.join(", ")}) con tus grupos`}
        groups={groups}
        selected={tool === "agrupar" ? selection : undefined}
        onActivate={activate}
      />

      {tool === "agrupar" ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={createGroup}>
            <Plus size={16} aria-hidden="true" />
            Crear grupo
          </Button>
          <Button variant="ghost" onClick={() => setSelection(new Set())} disabled={selection.size === 0}>
            <X size={16} aria-hidden="true" />
            Limpiar la selección
          </Button>
        </div>
      ) : null}
      <div role="status" className="text-[14px]">
        {message ? (
          <p className={cn(message.tone === "ok" ? "text-ok" : message.tone === "warn" ? "text-warn" : "text-crit")}>{message.text}</p>
        ) : null}
      </div>

      {groups.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-[16px] font-semibold">Tus grupos</h3>
          <ol aria-label="Tus grupos" className="flex flex-col gap-1">
            {groups.map((g, i) => {
              const term = kmapTerm(vars, g, mode);
              const size = implicantCells(n, g).length;
              return (
                <li key={`${g.care}:${g.value}`} className="flex flex-wrap items-center gap-2">
                  <GroupBadge index={i} />
                  <span className="text-[14px]">{`Grupo ${i + 1}:`}</span>
                  <Tex tex={booleToTex(term)} label={booleToPlain(term)} />
                  <span className="text-[14px] text-muted">{`(${count(size, "celda", "celdas")})`}</span>
                  <Button variant="ghost" aria-label={`Quitar el grupo ${i + 1}`} onClick={() => removeGroup(i)}>
                    <Trash2 size={16} aria-hidden="true" />
                    Quitar
                  </Button>
                </li>
              );
            })}
          </ol>
          <p className="max-w-full overflow-x-auto text-[14px]">
            {`Tu expresión (${count(live.literals, "literal", "literales")}): `}
            <Tex tex={`f = ${booleToTex(mine)}`} label={`f = ${booleToPlain(mine)}`} />
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={check}>
          Comprobar
        </Button>
        <Button variant="ghost" disabled={hints >= hintList.length} onClick={() => setHints((h) => h + 1)}>
          <Lightbulb size={16} aria-hidden="true" />
          {hints === 0 ? "Dame una pista" : "Otra pista"}
        </Button>
        <Button variant="ghost" onClick={reset} disabled={groups.length === 0 && selection.size === 0}>
          <RotateCcw size={16} aria-hidden="true" />
          Empezar de nuevo
        </Button>
      </div>
      {hints > 0 ? (
        <ol className="list-decimal pl-6 text-[14px]">
          {hintList.slice(0, hints).map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ol>
      ) : null}
      {result ? (
        <div role="status" className="flex flex-col items-start gap-1">
          {resultView(result)}
        </div>
      ) : null}

      <SolutionGate resetKey={`${vars.join(",")}|${vector}|${mode}`}>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
          <h3 className="font-display text-[18px] font-semibold">Agrupación mínima</h3>
          <KarnaughMap
            layout={layout}
            vector={vector}
            caption={`Mapa de Karnaugh de f(${vars.join(", ")}) con la agrupación mínima`}
            groups={solution}
          />
          {solution.length > 0 ? (
            <ol aria-label="Grupos de la solución" className="flex flex-col gap-1">
              {solution.map((g, i) => {
                const term = kmapTerm(vars, g, mode);
                return (
                  <li key={`${g.care}:${g.value}`} className="flex flex-wrap items-center gap-2">
                    <GroupBadge index={i} />
                    <span className="text-[14px]">{`Grupo ${i + 1}:`}</span>
                    <Tex tex={booleToTex(term)} label={booleToPlain(term)} />
                    <span className="text-[14px] text-muted">{`(${count(implicantCells(n, g).length, "celda", "celdas")})`}</span>
                  </li>
                );
              })}
            </ol>
          ) : null}
          <p className="text-[14px] font-semibold">
            {`${kind} mínimo${mode === "sop" ? "a" : ""} (${count(
              solution.reduce((s, g) => s + groupLiterals(g), 0),
              "literal",
              "literales",
            )}):`}
          </p>
          <Tex
            display
            tex={`f = ${booleToTex(kmapExpression(vars, solution, mode))}`}
            label={`${kind} mínimo${mode === "sop" ? "a" : ""}: f = ${booleToPlain(kmapExpression(vars, solution, mode))}`}
          />
        </div>
      </SolutionGate>
    </section>
  );
}
