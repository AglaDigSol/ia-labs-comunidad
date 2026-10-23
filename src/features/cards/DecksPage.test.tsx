// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CardView, DeckView } from "../../../shared/srs/due.ts";
import type { Srs } from "../../../shared/srs/types.ts";
import { __resetKvStoreForTests, readKvPrefix } from "../../lib/kv-store.ts";
import { DecksPage } from "./DecksPage.tsx";

const h = vi.hoisted(() => ({ decks: [] as DeckView[], cards: [] as CardView[] }));

vi.mock("../../lib/cards-store.ts", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../lib/cards-store.ts")>();
  return { ...real, useDecks: () => h.decks, useAllCards: () => h.cards };
});

const TODAY = "2026-10-30";

const DECKS: DeckView[] = [
  { id: "deckpy000001", name: "NumPy básico", course: "01MIAR", session: 1, seed: false },
  { id: "sym-02-s1", name: "Sesión 1 · Símbolos", course: "02MIAR", session: 1, seed: true },
  { id: "sym-02-s2", name: "Sesión 2 · Símbolos", course: "02MIAR", session: 2, seed: true },
  { id: "deckuser0001", name: "Lógica", course: "02MIAR", session: null, seed: false },
];

const srs = (due: string): Srs => ({ ef: 2.5, n: 1, interval: 1, due, last: "2026-10-29", introduced: "2026-10-29", lapses: 0 });

const card = (id: string, deckId: string, s: Srs | null = null, suspended = false): CardView => ({
  id,
  deckId,
  front: "a",
  back: "b",
  seed: deckId.startsWith("sym"),
  srs: s,
  suspended,
});

const routes = () => {
  function Where() {
    return <p data-testid="where">{useLocation().pathname}</p>;
  }
  return render(
    <MemoryRouter initialEntries={["/flashcards"]}>
      <Routes>
        <Route path="/flashcards" element={<DecksPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
};

beforeEach(() => {
  __resetKvStoreForTests();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  h.decks = DECKS;
  h.cards = [];
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("DecksPage", () => {
  it("shows today's count with one primary «Repasar 12 tarjetas»", () => {
    h.cards = [
      ...Array.from({ length: 10 }, (_, i) => card(`sym-x${i}`, "sym-02-s2")),
      card("cardrev00001", "deckuser0001", srs(TODAY)),
      card("cardrev00002", "deckpy000001", srs("2026-10-29")),
      card("cardlater001", "deckuser0001", srs("2026-11-04")),
    ];
    routes();
    expect(screen.getByRole("heading", { level: 1, name: "Flashcards" })).toBeTruthy();
    const today = screen.getByRole("region", { name: "Repaso de hoy" });
    expect(today.textContent).toContain("12 tarjetas para hoy");
    expect(within(today).getByText("12").className).toContain("mono");
    const primary = screen.getByRole("link", { name: "Repasar 12 tarjetas" });
    expect(primary.getAttribute("href")).toBe("/flashcards/repaso");
    expect(primary.className).toContain("bg-accent");
    expect(document.querySelectorAll(".bg-accent")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Nuevo mazo" }).className).not.toContain("bg-accent");
  });

  it("groups decks by course and session with counts, seed chip and «Repasar mazo»", () => {
    h.cards = [
      ...Array.from({ length: 3 }, (_, i) => card(`sym-x${i}`, "sym-02-s2")),
      card("cardrev00001", "deckuser0001", srs(TODAY)),
      card("cardlater001", "deckuser0001", srs("2026-11-04")),
      card("cardsusp0001", "deckuser0001", null, true),
    ];
    routes();
    const g01 = screen.getByRole("region", { name: "01MIAR" });
    const g02 = screen.getByRole("region", { name: "02MIAR" });
    expect(within(g01).getByRole("heading", { level: 2 }).className).toContain("mono");
    expect(within(g01).getAllByRole("listitem")).toHaveLength(1);
    const rows = within(g02).getAllByRole("listitem");
    expect(rows.map((r) => within(r).getAllByRole("link")[0]!.textContent)).toEqual([
      "Sesión 1 · Símbolos",
      "Sesión 2 · Símbolos",
      "Lógica",
    ]);
    expect(within(rows[1]!).getByText("Del diccionario")).toBeTruthy();
    expect(within(rows[2]!).queryByText("Del diccionario")).toBeNull();
    expect(within(rows[1]!).getByText("Para hoy 3 · Nuevas 3 · Total 3")).toBeTruthy();
    expect(within(rows[2]!).getByText("Para hoy 1 · Nuevas 0 · Total 3")).toBeTruthy();
    expect(within(rows[2]!).getByText("General")).toBeTruthy();

    const review = within(rows[2]!).getByRole("link", { name: /^Repasar mazo/ });
    expect(review.getAttribute("href")).toBe("/flashcards/repaso?mazo=deckuser0001");
    expect(within(rows[2]!).getByRole("link", { name: "Lógica" }).getAttribute("href")).toBe(
      "/flashcards/deckuser0001",
    );
    // Nothing due in Sesión 1: the action is there but disabled.
    const disabled = within(rows[0]!).getByRole("button", { name: /^Repasar mazo/ }) as HTMLButtonElement;
    expect(disabled.disabled).toBe(true);
  });

  it("with nothing today shows the empty heading, the next review and no primary", () => {
    h.cards = Array.from({ length: 4 }, (_, i) => card(`cardtom0000${i}`, "deckuser0001", srs("2026-10-31")));
    routes();
    expect(screen.getByRole("heading", { name: "No te toca ninguna tarjeta hoy" })).toBeTruthy();
    expect(
      screen.getByText("Próximo repaso: mañana, 4 tarjetas. Puedes crear tarjetas nuevas o revisar tus mazos."),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: /^Repasar \d/ })).toBeNull();
    expect(document.querySelector(".bg-accent")).toBeNull();
  });

  it("uses the singular and dd/mm for a later single card", () => {
    h.cards = [card("cardnov00001", "deckuser0001", srs("2026-11-05"))];
    routes();
    expect(screen.getByText(/Próximo repaso: 05\/11, 1 tarjeta\./)).toBeTruthy();
  });

  it("«Nuevo mazo» validates the name, keeps focus and creates the deck", () => {
    routes();
    fireEvent.click(screen.getByRole("button", { name: "Nuevo mazo" }));
    const dialog = screen.getByRole("dialog", { name: "Nuevo mazo" });
    expect(within(dialog).getByRole("button", { name: "Cerrar sin crear" })).toBeTruthy();
    const course = within(dialog).getByRole("combobox", { name: "Asignatura" });
    const session = within(dialog).getByRole("combobox", { name: "Sesión" });
    expect(course.textContent).toContain("01MIAR");
    expect(session.textContent).toContain("General");

    fireEvent.click(within(dialog).getByRole("button", { name: "Crear mazo" }));
    const name = within(dialog).getByLabelText("Nombre");
    expect(screen.getByText("Escribe un nombre para el mazo.")).toBeTruthy();
    expect(document.activeElement).toBe(name);
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(readKvPrefix("deck/")).toHaveLength(0);

    fireEvent.keyDown(course, { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("option", { name: "02MIAR" }), { key: "Enter" });
    fireEvent.keyDown(session, { key: "Enter" });
    expect(screen.getByRole("option", { name: "Sesión 40" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("option", { name: "Sesión 2" }), { key: "Enter" });
    fireEvent.change(name, { target: { value: "  Repaso de lógica  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Crear mazo" }));

    const saved = readKvPrefix<unknown>("deck/");
    expect(saved).toHaveLength(1);
    expect(saved[0]!.value).toEqual({ name: "Repaso de lógica", course: "02MIAR", session: 2 });
    const id = saved[0]!.key.slice("deck/".length);
    expect(screen.getByTestId("where").textContent).toBe(`/flashcards/${id}`);
  });
});
