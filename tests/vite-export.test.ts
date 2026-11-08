import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// El vite.config de una app anfitriona carga el plugin con Node sin quitar tipos: tiene que ser JS.
describe("export ia-labs-comunidad/vite", () => {
  it("apunta a un .mjs con sus tipos y Node lo importa por el nombre del paquete", async () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(pkg.exports["./vite"]).toEqual({ types: "./vite/csp-safe-radix.d.mts", default: "./vite/csp-safe-radix.mjs" });
    const mod = await import("ia-labs-comunidad/vite");
    const plugin = mod.cspSafeRadix();
    expect(plugin.name).toBe("ia-labs:csp-safe-radix");
    expect(plugin.enforce).toBe("pre");
  });
});
