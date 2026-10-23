// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Srs } from "../../../shared/srs/types.ts";
import { __resetToastForTests, ToastHost } from "../../components/ui/toast.tsx";
import { __resetKvStoreForTests, readKvPrefix, setKv } from "../../lib/kv-store.ts";
import { CardsRoutes } from "./CardsRoutes.tsx";

const DECK = "deckuser0001";
const TODAY = "2026-10-30";
const reviewSrs = (due: string): Srs => ({ ef: 2.5, n: 2, interval: 6, due, last: "2026-10-24", introduced: "2026-10-18", lapses: 0 });

beforeEach(() => {
  __resetKvStoreForTests();
  __resetToastForTests();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
  setKv(`deck/${DECK}`, { name: "Lógica", course: "02MIAR", session: 2 });
  // The dictionary decks come first in the new-card order; a high cap lets this deck's new cards in.
  setKv("pref/newCardsPerDay", 200);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const mount = (path = `/flashcards/repaso?mazo=${DECK}`) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ToastHost />
      <input aria-label="Campo de prueba" />
      <Routes>
        <Route path="/flashcards/*" element={<CardsRoutes />} />
      </Routes>
    </MemoryRouter>,
  );

const key = (k: string, target: Element = document.body) =>
  act(() => {
    fireEvent.keyDown(target, { key: k, code: k === " " ? "Space" : `Digit${k}` });
  });

const srsOf = (id: string) => readKvPrefix<Srs>(`srs/${id}`)[0]?.value ?? null;
const front = () => within(screen.getByRole("article", { name: "Tarjeta" }));

describe("ReviewPage", () => {
  it("shows the header, progress and the primary «Mostrar respuesta» before revealing", () => {
    setKv(`card/${DECK}/cardaaa00001`, { front: "Anverso A", back: "Reverso A" });
    setKv(`card/${DECK}/cardbbb00001`, { front: "Anverso B", back: "Reverso B" });
    setKv("srs/cardbbb00001", reviewSrs(TODAY));
    mount();
    expect(screen.getByRole("heading", { level: 1, name: "Repaso · Lógica" })).toBeTruthy();
    expect(screen.getByText("1 de 2")).toBeTruthy();
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuemax")).toBe("2");
    expect(bar.className).toContain("h-2");
    expect(bar.querySelector(".bg-fg")).not.toBeNull();
    const end = screen.getByRole("link", { name: "Terminar repaso" });
    expect(end.getAttribute("href")).toBe("/flashcards");
    expect(end.className).not.toContain("bg-accent");
    // Due reviews come before new cards.
    expect(front().getByText("Anverso B")).toBeTruthy();
    expect(front().queryByText("Reverso B")).toBeNull();
    expect(screen.getByRole("button", { name: "Mostrar respuesta" }).className).toContain("bg-accent");
    expect(screen.queryByRole("group", { name: "¿Cómo te ha ido?" })).toBeNull();
  });

  it("all decks: «Repaso · Todos los mazos»", () => {
    setKv("pref/newCardsPerDay", 20);
    mount("/flashcards/repaso");
    expect(screen.getByRole("heading", { level: 1, name: "Repaso · Todos los mazos" })).toBeTruthy();
    // Seed decks give 20 new cards on day one.
    expect(screen.getByText("1 de 20")).toBeTruthy();
  });

  it("Space reveals the back once in a polite live region and focuses the grade group", () => {
    setKv(`card/${DECK}/cardaaa00001`, { front: "Anverso A", back: "Reverso A" });
    mount();
    const live = screen.getByRole("article", { name: "Tarjeta" }).querySelector("[aria-live='polite']")!;
    expect(live.textContent).toBe("");
    expect(screen.queryByText(/^Atajos:/)).toBeNull();
    key(" ");
    expect(live.textContent).toContain("Reverso A");
    const group = screen.getByRole("group", { name: "¿Cómo te ha ido?" });
    expect(document.activeElement).toBe(group);
    expect(screen.queryByRole("button", { name: "Mostrar respuesta" })).toBeNull();
    expect(document.querySelector(".bg-accent")).toBeNull();
    // Physical keyboard detected: the hint appears.
    expect(screen.getByText("Atajos: Espacio para mostrar, 1–4 para calificar")).toBeTruthy();
  });

  it("new card intervals, key 3 grades «Bien», toast and undo back to that card", () => {
    setKv(`card/${DECK}/cardaaa00001`, { front: "Anverso A", back: "Reverso A" });
    setKv(`card/${DECK}/cardbbb00001`, { front: "Anverso B", back: "Reverso B" });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar respuesta" }));
    const buttons = within(screen.getByRole("group", { name: "¿Cómo te ha ido?" })).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Otra vezHoy", "Difícil1 d", "Bien1 d", "Fácil1 d"]);
    expect(buttons.every((b) => b.className.includes("min-h-16") && !b.className.includes("bg-accent"))).toBe(true);
    expect(buttons[2]!.getAttribute("title")).toBe("Atajo: 3");

    const first = front().getByText(/Anverso [AB]/).textContent!;
    const firstId = first.endsWith("A") ? "cardaaa00001" : "cardbbb00001";
    key("3");
    const s = srsOf(firstId)!;
    expect(s).toMatchObject({ n: 1, interval: 1, due: "2026-10-31", last: TODAY });
    expect(screen.getByRole("status").textContent).toContain("Calificada: Bien · próximo repaso 31/10");
    expect(front().queryByText(first)).toBeNull();
    expect(screen.getByText("2 de 2")).toBeTruthy();
    expect(document.activeElement?.textContent).toBe("Mostrar respuesta");

    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(srsOf(firstId)).toBeNull();
    expect(front().getByText(first)).toBeTruthy();
    expect(screen.getByText("1 de 2")).toBeTruthy();
  });

  it("undo restores the previous schedule of a review card", () => {
    const prev = reviewSrs(TODAY);
    setKv(`card/${DECK}/cardaaa00001`, { front: "Anverso A", back: "Reverso A" });
    setKv("srs/cardaaa00001", prev);
    mount();
    key(" ");
    key("4");
    expect(srsOf("cardaaa00001")!.due).not.toBe(TODAY);
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(srsOf("cardaaa00001")).toEqual(prev);
  });

  it("«Otra vez» sends the card to the end; a later grade the same day keeps its due date; then the summary", () => {
    setKv(`card/${DECK}/cardaaa00001`, { front: "Anverso A", back: "Reverso A" });
    setKv(`card/${DECK}/cardbbb00001`, { front: "Anverso B", back: "Reverso B" });
    setKv("srs/cardaaa00001", reviewSrs("2026-10-29"));
    setKv("srs/cardbbb00001", reviewSrs(TODAY));
    mount();
    expect(front().getByText("Anverso A")).toBeTruthy();
    key(" ");
    key("1");
    const afterLapse = srsOf("cardaaa00001")!;
    expect(afterLapse).toMatchObject({ n: 0, interval: 1, due: "2026-10-31", lapses: 1 });
    expect(front().getByText("Anverso B")).toBeTruthy();
    key(" ");
    key("2");
    const afterHard = srsOf("cardbbb00001")!;
    // Difícil also returns B to the end, so A comes back.
    expect(front().getByText("Anverso A")).toBeTruthy();
    key(" ");
    key("3");
    expect(srsOf("cardaaa00001")).toEqual(afterLapse);
    expect(front().getByText("Anverso B")).toBeTruthy();
    key(" ");
    key("3");
    expect(srsOf("cardbbb00001")).toEqual(afterHard);

    expect(screen.getByRole("heading", { name: "Repaso terminado" })).toBeTruthy();
    expect(screen.getByText("Otra vez 1 · Difícil 1 · Bien 2 · Fácil 0")).toBeTruthy();
    expect(screen.getByText(/^Próximo repaso: mañana, 1 tarjeta$/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Volver a Flashcards" }).getAttribute("href")).toBe("/flashcards");
    expect(screen.getByRole("link", { name: "Ir al Command Center" }).getAttribute("href")).toBe("/");
  });

  it("ignores Space and digits while focus is in a text field", () => {
    setKv(`card/${DECK}/cardaaa00001`, { front: "Anverso A", back: "Reverso A" });
    mount();
    const input = screen.getByRole("textbox", { name: "Campo de prueba" });
    input.focus();
    key(" ", input);
    expect(screen.getByRole("button", { name: "Mostrar respuesta" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar respuesta" }));
    input.focus();
    key("3", input);
    expect(srsOf("cardaaa00001")).toBeNull();
    expect(screen.getByRole("group", { name: "¿Cómo te ha ido?" })).toBeTruthy();
  });

  it("phone layout: fixed 2×2 above the bottom bar with safe-area and reserved padding; one row of four from 480px", () => {
    setKv(`card/${DECK}/cardaaa00001`, { front: "Anverso A", back: "Reverso A" });
    const { container } = mount();
    key(" ");
    const group = screen.getByRole("group", { name: "¿Cómo te ha ido?" });
    expect(group.className).toContain("grid-cols-2");
    expect(group.className).toContain("max-sm:fixed");
    expect(group.className).toContain("max-sm:bottom-[calc(56px+env(safe-area-inset-bottom))]");
    expect(group.className).toContain("sm:@[30rem]:grid-cols-4");
    expect(group.parentElement!.className).toContain("@container");
    const root = container.querySelector("[class*='max-sm:pb-']")!;
    expect(root.className).toContain("max-sm:pb-[calc(2*64px+8px+56px+env(safe-area-inset-bottom))]");
  });

  it("fades the back in only without prefers-reduced-motion", () => {
    setKv(`card/${DECK}/cardaaa00001`, { front: "Anverso A", back: "Reverso A" });
    const animate = vi.fn();
    Object.defineProperty(Element.prototype, "animate", { value: animate, configurable: true, writable: true });
    const media = (reduce: boolean) =>
      vi.stubGlobal("matchMedia", (q: string) => ({ matches: reduce && q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }));

    media(true);
    mount();
    key(" ");
    expect(animate).not.toHaveBeenCalled();
    cleanup();

    media(false);
    mount();
    key(" ");
    expect(animate).toHaveBeenCalledTimes(1);
    const opts = animate.mock.calls[0]![1] as KeyframeAnimationOptions;
    expect(opts.duration).toBeGreaterThanOrEqual(150);
    expect(opts.duration).toBeLessThanOrEqual(200);
    delete (Element.prototype as { animate?: unknown }).animate;
  });
});
