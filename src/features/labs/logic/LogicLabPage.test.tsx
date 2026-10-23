// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { renderTex } from "../../../lib/tex.tsx";
import { LabsRoutes } from "../labs.tsx";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function Loc() {
  const l = useLocation();
  return <span data-testid="loc">{decodeURIComponent(l.pathname + l.search)}</span>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/laboratorios/*" element={<LabsRoutes />} />
      </Routes>
      <Loc />
    </MemoryRouter>,
  );
}

const field = () => screen.findByLabelText("Fórmula") as Promise<HTMLInputElement>;
async function typeFormula(v: string) {
  fireEvent.change(await field(), { target: { value: v } });
}
const bodyRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

const cells = (row: HTMLElement) =>
  within(row)
    .getAllByRole("cell")
    .map((c) => c.textContent);

describe("labs routing", () => {
  it("/laboratorios redirects to simbolos", async () => {
    renderAt("/laboratorios");
    expect(
      // Lazy route chunk: allow time under full-suite load.
      await screen.findByRole("heading", { level: 1, name: "Diccionario de simbología" }, { timeout: 5000 }),
    ).toBeTruthy();
  });

  it("/laboratorios/markov shows the Markov page", async () => {
    renderAt("/laboratorios/markov");
    expect(
      // Lazy route chunk: allow time under full-suite load.
      await screen.findByRole("heading", { level: 1, name: "Simulador de Markov" }, { timeout: 5000 }),
    ).toBeTruthy();
  });

  it("sub-nav has three tabs and marks the active one", async () => {
    renderAt("/laboratorios/markov");
    await screen.findByRole("heading", { level: 1 });
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Simbología", "Lógica", "Markov"]);
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "false", "true"]);
  });
});

describe("Tex", () => {
  it("renders and caches", () => {
    const a = renderTex("p \\land q");
    expect(a).toContain("katex");
    expect(renderTex("p \\land q")).toBe(a);
  });
  it("does not throw on invalid TeX", () => {
    expect(() => renderTex("\\notacommand")).not.toThrow();
  });
});

describe("LogicLabPage single formula", () => {
  it("(p ∧ q) → r from the URL gives 8 rows and the verdict", async () => {
    renderAt("/laboratorios/logica?f=(p%20%E2%88%A7%20q)%20%E2%86%92%20r");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Laboratorio de lógica" }),
    ).toBeTruthy();
    const table = await screen.findByRole("table");
    await waitFor(() => expect(within(table).getAllByRole("row").length).toBe(9));
    const rows = within(table).getAllByRole("row").slice(1);
    // columns: p, q, r, p ∧ q (intermediate, on by default), Resultado
    expect(cells(rows[0]!)).toEqual(["1", "1", "1", "1", "1"]);
    expect(cells(rows[1]!)).toEqual(["1", "1", "0", "1", "0"]);
    expect(screen.getByText("Contingencia")).toBeTruthy();
    expect(screen.getByText("Verdadera en 7 de 8 filas")).toBeTruthy();
  });

  it("accepts the ASCII form", async () => {
    renderAt("/laboratorios/logica");
    await typeFormula("(p & q) -> r");
    await waitFor(() => expect(bodyRows().length).toBe(8));
    expect(screen.getByLabelText("Fórmula normalizada")).toBeTruthy();
  });

  it("1/0 by default, V/F toggle persists", async () => {
    renderAt("/laboratorios/logica?f=p");
    await waitFor(() => expect(bodyRows().length).toBe(2));
    expect(cells(bodyRows()[0]!)).toEqual(["1", "1"]);
    fireEvent.click(screen.getByRole("radio", { name: "V / F" }));
    expect(cells(bodyRows()[0]!)).toEqual(["V", "V"]);
    expect(cells(bodyRows()[1]!)).toEqual(["F", "F"]);
    expect(localStorage.getItem("ia-labs.logic-format")).toBe("VF");
    cleanup();
    renderAt("/laboratorios/logica?f=p");
    await waitFor(() => expect(bodyRows().length).toBe(2));
    expect(cells(bodyRows()[0]!)).toEqual(["V", "V"]);
  });

  it("?v=vf selects V/F and junk storage is ignored", async () => {
    localStorage.setItem("ia-labs.logic-format", "junk");
    renderAt("/laboratorios/logica?f=p&v=vf");
    await waitFor(() => expect(bodyRows().length).toBe(2));
    expect(cells(bodyRows()[0]!)).toEqual(["V", "V"]);
    cleanup();
    renderAt("/laboratorios/logica?f=p");
    await waitFor(() => expect(bodyRows().length).toBe(2));
    expect(cells(bodyRows()[0]!)).toEqual(["1", "1"]);
  });

  it("tautology and contradiction chips", async () => {
    renderAt("/laboratorios/logica");
    await typeFormula("p ∨ ¬p");
    expect(await screen.findByText("Tautología")).toBeTruthy();
    await typeFormula("p ∧ ¬p");
    expect(await screen.findByText("Contradicción")).toBeTruthy();
  });

  it("shows a positioned error after the pause and keeps the previous table", async () => {
    renderAt("/laboratorios/logica");
    await typeFormula("p ∨ q");
    await waitFor(() => expect(bodyRows().length).toBe(4));
    await typeFormula("p ∧");
    expect(screen.queryByRole("alert")).toBeNull();
    const alert = await screen.findByRole("alert", {}, { timeout: 2000 });
    expect(alert.textContent).toBe(
      "Hay un error en la posición 3: se esperaba una variable o una negación después de «∧».",
    );
    expect((await field()).getAttribute("aria-invalid")).toBe("true");
    expect(bodyRows().length).toBe(4);
  });

  it("too many variables", async () => {
    renderAt("/laboratorios/logica");
    await typeFormula("a ∧ b ∧ c ∧ d ∧ e ∧ f ∧ g");
    expect(await screen.findByText(/Esta fórmula tiene 7 variables y la tabla tendría 128 filas/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("⊕ chip and rewrite to ∨", async () => {
    renderAt("/laboratorios/logica");
    await typeFormula("p ⊕ q");
    expect(
      await screen.findByText(
        "En el álgebra de Boole de clase, ⊕ es la suma (∨). Aquí ⊕ se interpreta como disyunción exclusiva (⊻). Usa + o ∨ si querías la suma.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Interpretar ⊕ como suma" }));
    expect((await field()).value).toBe("p ∨ q");
    expect(screen.queryByRole("button", { name: "Interpretar ⊕ como suma" })).toBeNull();
  });

  it("keypad inserts ⊻ at the caret, has no ⊕ key and deletes", async () => {
    renderAt("/laboratorios/logica");
    const input = await field();
    fireEvent.change(input, { target: { value: "pq" } });
    input.setSelectionRange(1, 1);
    fireEvent.click(screen.getByRole("button", { name: "o exclusivo («o … o»)" }));
    expect(input.value).toBe("p⊻q");
    expect(screen.queryByRole("button", { name: /⊕/ })).toBeNull();
    expect(screen.queryByText("⊕")).toBeNull();
    await waitFor(() => expect(input.selectionStart).toBe(2));
    fireEvent.click(screen.getByRole("button", { name: "Borrar carácter" }));
    expect(input.value).toBe("pq");
  });

  it("empty state examples fill the field", async () => {
    renderAt("/laboratorios/logica");
    expect(await screen.findByRole("heading", { name: "Escribe una fórmula" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "p → q" }));
    await waitFor(() => expect(bodyRows().length).toBe(4));
  });

  it("syncs ?f and ignores an over-long ?f", async () => {
    renderAt("/laboratorios/logica");
    await typeFormula("p → q");
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toContain("f=p+→+q"), {
      timeout: 2000,
    });
    cleanup();
    renderAt(`/laboratorios/logica?f=${"p".repeat(501)}`);
    expect(await screen.findByRole("heading", { name: "Escribe una fórmula" })).toBeTruthy();
  });
});

describe("Comparar mode", () => {
  const CMP = "/laboratorios/logica?m=comparar&f=p%20%E2%86%92%20q&g=q%20%E2%86%92%20p";

  it("p → q vs q → p differ in 2 rows", async () => {
    renderAt(CMP);
    expect(await screen.findByLabelText("Fórmula A")).toBeTruthy();
    expect(screen.getByLabelText("Fórmula B")).toBeTruthy();
    expect(await screen.findByText("No equivalentes: difieren en 2 filas")).toBeTruthy();
    const heads = within(screen.getByRole("table")).getAllByRole("columnheader").map((h) => h.textContent);
    expect(heads).toEqual(expect.arrayContaining(["A", "B", "Coinciden"]));
    expect(bodyRows().length).toBe(4);
    expect(screen.getAllByText("≠").length).toBe(2);
    fireEvent.click(screen.getByRole("switch", { name: "Mostrar solo filas que difieren" }));
    await waitFor(() => expect(bodyRows().length).toBe(2));
    expect(screen.getByText("2 de 4 filas")).toBeTruthy();
  });

  it("example chips load the pairs", async () => {
    renderAt("/laboratorios/logica?m=comparar");
    fireEvent.click(await screen.findByRole("button", { name: "Implicación frente a contrarrecíproco" }));
    expect(await screen.findByText("Equivalentes")).toBeTruthy();
    expect((screen.getByLabelText("Fórmula B") as HTMLInputElement).value).toBe("¬q → ¬p");
    fireEvent.click(screen.getByRole("button", { name: "Implicación frente a recíproco" }));
    expect(await screen.findByText("No equivalentes: difieren en 2 filas")).toBeTruthy();
    expect((screen.getByLabelText("Fórmula B") as HTMLInputElement).value).toBe("q → p");
  });

  it("Comparar fórmulas focuses the verdict and exists only in this mode", async () => {
    renderAt(CMP);
    const btn = await screen.findByRole("button", { name: "Comparar fórmulas" });
    await screen.findByTestId("verdict");
    fireEvent.click(btn);
    expect(document.activeElement).toBe(screen.getByTestId("verdict"));
    cleanup();
    renderAt("/laboratorios/logica?f=p");
    await field();
    expect(screen.queryByRole("button", { name: "Comparar fórmulas" })).toBeNull();
  });

  it("labels the variable that one side does not use", async () => {
    renderAt("/laboratorios/logica?m=comparar&f=p&g=p%20%E2%88%A7%20q");
    expect(await screen.findByText("A no usa q")).toBeTruthy();
  });

  it("one keypad that inserts into the last focused field", async () => {
    renderAt("/laboratorios/logica?m=comparar");
    const b = (await screen.findByLabelText("Fórmula B")) as HTMLInputElement;
    expect(screen.getAllByRole("group", { name: "Teclado de símbolos" }).length).toBe(1);
    b.focus();
    fireEvent.click(screen.getByRole("button", { name: "variable q" }));
    expect(b.value).toBe("q");
    expect((screen.getByLabelText("Fórmula A") as HTMLInputElement).value).toBe("");
  });
});

describe("Normal forms and intermediate columns", () => {
  it("(p ∧ q) → r shows FND, FNC with ΠM(6) and the sub column", async () => {
    renderAt("/laboratorios/logica?f=(p%20%E2%88%A7%20q)%20%E2%86%92%20r");
    expect(await screen.findByRole("heading", { name: "Forma normal disyuntiva (FND)" })).toBeTruthy();
    expect(screen.getByText("Minterms: m₀, m₁, m₂, m₃, m₄, m₅, m₇")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Forma normal conjuntiva (FNC)" })).toBeTruthy();
    expect(screen.getByText("Maxterms: M₆")).toBeTruthy();
    expect(screen.getByText("(¬p ∨ ¬q ∨ r)")).toBeTruthy();
    expect(screen.getByText(/Formas canónicas sin simplificar/)).toBeTruthy();
    const sw = screen.getByRole("switch", { name: "Mostrar pasos intermedios" });
    expect(sw.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("columnheader", { name: "p ∧ q" })).toBeTruthy();
    fireEvent.click(sw);
    await waitFor(() => expect(screen.queryByRole("columnheader", { name: "p ∧ q" })).toBeNull());
  });

  it("tautology and contradiction empty-list copy", async () => {
    renderAt("/laboratorios/logica");
    await typeFormula("p ∨ ¬p");
    expect(await screen.findByText("Sin maxterms: la fórmula es una tautología.")).toBeTruthy();
    await typeFormula("p ∧ ¬p");
    expect(await screen.findByText("Sin minterms: la fórmula es una contradicción.")).toBeTruthy();
  });

  it("starts with intermediate columns off above 5 subformulas", async () => {
    renderAt("/laboratorios/logica");
    await typeFormula("(a ∧ b) ∨ (c ∧ d) ∨ (e ∧ f) ∨ ¬a ∨ ¬b ∨ ¬c");
    const sw = await screen.findByRole("switch", { name: "Mostrar pasos intermedios" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
  });
});

describe("Integridad académica y Comprueba tu respuesta", () => {
  it("permite verificar una hipótesis, da pistas y alterna la solución completa", async () => {
    renderAt("/laboratorios/logica?f=p%20%E2%88%A7%20q");
    expect(await screen.findByText("Comprueba tu respuesta")).toBeTruthy();
    expect(screen.getByText("Aviso de integridad: contrasta tus resultados tras intentar resolver el ejercicio por ti mismo.")).toBeTruthy();

    // Selecciona incorrecto: Es tautología
    fireEvent.click(screen.getByRole("button", { name: "Es tautología" }));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("No coincide. Inténtalo de nuevo.")).toBeTruthy();
    expect(screen.getByText(/Pista: Evalúa interpretaciones con valores opuestos/)).toBeTruthy();

    // Selecciona correcto: Es contingencia
    fireEvent.click(screen.getByRole("button", { name: "Es contingencia" }));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText(/¡Correcto! Es una contingencia/)).toBeTruthy();

    // Ocultar y volver a mostrar la solución detallada
    const toggleBtn = screen.getByRole("button", { name: "Ocultar solución detallada" });
    fireEvent.click(toggleBtn);
    expect(screen.queryByRole("table")).toBeNull();

    const showBtn = screen.getByRole("button", { name: "Ver la solución completa" });
    fireEvent.click(showBtn);
    expect(screen.getByRole("table")).toBeTruthy();
  });
});

