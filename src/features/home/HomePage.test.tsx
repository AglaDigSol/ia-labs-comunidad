// @vitest-environment jsdom
// Inicio y «Página no encontrada» de la app independiente.
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../../App.tsx";
import { activeModules } from "../../config.ts";
import { __resetKvStoreForTests, setKv } from "../../lib/kv-store.ts";
import { __resetOfflineForTests, registerServiceWorker } from "../../lib/offline.ts";
import { DEFAULT_LABS_KEYS } from "../labs/labs-storage.ts";
import { recordExercise, recordLabTab } from "../labs/recent.ts";
import { CommunityCard, HomePage } from "./HomePage.tsx";

beforeEach(() => {
  __resetKvStoreForTests();
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const at = (url: string, ui = <AppRoutes />) => render(<MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>);

describe("rutas de la app", () => {
  it("«/» es el inicio, no una redirección a los laboratorios", async () => {
    at("/");
    expect(await screen.findByRole("heading", { level: 1, name: "Inicio" }, { timeout: 5000 })).toBeTruthy();
    expect(activeModules()[0]!.path).toBe("/");
  });

  it("una ruta desconocida muestra «Página no encontrada» con enlaces al inicio y a los laboratorios", async () => {
    at("/no-existe/de-verdad");
    expect(await screen.findByRole("heading", { level: 1, name: "Página no encontrada" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ir al inicio" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Ir a los laboratorios" }).getAttribute("href")).toBe("/laboratorios");
  });
});

describe("inicio", () => {
  it("sin nada hecho, «Continuar» propone empezar por Simbología; sin módulos, ni repaso ni calendario", () => {
    at("/", <HomePage />);
    const card = screen.getByRole("region", { name: "Continuar" });
    expect(within(card).getByRole("link", { name: "Empezar por Simbología" }).getAttribute("href")).toBe("/laboratorios/simbolos");
    expect(screen.queryByRole("region", { name: "Repaso de hoy" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Próximo en el calendario" })).toBeNull();
  });

  it("«Continuar» abre la última pestaña de los laboratorios", () => {
    recordLabTab({ id: "markov", label: "Markov", path: "markov" }, 1000);
    at("/", <HomePage />);
    const card = screen.getByRole("region", { name: "Continuar" });
    expect(card.textContent).toContain("Último laboratorio: Markov");
    expect(within(card).getByRole("link", { name: "Continuar" }).getAttribute("href")).toBe("/laboratorios/markov");
  });

  it("«Continuar» abre el último ejercicio con su tipo, nivel y semilla si es lo más reciente", () => {
    recordLabTab({ id: "logica", label: "Lógica", path: "logica" }, 1000);
    recordExercise({ type: "logica-tabla", title: "Tabla de verdad paso a paso", level: "medio", seed: 35, mix: null }, 2000);
    at("/", <HomePage />);
    const card = screen.getByRole("region", { name: "Continuar" });
    expect(card.textContent).toContain("Último ejercicio: Tabla de verdad paso a paso · nivel medio");
    expect(within(card).getByRole("link", { name: "Continuar" }).getAttribute("href")).toBe("/laboratorios/ejercicios?t=logica-tabla&n=medio&s=z");
    // Guardado en la clave «recent» de los laboratorios.
    expect(JSON.parse(localStorage.getItem(DEFAULT_LABS_KEYS.recent)!).v).toBe(1);
  });

  it("con flashcards, el repaso de hoy dice cuántas tarjetas tocan y enlaza el repaso", async () => {
    setKv("deck/deckuser0001", { name: "Lógica", course: "02MIAR", session: 1 });
    setKv("card/deckuser0001/cardone00001", { front: "p", back: "q" });
    at("/", <HomePage flashcards />);
    const card = await screen.findByRole("region", { name: "Repaso de hoy" }, { timeout: 5000 });
    expect(within(card).getByRole("link", { name: /^Repasar \d+ tarjetas?$/ }).getAttribute("href")).toBe("/flashcards/repaso");
  });

  it("con el calendario, lo próximo con la hora de España y la de la zona elegida", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 22, 12, 0)));
    setKv("pref/timeZone", "America/Chicago");
    at("/", <HomePage calendar />);
    const card = await screen.findByRole("region", { name: "Próximo en el calendario" }, { timeout: 5000 });
    expect(card.textContent).toContain("Próxima clase");
    expect(card.textContent).toContain("02MIAR · Matemáticas · Sesión 1 · Tema 1");
    expect(card.textContent).toMatch(/20:00 España/);
    expect(card.textContent).toMatch(/13:00 Houston\/Chicago/);
    expect(within(card).getByRole("link", { name: "Ver el calendario" }).getAttribute("href")).toBe("/calendario");
  });

  it("«Próximo» respeta «Mis grupos» de cada materia", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.UTC(2026, 10, 10, 8, 0)));
    setKv("pref/calGroups", { "02MIAR": { grupo: "G2", franja: "todas" } });
    at("/", <HomePage calendar />);
    const card = await screen.findByRole("region", { name: "Próximo en el calendario" }, { timeout: 5000 });
    // La práctica de G1 del 10/11 no sale: lo próximo es la Sesión 6.
    expect(card.textContent).toContain("02MIAR · Matemáticas · Sesión 6");
    expect(card.textContent).not.toContain("(G1)");
  });

  it("la ranura «Comunidad» no pinta nada por defecto ni con una dirección que no sea https", () => {
    at("/", <HomePage community={<CommunityCard href={undefined} />} />);
    expect(screen.queryByRole("region", { name: "Comunidad" })).toBeNull();
    cleanup();
    at("/", <HomePage community={<CommunityCard href="http://foro.example.org" />} />);
    expect(screen.queryByRole("region", { name: "Comunidad" })).toBeNull();
    cleanup();
    at("/", <HomePage community={<CommunityCard href="https://foro.example.org/" />} />);
    const card = screen.getByRole("region", { name: "Comunidad" });
    const link = within(card).getByRole("link", { name: /Abrir la comunidad/ });
    expect(link.getAttribute("href")).toBe("https://foro.example.org/");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("dice «Disponible sin conexión» solo cuando el service worker ya tiene la app", async () => {
    at("/", <HomePage />);
    expect(screen.queryByText("Disponible sin conexión")).toBeNull();
    const sw = { controller: {}, register: vi.fn(async () => ({})), ready: Promise.resolve({}) } as unknown as ServiceWorkerContainer;
    await registerServiceWorker({ base: "/", container: sw });
    expect(await screen.findByText("Disponible sin conexión")).toBeTruthy();
    __resetOfflineForTests();
  });

  it("en la app pública (sin VITE_COMMUNITY_URL) el inicio no tiene tarjeta «Comunidad»", async () => {
    at("/");
    await screen.findByRole("heading", { level: 1, name: "Inicio" }, { timeout: 5000 });
    expect(screen.queryByRole("region", { name: "Comunidad" })).toBeNull();
  });
});
