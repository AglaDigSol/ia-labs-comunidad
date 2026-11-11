// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetKvStoreForTests, setKv, snapshotKv } from "../../lib/kv-store.ts";
import { MAX_IMPORT_BYTES, SettingsPage } from "./SettingsPage.tsx";

beforeEach(() => {
  __resetKvStoreForTests();
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const fileInput = () => screen.getByLabelText("Archivo de copia (JSON)") as HTMLInputElement;

describe("Ajustes · mis datos", () => {
  it("rechaza un archivo de más de 2 MB sin leerlo", async () => {
    render(<SettingsPage />);
    const text = vi.fn(async () => "{}");
    const big = { name: "x.json", size: MAX_IMPORT_BYTES + 1, text } as unknown as File;
    await act(async () => {
      fireEvent.change(fileInput(), { target: { files: [big] } });
    });
    expect(screen.getByText("El archivo es demasiado grande (máximo 2 MB).")).toBeTruthy();
    expect(text).not.toHaveBeenCalled();
  });

  it("importa una copia válida y descarta lo inválido", async () => {
    render(<SettingsPage />);
    const body = JSON.stringify({
      app: "ia-labs-comunidad",
      version: 1,
      exportedAt: "2026-10-24T00:00:00.000Z",
      data: { "pref/theme": "dark", "grade/01MIAR/ev1": 900, "x/evil": "<script>" },
    });
    const file = new File([body], "copia.json", { type: "application/json" });
    await act(async () => {
      fireEvent.change(fileInput(), { target: { files: [file] } });
    });
    expect(await screen.findByText("Importados 2 datos. Descartados por no ser válidos: 1 dato.")).toBeTruthy();
    expect(snapshotKv()).toEqual({ "grade/01MIAR/ev1": 900, "pref/theme": "dark" });
  });

  it("no ofrece nada relacionado con cookies ni frases de acceso", () => {
    render(<SettingsPage />);
    expect(screen.queryByRole("button", { name: "Salir" })).toBeNull();
    expect(screen.getByText(/El sitio no usa cookies/)).toBeTruthy();
  });
});

describe("Ajustes · flashcards", () => {
  it("«Nuevas por día» shows the per-deck default 20 and saves a valid value", () => {
    render(<SettingsPage />);
    expect(screen.getByRole("heading", { level: 2, name: "Flashcards" })).toBeTruthy();
    const field = screen.getByRole("textbox", { name: "Nuevas por día" }) as HTMLInputElement;
    expect(field.value).toBe("20");
    expect(field.className).toContain("min-h-11");
    expect(screen.getByText(/Tarjetas nuevas que cada mazo te presenta al día \(por defecto, 20\)/)).toBeTruthy();
    fireEvent.change(field, { target: { value: "35" } });
    expect(snapshotKv()).toEqual({ "pref/newCardsPerDay": 35 });
  });

  it("rejects values outside 1–200 without saving and keeps a stored value", () => {
    setKv("pref/newCardsPerDay", 50);
    render(<SettingsPage />);
    const field = screen.getByRole("textbox", { name: "Nuevas por día" }) as HTMLInputElement;
    expect(field.value).toBe("50");
    fireEvent.change(field, { target: { value: "0" } });
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Escribe un número entero entre 1 y 200.")).toBeTruthy();
    fireEvent.change(field, { target: { value: "201" } });
    expect(snapshotKv()).toEqual({ "pref/newCardsPerDay": 50 });
  });
});
