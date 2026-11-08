// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { activeModules, MODULES } from "../../config.ts";
import { AppShell } from "./AppShell.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("module switches", () => {
  it("the three labs and settings are always on; optional modules follow the switches", () => {
    expect(activeModules({ calendario: false, flashcards: false, calculadora: false }).map((m) => m.id)).toEqual([
      "laboratorios",
      "ajustes",
    ]);
    expect(activeModules({ calendario: true, flashcards: false, calculadora: true }).map((m) => m.id)).toEqual([
      "laboratorios",
      "calendario",
      "calculadora",
      "ajustes",
    ]);
    expect(MODULES.every((m) => m.path.startsWith("/"))).toBe(true);
  });
});

describe("AppShell", () => {
  it("renders the navigation and the non-official notice in the footer", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
    render(
      <MemoryRouter initialEntries={["/laboratorios"]}>
        <AppShell>
          <h1>Página</h1>
        </AppShell>
      </MemoryRouter>,
    );
    const rail = screen.getAllByRole("navigation", { name: "Principal" })[0]!;
    expect(within(rail).getAllByRole("link").map((l) => l.textContent)).toEqual([
      "Laboratorios",
      "Calendario",
      "Flashcards",
      "Calculadora de notas",
      "Ajustes",
    ]);
    expect(
      screen.getByText(
        "Proyecto comunitario de estudiantes del Máster en IA. No oficial ni afiliado a la Universidad Internacional de Valencia (VIU).",
      ),
    ).toBeTruthy();
    expect(screen.getAllByText("IA Labs · Comunidad").length).toBeGreaterThan(0);
  });
});

describe("AppShell en el móvil y con teclado", () => {
  const renderShell = () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
    return render(
      <MemoryRouter initialEntries={["/notas"]}>
        <AppShell>
          <h1>Página</h1>
        </AppShell>
      </MemoryRouter>,
    );
  };

  it("«Saltar al contenido» es el primer enlace y lleva el foco al contenido", () => {
    renderShell();
    const skip = screen.getByRole("link", { name: "Saltar al contenido" });
    expect(document.querySelector("a")).toBe(skip);
    Element.prototype.scrollIntoView = () => {};
    fireEvent.click(skip);
    expect(document.activeElement).toBe(document.getElementById("contenido"));
    expect(document.activeElement?.tagName).toBe("MAIN");
  });

  it("la barra inferior muestra la etiqueta corta (no solo el icono) y el nombre largo como nombre accesible", () => {
    renderShell();
    const bottom = screen.getAllByRole("navigation", { name: "Principal" })[1]!;
    const links = within(bottom).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("aria-label"))).toContain("Calculadora de notas");
    const notas = within(bottom).getByRole("link", { name: "Calculadora de notas" });
    expect(notas.getAttribute("aria-current")).toBe("page");
    const label = within(notas).getByText("Notas");
    expect(label.className).not.toMatch(/sr-only/);
  });
});
