// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LABS_KEYS } from "./labs-storage.ts";
import { LabsRoutes } from "./labs.tsx";
import { LabTabs } from "./LabTabs.tsx";

const tabs = ["Simbología", "Lógica", "Predicados", "Conjuntos", "Combinatoria", "Markov", "Ejercicios"].map((label, i) => ({
  id: `t${i}`,
  label,
  to: `/l/t${i}`,
}));

function stubOverflow({ scrollWidth, clientWidth, scrollLeft = 0 }: { scrollWidth: number; clientWidth: number; scrollLeft?: number }) {
  const nav = screen.getByRole("tablist");
  Object.defineProperty(nav, "scrollWidth", { configurable: true, value: scrollWidth });
  Object.defineProperty(nav, "clientWidth", { configurable: true, value: clientWidth });
  Object.defineProperty(nav, "scrollLeft", { configurable: true, writable: true, value: scrollLeft });
  return nav;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("LabTabs", () => {
  it("con pestañas ocultas a la derecha, enseña el degradado con la flecha; al desplazar, también a la izquierda", () => {
    render(
      <MemoryRouter>
        <LabTabs tabs={tabs} activeId="t0" />
      </MemoryRouter>,
    );
    expect(document.querySelector("[data-tab-edge]")).toBeNull();
    const nav = stubOverflow({ scrollWidth: 900, clientWidth: 300 });
    const scrollBy = vi.fn();
    (nav as HTMLElement & { scrollBy: unknown }).scrollBy = scrollBy;
    fireEvent.scroll(nav);
    expect(document.querySelector('[data-tab-edge="right"]')).not.toBeNull();
    expect(document.querySelector('[data-tab-edge="left"]')).toBeNull();
    // La flecha no es una parada del tabulador (las pestañas ya lo son) ni se anuncia.
    const btn = document.querySelector<HTMLButtonElement>('[data-tab-edge="right"] button')!;
    expect(btn.tabIndex).toBe(-1);
    expect(btn.getAttribute("aria-hidden")).toBe("true");
    fireEvent.click(btn);
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 210 }));
    stubOverflow({ scrollWidth: 900, clientWidth: 300, scrollLeft: 600 });
    fireEvent.scroll(nav);
    expect(document.querySelector('[data-tab-edge="left"]')).not.toBeNull();
    expect(document.querySelector('[data-tab-edge="right"]')).toBeNull();
  });

  it("lleva la pestaña activa a la vista si queda fuera", () => {
    const scrollTo = vi.fn();
    const proto = HTMLElement.prototype as HTMLElement & { scrollTo: unknown };
    const original = proto.scrollTo;
    proto.scrollTo = scrollTo;
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(900);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (this: HTMLElement) {
      return this.getAttribute("aria-selected") === "true" ? 700 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(100);
    render(
      <MemoryRouter>
        <LabTabs tabs={tabs} activeId="t5" />
      </MemoryRouter>,
    );
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 700 + 100 - 300 + 40 }));
    proto.scrollTo = original;
  });
});

describe("orientación de la primera visita", () => {
  beforeEach(() => localStorage.clear());
  const renderAt = (url: string, python = false) =>
    render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/laboratorios/*" element={<LabsRoutes python={python} />} />
        </Routes>
      </MemoryRouter>,
    );

  it("explica las pestañas y enlaza los dos simulacros; «Entendido» la cierra y se recuerda", () => {
    renderAt("/laboratorios/simbolos", true);
    const intro = screen.getByRole("region", { name: "Cómo están organizados los laboratorios" });
    expect(within(intro).getByRole("link", { name: /02MIAR/ }).getAttribute("href")).toBe("/laboratorios/ejercicios/simulacro");
    expect(within(intro).getByRole("link", { name: /01MIAR/ }).getAttribute("href")).toBe("/laboratorios/python/simulacro");
    fireEvent.click(within(intro).getByRole("button", { name: "Entendido" }));
    expect(screen.queryByRole("region", { name: "Cómo están organizados los laboratorios" })).toBeNull();
    expect(localStorage.getItem(DEFAULT_LABS_KEYS.labsIntro)).toBe("0");
    cleanup();
    renderAt("/laboratorios/logica");
    expect(screen.queryByRole("region", { name: "Cómo están organizados los laboratorios" })).toBeNull();
  });

  it("sin Python solo enlaza el de 02MIAR, y no aparece dentro de un simulacro", () => {
    renderAt("/laboratorios/logica");
    const intro = screen.getByRole("region", { name: "Cómo están organizados los laboratorios" });
    expect(within(intro).queryByRole("link", { name: /01MIAR/ })).toBeNull();
    cleanup();
    renderAt("/laboratorios/ejercicios/simulacro");
    expect(screen.queryByRole("region", { name: "Cómo están organizados los laboratorios" })).toBeNull();
  });
});
