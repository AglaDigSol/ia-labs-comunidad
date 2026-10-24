// «Nuevo mazo» / «Editar mazo». Decks are per course and session.
import { COURSES as COURSE_DATA } from "../../../content/courses/index.ts";
import { useEffect, useId, useState } from "react";
import type { Course } from "../../../shared/srs/decks.ts";
import { Button } from "../../components/ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog.tsx";
import { Input } from "../../components/ui/input.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.tsx";
import { saveDeck } from "../../lib/cards-store.ts";

const GENERAL = "general";
const SESSIONS = Array.from({ length: 40 }, (_, i) => i + 1);
const COURSES: Course[] = COURSE_DATA.map((c) => c.id);

export type DeckDraft = { name: string; course: Course; session: number | null };

export type NewDeckDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit mode: the deck being edited. Without it the dialog creates a deck. */
  deck?: DeckDraft & { id: string };
  /** Called with the id of the saved deck (create: navigate to it). */
  onSaved?: (id: string) => void;
};

export function NewDeckDialog({ open, onOpenChange, deck, onSaved }: NewDeckDialogProps) {
  const [course, setCourse] = useState<Course>(deck?.course ?? COURSES[0]!);
  const [session, setSession] = useState<string>(deck?.session ? String(deck.session) : GENERAL);
  const [name, setName] = useState(deck?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const ids = { course: useId(), session: useId(), name: useId(), error: useId() };

  // Reset the form every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setCourse(deck?.course ?? COURSES[0]!);
    setSession(deck?.session ? String(deck.session) : GENERAL);
    setName(deck?.name ?? "");
    setError(null);
  }, [open, deck]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Escribe un nombre para el mazo.");
      document.getElementById(ids.name)?.focus();
      return;
    }
    const id = saveDeck(deck?.id ?? null, {
      name: trimmed.slice(0, 80),
      course,
      session: session === GENERAL ? null : Number(session),
    });
    onOpenChange(false);
    onSaved?.(id);
  };

  const editing = Boolean(deck);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{editing ? "Editar mazo" : "Nuevo mazo"}</DialogTitle>
        <DialogDescription>Cada mazo pertenece a una asignatura y a una sesión.</DialogDescription>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-1">
            <label id={ids.course} className="text-[14px] font-semibold">
              Asignatura
            </label>
            <Select value={course} onValueChange={(v) => setCourse(v as Course)}>
              <SelectTrigger aria-labelledby={ids.course} className="mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COURSES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label id={ids.session} className="text-[14px] font-semibold">
              Sesión
            </label>
            <Select value={session} onValueChange={setSession}>
              <SelectTrigger aria-labelledby={ids.session}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[320px] overflow-y-auto">
                {SESSIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Sesión {n}
                  </SelectItem>
                ))}
                <SelectItem value={GENERAL}>General</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.name} className="text-[14px] font-semibold">
              Nombre
            </label>
            <Input
              id={ids.name}
              value={name}
              maxLength={80}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? ids.error : undefined}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
            />
            {error ? (
              <p id={ids.error} className="text-[14px] text-crit">
                {error}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {editing ? "Cerrar sin guardar" : "Cerrar sin crear"}
            </Button>
            <Button type="submit" variant="primary">
              {editing ? "Guardar mazo" : "Crear mazo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
