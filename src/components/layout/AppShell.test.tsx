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
      "inicio",
      "laboratorios",
      "ajustes",
    ]);
    expect(activeModules({ calendario: true, flashcards: false, calculadora: true }).map((m) => m.id)).toEqual([
      "inicio",
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
      "Inicio",
      "Laboratorios",
      "Calendario",
      "Flashcards",
      "Notas",
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

  it("la barra inferior muestra nombres cortos fijos, que son también su nombre accesible", () => {
    renderShell();
    const bottom = screen.getAllByRole("navigation", { name: "Principal" })[1]!;
    const links = within(bottom).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Inicio", "Labs", "Agenda", "Tarjetas", "Notas", "Ajustes"]);
    // Lo que se ve es lo que se oye (sin un aria-label distinto).
    expect(links.every((l) => !l.hasAttribute("aria-label"))).toBe(true);
    const notas = within(bottom).getByRole("link", { name: "Notas" });
    expect(notas.getAttribute("aria-current")).toBe("page");
    // Cortos: caben a 390 px aun con una séptima entrada (unos 55 px por entrada).
    for (const l of links) expect(l.textContent!.length).toBeLessThanOrEqual(8);
  });

  it("el contenido deja sitio abajo para la barra inferior y la zona segura", () => {
    renderShell();
    expect(document.getElementById("contenido")!.className).toContain("pb-[calc(56px+env(safe-area-inset-bottom)+32px)]");
  });
});
