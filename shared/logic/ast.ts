export type Node =
  | { kind: "var"; name: string }
  | { kind: "const"; value: boolean }
  | { kind: "not"; arg: Node }
  | { kind: "and" | "or" | "xor" | "imp" | "iff"; left: Node; right: Node };

const PREC: Record<Node["kind"], number> = {
  var: 100,
  const: 100,
  not: 60,
  and: 50,
  or: 40,
  xor: 30,
  imp: 20,
  iff: 10,
};
const RIGHT_ASSOC = new Set<Node["kind"]>(["imp", "iff"]);

const chunks = (s: string) => s.match(/\d+|\D+/g) ?? [];

function naturalCompare(a: string, b: string): number {
  const ca = chunks(a);
  const cb = chunks(b);
  for (let i = 0; i < Math.min(ca.length, cb.length); i++) {
    const x = ca[i]!;
    const y = cb[i]!;
    if (x === y) continue;
    if (/^\d/.test(x) && /^\d/.test(y)) {
      const d = Number(x) - Number(y);
      if (d !== 0) return d;
    }
    return x < y ? -1 : 1;
  }
  return ca.length - cb.length;
}

export function collectVars(node: Node): string[] {
  const set = new Set<string>();
  const walk = (n: Node) => {
    if (n.kind === "var") set.add(n.name);
    else if (n.kind === "not") walk(n.arg);
    else if (n.kind !== "const") {
      walk(n.left);
      walk(n.right);
    }
  };
  walk(node);
  return [...set].sort(naturalCompare);
}

const TEX_OP = {
  and: "\\land",
  or: "\\lor",
  xor: "\\veebar",
  imp: "\\to",
  iff: "\\leftrightarrow",
} as const;
const PLAIN_OP = { and: "∧", or: "∨", xor: "⊻", imp: "→", iff: "↔" } as const;

// Only names matching /^[A-Za-z][A-Za-z0-9_]*$/ ever reach TeX.
function varTex(name: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) return "\\square";
  const sub = /^([A-Za-z]+)_?(\d+)$/.exec(name);
  if (sub) return `${sub[1]!.length === 1 ? sub[1]! : `\\mathit{${sub[1]!}}`}_{${sub[2]!}}`;
  if (/^[A-Za-z]$/.test(name)) return name;
  return `\\mathit{${name.replace(/_/g, "\\_")}}`;
}

const isBinary = (n: Node) => n.kind !== "var" && n.kind !== "const" && n.kind !== "not";

// Paréntesis «de libro»: un operador binario dentro de otro binario distinto siempre va entre
// paréntesis, aunque la precedencia los haga innecesarios ((p → q) ↔ (q → p), (p ∧ q) ∨ r).
// Con el mismo operador se sigue la asociatividad y ¬ solo los pone cuando hacen falta.
function render(node: Node, tex: boolean): string {
  const wrap = (child: Node, parent: Node, side: "left" | "right" | "arg"): string => {
    const s = render(child, tex);
    if (isBinary(child) && isBinary(parent) && child.kind !== parent.kind) return `(${s})`;
    const pc = PREC[child.kind];
    const pp = PREC[parent.kind];
    let need = pc < pp;
    if (!need && pc === pp && parent.kind !== "not") {
      need = RIGHT_ASSOC.has(parent.kind) ? side === "left" : side === "right";
    }
    return need ? `(${s})` : s;
  };
  switch (node.kind) {
    case "var":
      return tex ? varTex(node.name) : node.name;
    case "const":
      return node.value ? "1" : "0";
    case "not": {
      const inner = wrap(node.arg, node, "arg");
      if (tex) return `\\lnot ${inner}`;
      return `¬${inner}`;
    }
    default: {
      const l = wrap(node.left, node, "left");
      const r = wrap(node.right, node, "right");
      return tex
        ? `${l} ${TEX_OP[node.kind]} ${r}`
        : `${l} ${PLAIN_OP[node.kind]} ${r}`;
    }
  }
}

export const toTex = (node: Node): string => render(node, true);
export const toPlain = (node: Node): string => render(node, false);

export function subformulas(node: Node): Node[] {
  const seen = new Set<string>();
  const out: Node[] = [];
  const walk = (n: Node) => {
    if (n.kind === "var" || n.kind === "const") return;
    if (n.kind === "not") walk(n.arg);
    else {
      walk(n.left);
      walk(n.right);
    }
    const key = toPlain(n);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(n);
    }
  };
  walk(node);
  return out;
}
