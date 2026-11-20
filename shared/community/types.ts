/**
 * Modelos y tipos del módulo Comunidad.
 * Conforme a COM-01 a COM-10 y SPECS-COMUNIDAD.md.
 */

export type PostCategory = "novedad" | "recurso" | "pregunta";

export type PostStatus = "active" | "hidden" | "removed" | "closed";

export type ReplyStatus = "active" | "hidden" | "removed";

export type UserRole = "student" | "moderator" | "admin";

export type PublishingStatus = "active" | "suspended";

export type ReportReason =
  | "spam"
  | "academic_integrity" // Compartir soluciones o enunciados protegidos
  | "harassment"
  | "inappropriate"
  | "other";

export type ReportStatus = "pending" | "resolved" | "dismissed";

export interface UserPublic {
  readonly id: string;
  readonly displayName: string;
  readonly role: UserRole;
}

export interface UserProfile extends UserPublic {
  /** Correo verificado reservado al propio usuario y administración. NUNCA público. */
  readonly verifiedEmail: string;
  readonly publishingStatus: PublishingStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Post {
  readonly id: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly authorRole: UserRole;
  readonly category: PostCategory;
  readonly courseId?: string;
  readonly title: string;
  readonly body: string;
  readonly links: readonly string[];
  readonly status: PostStatus;
  readonly pinned: boolean;
  /** Solo para categoría 'pregunta': si el autor marcó una respuesta como aceptada */
  readonly isResolved: boolean;
  readonly acceptedReplyId?: string;
  readonly replyCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly removedAt?: string;
}

export interface Reply {
  readonly id: string;
  readonly postId: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly authorRole: UserRole;
  readonly body: string;
  readonly links: readonly string[];
  readonly status: ReplyStatus;
  readonly isAccepted: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly removedAt?: string;
}

export interface Report {
  readonly id: string;
  readonly reporterId: string;
  readonly targetType: "post" | "reply";
  readonly targetId: string;
  readonly reason: ReportReason;
  readonly details?: string;
  readonly status: ReportStatus;
  readonly createdAt: string;
  readonly resolvedAt?: string;
}

export interface ModerationActionLog {
  readonly id: string;
  readonly actorId: string;
  readonly action: "pin" | "unpin" | "hide" | "restore" | "close" | "reopen" | "suspend_user" | "unsuspend_user";
  readonly targetType: "post" | "reply" | "user";
  readonly targetId: string;
  readonly reason: string;
  readonly createdAt: string;
}

export interface CommunityFeedResponse {
  readonly posts: readonly Post[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly hasMore: boolean;
}

export interface PostDetailResponse {
  readonly post: Post;
  readonly replies: readonly Reply[];
}
