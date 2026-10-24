// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetKvStoreForTests, snapshotKv } from "../../lib/kv-store.ts";
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
