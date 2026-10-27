// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_LABS_KEYS } from "../labs-storage.ts";
import { LabsRoutes } from "../labs.tsx";
import { parseBooleDraft } from "./boole-storage.ts";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/laboratorios/*" element={<LabsRoutes />} />
      </Routes>
    </MemoryRouter>,
  );
}

const structureSelect = () => screen.findByLabelText("Estructura (B, ⊕, ⊙, ′, 0, 1)", {}, { timeout: 5000 });
const axiom = (name: RegExp) => within(screen.getByRole("group", { name }));

describe("¿Es un álgebra de Boole?", () => {
  it("D₁₂: corrige, da pistas progresivas tras fallar y la solución queda detrás del aviso", async () => {
    renderAt("/laboratorios/boole");
    fireEvent.change(await structureSelect(), { target: { value: "div-12" } });
    expect(screen.getByRole("heading", { level: 2, name: "D₁₂ · 6 elementos" })).toBeTruthy();
    expect(screen.queryByTestId("solution")).toBeNull();
    for (const n of [/^B1/, /^B2/, /^B3/, /^B4/, /^B5/]) fireEvent.click(axiom(n).getByRole("radio", { name: "Se cumple" }));
    // Sin intento fallido no hay pistas.
    expect(screen.queryByRole("button", { name: "Pista para B5" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("4 de 5 axiomas bien")).toBeTruthy();
    expect(within(screen.getByTestId("verdict-B5")).getByText("No es correcto")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pista para B5" }));
    expect(screen.getByText("Revisa B5: fíjate en la identidad a ⊕ a′ = 1.")).toBeTruthy();
    expect(screen.queryByText("Revisa B5 con a = 2.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Otra pista para B5" }));
    expect(screen.getByText("Revisa B5 con a = 2.")).toBeTruthy();

    // Contraejemplo equivocado (a = 4) y después el bueno (a = 2).
    fireEvent.click(axiom(/^B5/).getByRole("radio", { name: "No se cumple" }));
    const pickA = axiom(/^B5/).getByLabelText("B5: elemento a");
    fireEvent.change(pickA, { target: { value: "3" } }); // índice 3 = «4»
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(within(screen.getByTestId("verdict-B5")).getByText(/Con a = 4 se cumple/)).toBeTruthy();
    fireEvent.change(pickA, { target: { value: "1" } }); // «2»
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(within(screen.getByTestId("verdict-B5")).getByText("Con a = 2: 2 ⊕ 2′ = 2 ⊕ 6 = 6, pero debería dar 12 (a ⊕ a′ = 1).")).toBeTruthy();
    expect(screen.getByText("¡Correcto! Falla al menos un axioma: no es un álgebra de Boole.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
    const sol = within(screen.getByTestId("solution"));
    expect(sol.getByText(/Primer contraejemplo, con a = 2/)).toBeTruthy();
    expect(sol.getByText("D₁₂ no es un álgebra de Boole.")).toBeTruthy();
  });

  it("un «no se cumple» en un axioma que sí se cumple se corrige", async () => {
    renderAt("/laboratorios/boole");
    fireEvent.change(await structureSelect(), { target: { value: "div-30" } });
    fireEvent.click(axiom(/^B1/).getByRole("radio", { name: "No se cumple" }));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(within(screen.getByTestId("verdict-B1")).getByText(/Este axioma se cumple/)).toBeTruthy();
    expect(screen.getByText("Marca una respuesta en cada axioma.")).toBeTruthy();
  });

  it("diagrama de Hasse accesible de P({a,b})", async () => {
    renderAt("/laboratorios/boole");
    fireEvent.change(await structureSelect(), { target: { value: "partes-2" } });
    const svg = screen.getByRole("img", { name: /Diagrama de Hasse/ });
    const label = svg.getAttribute("aria-label")!;
    for (const c of ["{a} cubre a ∅", "{b} cubre a ∅", "{a,b} cubre a {a}", "{a,b} cubre a {b}"]) expect(label).toContain(c);
    expect(svg.querySelectorAll("line")).toHaveLength(4);
  });

  it("personalizada: cambiar una celda rompe B1 y se guarda", async () => {
    renderAt("/laboratorios/boole");
    fireEvent.change(await structureSelect(), { target: { value: "personalizada" } });
    fireEvent.change(screen.getByLabelText("a ⊕ b"), { target: { value: "1" } }); // a ⊕ b = a
    fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
    expect(within(screen.getByTestId("solution")).getByText(/a ⊕ b = a, pero b ⊕ a = 1/)).toBeTruthy();
    const saved = parseBooleDraft(localStorage.getItem(DEFAULT_LABS_KEYS.boole)!)!;
    expect(saved.kind).toBe("personalizada");
    expect(saved.custom?.plus[1]![2]).toBe(1);
  });

  it("producto demasiado grande: avisa del límite", async () => {
    renderAt("/laboratorios/boole");
    fireEvent.change(await structureSelect(), { target: { value: "producto" } });
    fireEvent.change(screen.getByLabelText("B₁"), { target: { value: "cubo-3" } });
    fireEvent.change(screen.getByLabelText("B₂"), { target: { value: "partes-2" } });
    expect(screen.getByRole("alert").textContent).toMatch(/32 elementos; el máximo es 16/);
    fireEvent.change(screen.getByLabelText("B₂"), { target: { value: "dos" } });
    expect(screen.getByRole("heading", { level: 2, name: /× \{0, 1\} · 16 elementos/ })).toBeTruthy();
  });
});

describe("Simplificar paso a paso", () => {
  async function startWith(expr: string) {
    renderAt("/laboratorios/boole?s=simplificar");
    fireEvent.change(await screen.findByLabelText("Elige una de práctica o escribe la tuya", {}, { timeout: 5000 }), {
      target: { value: "propia" },
    });
    fireEvent.change(screen.getByLabelText("Tu expresión"), { target: { value: expr } });
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
  }
  const step = (expr: string, law: string) => {
    fireEvent.change(screen.getByLabelText("Nueva expresión"), { target: { value: expr } });
    fireEvent.change(screen.getByLabelText("Ley que aplicas"), { target: { value: law } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
  };

  it("comprueba cada paso, avisa de la ley y compara con la forma mínima al terminar", async () => {
    await startWith("x ⊙ (x′ ⊕ y)");
    // Paso no equivalente: se rechaza y da una fila.
    step("x", "absorcion");
    expect(screen.getByText(/No es equivalente a la expresión anterior: con x = 1, y = 0/)).toBeTruthy();
    // Paso 1: distributiva.
    step("x x′ + x y", "B4");
    expect(screen.getByText("Paso correcto: B4 · Distributivas.")).toBeTruthy();
    // Paso 2: equivalente pero con la ley equivocada: se acepta con aviso.
    step("0 + xy", "demorgan");
    expect(screen.getAllByText("Equivalente, pero no parece ser la ley De Morgan; ¿quizá B5 · Complementación?").length).toBeGreaterThan(0);
    // Pista: leyes aplicables a 0 ⊕ x ⊙ y.
    fireEvent.click(screen.getByRole("button", { name: "Pista" }));
    expect(screen.getByText(/Leyes con alguna instancia aplicable ahora: B3 · Identidad/)).toBeTruthy();
    // Terminar con 0 ⊕ x ⊙ y: tiene ya el mínimo de literales, pero aún sobra el 0.
    fireEvent.click(screen.getByRole("button", { name: "He terminado" }));
    expect(screen.getByText("Casi: aún puedes quitar el 0 con B3 (identidad): a ⊕ 0 = a.")).toBeTruthy();
    expect(screen.queryByText(/¡Bien!/)).toBeNull();
    step("xy", "B3");
    expect(screen.getByText("Paso correcto: B3 · Identidad.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "He terminado" }));
    expect(screen.getByText(/¡Bien! Tu expresión tiene 2 literales/)).toBeTruthy();
    const steps = within(screen.getByRole("list", { name: "Pasos de la derivación" })).getAllByRole("listitem");
    expect(steps).toHaveLength(4);
    // La solución está oculta hasta pedirla.
    expect(screen.queryByText("Formas mínimas")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
    expect(within(screen.getByTestId("solution")).getByText("Formas mínimas")).toBeTruthy();
  });

  it("«He terminado» avisa de lo que aún se puede quitar: un 1 en un producto, un término repetido o un doble complemento", async () => {
    await startWith("x ⊙ 1");
    fireEvent.click(screen.getByRole("button", { name: "He terminado" }));
    expect(screen.getByText("Casi: aún puedes quitar el 1 con B3 (identidad): 1 ⊙ a = a.")).toBeTruthy();
    cleanup();
    localStorage.clear();
    await startWith("(y′)′");
    fireEvent.click(screen.getByRole("button", { name: "He terminado" }));
    expect(screen.getByText("Casi: aún puedes quitar un doble complemento: (a′)′ = a.")).toBeTruthy();
  });

  it("«He terminado» con literales de más no enseña la forma mínima", async () => {
    await startWith("x ⊕ x ⊙ y ⊕ z");
    fireEvent.click(screen.getByRole("button", { name: "He terminado" }));
    expect(screen.getByText(/tiene 4 literales y existe una forma con 2/)).toBeTruthy();
    expect(screen.queryByTestId("solution")).toBeNull();
  });

  it("la derivación se guarda y se recupera", async () => {
    await startWith("(x′)′ ⊕ x ⊙ z");
    step("x + xz", "involucion");
    const saved = parseBooleDraft(localStorage.getItem(DEFAULT_LABS_KEYS.boole)!)!;
    expect(saved.start).toBe("(x′)′ ⊕ x ⊙ z");
    expect(saved.steps).toEqual([{ expr: "x + xz", law: "involucion" }]);
    cleanup();
    renderAt("/laboratorios/boole?s=simplificar");
    const list = await screen.findByRole("list", { name: "Pasos de la derivación" }, { timeout: 5000 });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Deshacer último paso" }));
    expect(within(screen.getByRole("list", { name: "Pasos de la derivación" })).getAllByRole("listitem")).toHaveLength(1);
  });

  it("un borrador de la versión 1 se sigue leyendo y se completa con los campos nuevos", () => {
    const v1 = { v: 1, kind: "div-6", p1: "dos", p2: "dos", custom: null, start: "x ⊕ 0", steps: [] };
    expect(parseBooleDraft(JSON.stringify(v1))).toEqual({ ...v1, v: 2, circuit: null, build: "", buildMode: "basicas", f2: null });
  });

  it("un borrador dañado se descarta", () => {
    expect(parseBooleDraft("{")).toBeNull();
    expect(parseBooleDraft(JSON.stringify({ v: 1, kind: "nada", p1: "dos", p2: "dos", custom: null, start: null, steps: [] }))).toBeNull();
    expect(
      parseBooleDraft(JSON.stringify({ v: 1, kind: "dos", p1: "dos", p2: "dos", custom: { plus: [[9]], times: [[0]], comp: [0] }, start: null, steps: [] })),
    ).toBeNull();
    const v2 = { v: 2, kind: "dos", p1: "dos", p2: "dos", custom: null, start: null, steps: [], circuit: null, build: "", buildMode: "basicas", f2: null };
    expect(parseBooleDraft(JSON.stringify(v2))).toEqual(v2);
    expect(parseBooleDraft(JSON.stringify({ ...v2, buildMode: "xor" }))).toBeNull();
    expect(parseBooleDraft(JSON.stringify({ ...v2, f2: 16 }))).toBeNull();
    expect(parseBooleDraft(JSON.stringify({ ...v2, v: 3 }))).toBeNull();
  });
});

describe("Puertas y circuitos", () => {
  const answer = (text: string) => {
    fireEvent.change(screen.getByLabelText(/^f\(x, y, z\) =/), { target: { value: text } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
  };

  it("circuito → función: corrige por tabla de verdad, explica la primera fila distinta y comprueba cables", async () => {
    renderAt("/laboratorios/boole?s=circuitos");
    const choice = await screen.findByLabelText("Circuito", {}, { timeout: 5000 });
    fireEvent.change(choice, { target: { value: "producto-contra-nand" } });
    const svg = screen.getByRole("img", { name: /^Circuito con entradas x, y, z/ });
    expect(svg.getAttribute("aria-label")).toBe("Circuito con entradas x, y, z. A = x ⊙ y; B = (y ⊙ z)′; f = A ⊻ B.");
    // Mal: x ⊙ y ⊕ (y ⊙ z)′ difiere de A ⊻ B cuando x = y = z = 1 (no: 110 es la primera).
    answer("x ⊙ y ⊕ (y ⊙ z)′");
    expect(screen.getByText("No es equivalente. Con x = 1, y = 1, z = 0, el circuito vale 0 y tu expresión da 1.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pista: valores de los cables en esa fila" }));
    expect(screen.getByText(/En la fila x = 1, y = 1, z = 0: A = 1, B = 1, f = 0/)).toBeTruthy();
    // Bien, usando ⊻ y los nombres de los cables.
    answer("A ⊻ (yz)′");
    expect(screen.getByText(/¡Correcto! Tu expresión es equivalente al circuito en las 8 filas/)).toBeTruthy();
    // Otra variable: error de lectura.
    answer("x ⊕ q");
    expect(screen.getByText(/«q» no es una entrada ni un cable de este circuito/)).toBeTruthy();
    // Cables intermedios.
    fireEvent.change(screen.getByLabelText("B ="), { target: { value: "y′ ⊕ z′" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar B" }));
    expect(screen.getByText("B es correcto.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("A ="), { target: { value: "x ⊕ y" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar A" }));
    expect(screen.getByText(/A no coincide. Con x = 0, y = 1, z = 0, el cable A vale 0 y tu expresión da 1./)).toBeTruthy();
    // La solución, detrás del aviso.
    expect(screen.queryByTestId("solution")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
    expect(within(screen.getByTestId("solution")).getByText("Leyendo el circuito puerta a puerta:")).toBeTruthy();
    // El circuito elegido se guarda.
    expect(parseBooleDraft(localStorage.getItem(DEFAULT_LABS_KEYS.boole)!)!.circuit).toBe("producto-contra-nand");
  });

  it("función → circuito: dibuja, traduce a solo NAND y lo comprueba", async () => {
    renderAt("/laboratorios/boole?s=circuitos&v=construir");
    const field = await screen.findByLabelText("Expresión", {}, { timeout: 5000 });
    fireEvent.change(field, { target: { value: "x ⊕ y′" } });
    fireEvent.click(screen.getByRole("button", { name: "Dibujar el circuito" }));
    expect(screen.getByRole("img", { name: /^Circuito puertas básicas con entradas x, y: f = x ⊕ y′/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Solo NAND" }));
    const svg = screen.getByRole("img", { name: /^Circuito solo NAND/ });
    expect(svg.getAttribute("aria-label")).toBe("Circuito solo NAND con entradas x, y: f = ((x ⊙ x)′ ⊙ y)′");
    expect(screen.getByText("2 puertas: 2 NAND.")).toBeTruthy();
    expect(screen.getByText(/Comprobado por tabla de verdad: el circuito solo NAND calcula la misma función/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Solo NOR" }));
    expect(screen.getByRole("img", { name: /^Circuito solo NOR/ })).toBeTruthy();
    const saved = parseBooleDraft(localStorage.getItem(DEFAULT_LABS_KEYS.boole)!)!;
    expect(saved.build).toBe("x ⊕ y′");
    expect(saved.buildMode).toBe("nor");
  });

  it("referencia: las siete puertas con su símbolo accesible", async () => {
    renderAt("/laboratorios/boole?s=circuitos&v=puertas");
    await screen.findByRole("heading", { name: "Las siete puertas" }, { timeout: 5000 });
    const symbols = screen.getAllByRole("img", { name: /^Símbolo de la puerta/ });
    expect(symbols.map((s) => s.getAttribute("aria-label")!.split(":")[0])).toEqual(
      ["OR", "AND", "XOR", "NOT", "NOR", "NAND", "XNOR"].map((n) => `Símbolo de la puerta ${n}`),
    );
    expect(screen.getByRole("img", { name: "Símbolo de la puerta XNOR: (x ⊻ y)′ = x ⊙ y ⊕ x′ ⊙ y′" })).toBeTruthy();
  });
});

describe("Funciones Fₙ", () => {
  it("F₁: rellenar el complemento y comprobar; la tabla completa queda detrás del aviso", async () => {
    renderAt("/laboratorios/boole?s=funciones");
    await screen.findByRole("heading", { name: "F₁: funciones de una variable" }, { timeout: 5000 });
    expect(screen.getByText("Id: Id(0) = 0, Id(1) = 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Complemento ′" }));
    // Id′ = h, f′ = g, g′ = f, h′ = Id (índices en el orden Id, f, g, h).
    for (const [name, idx] of [["Id′", "3"], ["f′", "2"], ["g′", "1"], ["h′", "2"]] as const) {
      fireEvent.change(screen.getByLabelText(name), { target: { value: idx } });
    }
    const f1 = within(screen.getByRole("region", { name: /Comprueba tu respuesta: \(F₁/ }));
    fireEvent.click(f1.getByRole("button", { name: "Comprobar" }));
    expect(f1.getByText("3 de 4 correctas")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("h′"), { target: { value: "0" } });
    fireEvent.click(f1.getByRole("button", { name: "Comprobar" }));
    expect(f1.getByText("¡Correcto! 4 de 4.")).toBeTruthy();
    // Tabla de ⊕: Id ⊕ f = Id.
    fireEvent.click(screen.getByRole("radio", { name: "Suma ⊕" }));
    fireEvent.change(screen.getByLabelText("Id ⊕ f"), { target: { value: "0" } });
    fireEvent.click(f1.getByRole("button", { name: "Comprobar" }));
    expect(f1.getByText("1 de 16 correctas")).toBeTruthy();
  });

  it("F₂: escribe una expresión para el vector de verdad, con la primera fila distinta si falla", async () => {
    localStorage.setItem(
      DEFAULT_LABS_KEYS.boole,
      JSON.stringify({ v: 2, kind: "dos", p1: "dos", p2: "dos", custom: null, start: null, steps: [], circuit: null, build: "", buildMode: "basicas", f2: 6 }),
    );
    renderAt("/laboratorios/boole?s=funciones");
    const field = await screen.findByLabelText("f(x, y) =", {}, { timeout: 5000 });
    expect(screen.getByLabelText("Función que buscas: vector de verdad 0110")).toBeTruthy();
    fireEvent.change(field, { target: { value: "x ⊕ y" } });
    const f2 = within(screen.getByRole("region", { name: "Comprueba tu respuesta: escribe una expresión" }));
    fireEvent.click(f2.getByRole("button", { name: "Comprobar" }));
    expect(f2.getByText("No es esta función. Con x = 1, y = 1, f vale 0 y tu expresión da 1.")).toBeTruthy();
    fireEvent.change(field, { target: { value: "x y′ + x′ y" } });
    fireEvent.click(f2.getByRole("button", { name: "Comprobar" }));
    expect(f2.getByText(/¡Correcto! Coincide en las 4 filas. Es «XOR/)).toBeTruthy();
    expect(f2.queryByTestId("solution")).toBeNull();
    fireEvent.click(f2.getByRole("button", { name: "Otra función" }));
    const saved = parseBooleDraft(localStorage.getItem(DEFAULT_LABS_KEYS.boole)!)!;
    expect(saved.f2).not.toBe(6);
  });

  it("sin función guardada, elige una al azar y la guarda", async () => {
    renderAt("/laboratorios/boole?s=funciones");
    await screen.findByLabelText("f(x, y) =", {}, { timeout: 5000 });
    const saved = parseBooleDraft(localStorage.getItem(DEFAULT_LABS_KEYS.boole)!)!;
    expect(saved.f2).toBeGreaterThanOrEqual(0);
    expect(saved.f2).toBeLessThan(16);
  });

  it("abre F₂ en el verificador: 16 elementos y diagrama de Hasse", async () => {
    renderAt("/laboratorios/boole?s=funciones");
    fireEvent.click(await screen.findByRole("button", { name: "Abrir F₂ en «¿Es un álgebra de Boole?»" }, { timeout: 5000 }));
    expect(screen.getByRole("heading", { level: 2, name: "F₂ · 16 elementos" })).toBeTruthy();
    const svg = screen.getByRole("img", { name: /Diagrama de Hasse de F₂/ });
    expect(svg.querySelectorAll("line")).toHaveLength(32);
  });
});
