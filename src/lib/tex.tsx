import katex, { type KatexOptions } from "katex";
import type { ReactNode } from "react";

// KaTeX entry points.
// - renderTex / Tex: authored TeX only (labs content, toTex(ast) output, self-formatted
//   numbers). Never raw user input. KaTeX `trust` stays at its default (false).
// - renderUserTex / RichText: the ONLY entry points for user-written content (cards, bank
//   questions, paper cards). Bounded and trust-off: no links, no HTML extensions, macro
//   expansion capped, input length capped, bounded LRU cache.

const cache = new Map<string, string>();

export function renderTex(tex: string, display = false): string {
  const key = `${display ? "d" : "i"}:${tex}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const html = katex.renderToString(tex, {
    throwOnError: false,
    displayMode: display,
    output: "htmlAndMathml",
  });
  cache.set(key, html);
  return html;
}

export function Tex({
  tex,
  display = false,
  label,
  className,
}: {
  tex: string;
  display?: boolean;
  label?: string;
  className?: string;
}) {
  const html = renderTex(tex, display);
  if (display) {
    return (
      <div
        tabIndex={0}
        role={label ? "group" : undefined}
        aria-label={label}
        className={`overflow-x-auto ${className ?? ""}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ---------------------------------------------------------------- user TeX

const USER_TEX_MAX = 2000;
const USER_TEX_LRU = 500;
const RICH_TEXT_MAX = 8000;

export const RICH_TEXT_HELP = "Usa $…$ para fórmulas en línea y $$…$$ para bloques";

const userOptions = (display: boolean): KatexOptions => ({
  displayMode: display,
  trust: false,
  maxExpand: 1000,
  strict: "ignore",
  output: "htmlAndMathml",
  errorColor: "var(--crit)",
});

const lru = new Map<string, string>();

/** Bounded, trust-off KaTeX render for user-written TeX. Errors render inline, never throw. */
export function renderUserTex(tex: string, display = false): string {
  const src = tex.slice(0, USER_TEX_MAX);
  const key = `${display ? "d" : "i"}:${src}`;
  const hit = lru.get(key);
  if (hit !== undefined) {
    lru.delete(key);
    lru.set(key, hit);
    return hit;
  }
  let html: string;
  try {
    html = katex.renderToString(src, { ...userOptions(display), throwOnError: false });
  } catch {
    // Non-parse failures (should not happen with throwOnError false): show the source as text.
    html = `<span class="katex-error">${escapeHtml(src)}</span>`;
  }
  lru.set(key, html);
  if (lru.size > USER_TEX_LRU) lru.delete(lru.keys().next().value!);
  return html;
}

/** KaTeX parse error message for user TeX, or null when it parses. */
export function texError(tex: string, display = false): string | null {
  try {
    katex.renderToString(tex.slice(0, USER_TEX_MAX), { ...userOptions(display), throwOnError: true });
    return null;
  } catch (e) {
    return e instanceof Error && e.message ? e.message : "TeX inválido";
  }
}

export function __texCacheSizeForTests(): number {
  return lru.size;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

type Segment = { kind: "text"; text: string } | { kind: "inline" | "block"; tex: string };

/** Index of the closing delimiter at or after `from`, skipping backslash escapes; -1 if none. */
function findClose(s: string, from: number, double: boolean): number {
  for (let j = from; j < s.length; j++) {
    const ch = s[j];
    if (ch === "\\") {
      j++;
      continue;
    }
    if (ch === "$" && (!double || s[j + 1] === "$")) return j;
  }
  return -1;
}

/**
 * Linear scan: "\$" is a literal dollar, "$$…$$" (block) is tried before "$…$" (inline),
 * and an opener without a closer stays literal text. Once a search for a closer fails, no
 * later opener of that kind can match either, so each kind fails at most once (O(n)).
 */
export function splitRichText(input: string): Segment[] {
  const s = input.slice(0, RICH_TEXT_MAX);
  const out: Segment[] = [];
  let buf = "";
  let noDouble = false;
  let noSingle = false;
  const flush = () => {
    if (buf) out.push({ kind: "text", text: buf });
    buf = "";
  };
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "\\" && s[i + 1] === "$") {
      buf += "$";
      i += 2;
      continue;
    }
    if (ch === "$" && s[i + 1] === "$") {
      const close = noDouble ? -1 : findClose(s, i + 2, true);
      if (close >= 0) {
        flush();
        out.push({ kind: "block", tex: s.slice(i + 2, close) });
        i = close + 2;
        continue;
      }
      noDouble = true;
      buf += "$$";
      i += 2;
      continue;
    }
    if (ch === "$") {
      const close = noSingle ? -1 : findClose(s, i + 1, false);
      if (close >= 0) {
        flush();
        out.push({ kind: "inline", tex: s.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
      noSingle = true;
    }
    buf += ch;
    i++;
  }
  flush();
  return out;
}

/** User text with $…$ / $$…$$ formulas. Plain segments are React text nodes, never innerHTML. */
export function RichText({
  text,
  className,
  display = "inline",
}: {
  text: string;
  className?: string;
  display?: "inline" | "block";
}) {
  const segments = splitRichText(text);
  const children: ReactNode[] = segments.map((seg, idx) => {
    if (seg.kind === "text") return seg.text;
    if (seg.kind === "block") {
      return (
        <div
          key={idx}
          tabIndex={0}
          className="overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: renderUserTex(seg.tex, true) }}
        />
      );
    }
    return <span key={idx} dangerouslySetInnerHTML={{ __html: renderUserTex(seg.tex, false) }} />;
  });
  // A $$ block is a div, so its container must be one too (no div inside span).
  const asBlock = display === "block" || segments.some((s) => s.kind === "block");
  return asBlock ? <div className={className}>{children}</div> : <span className={className}>{children}</span>;
}
