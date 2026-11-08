// Orden de complejidad (O grande) de costes «de tipo polinómico»: sumas, productos y potencias enteras
// de monomios en n, m o k, exponenciales bⁿ y logaritmos. El término dominante se calcula sin evaluar
// nada: cada monomio es, por variable, (base de la exponencial, grado, potencia del logaritmo), y uno
// domina a otro si lo hace en cada variable (primero la exponencial, luego el grado y luego el log).
// Con dos variables puede quedar más de un término: O(m² + n). Los coeficientes no importan; se supone
// que el término dominante no se cancela (n⁵ − n⁵ no es un coste razonable).
//
// También hay un analizador pequeño para escribir costes («(n^5 - 2n + 1)^2», «2^k + k^8 + 3»,
// «n log n»): sin eval, con una gramática de sumas, productos, potencias y paréntesis.

export const COST_VARS = ["n", "m", "k"] as const;
export type CostVar = (typeof COST_VARS)[number];

export type Cost =
  | { k: "num"; v: number }
  | { k: "var"; v: CostVar }
  | { k: "exp"; b: number; v: CostVar }
  | { k: "log"; v: CostVar }
  | { k: "add"; a: Cost[] }
  | { k: "mul"; a: Cost[] }
  | { k: "pow"; a: Cost; e: number };

/** Lo que aporta una variable a un monomio: bᵛ · vᵈ · logˡ v. */
export type Factor = { b: number; d: number; l: number };
/** Un monomio: el factor de cada variable que aparece (sin coeficiente). */
export type Mono = Partial<Record<CostVar, Factor>>;
/** Un orden: la suma de sus términos dominantes. [{}] es O(1). */
export type Growth = Mono[];

const ONE: Factor = { b: 1, d: 0, l: 0 };
const isOne = (f: Factor) => f.b === 1 && f.d === 0 && f.l === 0;

function cmpFactor(x: Factor, y: Factor): number {
  return x.b !== y.b ? Math.sign(x.b - y.b) : x.d !== y.d ? Math.sign(x.d - y.d) : Math.sign(x.l - y.l);
}

/** ¿x crece como mucho como y? (en todas sus variables). */
export function monoLE(x: Mono, y: Mono): boolean {
  return COST_VARS.every((v) => cmpFactor(x[v] ?? ONE, y[v] ?? ONE) <= 0);
}

function clean(m: Mono): Mono {
  const out: Mono = {};
  for (const v of COST_VARS) if (m[v] && !isOne(m[v])) out[v] = { ...m[v] };
  return out;
}

const monoKey = (m: Mono) => COST_VARS.map((v) => (m[v] ? `${v}:${m[v].b},${m[v].d},${m[v].l}` : "")).join("|");

/** Quita los términos dominados (y los repetidos) y los ordena: el resultado es canónico. */
export function prune(terms: Growth): Growth {
  const cleaned = terms.map(clean);
  const out: Growth = [];
  cleaned.forEach((t, i) => {
    const dominated = cleaned.some((u, j) => j !== i && monoLE(t, u) && (!monoLE(u, t) || j < i));
    if (!dominated) out.push(t);
  });
  return out.sort((a, b) => (monoKey(a) < monoKey(b) ? -1 : 1));
}

function mulMono(x: Mono, y: Mono): Mono {
  const out: Mono = {};
  for (const v of COST_VARS) {
    const a = x[v] ?? ONE;
    const c = y[v] ?? ONE;
    out[v] = { b: a.b * c.b, d: a.d + c.d, l: a.l + c.l };
  }
  return clean(out);
}

function mulGrowth(x: Growth, y: Growth): Growth {
  return prune(x.flatMap((a) => y.map((b) => mulMono(a, b))));
}

/** El orden de un coste: sus términos dominantes. Un coste nulo da [] (no debería pasar). */
export function growthOf(c: Cost): Growth {
  switch (c.k) {
    case "num":
      return c.v === 0 ? [] : [{}];
    case "var":
      return [{ [c.v]: { b: 1, d: 1, l: 0 } }];
    case "exp":
      return c.b === 1 ? [{}] : [{ [c.v]: { b: c.b, d: 0, l: 0 } }];
    case "log":
      return [{ [c.v]: { b: 1, d: 0, l: 1 } }];
    case "add":
      return prune(c.a.flatMap(growthOf));
    case "mul":
      return c.a.reduce<Growth>((acc, x) => mulGrowth(acc, growthOf(x)), [{}]);
    case "pow": {
      let acc: Growth = [{}];
      const base = growthOf(c.a);
      for (let i = 0; i < c.e; i++) acc = mulGrowth(acc, base);
      return acc;
    }
  }
}

/** ¿Dos órdenes son el mismo? */
export const sameGrowth = (x: Growth, y: Growth): boolean => {
  const a = prune(x).map(monoKey);
  const b = prune(y).map(monoKey);
  return a.length === b.length && a.every((k, i) => k === b[i]);
};

/** Sustituye una variable por otra (c(k) llamado con k = n). */
export function substituteCost(c: Cost, from: CostVar, to: CostVar): Cost {
  switch (c.k) {
    case "num":
      return c;
    case "var":
      return c.v === from ? { k: "var", v: to } : c;
    case "exp":
      return c.v === from ? { ...c, v: to } : c;
    case "log":
      return c.v === from ? { k: "log", v: to } : c;
    case "add":
    case "mul":
      return { k: c.k, a: c.a.map((x) => substituteCost(x, from, to)) };
    case "pow":
      return { k: "pow", a: substituteCost(c.a, from, to), e: c.e };
  }
}

// ---------------------------------------------------------------- Escritura

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", n: "ⁿ", m: "ᵐ", k: "ᵏ" };
const sup = (s: string) => [...s].map((ch) => SUP[ch] ?? ch).join("");

/** Un monomio en TeX y en texto, en el orden m, n, k (como «m·n»). */
const VAR_ORDER: CostVar[] = ["m", "n", "k"];

function monoParts(m: Mono): Array<{ tex: string; text: string }> {
  const parts: Array<{ tex: string; text: string }> = [];
  for (const v of VAR_ORDER) {
    const f = m[v];
    if (!f) continue;
    if (f.d !== 0) parts.push({ tex: f.d === 1 ? v : `${v}^{${f.d}}`, text: f.d === 1 ? v : `${v}${sup(String(f.d))}` });
    if (f.l !== 0) parts.push({ tex: f.l === 1 ? `\\log ${v}` : `\\log^{${f.l}} ${v}`, text: f.l === 1 ? `log ${v}` : `log${sup(String(f.l))} ${v}` });
    if (f.b !== 1) parts.push({ tex: `${f.b}^{${v}}`, text: `${f.b}${sup(v)}` });
  }
  return parts;
}

/** Término principal primero (el de mayor crecimiento en n, luego m). */
function displayOrder(g: Growth): Growth {
  return [...g].sort((a, b) => {
    for (const v of ["n", "m", "k"] as const) {
      const c = cmpFactor(b[v] ?? ONE, a[v] ?? ONE);
      if (c !== 0) return c;
    }
    return 0;
  });
}

/** «n \cdot 2^{n}», «m n», «1». */
export function growthTex(g: Growth): string {
  const terms = displayOrder(prune(g)).map((m) => {
    const p = monoParts(m);
    if (p.length === 0) return "1";
    // m·n se escribe «mn»; con exponenciales o logaritmos, con punto.
    const plain = p.every((x) => /^[a-z](\^\{\d+\})?$/.test(x.tex));
    return p.map((x) => x.tex).join(plain ? " " : " \\cdot ");
  });
  return terms.length === 0 ? "0" : terms.join(" + ");
}

/** «n·2ⁿ», «m·n», «1» (texto plano, para listas y lectores de pantalla). */
export function growthText(g: Growth): string {
  const terms = displayOrder(prune(g)).map((m) => {
    const p = monoParts(m);
    return p.length === 0 ? "1" : p.map((x) => x.text).join("·");
  });
  return terms.length === 0 ? "0" : terms.join(" + ");
}

export const bigOTex = (g: Growth) => `O\\left(${growthTex(g)}\\right)`;
export const bigOText = (g: Growth) => `O(${growthText(g)})`;

const numTex = (v: number) => (v < 0 ? `-${-v}` : String(v));

/** Un coste en TeX, tal como se escribió (sin simplificar). */
export function costTex(c: Cost, parent: "add" | "mul" | "pow" | null = null): string {
  switch (c.k) {
    case "num":
      return numTex(c.v);
    case "var":
      return c.v;
    case "exp":
      return `${c.b}^{${c.v}}`;
    case "log":
      return `\\log ${c.v}`;
    case "add": {
      let out = "";
      c.a.forEach((t, i) => {
        const neg = negativeTerm(t);
        const body = costTex(neg ? negate(t) : t, "add");
        out += i === 0 ? (neg ? `-${body}` : body) : neg ? ` - ${body}` : ` + ${body}`;
      });
      return parent === "mul" || parent === "pow" ? `\\left(${out}\\right)` : out;
    }
    case "mul": {
      const parts = c.a.map((x) => costTex(x, "mul"));
      const out = parts.reduce((acc, p, i) => {
        if (i === 0) return p;
        const prev = c.a[i - 1]!;
        // 3n, 2n^2: número delante sin punto; entre letras, espacio; antes de un número o una potencia de número, punto.
        const dot = c.a[i]!.k === "num" || c.a[i]!.k === "exp" || prev.k === "exp" || (prev.k === "log" && c.a[i]!.k !== "add");
        return `${acc}${dot ? " \\cdot " : prev.k === "num" ? "" : " "}${p}`;
      }, "");
      return parent === "pow" ? `\\left(${out}\\right)` : out;
    }
    case "pow": {
      const base = c.a.k === "var" || c.a.k === "num" ? costTex(c.a) : c.a.k === "log" ? `\\left(${costTex(c.a)}\\right)` : costTex(c.a, "pow");
      return `${base}^{${c.e}}`;
    }
  }
}

function negativeTerm(c: Cost): boolean {
  if (c.k === "num") return c.v < 0;
  if (c.k === "mul") return c.a[0]?.k === "num" && c.a[0].v < 0;
  return false;
}
function negate(c: Cost): Cost {
  if (c.k === "num") return { k: "num", v: -c.v };
  if (c.k === "mul" && c.a[0]?.k === "num") {
    const rest = c.a.slice(1);
    const v = -c.a[0].v;
    if (v === 1) return rest.length === 1 ? rest[0]! : { k: "mul", a: rest };
    return { k: "mul", a: [{ k: "num", v }, ...rest] };
  }
  return c;
}

const SPOKEN_POW: Record<number, string> = { 2: "al cuadrado", 3: "al cubo" };

/** Lectura para lectores de pantalla: «n elevado a 5 menos 2 n más 1, todo al cuadrado». */
export function costSpoken(c: Cost): string {
  switch (c.k) {
    case "num":
      return c.v < 0 ? `menos ${-c.v}` : String(c.v);
    case "var":
      return c.v;
    case "exp":
      return `${c.b} elevado a ${c.v}`;
    case "log":
      return `logaritmo de ${c.v}`;
    case "add":
      return c.a
        .map((t, i) => {
          const neg = negativeTerm(t);
          const body = costSpoken(neg ? negate(t) : t);
          return i === 0 ? (neg ? `menos ${body}` : body) : neg ? `menos ${body}` : `más ${body}`;
        })
        .join(" ");
    case "mul":
      return c.a.map((x) => (x.k === "add" ? `(${costSpoken(x)})` : costSpoken(x))).join(" por ");
    case "pow": {
      const base = c.a.k === "add" || c.a.k === "mul" ? `(${costSpoken(c.a)}), todo` : costSpoken(c.a);
      return `${base} ${SPOKEN_POW[c.e] ?? `elevado a ${c.e}`}`;
    }
  }
}

// ---------------------------------------------------------------- Analizador

export type CostParse = { ok: true; cost: Cost } | { ok: false; error: string };

export const MAX_COST_TEXT = 120;
export const HOW_TO_WRITE_COST =
  "Sumas y restas, productos (3n, n·m, n*m), potencias con ^ y exponente entero (n^2, 2^n), log(n) o log n, y paréntesis. Variables: n, m y k.";

type Tok = { t: "num"; v: number } | { t: "var"; v: CostVar } | { t: "log" } | { t: "op"; v: "+" | "-" | "*" | "^" | "(" | ")" };

function tokenize(s: string): Tok[] | string {
  const out: Tok[] = [];
  const text = s.replace(/[−–]/g, "-").replace(/[·×⋅]/g, "*").replace(/\*\*/g, "^");
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (/\s/.test(ch)) {
      i++;
    } else if (/\d/.test(ch)) {
      let j = i;
      while (j < text.length && /\d/.test(text[j]!)) j++;
      out.push({ t: "num", v: Number(text.slice(i, j)) });
      i = j;
    } else if (text.startsWith("log", i)) {
      out.push({ t: "log" });
      i += 3;
    } else if (ch === "n" || ch === "m" || ch === "k") {
      out.push({ t: "var", v: ch });
      i++;
    } else if ("+-*^()".includes(ch)) {
      out.push({ t: "op", v: ch as "+" });
      i++;
    } else if (SUP_DIGIT[ch] !== undefined || ch === "ⁿ" || ch === "ᵐ" || ch === "ᵏ") {
      // Superíndices: n⁵, 2ⁿ.
      let j = i;
      let e = "";
      while (j < text.length && (SUP_DIGIT[text[j]!] !== undefined || "ⁿᵐᵏ".includes(text[j]!))) {
        const c = text[j]!;
        e += SUP_DIGIT[c] ?? (c === "ⁿ" ? "n" : c === "ᵐ" ? "m" : "k");
        j++;
      }
      out.push({ t: "op", v: "^" });
      if (/^\d+$/.test(e)) out.push({ t: "num", v: Number(e) });
      else if (e.length === 1) out.push({ t: "var", v: e as CostVar });
      else return `No entiendo el exponente «${text.slice(i, j)}».`;
      i = j;
    } else {
      return `No entiendo «${ch}». ${HOW_TO_WRITE_COST}`;
    }
  }
  return out;
}

const SUP_DIGIT: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };

/** Lee un coste escrito («(n^5 - 2n + 1)^2»). */
export function parseCost(text: string, vars: readonly CostVar[] = COST_VARS): CostParse {
  if (text.trim() === "") return { ok: false, error: "Escribe un coste." };
  if (text.length > MAX_COST_TEXT) return { ok: false, error: "El coste es demasiado largo." };
  const toks = tokenize(text);
  if (typeof toks === "string") return { ok: false, error: toks };
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => {
    const t = peek();
    return t?.t === "op" && t.v === v;
  };
  const fail = (msg: string): never => {
    throw new SyntaxError(msg);
  };

  const sum = (): Cost => {
    const terms: Cost[] = [];
    let sign = 1;
    if (isOp("-")) {
      p++;
      sign = -1;
    } else if (isOp("+")) p++;
    terms.push(signed(product(), sign));
    while (isOp("+") || isOp("-")) {
      const s = isOp("-") ? -1 : 1;
      p++;
      terms.push(signed(product(), s));
    }
    return terms.length === 1 ? terms[0]! : { k: "add", a: terms };
  };
  const signed = (c: Cost, s: number): Cost => {
    if (s === 1) return c;
    if (c.k === "num") return { k: "num", v: -c.v };
    if (c.k === "mul" && c.a[0]?.k === "num") return { k: "mul", a: [{ k: "num", v: -c.a[0].v }, ...c.a.slice(1)] };
    return { k: "mul", a: [{ k: "num", v: -1 }, c] };
  };
  const startsFactor = () => {
    const t = peek();
    return t !== undefined && (t.t === "num" || t.t === "var" || t.t === "log" || (t.t === "op" && t.v === "("));
  };
  const product = (): Cost => {
    const fs: Cost[] = [power()];
    for (;;) {
      if (isOp("*")) {
        p++;
        fs.push(power());
      } else if (startsFactor()) fs.push(power());
      else break;
    }
    return fs.length === 1 ? fs[0]! : { k: "mul", a: fs };
  };
  const power = (): Cost => {
    const base = atom();
    if (!isOp("^")) return base;
    p++;
    const t = peek();
    if (t?.t === "num") {
      p++;
      if (base.k === "num") {
        if (base.v < 2) fail("La base de una exponencial tiene que ser un entero mayor que 1.");
        // 2^3 es un número.
        return { k: "num", v: base.v ** t.v };
      }
      if (t.v > 50) fail("El exponente es demasiado grande.");
      return { k: "pow", a: base, e: t.v };
    }
    if (t?.t === "var") {
      p++;
      if (base.k !== "num" || base.v < 2 || base.v > 100) return fail("Una exponencial se escribe con una base entera mayor que 1: 2^n, 3^n.");
      return { k: "exp", b: base.v, v: t.v };
    }
    return fail("Detrás de ^ va un número entero o una variable.");
  };
  const atom = (): Cost => {
    const t = peek();
    if (!t) return fail("Falta algo al final.");
    if (t.t === "num") {
      p++;
      return { k: "num", v: t.v };
    }
    if (t.t === "var") {
      if (!vars.includes(t.v)) fail(`Aquí la variable ${t.v} no vale (usa ${vars.join(", ")}).`);
      p++;
      return { k: "var", v: t.v };
    }
    if (t.t === "log") {
      p++;
      const paren = isOp("(");
      if (paren) p++;
      const v = peek();
      if (v?.t !== "var" || !vars.includes(v.v)) return fail("El logaritmo se escribe log(n).");
      p++;
      if (paren) {
        if (!isOp(")")) fail("Falta cerrar el paréntesis del logaritmo.");
        p++;
      }
      return { k: "log", v: v.v };
    }
    if (t.v === "(") {
      p++;
      const inner = sum();
      if (!isOp(")")) fail("Falta un paréntesis de cierre.");
      p++;
      return inner;
    }
    return fail(`Sobra «${t.v}».`);
  };

  try {
    const cost = sum();
    if (p < toks.length) return { ok: false, error: "Sobra algo al final (¿falta un operador o un paréntesis?)." };
    if (growthOf(cost).length === 0) return { ok: false, error: "Ese coste vale 0." };
    return { ok: true, cost };
  } catch (e) {
    return { ok: false, error: e instanceof SyntaxError ? e.message : "No se puede leer el coste." };
  }
}

/** Lee un coste del contenido o de un generador (si falla, es un error de programación). */
export function costOf(text: string, vars?: readonly CostVar[]): Cost {
  const r = parseCost(text, vars);
  if (!r.ok) throw new Error(`coste ilegible: ${text} (${r.error})`);
  return r.cost;
}

// ---------------------------------------------------------------- Opciones de examen

/**
 * Una opción tipo examen: un orden O(·) (con una constante dentro si es la trampa «O(10n⁸)») o
 * «Ninguna de las otras».
 */
export type BigOOption = { growth: Growth; coef?: number } | { none: true };

/** «O(10n⁸)»: la constante delante del término dominante. */
export const optionTex = (o: BigOOption): string =>
  "none" in o
    ? "\\text{Ninguna de las otras}"
    : o.coef && o.coef !== 1
      ? `O\\left(${o.coef}${/^\d/.test(growthTex(o.growth)) ? " \\cdot " : ""}${growthTex(o.growth)}\\right)`
      : bigOTex(o.growth);
export const optionText = (o: BigOOption): string =>
  "none" in o ? "Ninguna de las otras" : o.coef && o.coef !== 1 ? `O(${o.coef}${/^\d/.test(growthText(o.growth)) ? "·" : ""}${growthText(o.growth)})` : bigOText(o.growth);

/**
 * Órdenes equivocados verosímiles para un orden dado: grados uno arriba y uno abajo, el doble o la
 * mitad del grado (olvidar o aplicar mal una potencia), sumar en vez de multiplicar, perder o añadir el
 * logaritmo, quedarse solo con la exponencial o solo con el polinomio. Sin repetir y distintos del
 * correcto.
 */
export function distractors(correct: Growth): Growth[] {
  const g = prune(correct);
  const out: Growth[] = [];
  const add = (x: Growth) => {
    const p = prune(x);
    if (p.length === 0 || sameGrowth(p, g) || out.some((o) => sameGrowth(o, p))) return;
    out.push(p);
  };
  const mapFactors = (fn: (f: Factor, v: CostVar) => Factor | null) => {
    const r = g.map((m) => {
      const out2: Mono = {};
      for (const v of COST_VARS) {
        const f = m[v];
        if (!f) continue;
        const nf = fn(f, v);
        if (nf) out2[v] = nf;
      }
      return out2;
    });
    return r;
  };
  const main = g[0] ?? {};
  const mainVars = COST_VARS.filter((v) => main[v]);
  // Grado ± 1, doble y mitad.
  add(mapFactors((f) => (f.d > 0 ? { ...f, d: f.d + 1 } : f)));
  add(mapFactors((f) => (f.d > 1 ? { ...f, d: f.d - 1 } : f.d === 1 && (f.b > 1 || f.l > 0) ? { ...f, d: 0 } : f)));
  add(mapFactors((f) => (f.d > 1 ? { ...f, d: f.d * 2 } : f)));
  add(mapFactors((f) => (f.d > 1 && f.d % 2 === 0 ? { ...f, d: f.d / 2 } : f)));
  add(mapFactors((f) => (f.d >= 2 ? { ...f, d: f.d * f.d } : f)));
  // Producto de variables ↔ suma.
  if (mainVars.length >= 2) add(mainVars.map((v) => ({ [v]: main[v]! })));
  if (g.length >= 2) add([g.reduce((acc, m) => mulMono(acc, m), {} as Mono)]);
  // Exponencial: solo ella, sin ella, o con otra base.
  if (mainVars.some((v) => main[v]!.b > 1)) {
    add(mapFactors((f) => ({ b: f.b, d: 0, l: 0 })));
    add(mapFactors((f) => (f.b > 1 ? { b: 1, d: Math.max(f.d, 1) + 1, l: f.l } : f)));
    add(mapFactors((f) => (f.b > 1 ? { ...f, b: f.b * f.b } : f)));
  } else if (mainVars.length > 0) {
    add([{ [mainVars[0]!]: { b: 2, d: 0, l: 0 } }]);
  }
  // Logaritmo: quitarlo o ponerlo.
  add(mapFactors((f) => (f.l > 0 ? { ...f, l: 0 } : f)));
  if (mainVars.length > 0) add([{ ...main, [mainVars[0]!]: { ...main[mainVars[0]!]!, l: (main[mainVars[0]!]!.l ?? 0) + 1 } }]);
  // Lineal y constante como último recurso.
  add([{ n: { b: 1, d: 1, l: 0 } }]);
  add([{ n: { b: 1, d: 2, l: 0 } }]);
  add([{ n: { b: 1, d: 0, l: 1 } }]);
  add([{}]);
  add([{ n: { b: 1, d: 1, l: 1 } }]);
  add([{ n: { b: 2, d: 0, l: 0 } }]);
  return out;
}

/**
 * ¿La opción elegida es la correcta? Se pide el orden simplificado: una opción con una constante
 * dentro (O(10n⁸)) describe el mismo conjunto, pero no es la forma que se pide y cuenta como mal.
 * «Ninguna» es correcta si ninguna otra opción coincide.
 */
export function optionIsCorrect(options: readonly BigOOption[], index: number, correct: Growth): boolean {
  const o = options[index];
  if (!o) return false;
  const exact = (x: BigOOption) => "growth" in x && (x.coef ?? 1) === 1 && sameGrowth(x.growth, correct);
  if ("none" in o) return !options.some(exact);
  return exact(o);
}

/**
 * ¿x ∈ O(y)? Cada término dominante de x lo acota algún término de y. O(n²) ⊆ O(n⁹): por eso, si se
 * pregunta solo por «una cota O», un orden mayor también sería verdad; el ejercicio pide el orden
 * exacto (la cota ajustada).
 */
export const growthLE = (x: Growth, y: Growth): boolean => prune(x).every((a) => prune(y).some((b) => monoLE(a, b)));

/** ¿La opción es una cota superior verdadera pero no ajustada (O(n⁹) para un coste n⁸)? */
export const isLooseBound = (o: BigOOption, correct: Growth): boolean =>
  "growth" in o && !sameGrowth(o.growth, correct) && growthLE(correct, o.growth);

/** ¿Es la trampa de la constante (mismo orden, con un número dentro)? */
export const isConstantTrap = (o: BigOOption, correct: Growth): boolean => "growth" in o && (o.coef ?? 1) !== 1 && sameGrowth(o.growth, correct);
