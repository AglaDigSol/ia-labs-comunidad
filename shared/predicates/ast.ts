// Fórmulas de la lógica de predicados de primer orden (sin igualdad ni funciones): predicados P(x),
// Q(x, y), términos (variables y constantes), ¬, ∧, ∨, →, ↔ y los cuantificadores ∀ y ∃.
//
// Convención de términos: las letras u–z (con subíndice numérico opcional: x1, y_2) son variables;
// el resto de nombres en minúscula (a, b, c…) y los numerales (1, 2, 3…) son constantes. Un término
// es una variable ligada si lo captura un cuantificador; si no, es libre (variables) o una constante.

export type PredTerm = { name: string };

export type PredFormula =
  | { kind: "pred"; name: string; args: PredTerm[] }
  | { kind: "not"; arg: PredFormula }
  | { kind: "and" | "or" | "imp" | "iff"; left: PredFormula; right: PredFormula }
  | { kind: "forall" | "exists"; variable: string; body: PredFormula };

export type PredBinaryKind = "and" | "or" | "imp" | "iff";
export type PredQuantifierKind = "forall" | "exists";

/** Nombres de variable: u–z con subíndice numérico opcional (x, y1, z_2). */
export const PRED_VARIABLE_RE = /^[u-z](?:_?\d+)?$/;
/** Nombres de predicado: empiezan por mayúscula (P, Q, R, Par, P1). */
export const PRED_NAME_RE = /^[A-Z][A-Za-z0-9_]*$/;
/** Nombres de constante: numerales o identificadores en minúscula que no son variables. */
export const PRED_CONSTANT_RE = /^(?:\d+|[a-z][A-Za-z0-9_]*)$/;

export const isVariableName = (name: string) => PRED_VARIABLE_RE.test(name);

export const isPredBinary = (f: PredFormula): f is Extract<PredFormula, { left: PredFormula }> =>
  f.kind === "and" || f.kind === "or" || f.kind === "imp" || f.kind === "iff";
export const isPredQuantifier = (f: PredFormula): f is Extract<PredFormula, { body: PredFormula }> =>
  f.kind === "forall" || f.kind === "exists";

// ---------------------------------------------------------------- Variables libres y ligadas

export type VariableAnalysis = {
  /** Variables con alguna aparición libre, en orden de aparición. */
  free: string[];
  /** Variables cuantificadas en algún sitio, en orden de aparición. */
  bound: string[];
  /** Constantes (términos que no son variables), en orden de aparición. */
  constants: string[];
  /** Cuantificadores cuya variable no aparece en su alcance (∀x P(y)): no son errores, pero suelen serlo. */
  vacuous: string[];
};

export function analyzeVariables(f: PredFormula): VariableAnalysis {
  const free: string[] = [];
  const bound: string[] = [];
  const constants: string[] = [];
  const vacuous: string[] = [];
  const add = (list: string[], x: string) => {
    if (!list.includes(x)) list.push(x);
  };
  const walk = (g: PredFormula, scope: string[]): void => {
    switch (g.kind) {
      case "pred":
        for (const t of g.args) {
          if (scope.includes(t.name)) continue;
          if (isVariableName(t.name)) add(free, t.name);
          else add(constants, t.name);
        }
        return;
      case "not":
        return walk(g.arg, scope);
      case "forall":
      case "exists":
        add(bound, g.variable);
        if (!occursFree(g.body, g.variable)) add(vacuous, g.variable);
        return walk(g.body, [...scope, g.variable]);
      default:
        walk(g.left, scope);
        walk(g.right, scope);
    }
  };
  walk(f, []);
  return { free, bound, constants, vacuous };
}

export const freeVariables = (f: PredFormula): string[] => analyzeVariables(f).free;

/** ¿Aparece x libre en f? */
export function occursFree(f: PredFormula, x: string): boolean {
  switch (f.kind) {
    case "pred":
      return f.args.some((t) => t.name === x);
    case "not":
      return occursFree(f.arg, x);
    case "forall":
    case "exists":
      return f.variable !== x && occursFree(f.body, x);
    default:
      return occursFree(f.left, x) || occursFree(f.right, x);
  }
}

/** Sustituye las apariciones libres de la variable x por el término `name` (una constante). */
export function substitute(f: PredFormula, x: string, name: string): PredFormula {
  switch (f.kind) {
    case "pred":
      return { kind: "pred", name: f.name, args: f.args.map((t) => (t.name === x ? { name } : t)) };
    case "not":
      return { kind: "not", arg: substitute(f.arg, x, name) };
    case "forall":
    case "exists":
      return f.variable === x ? f : { kind: f.kind, variable: f.variable, body: substitute(f.body, x, name) };
    default:
      return { kind: f.kind, left: substitute(f.left, x, name), right: substitute(f.right, x, name) };
  }
}

export type SignatureResult =
  | { ok: true; predicates: Array<{ name: string; arity: number }> }
  | { ok: false; name: string; arities: number[] };

/** Predicados de la fórmula con su número de argumentos. Falla si un predicado aparece con dos aridades. */
export function predicateSignature(...formulas: PredFormula[]): SignatureResult {
  const seen = new Map<string, Set<number>>();
  const order: string[] = [];
  const walk = (g: PredFormula): void => {
    if (g.kind === "pred") {
      if (!seen.has(g.name)) {
        seen.set(g.name, new Set());
        order.push(g.name);
      }
      seen.get(g.name)!.add(g.args.length);
    } else if (g.kind === "not") walk(g.arg);
    else if (isPredQuantifier(g)) walk(g.body);
    else {
      walk(g.left);
      walk(g.right);
    }
  };
  formulas.forEach(walk);
  for (const name of order) {
    const a = seen.get(name)!;
    if (a.size > 1) return { ok: false, name, arities: [...a].sort((x, y) => x - y) };
  }
  return { ok: true, predicates: order.map((name) => ({ name, arity: [...seen.get(name)!][0]! })) };
}

/** Forma normal negativa: ¬ solo delante de fórmulas atómicas. */
export function isNegationNormalForm(f: PredFormula): boolean {
  switch (f.kind) {
    case "pred":
      return true;
    case "not":
      return f.arg.kind === "pred";
    case "forall":
    case "exists":
      return isNegationNormalForm(f.body);
    default:
      return isNegationNormalForm(f.left) && isNegationNormalForm(f.right);
  }
}

/**
 * Clave estructural módulo renombrado de variables ligadas (∀x P(x) y ∀y P(y) dan la misma clave):
 * cada variable ligada se sustituye por su profundidad de cuantificación.
 */
export function predKey(f: PredFormula): string {
  const walk = (g: PredFormula, scope: string[]): string => {
    switch (g.kind) {
      case "pred":
        return `${g.name}(${g.args
          .map((t) => {
            const i = scope.lastIndexOf(t.name);
            return i >= 0 ? `#${i}` : t.name;
          })
          .join(",")})`;
      case "not":
        return `¬${walk(g.arg, scope)}`;
      case "forall":
      case "exists":
        return `${g.kind === "forall" ? "∀" : "∃"}[${walk(g.body, [...scope, g.variable])}]`;
      default:
        return `${g.kind}[${walk(g.left, scope)};${walk(g.right, scope)}]`;
    }
  };
  return walk(f, []);
}

// ---------------------------------------------------------------- Escritura de libro

// Misma precedencia que en lógica proposicional: ¬ y los cuantificadores ligan más que ∧, ∧ más que
// ∨, ∨ más que → y → más que ↔ (→ y ↔ asocian por la derecha).
const PREC: Record<PredFormula["kind"], number> = {
  pred: 100,
  not: 60,
  forall: 60,
  exists: 60,
  and: 50,
  or: 40,
  imp: 20,
  iff: 10,
};
const RIGHT_ASSOC = new Set<PredFormula["kind"]>(["imp", "iff"]);

const PLAIN_OP = { and: "∧", or: "∨", imp: "→", iff: "↔" } as const;
const TEX_OP = { and: "\\land", or: "\\lor", imp: "\\to", iff: "\\leftrightarrow" } as const;

// Solo llegan a TeX nombres que cumplen estas expresiones; cualquier otra cosa se pinta como □.
function nameTex(name: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_]*$/.test(name)) return "\\square";
  if (/^\d+$/.test(name)) return name;
  const sub = /^([A-Za-z]+)_?(\d+)$/.exec(name);
  if (sub) return `${sub[1]!.length === 1 ? sub[1]! : `\\mathit{${sub[1]!}}`}_{${sub[2]!}}`;
  if (/^[A-Za-z]$/.test(name)) return name;
  return `\\mathit{${name.replace(/_/g, "\\_")}}`;
}

// ¿Empieza la escritura de f por un cuantificador (directamente o tras ¬)? Si es el operando izquierdo
// de un binario se pone entre paréntesis para que no se lea un alcance mayor: (∀x P(x)) ∧ Q(a).
const startsWithQuantifier = (f: PredFormula): boolean =>
  isPredQuantifier(f) || (f.kind === "not" && startsWithQuantifier(f.arg));

// Paréntesis «de libro» (los mismos que en lógica proposicional desde 0.6.0): un binario dentro de
// otro binario distinto siempre va entre paréntesis; con el mismo operador manda la asociatividad, y
// el cuerpo de ¬ o de un cuantificador solo lleva paréntesis si es un binario.
function render(f: PredFormula, tex: boolean): string {
  const wrap = (child: PredFormula, parent: PredFormula, side: "left" | "right" | "arg"): string => {
    const s = render(child, tex);
    if (isPredBinary(child) && isPredBinary(parent) && child.kind !== parent.kind) return `(${s})`;
    if (isPredBinary(parent) && side === "left" && startsWithQuantifier(child)) return `(${s})`;
    const pc = PREC[child.kind];
    const pp = PREC[parent.kind];
    let need = pc < pp;
    if (!need && pc === pp && isPredBinary(parent)) {
      need = RIGHT_ASSOC.has(parent.kind) ? side === "left" : side === "right";
    }
    return need ? `(${s})` : s;
  };
  switch (f.kind) {
    case "pred": {
      const args = f.args.map((t) => (tex ? nameTex(t.name) : t.name)).join(", ");
      return `${tex ? nameTex(f.name) : f.name}(${args})`;
    }
    case "not": {
      const inner = wrap(f.arg, f, "arg");
      return tex ? `\\lnot ${inner}` : `¬${inner}`;
    }
    case "forall":
    case "exists": {
      const inner = wrap(f.body, f, "arg");
      if (tex) return `${f.kind === "forall" ? "\\forall" : "\\exists"} ${nameTex(f.variable)}\\, ${inner}`;
      return `${f.kind === "forall" ? "∀" : "∃"}${f.variable} ${inner}`;
    }
    default: {
      const l = wrap(f.left, f, "left");
      const r = wrap(f.right, f, "right");
      return tex ? `${l} ${TEX_OP[f.kind]} ${r}` : `${l} ${PLAIN_OP[f.kind]} ${r}`;
    }
  }
}

/** Escritura en texto plano con símbolos (∀x (P(x) → Q(x))). El analizador la vuelve a leer igual. */
export const predToPlain = (f: PredFormula): string => render(f, false);
/** Escritura en TeX para KaTeX (solo nombres validados; nunca texto del usuario sin filtrar). */
export const predToTex = (f: PredFormula): string => render(f, true);
