import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { comunidadEnabled, comunidadFlag, configComunidadSwitch } from "../scripts/comunidad-flag.ts";

describe("LABS_COMUNIDAD", () => {
  it("1/true enciende, 0/false apaga y sin variable decide config.modules.comunidad", () => {
    expect(comunidadFlag({ LABS_COMUNIDAD: "1" })).toBe(true);
    expect(comunidadFlag({ LABS_COMUNIDAD: " TRUE " })).toBe(true);
    expect(comunidadFlag({ LABS_COMUNIDAD: "0" })).toBe(false);
    expect(comunidadFlag({ LABS_COMUNIDAD: "false" })).toBe(false);
    expect(comunidadFlag({})).toBeUndefined();
    expect(comunidadFlag({ LABS_COMUNIDAD: "" })).toBeUndefined();
  });
  it("otro valor es un error del build, no un apagado silencioso", () => {
    expect(() => comunidadFlag({ LABS_COMUNIDAD: "si" })).toThrow(/LABS_COMUNIDAD debe ser 1 o 0/);
  });
  it("sin variable manda config.modules.comunidad, que en el repositorio público es false", () => {
    const src = readFileSync("src/config.ts", "utf8");
    expect(configComunidadSwitch(src)).toBe(false);
    expect(comunidadEnabled({}, src)).toBe(false);
    expect(comunidadEnabled({ LABS_COMUNIDAD: "1" }, src)).toBe(true);
    expect(() => configComunidadSwitch("comunidad: true,\ncomunidad: false,")).toThrow();
  });
});
