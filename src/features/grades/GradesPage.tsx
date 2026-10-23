import { Info } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { COURSES } from "../../../content/courses/index.ts";
import type { GradeComponent } from "../../../shared/courses/types.ts";
import { MH_THRESHOLD, accumulate, parseGrade } from "../../../shared/grades.ts";
import { keys } from "../../../shared/keys.ts";
import { t } from "../../i18n/index.ts";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group.tsx";
import { deleteKv, setKv, useKv, useKvPrefix } from "../../lib/kv-store.ts";
import { GradeTable, MhThresholdField, WRITE_DEBOUNCE_MS } from "./GradeTable.tsx";
import { LiveFormula } from "./LiveFormula.tsx";
import { ResetGradesDialog } from "./ResetGradesDialog.tsx";
import { TargetCards } from "./TargetCards.tsx";

const ANNOUNCE_DEBOUNCE_MS = 400;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  const sig = JSON.stringify(value);
  const latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    const t = setTimeout(() => setV(latest.current), ms);
    return () => clearTimeout(t);
  }, [sig, ms]);
  return v;
}

export function GradesPage() {
  const [params, setParams] = useSearchParams();
  const course = COURSES.find((c) => c.id === params.get("a")) ?? COURSES[0]!;
  const mh100 = useKv<number>(keys.pref.mhThreshold, MH_THRESHOLD * 100);
  const storedItems = useKvPrefix<number>(`grade/${course.id}/`);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const stored = useMemo(() => {
    const m: Record<string, number | null> = {};
    for (const c of course.components) m[c.id] = null;
    for (const it of storedItems) {
      const id = it.key.slice(`grade/${course.id}/`.length);
      if (id in m && typeof it.value === "number") m[id] = it.value;
    }
    return m;
  }, [storedItems, course]);

  // Drafts are scoped per course so toggling never leaks text between courses.
  const courseDrafts = useMemo(() => {
    const out: Record<string, string> = {};
    const prefix = `${course.id}/`;
    for (const [k, v] of Object.entries(drafts)) if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
    return out;
  }, [drafts, course]);

  const values = useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const c of course.components) {
      const d = courseDrafts[c.id];
      const p = d === undefined ? null : parseGrade(d);
      out[c.id] = p && p.ok ? p.value100 : (stored[c.id] ?? null);
    }
    return out;
  }, [course, courseDrafts, stored]);

  const sources = useMemo(
    () => [...new Set(course.components.map((c) => t.grades.source(c.source.citation, c.source.academicYear, c.source.checkedOn)))],
    [course],
  );

  const liveValues = useDebounced(values, ANNOUNCE_DEBOUNCE_MS);
  const acc = useMemo(() => accumulate(course.components, liveValues), [course, liveValues]);

  useEffect(() => {
    const t = setTimeout(() => document.getElementById(`grade-${course.id}-${course.components[0]!.id}`)?.focus(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = useCallback((courseId: string, componentId: string, value100: number | null) => {
    const key = keys.grade(courseId, componentId);
    if (value100 === null) deleteKv(key);
    else setKv(key, value100);
  }, []);

  const onChange = (c: GradeComponent, text: string) => {
    const dk = `${course.id}/${c.id}`;
    setDrafts((d) => ({ ...d, [dk]: text }));
    const prev = timers.current.get(dk);
    if (prev) clearTimeout(prev);
    timers.current.delete(dk);
    const p = parseGrade(text);
    if (p.ok) {
      const courseId = course.id;
      timers.current.set(
        dk,
        setTimeout(() => {
          timers.current.delete(dk);
          commit(courseId, c.id, p.value100);
        }, WRITE_DEBOUNCE_MS),
      );
    }
  };

  const onBlur = (c: GradeComponent) => {
    const dk = `${course.id}/${c.id}`;
    const text = drafts[dk];
    if (text === undefined) return;
    const p = parseGrade(text);
    if (!p.ok) return;
    const prev = timers.current.get(dk);
    if (prev) {
      clearTimeout(prev);
      timers.current.delete(dk);
      commit(course.id, c.id, p.value100);
    }
    setDrafts((d) => {
      const { [dk]: _drop, ...rest } = d;
      return rest;
    });
  };

  const onReset = () => {
    for (const t of timers.current.values()) clearTimeout(t);
    timers.current.clear();
    setDrafts((d) => {
      const prefix = `${course.id}/`;
      return Object.fromEntries(Object.entries(d).filter(([k]) => !k.startsWith(prefix)));
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 tabIndex={-1} className="text-[20px]">
          Calculadora de notas
        </h1>
        <ToggleGroup
          type="single"
          aria-label="Asignatura"
          value={course.id}
          onValueChange={(v) => {
            if (v) setParams({ a: v });
          }}
        >
          {COURSES.map((c) => (
            <ToggleGroupItem key={c.id} value={c.id} className="mono">
              {c.id}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </header>
      <p className="text-muted">{course.name}</p>
      <p role="note" className="flex items-start gap-2 rounded-md border border-warn bg-warn-bg p-3 text-warn">
        <Info size={20} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>{t.grades.notice}</span>
      </p>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:order-1 lg:col-span-7">
          <GradeTable
            course={course}
            stored={stored}
            drafts={courseDrafts}
            onChange={onChange}
            onBlur={onBlur}
          />
          <MhThresholdField mh100={mh100} />
          <LiveFormula course={course} values={liveValues} accum={acc.accum} />
          <ul className="text-[14px] text-muted">
            {sources.map((src) => (
              <li key={src}>{src}</li>
            ))}
          </ul>
          <div>
            <ResetGradesDialog course={course} onReset={onReset} />
          </div>
        </div>
        <div className="order-first lg:order-2 lg:col-span-5">
          <TargetCards course={course} acc={acc} mh100={mh100} />
        </div>
      </div>
    </div>
  );
}
