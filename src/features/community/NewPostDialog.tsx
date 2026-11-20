import { useState } from "react";
import { X, AlertCircle, Link as LinkIcon, Send } from "lucide-react";
import type { Post, PostCategory } from "../../../shared/community/types.ts";
import { isSafeUrl } from "../../../shared/community/validation.ts";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog.tsx";
import { t } from "../../i18n/index.ts";

export function NewPostDialog({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newPost: Post) => void;
}) {
  const [category, setCategory] = useState<PostCategory>("pregunta");
  const [courseId, setCourseId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [currentLink, setCurrentLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddLink = () => {
    const trimmed = currentLink.trim();
    if (!trimmed) return;
    if (!isSafeUrl(trimmed)) {
      setError("La URL debe comenzar con http:// o https:// y ser válida.");
      return;
    }
    if (links.length >= 5) {
      setError("Máximo 5 enlaces por publicación.");
      return;
    }
    setLinks([...links, trimmed]);
    setCurrentLink("");
    setError(null);
  };

  const handleRemoveLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 5) {
      setError("El título debe tener al menos 5 caracteres.");
      return;
    }
    if (body.trim().length < 1) {
      setError("El contenido no puede estar vacío.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          courseId: courseId || undefined,
          title: title.trim(),
          body: body.trim(),
          links,
        }),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error || `Error ${res.status} al publicar`);
      }

      const created = (await res.json()) as Post;
      onCreated(created);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al enviar la publicación");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <DialogTitle id="new-post-dialog-title" className="text-lg font-bold text-foreground">
            {t.community.newPost}
          </DialogTitle>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar diálogo"
            className="rounded-lg p-1 text-muted hover:text-foreground hover:bg-hover transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <DialogDescription className="sr-only">{t.community.subtitle}</DialogDescription>

        {/* Aviso de integridad académica (COM-08) */}
        <div className="flex items-start gap-2 rounded-xl border border-accent/20 bg-accent/5 p-3 text-xs text-muted">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-accent" />
          <p>{t.community.academicNotice}</p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Categoría */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Categoría
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["pregunta", "recurso", "novedad"] as PostCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-xl border p-2 text-center text-xs font-medium capitalize transition-all ${
                    category === cat
                      ? "border-accent bg-accent/10 text-accent font-semibold ring-1 ring-accent"
                      : "border-border bg-sunken/40 text-muted hover:text-foreground hover:bg-hover"
                  }`}
                >
                  {cat === "pregunta" && t.community.categoryQuestion}
                  {cat === "recurso" && t.community.categoryResource}
                  {cat === "novedad" && t.community.categoryNews}
                </button>
              ))}
            </div>
          </div>

          {/* Asignatura opcional */}
          <div>
            <label htmlFor="post-course" className="block text-xs font-semibold text-foreground mb-1">
              {t.community.courseLabel}
            </label>
            <select
              id="post-course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full rounded-lg border border-border bg-sunken px-3 py-1.5 text-xs text-foreground focus:border-accent focus:outline-hidden"
            >
              <option value="">General (sin asignatura específica)</option>
              <option value="01MIAR">01MIAR - Métodos de Búsqueda y Resolución de Problemas</option>
              <option value="02MIAR">02MIAR - Lógica Computacional y Razonamiento</option>
              <option value="03MIAR">03MIAR - Modelos Probabilísticos y Estadística</option>
              <option value="04MIAR">04MIAR - Aprendizaje Automático</option>
              <option value="05MIAR">05MIAR - Redes Neuronales y Aprendizaje Profundo</option>
              <option value="06MIAR">06MIAR - Procesamiento del Lenguaje Natural</option>
              <option value="07MIAR">07MIAR - Visión Artificial</option>
              <option value="08MIAR">08MIAR - Robótica Inteligente</option>
              <option value="09MIAR">09MIAR - Aspectos Éticos y Legales de la IA</option>
              <option value="10MIAR">10MIAR - Trabajo Fin de Máster (TFM)</option>
            </select>
          </div>

          {/* Título */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="post-title" className="text-xs font-semibold text-foreground">
                {t.community.postTitleLabel}
              </label>
              <span className="text-[10px] text-muted font-mono">{title.length}/160</span>
            </div>
            <input
              id="post-title"
              type="text"
              required
              maxLength={160}
              placeholder={t.community.postTitlePlaceholder}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-border bg-sunken px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-accent focus:outline-hidden"
            />
          </div>

          {/* Cuerpo */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="post-body" className="text-xs font-semibold text-foreground">
                {t.community.postBodyLabel}
              </label>
              <span className="text-[10px] text-muted font-mono">{body.length}/10000</span>
            </div>
            <textarea
              id="post-body"
              required
              rows={5}
              maxLength={10000}
              placeholder={t.community.postBodyPlaceholder}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-lg border border-border bg-sunken p-3 text-xs text-foreground placeholder:text-muted focus:border-accent focus:outline-hidden"
            />
          </div>

          {/* Enlaces (máx 5) */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-foreground">
              {t.community.linksLabel}
            </label>

            {links.length > 0 && (
              <div className="space-y-1.5">
                {links.map((link, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-border bg-sunken px-2.5 py-1 text-xs"
                  >
                    <span className="truncate max-w-sm text-foreground">{link}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(idx)}
                      className="text-muted hover:text-rose-500 transition-colors p-0.5"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {links.length < 5 && (
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://ejemplo.com/recurso"
                  value={currentLink}
                  onChange={(e) => setCurrentLink(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-sunken px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-accent focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleAddLink}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-hover transition-colors"
                >
                  <LinkIcon size={13} />
                  <span>{t.community.addLink}</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:bg-hover transition-colors"
            >
              {t.community.cancelButton}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              <Send size={13} />
              <span>{isSubmitting ? "Publicando..." : t.community.publishButton}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
