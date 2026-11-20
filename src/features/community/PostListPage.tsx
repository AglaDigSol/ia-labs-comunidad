import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Plus, Search, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import type { Post, PostCategory, CommunityFeedResponse } from "../../../shared/community/types.ts";
import { PostCard } from "./PostCard.tsx";
import { NewPostDialog } from "./NewPostDialog.tsx";
import { t } from "../../i18n/index.ts";

export function PostListPage() {
  const [feedData, setFeedData] = useState<CommunityFeedResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | PostCategory>("all");
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchFeed = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", "10");
      if (activeTab !== "all") params.set("category", activeTab);
      if (selectedCourse !== "all") params.set("courseId", selectedCourse);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/community/posts?${params.toString()}`);
      if (!res.ok) throw new Error("HTTP error");
      const data = (await res.json()) as CommunityFeedResponse;
      setIsFallback(false);
      setFeedData(data);
    } catch {
      setIsFallback(true);
      const allMocks: Post[] = [
        {
          id: "post_ejemplo_1",
          authorId: "usr_mock_1",
          authorName: "Estudiante Ejemplo",
          authorRole: "student",
          category: "pregunta",
          courseId: "02MIAR",
          title: "¿Cómo calcular la inversa u0P = v0 en cadenas no invertibles?",
          body: "En el laboratorio de Markov la matriz del ejercicio 3 es singular. ¿Hay alguna técnica para hallar el vector inicial?",
          links: [],
          status: "active",
          pinned: true,
          isResolved: false,
          replyCount: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "post_ejemplo_2",
          authorId: "usr_mock_2",
          authorName: "Otra Estudiante",
          authorRole: "student",
          category: "recurso",
          courseId: "01MIAR",
          title: "Guía de implementación de A* y heurísticas consistentes",
          body: "Comparto un repositorio con ejemplos comentados de búsqueda A* y demostraciones de admisibilidad.",
          links: ["https://github.com/AglaDigSol/ia-labs-comunidad"],
          status: "active",
          pinned: false,
          isResolved: false,
          replyCount: 0,
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          updatedAt: new Date(Date.now() - 3600000).toISOString(),
        },
      ];
      let filtered = allMocks;
      if (activeTab !== "all") {
        filtered = filtered.filter((p) => p.category === activeTab);
      }
      if (selectedCourse !== "all") {
        filtered = filtered.filter((p) => p.courseId === selectedCourse);
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        filtered = filtered.filter(
          (p) => p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q),
        );
      }
      setFeedData({
        posts: filtered,
        total: filtered.length,
        page: 1,
        pageSize: 10,
        hasMore: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, page, searchQuery, selectedCourse]);

  useEffect(() => {
    void fetchFeed();
  }, [fetchFeed]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchFeed();
  };

  const handlePostCreated = (newPost: Post) => {
    setFeedData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        posts: [newPost, ...prev.posts],
        total: prev.total + 1,
      };
    });
  };

  const totalPages = feedData ? Math.ceil(feedData.total / feedData.pageSize) : 1;

  return (
    <div className="space-y-6">
      {/* Cabecera y botón de nueva publicación */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <MessageSquare className="text-accent" size={26} />
            <span>{t.community.title}</span>
          </h1>
          <p className="mt-1 text-xs text-muted">{t.community.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => setIsDialogOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-accent/90 transition-colors self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>{t.community.newPost}</span>
        </button>
      </div>

      {/* Pestañas de categoría y barra de búsqueda */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border pb-3">
        {/* Pestañas */}
        <div className="flex items-center gap-1 rounded-xl bg-sunken p-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab("all");
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === "all"
                ? "bg-surface text-accent shadow-xs font-semibold"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.community.tabAll}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("pregunta");
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === "pregunta"
                ? "bg-surface text-accent shadow-xs font-semibold"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.community.tabQuestions}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("recurso");
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === "recurso"
                ? "bg-surface text-accent shadow-xs font-semibold"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.community.tabResources}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("novedad");
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === "novedad"
                ? "bg-surface text-accent shadow-xs font-semibold"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.community.tabNews}
          </button>
        </div>

        {/* Filtro de asignatura y buscador */}
        <div className="flex items-center gap-2">
          <select
            value={selectedCourse}
            onChange={(e) => {
              setSelectedCourse(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por asignatura"
            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground focus:border-accent focus:outline-hidden"
          >
            <option value="all">Todas las asignaturas</option>
            <option value="01MIAR">01MIAR</option>
            <option value="02MIAR">02MIAR</option>
            <option value="03MIAR">03MIAR</option>
            <option value="04MIAR">04MIAR</option>
            <option value="05MIAR">05MIAR</option>
            <option value="06MIAR">06MIAR</option>
            <option value="07MIAR">07MIAR</option>
            <option value="08MIAR">08MIAR</option>
            <option value="09MIAR">09MIAR</option>
            <option value="10MIAR">10MIAR</option>
          </select>

          <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-56">
            <input
              type="text"
              placeholder="Buscar tema o duda..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-sunken pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-accent focus:outline-hidden"
            />
            <Search size={14} className="absolute left-2.5 top-2 text-muted" />
          </form>
        </div>
      </div>

      {isFallback && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-800 dark:text-amber-200"
        >
          <AlertCircle size={15} className="shrink-0" />
          <span>Modo de demostración sin conexión al servidor: mostrando publicaciones de ejemplo.</span>
        </div>
      )}

      {/* Lista de publicaciones */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-sunken animate-pulse" />
          ))}
        </div>
      ) : feedData && feedData.posts.length > 0 ? (
        <div className="space-y-3">
          {feedData.posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted">
          <AlertCircle size={28} className="mx-auto mb-2 text-muted/60" />
          <p>
            {searchQuery.trim()
              ? "No se encontraron publicaciones con los filtros aplicados."
              : t.community.emptyFeed}
          </p>
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-4 text-xs">
          <span className="text-muted">
            Página {page} de {totalPages} ({feedData?.total} publicaciones)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-muted hover:text-foreground hover:bg-hover disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={14} />
              <span>Anterior</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-muted hover:text-foreground hover:bg-hover disabled:opacity-40 transition-colors"
            >
              <span>Siguiente</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      <NewPostDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onCreated={handlePostCreated}
      />
    </div>
  );
}
