// «Redondeado a n decimales» tiene que notarse: la referencia sin round (ni .round) falla al menos un
// caso. Si no, el enunciado pide algo que nadie comprueba (el revisor: py-funciones medio s=51hjvz,
// la media sin redondear pasaba; py-pandas-agrupar s=abc1, total_por_local sin .round(2)).
import { describe, expect, it } from "vitest";
import { makeCodeTemplate, PY_CODE_TEMPLATES, PY_CODE_TYPES, type PyCodeInstance } from "../shared/exercises/python.ts";
import { seedFromText } from "../shared/exercises/random.ts";
import { EXERCISE_LEVELS } from "../shared/exercises/types.ts";
import { allPassed, caseFiles, checkPayload, HARNESS_PY, parseCheckResult } from "../src/features/labs/exercises/python/harness.ts";
import { hasPandas, hasPlots, hasPython3, runJobs } from "./system-python.ts";

/** Cierre del paréntesis que abre en `open`. */
function closing(code: string, open: number): number {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === "(") depth++;
    else if (code[i] === ")" && --depth === 0) return i;
  }
  return -1;
}

/** La última coma de primer nivel dentro de (…), o -1. */
function lastTopComma(inner: string): number {
  let depth = 0;
  let at = -1;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]!;
    if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    else if (ch === "," && depth === 0) at = i;
  }
  return at;
}

/** El código sin redondeos: round(x, 2) y np.round(x, 2) → (x); .round(2) desaparece. */
export function unround(code: string): string {
  for (let guard = 0; guard < 50; guard++) {
    const m = /(np\.)?round\(|\.round\(/.exec(code);
    if (!m) return code;
    const open = m.index + m[0].length - 1;
    const end = closing(code, open);
    if (end < 0) return code;
    if (m[0] === ".round(") {
      code = code.slice(0, m.index) + code.slice(end + 1);
      continue;
    }
    const inner = code.slice(open + 1, end);
    const comma = lastTopComma(inner);
    code = `${code.slice(0, m.index)}(${comma < 0 ? inner : inner.slice(0, comma)})${code.slice(end + 1)}`;
  }
  return code;
}

function runnable(inst: PyCodeInstance): boolean {
  const p = inst.packages ?? [];
  if (p.some((m) => m.startsWith("matplotlib") || m === "seaborn")) return hasPlots;
  if (p.length > 0) return hasPandas;
  return hasPython3;
}

// Sin las que formatean con :.2f (el formato ya redondea: quitar round no cambia el texto).
const asksRounding = (inst: PyCodeInstance) => /redonde/i.test(inst.statement.join(" ")) && !/sin redondear/i.test(inst.statement.join(" ")) && !/:\.\d+f\}/.test(inst.solution);

describe("unround", () => {
  it("quita los redondeos", () => {
    expect(unround("return round(sum(v) / len(v), 2)")).toBe("return (sum(v) / len(v))");
    expect(unround("return df.groupby('a')['b'].sum().round(2)")).toBe("return df.groupby('a')['b'].sum()");
    expect(unround("np.round(np.linalg.solve(A, b), 6)")).toBe("(np.linalg.solve(A, b))");
    expect(unround("{n: round(f(x, y), 1) for n in d}")).toBe("{n: (f(x, y)) for n in d}");
  });
});

describe.skipIf(!hasPython3)("lo que el enunciado pide redondear se comprueba", () => {
  const seeds = [1, 2, 3, 7, 11, 1234];
  const items: Array<{ inst: PyCodeInstance; label: string }> = [];
  for (const id of PY_CODE_TEMPLATES.keys()) for (const level of EXERCISE_LEVELS) for (const s of seeds) items.push({ inst: makeCodeTemplate(id, s, level), label: `${id} ${level} ${s}` });
  for (const [type, seed, level] of [["py-funciones", "51hjvz", "medio"], ["py-pandas-agrupar", "abc1", "medio"]] as const) {
    const t = PY_CODE_TYPES.find((x) => x.id === type)!;
    items.push({ inst: t.generate(seedFromText(seed)!, level), label: `${type} ${level} ${seed}` });
  }
  const jobs = items.filter(({ inst }) => asksRounding(inst) && runnable(inst) && unround(inst.solution) !== inst.solution);

  it("la referencia sin redondear falla algún caso", () => {
    expect(jobs.length).toBeGreaterThan(30);
    const raw: unknown[] = [];
    for (let i = 0; i < jobs.length; i += 100) {
      raw.push(...runJobs<unknown>(HARNESS_PY, jobs.slice(i, i + 100).map(({ inst }) => ({ fn: "__labs_check", payload: checkPayload(inst, unround(inst.solution)), files: caseFiles(inst.cases) })), 300_000));
    }
    const passed = raw.flatMap((r, i) => (allPassed(parseCheckResult(JSON.stringify(r))!) ? [jobs[i]!.label] : []));
    expect(passed).toEqual([]);
  }, 600_000);
});
