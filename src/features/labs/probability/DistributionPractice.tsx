// «Distribuciones discretas»: el explorador (eliges la distribución y sus parámetros y ves el diagrama
// de barras de P(X = k) con la función de distribución encima, la tabla y la media y la varianza) y la
// práctica con una historia: qué distribución la modela, P(X = k), P(X ≥ k), P(X ≤ k), E[X] y
// Var(X), corregidos con el motor. Al acertar se explica por qué esa distribución encaja.
import { useId, useMemo, useState } from "react";
import { parseProbAnswer } from "../../../../shared/probability/answer.ts";
import {
  cdf,
  DIST_LABEL,
  DIST_STORY,
  distMean,
  distProblem,
  distSupport,
  distVariance,
  momentsTex,
  pmf,
  pmfFormulaTex,
  pmfNumber,
  probAtLeast,
  type DistKind,
  type DistSpec,
} from "../../../../shared/probability/distributions.ts";
import { decimalComma } from "../../../../shared/probability/format.ts";
import type { DistQuestion } from "../../../../shared/probability/schema.ts";
import { toNumber, type Frac } from "../../../../shared/rational.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { selectClass } from "../boole/AxiomPractice.tsx";
import { LegendItem, PmfChart } from "./charts.tsx";
import {
  AnswerField,
  AnswerHelp,
  CheckButton,
  dataTex,
  dataText,
  GradeSummary,
  gradeFields,
  Hints,
  PracticeBox,
  probWithDecimal,
  probWithDecimalTex,
  SolutionBox,
  SolutionLine,
  Status,
  useFields,
} from "./common.tsx";

const KINDS: DistKind[] = ["bernoulli", "binomial", "geometrica", "poisson", "uniforme"];

/** Parámetros en TeX: «B(5, 0{,}8)». */
export function distTex(d: DistSpec): string {
  switch (d.kind) {
    case "bernoulli":
      return `\\operatorname{Bernoulli}(${dataTex(d.p)})`;
    case "binomial":
      return `B(${d.n},\\ ${dataTex(d.p)})`;
    case "geometrica":
      return `\\operatorname{Geom}(${dataTex(d.p)})`;
    case "poisson":
      return `\\operatorname{Poisson}(${dataTex(d.lambda)})`;
    case "uniforme":
      return `U\\{${d.a}, \\ldots, ${d.b}\\}`;
  }
}

export function distText(d: DistSpec): string {
  switch (d.kind) {
    case "bernoulli":
      return `Bernoulli de parámetro p = ${dataText(d.p)}`;
    case "binomial":
      return `binomial de parámetros n = ${d.n} y p = ${dataText(d.p)}`;
    case "geometrica":
      return `geométrica de parámetro p = ${dataText(d.p)}`;
    case "poisson":
      return `Poisson de parámetro λ = ${dataText(d.lambda)}`;
    case "uniforme":
      return `uniforme discreta entre ${d.a} y ${d.b}`;
  }
}

/** Pistas con la regla de cada distribución (nunca el número). */
export const DIST_HINTS: Record<DistKind, string[]> = {
  bernoulli: ["Un solo intento: P(X = 1) = p y P(X = 0) = 1 − p.", "E[X] = p y Var(X) = p·(1 − p)."],
  binomial: [
    "P(X = k) = C(n, k)·p^k·(1 − p)^(n−k), con C(n, k) = n! / (k!·(n − k)!).",
    "«k o más veces»: P(X ≥ k) = P(X = k) + … + P(X = n), o bien 1 − P(X ≤ k − 1) (usa la que tenga menos términos).",
    "«Como mucho k»: P(X ≤ k) = P(X = 0) + … + P(X = k).",
    "E[X] = n·p y Var(X) = n·p·(1 − p).",
  ],
  geometrica: [
    "El primer éxito en el intento k son k − 1 fallos seguidos de un éxito: P(X = k) = (1 − p)^(k−1)·p.",
    "Necesitar al menos k intentos es fallar los k − 1 primeros: P(X ≥ k) = (1 − p)^(k−1).",
    "Como mucho k intentos: P(X ≤ k) = 1 − (1 − p)^k.",
    "E[X] = 1/p y Var(X) = (1 − p)/p².",
  ],
  poisson: ["P(X = k) = e^(−λ)·λ^k / k!.", "P(X ≤ k) suma los términos de 0 a k; P(X ≥ k) = 1 − P(X ≤ k − 1).", "E[X] = Var(X) = λ."],
  uniforme: ["Todos los valores de a a b tienen probabilidad 1/(b − a + 1).", "P(X ≤ k) cuenta los valores de a a k.", "E[X] = (a + b)/2 y Var(X) = ((b − a + 1)² − 1)/12."],
};

export const QUESTION_LABEL = (q: DistQuestion, k: number): [string, string] => {
  switch (q) {
    case "igual":
      return [`P(X = ${k})`, `P(X = ${k})`];
    case "al-menos":
      return [`P(X ≥ ${k})`, `P(X \\geq ${k})`];
    case "como-mucho":
      return [`P(X ≤ ${k})`, `P(X \\leq ${k})`];
    case "media":
      return ["E[X]", "E[X]"];
    case "varianza":
      return ["Var(X)", "\\operatorname{Var}(X)"];
  }
};

export function questionValue(d: DistSpec, q: DistQuestion, k: number): Frac | number {
  switch (q) {
    case "igual":
      return pmf(d, k);
    case "al-menos":
      return probAtLeast(d, k);
    case "como-mucho":
      return cdf(d, k);
    case "media":
      return distMean(d);
    case "varianza":
      return distVariance(d);
  }
}

const valueTex = (v: Frac | number) => (typeof v === "number" ? `\\approx ${decimalComma(v, 4).replace(",", "{,}")}` : `= ${probWithDecimalTex(v)}`);
const valueText = (v: Frac | number) => (typeof v === "number" ? `≈ ${decimalComma(v, 4)}` : probWithDecimal(v));

/** Barras, tabla y leyenda de una distribución. */
export function DistributionView({ d, highlight }: { d: DistSpec; highlight?: ReadonlySet<number> }) {
  const ks = useMemo(() => distSupport(d, 41), [d]);
  const pm = ks.map((k) => pmfNumber(d, k));
  const cd = ks.map((k) => {
    const c = cdf(d, k);
    return typeof c === "number" ? c : toNumber(c);
  });
  return (
    <div className="flex flex-col gap-2">
      <PmfChart
        ks={ks}
        pmf={pm}
        cdf={cd}
        highlight={highlight}
        label={`Diagrama de barras de la ${distText(d)}: P(X = k) para k de ${ks[0]} a ${ks.at(-1)}${d.kind === "geometrica" || d.kind === "poisson" ? " (los primeros valores)" : ""}, con la función de distribución escalonada encima. Los valores están en la tabla.`}
      />
      <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Leyenda">
        <LegendItem label="P(X = k) (barras)" color="var(--accent)" shape="square" />
        <LegendItem label="F(k) = P(X ≤ k)" color="var(--text)" style="dashed" />
        {highlight && highlight.size > 0 ? <LegendItem label="Suceso que se pregunta (rayado)" color="var(--accent)" shape="diamond" /> : null}
      </ul>
      <details className="text-[14px]">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Tabla de valores</summary>
        <div className="max-h-72 overflow-auto">
          <table className="w-full border-collapse text-right font-mono">
            <thead>
              <tr>
                <th scope="col" className="p-1">k</th>
                <th scope="col" className="p-1">P(X = k)</th>
                <th scope="col" className="p-1">P(X ≤ k)</th>
              </tr>
            </thead>
            <tbody>
              {ks.map((k, i) => (
                <tr key={k} className="border-t border-border">
                  <th scope="row" className="p-1 font-normal">{k}</th>
                  <td className="p-1">{decimalComma(pm[i]!, 4)}</td>
                  <td className="p-1">{decimalComma(cd[i]!, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <Tex display tex={`${pmfFormulaTex(d.kind)},\\qquad ${momentsTex(d.kind)}`} label={`Función de probabilidad, media y varianza de la ${DIST_LABEL[d.kind]}`} className="text-[16px]" />
      <Tex display tex={`E[X] = ${probWithDecimalTex(distMean(d))},\\quad \\operatorname{Var}(X) = ${probWithDecimalTex(distVariance(d))}`} label={`Media ${probWithDecimal(distMean(d))}; varianza ${probWithDecimal(distVariance(d))}`} className="text-[16px]" />
    </div>
  );
}

/** Lee un parámetro p o λ escrito: devuelve la fracción o null. */
const readParam = (text: string): Frac | null => {
  const r = parseProbAnswer(text);
  return r.ok ? r.value : null;
};

export function DistributionExplorer() {
  const id = useId();
  const [kind, setKind] = useState<DistKind>("binomial");
  const [n, setN] = useState("10");
  const [p, setP] = useState("0,3");
  const [lambda, setLambda] = useState("2");
  const [a, setA] = useState("1");
  const [b, setB] = useState("6");
  const spec: DistSpec | null = (() => {
    const pp = readParam(p);
    const ll = readParam(lambda);
    const nn = Number(n);
    const aa = Number(a);
    const bb = Number(b);
    switch (kind) {
      case "bernoulli":
      case "geometrica":
        return pp ? { kind, p: pp } : null;
      case "binomial":
        return pp && n.trim() !== "" ? { kind, n: nn, p: pp } : null;
      case "poisson":
        return ll ? { kind, lambda: ll } : null;
      case "uniforme":
        return a.trim() !== "" && b.trim() !== "" ? { kind, a: aa, b: bb } : null;
    }
  })();
  const problem = spec ? distProblem(spec) : "Escribe los parámetros (p como fracción o decimal: 1/3, 0,25).";
  const param = (label: string, value: string, set: (v: string) => void, numeric = false) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${id}-${label}`} className="text-[14px] font-semibold">
        {label}
      </label>
      <input
        id={`${id}-${label}`}
        value={value}
        inputMode={numeric ? "numeric" : "text"}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => set(e.target.value.slice(0, 12))}
        className="h-11 w-28 rounded-md border border-border bg-sunken px-3 font-mono text-[16px] text-fg"
      />
    </div>
  );
  return (
    <PracticeBox title="Explorador de distribuciones">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-kind`} className="text-[14px] font-semibold">
            Distribución
          </label>
          <select id={`${id}-kind`} className={cn(selectClass, "font-body")} value={kind} onChange={(e) => setKind(e.target.value as DistKind)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {DIST_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        {kind === "binomial" ? param("n (intentos)", n, setN, true) : null}
        {kind === "bernoulli" || kind === "binomial" || kind === "geometrica" ? param("p (éxito)", p, setP) : null}
        {kind === "poisson" ? param("λ (media)", lambda, setLambda) : null}
        {kind === "uniforme" ? (
          <>
            {param("a (mínimo)", a, setA, true)}
            {param("b (máximo)", b, setB, true)}
          </>
        ) : null}
      </div>
      <p className="text-[14px] text-muted">{DIST_STORY[kind]}</p>
      {spec && !problem ? (
        <DistributionView d={spec} />
      ) : (
        <p role="alert" className="text-[14px] text-crit">
          {problem}
        </p>
      )}
    </PracticeBox>
  );
}

/** Valores de k que entran en la pregunta (para rayarlos en el dibujo). */
function eventKs(d: DistSpec, q: DistQuestion, k: number): number[] {
  const ks = distSupport(d, 41);
  if (q === "igual") return [k];
  if (q === "al-menos") return ks.filter((x) => x >= k);
  if (q === "como-mucho") return ks.filter((x) => x <= k);
  return [];
}

export function DistributionPractice({
  d,
  k,
  ask,
  identify,
  onSolved,
  title = "Calcula con la distribución",
}: {
  d: DistSpec;
  k: number;
  ask: readonly DistQuestion[];
  /** Pedir también qué distribución modela la historia. */
  identify: boolean;
  onSolved?: () => void;
  title?: string;
}) {
  const help = useId();
  const sel = useId();
  const keys = useMemo(() => [...ask], [ask]);
  const expected = useMemo(() => Object.fromEntries(ask.map((q) => [q, questionValue(d, q, k)])) as Record<string, Frac | number>, [d, k, ask]);
  const f = useFields(keys);
  const [kind, setKind] = useState<DistKind | "">("");
  const graded = gradeFields(f.values, expected);
  const kindOk = !identify || kind === d.kind;
  const solved = f.checked && graded.allOk && kindOk;
  const firstEvent = ask.find((q) => q === "igual" || q === "al-menos" || q === "como-mucho");
  return (
    <PracticeBox title={title}>
      {identify ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={sel} className="text-[14px] font-semibold">
            ¿Qué distribución sigue X?
          </label>
          <select
            id={sel}
            className={cn(selectClass, "w-full font-body sm:w-64", f.checked && !kindOk && "border-2 border-crit")}
            aria-invalid={f.checked && !kindOk ? true : undefined}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as DistKind | "");
              f.touch();
            }}
          >
            <option value="">Elige una…</option>
            {KINDS.map((x) => (
              <option key={x} value={x}>
                {DIST_LABEL[x]}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {ask.map((q) => {
          const [label, tex] = QUESTION_LABEL(q, k);
          return (
            <AnswerField
              key={q}
              label={label}
              labelNode={<Tex tex={tex} />}
              value={f.values[q] ?? ""}
              onChange={(v) => f.set(q, v)}
              invalid={f.checked && graded.states[q] !== "bien"}
              describedBy={help}
              className="w-full sm:w-40"
            />
          );
        })}
      </div>
      <AnswerHelp id={help} />
      <div className="flex flex-wrap gap-2">
        <CheckButton
          onClick={() => {
            f.check();
            if (graded.allOk && kindOk) onSolved?.();
          }}
        />
        <Hints hints={identify ? ["Piensa qué cuenta X: éxitos en un número fijo de intentos, el intento del primer éxito, sucesos en un intervalo o un valor al azar entre a y b.", ...DIST_HINTS[d.kind]] : DIST_HINTS[d.kind]} />
      </div>
      {f.checked ? (
        <Status>
          <GradeSummary
            graded={graded}
            solved={solved}
            success="¡Correcto!"
            extra={identify && kind === "" ? <span>Elige qué distribución sigue X.</span> : identify && !kindOk ? <span>Revisa qué distribución sigue X.</span> : null}
          />
          {solved ? <p className="text-[14px]">{`X sigue una ${distText(d)}. ${DIST_STORY[d.kind]}`}</p> : null}
        </Status>
      ) : null}
      {solved ? <DistributionView d={d} highlight={new Set(firstEvent ? eventKs(d, firstEvent, k) : [])} /> : null}
      <SolutionGate resetKey={`${distText(d)}|${k}|${ask.join(",")}`}>
        <SolutionBox>
          <p>{`X sigue una ${distText(d)}.`}</p>
          <Tex display tex={`X \\sim ${distTex(d)},\\qquad ${pmfFormulaTex(d.kind)}`} label={`X sigue una ${distText(d)}`} className="text-[16px]" />
          {ask.map((q) => {
            const [label, tex] = QUESTION_LABEL(q, k);
            const v = expected[q]!;
            return <SolutionLine key={q} tex={`${tex} ${valueTex(v)}`} label={`${label} ${valueText(v)}`} />;
          })}
          {d.kind === "geometrica" && ask.includes("al-menos") ? <p>{`P(X ≥ ${k}): los ${k - 1} primeros intentos fallan, (1 − p)^${k - 1}.`}</p> : null}
          {d.kind === "binomial" && ask.includes("al-menos") ? <p>{`P(X ≥ ${k}) = 1 − P(X ≤ ${k - 1}).`}</p> : null}
        </SolutionBox>
      </SolutionGate>
    </PracticeBox>
  );
}

