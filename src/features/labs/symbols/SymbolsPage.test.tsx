// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { symbolById } from "../../../../shared/symbols/index.ts";
import { SymbolsPage } from "./SymbolsPage.tsx";

type W = Record<string, unknown>;
const w = window as unknown as W;

class FakeUtterance {
  text: string;
  lang = "";
  rate = 1;
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

let speakMock = vi.fn();
let cancelMock = vi.fn();

function installSpeech() {
  speakMock = vi.fn();
  cancelMock = vi.fn();
  w.SpeechSynthesisUtterance = FakeUtterance;
  w.speechSynthesis = {
    speak: speakMock,
    cancel: cancelMock,
    getVoices: () => [{ lang: "es-ES", name: "x" }],
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

function Loc() {
  const l = useLocation();
  return <span data-testid="loc">{decodeURIComponent(l.pathname + l.search)}</span>;
}

function renderAt(url = "/laboratorios/simbolos") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <SymbolsPage />
      <Loc />
    </MemoryRouter>,
  );
}

const search = () => screen.getByLabelText("Buscar en el diccionario") as HTMLInputElement;
const rowIds = () =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-symbol-id]")).map((r) => r.dataset.symbolId);

function typeQuery(v: string) {
  fireEvent.change(search(), { target: { value: v } });
  act(() => {
    vi.advanceTimersByTime(200);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  installSpeech();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete w.speechSynthesis;
  delete w.SpeechSynthesisUtterance;
});

describe("SymbolsPage", () => {
  it("search shows Implicación first and its card sections", () => {
    renderAt();
    typeQuery("implicación");
    expect(rowIds()[0]).toBe("implicacion");
    fireEvent.click(document.querySelector("[data-symbol-id='implicacion']")!);
    const card = screen.getByRole("article");
    for (const t of [
      "Símbolo",
      "Variantes de notación",
      "Cómo se lee en clase",
      "Equivalente en Python",
      "Sesión",
    ]) {
      expect(within(card).getByText(t)).toBeTruthy();
    }
    expect(within(card).getByText("«p implica q»")).toBeTruthy();
    expect(within(card).getByText("también «si p entonces q»")).toBeTruthy();
    expect(within(card).getByText("NumPy")).toBeTruthy();
    expect(within(card).getByText(/~p \| q/)).toBeTruthy();
  });

  it("Escuchar lectura speaks the entry and example in es-ES, and can be stopped", () => {
    renderAt("/laboratorios/simbolos?s=implicacion");
    cancelMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Escuchar lectura" }));
    expect(speakMock).toHaveBeenCalledTimes(1);
    const u = speakMock.mock.calls[0]![0] as FakeUtterance;
    const e = symbolById("implicacion")!;
    expect(u.lang).toBe("es-ES");
    expect(u.text).toBe(`${e.spoken}. Por ejemplo: ${e.example!.spoken}`);
    const stop = screen.getByRole("button", { name: "Detener lectura" });
    expect(stop.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Escuchando…")).toBeTruthy();
    cancelMock.mockClear();
    fireEvent.click(stop);
    expect(cancelMock).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Escuchar lectura" })).toBeTruthy();
  });

  it("disables audio without speech synthesis", () => {
    delete w.speechSynthesis;
    delete w.SpeechSynthesisUtterance;
    renderAt("/laboratorios/simbolos?s=implicacion");
    const btn = screen.getByRole("button", { name: "Escuchar lectura" });
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    expect(
      screen.getByText("Tu navegador no puede leer en voz alta. Usa la lectura escrita de la ficha."),
    ).toBeTruthy();
  });

  it("filters by category and updates ?c", () => {
    renderAt();
    fireEvent.click(screen.getByRole("radio", { name: "Conjuntos" }));
    expect(screen.getByTestId("loc").textContent).toContain("c=conjuntos");
    const ids = rowIds();
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => symbolById(id!)!.category === "conjuntos")).toBe(true);
    expect(screen.getByText(`${ids.length} símbolos`)).toBeTruthy();
  });

  it("empty state offers Quitar filtros", () => {
    renderAt("/laboratorios/simbolos?c=conjuntos");
    typeQuery("zzzzqqq");
    expect(screen.getByText("No hay símbolos con esa búsqueda")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Quitar filtros" }));
    expect(search().value).toBe("");
    expect(screen.getByTestId("loc").textContent).not.toContain("c=");
    expect(rowIds().length).toBeGreaterThan(0);
  });

  it("deep link opens the card; unknown s and c are ignored", () => {
    renderAt("/laboratorios/simbolos?s=implicacion");
    expect(screen.getByRole("article").getAttribute("aria-label")).toBe("Ficha: Implicación");
    cleanup();
    renderAt("/laboratorios/simbolos?s=nope&c=nada");
    // unknown s is ignored; on desktop the first result is auto-selected instead
    expect(screen.queryByText("Elige un símbolo")).toBeNull();
    expect(screen.getByRole("article")).toBeTruthy();
    expect(rowIds().length).toBeGreaterThan(5);
  });

  it("Copiar código writes the snippet to the clipboard", () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderAt("/laboratorios/simbolos?s=implicacion");
    fireEvent.click(screen.getAllByRole("button", { name: "Copiar código" })[0]!);
    expect(writeText).toHaveBeenCalledWith("(not p) or q");
  });
});

describe("SymbolsPage: filtro de categorías y selección inicial", () => {
  afterEach(() => {
    cleanup();
    delete w.matchMedia;
  });

  it("muestra cada categoría como botón independiente", () => {
    renderAt();
    const group = screen.getByRole("radiogroup", { name: "Categoría" });
    const labels = within(group)
      .getAllByRole("radio")
      .map((r) => r.textContent);
    expect(labels.length).toBeGreaterThan(2);
    expect(labels[0]).toBe("Todas");
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("en escritorio selecciona el primer resultado y sincroniza ?s=", () => {
    renderAt("/laboratorios/simbolos?q=implicación");
    const loc = screen.getByTestId("loc").textContent ?? "";
    expect(loc).toMatch(/[?&]s=/);
    expect(screen.queryByText("Elige un símbolo")).toBeNull();
  });

  it("en escritorio, al filtrar, la ficha sigue al primer resultado visible", () => {
    renderAt("/laboratorios/simbolos");
    const first = (screen.getByTestId("loc").textContent ?? "").match(/[?&]s=([^&]+)/)?.[1];
    expect(first).toBeTruthy();
    typeQuery("implicación");
    const loc = screen.getByTestId("loc").textContent ?? "";
    expect(loc).toContain("s=implicacion");
    expect(rowIds()).toContain("implicacion");
  });

  it("en móvil no selecciona automáticamente", () => {
    w.matchMedia = (q: string) => ({
      matches: false,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    renderAt("/laboratorios/simbolos?q=implicación");
    expect(screen.getByTestId("loc").textContent ?? "").not.toMatch(/[?&]s=/);
  });
});
