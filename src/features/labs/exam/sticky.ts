// Cabecera fija de los simulacros en el móvil: va debajo de la cabecera de la app (3rem) y de la barra
// de pestañas de los laboratorios (2,75rem + 1px de borde); en escritorio, arriba del todo. Su altura
// se mide y se deja en la variable CSS --exam-sticky del contenedor, para que lo que se desplaza a la
// vista (la pregunta, un paso del cuaderno) quede justo debajo y no tapado por ella.
import { useEffect, useState, type CSSProperties, type RefObject } from "react";

/** Posición de la cabecera fija del simulacro. */
export const EXAM_STICKY_TOP = "top-[calc(3rem+2.75rem+1px)] lg:top-0";

/** Margen para desplazar un elemento a la vista justo debajo de la cabecera fija del simulacro. */
export const BELOW_EXAM_STICKY = "scroll-mt-[calc(3rem+2.75rem+1px+var(--exam-sticky,0px)+0.5rem)] lg:scroll-mt-[calc(var(--exam-sticky,0px)+0.5rem)]";

/** Margen para desplazar a la vista el principio del simulacro (debajo de la cabecera y de las pestañas). */
export const BELOW_LAB_TABS = "scroll-mt-[calc(3rem+2.75rem+1px)] lg:scroll-mt-0";

/** Altura de `ref` (la cabecera fija), como estilo con la variable --exam-sticky. */
export function useStickyHeight(ref: RefObject<HTMLElement | null>): CSSProperties {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return { "--exam-sticky": `${height}px` } as CSSProperties;
}
