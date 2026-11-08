// Mostrar lo que acaba de aparecer: un panel que se abre por debajo del borde de la pantalla al pulsar
// un botón (traza paso a paso, solución, figura…) se desplaza a la vista y recibe el foco, para que no
// pase desapercibido en el iPad ni con un lector de pantalla. Sin animación si el sistema pide
// movimiento reducido.

/** ¿Pide el sistema movimiento reducido? */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** «smooth», o «auto» con movimiento reducido. */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}

/**
 * Lleva `el` a la vista (solo si no se ve entero) y pone el foco en `focusTarget` (por defecto, su
 * primer encabezado, o el propio elemento), sin que el foco vuelva a desplazar la página.
 */
export function revealPanel(el: HTMLElement | null, focusTarget?: HTMLElement | null): void {
  if (!el) return;
  const target = focusTarget ?? el.querySelector<HTMLElement>("h2, h3, h4, [data-reveal-focus]") ?? el;
  if (!target.hasAttribute("tabindex") && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) target.setAttribute("tabindex", "-1");
  const r = el.getBoundingClientRect();
  const vh = typeof window === "undefined" ? 0 : window.innerHeight;
  const visible = r.top >= 0 && r.top < vh - 80;
  if (!visible && typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  target.focus({ preventScroll: true });
}

/** Desplaza `el` a la vista solo si queda por debajo (o por encima) de la pantalla, sin mover el foco. */
export function scrollIntoViewIfHidden(el: HTMLElement | null): void {
  if (!el || typeof window === "undefined") return;
  const r = el.getBoundingClientRect();
  if (r.top >= 0 && r.top < window.innerHeight - 80) return;
  if (typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: scrollBehavior(), block: "nearest" });
}
