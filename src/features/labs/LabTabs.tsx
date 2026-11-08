// Barra de pestañas de los laboratorios. En pantallas anchas (≥ 1024 px) las pestañas pasan a otra
// fila en lugar de esconderse; más estrechas, la barra se desplaza en horizontal con un degradado y
// flechas a cada lado cuando quedan pestañas ocultas, y la pestaña activa se lleva a la vista.
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { cn } from "../../lib/cn.ts";
import { scrollBehavior } from "../../lib/reveal.ts";

export type LabTabItem = { id: string; label: string; to: string };

/** Margen que dejan las flechas al llevar una pestaña a la vista. */
const EDGE = 40;

export function LabTabs({ tabs, activeId }: { tabs: readonly LabTabItem[]; activeId: string | null }) {
  const nav = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = nav.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);

  useLayoutEffect(() => {
    measure();
    const el = nav.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, tabs.length]);

  // La pestaña activa, siempre a la vista (al entrar por un enlace a «Markov», por ejemplo).
  useEffect(() => {
    const el = nav.current;
    const tab = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !tab || el.scrollWidth <= el.clientWidth) return;
    const start = tab.offsetLeft;
    const end = start + tab.offsetWidth;
    if (start >= el.scrollLeft + EDGE && end <= el.scrollLeft + el.clientWidth - EDGE) return;
    const left = start < el.scrollLeft + EDGE ? start - EDGE : end - el.clientWidth + EDGE;
    el.scrollTo?.({ left: Math.max(0, left), behavior: scrollBehavior() });
  }, [activeId]);

  const page = (dir: -1 | 1) => {
    const el = nav.current;
    if (!el) return;
    el.scrollBy?.({ left: dir * Math.max(120, el.clientWidth * 0.7), behavior: scrollBehavior() });
  };

  // Las flechas son un atajo para el ratón y el dedo: con el teclado o un lector de pantalla las
  // pestañas se recorren directamente, así que no son paradas del tabulador.
  const arrow = (side: "left" | "right") => (
    <div
      data-tab-edge={side}
      className={cn(
        "pointer-events-none absolute inset-y-0 flex items-center lg:hidden",
        side === "left" ? "left-0 bg-linear-to-r pr-6" : "right-0 justify-end bg-linear-to-l pl-6",
        "from-base from-40% to-transparent",
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => page(side === "left" ? -1 : 1)}
        className="pointer-events-auto flex h-11 w-8 items-center justify-center rounded-md text-fg hover:bg-sunken"
      >
        {side === "left" ? <ChevronLeft size={20} strokeWidth={1.75} /> : <ChevronRight size={20} strokeWidth={1.75} />}
      </button>
    </div>
  );

  return (
    <div className="sticky top-12 z-20 border-b border-border bg-base lg:static print:hidden">
      <nav
        ref={nav}
        aria-label="Laboratorios"
        role="tablist"
        onScroll={measure}
        className="relative flex gap-1 overflow-x-auto [scrollbar-width:none] lg:flex-wrap lg:overflow-visible [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <Link
              key={tab.id}
              to={tab.to}
              role="tab"
              aria-selected={active}
              className={cn(
                "flex min-h-11 items-center whitespace-nowrap border-b-2 px-4 text-[14px]",
                active ? "border-accent font-semibold text-fg" : "border-transparent text-muted hover:text-fg",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {edges.left ? arrow("left") : null}
      {edges.right ? arrow("right") : null}
    </div>
  );
}
