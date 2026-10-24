// Configuración de despliegue: nginx, cabeceras, CSP estricta, noindex y Dockerfile.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const nginx = read("deploy/nginx.conf");
const headers = read("deploy/security-headers.conf");
const csp = /Content-Security-Policy "([^"]+)"/.exec(headers)![1]!;
const directives = new Map(csp.split(";").map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k!, v]));

describe("CSP", () => {
  it("solo mismo origen, sin inline ni eval en scripts", () => {
    expect(directives.get("default-src")).toEqual(["'self'"]);
    expect(directives.get("script-src")).toEqual(["'self'"]);
    expect(directives.get("style-src-elem")).toEqual(["'self'"]);
    expect(directives.get("style-src-attr")).toEqual(["'unsafe-inline'"]);
    expect(directives.get("object-src")).toEqual(["'none'"]);
    expect(directives.get("base-uri")).toEqual(["'self'"]);
    expect(directives.get("frame-ancestors")).toEqual(["'none'"]);
    expect(csp).not.toMatch(/unsafe-eval|https?:|data:|\*/);
    expect(directives.get("script-src")).not.toContain("'unsafe-inline'");
  });

  it("index.html no tiene scripts ni estilos inline ni recursos externos", () => {
    const html = read("index.html");
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(html).not.toMatch(/<style|style="/);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
  });
});

describe("cabeceras", () => {
  it("envía HSTS, nosniff, Referrer-Policy, Permissions-Policy y X-Robots-Tag; sin COEP", () => {
    expect(headers).toMatch(/Strict-Transport-Security "max-age=\d+/);
    expect(headers).toContain('X-Content-Type-Options "nosniff"');
    expect(headers).toMatch(/Referrer-Policy "(no-referrer|strict-origin-when-cross-origin)"/);
    expect(headers).toContain("Permissions-Policy");
    expect(headers).toContain('X-Robots-Tag "noindex, nofollow"');
    expect(headers + nginx).not.toMatch(/Cross-Origin-Embedder-Policy/);
  });

  it("cada location incluye las cabeceras de seguridad", () => {
    const blocks = nginx.split(/\n\s*location /).slice(1);
    expect(blocks.length).toBeGreaterThanOrEqual(4);
    for (const b of blocks) expect(b).toContain("include /etc/nginx/snippets/security-headers.conf;");
  });
});

describe("nginx", () => {
  it("fallback SPA, caché inmutable en /assets y .ics como text/calendar con caché de 1 h", () => {
    expect(nginx).toContain("try_files $uri $uri/ /index.html;");
    expect(nginx).toMatch(/location \/assets\/ \{[^}]*immutable/);
    const ics = nginx.slice(nginx.indexOf("\\.ics$"), nginx.indexOf("location = /calendario.json"));
    expect(ics).toContain('default_type "text/calendar; charset=utf-8";');
    expect(ics).toContain("max-age=3600");
  });

  it("robots.txt bloquea todo", () => {
    expect(read("public/robots.txt")).toBe("User-agent: *\nDisallow: /\n");
  });
});

describe("Dockerfile", () => {
  it("multi-stage: build con node y nginx:alpine sirviendo dist", () => {
    const df = read("Dockerfile");
    expect(df).toMatch(/FROM node:[^\s]+ AS build/);
    expect(df).toMatch(/FROM nginx:[^\s]*alpine/);
    expect(df).toContain("npm ci --ignore-scripts");
    expect(df).toContain("COPY --from=build /app/dist /usr/share/nginx/html");
    expect(df).toContain("ARG CALENDAR_ICS_URL");
  });
});
