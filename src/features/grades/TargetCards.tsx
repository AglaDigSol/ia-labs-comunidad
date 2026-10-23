import { Check, Info, OctagonAlert, OctagonX } from "lucide-react";
import type { Course } from "../../../shared/courses/types.ts";
import {
  BLOCK_MIN,
  type Accum,
  finalOutcome,
  formatGrade,
  mention,
  minAverage,
  minExam,
  portfolioGrade,
  targetsFor,
} from "../../../shared/grades.ts";
import { Chip } from "../../components/ui/chip.tsx";

function TargetCard({
  id,
  label,
  target100,
  acc,
  examWeightPct,
  mh100,
}: {
  id: string;
  label: string;
  target100: number;
  acc: Accum;
  examWeightPct: number;
  mh100: number;
}) {
  const noneEntered = acc.enteredWeightPct === 0 && acc.exam100 === null;
  const partial = !acc.allPortfolioEntered && !noneEntered;
  const r = partial
    ? minAverage(target100, acc, examWeightPct)
    : minExam(target100, acc, examWeightPct);
  let number = "—";
  let copy: string;
  let chip: React.ReactNode;
  let tone: "ok" | "warn" | "crit" | "neutral";
  if (noneEntered) {
    tone = "neutral";
    copy = "Introduce tus notas para ver cuánto necesitas";
    chip = null;
  } else if (r.status === "blocked") {
    copy =
      "No alcanzable en esta convocatoria: el portafolio está por debajo de 5,0";
    tone = "crit";
    chip = (
      <Chip tone="crit">
        <OctagonX size={16} aria-hidden="true" />
        No alcanzable
      </Chip>
    );
  } else if (r.status === "unreachable") {
    copy = partial
      ? `No alcanzable: ni con 10 en todo lo que falta llegas a ${formatGrade(target100)}`
      : `No alcanzable: ni con 10 en el examen llegas a ${formatGrade(target100)}`;
    tone = "crit";
    chip = (
      <Chip tone="crit">
        <OctagonX size={16} aria-hidden="true" />
        No alcanzable
      </Chip>
    );
  } else {
    const x = formatGrade(r.needed100, "ceil");
    number = x;
    copy = partial
      ? r.byBlockMin
        ? `Necesitas una media de al menos ${x} en lo que falta (mínimo de 5,0 por bloque)`
        : `Necesitas una media de ${x} en lo que falta (portafolio pendiente y examen)`
      : r.byBlockMin
        ? "Necesitas 5,0 en el examen (mínimo por bloque)"
        : `Necesitas ${x} en el examen`;
    tone = r.needed100 <= 700 ? "ok" : "warn";
    chip =
      tone === "ok" ? (
        <Chip tone="ok">
          <Check size={16} aria-hidden="true" />
          Asequible
        </Chip>
      ) : (
        <Chip tone="warn">Exigente</Chip>
      );
  }
  return (
    <li
      data-testid={`target-${id}`}
      data-tone={tone}
      className="flex flex-col gap-1 rounded-lg border border-border bg-raised p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[16px] font-semibold">{label}</h3>
        <span data-testid={`chip-${id}`} data-tone={tone}>
          {chip}
        </span>
      </div>
      {id === "mh" ? (
        <p className="text-[14px] text-muted">{`optar a MH (≥ ${formatGrade(mh100)})`}</p>
      ) : null}
      {tone === "neutral" ? null : (
        <p
          className="mono text-[32px] font-semibold leading-[1.1]"
          data-testid={`min-${id}`}
        >
          {number}
        </p>
      )}
      <p>{copy}</p>
      {id === "mh" ? (
        <p className="text-[14px] text-muted">
          {`Se concede según el cupo del grupo; aquí se calcula la nota necesaria para optar (${formatGrade(mh100)}).`}
        </p>
      ) : null}
    </li>
  );
}

export function TargetCards({
  course,
  acc,
  mh100,
}: {
  course: Course;
  acc: Accum;
  mh100: number;
}) {
  const portfolio = portfolioGrade(acc);
  const noneEntered = acc.enteredWeightPct === 0 && acc.exam100 === null;
  const partial = !acc.allPortfolioEntered && !noneEntered;
  const blockedPortfolio = acc.allPortfolioEntered && portfolio < BLOCK_MIN;
  const outcome = finalOutcome(acc, course.examWeightPct);
  const barPct =
    acc.portfolioWeightPct === 0
      ? 0
      : Math.floor((acc.enteredWeightPct * 100) / acc.portfolioWeightPct);
  return (
    <div aria-live="polite" className="flex flex-col gap-4">
      {noneEntered ? (
        <section className="flex flex-col gap-1">
          <h2 className="text-[20px]">Introduce tu primera nota</h2>
          <p>
            Escribe lo que llevas en cada componente (0 a 10) y verás la nota
            mínima que necesitas para llegar a 5,0, 9,0 y Matrícula de Honor.
          </p>
        </section>
      ) : null}

      {noneEntered ? null : (
        <section className="flex flex-col gap-2">
          <p className="mono text-[32px] font-semibold leading-[1.1]">
            {`Llevas ${formatGrade(Math.floor((acc.accum + 50) / 100))} sobre ${formatGrade(acc.enteredWeightPct * 10)} puntos posibles`}
          </p>
          <p className="mono text-[14px] font-semibold">{`Portafolio: ${formatGrade(portfolio)}`}</p>
          <div
            role="progressbar"
            aria-label="Peso del portafolio introducido"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={barPct}
            className="h-2 w-full overflow-hidden rounded-full bg-sunken"
          >
            <div className="h-full bg-fg" style={{ width: `${barPct}%` }} />
          </div>
          {!acc.allPortfolioEntered ? (
            <p className="text-[14px] text-muted">
              Calculado con los componentes que has introducido. Los pendientes
              cuentan como 0 hasta que los escribas.
            </p>
          ) : null}
        </section>
      )}

      {blockedPortfolio ? (
        <div
          className="flex items-start gap-2 rounded-md bg-crit-bg p-3 text-crit"
          data-testid="portfolio-warning"
        >
          <OctagonAlert
            size={20}
            aria-hidden="true"
            className="mt-0.5 shrink-0"
          />
          <p>
            {`Tu portafolio está en ${formatGrade(portfolio)}: necesitas al menos 5,0 en el bloque de portafolio para aprobar en esta convocatoria.`}
          </p>
        </div>
      ) : null}
      {partial ? (
        <div
          className="flex items-start gap-2 rounded-md bg-info-bg p-3 text-info"
          data-testid="portfolio-info"
        >
          <Info size={20} aria-hidden="true" className="mt-0.5 shrink-0" />
          <p>
            {`Con lo introducido hasta ahora, tu portafolio va en ${formatGrade(portfolio)} (los pendientes cuentan como 0). Recuerda que necesitas al menos 5,0 en el bloque de portafolio.`}
          </p>
        </div>
      ) : null}

      <ul className="flex flex-col gap-3">
        {targetsFor(mh100).map((t) => (
          <TargetCard
            key={t.id}
            id={t.id}
            label={t.label}
            target100={t.target100}
            acc={acc}
            examWeightPct={course.examWeightPct}
            mh100={mh100}
          />
        ))}
      </ul>

      {outcome ? (
        <section className="flex flex-col gap-1">
          <p className="mono text-[20px] font-semibold">
            {outcome.provisional
              ? `Nota final provisional: ${formatGrade(outcome.final100)} · ${mention(outcome.final100, outcome.passed, mh100)} (provisional)`
              : `Nota final: ${formatGrade(outcome.final100)} · ${mention(outcome.final100, outcome.passed, mh100)}`}
          </p>
          {outcome.failedBlock === "exam" ? (
            <p className="text-crit">El examen está por debajo de 5,0</p>
          ) : null}
          {outcome.failedBlock === "portfolio" ? (
            <p className="text-crit">El portafolio está por debajo de 5,0</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
