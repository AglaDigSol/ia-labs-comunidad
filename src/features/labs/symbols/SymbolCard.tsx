import { Copy, Square, Volume2 } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { symbolById } from "../../../../shared/symbols/index.ts";
import { CATEGORY_LABELS, type SymbolEntry } from "../../../../shared/symbols/types.ts";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip.tsx";
import { Tex } from "../../../lib/tex.tsx";
import { useSpeech } from "../../../lib/speech.ts";

export const UNSUPPORTED_MSG = "Tu navegador no puede leer en voz alta. Usa la lectura escrita de la ficha.";
export const NO_VOICE_MSG =
  "No hay una voz en español instalada en este dispositivo. Se usará la voz predeterminada, que puede leer mal los símbolos.";
export const ERROR_MSG = "No se pudo reproducir la lectura. Inténtalo de nuevo.";

/** Text handed to the speech engine: the symbol reading plus its example formula (SYM-03). */
export function speechText(entry: SymbolEntry): string {
  return entry.example ? `${entry.spoken}. Por ejemplo: ${entry.example.spoken}` : entry.spoken;
}

const LIB_LABEL = { python: "Python", numpy: "NumPy", pytorch: "PyTorch" } as const;

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`text-[12px] font-semibold uppercase tracking-wide text-muted ${className}`}>{children}</span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-4">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

function CopyButton({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1500);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <>
      <Button
        variant="ghost"
        className="min-w-11 px-0"
        aria-label="Copiar código"
        onClick={() => {
          void navigator.clipboard?.writeText(code).then(() => setDone(true));
        }}
      >
        <Copy size={16} strokeWidth={1.75} aria-hidden="true" />
      </Button>
      <span className="sr-only" aria-live="polite">
        {done ? "Código copiado" : ""}
      </span>
    </>
  );
}

function SpeakButton({ entry }: { entry: SymbolEntry }) {
  const sp = useSpeech();
  const noVoice = sp.supported && sp.voicesLoaded && !sp.hasSpanishVoice;

  if (!sp.supported) {
    return (
      <div className="flex flex-col items-start gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button aria-disabled="true" className="cursor-not-allowed opacity-50" onClick={(e) => e.preventDefault()}>
                <Volume2 size={16} strokeWidth={1.75} aria-hidden="true" />
                Escuchar lectura
              </Button>
            </TooltipTrigger>
            <TooltipContent>{UNSUPPORTED_MSG}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Chip tone="info">{UNSUPPORTED_MSG}</Chip>
      </div>
    );
  }

  const label = sp.speaking ? "Detener lectura" : noVoice ? "Escuchar con voz predeterminada" : "Escuchar lectura";
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        aria-pressed={sp.speaking}
        onClick={() => {
          if (sp.speaking) sp.stop();
          else sp.speak(speechText(entry));
        }}
      >
        {sp.speaking ? (
          <Square size={16} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Volume2 size={16} strokeWidth={1.75} aria-hidden="true" />
        )}
        {label}
      </Button>
      <span className="sr-only" aria-live="polite">
        {sp.speaking ? "Escuchando…" : ""}
      </span>
      {noVoice ? <Chip tone="warn">{NO_VOICE_MSG}</Chip> : null}
      {sp.error ? (
        <Chip tone="crit" role="alert">
          {ERROR_MSG}
        </Chip>
      ) : null}
    </div>
  );
}

export function SymbolCard({
  entry,
  onSelectRelated,
  hideName = false,
}: {
  entry: SymbolEntry;
  onSelectRelated: (id: string) => void;
  hideName?: boolean;
}) {
  const related = (entry.related ?? []).map((id) => symbolById(id)).filter((e): e is SymbolEntry => !!e);
  const sessionLabel = entry.session === "posterior" ? "Posterior" : `S${entry.session}`;
  return (
    <article
      aria-label={`Ficha: ${entry.name}`}
      className="flex flex-col gap-4 rounded-lg border border-border bg-raised p-4"
    >
      <header className="flex flex-col gap-2">
        <Label>Símbolo</Label>
        <Tex tex={entry.tex} display label={entry.name} className="text-[20px]" />
        {hideName ? null : <h2 className="font-display text-[20px] font-semibold">{entry.name}</h2>}
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="outline">{CATEGORY_LABELS[entry.category]}</Chip>
          <Label>Sesión</Label>
          <Chip tone="info" className="font-mono">
            {sessionLabel}
          </Chip>
        </div>
      </header>

      {entry.variants.length > 0 ? (
        <Section title="Variantes de notación">
          <ul className="flex flex-wrap items-baseline gap-x-2 gap-y-2">
            {entry.variants.map((v, i) => (
              <Fragment key={`${v.convention}-${i}`}>
                {i > 0 ? (
                  <li aria-hidden="true" className="text-muted">
                    ·
                  </li>
                ) : null}
                <li className="flex items-baseline gap-2">
                  {v.tex ? <Tex tex={v.tex} /> : <code className="font-mono text-[14px]">{v.text}</code>}
                  <Label>{v.convention}</Label>
                </li>
              </Fragment>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Cómo se lee en clase">
        <p>«{entry.reading}»</p>
        {(entry.altReadings ?? []).map((a) => (
          <p key={a} className="text-muted">
            también «{a}»
          </p>
        ))}
        {entry.example ? (
          <div className="flex flex-col gap-1">
            <Tex tex={entry.example.tex} display label={entry.example.reading} />
            <p>«{entry.example.reading}»</p>
          </div>
        ) : null}
        <SpeakButton entry={entry} />
      </Section>

      <Section title="Equivalente en Python">
        {entry.code.length === 0 ? <Label>Sin equivalente directo en Python</Label> : null}
        {entry.code.map((c, i) => (
          <div key={`${c.lib}-${i}`} className="flex flex-col gap-1">
            <Label>{LIB_LABEL[c.lib]}</Label>
            <div className="flex items-start gap-2">
              <pre className="min-w-0 flex-1 overflow-x-auto rounded-md bg-sunken p-3 font-mono text-[14px]">
                <code>{c.code}</code>
              </pre>
              <CopyButton code={c.code} />
            </div>
            {c.note ? <p className="text-muted">{c.note}</p> : null}
          </div>
        ))}
        {entry.codeNote ? <p className="text-muted">{entry.codeNote}</p> : null}
      </Section>

      {related.length > 0 ? (
        <Section title="Símbolos relacionados">
          <ul className="flex flex-wrap gap-2">
            {related.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelectRelated(r.id)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-[14px] font-semibold hover:bg-sunken"
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </article>
  );
}
