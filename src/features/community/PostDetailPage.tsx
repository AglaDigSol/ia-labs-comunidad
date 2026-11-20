import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  CheckCircle2,
  Edit2,
  Flag,
  Link as LinkIcon,
  Lock,
  MessageSquare,
  Pin,
  Trash2,
  X,
} from "lucide-react";
import type { PostDetailResponse, Reply, UserProfile } from "../../../shared/community/types.ts";
import { isSafeUrl } from "../../../shared/community/validation.ts";
import { formatInTimezone } from "../../../shared/timezone/format.ts";
import { Button } from "../../components/ui/button.tsx";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog.tsx";
import { useTimezone } from "../calendar/TimezoneContext.tsx";
import { ExternalLink } from "./ExternalLink.tsx";
import { ReplyForm } from "./ReplyForm.tsx";
import { ReportDialog } from "./ReportDialog.tsx";
import { ModerationControls } from "./ModerationControls.tsx";
import { t } from "../../i18n/index.ts";

export function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { timezone } = useTimezone();

  const [detail, setDetail] = useState<PostDetailResponse | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [reportTarget, setReportTarget] = useState<{ type: "post" | "reply"; id: string } | null>(null);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editLinks, setEditLinks] = useState<string[]>([]);
  const [newEditLink, setNewEditLink] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmRemovePost, setConfirmRemovePost] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editReplyBody, setEditReplyBody] = useState("");
  const [replyEditError, setReplyEditError] = useState<string | null>(null);
  const [confirmRemoveReplyId, setConfirmRemoveReplyId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Obtener usuario actual
      const meRes = await fetch("/api/community/auth/me");
      if (meRes.ok) {
        const user = (await meRes.json()) as UserProfile;
        setCurrentUser(user);
      }

      // 2. Obtener detalle de publicación
      const res = await fetch(`/api/community/posts/${postId}`);
      if (!res.ok) throw new Error("Publicación no encontrada");
      const data = (await res.json()) as PostDetailResponse;
      setDetail(data);
      setEditTitle(data.post.title);
      setEditBody(data.post.body);
      setEditLinks([...(data.post.links ?? [])]);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="py-12 text-center text-sm text-muted animate-pulse">
        {t.app.loading}
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="py-12 text-center space-y-3">
        <p className="text-sm text-muted">La publicación solicitada no existe o ha sido retirada.</p>
        <Link to="/comunidad" className="text-xs font-semibold text-accent hover:underline">
          ← Volver a la comunidad
        </Link>
      </div>
    );
  }

  const { post, replies } = detail;
  const isPostAuthor = currentUser && currentUser.id === post.authorId;
  const isAdmin = currentUser && (currentUser.role === "admin" || currentUser.role === "moderator");

  const handleAcceptReply = async (replyId: string) => {
    if (!isPostAuthor) return;
    try {
      const isCurrentlyAccepted = post.acceptedReplyId === replyId;
      const res = await fetch(`/api/community/posts/${post.id}/accept-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyId: isCurrentlyAccepted ? null : replyId }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch {
      // noop
    }
  };

  const handleAddEditLink = () => {
    const trimmed = newEditLink.trim();
    if (!trimmed) return;
    if (!isSafeUrl(trimmed)) {
      setEditError("La URL debe comenzar con http:// o https:// y ser válida.");
      return;
    }
    if (editLinks.length >= 5) {
      setEditError("Máximo 5 enlaces por publicación.");
      return;
    }
    setEditLinks([...editLinks, trimmed]);
    setNewEditLink("");
    setEditError(null);
  };

  const handleRemoveEditLink = (index: number) => {
    setEditLinks(editLinks.filter((_, i) => i !== index));
  };

  const handleRemovePost = async () => {
    try {
      const res = await fetch(`/api/community/posts/${post.id}`, { method: "DELETE" });
      if (res.ok) {
        setConfirmRemovePost(false);
        navigate("/comunidad");
      }
    } catch {
      // noop
    }
  };

  const handleSavePostEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    const cleanTitle = editTitle.trim();
    const cleanBody = editBody.trim();
    if (cleanTitle.length < 5) {
      setEditError("El título debe tener al menos 5 caracteres.");
      return;
    }
    if (cleanBody.length < 1) {
      setEditError("El contenido no puede estar vacío.");
      return;
    }
    try {
      const res = await fetch(`/api/community/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: cleanTitle, body: cleanBody, links: editLinks }),
      });
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        setEditError(errJson.error || `Error ${res.status} al guardar los cambios.`);
        return;
      }
      setIsEditingPost(false);
      fetchData();
    } catch {
      setEditError("No se pudieron guardar los cambios.");
    }
  };

  const handleSaveReplyEdit = async (e: React.FormEvent, replyId: string) => {
    e.preventDefault();
    setReplyEditError(null);
    const cleanBody = editReplyBody.trim();
    if (cleanBody.length < 1) {
      setReplyEditError("La respuesta no puede estar vacía.");
      return;
    }
    try {
      const res = await fetch(`/api/community/posts/${post.id}/replies/${replyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: cleanBody }),
      });
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        setReplyEditError(errJson.error || `Error ${res.status} al actualizar la respuesta.`);
        return;
      }
      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          replies: prev.replies.map((r) => (r.id === replyId ? { ...r, body: cleanBody } : r)),
        };
      });
      setEditingReplyId(null);
      setEditReplyBody("");
    } catch {
      setReplyEditError("No se pudo actualizar la respuesta.");
    }
  };

  const handleRemoveReply = async (replyId: string) => {
    try {
      const res = await fetch(`/api/community/posts/${post.id}/replies/${replyId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDetail((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            post: {
              ...prev.post,
              replyCount: Math.max(0, prev.post.replyCount - 1),
              acceptedReplyId: prev.post.acceptedReplyId === replyId ? undefined : prev.post.acceptedReplyId,
              isResolved: prev.post.acceptedReplyId === replyId ? false : prev.post.isResolved,
            },
            replies: prev.replies.filter((r) => r.id !== replyId),
          };
        });
        setConfirmRemoveReplyId(null);
      }
    } catch {
      // noop
    }
  };

  const handleReplyCreated = (newReply: Reply) => {
    setDetail((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        post: { ...prev.post, replyCount: prev.post.replyCount + 1 },
        replies: [...prev.replies, newReply],
      };
    });
  };

  const postDateStr = formatInTimezone(post.createdAt, timezone, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-6">
      {/* Botón volver */}
      <Link
        to="/comunidad"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} />
        <span>Volver a publicaciones</span>
      </Link>

      {/* Panel de moderación administrativo si aplica */}
      <ModerationControls post={post} viewer={currentUser} onActionComplete={fetchData} />

      {/* Tarjeta principal de la publicación */}
      <article className="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-4">
        {/* Metadatos superiores */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-accent/15 px-2 py-0.5 font-semibold text-accent uppercase text-[11px]">
              {post.category}
            </span>
            {post.courseId && (
              <span className="rounded-md bg-sunken px-2 py-0.5 font-mono text-[11px] font-medium text-foreground">
                {post.courseId}
              </span>
            )}
            {post.pinned && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
                <Pin size={12} />
                <span>Fijado</span>
              </span>
            )}
            {post.isResolved && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <CheckCircle2 size={12} />
                <span>Resuelta</span>
              </span>
            )}
            {post.status === "closed" && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted">
                <Lock size={12} />
                <span>Cerrada</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-muted">
            <span className="font-medium text-foreground">{post.authorName}</span>
            <span>·</span>
            <span>{postDateStr}</span>
          </div>
        </div>

        {/* Título y cuerpo o formulario de edición */}
        {isEditingPost ? (
          <form onSubmit={handleSavePostEdit} className="space-y-3">
            {editError && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-400">
                {editError}
              </div>
            )}
            <input
              type="text"
              value={editTitle}
              maxLength={160}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-lg border border-border bg-sunken px-3 py-1.5 text-sm font-bold text-foreground focus:outline-hidden focus:border-accent"
            />
            <textarea
              rows={6}
              maxLength={10000}
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="w-full rounded-lg border border-border bg-sunken p-3 text-xs text-foreground focus:outline-hidden focus:border-accent"
            />
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-foreground">{t.community.linksLabel}</span>
              {editLinks.length > 0 && (
                <div className="space-y-1.5">
                  {editLinks.map((link, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border border-border bg-sunken px-2.5 py-1 text-xs"
                    >
                      <span className="truncate max-w-sm text-foreground">{link}</span>
                      <button
                        type="button"
                        aria-label={`Quitar enlace ${link}`}
                        onClick={() => handleRemoveEditLink(idx)}
                        className="text-muted hover:text-rose-500 transition-colors p-0.5"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {editLinks.length < 5 && (
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://ejemplo.com/recurso"
                    value={newEditLink}
                    onChange={(e) => setNewEditLink(e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-sunken px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-accent focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleAddEditLink}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-hover transition-colors"
                  >
                    <LinkIcon size={13} />
                    <span>{t.community.addLink}</span>
                  </button>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditingPost(false);
                  setEditError(null);
                }}
                className="px-3 py-1 text-xs text-muted hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-accent px-3.5 py-1 text-xs font-semibold text-white"
              >
                Guardar cambios
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <h1 className="text-xl font-bold text-foreground leading-snug">{post.title}</h1>
            <div className="whitespace-pre-line text-sm text-foreground/90 leading-relaxed">
              {post.body}
            </div>

            {/* Enlaces externos */}
            {post.links && post.links.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border/50 space-y-1.5">
                <span className="block text-[11px] font-semibold text-muted uppercase">
                  Enlaces compartidos
                </span>
                <div className="flex flex-wrap gap-2">
                  {post.links.map((link, idx) => (
                    <ExternalLink key={idx} url={link} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Acciones de publicación (editar, retirar, reportar) */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60 text-xs">
          {(isPostAuthor || isAdmin) && !isEditingPost && (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditTitle(post.title);
                  setEditBody(post.body);
                  setEditLinks([...(post.links ?? [])]);
                  setNewEditLink("");
                  setEditError(null);
                  setIsEditingPost(true);
                }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted hover:text-foreground hover:bg-hover"
              >
                <Edit2 size={12} />
                <span>{t.community.edit}</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmRemovePost(true)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-rose-600 hover:bg-rose-500/10"
              >
                <Trash2 size={12} />
                <span>{t.community.remove}</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setReportTarget({ type: "post", id: post.id })}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted hover:text-foreground hover:bg-hover"
          >
            <Flag size={12} />
            <span>{t.community.report}</span>
          </button>
        </div>
      </article>

      {/* Hilo de respuestas */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <MessageSquare size={18} className="text-accent" />
          <span>{t.community.repliesTitle}</span>
          <span className="rounded-full bg-sunken px-2 py-0.5 text-xs font-mono text-muted">
            {replies.length}
          </span>
        </h2>

        {replies.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted">
            {t.community.noReplies}
          </div>
        ) : (
          <div className="space-y-3">
            {replies.map((reply) => {
              const isAccepted = post.acceptedReplyId === reply.id;
              const isReplyAuthor = Boolean(currentUser && currentUser.id === reply.authorId);
              const isEditingThisReply = editingReplyId === reply.id;
              const replyDate = formatInTimezone(reply.createdAt, timezone, {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={reply.id}
                  className={`rounded-xl border p-4 shadow-2xs space-y-3 transition-colors ${
                    isAccepted
                      ? "border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/30"
                      : "border-border bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs border-b border-border/40 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{reply.authorName}</span>
                      {isAccepted && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 size={11} />
                          <span>{t.community.badgeAccepted}</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted">{replyDate}</span>
                  </div>

                  {isEditingThisReply ? (
                    <form onSubmit={(e) => void handleSaveReplyEdit(e, reply.id)} className="space-y-2">
                      {replyEditError && (
                        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-xs text-rose-600 dark:text-rose-400">
                          {replyEditError}
                        </div>
                      )}
                      <textarea
                        rows={3}
                        maxLength={5000}
                        value={editReplyBody}
                        onChange={(e) => setEditReplyBody(e.target.value)}
                        className="w-full rounded-lg border border-border bg-sunken p-2.5 text-xs text-foreground focus:outline-hidden focus:border-accent"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingReplyId(null);
                            setReplyEditError(null);
                          }}
                          className="px-2.5 py-1 text-xs text-muted hover:text-foreground"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white"
                        >
                          Guardar respuesta
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="whitespace-pre-line text-xs text-foreground leading-relaxed">
                        {reply.body}
                      </div>

                      {reply.links && reply.links.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {reply.links.map((link, idx) => (
                            <ExternalLink key={idx} url={link} />
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Acciones de respuesta */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                    {post.category === "pregunta" && isPostAuthor && (
                      <button
                        type="button"
                        onClick={() => handleAcceptReply(reply.id)}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                          isAccepted
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25"
                            : "text-muted hover:text-foreground hover:bg-hover"
                        }`}
                      >
                        <CheckCircle2 size={13} />
                        <span>{isAccepted ? t.community.unacceptReply : t.community.acceptReply}</span>
                      </button>
                    )}

                    <div className="ml-auto flex items-center gap-2">
                      {(isReplyAuthor || isAdmin) && !isEditingThisReply && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingReplyId(reply.id);
                              setEditReplyBody(reply.body);
                              setReplyEditError(null);
                            }}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted hover:text-foreground hover:bg-hover"
                          >
                            <Edit2 size={12} />
                            <span>{t.community.edit}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveReplyId(reply.id)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-rose-600 hover:bg-rose-500/10"
                          >
                            <Trash2 size={12} />
                            <span>{t.community.remove}</span>
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setReportTarget({ type: "reply", id: reply.id })}
                        className="text-muted hover:text-foreground p-1"
                        title="Reportar respuesta"
                        aria-label="Reportar respuesta"
                      >
                        <Flag size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Formulario de nueva respuesta */}
        {post.status !== "closed" ? (
          <div className="mt-6">
            <h3 className="text-xs font-semibold text-foreground mb-2">Añadir respuesta</h3>
            <ReplyForm postId={post.id} onReplyCreated={handleReplyCreated} />
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-sunken p-4 text-center text-xs text-muted">
            <Lock size={14} className="mx-auto mb-1 text-muted" />
            <p>Esta conversación está cerrada. No admite nuevas respuestas.</p>
          </div>
        )}
      </section>

      {/* Diálogo modal de reporte */}
      {reportTarget && (
        <ReportDialog
          isOpen={true}
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          onClose={() => setReportTarget(null)}
        />
      )}

      {/* Diálogo accesible para confirmar retirada de la publicación */}
      <Dialog open={confirmRemovePost} onOpenChange={setConfirmRemovePost}>
        <DialogContent>
          <DialogTitle>¿Retirar esta publicación?</DialogTitle>
          <DialogDescription>
            Esta publicación dejará de mostrarse en la comunidad. Esta acción no se puede deshacer.
          </DialogDescription>
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button>Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => void handleRemovePost()}>
              Retirar publicación
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo accesible para confirmar retirada de una respuesta */}
      <Dialog open={confirmRemoveReplyId !== null} onOpenChange={(open) => { if (!open) setConfirmRemoveReplyId(null); }}>
        <DialogContent>
          <DialogTitle>¿Retirar esta respuesta?</DialogTitle>
          <DialogDescription>
            La respuesta se retirará del hilo de conversación. Esta acción no se puede deshacer.
          </DialogDescription>
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button>Cancelar</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmRemoveReplyId) void handleRemoveReply(confirmRemoveReplyId);
              }}
            >
              Retirar respuesta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
