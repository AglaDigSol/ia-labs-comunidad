// Circuitos lógicos combinacionales: una «netlist» (entradas, puertas y una salida), su validación
// (sin ciclos, todo definido, una salida), su evaluación, la expresión de Boole que calcula, la
// construcción del circuito a partir de una expresión, las traducciones a solo NAND o solo NOR y la
// disposición en capas para dibujarlo. TypeScript puro, sin React ni DOM.
//
// Notación de clase: ⊕ suma (OR), ⊙ producto (AND), ′ complemento (NOT) y ⊻ la disyunción exclusiva
// (XOR), que en las expresiones de Boole se desarrolla como a ⊙ b′ ⊕ a′ ⊙ b.
import { band, bconst, bnot, bor, booleToTex, booleVars, bvar, evalBoole, type BExpr } from "./expr.ts";

export type GateType = "or" | "and" | "xor" | "not" | "nor" | "nand" | "xnor";
export const GATE_TYPES: readonly GateType[] = ["or", "and", "xor", "not", "nor", "nand", "xnor"];
export const isGateType = (x: unknown): x is GateType => typeof x === "string" && (GATE_TYPES as readonly string[]).includes(x);

/** Nombre de cada puerta, como se rotula en los esquemas. */
export const GATE_NAMES: Record<GateType, string> = {
  or: "OR",
  and: "AND",
  xor: "XOR",
  not: "NOT",
  nor: "NOR",
  nand: "NAND",
  xnor: "XNOR",
};

/** Máximo de entradas de una puerta (NOT tiene exactamente una). */
export const MAX_GATE_INPUTS = 4;
/** Fuentes constantes que puede usar una puerta además de las entradas. */
export const CONSTANT_SOURCES = ["0", "1"] as const;

export type Gate = { id: string; type: GateType; inputs: string[] };
/** Un circuito: entradas (variables), puertas y la señal de salida (una puerta, una entrada o 0/1). */
export type Netlist = { inputs: string[]; gates: Gate[]; output: string };

const VAR_NAME = /^[A-Za-z](?:_?\d+)?$/;
const GATE_ID = /^[A-Za-z][A-Za-z0-9_]*$/;
const isConstant = (s: string) => s === "0" || s === "1";

/** Valor de una puerta para unos valores de entrada. XOR de n entradas = paridad. */
export function gateValue(type: GateType, bits: boolean[]): boolean {
  switch (type) {
    case "not":
      return !bits[0];
    case "or":
      return bits.some(Boolean);
    case "and":
      return bits.every(Boolean);
    case "nor":
      return !bits.some(Boolean);
    case "nand":
      return !bits.every(Boolean);
    case "xor":
      return bits.filter(Boolean).length % 2 === 1;
    case "xnor":
      return bits.filter(Boolean).length % 2 === 0;
  }
}

// ---------------------------------------------------------------- Validación

export type NetlistIssue = { code: NetlistIssueCode; message: string; at?: string };
export type NetlistIssueCode =
  | "bad-input"
  | "duplicate"
  | "bad-id"
  | "arity"
  | "undefined"
  | "cycle"
  | "no-output"
  | "unused";

/**
 * Comprueba que la netlist es un circuito combinacional bien formado: nombres válidos y distintos,
 * el número de entradas de cada puerta, que cada entrada de puerta está definida, que no hay ciclos,
 * que la salida existe y que todas las puertas llegan a la salida. Devuelve el primer problema o null.
 */
export function validateNetlist(net: Netlist): NetlistIssue | null {
  const seen = new Set<string>();
  for (const name of net.inputs) {
    if (!VAR_NAME.test(name)) return { code: "bad-input", at: name, message: `La entrada «${name}» no es un nombre de variable válido.` };
    if (seen.has(name)) return { code: "duplicate", at: name, message: `La entrada «${name}» está repetida.` };
    seen.add(name);
  }
  const byId = new Map<string, Gate>();
  for (const g of net.gates) {
    if (!GATE_ID.test(g.id)) return { code: "bad-id", at: g.id, message: `«${g.id}» no es un identificador de puerta válido.` };
    if (seen.has(g.id)) return { code: "duplicate", at: g.id, message: `El nombre «${g.id}» está repetido.` };
    if (!isGateType(g.type)) return { code: "bad-id", at: g.id, message: `La puerta ${g.id} tiene un tipo desconocido.` };
    seen.add(g.id);
    byId.set(g.id, g);
    const k = g.inputs.length;
    if (g.type === "not" ? k !== 1 : k < 2 || k > MAX_GATE_INPUTS) {
      return {
        code: "arity",
        at: g.id,
        message:
          g.type === "not"
            ? `La puerta NOT ${g.id} debe tener exactamente una entrada.`
            : `La puerta ${GATE_NAMES[g.type]} ${g.id} debe tener entre 2 y ${MAX_GATE_INPUTS} entradas.`,
      };
    }
  }
  for (const g of net.gates) {
    for (const s of g.inputs) {
      if (!seen.has(s) && !isConstant(s)) return { code: "undefined", at: g.id, message: `La puerta ${g.id} usa «${s}», que no está definida.` };
    }
  }
  // Ciclos: búsqueda en profundidad con tres colores.
  const color = new Map<string, 1 | 2>();
  const visit = (id: string): string | null => {
    const c = color.get(id);
    if (c === 2) return null;
    if (c === 1) return id;
    color.set(id, 1);
    for (const s of byId.get(id)!.inputs) {
      if (!byId.has(s)) continue;
      const r = visit(s);
      if (r) return r;
    }
    color.set(id, 2);
    return null;
  };
  for (const g of net.gates) {
    const r = visit(g.id);
    if (r) return { code: "cycle", at: r, message: `Hay un ciclo: la puerta ${r} depende de su propia salida.` };
  }
  if (!seen.has(net.output) && !isConstant(net.output)) return { code: "no-output", message: `La salida «${net.output}» no está definida.` };
  const used = reachable(net);
  const dangling = net.gates.find((g) => !used.has(g.id));
  if (dangling) return { code: "unused", at: dangling.id, message: `La puerta ${dangling.id} no llega a la salida.` };
  return null;
}

/** Puertas de las que depende la salida. */
function reachable(net: Netlist): Set<string> {
  const byId = new Map(net.gates.map((g) => [g.id, g]));
  const out = new Set<string>();
  const stack = [net.output];
  while (stack.length > 0) {
    const s = stack.pop()!;
    const g = byId.get(s);
    if (!g || out.has(s)) continue;
    out.add(s);
    stack.push(...g.inputs);
  }
  return out;
}

function assertValid(net: Netlist): void {
  const issue = validateNetlist(net);
  if (issue) throw new Error(issue.message);
}

/** Puertas en orden topológico (estable respecto al orden de la netlist). */
export function topoOrder(net: Netlist): Gate[] {
  const byId = new Map(net.gates.map((g) => [g.id, g]));
  const done = new Set<string>();
  const out: Gate[] = [];
  const visit = (g: Gate) => {
    if (done.has(g.id)) return;
    done.add(g.id);
    for (const s of g.inputs) {
      const h = byId.get(s);
      if (h) visit(h);
    }
    out.push(g);
  };
  net.gates.forEach(visit);
  return out;
}

// ---------------------------------------------------------------- Evaluación

export type CircuitEval = { output: boolean; wires: Record<string, boolean> };

/** Evalúa el circuito: valor de cada cable (entradas y salidas de puerta) y de la salida. */
export function evaluateCircuit(net: Netlist, env: Record<string, boolean>): CircuitEval {
  const wires: Record<string, boolean> = { "0": false, "1": true };
  for (const x of net.inputs) wires[x] = env[x] ?? false;
  for (const g of topoOrder(net)) wires[g.id] = gateValue(g.type, g.inputs.map((s) => wires[s] ?? false));
  return { output: wires[net.output] ?? false, wires };
}

/** Columna de salida de la tabla de verdad, con la primera entrada como bit alto (00…0 primero). */
export function circuitTruthTable(net: Netlist, vars: string[] = net.inputs): boolean[] {
  const n = vars.length;
  return Array.from({ length: 1 << n }, (_, m) => {
    const env = Object.fromEntries(vars.map((v, i) => [v, ((m >> (n - 1 - i)) & 1) === 1]));
    return evaluateCircuit(net, env).output;
  });
}

// ---------------------------------------------------------------- Expresiones

export type RowDifference = { vars: string[]; values: boolean[]; expected: boolean; given: boolean };

/**
 * Primera fila (en orden 0…0, 0…1, …) en la que difieren dos expresiones sobre las variables dadas,
 * o null si son equivalentes. Sirve para explicar por qué una respuesta no coincide con un circuito.
 */
export function firstDifference(expected: BExpr, given: BExpr, vars: string[]): RowDifference | null {
  const n = vars.length;
  for (let m = 0; m < 1 << n; m++) {
    const values = vars.map((_, i) => ((m >> (n - 1 - i)) & 1) === 1);
    const env = Object.fromEntries(vars.map((v, i) => [v, values[i]!]));
    const a = evalBoole(expected, env);
    const b = evalBoole(given, env);
    if (a !== b) return { vars, values, expected: a, given: b };
  }
  return null;
}

/** a ⊻ b desarrollado con la notación de clase: a ⊙ b′ ⊕ a′ ⊙ b. */
export const bxor = (a: BExpr, b: BExpr): BExpr => bor(band(a, bnot(b)), band(bnot(a), b));

const sourceExpr = (s: string): BExpr => (s === "0" ? bconst(0) : s === "1" ? bconst(1) : bvar(s));

function gateExpr(type: GateType, args: BExpr[]): BExpr {
  switch (type) {
    case "not":
      return bnot(args[0]!);
    case "or":
      return bor(...args);
    case "and":
      return band(...args);
    case "nor":
      return bnot(bor(...args));
    case "nand":
      return bnot(band(...args));
    case "xor":
      return args.slice(1).reduce((acc, a) => bxor(acc, a), args[0]!);
    case "xnor":
      return bnot(args.slice(1).reduce((acc, a) => bxor(acc, a), args[0]!));
  }
}

/** Expresión de cada cable (por id de puerta o nombre de entrada), con XOR desarrollado. */
export function wireExpressions(net: Netlist): Record<string, BExpr> {
  assertValid(net);
  const out: Record<string, BExpr> = { "0": bconst(0), "1": bconst(1) };
  for (const x of net.inputs) out[x] = bvar(x);
  for (const g of topoOrder(net)) out[g.id] = gateExpr(g.type, g.inputs.map((s) => out[s] ?? sourceExpr(s)));
  return out;
}

/** La función que calcula el circuito, como expresión de Boole (⊕, ⊙, ′; XOR desarrollado). */
export function circuitToExpression(net: Netlist): BExpr {
  return wireExpressions(net)[net.output]!;
}

// Fórmula «a nivel de puertas»: una subexpresión por puerta, con ⊻ para XOR y (…)′ para NAND, NOR y
// XNOR. Sirve para describir el circuito (aria-label, solución) tal y como está dibujado.
type GTree = { k: "src"; name: string } | { k: GateType; args: GTree[] };

function gateTree(net: Netlist, signal: string): GTree {
  const byId = new Map(net.gates.map((g) => [g.id, g]));
  const memo = new Map<string, GTree>();
  const build = (s: string): GTree => {
    const g = byId.get(s);
    if (!g) return { k: "src", name: s };
    const hit = memo.get(s);
    if (hit) return hit;
    const t: GTree = { k: g.type, args: g.inputs.map(build) };
    memo.set(s, t);
    return t;
  };
  return build(signal);
}

const OPS = {
  plain: { or: " ⊕ ", and: " ⊙ ", xor: " ⊻ ", prime: "′", open: "(", close: ")" },
  tex: { or: " \\oplus ", and: " \\odot ", xor: " \\veebar ", prime: "'", open: "\\left(", close: "\\right)" },
} as const;

function renderTree(t: GTree, tex: boolean): string {
  const o = tex ? OPS.tex : OPS.plain;
  const group = (s: string) => `${o.open}${s}${o.close}`;
  const base = (k: GateType): "or" | "and" | "xor" =>
    k === "nor" || k === "or" ? "or" : k === "nand" || k === "and" ? "and" : "xor";
  const child = (c: GTree, parent: "or" | "and" | "xor"): string => {
    const s = renderTree(c, tex);
    if (c.k === "or" || c.k === "xor" || c.k === "and") {
      // Un producto dentro de una suma no necesita paréntesis; todo lo demás se agrupa como en el dibujo.
      return parent === "or" && c.k === "and" ? s : group(s);
    }
    return s;
  };
  switch (t.k) {
    case "src":
      return tex ? booleToTex(sourceExpr(t.name)) : t.name;
    case "not": {
      const c = t.args[0]!;
      const inner = renderTree(c, tex);
      const atomic = c.k === "src" || c.k === "not" || c.k === "nand" || c.k === "nor" || c.k === "xnor";
      return `${atomic ? inner : group(inner)}${o.prime}`;
    }
    default: {
      const op = base(t.k);
      const body = t.args.map((c) => child(c, op)).join(o[op]);
      return t.k === "nand" || t.k === "nor" || t.k === "xnor" ? `${group(body)}${o.prime}` : body;
    }
  }
}

/** Fórmula del circuito tal como está dibujado (⊻ para XOR). La lee parseBoole(…, { xor: true }). */
export function circuitToPlain(net: Netlist, signal = net.output): string {
  assertValid(net);
  return renderTree(gateTree(net, signal), false);
}

/** La misma fórmula en TeX. */
export function circuitToTex(net: Netlist, signal = net.output): string {
  assertValid(net);
  return renderTree(gateTree(net, signal), true);
}

/** Fórmula de una sola puerta con sus entradas nombradas: «A ⊻ z», «(x ⊙ y)′». */
export function gateFormula(g: Gate, name: (s: string) => string = (s) => s, tex = false): string {
  return renderTree({ k: g.type, args: g.inputs.map((s) => ({ k: "src" as const, name: name(s) })) }, tex);
}

/** Sustituye variables por expresiones (por ejemplo, los cables A, B… por lo que calculan). */
export function substituteVars(e: BExpr, map: Record<string, BExpr>): BExpr {
  switch (e.k) {
    case "var":
      return map[e.name] ?? e;
    case "const":
      return e;
    case "not":
      return bnot(substituteVars(e.a, map));
    default:
      return e.k === "or" ? bor(...e.args.map((a) => substituteVars(a, map))) : band(...e.args.map((a) => substituteVars(a, map)));
  }
}

/** Lectura de una puerta en una línea: «XOR(A, z)». */
export function gateText(g: Gate, name: (s: string) => string = (s) => s): string {
  return `${GATE_NAMES[g.type]}(${g.inputs.map(name).join(", ")})`;
}

// ---------------------------------------------------------------- Construcción

const COMMUTATIVE = true; // todas las puertas de este laboratorio son simétricas en sus entradas

/** Constructor de netlists con reutilización de puertas idénticas (mismo tipo y mismas entradas). */
class Builder {
  gates: Gate[] = [];
  private byKey = new Map<string, string>();
  private byId = new Map<string, Gate>();
  private n = 0;

  gate(type: GateType, inputs: string[]): string {
    // La clave ignora el orden de las entradas (todas las puertas son simétricas); la puerta lo conserva.
    const k = `${type}(${(COMMUTATIVE ? [...inputs].sort() : inputs).join(",")})`;
    const hit = this.byKey.get(k);
    if (hit) return hit;
    const id = `g${++this.n}`;
    const g: Gate = { id, type, inputs: [...inputs] };
    this.gates.push(g);
    this.byKey.set(k, id);
    this.byId.set(id, g);
    return id;
  }

  get(id: string): Gate | undefined {
    return this.byId.get(id);
  }

  /** Una puerta de `type` con cualquier número de entradas, en árbol si pasa de MAX_GATE_INPUTS. */
  wide(type: "or" | "and" | "nand" | "nor", inputs: string[]): string {
    if (inputs.length <= MAX_GATE_INPUTS) return this.gate(type, inputs);
    // NAND y NOR no son asociativas: se agrupa con la operación base y se niega al final.
    const base = type === "nand" ? "and" : type === "nor" ? "or" : type;
    const chunks: string[] = [];
    for (let i = 0; i < inputs.length; i += MAX_GATE_INPUTS) {
      const part = inputs.slice(i, i + MAX_GATE_INPUTS);
      chunks.push(part.length === 1 ? part[0]! : this.gate(base, part));
    }
    if (base === type) return this.wide(base, chunks);
    return this.wide(type, chunks.length === 1 ? [chunks[0]!, chunks[0]!] : chunks);
  }

  netlist(inputs: string[], output: string): Netlist {
    const net: Netlist = { inputs, gates: this.gates, output };
    const used = reachable(net);
    return { inputs, gates: topoOrder({ ...net, gates: this.gates.filter((g) => used.has(g.id)) }), output };
  }
}

/** Circuito de puertas básicas (OR, AND, NOT) que calcula la expresión; reutiliza subexpresiones iguales. */
export function circuitFromExpression(e: BExpr): Netlist {
  const b = new Builder();
  const build = (x: BExpr): string => {
    switch (x.k) {
      case "var":
        return x.name;
      case "const":
        return String(x.v);
      case "not":
        return b.gate("not", [build(x.a)]);
      default:
        return b.wide(x.k, x.args.map(build));
    }
  };
  const out = build(e);
  return b.netlist(booleVars(e), out);
}

// ---------------------------------------------------------------- Puertas universales

type Universal = "nand" | "nor";

/**
 * Traduce el circuito a una sola puerta universal. Con NAND: x′ = (x ⊙ x)′, a ⊙ b = ((a ⊙ b)′)′,
 * a ⊕ b = (a′ ⊙ b′)′ y a ⊻ b con cuatro NAND. Con NOR, las duales. Se cancelan los dobles
 * complementos que aparecen al encadenar (NOT de un NOT) y se reutilizan puertas iguales.
 */
function toUniversal(net: Netlist, u: Universal): Netlist {
  assertValid(net);
  const b = new Builder();
  const map = new Map<string, string>([
    ["0", "0"],
    ["1", "1"],
  ]);
  for (const x of net.inputs) map.set(x, x);
  const inv = (s: string): string => {
    if (s === "0") return "1";
    if (s === "1") return "0";
    const g = b.get(s);
    if (g && g.type === u && g.inputs.length === 2 && g.inputs[0] === g.inputs[1]) return g.inputs[0]!;
    return b.gate(u, [s, s]);
  };
  const U = (xs: string[]) => b.wide(u, xs);
  // Con NAND: and = inv(nand), or = nand(inv…). Con NOR, al revés.
  const and = (xs: string[]) => (u === "nand" ? inv(U(xs)) : U(xs.map(inv)));
  const or = (xs: string[]) => (u === "nand" ? U(xs.map(inv)) : inv(U(xs)));
  // Bloque de cuatro puertas: con NAND da a ⊻ b; con NOR da (a ⊻ b)′.
  const four = (a: string, c: string) => {
    const t = b.gate(u, [a, c]);
    return b.gate(u, [b.gate(u, [a, t]), b.gate(u, [c, t])]);
  };
  const xor2 = (a: string, c: string) => (u === "nand" ? four(a, c) : inv(four(a, c)));
  const xor = (xs: string[]) => xs.slice(1).reduce((acc, x) => xor2(acc, x), xs[0]!);
  for (const g of topoOrder(net)) {
    const xs = g.inputs.map((s) => map.get(s)!);
    let out: string;
    switch (g.type) {
      case "not":
        out = inv(xs[0]!);
        break;
      case "and":
        out = and(xs);
        break;
      case "or":
        out = or(xs);
        break;
      case "nand":
        out = u === "nand" ? U(xs) : inv(and(xs));
        break;
      case "nor":
        out = u === "nor" ? U(xs) : inv(or(xs));
        break;
      case "xor":
        out = xor(xs);
        break;
      case "xnor":
        out = xs.length === 2 && u === "nor" ? four(xs[0]!, xs[1]!) : inv(xor(xs));
        break;
    }
    map.set(g.id, out);
  }
  return b.netlist([...net.inputs], map.get(net.output) ?? net.output);
}

/** El mismo circuito usando solo puertas NAND. */
export const toNand = (net: Netlist): Netlist => toUniversal(net, "nand");
/** El mismo circuito usando solo puertas NOR. */
export const toNor = (net: Netlist): Netlist => toUniversal(net, "nor");

/** ¿Calculan los dos circuitos la misma función? (tabla de verdad sobre la unión de entradas). */
export function circuitsEquivalent(a: Netlist, b: Netlist): boolean {
  const vars = [...new Set([...a.inputs, ...b.inputs])].sort();
  const ta = circuitTruthTable(a, vars);
  const tb = circuitTruthTable(b, vars);
  return ta.every((v, i) => v === tb[i]);
}

/** Cuántas puertas hay de cada tipo. */
export function gateCounts(net: Netlist): Partial<Record<GateType, number>> {
  const out: Partial<Record<GateType, number>> = {};
  for (const g of net.gates) out[g.type] = (out[g.type] ?? 0) + 1;
  return out;
}

// ---------------------------------------------------------------- Capas y disposición

/** Capa de cada señal: 0 para entradas y constantes; una puerta, 1 + la mayor capa de sus entradas. */
export function circuitLayers(net: Netlist): { layer: Record<string, number>; depth: number } {
  assertValid(net);
  const layer: Record<string, number> = {};
  for (const x of net.inputs) layer[x] = 0;
  for (const c of CONSTANT_SOURCES) layer[c] = 0;
  let depth = 0;
  for (const g of topoOrder(net)) {
    const l = 1 + Math.max(...g.inputs.map((s) => layer[s] ?? 0));
    layer[g.id] = l;
    depth = Math.max(depth, l);
  }
  return { layer, depth };
}

/** Medidas del dibujo (unidades de SVG). */
export const CIRCUIT_GEOMETRY = {
  pad: 16,
  /** Hueco a la izquierda para el nombre de cada entrada. */
  labelW: 28,
  gateW: 44,
  /** Ancho extra de la burbuja de negación (NOT, NAND, NOR, XNOR). */
  bubble: 8,
  /** Separación de la línea trasera de XOR/XNOR. */
  xorGap: 6,
  minGateH: 40,
  portGap: 14,
  /** Separación vertical mínima entre elementos de una columna. */
  vGap: 26,
  /** Ancho de cada canal vertical entre columnas. */
  channel: 14,
  minGap: 44,
  outLen: 36,
} as const;

const G = CIRCUIT_GEOMETRY;
const NEGATED: ReadonlySet<GateType> = new Set(["not", "nand", "nor", "xnor"]);
const CURVED: ReadonlySet<GateType> = new Set(["or", "nor", "xor", "xnor"]);

export const gateHeight = (type: GateType, k: number) =>
  type === "not" ? 28 : Math.max(G.minGateH, (k + 1) * G.portGap);
/** Ancho del cuerpo de la puerta (sin la burbuja ni la línea trasera de XOR). */
export const gateBodyWidth = (type: GateType) => (type === "not" ? 30 : G.gateW);
/** ¿Lleva la puerta burbuja de negación a la salida? */
export const isNegatedGate = (type: GateType) => NEGATED.has(type);
/** Desplazamiento del cuerpo respecto al borde izquierdo (la línea trasera de XOR y XNOR). */
export const gateBodyOffset = (type: GateType) => (type === "xor" || type === "xnor" ? G.xorGap : 0);
export const gateWidth = (type: GateType) => gateBodyOffset(type) + gateBodyWidth(type) + (NEGATED.has(type) ? G.bubble : 0);

/** x (relativa al borde izquierdo de la puerta) donde termina un cable que entra a altura `dy` del centro. */
export function portX(type: GateType, h: number, dy: number): number {
  if (!CURVED.has(type)) return 0;
  // Curva trasera de OR: cuadrática de (0, 0) a (0, h) con control en (0,25·w, h/2) → x = 0,5·w·t·(1 − t).
  const t = Math.min(1, Math.max(0, dy / h + 0.5));
  return 0.5 * G.gateW * t * (1 - t);
}

export type PlacedNode =
  | { id: string; kind: "input" | "const"; x: number; y: number }
  | { id: string; kind: "gate"; type: GateType; x: number; y: number; w: number; h: number; layer: number; ports: number[] };

export type CircuitLayout = {
  width: number;
  height: number;
  nodes: PlacedNode[];
  /** Cada cable es una polilínea de puntos [x, y] con tramos horizontales y verticales. */
  wires: Array<{ from: string; points: Array<[number, number]> }>;
  /** Puntos de unión donde un cable se ramifica. */
  junctions: Array<[number, number]>;
  /** Etiqueta (A, B, C…) de la salida de cada puerta que no es la salida del circuito. */
  labels: Record<string, string>;
  /** Punto donde empieza el cable de salida y donde se rotula «f». */
  output: { from: [number, number]; to: [number, number] };
};

type Slot = { key: string; src: string; gate: Gate | null; h: number; y: number; desired: number };

/**
 * Disposición en capas: entradas a la izquierda, cada puerta en la columna de su capa y la salida a
 * la derecha. Los cables que saltan columnas pasan por puntos intermedios (uno por señal y columna),
 * así nunca atraviesan una puerta. Dentro de cada columna, el orden sigue el baricentro de lo que
 * entra; entre columnas, cada señal tiene su propio canal vertical.
 */
export function layoutCircuit(net: Netlist): CircuitLayout {
  const { layer, depth } = circuitLayers(net);
  const usedConsts = CONSTANT_SOURCES.filter((c) => net.gates.some((g) => g.inputs.includes(c)) || net.output === c);
  // Última columna en la que se necesita cada señal (la de su consumidor más lejano).
  const lastUse = new Map<string, number>();
  for (const g of net.gates) for (const s of g.inputs) lastUse.set(s, Math.max(lastUse.get(s) ?? 0, layer[g.id]!));
  const outCol = depth + 1;
  lastUse.set(net.output, Math.max(lastUse.get(net.output) ?? 0, outCol));

  const keyAt = (s: string, col: number) => (layer[s] === col ? s : `${s}@${col}`);
  const columns: Slot[][] = [];
  const ys = new Map<string, number>();
  // Columna 0: entradas en su orden y constantes.
  const sources = [...net.inputs, ...usedConsts];
  columns.push(
    sources.map((s, i) => {
      const y = i * (G.minGateH / 2 + G.vGap);
      ys.set(s, y);
      return { key: s, src: s, gate: null, h: 0, y, desired: y };
    }),
  );
  for (let col = 1; col <= depth; col++) {
    const slots: Slot[] = [];
    for (const g of net.gates) {
      if (layer[g.id] !== col) continue;
      const pred = g.inputs.map((s) => ys.get(keyAt(s, col - 1))!);
      const desired = pred.reduce((a, b) => a + b, 0) / pred.length;
      slots.push({ key: g.id, src: g.id, gate: g, h: gateHeight(g.type, g.inputs.length), y: 0, desired });
    }
    for (const s of [...sources, ...net.gates.map((g) => g.id)]) {
      if ((layer[s] ?? 0) < col && (lastUse.get(s) ?? -1) > col) {
        slots.push({ key: `${s}@${col}`, src: s, gate: null, h: 0, y: 0, desired: ys.get(keyAt(s, col - 1))! });
      }
    }
    slots.sort((a, b) => a.desired - b.desired || (a.gate ? 0 : 1) - (b.gate ? 0 : 1));
    // Colocar cerca del baricentro sin solaparse y centrar el bloque respecto a lo deseado.
    const sep = (a: Slot, b: Slot) => (a.h + b.h) / 2 + G.vGap;
    slots.forEach((s, i) => {
      s.y = i === 0 ? s.desired : Math.max(s.desired, slots[i - 1]!.y + sep(slots[i - 1]!, s));
    });
    if (slots.length > 0) {
      const shift = slots.reduce((acc, s) => acc + (s.y - s.desired), 0) / slots.length;
      // Desplazar hacia arriba lo que se ha empujado de más, sin romper la separación.
      for (const s of slots) s.y -= shift;
    }
    for (const s of slots) ys.set(s.key, s.y);
    columns.push(slots);
  }
  // Normalizar: el elemento más alto queda en pad + su media altura.
  let top = Infinity;
  let bottom = -Infinity;
  for (const col of columns) for (const s of col) {
    top = Math.min(top, s.y - Math.max(s.h / 2, 10));
    bottom = Math.max(bottom, s.y + Math.max(s.h / 2, 6));
  }
  const dy = G.pad + 8 - top;
  for (const col of columns) for (const s of col) {
    s.y += dy;
    ys.set(s.key, s.y);
  }

  // Columnas en x: ancho de cada columna y hueco con un canal por señal que cambia de altura.
  const colW = columns.map((slots, c) => (c === 0 ? 0 : Math.max(0, ...slots.map((s) => (s.gate ? gateWidth(s.gate.type) : 0)))));
  type Edge = { src: string; fromKey: string; toKey: string; port: number; toY: number };
  const edgesInto: Edge[][] = columns.map(() => []);
  for (let col = 1; col <= depth; col++) {
    for (const s of columns[col]!) {
      if (s.gate) {
        // Puertos ordenados por la altura de la señal que llega: así no se cruzan a la entrada.
        const ins = s.gate.inputs
          .map((src, i) => ({ src, i, y: ys.get(keyAt(src, col - 1))! }))
          .sort((a, b) => a.y - b.y || a.i - b.i);
        const k = ins.length;
        ins.forEach((inp, p) => {
          const py = s.y - s.h / 2 + ((p + 1) * s.h) / (k + 1);
          edgesInto[col]!.push({ src: inp.src, fromKey: keyAt(inp.src, col - 1), toKey: s.key, port: p, toY: py });
        });
      } else {
        edgesInto[col]!.push({ src: s.src, fromKey: keyAt(s.src, col - 1), toKey: s.key, port: 0, toY: s.y });
      }
    }
  }
  // Columna final (salida).
  const outKey = keyAt(net.output, depth);
  const outY = ys.get(outKey)!;
  const gapChannels = (col: number) => {
    const bending = new Set(edgesInto[col]!.filter((e) => Math.abs(ys.get(e.fromKey)! - e.toY) > 0.5).map((e) => e.fromKey));
    return bending.size;
  };
  const colX: number[] = [G.pad + G.labelW];
  for (let col = 1; col <= depth; col++) {
    const gap = Math.max(G.minGap, (gapChannels(col) + 1) * G.channel);
    colX.push(colX[col - 1]! + colW[col - 1]! + gap);
  }
  const endX = colX[depth]! + colW[depth]!;

  const nodes: PlacedNode[] = [];
  const outX = new Map<string, number>();
  for (const s of columns[0]!) {
    nodes.push({ id: s.src, kind: isConstant(s.src) ? "const" : "input", x: colX[0]!, y: s.y });
    outX.set(s.key, colX[0]!);
  }
  const portsOf = new Map<string, number[]>();
  for (let col = 1; col <= depth; col++) {
    for (const s of columns[col]!) {
      if (!s.gate) {
        outX.set(s.key, colX[col]! + colW[col]!);
        continue;
      }
      const w = gateWidth(s.gate.type);
      const x = colX[col]! + (colW[col]! - w) / 2;
      outX.set(s.key, x + w);
      const ports = edgesInto[col]!.filter((e) => e.toKey === s.key).map((e) => e.toY);
      portsOf.set(s.key, ports);
      nodes.push({ id: s.gate.id, kind: "gate", type: s.gate.type, x, y: s.y, w, h: s.h, layer: col, ports });
    }
  }
  const gateNode = new Map(nodes.filter((n) => n.kind === "gate").map((n) => [n.id, n]));
  const inX = (key: string, col: number, y: number): number => {
    const n = gateNode.get(key);
    if (!n || n.kind !== "gate") return colX[col]!;
    return n.x + portX(n.type, n.h, y - n.y);
  };

  const wires: CircuitLayout["wires"] = [];
  const junctions: Array<[number, number]> = [];
  for (let col = 1; col <= depth; col++) {
    const edges = edgesInto[col]!;
    const gapStart = colX[col - 1]! + colW[col - 1]!;
    const gapEnd = colX[col]!;
    const bendingSources = [...new Set(edges.filter((e) => Math.abs(ys.get(e.fromKey)! - e.toY) > 0.5).map((e) => e.fromKey))].sort(
      (a, b) => ys.get(a)! - ys.get(b)!,
    );
    const channelX = new Map<string, number>();
    const step = (gapEnd - gapStart) / (bendingSources.length + 1);
    // Las señales que bajan usan los canales de la izquierda hacia la derecha en orden de altura.
    bendingSources.forEach((k, i) => channelX.set(k, gapStart + step * (i + 1)));
    const bySource = new Map<string, Edge[]>();
    for (const e of edges) bySource.set(e.fromKey, [...(bySource.get(e.fromKey) ?? []), e]);
    for (const [fromKey, es] of bySource) {
      const y0 = ys.get(fromKey)!;
      const x0 = outX.get(fromKey)!;
      const cx = channelX.get(fromKey) ?? gapStart + step;
      for (const e of es) {
        const x1 = inX(e.toKey, col, e.toY);
        const pts: Array<[number, number]> =
          Math.abs(e.toY - y0) <= 0.5 ? [[x0, y0], [x1, y0]] : [[x0, y0], [cx, y0], [cx, e.toY], [x1, e.toY]];
        // Un punto intermedio cruza su columna en horizontal.
        if (!gateNode.has(e.toKey)) pts.push([colX[col]! + colW[col]!, e.toY]);
        wires.push({ from: e.src, points: pts });
      }
      // Uniones: donde se juntan tres o más tramos en el canal.
      if (es.length >= 2) {
        const pys = [y0, ...es.map((e) => e.toY)];
        const lo = Math.min(...pys);
        const hi = Math.max(...pys);
        const seen = new Set<number>();
        for (const py of pys) {
          const r = Math.round(py * 10) / 10;
          if (seen.has(r)) continue;
          seen.add(r);
          const deg =
            (Math.abs(py - y0) <= 0.5 ? 1 : 0) +
            (es.some((e) => Math.abs(e.toY - py) <= 0.5) ? 1 : 0) +
            (py > lo + 0.5 ? 1 : 0) +
            (py < hi - 0.5 ? 1 : 0);
          if (deg >= 3) junctions.push([cx, py]);
        }
      }
    }
  }

  // Cable de salida.
  const fromX = outX.get(outKey)!;
  const output = { from: [fromX, outY] as [number, number], to: [endX + G.outLen, outY] as [number, number] };

  // Etiquetas A, B, C…: puertas que no son la salida, por columna y de arriba abajo.
  const labels: Record<string, string> = {};
  const order = nodes
    .filter((n) => n.kind === "gate" && n.id !== net.output)
    .sort((a, b) => (a.kind === "gate" && b.kind === "gate" ? a.layer - b.layer : 0) || a.y - b.y);
  order.forEach((n, i) => {
    labels[n.id] = wireLabel(i);
  });

  const height = Math.max(bottom + dy + G.pad, outY + G.pad);
  return { width: endX + G.outLen + G.pad + 12, height, nodes, wires, junctions, labels, output };
}

/** A, B, …, Z, A1, B1… (sin colisionar con las variables x, y, z, w, que van en minúscula). */
export const wireLabel = (i: number): string => `${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ""}`;
