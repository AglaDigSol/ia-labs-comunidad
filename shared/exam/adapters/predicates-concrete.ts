// Adaptador de «Cuantificadores en un conjunto concreto» para el simulacro (bloque «Lógica de
// predicados»):
// - modo «evaluar»: «¿Cuál de estos enunciados es verdadero en A?», con el del ejercicio y variantes
//   suyas (el otro cuantificador, otra conectiva, una propiedad negada; anidados, los cuatro órdenes
//   de ∀ y ∃ y la relación al revés). Se eligen una verdadera y tres falsas, recorriendo A.
// - modo «negar»: las cuatro opciones del ejercicio; la buena es la equivalente a la negación (fuerza
//   bruta en los subconjuntos de A y en muchos otros conjuntos) y cada error lleva su explicación.
import { type ChoiceOption } from "../../exercises/choice.ts";
import {
  conclusion,
  correctNegation,
  isNegation,
  negatedTex,
  negatedText,
  negationMistakeText,
  negationSteps,
  nomenclature,
  PRED_CONCRETE,
  setTex,
  setText,
  spoken,
  statementTex,
  statementText,
  truthIn,
  type Body,
  type ConcreteStatement,
  type Quant,
  type RelKind,
} from "../../exercises/predicates-concrete.ts";
import { examAdapter, type ExamAdapter } from "../adapter.ts";
import { examList, examMath, examMuted, examP, examTex } from "../blocks.ts";

const dual = (q: Quant): Quant => (q === "forall" ? "exists" : "forall");
const toggle = (b: Body): Body => (b.kind === "not" ? b.arg : { kind: "not", arg: b });
const SWAP: Record<RelKind, RelKind> = { gt: "lt", lt: "gt", le: "ge", ge: "le", ne: "ne", opp: "opp" };

/** Variantes del enunciado, la primera él mismo. */
export function statementVariants(s: ConcreteStatement): ConcreteStatement[] {
  if (s.kind === "nested") {
    const qs: Quant[] = ["forall", "exists"];
    const rels = [...new Set([s.rel, SWAP[s.rel]])];
    return [s, ...rels.flatMap((rel) => qs.flatMap((outer) => qs.map((inner) => ({ kind: "nested", outer, inner, rel }) as const)))];
  }
  const out: ConcreteStatement[] = [s, { ...s, q: dual(s.q) }];
  const b = s.body;
  if (b.kind === "and" || b.kind === "or" || b.kind === "imp") {
    for (const op of ["and", "or", "imp"] as const) if (op !== b.kind) out.push({ ...s, body: { ...b, kind: op } }, { q: dual(s.q), kind: "simple", body: { ...b, kind: op } });
    out.push({ ...s, body: { ...b, left: toggle(b.left) } }, { ...s, body: { ...b, right: toggle(b.right) } });
    out.push({ q: dual(s.q), kind: "simple", body: { ...b, left: toggle(b.left) } }, { q: dual(s.q), kind: "simple", body: { ...b, right: toggle(b.right) } });
  } else out.push({ ...s, body: toggle(b) }, { q: dual(s.q), kind: "simple", body: toggle(b) });
  const seen = new Set<string>();
  return out.filter((x) => {
    const k = statementText(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const opt = (id: string, s: ConcreteStatement, correct: boolean, why: string): ChoiceOption => ({ id, text: statementText(s), tex: statementTex(s), correct, why });

const concreteAdapter = examAdapter({
  type: PRED_CONCRETE,
  ask: "Qué enunciado con ∀ o ∃ es verdadero en un conjunto concreto de enteros, o cuál es la negación de uno (opción múltiple).",
  build(inst) {
    const setLine = [examP("Sea el conjunto ", examTex(`A = ${setTex(inst.set)}`, `A es el conjunto ${setText(inst.set)}`), ".")];
    const legend = nomenclature(inst.statement);
    const legendBlock = legend.length > 0 ? [examMuted(legend.join("; "))] : [];
    if (inst.mode === "negar") {
      const options = inst.options.map((o, i) => {
        const right = isNegation(inst.statement, o, inst.set);
        return opt(`n${i}`, o, right, right ? "Es la negación: cuantificador dual y cuerpo negado." : negationMistakeText(inst.statement, o));
      });
      const neg = correctNegation(inst.statement);
      return {
        kind: "choice",
        stem: [...setLine, examP("Considera el enunciado"), examMath(negatedTex(inst.statement), spoken(negatedText(inst.statement))), ...legendBlock],
        prompt: "¿Qué enunciado es equivalente a la negación?",
        question: { mode: "single", options },
        solution: [examList(negationSteps(inst.statement).map((s) => [examTex(s.tex, spoken(s.text)), ` (${s.law})`])), examP(`En A, la negación: ${conclusion(neg, inst.set)}`)],
      };
    }
    const variants = statementVariants(inst.statement);
    const right = variants.find((v) => truthIn(v, inst.set));
    const wrong = variants.filter((v) => !truthIn(v, inst.set)).slice(0, 3);
    if (!right || wrong.length < 3) return null;
    const chosen = [right, ...wrong];
    return {
      kind: "choice",
      stem: [...setLine, ...legendBlock],
      prompt: "¿Cuál de estos enunciados es verdadero en A?",
      question: { mode: "single", options: chosen.map((v, i) => opt(`e${i}`, v, v === right, conclusion(v, inst.set))) },
      solution: [examP("Se recorre A elemento a elemento: para un ∃ basta un ejemplo y, para tumbar un ∀, un contraejemplo."), examP(`${statementText(right)}: ${conclusion(right, inst.set)}`)],
    };
  },
});

export const PRED_CONCRETE_EXAM_ADAPTERS: readonly ExamAdapter[] = [concreteAdapter];
