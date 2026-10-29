// Laboratorio de conjuntos: expresiones para el diagrama de Venn, datos con elementos, igualdades para
// demostrar o refutar y problemas de cardinales. Contenido CC BY 4.0. Se valida con SetsPackSchema
// (tests/content.test.ts). Notación de clase: ∪, ∩, ∖, Δ, Aᶜ, ∅ y U. Nada de esto sale de actividades
// evaluables: son ejercicios de elaboración propia para entrenar.
import type { SetsPack } from "../../shared/sets/schema.ts";

export const SETS_PACK: SetsPack = {
  meta: {
    subject: "02MIAR · Matemáticas para la Inteligencia Artificial",
    topic: "Teoría de conjuntos",
    level: "máster",
    language: "es",
    author: "Comunidad IA Labs",
    license: "CC-BY-4.0",
    source: "Elaboración propia",
    updated: "2026-10-29",
  },
  venn: [
    { id: "dos-1", expr: "A ∩ Bᶜ", level: "básico" },
    { id: "dos-2", expr: "(A ∪ B)ᶜ", level: "básico" },
    { id: "dos-3", expr: "A Δ B", level: "básico" },
    { id: "dos-4", expr: "Aᶜ ∪ B", level: "básico" },
    { id: "tres-1", expr: "(A ∩ B) ∪ C", level: "medio" },
    { id: "tres-2", expr: "A ∖ (B ∪ C)", level: "medio" },
    { id: "tres-3", expr: "(A ∪ B) ∖ C", level: "medio" },
    { id: "tres-4", expr: "Aᶜ ∩ Bᶜ ∩ C", level: "medio" },
    { id: "tres-5", expr: "A ∩ (B Δ C)", level: "avanzado" },
    { id: "tres-6", expr: "(A ∖ B) ∪ (B ∖ C) ∪ (C ∖ A)", level: "avanzado" },
    { id: "tres-7", expr: "A Δ B Δ C", level: "avanzado" },
    { id: "tres-8", expr: "((A ∪ B) ∩ C)ᶜ", level: "avanzado" },
  ],
  elements: [
    {
      id: "numeros",
      title: "Números del 1 al 10",
      universe: "1, 2, 3, 4, 5, 6, 7, 8, 9, 10",
      sets: { A: "1, 2, 3, 4, 5", B: "2, 4, 6, 8, 10", C: "3, 6, 9" },
      exprs: ["A ∩ B", "A ∖ B", "(A ∪ B)ᶜ", "A Δ B", "(A ∩ C) ∪ B", "Aᶜ ∩ C", "A ∖ (B ∪ C)"],
    },
    {
      id: "letras",
      title: "Letras de una palabra",
      universe: "a, b, c, d, e, f, g, h",
      sets: { A: "a, b, c, d", B: "c, d, e, f", C: "a, d, f, g" },
      exprs: ["A ∪ B", "B ∖ A", "(A ∩ B)ᶜ", "A Δ C", "(A ∪ C) ∩ Bᶜ"],
    },
    {
      id: "dos-conjuntos",
      title: "Dos conjuntos pequeños",
      universe: "p, q, r, s, t",
      sets: { A: "p, q, r", B: "r, s" },
      exprs: ["A ∩ B", "A ∪ B", "Bᶜ", "A Δ B", "(A ∖ B)ᶜ"],
    },
  ],
  identities: [
    { id: "particion", left: "(A ∖ B) ∪ (A ∩ B)", right: "A", level: "básico" },
    { id: "morgan-union", left: "(A ∪ B)ᶜ", right: "Aᶜ ∩ Bᶜ", level: "básico" },
    { id: "corte-complemento", left: "A ∩ (Aᶜ ∪ B)", right: "A ∩ B", level: "básico" },
    { id: "falsa-morgan", left: "(A ∩ B)ᶜ", right: "Aᶜ ∩ Bᶜ", level: "básico" },
    { id: "diferencia-doble", left: "A ∖ (A ∖ B)", right: "A ∩ B", level: "medio" },
    { id: "union-complemento", left: "A ∪ (Aᶜ ∩ B)", right: "A ∪ B", level: "medio" },
    { id: "todo", left: "(A ∩ B)ᶜ ∪ A", right: "U", level: "medio" },
    { id: "falsa-diferencia", left: "A ∖ B", right: "B ∖ A", level: "medio" },
    { id: "diferencia-union", left: "A ∖ (B ∪ C)", right: "(A ∖ B) ∩ (A ∖ C)", level: "avanzado" },
    { id: "diferencia-reparte", left: "(A ∪ B) ∖ C", right: "(A ∖ C) ∪ (B ∖ C)", level: "avanzado" },
    { id: "falsa-asociativa", left: "A ∖ (B ∖ C)", right: "(A ∖ B) ∖ C", level: "avanzado" },
    { id: "falsa-distributiva", left: "A ∪ (B ∩ C)", right: "(A ∪ B) ∩ C", level: "avanzado" },
    { id: "simetrica-propia", left: "A Δ A", right: "∅", level: "avanzado" },
  ],
  cardinal: [
    {
      id: "idiomas",
      title: "Idiomas en una academia",
      story:
        "En una academia hay 60 estudiantes. 35 estudian inglés, 28 estudian francés y 10 estudian los dos idiomas.",
      sets: { A: "estudian inglés", B: "estudian francés" },
      data: [
        { expr: "U", value: 60 },
        { expr: "A", value: 35 },
        { expr: "B", value: 28 },
        { expr: "A ∩ B", value: 10 },
      ],
      questions: [
        { id: "alguno", prompt: "¿Cuántos estudian al menos uno de los dos idiomas?", expr: "A ∪ B" },
        { id: "solo-ingles", prompt: "¿Cuántos estudian solo inglés?", expr: "A ∖ B" },
        { id: "ninguno", prompt: "¿Cuántos no estudian ninguno?", expr: "(A ∪ B)ᶜ" },
      ],
    },
    {
      id: "lenguajes",
      title: "Lenguajes de programación",
      story:
        "Se pregunta a 50 personas de un equipo de datos qué lenguajes usan. 38 usan Python, 20 usan R y 45 usan al menos uno de los dos.",
      sets: { A: "usan Python", B: "usan R" },
      data: [
        { expr: "U", value: 50 },
        { expr: "A", value: 38 },
        { expr: "B", value: 20 },
        { expr: "A ∪ B", value: 45 },
      ],
      questions: [
        { id: "ambos", prompt: "¿Cuántas usan los dos lenguajes?", expr: "A ∩ B" },
        { id: "solo-uno", prompt: "¿Cuántas usan exactamente uno?", expr: "A Δ B" },
        { id: "ninguno", prompt: "¿Cuántas no usan ninguno?", expr: "(A ∪ B)ᶜ" },
      ],
    },
    {
      id: "optativas",
      title: "Optativas de un posgrado",
      story:
        "En un posgrado de 80 estudiantes, 45 cursan Aprendizaje automático, 30 Visión artificial y 32 Procesamiento del lenguaje. 12 cursan Aprendizaje y Visión, 15 Aprendizaje y Lenguaje, 9 Visión y Lenguaje, y 5 cursan las tres.",
      sets: { A: "Aprendizaje automático", B: "Visión artificial", C: "Procesamiento del lenguaje" },
      data: [
        { expr: "U", value: 80 },
        { expr: "A", value: 45 },
        { expr: "B", value: 30 },
        { expr: "C", value: 32 },
        { expr: "A ∩ B", value: 12 },
        { expr: "A ∩ C", value: 15 },
        { expr: "B ∩ C", value: 9 },
        { expr: "A ∩ B ∩ C", value: 5 },
      ],
      questions: [
        { id: "alguna", prompt: "¿Cuántos cursan al menos una de las tres?", expr: "A ∪ B ∪ C" },
        { id: "solo-aprendizaje", prompt: "¿Cuántos cursan solo Aprendizaje automático?", expr: "A ∖ (B ∪ C)" },
        { id: "ninguna", prompt: "¿Cuántos no cursan ninguna?", expr: "(A ∪ B ∪ C)ᶜ" },
      ],
    },
    {
      id: "streaming",
      title: "Plataformas de vídeo",
      story:
        "En una encuesta a 100 personas, 52 pagan la plataforma P, 40 la plataforma Q y 30 la plataforma R. 18 pagan P y Q, 12 pagan P y R, 10 pagan Q y R, y 8 no pagan ninguna.",
      sets: { A: "pagan P", B: "pagan Q", C: "pagan R" },
      data: [
        { expr: "U", value: 100 },
        { expr: "A", value: 52 },
        { expr: "B", value: 40 },
        { expr: "C", value: 30 },
        { expr: "A ∩ B", value: 18 },
        { expr: "A ∩ C", value: 12 },
        { expr: "B ∩ C", value: 10 },
        { expr: "(A ∪ B ∪ C)ᶜ", value: 8 },
      ],
      questions: [
        { id: "las-tres", prompt: "¿Cuántas pagan las tres plataformas?", expr: "A ∩ B ∩ C" },
        { id: "solo-una", prompt: "¿Cuántas pagan exactamente una?", expr: "(A ∖ (B ∪ C)) ∪ (B ∖ (A ∪ C)) ∪ (C ∖ (A ∪ B))" },
        { id: "q-no-p", prompt: "¿Cuántas pagan Q pero no P?", expr: "B ∖ A" },
      ],
    },
    {
      id: "deportes",
      title: "Deportes de un club",
      story:
        "Un club tiene 40 socios. 18 juegan al fútbol, 15 nadan y 12 juegan al tenis. 6 juegan al fútbol y nadan, 5 juegan al fútbol y al tenis, 4 nadan y juegan al tenis, y 2 practican los tres deportes.",
      sets: { A: "fútbol", B: "natación", C: "tenis" },
      data: [
        { expr: "U", value: 40 },
        { expr: "A", value: 18 },
        { expr: "B", value: 15 },
        { expr: "C", value: 12 },
        { expr: "A ∩ B", value: 6 },
        { expr: "A ∩ C", value: 5 },
        { expr: "B ∩ C", value: 4 },
        { expr: "A ∩ B ∩ C", value: 2 },
      ],
      questions: [
        { id: "ninguno", prompt: "¿Cuántos socios no practican ninguno de los tres?", expr: "(A ∪ B ∪ C)ᶜ" },
        { id: "exactamente-dos", prompt: "¿Cuántos practican exactamente dos deportes?", expr: "((A ∩ B) ∪ (A ∩ C) ∪ (B ∩ C)) ∖ (A ∩ B ∩ C)" },
        { id: "tenis-solo", prompt: "¿Cuántos juegan solo al tenis?", expr: "C ∖ (A ∪ B)" },
      ],
    },
  ],
};
