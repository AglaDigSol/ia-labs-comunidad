// Card editor: «Anverso» and «Reverso» with a live KaTeX preview
// (300 ms debounce). User text only reaches the DOM through RichText / renderUserTex,
// and both fields are capped at the CardSchema bound of 2000 characters.
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Button } from "../../components/ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog.tsx";
import { Textarea } from "../../components/ui/textarea.tsx";
import { saveCard } from "../../lib/cards-store.ts";
import { RICH_TEXT_HELP, RichText, splitRichText, texError } from "../../lib/tex.tsx";

export const PREVIEW_DEBOUNCE_MS = 300;
const MAX_CHARS = 2000;

/** First KaTeX error of the $…$ / $$…$$ fragments of `text`, as the inline UI message, or null. */
export function texMessage(text: string): string | null {
  for (const seg of splitRichText(text)) {
    if (seg.kind === "text") continue;
    const err = texError(seg.tex, seg.kind === "block");
    if (err) {
      const msg = err.replace(/^KaTeX parse error:\s*/, "").replace(/[.\s]+$/, "");
      return `Hay un error en la fórmula: ${msg}. Revisa llaves y barras invertidas.`;
    }
  }
  return null;
}

function useDebounced(value: string, ms: number): string {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

type FieldProps = {
  label: "Anverso" | "Reverso";
  value: string;
  onChange: (v: string) => void;
  error: string | null;
};

function TexField({ label, value, onChange, error }: FieldProps) {
  const id = useId();
  const preview = useDebounced(value, PREVIEW_DEBOUNCE_MS);
  // The TeX message follows the debounced preview so it does not flicker while typing.
  const tex = texMessage(preview);
  const describedBy = [error ? `${id}-req` : null, tex ? `${id}-tex` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="@container flex flex-col gap-1">
      <label htmlFor={id} className="text-[14px] font-semibold">
        {label}
      </label>
      <div className="grid items-start gap-2 @[40rem]:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Textarea
            id={id}
            value={value}
            maxLength={MAX_CHARS}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-invalid={error || tex ? true : undefined}
            aria-describedby={describedBy}
            className="mono min-h-28 text-[16px]"
            onChange={(e) => onChange(e.target.value)}
          />
          {error ? (
            <p id={`${id}-req`} className="text-[14px] text-crit">
              {error}
            </p>
          ) : null}
          {tex ? (
            <p id={`${id}-tex`} className="text-[14px] text-crit">
              {tex}
            </p>
          ) : null}
        </div>
        <div
          role="region"
          aria-label={`Vista previa del ${label.toLowerCase()}`}
          className="min-h-28 overflow-x-auto rounded-md border border-border bg-base p-3"
        >
          {preview.trim() ? (
            <RichText text={preview} display="block" />
          ) : (
            <p className="text-[14px] text-muted">La vista previa aparecerá aquí.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export type CardEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  /** Edit mode; without it the dialog creates a card. */
  card?: { id: string; front: string; back: string } | null;
  /** Where focus returns when the dialog closes (the row menu trigger or «Nueva tarjeta»). */
  returnFocusRef?: RefObject<HTMLElement | null>;
  onSaved?: (id: string) => void;
};

export function CardEditorDialog({ open, onOpenChange, deckId, card, returnFocusRef, onSaved }: CardEditorDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(card?.id ?? null);
  const [initial, setInitial] = useState({ front: card?.front ?? "", back: card?.back ?? "" });
  const [front, setFront] = useState(initial.front);
  const [back, setBack] = useState(initial.back);
  const [errors, setErrors] = useState<{ front: string | null; back: string | null }>({ front: null, back: null });
  const [confirming, setConfirming] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!open) return;
    const init = { front: card?.front ?? "", back: card?.back ?? "" };
    setEditingId(card?.id ?? null);
    setInitial(init);
    setFront(init.front);
    setBack(init.back);
    setErrors({ front: null, back: null });
    setConfirming(false);
  }, [open, card]);

  useEffect(() => {
    if (confirming) formRef.current?.querySelector<HTMLButtonElement>("[data-keep-editing]")?.focus();
  }, [confirming]);

  const dirty = front !== initial.front || back !== initial.back;
  const focusField = (i: 0 | 1) => formRef.current?.querySelectorAll("textarea")[i]?.focus();

  const requestClose = () => {
    if (dirty) setConfirming(true);
    else onOpenChange(false);
  };

  const save = (another: boolean) => {
    const next = {
      front: front.trim() ? null : "Escribe el anverso de la tarjeta.",
      back: back.trim() ? null : "Escribe el reverso de la tarjeta.",
    };
    setErrors(next);
    if (next.front || next.back) {
      focusField(next.front ? 0 : 1);
      return;
    }
    const id = saveCard(deckId, editingId, { front: front.slice(0, MAX_CHARS), back: back.slice(0, MAX_CHARS) });
    onSaved?.(id);
    if (another) {
      setEditingId(null);
      setInitial({ front: "", back: "" });
      setFront("");
      setBack("");
      focusField(0);
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) onOpenChange(true);
        else requestClose();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-32px)] max-w-[720px] overflow-y-auto"
        onCloseAutoFocus={(e) => {
          const el = returnFocusRef?.current;
          if (el && el.isConnected) {
            e.preventDefault();
            el.focus();
          }
        }}
      >
        <DialogTitle>{editingId ? "Editar tarjeta" : "Nueva tarjeta"}</DialogTitle>
        <DialogDescription>{RICH_TEXT_HELP}.</DialogDescription>
        <form
          ref={formRef}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save(false);
          }}
        >
          <TexField
            label="Anverso"
            value={front}
            error={errors.front}
            onChange={(v) => {
              setFront(v);
              if (errors.front) setErrors((p) => ({ ...p, front: null }));
            }}
          />
          <TexField
            label="Reverso"
            value={back}
            error={errors.back}
            onChange={(v) => {
              setBack(v);
              if (errors.back) setErrors((p) => ({ ...p, back: null }));
            }}
          />
          {confirming ? (
            <div role="alert" className="flex flex-col gap-2 rounded-md border border-border bg-sunken p-3">
              <p className="font-semibold">Tienes cambios sin guardar.</p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button data-keep-editing variant="secondary" onClick={() => setConfirming(false)}>
                  Seguir editando
                </Button>
                <Button variant="destructive" onClick={() => onOpenChange(false)}>
                  Descartar cambios
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={requestClose}>
                Cerrar sin guardar
              </Button>
              <Button variant="secondary" onClick={() => save(true)}>
                Guardar y crear otra
              </Button>
              <Button type="submit" variant="primary">
                Guardar tarjeta
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
