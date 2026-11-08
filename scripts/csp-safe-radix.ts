import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

// Radix sin <style> en línea, para la CSP estricta (style-src-elem 'self'):
// - react-remove-scroll (Dialog, Popover modal, Select) inserta un <style> para bloquear el scroll del
//   fondo: se redirige a src/lib/remove-scroll.tsx, que lo hace con una clase en <html>.
// - Radix Select pone un <style> en el visor de la lista (ver abajo).

/** Ruta del sustituto de react-remove-scroll. */
export const REMOVE_SCROLL_SHIM = fileURLToPath(new URL("../src/lib/remove-scroll.tsx", import.meta.url));

/**
 * Sin <style> en línea de Radix Select: el visor de la lista lleva un <style> para ocultar su barra de
 * scroll, y la CSP (style-src-elem 'self') lo rechaza. Se quita del paquete y la regla vive en
 * tokens.css. Si una versión nueva cambia ese código, el build falla aquí en lugar de dejar el error
 * en la consola.
 */
export const SELECT_STYLE_RE = /\/\* @__PURE__ \*\/ jsx\(\s*"style",\s*\{\s*dangerouslySetInnerHTML:\s*\{\s*__html: `\[data-radix-select-viewport\][^`]*`\s*\},\s*nonce\s*\}\s*\),/;
export function cspSafeRadix(): Plugin {
  return {
    name: "ia-labs:csp-safe-radix",
    enforce: "pre",
    config: () => ({ resolve: { alias: [{ find: /^react-remove-scroll$/, replacement: REMOVE_SCROLL_SHIM }] } }),
    transform(code, id) {
      if (!/[\\/]@radix-ui[\\/]react-select[\\/]dist[\\/]index\.mjs$/.test(id.split("?")[0]!)) return null;
      const out = stripSelectStyle(code);
      if (out === null) throw new Error("@radix-ui/react-select: no se encuentra el <style> del visor; revisa scripts/csp-safe-radix.ts");
      return { code: out, map: null };
    },
  };
}

/** Quita el <style> del visor de Radix Select; null si el código ya no lo tiene. */
export function stripSelectStyle(code: string): string | null {
  return SELECT_STYLE_RE.test(code) ? code.replace(SELECT_STYLE_RE, "") : null;
}
