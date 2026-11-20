import { useState } from "react";
import { Shield, Pin, EyeOff, Lock, UserX } from "lucide-react";
import type { Post, UserProfile } from "../../../shared/community/types.ts";

export function ModerationControls({
  post,
  viewer,
  onActionComplete,
}: {
  post: Post;
  viewer: UserProfile | undefined;
  onActionComplete: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!viewer || (viewer.role !== "admin" && viewer.role !== "moderator")) {
    return null;
  }

  const handleAction = async (action: string) => {
    if (!reason.trim()) {
      setError("Indica el motivo de moderación para la auditoría.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/community/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          targetType: action.includes("user") ? "user" : "post",
          targetId: action.includes("user") ? post.authorId : post.id,
          reason: reason.trim(),
        }),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error || `Error ${res.status}`);
      }

      setActiveAction(null);
      setReason("");
      setIsOpen(false);
      onActionComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al ejecutar acción");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
          <Shield size={14} className="text-amber-600 dark:text-amber-400" />
          <span>Panel de Moderación (Admin)</span>
        </span>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs font-medium text-amber-800 dark:text-amber-300 hover:underline"
        >
          {isOpen ? "Ocultar herramientas" : "Gestionar publicación"}
        </button>
      </div>

      {isOpen && (
        <div className="pt-2 border-t border-amber-500/20 space-y-3">
          {error && <div className="text-rose-600 dark:text-rose-400 font-medium">{error}</div>}

          {!activeAction ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveAction(post.pinned ? "unpin" : "pin")}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-foreground hover:bg-hover"
              >
                <Pin size={12} />
                <span>{post.pinned ? "Desfijar de cabecera" : "Fijar en cabecera"}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveAction(post.status === "closed" ? "reopen" : "close")}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-foreground hover:bg-hover"
              >
                <Lock size={12} />
                <span>{post.status === "closed" ? "Reabrir conversación" : "Cerrar conversación"}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveAction(post.status === "hidden" ? "restore" : "hide")}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-foreground hover:bg-hover"
              >
                <EyeOff size={12} />
                <span>{post.status === "hidden" ? "Restaurar contenido" : "Ocultar contenido"}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveAction("suspend_user")}
                className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 px-2.5 py-1 hover:bg-rose-500/20"
              >
                <UserX size={12} />
                <span>Suspender publicaciones de {post.authorName}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2 rounded-lg bg-surface p-2.5 border border-border">
              <div className="font-semibold text-foreground">
                Confirmar acción: <span className="font-mono text-accent">{activeAction}</span>
              </div>
              <input
                type="text"
                placeholder="Motivo auditado (ej. Incumplimiento normas de integridad)..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-md border border-border bg-sunken px-2.5 py-1 text-xs text-foreground focus:outline-hidden focus:border-accent"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveAction(null);
                    setReason("");
                  }}
                  className="px-2 py-1 text-muted hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || !reason.trim()}
                  onClick={() => handleAction(activeAction)}
                  className="rounded bg-accent px-3 py-1 font-semibold text-white disabled:opacity-50"
                >
                  Confirmar y registrar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
