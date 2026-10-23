// Sesión de repaso (UI-SPEC section 8 «Repaso», CARD-01, D-05). The queue lives in component state as
// card ids: it follows today's queue until the session starts, then only changes through sessionStep()
// after each grade. Grades go through gradeCard() (srs/<id>) and can be undone for 6 s (T-0409-02).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { dueSummary, sessionStep, type CardView } from "../../../shared/srs/due.ts";
import { nextIntervals, QUALITY_LABEL, type Quality, type Srs } from "../../../shared/srs/sm2.ts";
import { Button, buttonVariants } from "../../components/ui/button.tsx";
import { Chip } from "../../components/ui/chip.tsx";
import { showToast } from "../../components/ui/toast.tsx";
import { gradeCard, restoreSrs, useAllCards, useDecks } from "../../lib/cards-store.ts";
import { cn } from "../../lib/cn.ts";
import { RichText } from "../../lib/tex.tsx";
import { CARDS_BASE, dayLabel, ddmm, tarjetas, useNewCap, useToday, useTodayQueue } from "./DecksPage.tsx";

const GRADES: Quality[] = [1, 3, 4, 5];
const REVEAL_MS = 180;
const SHORTCUT_HINT = "Atajos: Espacio para mostrar, 1–4 para calificar";

type Tally = Record<Quality, number>;
type HistoryEntry = { token: number; queue: string[]; cardId: string; q: Quality; prev: Srs | null; changed: boolean };

const ZERO: Tally = { 1: 0, 3: 0, 4: 0, 5: 0 };

/** Short fronts (one line, no block formula) use Heading 20; long ones stay at Body 16. */
const isShort = (text: string) => text.length <= 60 && !text.includes("\n") && !text.includes("$$");

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function isTextField(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || t.closest("input, textarea, select, [contenteditable='true']") !== null;
}

function Progress({ done, total }: { done: number; total: number }) {
  const i = Math.min(done + 1, total);
  return (
    <div className="flex min-w-[160px] flex-1 items-center gap-2">
      <span className="mono text-[14px] text-muted">
        {i} de {total}
      </span>
      <div
        role="progressbar"
        aria-label="Progreso del repaso"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-2 flex-1 overflow-hidden rounded-full bg-sunken"
      >
        <div className="h-full bg-fg" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

export function ReviewPage() {
  const [params] = useSearchParams();
  const mazo = params.get("mazo");
  const decks = useDecks();
  const all = useAllCards();
  const today = useToday();
  const cap = useNewCap();
  const todayQueue = useTodayQueue(all);
  const deck = mazo ? decks.find((d) => d.id === mazo) : undefined;
  const scope = useMemo(() => (mazo ? all.filter((c) => c.deckId === mazo) : all), [all, mazo]);
  const computed = useMemo(
    () => todayQueue.filter((c) => !mazo || c.deckId === mazo).map((c) => c.id),
    [todayQueue, mazo],
  );
  const byId = useMemo(() => new Map<string, CardView>(all.map((c) => [c.id, c])), [all]);

  const [frozen, setFrozen] = useState<string[] | null>(null);
  const [size, setSize] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [tally, setTally] = useState<Tally>(ZERO);
  const [keyboard, setKeyboard] = useState(false);
  const history = useRef<HistoryEntry[]>([]);
  const seq = useRef(0);
  const groupRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const focusShow = useRef(false);

  const started = frozen !== null;
  // Cards deleted or suspended elsewhere during the session are skipped.
  const queue = (frozen ?? computed).filter((id) => {
    const c = byId.get(id);
    return c !== undefined && !c.suspended;
  });
  const total = started ? size : computed.length;
  const current = queue[0] ? byId.get(queue[0])! : null;
  const done = Math.max(0, total - new Set(queue).size);
  const intervals = useMemo(() => (current ? nextIntervals(current.srs, today) : null), [current, today]);

  const reveal = useCallback(() => {
    if (!current) return;
    if (!started) {
      setFrozen(computed);
      setSize(computed.length);
    }
    setRevealed(true);
  }, [current, started, computed]);

  // After revealing: fade the back in (motion-safe only) and move focus to the grade buttons.
  useEffect(() => {
    if (!revealed) return;
    groupRef.current?.focus();
    const el = backRef.current;
    if (el && typeof el.animate === "function" && !prefersReducedMotion()) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: REVEAL_MS, easing: "ease-out" });
    }
  }, [revealed]);

  useEffect(() => {
    if (!revealed && focusShow.current) {
      focusShow.current = false;
      rootRef.current?.querySelector<HTMLButtonElement>("[data-show-answer]")?.focus();
    }
  });

  const undo = useCallback((token: number) => {
    const last = history.current[history.current.length - 1];
    if (!last || last.token !== token) return;
    history.current.pop();
    if (last.changed) restoreSrs(last.cardId, last.prev);
    setFrozen(last.queue);
    setTally((t) => ({ ...t, [last.q]: Math.max(0, t[last.q] - 1) }));
    setRevealed(false);
    focusShow.current = true;
  }, []);

  const grade = useCallback(
    (q: Quality) => {
      if (!current || !revealed) return;
      const before = frozen ?? computed;
      const { prev, next } = gradeCard(current.id, q);
      const token = ++seq.current;
      history.current.push({ token, queue: before, cardId: current.id, q, prev, changed: next !== prev });
      setFrozen(sessionStep(before, current.id, q));
      setTally((t) => ({ ...t, [q]: t[q] + 1 }));
      setRevealed(false);
      focusShow.current = true;
      showToast({
        message: `Calificada: ${QUALITY_LABEL[q]} · próximo repaso ${ddmm(next.due)}`,
        action: { label: "Deshacer", onAction: () => undo(token) },
      });
    },
    [current, revealed, frozen, computed, undo],
  );

  // Shortcuts: Space reveals, 1–4 grade. Only on this page and never while typing in a field.
  const latest = useRef({ reveal, grade, revealed, current });
  latest.current = { reveal, grade, revealed, current };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTextField(e.target)) return;
      if (e.target instanceof Element && e.target.closest("[role='dialog']")) return;
      setKeyboard(true);
      if (e.repeat) return;
      const s = latest.current;
      if (!s.current) return;
      if (e.key === " " || e.code === "Space") {
        // After revealing, Space keeps its native meaning (activating the focused button).
        if (s.revealed) return;
        e.preventDefault();
        s.reveal();
        return;
      }
      if (s.revealed && /^[1-4]$/.test(e.key)) {
        e.preventDefault();
        s.grade(GRADES[Number(e.key) - 1]!);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const title = deck ? deck.name : "Todos los mazos";
  const finished = !current;
  const next = useMemo(() => dueSummary(scope, today, cap).next, [scope, today, cap]);
  const deckName = (id: string) => decks.find((d) => d.id === id)?.name ?? "";

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex flex-col gap-6",
        // Phone: room for the fixed 2×2 grade buttons above the bottom bar (Approval notes).
        !finished && "max-sm:pb-[calc(2*64px+8px+56px+env(safe-area-inset-bottom))]",
      )}
    >
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 tabIndex={-1} className="font-display text-[20px] font-semibold leading-[1.2]">
          Repaso · {title}
        </h1>
        {!finished ? <Progress done={done} total={total} /> : null}
        <Link to={CARDS_BASE} className={cn(buttonVariants({ variant: "ghost" }), "ml-auto")}>
          Terminar repaso
        </Link>
      </header>

      {finished ? (
        <section
          aria-labelledby="repaso-fin"
          className="mx-auto flex w-full max-w-[640px] flex-col gap-3 rounded-lg border border-border bg-raised p-6"
        >
          <h2 id="repaso-fin" className="text-[20px] font-semibold leading-[1.2]">
            {started || total > 0 ? "Repaso terminado" : "No te toca ninguna tarjeta hoy"}
          </h2>
          {started ? (
            <p className="mono text-[14px]">
              Otra vez {tally[1]} · Difícil {tally[3]} · Bien {tally[4]} · Fácil {tally[5]}
            </p>
          ) : null}
          {next ? (
            <p className="text-muted">
              Próximo repaso: {dayLabel(next.date, today)}, {tarjetas(next.count)}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Link to={CARDS_BASE} className={buttonVariants({ variant: "secondary" })}>
              Volver a Flashcards
            </Link>
            <Link to="/" className={buttonVariants({ variant: "secondary" })}>
              Ir al Command Center
            </Link>
          </div>
        </section>
      ) : (
        <>
          <article
            aria-label="Tarjeta"
            className="mx-auto flex min-h-[240px] w-full max-w-[640px] flex-col gap-4 rounded-lg border border-border bg-raised p-6"
          >
            <Chip tone="outline" className="self-start">
              {deckName(current.deckId)}
            </Chip>
            <div
              className={cn(
                "flex flex-1 items-center justify-center text-center break-words",
                isShort(current.front) ? "text-[20px] font-semibold leading-[1.2]" : "text-[16px]",
              )}
            >
              <RichText key={current.id} text={current.front} />
            </div>
            <div aria-live="polite">
              {revealed ? (
                <div ref={backRef} className="flex flex-col gap-4">
                  <hr className="border-border" />
                  <div className="break-words text-center">
                    <RichText text={current.back} className={current.mono ? "mono" : undefined} />
                  </div>
                </div>
              ) : null}
            </div>
            {!revealed ? (
              <Button
                variant="primary"
                className="w-full touch-manipulation"
                title="Atajo: Espacio"
                onClick={reveal}
                data-show-answer
              >
                Mostrar respuesta
              </Button>
            ) : null}
          </article>

          {revealed && intervals ? (
            <div className="@container mx-auto w-full max-w-[640px]">
              <div
                ref={groupRef}
                role="group"
                aria-label="¿Cómo te ha ido?"
                tabIndex={-1}
                className={cn(
                  "grid grid-cols-2 gap-2 outline-none sm:@[30rem]:grid-cols-4",
                  "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-[calc(56px+env(safe-area-inset-bottom))] max-sm:z-20 max-sm:bg-base max-sm:px-4",
                )}
              >
                {GRADES.map((q, i) => (
                  <Button
                    key={q}
                    variant="secondary"
                    title={`Atajo: ${i + 1}`}
                    className="min-h-16 touch-manipulation flex-col gap-0"
                    onClick={() => grade(q)}
                  >
                    <span>{QUALITY_LABEL[q]}</span>
                    <span className="mono text-[14px] font-normal text-muted">{intervals[q]}</span>
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {keyboard ? <p className="text-center text-[14px] text-muted">{SHORTCUT_HINT}</p> : null}
        </>
      )}
    </div>
  );
}
