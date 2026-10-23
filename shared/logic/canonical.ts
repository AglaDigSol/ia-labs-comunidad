import type { Table } from "./truth-table.ts";

export type FormStyle = "logica" | "boole";
export type Term = { index: number; bits: string; tex: string; plain: string };
export type Formatted = { tex: string; plain: string; compact: string; terms: Term[] };

export function canonicalForms(table: Pick<Table, "rows">): { minterms: number[]; maxterms: number[] } {
  const minterms: number[] = [];
  const maxterms: number[] = [];
  for (const r of table.rows) (r.result ? minterms : maxterms).push(r.minterm);
  minterms.sort((a, b) => a - b);
  maxterms.sort((a, b) => a - b);
  return { minterms, maxterms };
}

// Same whitelist and subscript rule as toTex in ast.ts.
function varTex(name: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) return "\\square";
  const sub = /^([A-Za-z]+)_?(\d+)$/.exec(name);
  if (sub) return `${sub[1]!.length === 1 ? sub[1]! : `\\mathit{${sub[1]!}}`}_{${sub[2]!}}`;
  if (/^[A-Za-z]$/.test(name)) return name;
  return `\\mathit{${name.replace(/_/g, "\\_")}}`;
}

function bitsOf(index: number, n: number): string {
  return Array.from({ length: n }, (_, j) => String((index >> (n - 1 - j)) & 1)).join("");
}

type Lit = { tex: string; plain: string };

function literal(name: string, negated: boolean, style: FormStyle): Lit {
  const t = varTex(name);
  if (!negated) return { tex: t, plain: name };
  return style === "logica"
    ? { tex: `\\lnot ${t}`, plain: `¬${name}` }
    : { tex: `\\overline{${t}}`, plain: `${name}′` };
}

function build(vars: string[], indices: number[], style: FormStyle, kind: "min" | "max"): Formatted {
  const n = vars.length;
  const label = kind === "min" ? "m" : "M";
  const compact = `\\${kind === "min" ? "sum" : "prod"} ${label}(${indices.join(",")})`;
  if (indices.length === 0) {
    const c = kind === "min" ? "0" : "1";
    return { tex: c, plain: c, compact, terms: [] };
  }
  const logica = style === "logica";
  // minterm: AND of literals; maxterm: OR of literals. Terms are joined by the dual operator.
  const innerPlain = kind === "min" ? (logica ? " ∧ " : "·") : logica ? " ∨ " : " + ";
  const innerTex = kind === "min" ? (logica ? " \\land " : " ") : logica ? " \\lor " : " + ";
  const outerPlain = kind === "min" ? (logica ? " ∨ " : " + ") : logica ? " ∧ " : "·";
  const outerTex = kind === "min" ? (logica ? " \\lor " : " + ") : logica ? " \\land " : " ";
  const terms: Term[] = indices.map((index) => {
    const bits = bitsOf(index, n);
    const lits = vars.map((v, j) => literal(v, kind === "min" ? bits[j] === "0" : bits[j] === "1", style));
    return {
      index,
      bits,
      tex: lits.map((l) => l.tex).join(innerTex),
      plain: lits.map((l) => l.plain).join(innerPlain),
    };
  });
  const paren = kind === "max";
  return {
    tex: terms.map((t) => (paren ? `\\left(${t.tex}\\right)` : t.tex)).join(outerTex),
    plain: terms.map((t) => (paren ? `(${t.plain})` : t.plain)).join(outerPlain),
    compact,
    terms,
  };
}

export const formatFND = (vars: string[], minterms: number[], style: FormStyle): Formatted =>
  build(vars, minterms, style, "min");

export const formatFNC = (vars: string[], maxterms: number[], style: FormStyle): Formatted =>
  build(vars, maxterms, style, "max");
