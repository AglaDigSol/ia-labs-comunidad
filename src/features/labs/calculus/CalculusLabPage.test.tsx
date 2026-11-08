// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { exactDescentSteps } from "../../../../shared/calculus/descent.ts";
import { arrangeChoices } from "../../../../shared/exercises/choice.ts";
import {
  alphaFrac,
  CALC_BISECTION,
  CALC_CHAIN,
  CALC_DESCENT,
  CALC_LHOPITAL,
  CALC_PIECEWISE,
  calcExpr,
  chainAnswer,
  lhopitalOf,
  niceText,
  piecewiseQuestion,
} from "../../../../shared/exercises/calculus.ts";
import { toNumber } from "../../../../shared/rational.ts";
import { LabsRoutes } from "../labs.tsx";
import { DescentStepPractice } from "./DescentSection.tsx";

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

const heading = () => screen.findByRole("heading", { level: 1, name: "Cálculo" }, { timeout: 5000 });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const invalid = (label: string | RegExp) => screen.getByLabelText(label).getAttribute("aria-invalid") === "true";
const status = () => screen.getAllByRole("status").map((s) => s.textContent ?? "").join(" ");

describe("Derivadas paso a paso", () => {
  it("cada paso se comprueba con su regla; un paso falso no dice el resultado", async () => {
    renderAt("/laboratorios/calculo");
    await heading();
    expect(screen.getByRole("tab", { name: "Cálculo" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByLabelText(/f prima de x igual a/)).toBeTruthy();
    expect(screen.queryByTestId("solution")).toBeNull();

    // Sin regla elegida, no se comprueba.
    type("= (nueva línea)", "(4x^3)′ − (5x^2)′ + (2x)′ − (7)′");
    click("Comprobar paso");
    expect(status()).toMatch(/Elige la regla/);

    fireEvent.change(screen.getByLabelText("Regla que aplicas"), { target: { value: "suma" } });
    click("Comprobar paso");
    expect(status()).toMatch(/Paso correcto: Regla de la suma\./);
    expect(screen.getByRole("list", { name: "Pasos de la derivación" }).children).toHaveLength(2);

    // Una línea que ya no vale f′: se rechaza con la fórmula de la regla, sin el resultado.
    type("= (nueva línea)", "12x^2 − 10x + 3");
    fireEvent.change(screen.getByLabelText("Regla que aplicas"), { target: { value: "constante" } });
    click("Comprobar paso");
    expect(status()).toMatch(/ya no vale lo mismo que la anterior\. Repasa la regla: \(k·u\)′ = k·u′/);
    expect(status()).not.toMatch(/12x\^2 − 10x \+ 2/);
    expect(screen.getByRole("list", { name: "Pasos de la derivación" }).children).toHaveLength(2);

    // La pista dice qué regla toca a cada derivada pendiente.
    click("Pista");
    expect(status()).toMatch(/\(4x\^3\)′: factor constante, \(k·u\)′ = k·u′/);

    // Varias reglas en un paso: vale, pero lo avisa; y al acabar dice que es f′.
    type("= (nueva línea)", "12x^2 − 10x + 2");
    fireEvent.change(screen.getByLabelText("Regla que aplicas"), { target: { value: "constante" } });
    click("Comprobar paso");
    expect(status()).toMatch(/también aplicas la regla de la potencia/);
    expect(status()).toMatch(/esa es f′\(x\)/);

    click("Deshacer");
    expect(screen.getByRole("list", { name: "Pasos de la derivación" }).children).toHaveLength(2);
    click("Copiar la línea anterior");
    expect((screen.getByLabelText("= (nueva línea)") as HTMLInputElement).value).toMatch(/\(4x\^3\)′/);
  });

  it("con una regla que no encaja, avisa y sugiere la buena", async () => {
    renderAt("/laboratorios/calculo");
    await heading();
    fireEvent.change(screen.getByLabelText("Función"), { target: { value: "producto" } });
    type("= (nueva línea)", "(x^2)' sen x + x^2 (sen x)'");
    fireEvent.change(screen.getByLabelText("Regla que aplicas"), { target: { value: "cociente" } });
    click("Comprobar paso");
    expect(status()).toMatch(/no parece la regla del cociente; ¿quizá la regla del producto\?/);
  });

  it("«Solo el resultado» acepta formas equivalentes y la solución está detrás de la puerta", async () => {
    renderAt("/laboratorios/calculo");
    await heading();
    fireEvent.change(screen.getByLabelText("Función"), { target: { value: "producto" } });
    fireEvent.click(screen.getByRole("radio", { name: "Solo el resultado" }));
    type("f′(x) =", "2x cos x + x^2 sen x");
    click("Comprobar");
    expect(status()).toMatch(/No es f′\(x\)/);
    expect(invalid("f′(x) =")).toBe(true);
    type("f′(x) =", "x (2 sen x + x cos x)");
    click("Comprobar");
    expect(status()).toMatch(/¡Correcto! Esa es f′\(x\)\./);
    click("Ver la solución completa");
    expect(screen.getByTestId("solution").textContent).toMatch(/Regla del producto/);
  });

  it("una función propia, con el error del analizador en su sitio", async () => {
    renderAt("/laboratorios/calculo");
    await heading();
    fireEvent.change(screen.getByLabelText("Función"), { target: { value: "propia" } });
    type("f(x) =", "x^2 +");
    expect(screen.getByRole("alert").textContent).toBe("Falta un término después de «+».");
    type("f(x) =", "x^3 e^x");
    click("Usar esta función");
    expect(screen.getByLabelText(/f prima de x igual a \(x elevado a 3 por e elevado a x\) derivada/)).toBeTruthy();
  });
});

describe("campos de función", () => {
  it("el ejemplo del campo es de cálculo, no el «p → q» de lógica (derivada, pasos, primitiva, tangente, gradiente)", async () => {
    for (const t of ["calculo-derivada", "calculo-primitiva", "calculo-tangente", "calculo-gradiente"]) {
      const { unmount } = renderAt(`/laboratorios/ejercicios?t=${t}&n=medio&s=1`);
      await screen.findAllByRole("textbox", undefined, { timeout: 5000 });
      const fields = screen.getAllByRole("textbox").filter((x) => x.getAttribute("placeholder"));
      expect(fields.length, t).toBeGreaterThan(0);
      for (const f of fields) expect(f.getAttribute("placeholder"), t).not.toMatch(/[→↔∧∨]/);
      unmount();
    }
    renderAt("/laboratorios/calculo");
    await heading();
    for (const f of screen.getAllByRole("textbox")) expect(f.getAttribute("placeholder") ?? "").not.toMatch(/[→↔∧∨]/);
  });
});

describe("Recta tangente", () => {
  it("marca los campos mal sin decir el valor y acepta la recta en cualquier forma", async () => {
    renderAt("/laboratorios/calculo?s=tangente");
    await heading();
    expect(screen.getByRole("img", { name: /Gráfica de f\(x\) = x elevado a 2 − 2x/ })).toBeTruthy();
    type("f(x₀) =", "3");
    type("Pendiente f′(x₀) =", "6");
    type("Recta tangente: y =", "3 + 4(x − 3)");
    click("Comprobar");
    expect(status()).toMatch(/2 de 3 bien/);
    expect(invalid("Pendiente f′(x₀) =")).toBe(true);
    expect(invalid("f(x₀) =")).toBe(false);
    type("Pendiente f′(x₀) =", "4");
    click("Comprobar");
    expect(status()).toMatch(/Tu recta es la tangente/);
  });
});

describe("Integrales", () => {
  it("primitiva derivándola (+ C) e integral definida; las sumas de Riemann se ven al acertar", async () => {
    renderAt("/laboratorios/calculo?s=integrales");
    await heading();
    type("F(x) =", "2x^3 − 2x^2 + 3x");
    click("Comprobar");
    expect(status()).toMatch(/No olvides la constante/);
    type("F(x) =", "2x^3 − x^2 + 3x + C");
    click("Comprobar");
    expect(status()).toMatch(/Al derivar tu F no sale f/);

    fireEvent.click(screen.getByRole("radio", { name: "Integral definida" }));
    expect(screen.getByText(/aparecen cuando aciertes la integral/)).toBeTruthy();
    type("Valor", "8,99");
    click("Comprobar");
    expect(invalid("Valor")).toBe(true);
    type("Valor", "9");
    click("Comprobar");
    expect(status()).toMatch(/¡Correcto!/);
    expect(screen.getByText("Ver cómo se acercan al aumentar n")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Rectángulos"), { target: { value: "10" } });
    expect(screen.getByRole("img", { name: /con 10 rectángulos/ })).toBeTruthy();
  });
});

describe("Varias variables", () => {
  it("parciales y gradiente, campo a campo", async () => {
    renderAt("/laboratorios/calculo?s=varias-variables");
    await heading();
    expect(screen.getByRole("img", { name: /Curvas de nivel de f\(x, y\).*flechas en la dirección del gradiente/ })).toBeTruthy();
    type("∂f/∂x =", "2x y + 3");
    type("∂f/∂y =", "x^2 − 4x");
    type("Primera componente", "7");
    type("Segunda componente", "-7");
    click("Comprobar");
    expect(status()).toMatch(/3 de 4 bien/);
    expect(invalid("∂f/∂y =")).toBe(true);
    type("∂f/∂y =", "x^2 − 4y");
    click("Comprobar");
    expect(status()).toMatch(/¡Correcto! Las dos parciales y el gradiente en P\./);
  });

  it("puntos críticos con su clasificación", async () => {
    renderAt("/laboratorios/calculo?s=varias-variables");
    await heading();
    fireEvent.click(screen.getByRole("radio", { name: "Puntos críticos" }));
    type("x (punto 1)", "2");
    type("y (punto 1)", "1");
    click("Comprobar");
    expect(status()).toMatch(/Punto 1: no es un punto crítico/);
    expect(status()).toMatch(/Te falta 1 punto crítico/);
    type("y (punto 1)", "-1");
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "maximo" } });
    click("Comprobar");
    expect(status()).toMatch(/revisa su clasificación/);
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "minimo" } });
    type("|H| (opcional)", "4");
    click("Comprobar");
    expect(status()).toMatch(/¡Correcto! Todos los puntos críticos, bien clasificados\./);
    expect(screen.getByRole("img", { name: /Tus puntos: 1: \(2, -1\), mínimo local/ })).toBeTruthy();
  });
});

describe("Descenso de gradiente", () => {
  it("el simulador explica lo que pasa al cambiar α y el método", async () => {
    renderAt("/laboratorios/calculo?s=descenso");
    await heading();
    expect(status()).toMatch(/aún no ha convergido/);
    fireEvent.change(screen.getByLabelText("Método"), { target: { value: "momentum" } });
    expect(status()).toMatch(/Converge en \d+ iteraciones/);
    fireEvent.click(screen.getByRole("radio", { name: "Una variable: f(x)" }));
    // α = 1,1 con la parábola: diverge.
    fireEvent.change(screen.getByLabelText("Método"), { target: { value: "gd" } });
    fireEvent.change(screen.getByLabelText("Tasa de aprendizaje α"), { target: { value: "19" } });
    fireEvent.change(screen.getByLabelText("Iteraciones"), { target: { value: "200" } });
    expect(status()).toMatch(/Diverge en la iteración/);
    expect(screen.getByRole("img", { name: /Gráfica de f\(x\) = .*iteraciones del descenso/ })).toBeTruthy();
  });

  it("los pasos a mano se comprueban con números exactos y abren las ideas clave", () => {
    const inst = CALC_DESCENT.generate(5, "básico");
    const steps = exactDescentSteps(calcExpr(inst.f), inst.start.map((s) => alphaFrac(s)), alphaFrac(inst.alpha), 2)!;
    render(<DescentStepPractice instance={inst} />);
    type("x₁ =", String(toNumber(steps[1]![0]!)));
    type("x₂ =", String(toNumber(steps[1]![0]!)));
    click("Comprobar");
    expect(status()).toMatch(/1 de 2 bien.*el primer paso ya está bien/);
    expect(screen.queryByRole("region", { name: "Ideas clave" })).toBeNull();
    type("x₂ =", String(toNumber(steps[2]![0]!)).replace(".", ","));
    click("Comprobar");
    expect(status()).toMatch(/¡Correcto!/);
    expect(screen.getByRole("region", { name: "Ideas clave" }).textContent).toMatch(/α demasiado grande/);
  });
});

describe("Límites y continuidad", () => {
  it("función a trozos: opción múltiple a)–d); una mal no dice cuál es la buena y la buena se acepta", async () => {
    renderAt("/laboratorios/calculo?s=limites");
    await heading();
    expect(screen.getByRole("radio", { name: "Límites y continuidad" }).getAttribute("aria-checked")).toBe("true");
    const inst = CALC_PIECEWISE.generate(1, "básico");
    const options = arrangeChoices(piecewiseQuestion(inst), JSON.stringify(inst));
    expect(options).toHaveLength(4);
    expect(screen.getAllByRole("radio", { name: /^[a-d]\) / })).toHaveLength(4);
    const wrong = options.find((o) => !o.correct)!;
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(`^${wrong.letter}\\) `) }));
    click("Comprobar");
    expect(status()).toMatch(/No es esa/);
    expect(screen.queryByTestId("solution")).toBeNull();
    const right = options.find((o) => o.correct)!;
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(`^${right.letter}\\) `) }));
    click("Comprobar");
    expect(status()).toMatch(/¡Correcto!/);
  });

  it("L'Hôpital: la forma y el límite; dominio, opciones; bisección, números", async () => {
    renderAt("/laboratorios/calculo?s=limites");
    await heading();
    fireEvent.click(screen.getByRole("radio", { name: "L'Hôpital" }));
    const inst = CALC_LHOPITAL.generate(1, "básico");
    const r = lhopitalOf(inst)!;
    type("Límite =", "12345");
    click("Comprobar");
    expect(invalid("Límite =")).toBe(true);
    expect(status()).toMatch(/Revisa la forma/);
    fireEvent.change(screen.getByLabelText("Al sustituir, ¿qué forma da?"), { target: { value: r.steps[0]!.form } });
    type("Límite =", niceText((r.result as { value: number }).value).replace("−", "-"));
    click("Comprobar");
    expect(status()).toMatch(/¡Correcto!/);

    fireEvent.click(screen.getByRole("radio", { name: "Dominio" }));
    expect(screen.getByRole("group", { name: /¿Cuál es el dominio de f\?/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Bisección" }));
    const b = CALC_BISECTION.generate(1, "básico");
    type("Longitud =", `${b.b - b.a}/${2 ** b.k}`);
    click("Comprobar");
    expect(status()).toMatch(/¡Correcto!/);
  });
});

describe("Teoría en las otras secciones", () => {
  it("regla de la cadena en «Varias variables», por partes en «Integrales» y cuencas en «Descenso»", async () => {
    renderAt("/laboratorios/calculo?s=varias-variables");
    await heading();
    fireEvent.click(screen.getByRole("radio", { name: "Regla de la cadena" }));
    const c = CALC_CHAIN.generate(1, "básico");
    type("Resultado =", String(chainAnswer(c) + 1));
    click("Comprobar");
    expect(invalid("Resultado =")).toBe(true);
    type("Resultado =", String(chainAnswer(c)));
    click("Comprobar");
    expect(status()).toMatch(/¡Correcto!/);
    fireEvent.click(screen.getByRole("radio", { name: "Críticos tipo test" }));
    expect(screen.getAllByRole("radio", { name: /^[a-d]\) / })).toHaveLength(4);
    cleanup();

    renderAt("/laboratorios/calculo?s=integrales");
    await heading();
    fireEvent.click(screen.getByRole("radio", { name: "Por partes" }));
    expect(screen.getByRole("group", { name: /¿Cuánto vale la integral\?/ })).toBeTruthy();
    cleanup();

    renderAt("/laboratorios/calculo?s=descenso");
    await heading();
    expect(screen.getByRole("heading", { name: "Descenso de gradiente: ¿adónde converge?" })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Gráfica de f\(x\) = .*punto de partida/ })).toBeTruthy();
  });
});
