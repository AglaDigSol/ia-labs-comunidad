import { useState } from "react";
import { Link as LinkIcon, Send, X } from "lucide-react";
import type { Reply } from "../../../shared/community/types.ts";
import { isSafeUrl } from "../../../shared/community/validation.ts";
import { t } from "../../i18n/index.ts";

export function ReplyForm({
  postId,
  onReplyCreated,
}: {
  postId: string;
  onReplyCreated: (reply: Reply) => void;
}) {
  const [body, setBody] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [currentLink, setCurrentLink] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddLink = () => {
    const trimmed = currentLink.trim();
    if (!trimmed) return;
    if (!isSafeUrl(trimmed)) {
      setError("La URL debe comenzar con http:// o https://");
      return;
    }
    if (links.length >= 5) {
      setError("Máximo 5 enlaces.");
      return;
    }
    setLinks([...links, trimmed]);
    setCurrentLink("");
    setShowLinkInput(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (body.trim().length === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/community/posts/${postId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: body.trim(),
          links,
        }),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error || `Error ${res.status}`);
      }

      const created = (await res.json()) as Reply;
      onReplyCreated(created);
      setBody("");
      setLinks([]);
      setShowLinkInput(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al enviar respuesta");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface p-4 shadow-2xs space-y-3">
      {error && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      <div>
        <label htmlFor={`reply-body-${postId}`} className="sr-only">
          {t.community.sendReply}
        </label>
        <textarea
          id={`reply-body-${postId}`}
          rows={3}
          maxLength={5000}
          placeholder={t.community.replyPlaceholder}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full rounded-lg border border-border bg-sunken p-3 text-xs text-foreground placeholder:text-muted focus:border-accent focus:outline-hidden"
        />
      </div>

      {links.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {links.map((link, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 rounded bg-sunken px-2 py-0.5 text-[11px] text-foreground font-mono"
            >
              <span className="truncate max-w-[180px]">{link}</span>
              <button
                type="button"
                onClick={() => setLinks(links.filter((_, i) => i !== idx))}
                className="text-muted hover:text-rose-500"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {showLinkInput && (
        <div className="flex items-center gap-2">
          <input
            type="url"
            placeholder="https://ejemplo.com"
            value={currentLink}
            onChange={(e) => setCurrentLink(e.target.value)}
            className="flex-1 rounded-md border border-border bg-sunken px-2.5 py-1 text-xs text-foreground placeholder:text-muted focus:border-accent focus:outline-hidden"
          />
          <button
            type="button"
            onClick={handleAddLink}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-hover"
          >
            Añadir
          </button>
          <button
            type="button"
            onClick={() => setShowLinkInput(false)}
            className="text-xs text-muted hover:text-foreground"
          >
            Cancelar
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-border/50">
        <div className="flex items-center gap-2">
          {!showLinkInput && links.length < 5 && (
            <button
              type="button"
              onClick={() => setShowLinkInput(true)}
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
            >
              <LinkIcon size={12} />
              <span>Adjuntar enlace</span>
            </button>
          )}
          <span className="text-[10px] text-muted font-mono">{body.length}/5000</span>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || body.trim().length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-accent/90 transition-colors disabled:opacity-40"
        >
          <Send size={12} />
          <span>{isSubmitting ? "Enviando..." : t.community.sendReply}</span>
        </button>
      </div>
    </form>
  );
}
