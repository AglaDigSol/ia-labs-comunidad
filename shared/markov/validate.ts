import { cmp, formatDecimal, ONE, sign, sub, sum, ZERO, type Frac } from "../rational.ts";
import type { Mat, Vec } from "./matrix.ts";

export type Issue =
  | { kind: "not-square"; rows: number; cols: number }
  | { kind: "negative"; row: number; col: number; value: Frac }
  | { kind: "above-one"; row: number; col: number; value: Frac }
  | { kind: "row-sum"; row: number; sum: Frac; diff: Frac };

export function validateStochastic(P: Mat): { ok: boolean; issues: Issue[]; rowSums: Frac[] } {
  const issues: Issue[] = [];
  const rows = P.length;
  const cols = P.reduce((m, r) => Math.max(m, r.length), 0);
  const square = rows > 0 && P.every((r) => r.length === rows);
  if (!square) issues.push({ kind: "not-square", rows, cols });
  const rowSums: Frac[] = [];
  P.forEach((row, i) => {
    row.forEach((value, j) => {
      if (sign(value) < 0) issues.push({ kind: "negative", row: i, col: j, value });
      else if (cmp(value, ONE) > 0) issues.push({ kind: "above-one", row: i, col: j, value });
    });
    const s = sum(row);
    rowSums.push(s);
    if (cmp(s, ONE) !== 0) issues.push({ kind: "row-sum", row: i, sum: s, diff: sub(s, ONE) });
  });
  return { ok: issues.length === 0, issues, rowSums };
}

export function validateDistribution(v: Vec): { ok: boolean; sum: Frac; negatives: number[] } {
  const s = sum(v);
  const negatives: number[] = [];
  v.forEach((x, i) => {
    if (sign(x) < 0) negatives.push(i);
  });
  return { ok: negatives.length === 0 && cmp(s, ONE) === 0 && v.length > 0, sum: s, negatives };
}

function num(x: Frac): string {
  const f = formatDecimal(x, 6);
  return f.exact ? f.text : `≈ ${f.text}`;
}

export function describeIssue(issue: Issue, stateNames: string[]): string {
  switch (issue.kind) {
    case "not-square":
      return `La matriz debe ser cuadrada: tiene ${issue.rows} filas y ${issue.cols} columnas.`;
    case "negative":
      return `La entrada P(${issue.row + 1},${issue.col + 1}) = ${num(issue.value)} es negativa. Una probabilidad no puede ser menor que 0.`;
    case "above-one":
      return `La entrada P(${issue.row + 1},${issue.col + 1}) = ${num(issue.value)} es mayor que 1. Una probabilidad no puede superar 1.`;
    case "row-sum": {
      const name = stateNames[issue.row] || `Estado ${issue.row + 1}`;
      const base = `La fila ${name} suma ${num(issue.sum)}, no 1.`;
      const below = sign(issue.diff) < 0;
      const abs = below ? sub(ZERO, issue.diff) : issue.diff;
      return below ? `${base} Faltan ${num(abs)} para llegar a 1.` : `${base} Sobran ${num(abs)}.`;
    }
  }
}
