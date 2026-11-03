// Afirmaciones de verdadero o falso sobre las clases P y NP y sobre la notación O grande, con su
// explicación corta. Son hechos de cualquier curso de complejidad (Cook–Levin, P ⊆ NP, que P = NP
// sigue abierto…), escritos aquí de nuevo; cada una tiene su nivel.
import type { ExerciseLevel } from "../exercises/types.ts";

export interface TFStatement {
  id: string;
  level: ExerciseLevel;
  text: string;
  value: boolean;
  why: string;
}

export const PNP_STATEMENTS: readonly TFStatement[] = [
  // ---------------------------------------------------------------- básico
  { id: "p-en-np", level: "básico", text: "Todo problema de la clase P está también en NP.", value: true, why: "Si se resuelve en tiempo polinómico, también se verifica en tiempo polinómico (basta resolverlo e ignorar el certificado): P ⊆ NP." },
  { id: "np-verificar", level: "básico", text: "Un problema está en NP si una solución propuesta se puede comprobar en tiempo polinómico.", value: true, why: "Es la definición por certificados: NP es la clase de problemas cuyas soluciones se verifican en tiempo polinómico." },
  { id: "np-no-polinomico", level: "básico", text: "NP quiere decir «no polinómico».", value: false, why: "NP significa «polinómico no determinista» (nondeterministic polynomial): se resuelve en tiempo polinómico con una máquina no determinista." },
  { id: "p-np-demostrado", level: "básico", text: "Está demostrado que P ≠ NP.", value: false, why: "Es un problema abierto, uno de los del Milenio del Instituto Clay: nadie ha demostrado ni P = NP ni P ≠ NP." },
  { id: "exp-polinomico", level: "básico", text: "Un algoritmo de coste O(2ⁿ) es polinómico.", value: false, why: "2ⁿ crece más deprisa que cualquier potencia nᵏ: es exponencial." },
  { id: "n100-polinomico", level: "básico", text: "Un algoritmo de coste O(n¹⁰⁰) es polinómico.", value: true, why: "Polinómico es O(nᵏ) para algún k fijo, por grande que sea; otra cosa es que sea práctico." },
  { id: "busqueda-binaria", level: "básico", text: "La búsqueda binaria en una lista ordenada de n elementos tiene coste O(log n).", value: true, why: "Cada comparación descarta la mitad de lo que queda: unas log₂ n comparaciones." },
  { id: "maximo-cuadratico", level: "básico", text: "Encontrar el máximo de una lista desordenada de n números exige un coste O(n²).", value: false, why: "Basta recorrerla una vez guardando el mayor visto: O(n). (Que también sea O(n²) no quiere decir que lo exija.)" },
  { id: "nlogn-menor", level: "básico", text: "n log n crece más despacio que n².", value: true, why: "n log n / n² = log n / n tiende a 0." },
  // ---------------------------------------------------------------- medio
  { id: "npc-def", level: "medio", text: "Un problema NP-completo está en NP y cualquier problema de NP se reduce a él en tiempo polinómico.", value: true, why: "Esa es la definición: está en NP y es NP-difícil." },
  { id: "npc-imposible", level: "medio", text: "Si un problema es NP-completo, se sabe que no se puede resolver en tiempo polinómico.", value: false, why: "No se sabe: si alguno se resolviera en tiempo polinómico, todos los de NP también (P = NP). Lo que hay es que nadie lo ha conseguido." },
  { id: "npc-p-np", level: "medio", text: "Si se encontrara un algoritmo polinómico para un problema NP-completo, entonces P = NP.", value: true, why: "Todo problema de NP se reduce a él en tiempo polinómico, así que todos se resolverían en tiempo polinómico." },
  { id: "sat-npc", level: "medio", text: "El problema de satisfacibilidad de fórmulas booleanas (SAT) es NP-completo.", value: true, why: "Es el teorema de Cook–Levin, el primer problema que se demostró NP-completo." },
  { id: "np-implica-npc", level: "medio", text: "Todo problema de NP es NP-completo.", value: false, why: "Los problemas de P también están en NP y, si P ≠ NP, ninguno de ellos es NP-completo (ordenar una lista, por ejemplo)." },
  { id: "ordenar-p", level: "medio", text: "Ordenar una lista de n números es un problema de la clase P.", value: true, why: "Hay algoritmos de coste O(n log n), como mergesort." },
  { id: "o-cota-superior", level: "medio", text: "Si un algoritmo tiene coste O(n²), también tiene coste O(n³).", value: true, why: "O grande es una cota superior: lo que crece como mucho como n² crece como mucho como n³." },
  { id: "tabla-verdad-exp", level: "medio", text: "Construir la tabla de verdad de una fórmula con n variables tiene coste del orden de 2ⁿ filas.", value: true, why: "Hay una fila por cada asignación de valores: 2ⁿ (variaciones con repetición de 2 valores en n variables)." },
  { id: "producto-matrices-p", level: "medio", text: "Multiplicar dos matrices n × n con el algoritmo de la definición tiene coste O(n³).", value: true, why: "n² entradas, y cada una es una suma de n productos: n²·n = n³." },
  // ---------------------------------------------------------------- avanzado
  { id: "np-dificil-en-np", level: "avanzado", text: "Todo problema NP-difícil está en NP.", value: false, why: "NP-difícil solo pide que todo NP se reduzca a él; puede no estar en NP (el problema de la parada es NP-difícil y ni siquiera es decidible)." },
  { id: "exp-base", level: "avanzado", text: "3ⁿ es O(2ⁿ).", value: false, why: "3ⁿ / 2ⁿ = (3/2)ⁿ crece sin límite: en una exponencial la base sí importa." },
  { id: "exp-mas-uno", level: "avanzado", text: "2ⁿ⁺¹ es O(2ⁿ).", value: true, why: "2ⁿ⁺¹ = 2·2ⁿ: solo cambia una constante." },
  { id: "factorial-exp", level: "avanzado", text: "n! es O(2ⁿ).", value: false, why: "n!/2ⁿ crece sin límite: a partir de n = 4 cada factor nuevo de n! es mayor que 2." },
  { id: "log-base", level: "avanzado", text: "log₂ n y log₁₀ n son del mismo orden.", value: true, why: "Se diferencian en una constante: log₂ n = log₁₀ n / log₁₀ 2." },
  { id: "viajante-verificar", level: "avanzado", text: "Comprobar si una ruta dada pasa una vez por cada una de n ciudades y cuesta menos de K se hace en tiempo polinómico.", value: true, why: "Se recorre la ruta sumando costes: O(n). Por eso la versión de decisión del viajante está en NP (y es NP-completa)." },
  { id: "polinomio-suma", level: "avanzado", text: "Si T(n) = O(n²) y S(n) = O(n³), entonces T(n) + S(n) = O(n⁵).", value: true, why: "Es cierto, aunque poco ajustado: la suma es O(n³), y lo que es O(n³) también es O(n⁵)." },
  { id: "np-exponencial", level: "avanzado", text: "Todo problema de NP se puede resolver en tiempo exponencial.", value: true, why: "Se prueban todos los certificados posibles (hay 2^{p(n)} de longitud polinómica) y se verifica cada uno en tiempo polinómico." },
  { id: "p-cerrada-composicion", level: "avanzado", text: "Si un algoritmo polinómico llama n veces a otro algoritmo polinómico sobre entradas de tamaño n, el total ya no es polinómico.", value: false, why: "n·nᵏ = nᵏ⁺¹ sigue siendo polinómico: los polinomios se cierran por sumas, productos y composición." },
];

export const PNP_BY_ID = new Map(PNP_STATEMENTS.map((s) => [s.id, s]));

export function pnpStatement(id: string): TFStatement {
  const s = PNP_BY_ID.get(id);
  if (!s) throw new Error(`afirmación desconocida: ${id}`);
  return s;
}

/** Afirmaciones de un nivel (el medio también usa las básicas y el avanzado, las medias). */
export function pnpPool(level: ExerciseLevel): TFStatement[] {
  const allowed: ExerciseLevel[] = level === "básico" ? ["básico"] : level === "medio" ? ["básico", "medio"] : ["medio", "avanzado"];
  return PNP_STATEMENTS.filter((s) => allowed.includes(s.level));
}
