import { collectVars, subformulas, type Node } from "./ast.ts";

export const MAX_VARIABLES = 6;

export function evaluate(node: Node, env: Record<string, boolean>): boolean {
  switch (node.kind) {
    case "var":
      return env[node.name] ?? false;
    case "const":
      return node.value;
    case "not":
      return !evaluate(node.arg, env);
    case "and":
      return evaluate(node.left, env) && evaluate(node.right, env);
    case "or":
      return evaluate(node.left, env) || evaluate(node.right, env);
    case "xor":
      return evaluate(node.left, env) !== evaluate(node.right, env);
    case "imp":
      return !evaluate(node.left, env) || evaluate(node.right, env);
    case "iff":
      return evaluate(node.left, env) === evaluate(node.right, env);
  }
}

type Fn = (v: boolean[]) => boolean;

function compile(node: Node, index: Map<string, number>): Fn {
  switch (node.kind) {
    case "var": {
      const i = index.get(node.name) ?? -1;
      return (v) => (i >= 0 ? v[i]! : false);
    }
    case "const": {
      const c = node.value;
      return () => c;
    }
    case "not": {
      const a = compile(node.arg, index);
      return (v) => !a(v);
    }
    default: {
      const l = compile(node.left, index);
      const r = compile(node.right, index);
      switch (node.kind) {
        case "and":
          return (v) => l(v) && r(v);
        case "or":
          return (v) => l(v) || r(v);
        case "xor":
          return (v) => l(v) !== r(v);
        case "imp":
          return (v) => !l(v) || r(v);
        case "iff":
          return (v) => l(v) === r(v);
      }
    }
  }
}

export type TableRow = { minterm: number; values: boolean[]; sub: boolean[]; result: boolean };
export type Table = { ok: true; vars: string[]; subformulas: Node[]; rows: TableRow[] };

export function buildTable(
  node: Node,
  opts: { order?: "true-first" | "false-first"; vars?: string[] } = {},
): Table | { ok: false; code: "too-many-variables"; count: number } {
  const vars = opts.vars ?? collectVars(node);
  const n = vars.length;
  if (n > MAX_VARIABLES) return { ok: false, code: "too-many-variables", count: n };
  const index = new Map(vars.map((v, i) => [v, i]));
  const subs = subformulas(node);
  const subFns = subs.map((s) => compile(s, index));
  const root = compile(node, index);
  const total = 2 ** n;
  const trueFirst = (opts.order ?? "true-first") === "true-first";
  const rows: TableRow[] = [];
  for (let k = 0; k < total; k++) {
    const minterm = trueFirst ? total - 1 - k : k;
    const values = vars.map((_, i) => ((minterm >> (n - 1 - i)) & 1) === 1);
    rows.push({ minterm, values, sub: subFns.map((f) => f(values)), result: root(values) });
  }
  return { ok: true, vars, subformulas: subs, rows };
}

export function classify(rows: TableRow[]): {
  kind: "tautologia" | "contradiccion" | "contingencia";
  trueCount: number;
  total: number;
} {
  const total = rows.length;
  const trueCount = rows.filter((r) => r.result).length;
  const kind = trueCount === total ? "tautologia" : trueCount === 0 ? "contradiccion" : "contingencia";
  return { kind, trueCount, total };
}
