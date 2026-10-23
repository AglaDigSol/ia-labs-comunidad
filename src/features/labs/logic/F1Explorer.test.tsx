// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { LabsRoutes } from "../labs.tsx";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderF1() {
  return render(
    <MemoryRouter initialEntries={["/laboratorios/logica?t=f1"]}>
      <Routes>
        <Route path="/laboratorios/*" element={<LabsRoutes />} />
      </Routes>
    </MemoryRouter>,
  );
}

const pick = (name: string, value: string) =>
  fireEvent.change(screen.getByLabelText(name), { target: { value } });

describe("F1Explorer", () => {
  it("opens from ?t=f1 with the header, toggle and 16 empty selects", async () => {
    renderF1();
    expect(
      await screen.findByRole("heading", { name: "Tablas de F₁ = {Id, f, g, h}" }),
    ).toBeTruthy();
    expect(screen.getByText("h: h(0) = 1, h(1) = 0")).toBeTruthy();
    expect(screen.getByText("Id: Id(0) = 0, Id(1) = 1")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Suma" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Producto" })).toBeTruthy();
    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    expect(selects.length).toBe(16);
    expect(selects.every((s) => s.value === "")).toBe(true);
    const opts = within(screen.getByLabelText("Id + f")).getAllByRole("option").map((o) => o.textContent);
    expect(opts).toEqual(["", "Id", "f", "g", "h"]);
  });

  it("full table is locked until the first Comprobar", async () => {
    renderF1();
    const reveal = await screen.findByRole("button", { name: "Mostrar tabla completa" });
    expect(reveal.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(reveal);
    expect(screen.queryByText("neutro")).toBeNull();
    expect(screen.getAllByRole("combobox").length).toBe(16);
  });

  it("grades cell by cell and then allows the full table", async () => {
    renderF1();
    await screen.findByLabelText("Id + f");
    pick("Id + f", "Id");
    pick("h + Id", "f");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getAllByText("Correcto").length).toBe(1);
    expect(screen.getAllByText("Revisa").length).toBe(1);
    expect(screen.getAllByText("Sin responder").length).toBe(14);
    expect(screen.getByText("1 de 16 correctas")).toBeTruthy();
    const reveal = screen.getByRole("button", { name: "Mostrar tabla completa" });
    expect(reveal.getAttribute("aria-disabled")).toBe("false");
    fireEvent.click(reveal);
    expect(screen.getByLabelText("h + Id = g")).toBeTruthy();
    expect(screen.getAllByText("neutro").length).toBe(2);
  });

  it("keeps Suma and Producto answers separate and marks g as neutral for Producto", async () => {
    renderF1();
    await screen.findByLabelText("Id + f");
    pick("Id + f", "Id");
    fireEvent.click(screen.getByRole("radio", { name: "Producto" }));
    expect((screen.getByLabelText("Id · f") as HTMLSelectElement).value).toBe("");
    pick("Id · f", "f");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("1 de 16 correctas")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar tabla completa" }));
    const neutros = screen.getAllByText("neutro");
    expect(neutros.length).toBe(2);
    expect(neutros[0]!.closest("th")!.textContent).toContain("g");
    fireEvent.click(screen.getByRole("radio", { name: "Suma" }));
    expect((screen.getByLabelText("Id + f") as HTMLSelectElement).value).toBe("Id");
  });
});
