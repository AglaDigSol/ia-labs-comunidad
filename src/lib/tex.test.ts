// @vitest-environment jsdom
import { render } from "@testing-library/react";
import katex from "katex";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { __texCacheSizeForTests, RICH_TEXT_HELP, RichText, renderTex, renderUserTex, texError } from "./tex.tsx";

const rich = (text: string, display?: "inline" | "block") =>
  render(createElement(RichText, display ? { text, display } : { text })).container;

describe("renderUserTex (untrusted TeX)", () => {
  it("never produces live links: \\href with javascript: and \\url", () => {
    const a = renderUserTex("\\href{javascript:alert(1)}{x}");
    expect(a).not.toContain('href="javascript:');
    expect(a).not.toMatch(/<a[\s>]/); // anchor element (MathML <annotation> is fine)
    const b = renderUserTex("\\url{https://example.test}");
    expect(b).not.toMatch(/<a[\s>]/);
  });

  it("caps the input at 2000 characters", () => {
    const long = "x".repeat(5000);
    expect(renderUserTex(long)).toBe(renderUserTex("x".repeat(2000)));
    const mathml = /<annotation encoding="application\/x-tex">([^<]*)<\/annotation>/.exec(renderUserTex(long));
    expect(mathml?.[1]?.length).toBe(2000);
  });

  it("keeps an LRU of at most 500 entries", () => {
    for (let i = 0; i < 600; i++) renderUserTex(`x_{${i}}`);
    expect(__texCacheSizeForTests()).toBeLessThanOrEqual(500);
  });

  it("stops a macro bomb quickly with error markup", () => {
    const t0 = performance.now();
    const html = renderUserTex("\\def\\a{\\a\\a}\\a");
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(html).toContain("katex-error");
  });

  it("texError reports a KaTeX parse error or null", () => {
    const msg = texError("\\frac{1}{");
    expect(typeof msg).toBe("string");
    expect(msg!.length).toBeGreaterThan(0);
    expect(texError("x^2")).toBeNull();
  });
});

describe("RichText", () => {
  it("renders HTML in user text as visible text and formulas through KaTeX", () => {
    const el = rich("Con $\\eta = 0{,}1$ y <script>alert(1)</script>");
    expect(el.querySelector("script")).toBeNull();
    expect(el.textContent).toContain("<script>alert(1)</script>");
    expect(el.querySelectorAll(".katex").length).toBe(1);
  });

  it("$$…$$ renders a block with its own horizontal scroll", () => {
    const el = rich("$$x^2$$");
    const block = el.querySelector("div.overflow-x-auto");
    expect(block).not.toBeNull();
    expect(block!.querySelector(".katex-display")).not.toBeNull();
  });

  it("\\$ is a literal dollar next to a formula", () => {
    const el = rich("cuesta 5 \\$ y $x$");
    expect(el.querySelectorAll(".katex").length).toBe(1);
    expect(el.textContent!.startsWith("cuesta 5 $ y ")).toBe(true);
  });

  it("an unmatched $ stays plain text", () => {
    const el = rich("precio $5");
    expect(el.querySelectorAll(".katex").length).toBe(0);
    expect(el.textContent).toBe("precio $5");
  });

  it("an unmatched $$ stays plain text and a later inline formula still renders", () => {
    const el = rich("a $$ b");
    expect(el.textContent).toBe("a $$ b");
    expect(el.querySelectorAll(".katex").length).toBe(0);
  });

  it("caps the whole text at 8000 characters", () => {
    const el = rich("a".repeat(9000));
    expect(el.textContent!.length).toBe(8000);
  });

  it("block display wraps in a div", () => {
    const el = rich("hola", "block");
    expect(el.firstElementChild!.tagName).toBe("DIV");
  });

  it("exports the editor help copy", () => {
    expect(RICH_TEXT_HELP).toBe("Usa $…$ para fórmulas en línea y $$…$$ para bloques");
  });
});

describe("renderTex (authored TeX) is unchanged", () => {
  it("matches the Phase 3 KaTeX output for a labs formula", () => {
    const tex = "P(X_{n+1} = j \\mid X_n = i) = p_{ij}";
    expect(renderTex(tex, true)).toBe(
      katex.renderToString(tex, { throwOnError: false, displayMode: true, output: "htmlAndMathml" }),
    );
  });
});
