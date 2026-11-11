// Cabecera fija de los simulacros en el móvil: va debajo de la cabecera de la app (3rem) y de la barra
// de pestañas de los laboratorios (2,75rem + 1px de borde); en escritorio, arriba del todo. Su altura
// se mide y se deja en la variable CSS --exam-sticky del contenedor, para que lo que se desplaza a la
// vista (la pregunta, un paso del cuaderno) quede justo debajo y no tapado por ella.
import { useLayoutEffect, type RefObject } from "react";

/** Posición de la cabecera fija del simulacro. */
export const EXAM_STICKY_TOP = "top-[calc(3rem+2.75rem+1px)] lg:top-0";

/** Margen para desplazar un elemento a la vista justo debajo de la cabecera fija del simulacro. */
export const BELOW_EXAM_STICKY = "scroll-mt-[calc(3rem+2.75rem+1px+var(--exam-sticky,0px)+0.5rem)] lg:scroll-mt-[calc(var(--exam-sticky,0px)+0.5rem)]";

/** Margen para desplazar a la vista el principio del simulacro (debajo de la cabecera y de las pestañas). */
export const BELOW_LAB_TABS = "scroll-mt-[calc(3rem+2.75rem+1px)] lg:scroll-mt-0";

/**
 * Deja la altura de `bar` (la cabecera fija) en la variable --exam-sticky de `root`. Se mide antes de
 * pintar (useLayoutEffect), así que ya vale al desplazar la pregunta en un efecto normal, y se vuelve a
 * medir si cambia de tamaño.
 */
export function useStickyHeight(bar: RefObject<HTMLElement | null>, root: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const el = bar.current;
    const host = root.current;
    if (!el || !host) return;
    const measure = () => host.style.setProperty("--exam-sticky", `${el.offsetHeight}px`);
    measure();
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [bar, root]);
}
