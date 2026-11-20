import { describe, expect, it } from "vitest";
import {
  CreatePostSchema,
  CreateReplySchema,
  CreateReportSchema,
  DisplayNameSchema,
  escapeHtml,
  extractSafeDomain,
  isSafeUrl,
  ModerationActionSchema,
} from "./validation.ts";

describe("Community Validation (COM-01, COM-03, COM-04, COM-06, COM-07)", () => {
  it("validates display name according to COM-01 (2-80 chars, no HTML)", () => {
    expect(DisplayNameSchema.safeParse("Nombre Ejemplo").success).toBe(true);
    expect(DisplayNameSchema.safeParse("A").success).toBe(false); // < 2
    expect(DisplayNameSchema.safeParse("a".repeat(81)).success).toBe(false); // > 80
    expect(DisplayNameSchema.safeParse("<script>alert(1)</script>").success).toBe(false); // HTML
  });

  it("filters and validates safe URLs (COM-07)", () => {
    expect(isSafeUrl("https://github.com/AglaDigSol")).toBe(true);
    expect(isSafeUrl("http://example.com/docs/paper.pdf")).toBe(true);

    // Protocolos no permitidos
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeUrl("file:///etc/passwd")).toBe(false);

    // Credenciales incrustadas prohibidas
    expect(isSafeUrl("https://user:password@" + "evil.com/")).toBe(false);
  });

  it("extracts safe readable domain", () => {
    expect(extractSafeDomain("https://www.youtube.com/watch?v=123")).toBe("youtube.com");
    expect(extractSafeDomain("https://github.com/owner/repo")).toBe("github.com");
  });

  it("escapes raw HTML characters strictly", () => {
    const raw = `<script>alert("XSS & 'quotes'")</script>`;
    const escaped = escapeHtml(raw);
    expect(escaped).toBe("&lt;script&gt;alert(&quot;XSS &amp; &#039;quotes&#039;&quot;)&lt;/script&gt;");
    expect(escaped).not.toContain("<");
    expect(escaped).not.toContain(">");
  });

  it("validates post creation input with limits and course validation", () => {
    const validPost = {
      category: "pregunta",
      courseId: "02MIAR",
      title: "¿Cómo calcular la inversa u0P = v0 en cadenas no invertibles?",
      body: "Tengo dudas sobre el cálculo cuando la matriz P es singular.",
      links: ["https://example.com/paper"],
    };
    expect(CreatePostSchema.safeParse(validPost).success).toBe(true);

    // Título demasiado corto (< 5 chars)
    expect(CreatePostSchema.safeParse({ ...validPost, title: "Hola" }).success).toBe(false);

    // Categoría inválida
    expect(CreatePostSchema.safeParse({ ...validPost, category: "invalida" }).success).toBe(false);

    // Más de 5 enlaces
    expect(
      CreatePostSchema.safeParse({
        ...validPost,
        links: [
          "https://e1.com",
          "https://e2.com",
          "https://e3.com",
          "https://e4.com",
          "https://e5.com",
          "https://e6.com",
        ],
      }).success,
    ).toBe(false);
  });

  it("validates reply input limits", () => {
    expect(CreateReplySchema.safeParse({ body: "Respuesta clara y concisa", links: [] }).success).toBe(true);
    expect(CreateReplySchema.safeParse({ body: "", links: [] }).success).toBe(false);
  });

  it("validates report and moderation schemas", () => {
    const validReport = {
      targetType: "post",
      targetId: "post_123",
      reason: "academic_integrity",
      details: "Se ha pegado la solución exacta de la PEC evaluable.",
    };
    expect(CreateReportSchema.safeParse(validReport).success).toBe(true);

    const validModAction = {
      action: "close",
      targetType: "post",
      targetId: "post_123",
      reason: "Pregunta duplicada y resuelta en hilo principal.",
    };
    expect(ModerationActionSchema.safeParse(validModAction).success).toBe(true);
  });
});
