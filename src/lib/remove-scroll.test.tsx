// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "../components/ui/dialog.tsx";
import { lockScroll, SCROLL_LOCK_CLASS } from "./remove-scroll.tsx";

afterEach(cleanup);

const locked = () => document.documentElement.classList.contains(SCROLL_LOCK_CLASS);

describe("bloqueo del scroll sin <style>", () => {
  it("admite bloqueos anidados y libera una sola vez", () => {
    const a = lockScroll();
    const b = lockScroll();
    expect(locked()).toBe(true);
    a();
    a();
    expect(locked()).toBe(true);
    b();
    expect(locked()).toBe(false);
  });

  it("un diálogo abierto bloquea el scroll con la clase y no inserta <style>", async () => {
    render(
      <Dialog>
        <DialogTrigger>Abrir</DialogTrigger>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Entregar</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    fireEvent.click(screen.getByText("Abrir"));
    await screen.findByRole("dialog");
    expect(locked()).toBe(true);
    expect(document.querySelectorAll("style")).toHaveLength(0);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(locked()).toBe(false);
  });
});
