// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LOGIC_EQUIVALENCE, LOGIC_TRUTH_TABLE } from "../../../../shared/exercises/logic.ts";
import { EXERCISE_TYPES } from "../../../../shared/exercises/registry.ts";
import { EXERCISE_LEVELS, LEVEL_SLUGS } from "../../../../shared/exercises/types.ts";
import { seedFromText } from "../../../../shared/exercises/random.ts";
import { SETS_PARTS } from "../../../../shared/exercises/sets.ts";
import { compareFormulas } from "../../../../shared/logic/compare.ts";
import { parseFormula } from "../../../../shared/logic/parser.ts";
import { cartesianProduct, powerSetOf, subsetText } from "../../../../shared/sets/finite.ts";
import { MemoryAdapter } from "../../../lib/storage-adapter.ts";
import { configureLabs } from "../labs-storage.ts";
import { LabsRoutes } from "../labs.tsx";
import { loadProgress, parseProgress, recordSolved, saveProgress } from "./progress.ts";

let storage: MemoryAdapter;
beforeEach(() => {
  storage = new MemoryAdapter();
  configureLabs({ storage });
});
afterEach(() => {
  cleanup();
  configureLabs();
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

const page = () => screen.findByRole("heading", { level: 1, name: "Banco de ejercicios" }, { timeout: 5000 });
const search = () => new URLSearchParams(screen.getByTestId("loc").textContent!.split("?")[1] ?? "");

/** Resuelve un ejercicio de partes o producto con la lista que calcula el motor. */
function solveParts(seed: number) {
  const inst = SETS_PARTS.generate(seed, "básico");
  const name = inst.mode === "partes" ? "𝒫(A)" : "A × B";
  const items =
    inst.mode === "partes" ? powerSetOf(inst.a).map(subsetText) : cartesianProduct(inst.a, inst.b).map(([x, y]) => `(${x}, ${y})`);
  fireEvent.change(screen.getByLabelText(`¿Cuántos elementos tiene ${name}?`), { target: { value: String(items.length) } });
  fireEvent.change(screen.getByLabelText(`Los elementos de ${name}`), { target: { value: items.join(", ") } });
  fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
}

describe("lista de ejercicios", () => {
  it("agrupa los tipos por tema, con su nivel, su progreso y «Practicar»", async () => {
    renderAt("/laboratorios/ejercicios");
    await page();
    const topics = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(topics).toEqual(["Lógica proposicional", "Lógica de predicados", "Conjuntos", "Álgebra de Boole"]);
    expect(screen.getByRole("heading", { level: 3, name: "Tabla de verdad paso a paso" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Mapa de Karnaugh" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Inclusión–exclusión" })).toBeTruthy();
    expect(screen.getByTestId("progreso-logica-tabla").textContent).toBe("Aún sin resolver.");
    expect(screen.getAllByRole("button", { name: /^Practicar/ }).length).toBe(14);
  });

  it("«Practicar» abre el tipo con el nivel elegido y una semilla en la URL", async () => {
    renderAt("/laboratorios/ejercicios");
    await page();
    const card = screen.getByRole("heading", { level: 3, name: "¿Son equivalentes?" }).closest("li")!;
    fireEvent.change(within(card).getByLabelText("Nivel"), { target: { value: "avanzado" } });
    fireEvent.click(within(card).getByRole("button", { name: /^Practicar/ }));
    expect(await screen.findByRole("heading", { level: 2, name: "Ejercicio 1: ¿Son equivalentes?" })).toBeTruthy();
    const p = search();
    expect(p.get("t")).toBe("logica-equivalentes");
    expect(p.get("n")).toBe("avanzado");
    expect(seedFromText(p.get("s"))).not.toBeNull();
    expect(screen.getByRole("radio", { name: "Avanzado" }).getAttribute("aria-checked")).toBe("true");
  });

  it("«Mezclar» elige un tipo del tema y lo marca como mezcla", async () => {
    renderAt("/laboratorios/ejercicios");
    await page();
    fireEvent.click(screen.getByRole("button", { name: "Mezclar ejercicios de Conjuntos" }));
    await screen.findByRole("heading", { level: 2, name: /^Ejercicio 1: / });
    expect(search().get("m")).toBe("conjuntos");
    expect(search().get("t")).toMatch(/^conjuntos-/);
    expect(screen.getByText("Mezcla")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente ejercicio" }));
    await screen.findByRole("heading", { level: 2, name: /^Ejercicio 2: / });
    expect(search().get("m")).toBe("conjuntos");
    expect(search().get("t")).toMatch(/^conjuntos-/);
  });
});

describe("práctica", () => {
  it("la URL fija el ejercicio: la misma semilla da la misma fórmula", async () => {
    renderAt("/laboratorios/ejercicios?t=logica-tabla&n=medio&s=abc");
    await page();
    const formula = LOGIC_TRUTH_TABLE.generate(seedFromText("abc")!, "medio").formula;
    expect(screen.getByRole("group", { name: `Fórmula: ${formula}` })).toBeTruthy();
    expect(screen.getByText(/Código del ejercicio: abc/)).toBeTruthy();
    // La práctica es la del laboratorio, en modo paso a paso y sin selector de modo.
    expect(screen.getByRole("button", { name: "Comprobar paso" })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "Solo el resultado" })).toBeNull();
    expect(screen.getByRole("button", { name: "Ver la solución completa" })).toBeTruthy();
    expect(screen.queryByTestId("solution")).toBeNull();
  });

  it("sin nivel ni semilla, los completa en la URL; un tipo desconocido vuelve a la lista", async () => {
    const { unmount } = renderAt("/laboratorios/ejercicios?t=conjuntos-venn");
    await page();
    await waitFor(() => expect(search().get("n")).toBe("basico"));
    expect(seedFromText(search().get("s"))).not.toBeNull();
    expect(await screen.findByRole("heading", { level: 2, name: "Ejercicio 1: Sombrear en el diagrama de Venn" })).toBeTruthy();
    unmount();
    renderAt("/laboratorios/ejercicios?t=no-existe&n=basico&s=1");
    await page();
    expect(screen.getByRole("heading", { level: 2, name: "Lógica proposicional" })).toBeTruthy();
  });

  it("comprobar → resuelto (cuenta una vez) → siguiente: nueva semilla, foco en el título y contador de sesión", async () => {
    renderAt("/laboratorios/ejercicios?t=conjuntos-partes&n=basico&s=7");
    await page();
    expect(screen.getByRole("heading", { level: 2, name: "Ejercicio 1: Conjunto de partes y producto cartesiano" })).toBeTruthy();
    expect(screen.getByText("En esta sesión: 0 ejercicios resueltos.")).toBeTruthy();
    solveParts(7);
    expect(await screen.findByText("¡Resuelto! Cuenta en tu progreso.")).toBeTruthy();
    expect(screen.getByText("En esta sesión: 1 ejercicio resuelto.")).toBeTruthy();
    expect(screen.getByText("Resueltos en este nivel: 1")).toBeTruthy();
    // Volver a comprobar no suma otra vez.
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("En esta sesión: 1 ejercicio resuelto.")).toBeTruthy();
    expect(loadProgress()["conjuntos-partes"]?.básico?.solved).toBe(1);
    expect(JSON.parse(String(storage.load()?.exercises)).v).toBe(1);
    expect(localStorage.length).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Siguiente ejercicio" }));
    const next = await screen.findByRole("heading", { level: 2, name: "Ejercicio 2: Conjunto de partes y producto cartesiano" });
    await waitFor(() => expect(document.activeElement).toBe(next));
    expect(search().get("s")).not.toBe("7");
    expect(search().get("t")).toBe("conjuntos-partes");
    expect(screen.queryByText("¡Resuelto! Cuenta en tu progreso.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cambiar de tipo" }));
    await screen.findByRole("heading", { level: 2, name: "Conjuntos" });
    expect(search().get("t")).toBeNull();
    expect(screen.getByTestId("progreso-conjuntos-partes").textContent).toMatch(/^1 resuelto \(básico: 1\)\. Último: \d{2}\/\d{2}\/\d{4}\.$/);
    expect(screen.getByText("En esta sesión: 1 ejercicio resuelto.")).toBeTruthy();
  });

  it("una respuesta mal no cuenta y no revela la solución", async () => {
    renderAt("/laboratorios/ejercicios?t=logica-equivalentes&n=basico&s=5");
    await page();
    const { a, b } = LOGIC_EQUIVALENCE.generate(5, "básico");
    const pa = parseFormula(a);
    const pb = parseFormula(b);
    if (!pa.ok || !pb.ok) throw new Error("fórmulas");
    const cmp = compareFormulas(pa.ast, pb.ast);
    if (!cmp.ok) throw new Error("comparar");
    // Lo contrario de lo correcto.
    fireEvent.click(screen.getByRole("radio", { name: cmp.equivalent ? "No" : "Sí" }));
    fireEvent.change(screen.getByLabelText(/¿En cuántas filas difieren\?/), { target: { value: String(cmp.differing) } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("La equivalencia no es correcta.")).toBeTruthy();
    expect(screen.queryByText("¡Resuelto! Cuenta en tu progreso.")).toBeNull();
    expect(screen.queryByTestId("solution")).toBeNull();
    // Bien: ahora sí cuenta.
    fireEvent.click(screen.getByRole("radio", { name: cmp.equivalent ? "Sí" : "No" }));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(await screen.findByText("¡Resuelto! Cuenta en tu progreso.")).toBeTruthy();
  });

  it("cambiar de nivel genera otro ejercicio de ese nivel", async () => {
    renderAt("/laboratorios/ejercicios?t=boole-karnaugh&n=basico&s=3");
    await page();
    expect(screen.getByRole("grid", { name: /Mapa de Karnaugh de f\(x, y, z\)/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Medio" }));
    await waitFor(() => expect(search().get("n")).toBe("medio"));
    expect(screen.getByRole("grid", { name: /Mapa de Karnaugh de f\(w, x, y, z\)/ })).toBeTruthy();
    // El mapa del ejercicio no se puede editar.
    expect(screen.queryByRole("radio", { name: "Cambiar su valor" })).toBeNull();
  });
});

describe("vistas", () => {
  it("cada tipo y nivel se abre con su práctica y un botón «Comprobar…», sin la solución a la vista", async () => {
    for (const t of EXERCISE_TYPES) {
      for (const level of EXERCISE_LEVELS) {
        const { unmount } = renderAt(`/laboratorios/ejercicios?t=${t.id}&n=${LEVEL_SLUGS[level]}&s=2`);
        await page();
        expect(screen.getByRole("heading", { level: 2, name: `Ejercicio 1: ${t.title}` })).toBeTruthy();
        expect(screen.queryByRole("alert")).toBeNull();
        expect(screen.getAllByRole("button", { name: /^Comprobar/ }).length).toBeGreaterThan(0);
        expect(screen.queryByTestId("solution")).toBeNull();
        unmount();
      }
    }
  }, 30000);
});

describe("progreso", () => {
  it("se guarda por tipo y nivel y se valida al leer", () => {
    expect(loadProgress()).toEqual({});
    recordSolved("logica-tabla", "medio", new Date(2026, 9, 29).getTime());
    const p = recordSolved("logica-tabla", "medio", new Date(2026, 9, 30).getTime());
    expect(p["logica-tabla"]?.medio).toEqual({ solved: 2, last: "2026-10-30" });
    expect(loadProgress()).toEqual(p);
    saveProgress({ "tipo-futuro": { básico: { solved: 3, last: "2026-11-01" } } });
    expect(loadProgress()["tipo-futuro"]?.básico?.solved).toBe(3);
    for (const bad of [
      "{",
      "[]",
      '{"v":2,"progress":{}}',
      '{"v":1,"progress":{"Mal Id":{}}}',
      '{"v":1,"progress":{"logica-tabla":{"experto":{"solved":1,"last":"2026-10-29"}}}}',
      '{"v":1,"progress":{"logica-tabla":{"medio":{"solved":-1,"last":"2026-10-29"}}}}',
      '{"v":1,"progress":{"logica-tabla":{"medio":{"solved":1,"last":"ayer"}}}}',
      "x".repeat(9000),
    ]) {
      expect(parseProgress(bad)).toBeNull();
    }
  });
});
