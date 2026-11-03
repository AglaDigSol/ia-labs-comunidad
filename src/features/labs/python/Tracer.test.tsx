// @vitest-environment jsdom
// Vista del paso a paso con una traza hecha a mano: controles, deslizador, línea actual, marcos con
// alias, salida acumulada, aviso de límite y anuncio aria-live.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TraceView } from "./Tracer.tsx";
import type { Trace } from "./tracer.ts";

afterEach(cleanup);

const CODE = "a = [1]\nb = a\nb.append(2)\nprint(a)\n";
const frame = (vars: Trace["pasos"][number]["marcos"][number]["variables"]) => [{ nombre: "<module>", linea: 1, variables: vars }];
const TRACE: Trace = {
  pasos: [
    { linea: 1, evento: "line", marcos: frame([]), salida: 0 },
    { linea: 2, evento: "line", marcos: frame([{ nombre: "a", valor: "[1]", clase: "lista" }]), salida: 0 },
    {
      linea: 3,
      evento: "line",
      marcos: frame([
        { nombre: "a", valor: "[1]", clase: "lista" },
        { nombre: "b", valor: "[1]", clase: "lista", alias: { nombre: "a", marco: 0 } },
      ]),
      salida: 0,
    },
    { linea: 4, evento: "line", marcos: frame([{ nombre: "a", valor: "[1, 2]", clase: "lista" }]), salida: 0 },
    { linea: 4, evento: "fin", marcos: frame([{ nombre: "a", valor: "[1, 2]", clase: "lista" }]), salida: 7 },
  ],
  salida: "[1, 2]\n",
  limite: null,
  error: null,
  sintaxis: null,
};

const btn = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;
const current = () => screen.getByRole("list", { name: "Código con la línea actual" }).querySelector('[aria-current="step"]')!;

describe("TraceView", () => {
  it("avanza y retrocede con los botones y el deslizador, y anuncia el paso", () => {
    render(<TraceView code={CODE} trace={TRACE} />);
    expect(screen.getByRole("toolbar", { name: "Controles del paso a paso" })).toBeTruthy();
    expect(btn("Principio").disabled).toBe(true);
    expect(btn("Anterior").disabled).toBe(true);
    expect(screen.getByTestId("trace-step").textContent).toBe("Paso 1 de 5: se va a ejecutar la línea 1.");
    expect(screen.getByTestId("trace-step").getAttribute("aria-live")).toBe("polite");
    expect(current().textContent).toContain("a = [1]");
    expect(current().textContent).toContain("Línea actual");
    fireEvent.click(btn("Siguiente paso"));
    fireEvent.click(btn("Siguiente paso"));
    expect(current().textContent).toContain("b.append(2)");
    expect(screen.getByText("misma lista que a")).toBeTruthy();
    const slider = screen.getByLabelText("Paso") as HTMLInputElement;
    expect(slider.value).toBe("3");
    expect(slider.getAttribute("aria-valuetext")).toBe("Paso 3 de 5: se va a ejecutar la línea 3.");
    fireEvent.click(btn("Final"));
    expect(btn("Siguiente paso").disabled).toBe(true);
    expect(screen.getByTestId("trace-step").textContent).toBe("Paso 5 de 5: fin del programa.");
    const out = screen.getByRole("heading", { name: "Salida hasta este paso" }).parentElement!;
    expect(within(out).getByText("[1, 2]")).toBeTruthy();
    fireEvent.change(slider, { target: { value: "2" } });
    expect(current().textContent).toContain("b = a");
    fireEvent.click(btn("Principio"));
    expect(slider.value).toBe("1");
    expect(screen.getByRole("region", { name: "Programa principal" }).textContent).toContain("Sin variables todavía.");
  });

  it("avisa del límite de pasos, del error y de la sintaxis", () => {
    const { unmount } = render(<TraceView code={CODE} trace={{ ...TRACE, limite: "pasos", error: { mensaje: "ValueError: x", linea: 3 } }} />);
    expect(screen.getByRole("note").textContent).toMatch(/límite de 2000 pasos/);
    expect(screen.getByText(/termina con un error en la línea 3: ValueError: x/)).toBeTruthy();
    unmount();
    render(<TraceView code={CODE} trace={{ ...TRACE, pasos: [], sintaxis: { mensaje: "SyntaxError: invalid syntax", linea: 2 } }} onClose={() => {}} />);
    expect(screen.getByText(/error de sintaxis en la línea 2/)).toBeTruthy();
    expect(screen.queryByRole("toolbar")).toBeNull();
    expect(btn("Cerrar el paso a paso")).toBeTruthy();
  });
});
