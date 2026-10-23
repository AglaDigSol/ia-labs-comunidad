// Detalle del mazo (UI-SPEC section 8, CARD-01/02): cards rendered with KaTeX, schedule per card,
// suspend/reactivate, delete with 6 s undo, and deck edit/delete. Dictionary decks are read-only.
import { ArrowLeft, EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { CardView, DeckView } from "../../../shared/srs/due.ts";
import { Button, buttonVariants } from "../../components/ui/button.tsx";
import { Chip } from "../../components/ui/chip.tsx";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover.tsx";
import { showToast } from "../../components/ui/toast.tsx";
import { deleteCard, deleteDeck, restoreCard, setSuspended, useAllCards, useDeckCards, useDecks } from "../../lib/cards-store.ts";
import { RichText } from "../../lib/tex.tsx";
import { CardEditorDialog } from "./CardEditorDialog.tsx";
import { CARDS_BASE, ddmm, reviewHref, sessionLabel, tarjetas, useTodayQueue } from "./DecksPage.tsx";
import { NewDeckDialog } from "./NewDeckDialog.tsx";

const ITEM =
  "flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-[14px] font-semibold hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
const ICON_BTN =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

/** Arrow keys move between the items of a role="menu" popover. */
function menuKeys(e: KeyboardEvent<HTMLDivElement>) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  if (items.length === 0) return;
  e.preventDefault();
  const i = items.indexOf(document.activeElement as HTMLElement);
  const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
  items[next]?.focus();
}

/** «2,5» (comma decimal, up to 2 decimals). */
const fmtEf = (ef: number) => String(Math.round(ef * 100) / 100).replace(".", ",");

type RowMenuProps = {
  card: CardView;
  label: string;
  onEdit: (trigger: RefObject<HTMLButtonElement | null>) => void;
  onDelete: () => void;
};

function CardRowMenu({ card, label, onEdit, onDelete }: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button ref={trigger} type="button" aria-label={`Acciones de ${label}`} className={ICON_BTN}>
          <EllipsisVertical size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent role="menu" aria-label={`Acciones de ${label}`} className="w-auto min-w-[200px] p-1" onKeyDown={menuKeys}>
        {!card.seed ? (
          <button type="button" role="menuitem" className={ITEM} onClick={run(() => onEdit(trigger))}>
            <Pencil size={20} strokeWidth={1.75} aria-hidden="true" />
            Editar
          </button>
        ) : null}
        <button
          type="button"
          role="menuitem"
          className={ITEM}
          onClick={run(() => setSuspended(card.id, !card.suspended))}
        >
          {card.suspended ? "Reactivar" : "Suspender"}
        </button>
        {!card.seed ? (
          <button type="button" role="menuitem" className={ITEM} onClick={run(onDelete)}>
            <Trash2 size={20} strokeWidth={1.75} aria-hidden="true" />
            Borrar
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function CardRow({
  card,
  index,
  onEdit,
  onDelete,
}: {
  card: CardView;
  index: number;
  onEdit: RowMenuProps["onEdit"];
  onDelete: () => void;
}) {
  const label = `la tarjeta ${index + 1}`;
  return (
    <li className="flex items-start gap-2 py-3">
      <div className="@container flex min-w-0 flex-1 flex-col gap-2">
        <div className="grid gap-2 @[40rem]:grid-cols-2 @[40rem]:gap-4">
          <div className="min-w-0 break-words">
            <span className="sr-only">Anverso: </span>
            <RichText text={card.front} />
          </div>
          <div className="min-w-0 break-words text-muted">
            <span className="sr-only">Reverso: </span>
            <RichText text={card.back} className={card.mono ? "mono" : undefined} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted">
          {card.srs ? (
            <span className="mono">
              Próximo: {ddmm(card.srs.due)} · EF {fmtEf(card.srs.ef)}
            </span>
          ) : (
            <span>Nueva</span>
          )}
          {card.suspended ? <Chip tone="outline">Suspendida</Chip> : null}
        </div>
      </div>
      <CardRowMenu card={card} label={label} onEdit={onEdit} onDelete={onDelete} />
    </li>
  );
}

function DeckMenu({ onEdit, onDelete, name }: { onEdit: () => void; onDelete: () => void; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Acciones del mazo ${name}`} className={ICON_BTN}>
          <EllipsisVertical size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent role="menu" aria-label={`Acciones del mazo ${name}`} className="w-auto min-w-[200px] p-1" onKeyDown={menuKeys}>
        <button
          type="button"
          role="menuitem"
          className={ITEM}
          onClick={() => {
            setOpen(false);
            onEdit();
          }}
        >
          <Pencil size={20} strokeWidth={1.75} aria-hidden="true" />
          Editar mazo
        </button>
        <button
          type="button"
          role="menuitem"
          className={ITEM}
          onClick={() => {
            setOpen(false);
            onDelete();
          }}
        >
          <Trash2 size={20} strokeWidth={1.75} aria-hidden="true" />
          Borrar mazo
        </button>
      </PopoverContent>
    </Popover>
  );
}

function BackLink() {
  return (
    <Link
      to={CARDS_BASE}
      className="inline-flex min-h-11 items-center gap-1 self-start text-[14px] font-semibold text-accent hover:underline"
    >
      <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
      Volver a Flashcards
    </Link>
  );
}

function DeckDetail({ deck }: { deck: DeckView }) {
  const cards = useDeckCards(deck.id);
  const all = useAllCards();
  const queue = useTodayQueue(all);
  const dueHere = useMemo(() => queue.filter((c) => c.deckId === deck.id).length, [queue, deck.id]);
  const navigate = useNavigate();
  const newBtn = useRef<HTMLElement | null>(null);
  const [editor, setEditor] = useState<{
    open: boolean;
    card: CardView | null;
    focus: RefObject<HTMLElement | null> | undefined;
  }>({ open: false, card: null, focus: undefined });
  const [deckDialog, setDeckDialog] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const empty = cards.length === 0;

  const openNew = (focus: RefObject<HTMLElement | null>) => setEditor({ open: true, card: null, focus });
  const removeCard = (c: CardView) => {
    const snap = deleteCard(c.deckId, c.id);
    showToast({ message: "Tarjeta borrada", action: { label: "Deshacer", onAction: () => restoreCard(snap) } });
  };

  return (
    <div className="flex max-w-[880px] flex-col gap-6">
      <BackLink />
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 tabIndex={-1} className="font-display text-[28px] font-semibold leading-[1.2]">
            {deck.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {!deck.seed && !empty ? (
              <Button
                variant="secondary"
                onClick={(e) => {
                  newBtn.current = e.currentTarget;
                  openNew(newBtn);
                }}
              >
                Nueva tarjeta
              </Button>
            ) : null}
            {dueHere > 0 ? (
              <Link to={reviewHref(deck.id)} className={buttonVariants({ variant: "secondary" })}>
                Repasar mazo
              </Link>
            ) : (
              <Button variant="secondary" disabled>
                Repasar mazo
              </Button>
            )}
            {!deck.seed ? (
              <DeckMenu name={deck.name} onEdit={() => setDeckDialog(true)} onDelete={() => setConfirmDelete(true)} />
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="outline" className="mono">
            {deck.course}
          </Chip>
          <Chip tone="outline">{sessionLabel(deck.session)}</Chip>
          {deck.seed ? <Chip tone="outline">Del diccionario</Chip> : null}
          <span className="mono text-[14px] text-muted">{tarjetas(cards.length)}</span>
        </div>
        {deck.seed ? (
          <p className="text-[14px] text-muted">
            Este mazo se genera desde el diccionario de simbología y se actualiza con él.
          </p>
        ) : null}
      </header>

      {empty ? (
        <section className="flex flex-col items-start gap-2 border-y border-border py-6">
          <h2 className="text-[20px] font-semibold leading-[1.2]">Este mazo está vacío</h2>
          <p className="text-muted">Crea la primera tarjeta. Puedes usar $…$ para fórmulas en KaTeX.</p>
          <Button
            variant="secondary"
            onClick={(e) => {
              newBtn.current = e.currentTarget;
              openNew(newBtn);
            }}
          >
            Nueva tarjeta
          </Button>
        </section>
      ) : (
        <ul aria-label="Tarjetas" className="flex flex-col divide-y divide-border border-y border-border">
          {cards.map((c, i) => (
            <CardRow
              key={c.id}
              card={c}
              index={i}
              onEdit={(focus) => setEditor({ open: true, card: c, focus })}
              onDelete={() => removeCard(c)}
            />
          ))}
        </ul>
      )}

      {!deck.seed ? (
        <>
          <CardEditorDialog
            open={editor.open}
            onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
            deckId={deck.id}
            card={editor.card}
            returnFocusRef={editor.focus}
          />
          <NewDeckDialog
            open={deckDialog}
            onOpenChange={setDeckDialog}
            deck={{ id: deck.id, name: deck.name, course: deck.course, session: deck.session }}
          />
          <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <DialogContent>
              <DialogTitle>Borrar mazo</DialogTitle>
              <DialogDescription>
                Borrar el mazo «{deck.name}»: se borrarán sus {tarjetas(cards.length)} y su programación de repaso.
              </DialogDescription>
              <div className="flex flex-wrap justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="secondary">Conservar mazo</Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={() => {
                    deleteDeck(deck.id);
                    setConfirmDelete(false);
                    navigate(CARDS_BASE);
                  }}
                >
                  Borrar mazo
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}

export function DeckPage() {
  const { mazo = "" } = useParams();
  const decks = useDecks();
  const deck = decks.find((d) => d.id === mazo);
  if (!deck) {
    return (
      <div className="flex max-w-[880px] flex-col gap-4">
        <BackLink />
        <h1 tabIndex={-1} className="font-display text-[28px] font-semibold leading-[1.2]">
          Este mazo no existe
        </h1>
        <p className="text-muted">Puede que se haya borrado o que el enlace no sea correcto.</p>
      </div>
    );
  }
  return <DeckDetail key={deck.id} deck={deck} />;
}
