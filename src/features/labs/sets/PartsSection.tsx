// «Partes y producto cartesiano»: escribes 𝒫(A) o A × B por extensión y cuántos elementos tiene. La
// app corrige la lista como conjunto (el orden no importa): señala lo que escribiste y no pertenece,
// los repetidos y cuántos faltan, sin decir cuáles. La lista completa queda tras la solución.
import { Check, Lightbulb } from "lucide-react";
import { useMemo, useState } from "react";
import {
  cartesianProduct,
  checkPowerSet,
  checkProduct,
  MAX_POWER_SET_BASE,
  MAX_PRODUCT_SIDE,
  parseElementList,
  parsePairList,
  parseSetFamily,
  powerSetOf,
  subsetText,
} from "../../../../shared/sets/finite.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Input } from "../../../components/ui/input.tsx";
import { Textarea } from "../../../components/ui/textarea.tsx";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { cn } from "../../../lib/cn.ts";
import { plural, Status, Verdict } from "./shared.tsx";

type Mode = "partes" | "producto";

const pairText = ([a, b]: readonly [string, string]) => `(${a}, ${b})`;

export function PartsSection() {
  const [mode, setMode] = useState<Mode>("partes");
  const [aText, setAText] = useState("a, b, c");
  const [bText, setBText] = useState("1, 2");
  const [count, setCount] = useState("");
  const [list, setList] = useState("");
  const [checked, setChecked] = useState(false);
  const [hints, setHints] = useState(0);

  const reset = () => {
    setChecked(false);
    setHints(0);
  };
  const a = useMemo(() => parseElementList(aText), [aText]);
  const b = useMemo(() => parseElementList(bText), [bText]);
  const limit = mode === "partes" ? MAX_POWER_SET_BASE : MAX_PRODUCT_SIDE;
  const dataError = !a.ok
    ? `A: ${a.error}`
    : a.value.elements.length > limit
      ? `Para practicar, A tiene como mucho ${limit} elementos.`
      : mode === "producto" && !b.ok
        ? `B: ${b.error}`
        : mode === "producto" && b.ok && b.value.elements.length > limit
          ? `Para practicar, B tiene como mucho ${limit} elementos.`
          : null;
  const A = a.ok ? a.value.elements : [];
  const B = b.ok ? b.value.elements : [];
  const truthCount = mode === "partes" ? 2 ** A.length : A.length * B.length;
  const name = mode === "partes" ? "𝒫(A)" : "A × B";

  const family = mode === "partes" ? parseSetFamily(list) : null;
  const pairs = mode === "producto" ? parsePairList(list) : null;
  const listError = family && !family.ok ? family.error : pairs && !pairs.ok ? pairs.error : null;
  const check =
    family && family.ok
      ? { ...checkPowerSet(family.value, A), reversed: false, items: family.value.map(subsetText) }
      : pairs && pairs.ok
        ? { ...checkProduct(pairs.value, A, B), items: pairs.value.map(pairText) }
        : null;
  const countOk = /^\s*\d+\s*$/.test(count) ? Number(count) === truthCount : null;
  const resetKey = `${mode}|${aText}|${bText}`;

  const hintList =
    mode === "partes"
      ? [
          "𝒫(A) reúne todos los subconjuntos de A, también ∅ y el propio A.",
          "Ordénalos por tamaño: el vacío, los de un elemento, los de dos… Cada elemento de A está o no está en cada subconjunto.",
        ]
      : [
          "A × B reúne los pares ordenados (a, b) con a de A y b de B.",
          "Fija cada elemento de A y combínalo con todos los de B. El orden importa: (a, b) no es (b, a).",
        ];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-5">
        <ToggleGroup
          type="single"
          value={mode}
          aria-label="Qué calculas"
          onValueChange={(v) => {
            if (v === "partes" || v === "producto") {
              setMode(v);
              setList("");
              setCount("");
              reset();
            }
          }}
          className="self-start"
        >
          <ToggleGroupItem value="partes">Conjunto de partes</ToggleGroupItem>
          <ToggleGroupItem value="producto">Producto cartesiano</ToggleGroupItem>
        </ToggleGroup>
        <div className="flex flex-col gap-1">
          <label htmlFor="parts-a" className="text-[14px] font-semibold">
            A
          </label>
          <Input
            id="parts-a"
            className="font-mono"
            value={aText}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setAText(e.target.value);
              reset();
            }}
          />
        </div>
        {mode === "producto" ? (
          <div className="flex flex-col gap-1">
            <label htmlFor="parts-b" className="text-[14px] font-semibold">
              B
            </label>
            <Input
              id="parts-b"
              className="font-mono"
              value={bText}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                setBText(e.target.value);
                reset();
              }}
            />
          </div>
        ) : null}
        <p className="text-[14px] text-muted">{`Elementos separados por comas, como mucho ${limit} en cada conjunto.`}</p>
        {dataError ? (
          <p role="alert" className="text-[14px] text-crit">
            {dataError}
          </p>
        ) : null}
      </div>

      <section aria-labelledby="parts-title" className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-raised p-3 lg:col-span-7">
        <h2 id="parts-title" className="font-display text-[20px] font-semibold">
          {mode === "partes" ? "Escribe el conjunto de partes" : "Escribe el producto cartesiano"}
        </h2>
        {/* Los elementos los escribe el estudiante: van como texto, nunca por KaTeX. */}
        <p className="font-mono text-[18px]">
          {mode === "partes" ? `A = ${subsetText(A)}` : `A = ${subsetText(A)}, B = ${subsetText(B)}`}
        </p>
        <div className="flex flex-col gap-1">
          <label htmlFor="parts-count" className="text-[14px] font-semibold">
            {`¿Cuántos elementos tiene ${name}?`}
          </label>
          <Input
            id="parts-count"
            inputMode="numeric"
            className={cn("w-24 font-mono", checked && countOk === false && "border-crit")}
            aria-invalid={checked && countOk === false ? true : undefined}
            value={count}
            autoComplete="off"
            onChange={(e) => {
              setCount(e.target.value);
              setChecked(false);
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="parts-list" className="text-[14px] font-semibold">
            {`Los elementos de ${name}`}
          </label>
          <Textarea
            id="parts-list"
            className="font-mono"
            value={list}
            spellCheck={false}
            placeholder={mode === "partes" ? "∅, {a}, {b}, {a, b}" : "(a, 1), (a, 2)"}
            aria-invalid={checked && (listError !== null || (check !== null && !check.correct)) ? true : undefined}
            onChange={(e) => {
              setList(e.target.value);
              setChecked(false);
            }}
          />
          <p className="text-[14px] text-muted">
            {mode === "partes"
              ? "Cada subconjunto entre llaves y separados por comas; ∅ para el vacío. El orden no importa."
              : "Cada par entre paréntesis y separados por comas. El orden de la lista no importa; el de cada par, sí."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={dataError !== null} onClick={() => setChecked(true)}>
            <Check size={16} aria-hidden="true" />
            Comprobar
          </Button>
          <Button variant="ghost" disabled={hints >= hintList.length} onClick={() => setHints((h) => h + 1)}>
            <Lightbulb size={16} aria-hidden="true" />
            {hints === 0 ? "Dame una pista" : "Otra pista"}
          </Button>
        </div>
        {hints > 0 ? (
          <ol className="list-decimal pl-6 text-[14px]">
            {hintList.slice(0, hints).map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ol>
        ) : null}
        {checked && dataError === null ? (
          <Status>
            {countOk === null ? (
              <span>{`Escribe cuántos elementos tiene ${name}.`}</span>
            ) : countOk ? (
              <Verdict tone="ok">
                <Check size={16} aria-hidden="true" />
                {mode === "partes"
                  ? `El número es correcto: |𝒫(A)| = 2^|A| = 2^${A.length} = ${truthCount}.`
                  : `El número es correcto: |A × B| = |A| · |B| = ${A.length} · ${B.length} = ${truthCount}.`}
              </Verdict>
            ) : (
              <Verdict tone="warn">
                {mode === "partes"
                  ? "El número no es correcto: recuerda que |𝒫(A)| = 2^|A|."
                  : "El número no es correcto: recuerda que |A × B| = |A| · |B|."}
              </Verdict>
            )}
            {listError ? (
              <span className="text-crit">{listError}</span>
            ) : check?.correct ? (
              <Verdict tone="ok">
                <Check size={16} aria-hidden="true" />
                {`¡Correcto! Tu lista es ${name}.`}
              </Verdict>
            ) : check ? (
              <>
                <Verdict tone="warn">{`${plural(check.right, "elemento bien", "elementos bien")}`}</Verdict>
                {check.wrong.length > 0 ? (
                  <span>
                    {`${mode === "partes" ? "No son subconjuntos de A" : "No son pares de A × B"}: ${check.wrong.map((i) => check.items[i]).join(", ")}.`}
                  </span>
                ) : null}
                {check.reversed ? <span>Algún par está al revés: en A × B, la primera componente es de A.</span> : null}
                {check.repeated.length > 0 ? (
                  <span>{`Repetidos: ${check.repeated.map((i) => check.items[i]).join(", ")}.`}</span>
                ) : null}
                {check.missing > 0 ? <span>{`Te ${check.missing === 1 ? "falta 1" : `faltan ${check.missing}`}.`}</span> : null}
              </>
            ) : null}
          </Status>
        ) : null}
        {dataError === null ? (
          <SolutionGate resetKey={resetKey}>
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
              <h3 className="font-display text-[18px] font-semibold">{`${name} completo (${truthCount} elementos)`}</h3>
              <p className="font-mono text-[16px] break-words">{`${name} = ${solutionText(mode, A, B)}`}</p>
            </div>
          </SolutionGate>
        ) : null}
      </section>
    </div>
  );
}

function solutionText(mode: Mode, A: string[], B: string[]): string {
  const items = mode === "partes" ? powerSetOf(A).map(subsetText) : cartesianProduct(A, B).map(pairText);
  return items.length === 0 ? "∅" : `{${items.join(", ")}}`;
}
