import type { Plugin } from "vite";

/** Ruta del sustituto de react-remove-scroll. */
export declare const REMOVE_SCROLL_SHIM: string;
/** Patrón del <style> del visor de Radix Select. */
export declare const SELECT_STYLE_RE: RegExp;
/** Radix sin <style> en línea, para una CSP con style-src-elem 'self'. */
export declare function cspSafeRadix(): Plugin;
/** Quita el <style> del visor de Radix Select; null si el código ya no lo tiene. */
export declare function stripSelectStyle(code: string): string | null;
