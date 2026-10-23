// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedCards } from "../../../shared/srs/decks.ts";
import { __resetToastForTests, ToastHost } from "../../components/ui/toast.tsx";
import { __resetKvStoreForTests, readKvPrefix, setKv } from "../../lib/kv-store.ts";
import { CardEditorDialog } from "./CardEditorDialog.tsx";
import { CardsRoutes } from "./CardsRoutes.tsx";

const DECK = "deckuser0001";
const SRS = { ef: 2.5, n: 1, interval: 6, due: "2026-11-05", last: "2026-10-30", introduced: "2026-10-29", lapses: 0 };

beforeEach(() => {
  __resetKvStoreForTests();
  __resetToastForTests();
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
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-30T12:00:00"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const flush = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const kv = (prefix: string) => readKvPrefix<unknown>(prefix);

function editor(props: Partial<Parameters<typeof CardEditorDialog>[0]> = {}) {
  const onOpenChange = vi.fn();
  render(<CardEditorDialog open deckId={DECK} onOpenChange={onOpenChange} {...props} />);
  const dialog = screen.getByRole("dialog");
  return {
    onOpenChange,
    dialog,
    front: within(dialog).getByLabelText("Anverso") as HTMLTextAreaElement,
    back: within(dialog).getByLabelText("Reverso") as HTMLTextAreaElement,
    frontPreview: within(dialog).getByRole("region", { name: "Vista previa del anverso" }),
    backPreview: within(dialog).getByRole("region", { name: "Vista previa del reverso" }),
  };
}

describe("CardEditorDialog", () => {
  it("uses mono 16 textareas without spellcheck and updates the preview 300 ms after typing", async () => {
    const e = editor();
    expect(e.front.className).toContain("mono");
    expect(e.front.className).toContain("text-[16px]");
    expect(e.front.getAttribute("spellcheck")).toBe("false");
    expect(e.front.maxLength).toBe(2000);
    fireEvent.change(e.front, { target: { value: "La norma $\\|x\\|_2$" } });
    await flush(299);
    expect(e.frontPreview.querySelector(".katex")).toBeNull();
    await flush(1);
    expect(e.frontPreview.textContent).toContain("La norma");
    expect(e.frontPreview.querySelector(".katex")).not.toBeNull();
  });

  it("shows the inline TeX error and marks the fragment in crit", async () => {
    const e = editor();
    fireEvent.change(e.back, { target: { value: "$\\frac{1}{$" } });
    await flush(300);
    const msg = within(e.dialog).getByText(/^Hay un error en la fórmula: .+\. Revisa llaves y barras invertidas\.$/);
    expect(msg.className).toContain("text-crit");
    expect(msg.textContent).not.toContain("KaTeX parse error");
    expect(e.back.getAttribute("aria-describedby")).toContain(msg.id);
    const err = e.backPreview.querySelector(".katex-error") as HTMLElement | null;
    expect(err).not.toBeNull();
    expect(err!.getAttribute("style") ?? "").toContain("var(--crit)");
    // Fixing it clears the message.
    fireEvent.change(e.back, { target: { value: "$\\frac{1}{2}$" } });
    await flush(300);
    expect(within(e.dialog).queryByText(/Hay un error en la fórmula/)).toBeNull();
  });

  it("requires the front, saves to card/<deck>/<id> and closes", () => {
    const e = editor();
    fireEvent.change(e.back, { target: { value: "Reverso" } });
    fireEvent.click(within(e.dialog).getByRole("button", { name: "Guardar tarjeta" }));
    expect(within(e.dialog).getByText("Escribe el anverso de la tarjeta.")).toBeTruthy();
    expect(document.activeElement).toBe(e.front);
    expect(kv("card/")).toHaveLength(0);
    fireEvent.change(e.front, { target: { value: "$\\nabla f$" } });
    fireEvent.click(within(e.dialog).getByRole("button", { name: "Guardar tarjeta" }));
    const saved = kv(`card/${DECK}/`);
    expect(saved).toHaveLength(1);
    expect(saved[0]!.value).toEqual({ front: "$\\nabla f$", back: "Reverso" });
    expect(e.onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("«Guardar y crear otra» saves and clears both fields", () => {
    const e = editor();
    fireEvent.change(e.front, { target: { value: "A" } });
    fireEvent.change(e.back, { target: { value: "B" } });
    fireEvent.click(within(e.dialog).getByRole("button", { name: "Guardar y crear otra" }));
    expect(kv(`card/${DECK}/`)).toHaveLength(1);
    expect(e.front.value).toBe("");
    expect(e.back.value).toBe("");
    expect(e.onOpenChange).not.toHaveBeenCalled();
    fireEvent.change(e.front, { target: { value: "C" } });
    fireEvent.change(e.back, { target: { value: "D" } });
    fireEvent.click(within(e.dialog).getByRole("button", { name: "Guardar y crear otra" }));
    expect(kv(`card/${DECK}/`)).toHaveLength(2);
  });

  it("edits an existing card in place", () => {
    const e = editor({ card: { id: "cardone00001", front: "Old", back: "Back" } });
    expect(within(e.dialog).getByRole("heading", { name: "Editar tarjeta" })).toBeTruthy();
    fireEvent.change(e.front, { target: { value: "New" } });
    fireEvent.click(within(e.dialog).getByRole("button", { name: "Guardar tarjeta" }));
    expect(kv(`card/${DECK}/`)).toEqual([{ key: `card/${DECK}/cardone00001`, value: { front: "New", back: "Back" } }]);
  });

  it("asks before closing with changes", () => {
    const e = editor();
    fireEvent.click(within(e.dialog).getByRole("button", { name: "Cerrar sin guardar" }));
    expect(e.onOpenChange).toHaveBeenLastCalledWith(false);
    e.onOpenChange.mockClear();
    fireEvent.change(e.front, { target: { value: "x" } });
    fireEvent.click(within(e.dialog).getByRole("button", { name: "Cerrar sin guardar" }));
    expect(e.onOpenChange).not.toHaveBeenCalled();
    expect(within(e.dialog).getByText("Tienes cambios sin guardar.")).toBeTruthy();
    const keep = within(e.dialog).getByRole("button", { name: "Seguir editando" });
    expect(document.activeElement).toBe(keep);
    fireEvent.click(keep);
    expect(e.front.value).toBe("x");
    fireEvent.click(within(e.dialog).getByRole("button", { name: "Cerrar sin guardar" }));
    fireEvent.click(within(e.dialog).getByRole("button", { name: "Descartar cambios" }));
    expect(e.onOpenChange).toHaveBeenLastCalledWith(false);
    expect(kv("card/")).toHaveLength(0);
  });
});

function deckPage(path: string) {
  function Where() {
    return <p data-testid="where">{useLocation().pathname}</p>;
  }
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastHost />
      <Routes>
        <Route path="/flashcards/*" element={<CardsRoutes />} />
      </Routes>
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

const openMenu = async (name: string) => {
  fireEvent.click(screen.getByRole("button", { name }));
  await flush();
  return screen.getByRole("menu");
};

describe("DeckPage", () => {
  beforeEach(() => {
    setKv(`deck/${DECK}`, { name: "Lógica proposicional", course: "02MIAR", session: 2 });
  });

  it("lists cards with KaTeX, schedule and suspension; suspends, reactivates and deletes with undo", async () => {
    setKv(`card/${DECK}/cardone00001`, { front: "$p \\land q$", back: "Conjunción" });
    setKv(`card/${DECK}/cardtwo00001`, { front: "Dos", back: "Segunda" });
    setKv("srs/cardone00001", SRS);
    setKv("susp/cardone00001", true);
    deckPage(`/flashcards/${DECK}`);
    expect(screen.getByRole("heading", { level: 1, name: "Lógica proposicional" })).toBeTruthy();
    expect(screen.getByText("02MIAR")).toBeTruthy();
    expect(screen.getByText("Sesión 2")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nueva tarjeta" })).toBeTruthy();
    expect(document.querySelector(".bg-accent")).toBeNull();

    const rows = within(screen.getByRole("list", { name: "Tarjetas" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.querySelector(".katex")).not.toBeNull();
    expect(within(rows[0]!).getByText("Próximo: 05/11 · EF 2,5")).toBeTruthy();
    expect(within(rows[0]!).getByText("Suspendida")).toBeTruthy();

    let menu = await openMenu("Acciones de la tarjeta 1");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Reactivar" }));
    await flush();
    expect(kv("susp/")).toHaveLength(0);
    menu = await openMenu("Acciones de la tarjeta 1");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Suspender" }));
    await flush();
    expect(kv("susp/")).toHaveLength(1);

    menu = await openMenu("Acciones de la tarjeta 1");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Borrar" }));
    await flush();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(kv(`card/${DECK}/`)).toHaveLength(1);
    expect(kv("srs/")).toHaveLength(0);
    expect(kv("susp/")).toHaveLength(0);
    expect(screen.getByRole("status").textContent).toContain("Tarjeta borrada");
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    await flush();
    expect(kv(`card/${DECK}/`)).toHaveLength(2);
    expect(kv("srs/")).toEqual([{ key: "srs/cardone00001", value: SRS }]);
    expect(kv("susp/")).toEqual([{ key: "susp/cardone00001", value: true }]);
  });

  it("edits a card from the row menu", async () => {
    setKv(`card/${DECK}/cardone00001`, { front: "Uno", back: "Primera" });
    deckPage(`/flashcards/${DECK}`);
    const menu = await openMenu("Acciones de la tarjeta 1");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Editar" }));
    await flush();
    const dialog = screen.getByRole("dialog", { name: "Editar tarjeta" });
    expect((within(dialog).getByLabelText("Anverso") as HTMLTextAreaElement).value).toBe("Uno");
  });

  it("empty user deck: «Nueva tarjeta» only inside the empty block", async () => {
    deckPage(`/flashcards/${DECK}`);
    expect(screen.getByRole("heading", { name: "Este mazo está vacío" })).toBeTruthy();
    expect(screen.getByText("Crea la primera tarjeta. Puedes usar $…$ para fórmulas en KaTeX.")).toBeTruthy();
    const buttons = screen.getAllByRole("button", { name: "Nueva tarjeta" });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]!);
    await flush();
    expect(screen.getByRole("dialog", { name: "Nueva tarjeta" })).toBeTruthy();
  });

  it("seed deck: read-only, explains its source and still suspends", async () => {
    const first = seedCards("sym-02-s1")[0]!;
    deckPage("/flashcards/sym-02-s1");
    expect(screen.getByText("Este mazo se genera desde el diccionario de simbología y se actualiza con él.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Nueva tarjeta" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Acciones del mazo/ })).toBeNull();
    const menu = await openMenu("Acciones de la tarjeta 1");
    expect(within(menu).queryByRole("menuitem", { name: "Editar" })).toBeNull();
    expect(within(menu).queryByRole("menuitem", { name: "Borrar" })).toBeNull();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Suspender" }));
    await flush();
    expect(kv("susp/")).toEqual([{ key: `susp/${first.id}`, value: true }]);
    expect(screen.getAllByText("Suspendida").length).toBeGreaterThan(0);
  });

  it("«Borrar mazo» confirms and tombstones the deck, its cards and schedules", async () => {
    setKv(`card/${DECK}/cardone00001`, { front: "Uno", back: "Primera" });
    setKv(`card/${DECK}/cardtwo00001`, { front: "Dos", back: "Segunda" });
    setKv("srs/cardone00001", SRS);
    deckPage(`/flashcards/${DECK}`);
    const menu = await openMenu("Acciones del mazo Lógica proposicional");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Borrar mazo" }));
    await flush();
    const dialog = screen.getByRole("dialog", { name: "Borrar mazo" });
    expect(
      within(dialog).getByText(
        "Borrar el mazo «Lógica proposicional»: se borrarán sus 2 tarjetas y su programación de repaso.",
      ),
    ).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Conservar mazo" })).toBeTruthy();
    const del = within(dialog).getByRole("button", { name: "Borrar mazo" });
    expect(del.className).toContain("bg-destructive");
    fireEvent.click(del);
    await flush();
    expect(kv("deck/")).toHaveLength(0);
    expect(kv("card/")).toHaveLength(0);
    expect(kv("srs/")).toHaveLength(0);
    expect(screen.getByTestId("where").textContent).toBe("/flashcards");
  });

  it("«Editar mazo» updates the deck", async () => {
    deckPage(`/flashcards/${DECK}`);
    const menu = await openMenu("Acciones del mazo Lógica proposicional");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Editar mazo" }));
    await flush();
    const dialog = screen.getByRole("dialog", { name: "Editar mazo" });
    fireEvent.change(within(dialog).getByLabelText("Nombre"), { target: { value: "Lógica" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar mazo" }));
    await flush();
    expect(kv("deck/")).toEqual([{ key: `deck/${DECK}`, value: { name: "Lógica", course: "02MIAR", session: 2 } }]);
    expect(screen.getByRole("heading", { level: 1, name: "Lógica" })).toBeTruthy();
  });
});
