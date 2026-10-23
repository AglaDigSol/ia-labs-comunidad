import { useEffect, useRef, useState } from "react";
import type { Course, GradeComponent } from "../../../shared/courses/types.ts";
import { formatGrade, parseGrade } from "../../../shared/grades.ts";
import { keys } from "../../../shared/keys.ts";
import { Input } from "../../components/ui/input.tsx";
import { setKv } from "../../lib/kv-store.ts";

export const WRITE_DEBOUNCE_MS = 600;

/** Exact display of a stored value (hundredths) for editing: 650 -> "6,5", 725 -> "7,25", 700 -> "7". */
export function editText(value100: number): string {
  const int = Math.floor(value100 / 100);
  const frac = value100 % 100;
  if (frac === 0) return String(int);
  const f = String(frac).padStart(2, "0").replace(/0$/, "");
  return `${int},${f}`;
}

type RowProps = {
  courseId: string;
  component: GradeComponent;
  draft: string | undefined;
  stored: number | null;
  onChange: (c: GradeComponent, text: string) => void;
  onBlur: (c: GradeComponent) => void;
};

function GradeRow({ courseId, component: c, draft, stored, onChange, onBlur }: RowProps) {
  const text = draft ?? (stored === null ? "" : editText(stored));
  const parsed = draft === undefined ? null : parseGrade(draft);
  const error = parsed && !parsed.ok ? parsed.error : null;
  const inputId = `grade-${courseId}-${c.id}`;
  const errId = `${inputId}-err`;
  return (
    <tr className="border-t border-border align-top">
      <td className="py-2 pr-3">
        <label htmlFor={inputId}>{c.label}</label>
      </td>
      <td className="mono py-2 pr-3 text-muted">{c.weightPct} %</td>
      <td className="w-32 py-2">
        <Input
          id={inputId}
          inputMode="decimal"
          autoComplete="off"
          className="mono"
          value={text}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          onChange={(e) => onChange(c, e.target.value)}
          onBlur={() => onBlur(c)}
        />
        {error ? (
          <p id={errId} className="mt-1 text-[14px] text-crit">
            {error}
          </p>
        ) : null}
      </td>
    </tr>
  );
}

export function GradeTable({
  course,
  stored,
  drafts,
  onChange,
  onBlur,
}: {
  course: Course;
  stored: Record<string, number | null>;
  drafts: Record<string, string>;
  onChange: (c: GradeComponent, text: string) => void;
  onBlur: (c: GradeComponent) => void;
}) {
  const portfolio = course.components.filter((c) => !c.isExam);
  const exam = course.components.filter((c) => c.isExam);
  const portfolioPct = portfolio.reduce((s, c) => s + c.weightPct, 0);
  const rowFor = (c: GradeComponent) => (
    <GradeRow
      key={c.id}
      courseId={course.id}
      component={c}
      draft={drafts[c.id]}
      stored={stored[c.id] ?? null}
      onChange={onChange}
      onBlur={onBlur}
    />
  );
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="text-[14px] text-muted">
          <th scope="col" className="pb-2 font-semibold">
            Componente
          </th>
          <th scope="col" className="pb-2 font-semibold">
            <em className="font-serif">w</em>
          </th>
          <th scope="col" className="pb-2 font-semibold">
            Nota (0 a 10)
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th colSpan={3} scope="colgroup" className="pt-3 text-[14px] font-semibold">
            Portafolio · {portfolioPct} %
          </th>
        </tr>
        {portfolio.map((c) => rowFor(c))}
      </tbody>
      <tbody>
        <tr>
          <th colSpan={3} scope="colgroup" className="pt-4 text-[14px] font-semibold">
            Examen · {course.examWeightPct} %
          </th>
        </tr>
        {exam.map((c) => rowFor(c))}
      </tbody>
    </table>
  );
}

export function MhThresholdField({ mh100 }: { mh100: number }) {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const parsed = draft === undefined ? null : parseGrade(draft);
  const valid = parsed !== null && parsed.ok && parsed.value100 !== null && parsed.value100 >= 900;
  const error = draft !== undefined && !valid ? "El umbral debe estar entre 9,0 y 10,0." : null;
  const text = draft ?? formatGrade(mh100);

  const onChange = (value: string) => {
    setDraft(value);
    if (timer.current) clearTimeout(timer.current);
    const p = parseGrade(value);
    if (p.ok && p.value100 !== null && p.value100 >= 900) {
      const v = p.value100;
      timer.current = setTimeout(() => {
        setKv(keys.pref.mhThreshold, v);
        timer.current = null;
      }, WRITE_DEBOUNCE_MS);
    }
  };

  return (
    <div className="mt-4 flex max-w-xs flex-col gap-1">
      <label htmlFor="mh-threshold" className="text-[14px] font-semibold">
        Umbral de MH
      </label>
      <Input
        id="mh-threshold"
        inputMode="decimal"
        autoComplete="off"
        className="mono"
        value={text}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "mh-threshold-err" : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (valid) setDraft(undefined);
        }}
      />
      {error ? (
        <p id="mh-threshold-err" className="text-[14px] text-crit">
          {error}
        </p>
      ) : null}
    </div>
  );
}
