import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") && !p.endsWith(".test.tsx") ? [p] : [];
  });

describe("teclados de las respuestas numéricas", () => {
  it("ningún campo usa inputMode decimal (no tiene − ni «/»), salvo las notas, de 0 a 10", () => {
    const offenders = walk("src").filter((p) => !p.includes("grades") && readFileSync(p, "utf8").includes('inputMode="decimal"'));
    expect(offenders).toEqual([]);
  });
});
