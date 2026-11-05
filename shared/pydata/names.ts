// Nombres inventados para los conjuntos de datos: artículos genéricos, lugares hechos con sílabas y
// códigos de país del rango de uso privado (X..), para que ningún dato coincida con uno real.
import type { Rng } from "../exercises/random.ts";

/** Artículos genéricos de una cafetería (ninguna marca). */
export const ITEMS = [
  "café", "té", "zumo", "batido", "tostada", "bocadillo", "ensalada", "sopa", "empanada", "galleta", "magdalena", "yogur",
  "tarta", "agua", "infusión", "croissant",
] as const;

export const PAYMENTS = ["efectivo", "tarjeta", "móvil"] as const;
export const BRANCHES = ["Norte", "Sur", "Centro", "Puerto", "Estación"] as const;
export const CATEGORIES = ["inundación", "incendio", "tormenta", "sequía", "granizo", "deslizamiento"] as const;

const SYL = ["ka", "lo", "mi", "ra", "te", "su", "vi", "da", "ze", "pa", "ri", "bo", "le", "xa", "tu", "me", "ro", "si", "go", "fe"] as const;
const PREFIX = ["Alto", "Bajo", "Villa", "Puerto", "Monte", "Valle"] as const;

const capital = (w: string) => w[0]!.toUpperCase() + w.slice(1);

/** Palabra inventada de 2 o 3 sílabas. */
export const inventedWord = (rng: Rng) => Array.from({ length: rng.int(2, 3) }, () => rng.pick(SYL)).join("");

/** n nombres de lugar inventados y distintos («Ravite», «Valle Sumo»…). */
export function placeNames(rng: Rng, n: number): string[] {
  const out = new Set<string>();
  while (out.size < n) out.add(rng.chance(0.25) ? `${rng.pick(PREFIX)} ${capital(inventedWord(rng))}` : capital(inventedWord(rng)));
  return [...out];
}

/** n códigos de país inventados y distintos, del rango X.. de uso privado de ISO 3166 («XKA»). */
export function countryCodes(rng: Rng, n: number): string[] {
  const letters = "ABCDEFGHJKLMNPRSTUVWZ";
  const out = new Set<string>();
  while (out.size < n) out.add(`X${rng.pick([...letters])}${rng.pick([...letters])}`);
  return [...out];
}

/** n títulos inventados distintos, de una a tres palabras («Lomira», «El valle de Tesu»…). */
export function titles(rng: Rng, n: number): string[] {
  const forms = [
    () => capital(inventedWord(rng)),
    () => `El ${rng.pick(["viaje", "valle", "faro", "reloj", "puente", "jardín"])} de ${capital(inventedWord(rng))}`,
    () => `${capital(inventedWord(rng))} y ${capital(inventedWord(rng))}`,
    () => `La ${rng.pick(["noche", "isla", "torre", "ciudad", "senda"])} ${rng.pick(["azul", "lejana", "dormida", "nueva"])}`,
  ];
  const out = new Set<string>();
  while (out.size < n) out.add(rng.pick(forms)());
  return [...out];
}

/** n nombres de persona inventados y distintos («Kalo», «Mirate»…). */
export function personNames(rng: Rng, n: number): string[] {
  const out = new Set<string>();
  while (out.size < n) out.add(capital(inventedWord(rng)));
  return [...out];
}

/** Un nombre con el formato estropeado como en un formulario: mayúsculas mezcladas y espacios de más. */
export function messy(rng: Rng, name: string): string {
  const cased = rng.pick([name, name.toLowerCase(), name.toUpperCase(), [...name].map((c) => (rng.chance(0.5) ? c.toUpperCase() : c.toLowerCase())).join("")]);
  const pad = () => " ".repeat(rng.pick([0, 0, 1, 2]));
  return `${pad()}${cased}${pad()}`;
}
