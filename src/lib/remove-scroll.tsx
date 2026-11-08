// Sustituto de `react-remove-scroll` para los componentes de Radix (Dialog, Popover modal, Select).
// El original bloquea el scroll del fondo insertando un <style> en <head>, y la CSP estricta
// (style-src-elem 'self') lo rechaza: el fondo seguía desplazándose y la consola anotaba el error.
// Aquí el bloqueo es una clase en <html> (`scroll-locked`, definida en tokens.css) y el hueco de la
// barra de scroll va en una variable CSS puesta por CSSOM, que la CSP no limita.
// vite.config.ts redirige el import `react-remove-scroll` a este archivo.
import { createElement, forwardRef, useEffect, type ElementType, type ReactNode, type Ref } from "react";

export const SCROLL_LOCK_CLASS = "scroll-locked";
const GAP_VAR = "--scroll-lock-gap";
let locks = 0;

/** Bloquea el scroll de la página; devuelve la función que lo libera. Admite bloqueos anidados. */
export function lockScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  const html = document.documentElement;
  if (locks === 0) {
    const gap = Math.max(0, window.innerWidth - html.clientWidth);
    html.style.setProperty(GAP_VAR, `${gap}px`);
    html.classList.add(SCROLL_LOCK_CLASS);
  }
  locks++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks--;
    if (locks === 0) {
      html.classList.remove(SCROLL_LOCK_CLASS);
      html.style.removeProperty(GAP_VAR);
    }
  };
}

type RemoveScrollProps = {
  as?: ElementType;
  children?: ReactNode;
  className?: string;
  enabled?: boolean;
  // Opciones del original que aquí no hacen falta: el bloqueo es de la página entera.
  shards?: unknown;
  allowPinchZoom?: boolean;
  removeScrollBar?: boolean;
  noIsolation?: boolean;
  noRelative?: boolean;
  inert?: boolean;
  forwardProps?: boolean;
  gapMode?: string;
  sideCar?: unknown;
  [prop: string]: unknown;
};

const Lock = forwardRef(function RemoveScroll(props: RemoveScrollProps, ref: Ref<unknown>) {
  const {
    as = "div",
    children,
    enabled = true,
    shards: _shards,
    allowPinchZoom: _pinch,
    removeScrollBar: _bar,
    noIsolation: _iso,
    noRelative: _rel,
    inert: _inert,
    forwardProps: _fwd,
    gapMode: _gap,
    sideCar: _car,
    ...rest
  } = props;
  useEffect(() => (enabled ? lockScroll() : undefined), [enabled]);
  return createElement(as, { ...rest, ref }, children);
});

export const RemoveScroll = Object.assign(Lock, {
  classNames: { fullWidth: "width-before-scroll-bar", zeroRight: "right-scroll-bar-position" },
});
