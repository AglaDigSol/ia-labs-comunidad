// Lista de mazos (UI-SPEC section 8, CARD-01): today's count with the one primary «Repasar {n} tarjetas»,
// decks grouped by course and ordered by session, flat rows with 1px separators.
import { COURSES as COURSE_DATA } from "../../../content/courses/index.ts";
import { ChevronRight, Layers } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { keys } from "../../../shared/keys.ts";
import type { Course } from "../../../shared/srs/decks.ts";
import { buildQueue, DEFAULT_NEW_CARDS_PER_DAY, dueSummary, type CardView, type DeckView } from "../../../shared/srs/due.ts";
import { addDays } from "../../../shared/srs/sm2.ts";
import { localCivilDate } from "../../../shared/date.ts";
import { Button, buttonVariants } from "../../components/ui/button.tsx";
import { Chip } from "../../components/ui/chip.tsx";
import { useAllCards, useDecks } from "../../lib/cards-store.ts";
import { cn } from "../../lib/cn.ts";
import { useKv } from "../../lib/kv-store.ts";
import { useNow } from "../../lib/use-now.ts";
import { NewDeckDialog } from "./NewDeckDialog.tsx";

export const CARDS_BASE = "/flashcards";
export const reviewHref = (deckId?: string) =>
  deckId ? `${CARDS_BASE}/repaso?mazo=${encodeURIComponent(deckId)}` : `${CARDS_BASE}/repaso`;

/** YYYY-MM-DD → dd/mm. */
export const ddmm = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
/** «mañana» for the next civil day, dd/mm otherwise. */
export const dayLabel = (date: string, today: string) => (date === addDays(today, 1) ? "mañana" : ddmm(date));
/** «1 tarjeta» / «{n} tarjetas». */
export const tarjetas = (n: number) => (n === 1 ? "1 tarjeta" : `${n} tarjetas`);
export const sessionLabel = (session: number | null) => (session === null ? "General" : `Sesión ${session}`);

/** Local civil date, re-rendered when the day changes (checked every minute). */
export function useToday(): string {
  return localCivilDate(useNow(60_000));
}

/** pref/newCardsPerDay with the same bounds as cards-store (1–200, default 20). */
export function useNewCap(): number {
  const v = useKv<unknown>(keys.pref.newCardsPerDay, DEFAULT_NEW_CARDS_PER_DAY);
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 200 ? v : DEFAULT_NEW_CARDS_PER_DAY;
}

/** Today's queue over every deck (due reviews, then new cards up to the daily cap). */
export function useTodayQueue(cards: readonly CardView[]): CardView[] {
  const today = useToday();
  const cap = useNewCap();
  return useMemo(() => buildQueue(cards, today, cap), [cards, today, cap]);
}

type DeckStats = { today: number; fresh: number; total: number };

function statsByDeck(cards: readonly CardView[], queue: readonly CardView[]): Map<string, DeckStats> {
  const out = new Map<string, DeckStats>();
  const get = (id: string) => {
    let s = out.get(id);
    if (!s) out.set(id, (s = { today: 0, fresh: 0, total: 0 }));
    return s;
  };
  for (const c of cards) {
    const s = get(c.deckId);
    s.total++;
    if (!c.srs && !c.suspended) s.fresh++;
  }
  for (const c of queue) get(c.deckId).today++;
  return out;
}

const COURSES: Course[] = COURSE_DATA.map((c) => c.id);

function DeckRow({ deck, stats }: { deck: DeckView; stats: DeckStats }) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`${CARDS_BASE}/${deck.id}`}
            className="inline-flex min-h-11 items-center gap-1 font-semibold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {deck.name}
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </Link>
          {deck.seed ? <Chip tone="outline">Del diccionario</Chip> : null}
        </div>
        <p className="flex flex-wrap gap-x-2 text-[14px] text-muted">
          <span>{sessionLabel(deck.session)}</span>
          <span aria-hidden="true">·</span>
          <span className="mono">
            Para hoy {stats.today} · Nuevas {stats.fresh} · Total {stats.total}
          </span>
        </p>
      </div>
      {stats.today > 0 ? (
        <Link
          to={reviewHref(deck.id)}
          aria-label={`Repasar mazo ${deck.name}`}
          className={cn(buttonVariants({ variant: "secondary" }), "shrink-0 self-start sm:self-auto")}
        >
          Repasar mazo
        </Link>
      ) : (
        <Button
          variant="secondary"
          disabled
          aria-label={`Repasar mazo ${deck.name}`}
          className="shrink-0 self-start sm:self-auto"
        >
          Repasar mazo
        </Button>
      )}
    </li>
  );
}

export function DecksPage() {
  const decks = useDecks();
  const cards = useAllCards();
  const today = useToday();
  const cap = useNewCap();
  const queue = useTodayQueue(cards);
  const summary = useMemo(() => dueSummary(cards, today, cap), [cards, today, cap]);
  const stats = useMemo(() => statsByDeck(cards, queue), [cards, queue]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const empty: DeckStats = { today: 0, fresh: 0, total: 0 };
  const n = summary.total;

  return (
    <div className="flex max-w-[880px] flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 tabIndex={-1} className="font-display text-[28px] font-semibold leading-[1.2]">
          Flashcards
        </h1>
        <Button variant="secondary" onClick={() => setDialogOpen(true)}>
          Nuevo mazo
        </Button>
      </header>

      {n > 0 ? (
        <section aria-label="Repaso de hoy" className="flex flex-wrap items-center justify-between gap-4">
          <p className="flex items-center gap-2 text-[20px] font-semibold leading-[1.2]">
            <Layers size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>
              <span className="mono">{n}</span> {n === 1 ? "tarjeta" : "tarjetas"} para hoy
            </span>
          </p>
          <Link to={reviewHref()} className={buttonVariants({ variant: "primary" })}>
            Repasar {tarjetas(n)}
          </Link>
        </section>
      ) : (
        <section aria-label="Repaso de hoy" className="flex flex-col gap-1">
          <h2 className="text-[20px] font-semibold leading-[1.2]">No te toca ninguna tarjeta hoy</h2>
          <p className="text-muted">
            {summary.next
              ? `Próximo repaso: ${dayLabel(summary.next.date, today)}, ${tarjetas(summary.next.count)}. `
              : ""}
            Puedes crear tarjetas nuevas o revisar tus mazos.
          </p>
        </section>
      )}

      {COURSES.map((course) => {
        const list = decks.filter((d) => d.course === course);
        if (list.length === 0) return null;
        return (
          <section key={course} aria-labelledby={`mazos-${course}`} className="flex flex-col gap-1">
            <h2 id={`mazos-${course}`} className="mono text-[20px] font-semibold leading-[1.2]">
              {course}
            </h2>
            <ul className="flex flex-col divide-y divide-border border-y border-border">
              {list.map((d) => (
                <DeckRow key={d.id} deck={d} stats={stats.get(d.id) ?? empty} />
              ))}
            </ul>
          </section>
        );
      })}

      <NewDeckDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={(id) => navigate(`${CARDS_BASE}/${id}`)}
      />
    </div>
  );
}
