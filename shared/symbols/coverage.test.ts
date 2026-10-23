import { describe, expect, it } from "vitest";
import { ALL_SYMBOLS, symbolById } from "./index.ts";
import { searchSymbols } from "./search.ts";
import { SYMBOL_CATEGORIES, type SymbolCategory } from "./types.ts";

const REQUIRED: Record<SymbolCategory, string[]> = {
  "logica-proposicional": [
    "negacion", "conjuncion", "disyuncion", "disyuncion-exclusiva", "implicacion", "bicondicional",
    "reciproco", "contrarreciproco", "inverso", "tautologia", "contradiccion", "contingencia",
    "equivalencia-logica", "valores-de-verdad",
  ],
  "boole-fn": [
    "oplus", "odot", "complemento-booleano", "axiomas-boole", "ley-de-morgan", "absorcion",
    "idempotencia", "complementacion", "neutros", "doble-complementario", "distributivas",
    "funciones-fn", "espacio-f1", "complementario-funcion", "minterm", "maxterm", "fnd", "fnc",
  ],
  "primer-orden": [
    "para-todo", "existe", "existe-unico", "predicado", "negacion-cuantificadores", "dominio",
    "tal-que", "cuantificador-acotado",
  ],
  conjuntos: [
    "pertenencia", "no-pertenencia", "subconjunto", "subconjunto-propio", "union", "interseccion",
    "diferencia", "complemento-conjunto", "diferencia-simetrica", "conjunto-vacio",
    "conjunto-universal", "conjunto-potencia", "cardinal", "producto-cartesiano", "comprension",
    "conjuntos-numericos",
  ],
  "markov-algebra": [
    "matriz-transicion", "matriz-estocastica", "vector-estado", "evolucion", "potencia-matriz",
    "distribucion-estacionaria", "problema-inverso", "transpuesta", "inversa", "determinante",
    "identidad", "sistema-lineal",
  ],
  tensorial: [
    "tensor", "convencion-einstein", "delta-kronecker", "traza", "producto-tensorial",
    "producto-hadamard", "einsum", "derivada-parcial", "gradiente", "jacobiano",
  ],
};

describe("SYM-04 coverage of Sesiones 1-2", () => {
  for (const cat of SYMBOL_CATEGORIES) {
    it(`${cat}: every required id exists with that category`, () => {
      for (const id of REQUIRED[cat]) {
        const e = symbolById(id);
        expect(e, id).toBeTruthy();
        expect(e!.category, id).toBe(cat);
      }
    });
    it(`${cat}: at least 5 entries`, () => {
      expect(ALL_SYMBOLS.filter((e) => e.category === cat).length).toBeGreaterThanOrEqual(5);
    });
  }

  it("has at least 80 entries", () => {
    expect(ALL_SYMBOLS.length).toBeGreaterThanOrEqual(80);
  });

  it("D-06 readings are exact", () => {
    expect(symbolById("pertenencia")!.reading).toBe("a pertenece a A");
    expect(symbolById("pertenencia")!.altReadings).toContain("a es un elemento de A");
    expect(symbolById("cardinal")!.reading).toBe("cardinal de A");
    expect(symbolById("conjunto-vacio")!.reading).toBe("conjunto vacío");
    const p = symbolById("conjunto-potencia")!;
    expect(p.reading).toBe("conjunto potencia de A");
    expect(p.altReadings).toContain("partes de A");
    expect(p.variants.some((v) => v.tex === "2^A")).toBe(true);
    expect(symbolById("funciones-fn")!.reading).toBe("funciones booleanas de n variables");
    expect(symbolById("complementario-funcion")!.reading).toBe("complementario de f");
    expect(symbolById("para-todo")!.example!.reading.startsWith("para todo x perteneciente a A se cumple que")).toBe(true);
  });

  it.each([
    ["para todo", "para-todo"],
    ["union", "union"],
    ["A \\ B", "diferencia"],
    ["diferencia", "diferencia"],
    ["einsum", "einsum"],
    ["estacionaria", "distribucion-estacionaria"],
  ])("search %s finds %s first", (q, id) => {
    expect(searchSymbols(ALL_SYMBOLS, q)[0]?.id).toBe(id);
  });
});
