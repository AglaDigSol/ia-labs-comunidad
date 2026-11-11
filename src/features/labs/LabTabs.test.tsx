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

  it("lleva la pestaña activa al centro de la vista si queda fuera", () => {
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
    // Centrada: su centro (700 + 50) en el centro de la barra (300 / 2).
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 700 + 50 - 150 }));
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

  it("en el móvil es una sola línea plegada que se despliega; cerrada, no vuelve (clave labsIntro)", () => {
    renderAt("/laboratorios/simbolos");
    const intro = screen.getByRole("region", { name: "Cómo están organizados los laboratorios" });
    const toggle = within(intro).getByRole("button", { name: "Cómo están organizados los laboratorios" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.className).toContain("lg:hidden");
    const body = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    // Plegada en el móvil, siempre abierta desde 1024 px.
    expect(body.className.split(" ")).toEqual(expect.arrayContaining(["hidden", "lg:flex"]));
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(body.className.split(" ")).not.toContain("hidden");
    fireEvent.click(within(intro).getByRole("button", { name: "Cerrar la orientación" }));
    expect(localStorage.getItem(DEFAULT_LABS_KEYS.labsIntro)).toBe("0");
    cleanup();
    renderAt("/laboratorios/markov");
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

describe("enlace a las guías de estudio", () => {
  const renderWith = (guidesUrl?: string) =>
    render(
      <MemoryRouter initialEntries={["/laboratorios/simbolos"]}>
        <Routes>
          <Route path="/laboratorios/*" element={<LabsRoutes guidesUrl={guidesUrl} />} />
        </Routes>
      </MemoryRouter>,
    );

  it("con una dirección https, enlaza las guías en otra pestaña, fuera de la lista de pestañas", () => {
    renderWith("https://guias.example.org/indice");
    const link = screen.getByRole("link", { name: /Guías de estudio/ });
    expect(link.getAttribute("href")).toBe("https://guias.example.org/indice");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.textContent).toContain("se abre en otra pestaña");
    expect(within(screen.getByRole("tablist")).queryByRole("link", { name: /Guías/ })).toBeNull();
  });

  it.each([undefined, "", "   ", "http://guias.example.org", "javascript:alert(1)", "no es una url"])("sin enlace con %j", (url) => {
    renderWith(url);
    expect(screen.queryByRole("link", { name: /Guías de estudio/ })).toBeNull();
  });
});
