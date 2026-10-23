import katex from "katex";
import type { Course } from "../../../shared/courses/types.ts";
import { formatGrade } from "../../../shared/grades.ts";

// Only numbers produced by formatGrade (or integer weights from curriculum data) reach KaTeX.
const tex = (s: string) => s.replace(",", "{,}");

export function LiveFormula({
  course,
  values,
  accum,
}: {
  course: Course;
  values: Record<string, number | null>;
  accum: number;
}) {
  const entered = course.components.filter((c) => !c.isExam && typeof values[c.id] === "number");
  const terms = entered.map((c) => `${c.weightPct} \\cdot ${tex(formatGrade(values[c.id] as number))}`);
  const a = tex(formatGrade(Math.floor((accum + 50) / 100)));
  const sum = terms.length > 0 ? terms.join(" + ") : "0";
  const nTex = `N = \\frac{\\sum_i w_i \\cdot n_i}{100} = \\frac{${sum}}{100} = ${a}`;
  const w = `0{,}${course.examWeightPct}`;
  const eTex = `e_{\\min} = \\max\\left(5{,}0,\\ \\frac{\\text{objetivo} - ${a}}{${w}}\\right)`;
  const html = katex.renderToString(`${nTex} \\\\ ${eTex}`, {
    throwOnError: false,
    displayMode: true,
    output: "htmlAndMathml",
  });
  return (
    <div
      aria-label="Fórmula de la nota ponderada y de la nota mínima de examen"
      role="group"
      className="overflow-x-auto text-[20px]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
