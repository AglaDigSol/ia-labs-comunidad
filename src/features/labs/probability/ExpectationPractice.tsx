// «Valor esperado y juegos»: la tabla de un juego (ganancia, probabilidad y su producto en cada fila)
// y la esperanza (y, si se pide, la varianza); la penalización por fallo en un test de opción
// múltiple; y E[XY], combinaciones lineales y Var(X + Y) con dos binomiales independientes. Cada
// casilla se comprueba con el motor y se marca sin decir su valor.
import { useId, useMemo } from "react";
import { distMean, distVariance } from "../../../../shared/probability/distributions.ts";
import { probTex } from "../../../../shared/probability/format.ts";
import { gameVar, guessExpectation, penaltyForTarget, rvMean, rvVariance, type GameRow } from "../../../../shared/probability/variable.ts";
import { add, frac, mul, type Frac } from "../../../../shared/rational.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Tex } from "../../../lib/tex.tsx";
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

// ---------------------------------------------------------------- Juego

export function GamePractice({ rows, askVariance = false, outcome = "Cara", onSolved }: { rows: readonly GameRow[]; askVariance?: boolean; outcome?: string; onSolved?: () => void }) {
  const help = useId();
  const X = useMemo(() => gameVar(rows), [rows]);
  const mean = rvMean(X);
  const variance = rvVariance(X);
  const expected = useMemo(() => {
    const e: Record<string, Frac> = {};
    rows.forEach((r, i) => {
      e[`x${i}`] = r.value;
      e[`p${i}`] = r.prob;
      e[`xp${i}`] = mul(r.value, r.prob);
    });
    e.mean = mean;
    if (askVariance) e.var = variance;
    return e;
  }, [rows, mean, variance, askVariance]);
  const keys = useMemo(() => Object.keys(expected), [expected]);
  const f = useFields(keys);
  const graded = gradeFields(f.values, expected);
  const solved = f.checked && graded.allOk;
  const cell = (k: string, label: string) => (
    <AnswerField label={label} hideLabel value={f.values[k] ?? ""} onChange={(v) => f.set(k, v)} invalid={f.checked && graded.states[k] !== "bien"} describedBy={help} />
  );
  return (
    <PracticeBox title="Tabla del juego">
      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[20rem] border-collapse text-center text-[14px]">
          <caption className="sr-only">Tabla del juego: ganancia, probabilidad y producto de cada resultado</caption>
          <thead>
            <tr>
              <th scope="col" className="p-1 text-left">{outcome}</th>
              <th scope="col" className="p-1">Ganancia x</th>
              <th scope="col" className="p-1">P(X = x)</th>
              <th scope="col" className="p-1">x · P(X = x)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.label} className="border-t border-border">
                <th scope="row" className="p-1 text-left font-semibold">{r.label}</th>
                <td className="p-1">{cell(`x${i}`, `Ganancia con ${outcome.toLowerCase()} ${r.label}`)}</td>
                <td className="p-1">{cell(`p${i}`, `Probabilidad de ${outcome.toLowerCase()} ${r.label}`)}</td>
                <td className="p-1">{cell(`xp${i}`, `Ganancia por probabilidad con ${outcome.toLowerCase()} ${r.label}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-3">
        <AnswerField label="E[X]" labelNode={<Tex tex="E[X]" />} value={f.values.mean ?? ""} onChange={(v) => f.set("mean", v)} invalid={f.checked && graded.states.mean !== "bien"} describedBy={help} className="w-full sm:w-40" />
        {askVariance ? (
          <AnswerField label="Var(X)" labelNode={<Tex tex="\operatorname{Var}(X)" />} value={f.values.var ?? ""} onChange={(v) => f.set("var", v)} invalid={f.checked && graded.states.var !== "bien"} describedBy={help} className="w-full sm:w-40" />
        ) : null}
      </div>
      <AnswerHelp id={help} />
      <div className="flex flex-wrap gap-2">
        <CheckButton
          onClick={() => {
            f.check();
            if (graded.allOk) onSolved?.();
          }}
        />
        <Hints
          hints={[
            "La ganancia es neta: si pagas por jugar, réstalo; si pierdes, va con signo menos.",
            "Con un dado trucado, pon un peso a cada cara según la proporción (por ejemplo, 2 a cada impar y 1 a cada par) y divide entre la suma de los pesos: las seis probabilidades suman 1.",
            "La esperanza es la suma de la última columna: E[X] = Σ x·P(X = x).",
            ...(askVariance ? ["Var(X) = E[X²] − E[X]², con E[X²] = Σ x²·P(X = x)."] : []),
          ]}
        />
      </div>
      {f.checked ? (
        <Status>
          <GradeSummary graded={graded} solved={solved} success={`¡Correcto! ${mean.n > 0n ? "El juego es favorable: de media ganas." : mean.n < 0n ? "El juego es desfavorable: de media pierdes." : "Es un juego justo: de media ni ganas ni pierdes."}`} />
        </Status>
      ) : null}
      <SolutionGate resetKey={rows.map((r) => `${r.label}:${probTex(r.value)}:${probTex(r.prob)}`).join("|")}>
        <SolutionBox>
          <SolutionLine
            tex={`E[X] = ${rows.map((r) => `(${probTex(r.value)})\\cdot ${probTex(r.prob)}`).join(" + ")} = ${probWithDecimalTex(mean)}`}
            label={`E de X igual a ${probWithDecimal(mean)}`}
          />
          {askVariance ? (
            <SolutionLine tex={`\\operatorname{Var}(X) = E[X^2] - E[X]^2 = ${probTex(add(variance, mul(mean, mean)))} - (${probTex(mean)})^2 = ${probWithDecimalTex(variance)}`} label={`Varianza igual a ${probWithDecimal(variance)}`} />
          ) : null}
        </SolutionBox>
      </SolutionGate>
    </PracticeBox>
  );
}

// ---------------------------------------------------------------- Penalización en un test

export function PenaltyPractice({ options, reward, target, onSolved }: { options: number; reward: Frac; target: Frac; onSolved?: () => void }) {
  const help = useId();
  const pRight = frac(1n, BigInt(options));
  const pWrong = frac(BigInt(options - 1), BigInt(options));
  const x = penaltyForTarget(options, reward, target);
  const expected = useMemo(() => ({ right: pRight, wrong: pWrong, penalty: x }), [pRight.n, pRight.d, x.n, x.d]); // eslint-disable-line react-hooks/exhaustive-deps
  const f = useFields(["right", "wrong", "penalty"] as const);
  const graded = gradeFields(f.values, expected);
  const solved = f.checked && graded.allOk;
  const pts = (v: Frac) => `${dataText(v)} ${v.n === 1n && v.d === 1n ? "punto" : "puntos"}`;
  return (
    <PracticeBox title="Penalización por fallo">
      <p>
        {`En un test, cada pregunta tiene ${options} opciones y solo una es correcta. Un acierto suma ${pts(reward)} y una pregunta en blanco, 0. ¿Cuánto tiene que restar una respuesta incorrecta para que responder al azar valga, de media, ${target.n === 0n ? "0 puntos (lo mismo que dejarla en blanco)" : pts(target)} por pregunta?`}
      </p>
      <div className="flex flex-wrap gap-3">
        <AnswerField label="P(acertar al azar)" value={f.values.right} onChange={(v) => f.set("right", v)} invalid={f.checked && graded.states.right !== "bien"} describedBy={help} className="w-full sm:w-44" />
        <AnswerField label="P(fallar al azar)" value={f.values.wrong} onChange={(v) => f.set("wrong", v)} invalid={f.checked && graded.states.wrong !== "bien"} describedBy={help} className="w-full sm:w-44" />
        <AnswerField label="Lo que resta un fallo (en puntos)" value={f.values.penalty} onChange={(v) => f.set("penalty", v)} invalid={f.checked && graded.states.penalty !== "bien"} describedBy={help} className="w-full sm:w-56" />
      </div>
      <AnswerHelp id={help} />
      <div className="flex flex-wrap gap-2">
        <CheckButton
          onClick={() => {
            f.check();
            if (graded.allOk) onSolved?.();
          }}
        />
        <Hints
          hints={[
            "Al azar, cada opción es igual de probable: acertar tiene probabilidad 1/k y fallar, (k − 1)/k.",
            "Si un fallo resta x, la puntuación esperada de una pregunta es E = (acierto)·P(acertar) − x·P(fallar).",
            "Iguala E a lo que se pide y despeja x. La penalización se escribe en positivo (lo que se resta).",
          ]}
        />
      </div>
      {f.checked ? (
        <Status>
          <GradeSummary graded={graded} solved={solved} success="¡Correcto! Con esa penalización, adivinar vale de media lo que se pedía." />
        </Status>
      ) : null}
      <SolutionGate resetKey={`${options}|${probTex(reward)}|${probTex(target)}`}>
        <SolutionBox>
          <SolutionLine
            tex={`E = ${probTex(reward)}\\cdot\\frac{1}{${options}} - x\\cdot\\frac{${options - 1}}{${options}} = ${dataTex(target)} \\;\\Rightarrow\\; x = \\frac{${probTex(reward)} - ${options}\\cdot ${dataTex(target)}}{${options - 1}} = ${probWithDecimalTex(x)}`}
            label={`x igual a ${probWithDecimal(x)}`}
          />
          <p>{`Comprobación: ${dataText(reward)}·1/${options} − ${dataText(x)}·${options - 1}/${options} = ${dataText(guessExpectation(options, reward, x))}.`}</p>
        </SolutionBox>
      </SolutionGate>
    </PracticeBox>
  );
}

// ---------------------------------------------------------------- E[XY] con independientes

export type BinomialParams = { n: number; p: Frac };

export function ProductPractice({
  x,
  y,
  lin = [2, -1, 3],
  ask = ["exy", "lineal", "var-suma"],
  onSolved,
}: {
  x: BinomialParams;
  y: BinomialParams;
  lin?: readonly [number, number, number];
  ask?: ReadonlyArray<"exy" | "lineal" | "var-suma">;
  onSolved?: () => void;
}) {
  const help = useId();
  const dx = { kind: "binomial", n: x.n, p: x.p } as const;
  const dy = { kind: "binomial", n: y.n, p: y.p } as const;
  const ex = distMean(dx);
  const ey = distMean(dy);
  const [a, b, c] = lin.map((v) => frac(BigInt(v))) as [Frac, Frac, Frac];
  const linear = add(add(mul(a, ex), mul(b, ey)), c);
  const varSum = add(distVariance(dx), distVariance(dy));
  const expected = useMemo(() => {
    const e: Record<string, Frac> = { ex, ey };
    if (ask.includes("exy")) e.exy = mul(ex, ey);
    if (ask.includes("lineal")) e.lineal = linear;
    if (ask.includes("var-suma")) e.varsum = varSum;
    return e;
  }, [ex.n, ex.d, ey.n, ey.d, linear.n, linear.d, varSum.n, varSum.d, ask.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const keys = useMemo(() => Object.keys(expected), [expected]);
  const f = useFields(keys);
  const graded = gradeFields(f.values, expected);
  const solved = f.checked && graded.allOk;
  const sgn = (v: number, body: string, first = false) => (v < 0 ? `- ${Math.abs(v) === 1 ? "" : Math.abs(v)}${body}` : `${first ? "" : "+ "}${v === 1 ? "" : v}${body}`);
  const linTex = `E[${sgn(lin[0], "X", true)} ${sgn(lin[1], "Y")} ${lin[2] === 0 ? "" : lin[2] < 0 ? `- ${-lin[2]}` : `+ ${lin[2]}`}]`;
  const LABELS: Record<string, [string, string]> = {
    ex: ["E[X]", "E[X]"],
    ey: ["E[Y]", "E[Y]"],
    exy: ["E[XY]", "E[XY]"],
    lineal: [linTex.replace(/\s+/g, " "), linTex],
    varsum: ["Var(X + Y)", "\\operatorname{Var}(X + Y)"],
  };
  return (
    <PracticeBox title="Esperanza con variables independientes">
      <Tex
        display
        tex={`X \\sim B(${x.n},\\ ${dataTex(x.p)}),\\quad Y \\sim B(${y.n},\\ ${dataTex(y.p)}),\\quad X \\text{ e } Y \\text{ independientes}`}
        label={`X binomial de n ${x.n} y p ${dataText(x.p)}; Y binomial de n ${y.n} y p ${dataText(y.p)}; independientes`}
        className="text-[18px]"
      />
      <div className="flex flex-wrap gap-3">
        {keys.map((k) => (
          <AnswerField key={k} label={LABELS[k]![0]} labelNode={<Tex tex={LABELS[k]![1]} />} value={f.values[k] ?? ""} onChange={(v) => f.set(k, v)} invalid={f.checked && graded.states[k] !== "bien"} describedBy={help} className="w-full sm:w-44" />
        ))}
      </div>
      <AnswerHelp id={help} />
      <div className="flex flex-wrap gap-2">
        <CheckButton
          onClick={() => {
            f.check();
            if (graded.allOk) onSolved?.();
          }}
        />
        <Hints
          hints={[
            "La media de una binomial B(n, p) es n·p; su varianza, n·p·(1 − p).",
            "Si X e Y son independientes, E[XY] = E[X]·E[Y] (sin independencia, en general no).",
            "La esperanza es lineal siempre: E[aX + bY + c] = a·E[X] + b·E[Y] + c.",
            "Con independencia, las varianzas se suman: Var(X + Y) = Var(X) + Var(Y).",
          ]}
        />
      </div>
      {f.checked ? (
        <Status>
          <GradeSummary graded={graded} solved={solved} success="¡Correcto!" />
        </Status>
      ) : null}
      <SolutionGate resetKey={`${x.n}|${probTex(x.p)}|${y.n}|${probTex(y.p)}|${lin.join(",")}`}>
        <SolutionBox>
          <SolutionLine tex={`E[X] = ${x.n}\\cdot ${probTex(x.p)} = ${probTex(ex)},\\quad E[Y] = ${y.n}\\cdot ${probTex(y.p)} = ${probTex(ey)}`} label={`E de X ${probWithDecimal(ex)}; E de Y ${probWithDecimal(ey)}`} />
          {ask.includes("exy") ? <SolutionLine tex={`E[XY] = E[X]\\,E[Y] = ${probWithDecimalTex(mul(ex, ey))}`} label={`E de X por Y igual a ${probWithDecimal(mul(ex, ey))}`} /> : null}
          {ask.includes("lineal") ? <SolutionLine tex={`${linTex} = ${probWithDecimalTex(linear)}`} label={`Combinación lineal igual a ${probWithDecimal(linear)}`} /> : null}
          {ask.includes("var-suma") ? <SolutionLine tex={`\\operatorname{Var}(X+Y) = ${probTex(distVariance(dx))} + ${probTex(distVariance(dy))} = ${probWithDecimalTex(varSum)}`} label={`Varianza de la suma igual a ${probWithDecimal(varSum)}`} /> : null}
        </SolutionBox>
      </SolutionGate>
    </PracticeBox>
  );
}
