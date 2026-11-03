// Laboratorio de cálculo: funciones para derivar paso a paso, rectas tangentes, primitivas, integrales
// definidas, funciones de dos variables (gradiente y puntos críticos) y funciones para el simulador de
// descenso de gradiente. Contenido CC BY 4.0. Se valida con CalcPackSchema
// (tests/content-calculo.test.ts). Las funciones se escriben como en el laboratorio: x^2, 2x,
// sen(x), e^x, ln(x), sqrt(x). Nada de esto sale de actividades evaluables: son ejercicios de
// elaboración propia para entrenar; las funciones del simulador (Rosenbrock, punto de silla) son las
// clásicas de cualquier curso de optimización.
import type { CalcPack } from "../../shared/calculus/schema.ts";

export const CALC_PACK: CalcPack = {
  meta: {
    subject: "02MIAR · Matemáticas para la Inteligencia Artificial",
    topic: "Cálculo diferencial e integral, varias variables y descenso de gradiente",
    level: "máster",
    language: "es",
    author: "Comunidad IA Labs",
    license: "CC-BY-4.0",
    source: "Elaboración propia",
    updated: "2026-11-03",
  },
  derivatives: [
    { id: "polinomio", level: "básico", f: "4x^3 - 5x^2 + 2x - 7" },
    { id: "potencias-y-raiz", level: "básico", f: "sqrt(x) + 3/x" },
    { id: "elementales", level: "básico", f: "2 sen(x) - 3e^x + ln(x)" },
    { id: "producto", level: "medio", f: "x^2 sen(x)" },
    { id: "cociente", level: "medio", f: "(x + 1)/(x - 2)" },
    { id: "cadena-potencia", level: "medio", f: "(3x^2 - 1)^4" },
    { id: "cadena-exponencial", level: "medio", f: "e^(-x^2/2)" },
    { id: "producto-y-cadena", level: "avanzado", f: "x e^(2x)" },
    { id: "logaritmo-compuesto", level: "avanzado", f: "ln(x^2 + 4)" },
    { id: "sigmoide", level: "avanzado", f: "1/(1 + e^(-x))" },
    { id: "raiz-compuesta", level: "avanzado", f: "x sqrt(1 + x^2)" },
  ],
  tangents: [
    { id: "parabola", level: "básico", f: "x^2 - 2x", x0: 3, range: [-2, 5] },
    { id: "cubica", level: "medio", f: "x^3 - 3x", x0: -2, range: [-3, 3] },
    { id: "exponencial", level: "medio", f: "e^x", x0: 0, range: [-3, 2] },
    { id: "logaritmo", level: "avanzado", f: "x ln(x)", x0: 1, range: [0.05, 3] },
    { id: "seno", level: "avanzado", f: "sen(2x)", x0: 0, range: [-3, 3] },
  ],
  antiderivatives: [
    { id: "polinomio", level: "básico", f: "6x^2 - 4x + 3" },
    { id: "potencias", level: "básico", f: "x^3 + 1/x^2" },
    { id: "raiz", level: "medio", f: "3 sqrt(x) - 2/x" },
    { id: "trigonometricas", level: "medio", f: "cos(x) + 2 sen(x)" },
    { id: "exponencial-lineal", level: "avanzado", f: "e^(3x) + 4/(2x + 1)" },
    { id: "trigonometrica-lineal", level: "avanzado", f: "sen(2x - 1)" },
  ],
  definite: [
    { id: "parabola", level: "básico", f: "x^2", a: 0, b: 3 },
    { id: "recta", level: "básico", f: "2x + 1", a: -1, b: 2 },
    { id: "cubica", level: "medio", f: "x^3 - x", a: 0, b: 2 },
    { id: "exponencial", level: "avanzado", f: "e^x", a: 0, b: 1 },
    { id: "inversa", level: "avanzado", f: "1/x", a: 1, b: 4 },
  ],
  multivariable: [
    { id: "polinomio", level: "básico", f: "x^2 y + 3x - 2y^2", point: [1, 2], x: [-3, 3], y: [-3, 3] },
    { id: "cuadratica", level: "básico", f: "x^2 + 2x y + 3y^2", point: [-1, 1], x: [-3, 3], y: [-3, 3] },
    { id: "exponencial", level: "medio", f: "x e^(x - y)", point: [1, 1], x: [-2, 2], y: [-2, 2] },
    { id: "trigonometrica", level: "avanzado", f: "sen(x y) + x^2", point: [0, 2], x: [-2, 2], y: [-2, 2] },
  ],
  critical: [
    { id: "paraboloide", level: "básico", f: "x^2 + y^2 - 4x + 2y", x: [-1, 5], y: [-4, 2] },
    { id: "silla", level: "básico", f: "x^2 - 3y^2 + 6y", x: [-3, 3], y: [-2, 4] },
    { id: "cubica-separada", level: "medio", f: "x^3 - 3x + y^2", x: [-2.5, 2.5], y: [-2, 2] },
    { id: "cubica-cruzada", level: "avanzado", f: "x^3 + y^3 - 3x y", x: [-1.5, 2], y: [-1.5, 2] },
    { id: "dos-cubicas", level: "avanzado", f: "x^3 - 12x + y^3 - 3y", x: [-3.5, 3.5], y: [-2.5, 2.5] },
  ],
  descent1: [
    { id: "cuadratica", title: "Parábola: f(x) = (x − 2)² + 1", f: "(x - 2)^2 + 1", range: [-3, 6], start: -2, alpha: 0.1, iterations: 30 },
    { id: "dos-minimos", title: "Dos mínimos: f(x) = x⁴ − 3x² + x", f: "x^4 - 3x^2 + x", range: [-2.3, 2.3], start: 2, alpha: 0.02, iterations: 60 },
    { id: "plana", title: "Muy plana cerca del mínimo: f(x) = x⁴", f: "x^4", range: [-2, 2], start: 1.5, alpha: 0.05, iterations: 60 },
  ],
  descent2: [
    { id: "cuadratica", title: "Cuadrática convexa: x² + y²", f: "x^2 + y^2", x: [-3, 3], y: [-3, 3], start: [2.5, -2], alpha: 0.1, iterations: 40 },
    { id: "valle", title: "Valle alargado: x²/20 + 5y²", f: "x^2/20 + 5y^2", x: [-10, 10], y: [-2.5, 2.5], start: [-8, 1], alpha: 0.18, iterations: 200 },
    { id: "rosenbrock", title: "Rosenbrock: (1 − x)² + 100(y − x²)²", f: "(1 - x)^2 + 100(y - x^2)^2", x: [-2, 2], y: [-1, 3], start: [-1.2, 1], alpha: 0.001, iterations: 500 },
    { id: "dos-minimos", title: "Dos mínimos: x⁴ − 3x² + x + y²", f: "x^4 - 3x^2 + x + y^2", x: [-2.3, 2.3], y: [-2, 2], start: [0.4, 1.5], alpha: 0.02, iterations: 150 },
    { id: "silla", title: "Punto de silla: x² − y²", f: "x^2 - y^2", x: [-2, 2], y: [-2, 2], start: [1.8, 0.05], alpha: 0.1, iterations: 60 },
  ],
};
