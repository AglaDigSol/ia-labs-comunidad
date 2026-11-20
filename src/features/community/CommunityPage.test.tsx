// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CommunityRoutes } from "./CommunityPage.tsx";

describe("CommunityPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  function renderCommunity(url = "/comunidad") {
    return render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/comunidad/*" element={<CommunityRoutes />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("renders community page heading and filter buttons", async () => {
    renderCommunity();

    expect(screen.getByRole("heading", { name: /Comunidad Estudiantil/i, level: 1 })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Todas$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Preguntas$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Recursos$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Novedades$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Nueva publicación/i })).toBeTruthy();
  });

  it("renders mock feed items and demo notice when API is unavailable", async () => {
    renderCommunity();

    await waitFor(() => {
      expect(screen.getByText(/Modo de demostración sin conexión al servidor/i)).toBeTruthy();
      expect(screen.getByText(/¿Cómo calcular la inversa u0P = v0/i)).toBeTruthy();
      expect(screen.getByText(/Estudiante Ejemplo/i)).toBeTruthy();
    });
  });

  it("opens and closes the new publication dialog (including with Escape)", async () => {
    renderCommunity();

    const newBtn = screen.getByRole("button", { name: /Nueva publicación/i });
    fireEvent.click(newBtn);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Nueva publicación/i })).toBeTruthy();
    expect(screen.getByLabelText(/^Título$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^Contenido$/i)).toBeTruthy();

    // Escape key closes Radix Dialog
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    // Re-open and close with close button
    fireEvent.click(newBtn);
    expect(screen.getByRole("dialog")).toBeTruthy();
    const closeBtn = screen.getByLabelText(/Cerrar diálogo/i);
    fireEvent.click(closeBtn);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("filters feed by search query submission", async () => {
    renderCommunity();

    await waitFor(() => {
      expect(screen.getByText(/¿Cómo calcular la inversa u0P = v0/i)).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText(/Buscar tema o duda/i);
    fireEvent.change(searchInput, { target: { value: "inexistente_xyz_abc" } });

    // Submit form
    fireEvent.submit(searchInput.closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/No se encontraron publicaciones con los filtros aplicados/i)).toBeTruthy();
    });
  });

  it("renders detail view with not found state when post does not exist", async () => {
    renderCommunity("/comunidad/non-existent-id");

    await waitFor(() => {
      expect(screen.getByText(/La publicación solicitada no existe o ha sido retirada/i)).toBeTruthy();
      expect(screen.getByText(/← Volver a la comunidad/i)).toBeTruthy();
    });
  });
});
