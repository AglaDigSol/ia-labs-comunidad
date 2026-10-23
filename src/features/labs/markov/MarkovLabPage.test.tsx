// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkovLabPage } from "./MarkovLabPage.tsx";

function Loc() {
  const l = useLocation();
  return <span data-testid="loc">{decodeURIComponent(l.pathname + l.search)}</span>;
}

function renderPage(url = "/laboratorios/markov") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <MarkovLabPage />
      <Loc />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

const cell = (i: number, j: number) => screen.getByLabelText(`P(${i},${j})`) as HTMLInputElement;
const type = (el: HTMLElement, v: string) => fireEvent.change(el, { target: { value: v } });
const loadExample = () => fireEvent.click(screen.getByRole("button", { name: "Cargar ejemplo ilustrativo" }));

describe("MarkovLabPage: editor y comprobación", () => {
  it("primera visita: marco de integridad, estado vacío y sin celdas rellenas", () => {
    renderPage();
    expect(
      screen.getByText(
        "Comprueba tu desarrollo: aquí ves los pasos para contrastar tu resultado con el de la herramienta. Escribe tú tu propio desarrollo.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Introduce tu matriz P")).toBeTruthy();
    for (let i = 1; i <= 3; i++) for (let j = 1; j <= 3; j++) expect(cell(i, j).value).toBe("");
  });

  it("ejemplo ilustrativo: rellena P y v0, etiqueta y veredicto", () => {
    renderPage();
    loadExample();
    expect(screen.getByText("Ejemplo ilustrativo")).toBeTruthy();
    expect(cell(1, 1).value).toBe("0,5");
    expect((screen.getByLabelText("v₀(1)") as HTMLInputElement).value).toBe("0,5");
    expect(screen.getByText("Estocástica por filas")).toBeTruthy();
    expect(screen.getAllByText("Suma 1")).toHaveLength(3);
  });

  it("entrada negativa: veredicto, aria-invalid, explicación e Ir a la celda", () => {
    renderPage();
    loadExample();
    type(cell(1, 3), "-0,2");
    expect(screen.getByText("No es estocástica por filas")).toBeTruthy();
    expect(cell(1, 3).getAttribute("aria-invalid")).toBe("true");
    expect(
      screen.getByText("La entrada P(1,3) = −0,2 es negativa. Una probabilidad no puede ser menor que 0."),
    ).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Ir a la celda" })[0]!);
    expect(document.activeElement).toBe(cell(1, 3));
  });

  it("fila que suma 1,1 y evolución bloqueada", () => {
    renderPage();
    loadExample();
    type(cell(2, 3), "0,2");
    type(cell(2, 1), "0,3");
    expect(screen.getByText("Suma 1,1")).toBeTruthy();
    expect(screen.getByText("La fila Programar suma 1,1, no 1. Sobran 0,1.")).toBeTruthy();
    expect(screen.getAllByText("Corrige la matriz para ver la evolución.").length).toBeGreaterThan(0);
  });

  it("texto no numérico", () => {
    renderPage();
    loadExample();
    type(cell(1, 1), "abc");
    expect(screen.getByText("Escribe un número entre 0 y 1 (por ejemplo, 0,25 o 1/4).")).toBeTruthy();
    expect(cell(1, 1).getAttribute("aria-invalid")).toBe("true");
  });

  it("v0 que no es distribución", () => {
    renderPage();
    loadExample();
    type(screen.getByLabelText("v₀(1)"), "0,5");
    type(screen.getByLabelText("v₀(2)"), "0,6");
    type(screen.getByLabelText("v₀(3)"), "0");
    expect(screen.getByText("v₀ debe sumar 1 y no tener valores negativos. Ahora suma 1,1.")).toBeTruthy();
  });

  it("pegar una tabla rellena la cuadrícula", () => {
    renderPage();
    fireEvent.paste(cell(1, 1), {
      clipboardData: { getData: () => "0.5\t0.3\t0.2\n0.2\t0.6\t0.2\n0.1\t0.3\t0.6" },
    });
    expect(cell(1, 1).value).toBe("0.5");
    expect(cell(3, 3).value).toBe("0.6");
    expect(screen.getByText("Estocástica por filas")).toBeTruthy();
  });

  it("tamaño: 4x4 conserva valores; reducir con datos pide confirmación", () => {
    renderPage();
    loadExample();
    fireEvent.click(screen.getByRole("radio", { name: "4×4" }));
    expect(cell(1, 1).value).toBe("0,5");
    expect(cell(4, 4).value).toBe("");
    expect((screen.getByLabelText("Nombre del estado 4") as HTMLInputElement).value).toBe("Estado 4");
    type(cell(4, 4), "1");
    fireEvent.click(screen.getByRole("radio", { name: "3×3" }));
    expect(screen.getByText("Reducir a 3×3: se perderán las filas y columnas sobrantes.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Conservar tamaño" }));
    expect(screen.queryByLabelText("P(4,4)")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "3×3" }));
    fireEvent.click(screen.getByRole("button", { name: "Reducir matriz" }));
    expect(screen.queryByLabelText("P(4,4)")).toBeNull();
  });

  it("?n=4 abre en 4×4 y un valor inválido cae a 3", () => {
    renderPage("/laboratorios/markov?n=4");
    expect(screen.getByLabelText("P(4,4)")).toBeTruthy();
    cleanup();
    renderPage("/laboratorios/markov?n=9");
    expect(screen.queryByLabelText("P(4,4)")).toBeNull();
    expect(screen.getByLabelText("P(3,3)")).toBeTruthy();
  });

  it("persistencia local con debounce y sin datos en la URL", () => {
    vi.useFakeTimers();
    renderPage();
    loadExample();
    expect(localStorage.getItem("ia-labs.markov.v1")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(600);
    });
    const stored = JSON.parse(localStorage.getItem("ia-labs.markov.v1")!);
    expect(stored.P[0]).toEqual(["0,5", "0,3", "0,2"]);
    expect(screen.getByTestId("loc").textContent).toBe("/laboratorios/markov?n=3");
    cleanup();
    renderPage();
    expect(cell(1, 1).value).toBe("0,5");
  });

  it("almacenamiento corrupto se ignora", () => {
    localStorage.setItem("ia-labs.markov.v1", '{"v":1,"size":3,"names":[],"P":[]}');
    renderPage();
    expect(cell(1, 1).value).toBe("");
    cleanup();
    localStorage.setItem("ia-labs.markov.v1", "x".repeat(9000));
    renderPage();
    expect(cell(1, 1).value).toBe("");
  });

  it("Restablecer matriz pide confirmación", () => {
    renderPage();
    const reset = screen.getByRole("button", { name: "Restablecer matriz" }) as HTMLButtonElement;
    expect(reset.disabled).toBe(true);
    loadExample();
    fireEvent.click(screen.getByRole("button", { name: "Restablecer matriz" }));
    expect(
      screen.getByText(
        "Restablecer matriz: se perderán los valores de P, v₀ y los nombres de estados que has escrito. No se puede deshacer.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Conservar matriz" })).toBeTruthy();
    const confirm = screen.getAllByRole("button", { name: "Restablecer matriz" });
    fireEvent.click(confirm[confirm.length - 1]!);
    expect(cell(1, 1).value).toBe("");
  });

  it("sin afordancias de copiar respuesta (D-07)", () => {
    renderPage();
    loadExample();
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("Copiar respuesta");
    expect(text).not.toContain("Respuesta:");
    expect(text).not.toContain("para el foro");
  });
});

describe("MarkovLabPage: evolución", () => {
  it("pasos 1..3 con v3 igual a NumPy", () => {
    renderPage();
    loadExample();
    expect(screen.getByText("Evolución v₀ → vₙ")).toBeTruthy();
    expect(screen.getByText("Comprueba tu desarrollo")).toBeTruthy();
    expect(screen.getByText("Paso 1: v₁ = v₀ · P")).toBeTruthy();
    expect(screen.getByText("Paso 2: v₂ = v₁ · P")).toBeTruthy();
    expect(screen.getByText("Paso 3: v₃ = v₂ · P")).toBeTruthy();
    expect(screen.getByText("Leer 0,2575")).toBeTruthy();
    expect(screen.getByText("Programar 0,4305")).toBeTruthy();
    expect(screen.getByText("Descansar 0,3120")).toBeTruthy();
    expect(screen.getByText("Leer 0,3500")).toBeTruthy();
  });

  it("subir n a 5 añade pasos 4 y 5", () => {
    renderPage();
    loadExample();
    expect(screen.queryByText("Paso 4: v₄ = v₃ · P")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Más pasos" }));
    fireEvent.click(screen.getByRole("button", { name: "Más pasos" }));
    expect(screen.getByText("Paso 4: v₄ = v₃ · P")).toBeTruthy();
    expect(screen.getByText("Paso 5: v₅ = v₄ · P")).toBeTruthy();
  });

  it("gráfico: svg accesible, una polilínea por estado y tabla de valores", () => {
    renderPage();
    loadExample();
    const svg = screen.getByRole("img", { name: /Evolución de la probabilidad/ });
    const lines = svg.querySelectorAll("polyline");
    expect(lines).toHaveLength(3);
    lines.forEach((l) => expect(l.getAttribute("points")!.trim().split(" ")).toHaveLength(4));
    expect(screen.getByText("Ver los valores del gráfico")).toBeTruthy();
    const rows = screen.getAllByRole("row", { hidden: true }).filter((r) => r.closest("table"));
    expect(rows).toHaveLength(5);
    expect(rows[4]!.textContent).toContain("0,2575");
  });

  it("seleccionar una serie la marca y solo ella usa el acento", () => {
    renderPage();
    loadExample();
    const svg = screen.getByRole("img", { name: /Evolución de la probabilidad/ });
    expect(svg.querySelectorAll(".text-accent")).toHaveLength(0);
    const btn = screen.getByRole("button", { name: "Programar" });
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(svg.querySelectorAll(".text-accent")).toHaveLength(1);
    expect(svg.querySelector('[data-series="1"]')!.classList.contains("text-accent")).toBe(true);
  });

  it("sin texto de conclusión ni botón de copiar", () => {
    renderPage();
    loadExample();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/Por lo tanto|Respuesta/);
    expect(screen.queryByRole("button", { name: /copiar/i })).toBeNull();
  });
});

describe("MarkovLabPage: matriz compacta", () => {
  it("renderiza una cabecera de columna por estado más Σ, para cada tamaño", () => {
    renderPage();
    for (const n of [3, 4, 5]) {
      fireEvent.click(screen.getByRole("radio", { name: `${n}×${n}` }));
      const grid = screen.getByRole("grid", { name: "Matriz P por filas" });
      expect(grid.querySelectorAll('[role="columnheader"]').length).toBe(n + 1);
      expect(grid.querySelectorAll("input").length).toBe(n * n);
    }
  });
});
