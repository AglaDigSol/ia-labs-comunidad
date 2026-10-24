// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
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
