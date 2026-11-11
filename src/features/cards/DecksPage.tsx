// Lista de mazos: today's count with the one primary «Repasar {n} tarjetas»,
// decks grouped by course and ordered by session, flat rows with 1px separators. The new-card cap
// is per deck; a deck with nothing today says why and, if the cap held new cards back, offers
// «Repasar 5 más».
import { COURSES as COURSE_DATA } from "../../../content/courses/index.ts";
import { ChevronRight, Layers } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { Course } from "../../../shared/srs/decks.ts";
import { buildQueue, deckDays, dueSummary, EXTRA_NEW_STEP, type CardView, type DeckDay, type DeckView } from "../../../shared/srs/due.ts";
import { addDays } from "../../../shared/srs/sm2.ts";
import { localCivilDate } from "../../../shared/date.ts";
import { Button, buttonVariants } from "../../components/ui/button.tsx";
import { Chip } from "../../components/ui/chip.tsx";
import { addExtraNew, useAllCards, useDecks, useNewCap, useNewExtra } from "../../lib/cards-store.ts";
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

export { useNewCap } from "../../lib/cards-store.ts";

/** Today's queue over every deck (due reviews, then new cards up to each deck's daily cap). */
export function useTodayQueue(cards: readonly CardView[]): CardView[] {
  const today = useToday();
  const cap = useNewCap();
  const extra = useNewExtra(today);
  return useMemo(() => buildQueue(cards, today, cap, extra), [cards, today, cap, extra]);
}

/** Today's numbers per deck (per-deck cap plus today's «Repasar 5 más»). */
export function useDeckDays(cards: readonly CardView[]): Map<string, DeckDay> {
  const today = useToday();
  const cap = useNewCap();
  const extra = useNewExtra(today);
  return useMemo(() => deckDays(cards, today, cap, extra), [cards, today, cap, extra]);
}

/** Why a deck has nothing for today, or null when it has cards today. */
export function emptyReason(d: DeckDay): string | null {
  if (d.today > 0) return null;
  if (d.total === 0) return "Este mazo no tiene tarjetas";
  if (d.heldBack > 0) {
    const n = d.introducedToday;
    return n === 1 ? "Ya viste la nueva de hoy de este mazo" : `Ya viste las ${n} nuevas de hoy de este mazo`;
  }
  return "No quedan tarjetas pendientes";
}

/** «Repasar 5 más» only when the cap is what keeps new cards out today. */
export const canPullMore = (d: DeckDay) => d.newToday === 0 && d.heldBack > 0;

/** «Repasar 5 más» (or fewer if fewer are left): raises today's cap of the deck and opens its review. */
export function PullMoreButton({ deck, day, className }: { deck: DeckView; day: DeckDay; className?: string }) {
  const navigate = useNavigate();
  const k = Math.min(EXTRA_NEW_STEP, day.heldBack);
  return (
    <Button
      variant="secondary"
      aria-label={`Repasar ${k} más del mazo ${deck.name}`}
      className={className}
      onClick={() => {
        addExtraNew(deck.id, k);
        navigate(reviewHref(deck.id));
      }}
    >
      Repasar {k} más
    </Button>
  );
}

const EMPTY_DAY: DeckDay = { today: 0, dueReviews: 0, newToday: 0, fresh: 0, total: 0, introducedToday: 0, cap: 0, heldBack: 0 };

const COURSES: Course[] = COURSE_DATA.map((c) => c.id);

function DeckRow({ deck, stats }: { deck: DeckView; stats: DeckDay }) {
  const reason = emptyReason(stats);
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
        {reason ? <p className="text-[14px] text-muted">{reason}</p> : null}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 self-start sm:self-auto">
        {canPullMore(stats) ? <PullMoreButton deck={deck} day={stats} /> : null}
        {stats.today > 0 ? (
          <Link
            to={reviewHref(deck.id)}
            aria-label={`Repasar mazo ${deck.name}`}
            className={buttonVariants({ variant: "secondary" })}
          >
            Repasar mazo
          </Link>
        ) : (
          <Button variant="secondary" disabled aria-label={`Repasar mazo ${deck.name}`}>
            Repasar mazo
          </Button>
        )}
      </div>
    </li>
  );
}

export function DecksPage() {
  const decks = useDecks();
  const cards = useAllCards();
  const today = useToday();
  const cap = useNewCap();
  const extra = useNewExtra(today);
  const summary = useMemo(() => dueSummary(cards, today, cap, extra), [cards, today, cap, extra]);
  const stats = useDeckDays(cards);
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
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
                <DeckRow key={d.id} deck={d} stats={stats.get(d.id) ?? EMPTY_DAY} />
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
