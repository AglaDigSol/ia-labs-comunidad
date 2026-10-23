import { collectVars, type Node } from "./ast.ts";
import { MAX_VARIABLES, buildTable } from "./truth-table.ts";

export type CompareRow = { minterm: number; values: boolean[]; a: boolean; b: boolean; equal: boolean };
export type CompareResult =
  | {
      ok: true;
      vars: string[];
      onlyA: string[];
      onlyB: string[];
      rows: CompareRow[];
      differing: number;
      equivalent: boolean;
    }
  | { ok: false; code: "too-many-variables"; count: number };

const chunks = (s: string) => s.match(/\d+|\D+/g) ?? [];
function natural(a: string, b: string): number {
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

export function compareFormulas(a: Node, b: Node): CompareResult {
  const va = collectVars(a);
  const vb = collectVars(b);
  const vars = [...new Set([...va, ...vb])].sort(natural);
  if (vars.length > MAX_VARIABLES) return { ok: false, code: "too-many-variables", count: vars.length };
  const ta = buildTable(a, { vars });
  const tb = buildTable(b, { vars });
  if (!ta.ok || !tb.ok) return { ok: false, code: "too-many-variables", count: vars.length };
  const rows: CompareRow[] = ta.rows.map((r, i) => {
    const rb = tb.rows[i]!;
    return { minterm: r.minterm, values: r.values, a: r.result, b: rb.result, equal: r.result === rb.result };
  });
  const differing = rows.filter((r) => !r.equal).length;
  return {
    ok: true,
    vars,
    onlyA: vars.filter((v) => !vb.includes(v)),
    onlyB: vars.filter((v) => !va.includes(v)),
    rows,
    differing,
    equivalent: differing === 0,
  };
}
