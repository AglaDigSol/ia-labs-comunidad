import { Link } from "react-router";
import { MessageSquare, Pin, CheckCircle2, Lock, Sparkles, HelpCircle, BookOpen } from "lucide-react";
import type { Post, PostCategory } from "../../../shared/community/types.ts";
import { formatInTimezone } from "../../../shared/timezone/format.ts";
import { useTimezone } from "../calendar/TimezoneContext.tsx";

function getCategoryBadge(category: PostCategory) {
  switch (category) {
    case "pregunta":
      return {
        label: "Pregunta",
        icon: HelpCircle,
        color: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
      };
    case "recurso":
      return {
        label: "Recurso",
        icon: BookOpen,
        color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      };
    case "novedad":
      return {
        label: "Novedad",
        icon: Sparkles,
        color: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
      };
  }
}

export function PostCard({ post }: { post: Post }) {
  const { timezone } = useTimezone();
  const badge = getCategoryBadge(post.category);
  const Icon = badge.icon;

  const dateStr = formatInTimezone(post.createdAt, timezone, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`group relative rounded-2xl border bg-surface p-4 sm:p-5 shadow-2xs hover:border-accent/40 hover:shadow-xs transition-all ${
        post.pinned ? "border-accent/30 bg-accent/5" : "border-border"
      }`}
    >
      <div className="flex flex-col gap-2.5">
        {/* Cabecera con insignias */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {post.pinned && (
              <span className="inline-flex items-center gap-1 rounded-md bg-accent/20 px-2 py-0.5 text-[11px] font-semibold text-accent">
                <Pin size={11} />
                <span>Fijado</span>
              </span>
            )}

            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${badge.color}`}
            >
              <Icon size={12} />
              <span>{badge.label}</span>
            </span>

            {post.courseId && (
              <span className="rounded-md bg-sunken px-2 py-0.5 font-mono text-[11px] font-medium text-foreground">
                {post.courseId}
              </span>
            )}

            {post.isResolved && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={12} />
                <span>Resuelta</span>
              </span>
            )}

            {post.status === "closed" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-sunken px-2 py-0.5 text-[11px] font-medium text-muted">
                <Lock size={11} />
                <span>Cerrada</span>
              </span>
            )}
          </div>

          <div className="text-[11px] text-muted">
            {post.authorName} · {dateStr}
          </div>
        </div>

        {/* Título y extracto enlazado */}
        <Link
          to={`/comunidad/${post.id}`}
          className="group-hover:text-accent transition-colors block space-y-1.5 focus-visible:outline-hidden"
        >
          <h2 className="text-base font-bold text-foreground group-hover:text-accent leading-snug line-clamp-2">
            {post.title}
          </h2>
          <p className="text-xs text-muted line-clamp-2 leading-relaxed">{post.body}</p>
        </Link>

        {/* Pie con número de respuestas */}
        <div className="mt-2 flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <MessageSquare size={13} className="text-muted" />
            <span className="font-semibold text-foreground">{post.replyCount}</span>
            <span>{post.replyCount === 1 ? "respuesta" : "respuestas"}</span>
          </div>

          <Link
            to={`/comunidad/${post.id}`}
            className="text-xs font-semibold text-accent hover:underline"
          >
            Ver conversación →
          </Link>
        </div>
      </div>
    </div>
  );
}
