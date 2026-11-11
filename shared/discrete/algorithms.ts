// Fragmentos de pseudocódigo para estimar su complejidad: bucles «para» (hasta un tamaño o hasta la
// variable de otro bucle), recorridos de un conjunto, bucles que dividen por dos, llamadas a otro
// algoritmo de coste conocido y operaciones de coste constante. De la estructura sale su coste como
// expresión (productos por bucle, sumas por secuencia) y de ahí, con bigo.ts, su orden.
//
// Un bucle hasta la variable de otro (para j ← 1 hasta i) se acota por el tamaño del de fuera: la suma
// 1 + 2 + ··· + n = n(n+1)/2 es del mismo orden que n·n. Un bucle que divide por dos da log n vueltas.
import { costOf, costSpoken, costTex, growthOf, substituteCost, type Cost, type CostVar, type Growth } from "./bigo.ts";

export type SizeVar = "n" | "m";
export type LoopVar = "i" | "j" | "l" | "p";
export type ElemVar = "a" | "b";

export type AlgoStmt =
  | { k: "for"; v: LoopVar; to: SizeVar | LoopVar; body: AlgoStmt[] }
  | { k: "forEach"; v: ElemVar; set: "A" | "B"; body: AlgoStmt[] }
  | { k: "halve"; v: LoopVar; from: SizeVar | LoopVar; body: AlgoStmt[] }
  | { k: "call"; arg: SizeVar | LoopVar }
  | { k: "op"; text: string };

export interface Algorithm {
  /** Tamaño de cada conjunto que se recorre: |A| = m, |B| = n. */
  sets?: Partial<Record<"A" | "B", SizeVar>>;
  /** Coste del algoritmo al que se llama, como función de k: «2^k + k^8 + 3». */
  sub?: string;
  body: AlgoStmt[];
}

const ONE: Cost = { k: "num", v: 1 };

/** El coste de un fragmento como expresión en n y m (sin simplificar). */
export function algorithmCost(a: Algorithm): Cost {
  const bounds = new Map<string, SizeVar>();
  const sizeOf = (x: SizeVar | LoopVar): SizeVar => (x === "n" || x === "m" ? x : (bounds.get(x) ?? fail(`variable sin bucle: ${x}`)));
  const seq = (stmts: AlgoStmt[]): Cost => {
    const parts = stmts.map(one);
    return parts.length === 1 ? parts[0]! : { k: "add", a: parts };
  };
  const one = (s: AlgoStmt): Cost => {
    switch (s.k) {
      case "op":
        return ONE;
      case "call": {
        if (!a.sub) return fail("llamada sin coste");
        return substituteCost(costOf(a.sub, ["k"]), "k", sizeOf(s.arg));
      }
      case "for": {
        const N = sizeOf(s.to);
        bounds.set(s.v, N);
        return { k: "mul", a: [{ k: "var", v: N }, seq(s.body)] };
      }
      case "forEach": {
        const N = a.sets?.[s.set] ?? fail(`conjunto sin tamaño: ${s.set}`);
        return { k: "mul", a: [{ k: "var", v: N }, seq(s.body)] };
      }
      case "halve": {
        const N = sizeOf(s.from);
        bounds.set(s.v, N);
        return { k: "mul", a: [{ k: "log", v: N }, seq(s.body)] };
      }
    }
  };
  return seq(a.body);
}

function fail(msg: string): never {
  throw new Error(`algoritmo mal formado: ${msg}`);
}

/** El orden del fragmento. */
export const algorithmGrowth = (a: Algorithm): Growth => growthOf(algorithmCost(a));

/** Las líneas del pseudocódigo, con su sangría (cuatro espacios por nivel). */
export function algorithmLines(a: Algorithm): string[] {
  const out: string[] = [];
  const pad = (d: number) => "    ".repeat(d);
  const walk = (stmts: AlgoStmt[], d: number) => {
    for (const s of stmts) {
      switch (s.k) {
        case "op":
          out.push(`${pad(d)}${s.text}`);
          break;
        case "call":
          out.push(`${pad(d)}Alg(${s.arg})`);
          break;
        case "for":
          out.push(`${pad(d)}para ${s.v} ← 1 hasta ${s.to}:`);
          walk(s.body, d + 1);
          break;
        case "forEach":
          out.push(`${pad(d)}para cada ${s.v} en ${s.set}:`);
          walk(s.body, d + 1);
          break;
        case "halve":
          out.push(`${pad(d)}${s.v} ← ${s.from}`);
          out.push(`${pad(d)}mientras ${s.v} > 1:`);
          walk(s.body, d + 1);
          out.push(`${pad(d + 1)}${s.v} ← ⌊${s.v}/2⌋`);
          break;
      }
    }
  };
  walk(a.body, 0);
  return out;
}

/** Los datos que acompañan al pseudocódigo: tamaños y coste del algoritmo llamado. */
export function algorithmGivens(a: Algorithm): Array<{ tex: string; label: string }> {
  const out: Array<{ tex: string; label: string }> = [];
  for (const s of ["A", "B"] as const) {
    const v = a.sets?.[s];
    if (v && usesSet(a.body, s)) out.push({ tex: `|${s}| = ${v}`, label: `cardinal de ${s} igual a ${v}` });
  }
  if (a.sub) {
    const c = costOf(a.sub, ["k"]);
    out.push({ tex: `\\text{Alg}(k) \\text{ tiene coste } c(k) = ${costTex(c)}`, label: `Alg de k tiene coste c de k igual a ${costSpoken(c)}` });
  }
  return out;
}

function usesSet(stmts: AlgoStmt[], set: "A" | "B"): boolean {
  return stmts.some((s) => (s.k === "forEach" && s.set === set) || ("body" in s && usesSet(s.body, set)));
}

/** ¿Tiene el coste algún término de esa clase (exponencial, potencia de una variable, logaritmo)? */
export function costHas(c: Cost, k: "exp" | "var" | "log"): boolean {
  if (c.k === k) return true;
  if (c.k === "add" || c.k === "mul") return c.a.some((x) => costHas(x, k));
  if (c.k === "pow") return costHas(c.a, k);
  return false;
}

/** Pistas de un fragmento: la regla de cada estructura que aparece, nunca el orden final. */
export function algorithmHints(a: Algorithm): string[] {
  const kinds = new Set<string>();
  let depth = 0;
  let seqLoops = false;
  const walk = (stmts: AlgoStmt[], d: number, parentVars: Set<string>) => {
    const loopsHere = stmts.filter((s) => s.k === "for" || s.k === "forEach" || s.k === "halve").length;
    if (loopsHere > 1) seqLoops = true;
    for (const s of stmts) {
      if (s.k === "for" || s.k === "forEach" || s.k === "halve") {
        depth = Math.max(depth, d + 1);
        kinds.add(s.k);
        if (s.k === "for" && parentVars.has(s.to)) kinds.add("triangular");
        if (s.k === "halve" && parentVars.has(s.from)) kinds.add("halve-inner");
        walk(s.body, d + 1, new Set([...parentVars, s.v]));
      } else if (s.k === "call") kinds.add("call");
    }
  };
  walk(a.body, 0, new Set());
  const out = ["Cuenta cuántas veces se ejecuta la línea de dentro: un bucle multiplica el coste de su cuerpo por su número de vueltas."];
  if (kinds.has("forEach")) out.push("Recorrer un conjunto da tantas vueltas como elementos tiene: |A| vueltas para «para cada a en A».");
  if (depth >= 2) out.push("Bucles anidados: se multiplican las vueltas de cada nivel.");
  if (seqLoops) out.push("Bloques uno detrás de otro: se suman sus costes y se queda el término que más crece.");
  if (kinds.has("triangular")) out.push("Un bucle hasta la variable del de fuera (j ← 1 hasta i) da 1 + 2 + ··· + n = n(n + 1)/2 vueltas en total: del mismo orden que si llegara siempre hasta n.");
  if (kinds.has("halve")) out.push("Un bucle que divide su variable por dos da unas log₂ n vueltas (la base del logaritmo no cambia el orden).");
  if (kinds.has("call")) {
    // La comparación con 2ᵏ solo si el coste del algoritmo llamado tiene una exponencial.
    const exp = a.sub !== undefined && costHas(costOf(a.sub, ["k"]), "exp");
    out.push(`Cada llamada a Alg(x) cuesta c(x): sustituye k por el argumento y multiplica por las veces que se llama. Del coste c solo importa su término dominante${exp ? " (2ᵏ crece más que cualquier potencia de k)" : ""}.`);
  }
  out.push("Quédate con el término que más crece y quita las constantes: O(·) no lleva coeficientes.");
  return out;
}

/** Pistas para un coste escrito como expresión. */
export function costHints(c: Cost): string[] {
  // La escala de crecimiento, solo con las clases de términos que tiene el coste.
  const classes = [costHas(c, "exp") ? "exponenciales" : null, costHas(c, "var") ? "potencias" : null, costHas(c, "log") ? "logaritmos" : null].filter((x): x is string => x !== null);
  const scale = classes.length > 1 ? `: ${classes.slice(0, -1).join(", ")} por encima de ${classes.at(-1)}, y todo por encima de las constantes.` : classes[0] === "potencias" ? ": entre potencias, la de mayor exponente; las constantes son lo que menos crece." : ".";
  const out = [`Busca el término que más crece${scale}`];
  const sub = (x: Cost): Cost[] => (x.k === "add" || x.k === "mul" ? x.a : x.k === "pow" ? [x.a] : []);
  const hasPow = (x: Cost): boolean => x.k === "pow" || sub(x).some(hasPow);
  const hasMul = (x: Cost): boolean => (x.k === "mul" && x.a.filter((f) => f.k !== "num").length > 1) || sub(x).some(hasMul);
  if (hasPow(c)) out.push("Una potencia de una suma: (término dominante)ᵉ. Por ejemplo, (n³ + n)² es del orden de (n³)² = n⁶: los exponentes se multiplican.");
  if (hasMul(c)) out.push("En un producto, los órdenes se multiplican: O(f)·O(g) = O(f·g), y nᵃ·nᵇ = nᵃ⁺ᵇ.");
  out.push("Las constantes y los coeficientes desaparecen: O(5n²) = O(n²).");
  return out;
}

/** Variables de tamaño que aparecen en el coste. */
export function costVars(c: Cost): CostVar[] {
  const seen = new Set<CostVar>();
  const walk = (x: Cost) => {
    if (x.k === "var" || x.k === "exp" || x.k === "log") seen.add(x.v);
    else if (x.k === "add" || x.k === "mul") x.a.forEach(walk);
    else if (x.k === "pow") walk(x.a);
  };
  walk(c);
  return [...seen];
}
