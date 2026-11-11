// @vitest-environment jsdom
// El simulacro de examen de principio a fin: empezar, contestar, navegar, marcar, entregar (con la lista
// de preguntas sin contestar), resultados con «Practicar este tipo», historial, retomar un intento en
// curso tras recargar, reloj que no se para y entrega automática a 0, y avisos accesibles del tiempo.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configExam, configFromSearch, parseExamStore, serializeExamStore, startAttempt, type ExamConfig } from "../../../../shared/exam/attempt.ts";
import type { ExamQuestion } from "../../../../shared/exam/blueprint.ts";
import { MemoryAdapter } from "../../../lib/storage-adapter.ts";
import { configureLabs, DEFAULT_LABS_KEYS } from "../labs-storage.ts";
import { clockText, durationText, ExamSimulatorPage, INTEGRITY_EXAM_NOTE } from "./ExamSimulatorPage.tsx";

let storage: MemoryAdapter;
beforeEach(() => {
  storage = new MemoryAdapter();
  configureLabs({ storage });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  configureLabs();
  localStorage.clear();
});

const URL_RAPIDO = "/laboratorios/ejercicios/simulacro?modo=rapido&s=abc12";
const config = configFromSearch(new URLSearchParams("modo=rapido&s=abc12"))!;
const questions = configExam(config);

function Loc() {
  const l = useLocation();
  return <span data-testid="loc">{decodeURIComponent(l.pathname + l.search)}</span>;
}

function renderPage(url = URL_RAPIDO) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/laboratorios/ejercicios/simulacro" element={<ExamSimulatorPage />} />
        <Route path="/laboratorios/ejercicios" element={<p>Banco de ejercicios</p>} />
      </Routes>
      <Loc />
    </MemoryRouter>,
  );
}

const saved = () => parseExamStore(String(storage.load()?.exam))!;

/** Contesta bien la pregunta que está en pantalla. */
function answerRight(q: ExamQuestion) {
  if (q.kind === "choice") {
    const i = q.options.findIndex((o) => o.correct);
    fireEvent.click(screen.getAllByRole("radio")[i]!);
  } else {
    fireEvent.change(screen.getByLabelText(q.label), { target: { value: q.correctText.split(" ")[0] } });
  }
}
function answerWrong(q: ExamQuestion) {
  if (q.kind === "choice") {
    const i = q.options.findIndex((o) => !o.correct);
    fireEvent.click(screen.getAllByRole("radio")[i]!);
  } else {
    fireEvent.change(screen.getByLabelText(q.label), { target: { value: "987654,3" } });
  }
}

const heading = (n: number, total = questions.length) => screen.getByRole("heading", { level: 2, name: `Pregunta ${n} de ${total}` });

describe("pantalla de inicio", () => {
  it("modos, penalización explicada, instrucciones e integridad; la configuración va en la URL", async () => {
    renderPage("/laboratorios/ejercicios/simulacro");
    expect(screen.getByRole("heading", { level: 1, name: "Simulacro de examen (02MIAR)" })).toBeTruthy();
    expect(screen.getByText(INTEGRITY_EXAM_NOTE)).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Completo: 20 preguntas · 2 h/ })).toHaveProperty("checked", true);
    expect(screen.getByRole("radio", { name: /Rápido: 10 preguntas · 1 h/ })).toBeTruthy();
    expect(screen.getByText(/20 preguntas en 2 h/)).toBeTruthy();
    expect(screen.getByText(/los decimales, con coma/)).toBeTruthy();
    expect(screen.getByText(/Desactivada, como en el examen/)).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: "Penalización por fallo" }));
    expect(screen.getByText(/resta un tercio del valor de la pregunta \(0,17 puntos\)/)).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toMatch(/modo=completo&s=[0-9a-z]+&pen=1$/));
    fireEvent.click(screen.getByRole("radio", { name: /Tú eliges los temas/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ninguno" }));
    expect(screen.getByText("Elige al menos un tema.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Empezar" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Probabilidad" }));
    fireEvent.change(screen.getByLabelText("Número de preguntas"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Tiempo (minutos)"), { target: { value: "25" } });
    expect(screen.getByText(/4 preguntas en 25 min/)).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toMatch(/modo=temas&s=[0-9a-z]+&temas=probabilidad&n=4&min=25&pen=1$/));
  });
});

describe("examen y resultados", () => {
  it("empezar, contestar, navegar, marcar, entregar y practicar", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    expect(heading(1)).toBeTruthy();
    expect(screen.getByRole("timer").textContent).toMatch(/^(1:00:00|59:5\d)$/);
    // Sin pistas, sin «Comprobar» y sin soluciones durante el intento.
    expect(screen.queryByRole("button", { name: /Comprobar|Pista|solución/i })).toBeNull();
    expect(screen.queryByTestId("solution")).toBeNull();

    answerRight(questions[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(document.activeElement).toBe(heading(2));
    answerWrong(questions[1]!);
    fireEvent.click(screen.getByRole("button", { name: "Marcar para revisar" }));
    expect(screen.getByRole("button", { name: "Quitar la marca" }).getAttribute("aria-pressed")).toBe("true");
    const nav = screen.getByRole("navigation", { name: "Preguntas del simulacro" });
    expect(within(nav).getByRole("button", { name: "Pregunta 1: contestada" })).toBeTruthy();
    expect(within(nav).getByRole("button", { name: "Pregunta 2: contestada, marcada para revisar" }).getAttribute("aria-current")).toBe("step");
    expect(within(nav).getByRole("button", { name: "Pregunta 3: sin contestar" })).toBeTruthy();
    // Saltar con el navegador.
    fireEvent.click(within(nav).getByRole("button", { name: "Pregunta 4: sin contestar" }));
    expect(document.activeElement).toBe(heading(4));
    answerRight(questions[3]!);
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(heading(3)).toBeTruthy();
    // Se guarda al momento.
    expect(saved().active?.answers?.filter((a) => a !== null)).toHaveLength(3);
    expect(saved().active?.flagged).toEqual([1]);

    fireEvent.click(screen.getByRole("button", { name: "Entregar" }));
    const dialog = await screen.findByRole("dialog", { name: "¿Entregar el simulacro?" });
    const pending = within(dialog).getByRole("list", { name: "Preguntas sin contestar" });
    expect(within(pending).getAllByRole("button").map((b) => b.textContent)).toEqual(["3", "5", "6", "7", "8", "9", "10"]);
    expect(within(dialog).getByText("Marcadas para revisar: 2.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Entregar ahora" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Resultados del simulacro" })).toBeTruthy();
    expect(screen.getByLabelText("Nota: 2,00 sobre 10")).toBeTruthy();
    expect(screen.getByText("Bien: 2 · Mal: 1 · En blanco: 7")).toBeTruthy();
    expect(screen.getByText(/de 1 h\.$/)).toBeTruthy();
    // Por temas, con texto (no solo color).
    expect(screen.getAllByText(/^\d+ de \d+ bien \(\d+ %\)$/)).toHaveLength(new Set(questions.map((q) => q.section)).size);
    // Cada pregunta con su resultado, la respuesta correcta y la solución.
    const items = screen.getAllByRole("listitem").filter((li) => li.querySelector("h3"));
    expect(items).toHaveLength(questions.length);
    expect(within(items[0]!).getByText("Bien")).toBeTruthy();
    expect(within(items[1]!).getByText("Mal")).toBeTruthy();
    expect(within(items[2]!).getByText("En blanco")).toBeTruthy();
    expect(within(items[0]!).getAllByText(questions[0]!.correctText).length).toBeGreaterThanOrEqual(1);
    expect(within(items[2]!).getByText("sin contestar")).toBeTruthy();
    const practice = within(items[1]!).getByRole("link", { name: /^Practicar este tipo/ });
    expect(practice.getAttribute("href")).toBe(`/laboratorios/ejercicios${questions[1]!.practiceLink}`);
    // El intento pasa al historial con sus respuestas.
    const store = saved();
    expect(store.active).toBeNull();
    expect(store.history).toHaveLength(1);
    expect(store.history[0]!.result).toMatchObject({ score: 2, correct: 2, wrong: 1, blank: 7, auto: false });

    fireEvent.click(practice);
    expect(await screen.findByText("Banco de ejercicios")).toBeTruthy();
    expect(screen.getByTestId("loc").textContent).toBe(`/laboratorios/ejercicios${decodeURIComponent(questions[1]!.practiceLink)}`);
  });

  it("historial, «Repetir este simulacro» con la misma semilla y «Nuevo simulacro»", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    fireEvent.click(screen.getByRole("button", { name: "Entregar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Entregar ahora" }));
    await screen.findByRole("heading", { level: 1, name: "Resultados del simulacro" });
    fireEvent.click(screen.getByRole("button", { name: "Historial" }));
    const h1 = screen.getByRole("heading", { level: 1, name: "Historial de simulacros" });
    expect(document.activeElement).toBe(h1);
    expect(screen.getByText(/· Rápido$/)).toBeTruthy();
    expect(screen.getByText("0,00 / 10")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver resultados" }));
    await screen.findByRole("heading", { level: 1, name: "Resultados del simulacro" });
    fireEvent.click(screen.getByRole("button", { name: "Repetir este simulacro" }));
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/laboratorios/ejercicios/simulacro?modo=rapido&s=abc12"));
    fireEvent.click(screen.getByRole("button", { name: "Historial (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Volver al inicio" }));
    fireEvent.click(screen.getByRole("button", { name: "Otras preguntas" }));
    await waitFor(() => expect(screen.getByTestId("loc").textContent).not.toContain("s=abc12"));
  });
});

describe("en el móvil: la pregunta, a la vista y debajo de la cabecera fija", () => {
  it("«Empezar» y «Siguiente» desplazan la tarjeta de la pregunta, con margen para la cabecera; abrir la página, no", () => {
    const scrolled: Element[] = [];
    const spy = vi.fn(function (this: Element) {
      scrolled.push(this);
    });
    Element.prototype.scrollIntoView = spy;
    try {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
      const card = () => heading(scrolled.length === 1 ? 1 : 2).closest("article")!;
      expect(scrolled).toEqual([card()]);
      expect(card().className).toMatch(/scroll-mt-\[calc\(3rem\+2\.75rem\+1px\+var\(--exam-sticky/);
      // La cabecera fija va debajo de las pestañas de los laboratorios, en una sola línea.
      const bar = screen.getByRole("timer").closest("div.sticky")!;
      expect(bar.className).toContain("top-[calc(3rem+2.75rem+1px)]");
      expect(bar.className).not.toContain("flex-wrap");
      expect(screen.getByRole("heading", { level: 1, name: "Simulacro: Rápido" })).toBeTruthy();
      expect(screen.getByText("Contestadas: 0 de 10")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
      expect(scrolled).toHaveLength(2);
      expect(scrolled[1]).toBe(heading(2).closest("article"));
      expect(document.activeElement).toBe(heading(2));
      // Al recargar con el intento en curso, la página no salta.
      cleanup();
      scrolled.length = 0;
      renderPage("/laboratorios/ejercicios/simulacro");
      expect(heading(2)).toBeTruthy();
      expect(scrolled).toEqual([]);
    } finally {
      delete (Element.prototype as Partial<Element>).scrollIntoView;
    }
  });
});

describe("progreso por temas", () => {
  it("suma los aciertos de cada tema en todos los intentos y enlaza «Practicar este tema» al banco", async () => {
    const t0 = Date.UTC(2026, 10, 3, 18, 0, 0);
    const done = (id: string, sections: Array<[string, number, number]>, at: number) => ({
      ...startAttempt(config, questions.length, at),
      id,
      finishedAt: at + 60_000,
      answers: null,
      result: { score: 5, correct: 1, wrong: 1, blank: 0, auto: false, sections },
    });
    const history = [
      done("b", [["logica", 2, 2], ["probabilidad", 0, 1]], t0),
      done("a", [["logica", 1, 2]], t0 - 86_400_000),
    ];
    storage.save({ exam: JSON.stringify({ ...JSON.parse(serializeExamStore({ active: null, history: [] })), history }) });
    expect(saved().history).toHaveLength(2);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Historial (2)" }));
    const sec = screen.getByRole("region", { name: "Progreso por temas" });
    expect(within(sec).getByText("Lógica proposicional")).toBeTruthy();
    expect(within(sec).getByText("3 de 4 bien (75 %) · 2 simulacros · último: 2 de 2")).toBeTruthy();
    expect(within(sec).getByText("0 de 1 bien (0 %) · 1 simulacro · último: 0 de 1")).toBeTruthy();
    const link = within(sec).getByRole("link", { name: "Practicar este tema: Probabilidad" });
    const p = new URLSearchParams(link.getAttribute("href")!.split("?")[1]);
    expect(link.getAttribute("href")).toMatch(/^\/laboratorios\/ejercicios\?/);
    expect(p.get("t")).toMatch(/^probabilidad-/);
    fireEvent.click(link);
    expect(await screen.findByText("Banco de ejercicios")).toBeTruthy();
  });
});

describe("reloj, recarga y entrega automática", () => {
  it("retoma el intento en curso tras recargar, con el tiempo que quedaba", () => {
    const t0 = Date.UTC(2026, 10, 3, 18, 0, 0);
    vi.useFakeTimers({ shouldAdvanceTime: false, now: t0 });
    const a = { ...startAttempt(config, questions.length, t0 - 20 * 60_000), current: 2, answers: questions.map((_, i) => (i === 0 ? "x" : null)), flagged: [2] };
    storage.save({ exam: serializeExamStore({ active: a, history: [] }) });
    renderPage("/laboratorios/ejercicios/simulacro");
    // Va directamente al examen, a la pregunta en la que estaba.
    expect(heading(3)).toBeTruthy();
    expect(screen.getByRole("timer").textContent).toBe("40:00");
    expect(within(screen.getByRole("navigation", { name: "Preguntas del simulacro" })).getByRole("button", { name: "Pregunta 3: sin contestar, marcada para revisar" })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(65_000);
    });
    expect(screen.getByRole("timer").textContent).toBe("38:55");
    // Recargar no reinicia el reloj.
    cleanup();
    renderPage("/laboratorios/ejercicios/simulacro");
    expect(screen.getByRole("timer").textContent).toBe("38:55");
  });

  it("avisa del tiempo cada 15 minutos y a los 5, y a 0 se entrega solo", () => {
    const t0 = Date.UTC(2026, 10, 3, 18, 0, 0);
    vi.useFakeTimers({ shouldAdvanceTime: false, now: t0 });
    const a = startAttempt(config, questions.length, t0 - 44 * 60_000 - 50_000);
    storage.save({ exam: serializeExamStore({ active: { ...a, answers: questions.map((q, i) => (i < 3 ? (q.kind === "choice" ? q.options.find((o) => o.correct)!.id : q.correctText.split(" ")[0]!) : null)) }, history: [] }) });
    renderPage("/laboratorios/ejercicios/simulacro");
    const status = () => screen.getByRole("status").textContent;
    expect(status()).toBe("");
    act(() => {
      vi.advanceTimersByTime(11_000);
    });
    expect(status()).toBe("Quedan 15 minutos.");
    act(() => {
      vi.advanceTimersByTime(5 * 60_000);
    });
    expect(status()).toBe("Quedan 15 minutos.");
    act(() => {
      vi.advanceTimersByTime(5 * 60_000);
    });
    expect(status()).toBe("Quedan 5 minutos.");
    act(() => {
      vi.advanceTimersByTime(4 * 60_000 + 30_000);
    });
    expect(status()).toBe("Queda 1 minuto.");
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(screen.getByRole("heading", { level: 1, name: "Resultados del simulacro" })).toBeTruthy();
    expect(screen.getByText("Se ha acabado el tiempo: el simulacro se ha entregado solo.")).toBeTruthy();
    const h = saved().history[0]!;
    expect(h.result).toMatchObject({ auto: true, correct: 3, score: 3 });
    expect(h.finishedAt! - h.startedAt).toBe(60 * 60_000);
  });

  it("si al abrir ya se ha acabado el tiempo, lo entrega con la hora del final", () => {
    const t0 = Date.UTC(2026, 10, 3, 18, 0, 0);
    vi.useFakeTimers({ shouldAdvanceTime: false, now: t0 });
    storage.save({ exam: serializeExamStore({ active: startAttempt(config, questions.length, t0 - 3 * 3_600_000), history: [] }) });
    renderPage("/laboratorios/ejercicios/simulacro");
    expect(screen.getByRole("heading", { level: 1, name: "Resultados del simulacro" })).toBeTruthy();
    expect(saved().history[0]!.result?.auto).toBe(true);
  });

  it("lo guardado que no encaja se ignora", () => {
    storage.save({ exam: '{"v":1,"active":{"id":"x"},"history":[]}' });
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Simulacro de examen (02MIAR)" })).toBeTruthy();
    expect(screen.queryByText("Tienes un simulacro en curso")).toBeNull();
  });

  it("guarda en localStorage con la clave por defecto si no se inyecta otro almacén", () => {
    configureLabs();
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    expect(parseExamStore(localStorage.getItem(DEFAULT_LABS_KEYS.exam)!)?.active?.config).toEqual(config satisfies ExamConfig);
  });
});

describe("formatos", () => {
  it("reloj y duraciones", () => {
    expect(clockText(3_600_000)).toBe("1:00:00");
    expect(clockText(65_000)).toBe("1:05");
    expect(clockText(500)).toBe("0:01");
    expect(durationText(83 * 60_000)).toBe("1 h 23 min");
    expect(durationText(45_000)).toBe("45 s");
  });
});
