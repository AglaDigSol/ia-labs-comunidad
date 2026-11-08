import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REMOVE_SCROLL_SHIM, stripSelectStyle } from "../vite/csp-safe-radix.mjs";

describe("Radix sin <style> en línea (CSP style-src-elem 'self')", () => {
  it("quita el <style> del visor de la versión instalada de Radix Select", () => {
    const code = readFileSync("node_modules/@radix-ui/react-select/dist/index.mjs", "utf8");
    const out = stripSelectStyle(code);
    expect(out).not.toBeNull();
    expect(out).not.toContain("dangerouslySetInnerHTML");
    expect(out).toContain('"data-radix-select-viewport": ""');
  });

  it("los paquetes de Radix que bloquean el scroll importan react-remove-scroll (lo que se redirige)", () => {
    for (const pkg of ["react-dialog", "react-popover", "react-select"]) {
      const code = readFileSync(`node_modules/@radix-ui/${pkg}/dist/index.mjs`, "utf8");
      expect(code).toContain('from "react-remove-scroll"');
    }
    expect(readFileSync(REMOVE_SCROLL_SHIM, "utf8")).toContain("export const RemoveScroll");
  });

  it("la clase del bloqueo está en tokens.css", () => {
    const css = readFileSync("src/styles/tokens.css", "utf8");
    expect(css).toMatch(/html\.scroll-locked/);
    expect(css).toMatch(/\[data-radix-select-viewport\]::-webkit-scrollbar/);
  });
});
