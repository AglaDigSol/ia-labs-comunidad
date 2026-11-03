// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { PROB_EXERCISES } from "../../../../shared/exercises/probability.ts";
import { seedToText } from "../../../../shared/exercises/random.ts";
import { EXERCISE_LEVELS, LEVEL_SLUGS } from "../../../../shared/exercises/types.ts";
import { NOTE_DOT, NOTE_MORE_DIGITS, NOTE_ROUNDING } from "../../../../shared/probability/answer.ts";
import { LabsRoutes } from "../labs.tsx";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function Loc() {
  const l = useLocation();
  return <span data-testid="loc">{l.pathname + l.search}</span>;
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

const heading = () => screen.findByRole("heading", { level: 1, name: "Probabilidad" }, { timeout: 5000 });
const type = (label: string | RegExp, value: string, root: HTMLElement = document.body) => fireEvent.change(within(root).getByLabelText(label), { target: { value } });
const invalid = (label: string | RegExp, root: HTMLElement = document.body) => within(root).getByLabelText(label).getAttribute("aria-invalid") === "true";
const box = (title: string) => screen.getByRole("heading", { level: 2, name: title }).closest("section")!;
const status = (root: HTMLElement) => within(root).getAllByRole("status").map((s) => s.textContent ?? "").join(" ");

describe("Probabilidad condicionada y Bayes", () => {
  it("el árbol se comprueba casilla a casilla, sin decir los valores, y avisa del formato del examen", async () => {
    renderAt("/laboratorios/probabilidad");
    await heading();
    expect(screen.getByRole("tab", { name: "Probabilidad" }).getAttribute("aria-selected")).toBe("true");
    const tree = box("Árbol de probabilidad");
    expect(within(tree).getByRole("img", { name: /Árbol de probabilidad con 2 ramas/ })).toBeTruthy();
    expect(screen.queryByTestId("solution")).toBeNull();

    // Servidores: P(S₁) = 0,7; P(C | S₁) = 1/25; P(C | S₂) = 1/10.
    type("P(S₂)", "0,3", tree);
    type("P(Cᶜ | S₁)", "0,96", tree);
    type("P(Cᶜ | S₂)", "0,8", tree); // mal
    type("P(S₁ ∩ C)", "7/250", tree);
    type("P(S₂ ∩ C)", "0.03", tree); // con punto: vale con aviso
    type("P(C)", "0,058", tree);
    type("P(S₂ | C)", "0,51", tree); // truncado: no vale
    fireEvent.click(within(tree).getByRole("button", { name: "Comprobar" }));
    expect(invalid("P(Cᶜ | S₂)", tree)).toBe(true);
    expect(invalid("P(S₂ | C)", tree)).toBe(true);
    expect(invalid("P(S₂)", tree)).toBe(false);
    expect(status(tree)).toMatch(/5 de 7 bien/);
    expect(status(tree)).toContain(NOTE_DOT);
    expect(status(tree)).toContain(NOTE_ROUNDING);
    // Ni la complementaria ni Bayes aparecen en la corrección.
    expect(status(tree)).not.toMatch(/0,9\b|15\/29|0,52/);
    // El dibujo marca la rama mal (discontinua, con ✗).
    expect(tree.querySelector('[data-edge="n1"]')!.getAttribute("data-state")).toBe("mal");

    type("P(Cᶜ | S₂)", "9/10", tree);
    type("P(S₂ | C)", "0,5172", tree);
    fireEvent.click(within(tree).getByRole("button", { name: "Comprobar" }));
    expect(status(tree)).toMatch(/¡Correcto! El árbol está completo\./);
    expect(status(tree)).toContain(NOTE_MORE_DIGITS(2));

    fireEvent.click(within(tree).getByRole("button", { name: "Dame una pista" }));
    expect(within(tree).getByText(/Las ramas que salen de un mismo nodo suman 1/)).toBeTruthy();
    fireEvent.click(within(tree).getByRole("button", { name: "Ver la solución completa" }));
    expect(within(tree).getByTestId("solution").textContent).toMatch(/15/);
  });

  it("tabla de contingencia: casillas, condicionadas e independencia", async () => {
    renderAt("/laboratorios/probabilidad");
    await heading();
    const table = box("Tabla de contingencia");
    // Python y prácticas: P(A ∩ B) = 0,3, P(A) = 0,6, P(B) = 0,5.
    type("P(A ∩ Bᶜ)", "0,3", table);
    type("P(Aᶜ ∩ B)", "0,2", table);
    type("P(Aᶜ ∩ Bᶜ)", "0,2", table);
    type("P(Aᶜ)", "0,4", table);
    type("P(Bᶜ)", "1/2", table);
    type("P(A | B)", "0,6", table);
    type("P(B | A)", "0,5", table);
    fireEvent.click(within(table).getByRole("radio", { name: "No" }));
    fireEvent.click(within(table).getByRole("button", { name: "Comprobar" }));
    expect(status(table)).toMatch(/Revisa la independencia/);
    fireEvent.click(within(table).getByRole("radio", { name: "Sí" }));
    fireEvent.click(within(table).getByRole("button", { name: "Comprobar" }));
    expect(status(table)).toMatch(/¡Correcto! Son independientes/);
  });

  it("condicionada con un dado: cuatro opciones a)–d) y «Otro dado»", async () => {
    renderAt("/laboratorios/probabilidad");
    await heading();
    const die = box("Condicionada con un dado");
    expect(within(die).getAllByRole("radio")).toHaveLength(4);
    expect(within(die).getByRole("radio", { name: /^a\) / })).toBeTruthy();
    fireEvent.click(within(die).getByRole("button", { name: "Comprobar" }));
    expect(status(die)).toMatch(/Elige una opción/);
    fireEvent.click(screen.getByRole("button", { name: "Otro dado" }));
    expect(within(box("Condicionada con un dado")).getAllByRole("radio")).toHaveLength(4);
  });
});

describe("Independencia", () => {
  it("unión, condicionada y la o las afirmaciones correctas", async () => {
    renderAt("/laboratorios/probabilidad?s=independencia");
    await heading();
    const p = box("Condicionada e independencia");
    // Dos modelos: P(A) = 0,8, P(B) = 0,7, P(A ∩ B) = 0,56 (independientes).
    type("P(A ∪ B)", "0,94", p);
    type("P(A | B)", "0,8", p);
    expect(within(p).getAllByRole("checkbox")).toHaveLength(4);
    fireEvent.click(within(p).getByRole("checkbox", { name: /A y B son independientes/ }));
    fireEvent.click(within(p).getByRole("checkbox", { name: /incompatibles/ }));
    fireEvent.click(within(p).getByRole("button", { name: "Comprobar" }));
    expect(status(p)).toMatch(/alguna afirmación está mal marcada/);
    fireEvent.click(within(p).getByRole("checkbox", { name: /incompatibles/ }));
    // P(A | B) = 0,8 es verdadera.
    fireEvent.click(within(p).getByRole("checkbox", { name: /P\(A \| B\) = 0,8/ }));
    fireEvent.click(within(p).getByRole("button", { name: "Comprobar" }));
    expect(status(p)).toMatch(/¡Correcto! Son independientes/);
  });
});

describe("Distribuciones discretas", () => {
  it("el explorador dibuja barras y función de distribución; la práctica pide la distribución", async () => {
    renderAt("/laboratorios/probabilidad?s=distribuciones");
    await heading();
    const ex = box("Explorador de distribuciones");
    const chart = within(ex).getByRole("img", { name: /binomial de parámetros n = 10 y p = 0,3/ });
    expect(chart.querySelectorAll("[data-k]")).toHaveLength(11);
    expect(chart.querySelector('[data-curve="cdf"]')).not.toBeNull();
    fireEvent.change(within(ex).getByLabelText("p (éxito)"), { target: { value: "2" } });
    expect(within(ex).getByRole("alert").textContent).toMatch(/p va entre 0 y 1/);

    const pr = box("¿Qué distribución es? Calcula");
    // Cinco imágenes: B(5, 4/5), k = 4.
    type("P(X = 4)", "0,41", pr); // 256/625 = 0,4096
    type("P(X ≥ 4)", "0,74", pr); // 2304/3125 = 0,73728
    type("E[X]", "4", pr);
    type("Var(X)", "0,8", pr);
    fireEvent.click(within(pr).getByRole("button", { name: "Comprobar" }));
    expect(status(pr)).toMatch(/Elige qué distribución sigue X/);
    fireEvent.change(within(pr).getByLabelText("¿Qué distribución sigue X?"), { target: { value: "binomial" } });
    fireEvent.click(within(pr).getByRole("button", { name: "Comprobar" }));
    expect(status(pr)).toMatch(/¡Correcto!/);
    expect(status(pr)).toMatch(/número de éxitos en n intentos/);
    expect(within(pr).getByRole("img", { name: /Diagrama de barras/ }).querySelectorAll('[data-highlight="true"]')).toHaveLength(1);
  });
});

describe("Valor esperado y juegos", () => {
  it("la tabla del juego, la penalización y E[XY]", async () => {
    renderAt("/laboratorios/probabilidad?s=esperanza");
    await heading();
    const g = box("Tabla del juego");
    // Cobrar la cara: pagas 4 €, cobras la cara; E = 3,5 − 4.
    for (let face = 1; face <= 6; face++) {
      type(`Ganancia con cara ${face}`, String(face - 4), g);
      type(`Probabilidad de cara ${face}`, "1/6", g);
      type(`Ganancia por probabilidad con cara ${face}`, `${face - 4}/6`, g);
    }
    type("E[X]", "-0,5", g);
    fireEvent.click(within(g).getByRole("button", { name: "Comprobar" }));
    expect(status(g)).toMatch(/¡Correcto! El juego es desfavorable/);

    const pen = box("Penalización por fallo");
    type("P(acertar al azar)", "1/4", pen);
    type("P(fallar al azar)", "3/4", pen);
    type("Lo que resta un fallo (en puntos)", "0,25", pen);
    fireEvent.click(within(pen).getByRole("button", { name: "Comprobar" }));
    expect(invalid("Lo que resta un fallo (en puntos)", pen)).toBe(true);
    type("Lo que resta un fallo (en puntos)", "1/3", pen);
    fireEvent.click(within(pen).getByRole("button", { name: "Comprobar" }));
    expect(status(pen)).toMatch(/¡Correcto!/);

    const prod = box("Esperanza con variables independientes");
    type("E[X]", "2", prod);
    type("E[Y]", "1/2", prod);
    type("E[XY]", "1", prod);
    type(/^E\[2X/, "4", prod); // 2·2 − 1/2 + 3 = 6,5: mal
    type("Var(X + Y)", "1/1", prod);
    fireEvent.click(within(prod).getByRole("button", { name: "Comprobar" }));
    expect(status(prod)).toMatch(/3 de 5 bien/);
  });
});

describe("Simulación", () => {
  it("con semilla: la frecuencia se acerca a la probabilidad", async () => {
    renderAt("/laboratorios/probabilidad?s=simulacion");
    await heading();
    const sim = box("Frecuencia relativa y probabilidad");
    fireEvent.change(within(sim).getByLabelText("Repeticiones"), { target: { value: "10000" } });
    fireEvent.click(within(sim).getByRole("button", { name: "Simular" }));
    const text = within(sim).getByRole("status").textContent!;
    expect(text).toMatch(/de 10\.000 veces/);
    const freq = Number(/frecuencia (\d,\d+)/.exec(text)![1]!.replace(",", "."));
    expect(Math.abs(freq - 1 / 6)).toBeLessThan(0.02);
    expect(within(sim).getByRole("img", { name: /Frecuencia relativa/ }).querySelector('[data-curve="p"]')).not.toBeNull();
  });
});

describe("banco de ejercicios", () => {
  it("cada tipo de probabilidad se abre en cada nivel con su práctica y la solución oculta", async () => {
    for (const t of PROB_EXERCISES) {
      for (const level of EXERCISE_LEVELS) {
        const { unmount } = renderAt(`/laboratorios/ejercicios?t=${t.id}&n=${LEVEL_SLUGS[level]}&s=${seedToText(7)}`);
        expect(await screen.findByRole("heading", { level: 2, name: `Ejercicio 1: ${t.title}` }, { timeout: 5000 })).toBeTruthy();
        expect(screen.getAllByRole("button", { name: "Comprobar" }).length).toBeGreaterThan(0);
        expect(screen.getAllByRole("button", { name: "Ver la solución completa" }).length).toBeGreaterThan(0);
        expect(screen.queryByTestId("solution")).toBeNull();
        unmount();
      }
    }
  });
});
