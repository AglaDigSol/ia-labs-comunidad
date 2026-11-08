// Adaptadores de lógica proposicional y de predicados.
import { toTex, type Node } from "../../logic/ast.ts";
import { formatFND, formatFNC, canonicalForms } from "../../logic/canonical.ts";
import { compareFormulas } from "../../logic/compare.ts";
import { parseFormula } from "../../logic/parser.ts";
import { buildTable, classify } from "../../logic/truth-table.ts";
import { parsePredicate } from "../../predicates/parser.ts";
import { predToTex } from "../../predicates/ast.ts";
import { seedFromKey, type ChoiceOption } from "../../exercises/choice.ts";
import { LOGIC_CLASSIFY, LOGIC_EQUIVALENCE, LOGIC_NORMAL_FORMS, LOGIC_TRUTH_TABLE } from "../../exercises/logic.ts";
import {
  ATOMS,
  divides,
  formalizeMatches,
  formalizePattern,
  formalizeSentence,
  LOGIC_FORMALIZE,
  numberFamily,
  NUMBER_SETS,
  PRED_NEGATE_NL,
  PRED_NUMBERS,
  SET_TEXT,
  setsText,
  truthSets,
} from "../../exercises/logic-extra.ts";
import { isNegation, negationMistake } from "../../exercises/logic-extra-negation.ts";
import { examAdapter, type ExamAdapter } from "../adapter.ts";
import { examList, examMath, examMuted, examP, examTex } from "../blocks.ts";

const ast = (text: string): Node => {
  const r = parseFormula(text);
  if (!r.ok) throw new Error(`fórmula ilegible: ${text}`);
  return r.ast;
};
const opt = (id: string, text: string, correct: boolean, why?: string, tex?: string): ChoiceOption => ({ id, text, correct, ...(tex ? { tex } : {}), ...(why ? { why } : {}) });

function tableOf(formula: string) {
  const t = buildTable(ast(formula));
  if (!t.ok) throw new Error("demasiadas variables");
  return t;
}

const KIND_TEXT = { tautologia: "una tautología", contradiccion: "una contradicción", contingencia: "una contingencia" } as const;

const classifyAdapter = examAdapter({
  type: LOGIC_CLASSIFY,
  ask: "Tautología, contradicción o contingencia (opción múltiple).",
  build(inst) {
    const t = tableOf(inst.formula);
    const c = classify(t.rows);
    const n = t.vars.length;
    const why = `La columna del resultado tiene ${c.trueCount} V de ${c.total} filas.`;
    return {
      kind: "choice",
      stem: [examP("Sea la fórmula"), examMath(toTex(ast(inst.formula)), inst.formula)],
      prompt: "¿Cómo se clasifica la fórmula?",
      question: {
        mode: "single",
        options: [
          opt("tautologia", "Es una tautología (verdadera en todas las filas).", c.kind === "tautologia", c.kind === "tautologia" ? why : undefined),
          opt("contradiccion", "Es una contradicción (falsa en todas las filas).", c.kind === "contradiccion", c.kind === "contradiccion" ? why : undefined),
          opt("contingencia", "Es una contingencia (verdadera en unas filas y falsa en otras).", c.kind === "contingencia", c.kind === "contingencia" ? why : undefined),
          opt("depende", "No se puede clasificar sin conocer los valores de verdad de las variables.", false, "Falsa: la clasificación es una propiedad de la fórmula; se decide con la tabla completa."),
        ],
      },
      solution: [examP(`Con ${n} variables la tabla tiene 2^${n} = ${c.total} filas; la fórmula es verdadera en ${c.trueCount}: es ${KIND_TEXT[c.kind]}.`)],
    };
  },
});

const truthTableAdapter = examAdapter({
  type: LOGIC_TRUTH_TABLE,
  ask: "Número de filas en las que la fórmula es verdadera (numérica, entero).",
  build(inst) {
    const t = tableOf(inst.formula);
    const c = classify(t.rows);
    return {
      kind: "numeric",
      stem: [examP("Sea la fórmula"), examMath(toTex(ast(inst.formula)), inst.formula)],
      prompt: "¿En cuántas filas de su tabla de verdad es verdadera la fórmula?",
      expected: BigInt(c.trueCount),
      format: "entero",
      label: "Filas verdaderas",
      solution: [examP(`Con ${t.vars.length} variables hay ${c.total} filas; el resultado es V en ${c.trueCount} y F en ${c.total - c.trueCount}.`)],
    };
  },
});

const normalFormsAdapter = examAdapter({
  type: LOGIC_NORMAL_FORMS,
  ask: "Número de mintérminos de la FND o de maxtérminos de la FNC (numérica, entero).",
  build(inst) {
    const t = tableOf(inst.formula);
    const { minterms, maxterms } = canonicalForms(t);
    const fnd = seedFromKey(inst.formula) % 2 === 0;
    const forms = fnd ? formatFND(t.vars, minterms, "logica") : formatFNC(t.vars, maxterms, "logica");
    return {
      kind: "numeric",
      stem: [examP("Sea la fórmula"), examMath(toTex(ast(inst.formula)), inst.formula)],
      prompt: fnd
        ? "¿Cuántos mintérminos tiene su forma normal disyuntiva (FND) completa?"
        : "¿Cuántos maxtérminos tiene su forma normal conjuntiva (FNC) completa?",
      expected: BigInt(fnd ? minterms.length : maxterms.length),
      format: "entero",
      label: fnd ? "Mintérminos" : "Maxtérminos",
      solution: [
        examP(fnd ? `Un mintérmino por cada fila en la que la fórmula es V: ${minterms.length}.` : `Un maxtérmino por cada fila en la que la fórmula es F: ${maxterms.length}.`),
        examMath(`${fnd ? "\\text{FND}" : "\\text{FNC}"} = ${forms.tex}`, `${fnd ? "FND" : "FNC"}: ${forms.plain}`),
      ],
    };
  },
});

const equivalenceAdapter = examAdapter({
  type: LOGIC_EQUIVALENCE,
  ask: "Equivalencia o consecuencia lógica entre dos fórmulas (opción múltiple).",
  build(inst) {
    const a = ast(inst.a);
    const b = ast(inst.b);
    const c = compareFormulas(a, b);
    if (!c.ok) return null;
    const ab = c.rows.every((r) => !r.a || r.b);
    const ba = c.rows.every((r) => !r.b || r.a);
    const right = ab && ba ? "equiv" : ab ? "ab" : ba ? "ba" : "ni";
    const why = `Difieren en ${c.differing} de ${c.rows.length} filas.`;
    return {
      kind: "choice",
      stem: [
        examP("Sean las fórmulas"),
        examMath(`\\alpha = ${toTex(a)}`, `alfa: ${inst.a}`),
        examMath(`\\beta = ${toTex(b)}`, `beta: ${inst.b}`),
      ],
      prompt: "¿Cuál de estas afirmaciones es correcta?",
      question: {
        mode: "single",
        options: [
          opt("equiv", "α y β son lógicamente equivalentes.", right === "equiv", right === "equiv" ? "Tienen la misma columna de resultados." : why, "\\alpha \\equiv \\beta"),
          opt("ab", "β es consecuencia lógica de α (α ⊨ β), pero no son equivalentes.", right === "ab", right === "ab" ? `Donde α es V, β también. ${why}` : undefined),
          opt("ba", "α es consecuencia lógica de β (β ⊨ α), pero no son equivalentes.", right === "ba", right === "ba" ? `Donde β es V, α también. ${why}` : undefined),
          opt("ni", "Ninguna de las dos es consecuencia lógica de la otra.", right === "ni", right === "ni" ? `Hay una fila con α V y β F, y otra con β V y α F. ${why}` : undefined),
        ],
      },
      solution: [examP(`Se comparan las dos columnas en las ${c.rows.length} filas: ${c.equivalent ? "coinciden en todas." : `difieren en ${c.differing}.`}`)],
    };
  },
});

const formalizeAdapter = examAdapter({
  type: LOGIC_FORMALIZE,
  ask: "Formalizar una frase con p, q, r (opción múltiple, por equivalencia lógica).",
  build(inst) {
    const letters = ["p", "q", "r"];
    const pattern = formalizePattern(inst.pattern);
    const options = inst.options.map((o, i) => opt(`f${i}`, o, formalizeMatches(o, inst) === true, undefined, toTex(ast(o))));
    return {
      kind: "choice",
      stem: [
        examP("Con estas proposiciones:"),
        examList(inst.atoms.map((id, i) => [`${letters[i]}: ${ATOMS.find((x) => x.id === id)!.fin}`])),
        examP(`«${formalizeSentence(inst)}»`),
      ],
      prompt: "¿Qué fórmula formaliza la frase?",
      question: { mode: "single", options },
      solution: [examP(pattern.rule), examMath(toTex(ast(pattern.formula)), pattern.formula)],
    };
  },
});

const predTex = (text: string) => {
  const r = parsePredicate(text);
  if (!r.ok) throw new Error(`fórmula ilegible: ${text}`);
  return predToTex(r.formula);
};

const negateNLAdapter = examAdapter({
  type: PRED_NEGATE_NL,
  ask: "Negación de una frase con cuantificadores (opción múltiple).",
  build(inst) {
    const options = inst.options.map((o, i) => {
      const right = isNegation(inst.formula, o.formula);
      return opt(`n${i}`, o.text, right, right ? `Fórmula: ${o.formula}` : `${negationMistake(inst.formula, o.formula)} Fórmula: ${o.formula}`, undefined);
    });
    const good = inst.options.find((o) => isNegation(inst.formula, o.formula));
    if (!good) return null;
    return {
      kind: "choice",
      stem: [examP(`«${inst.sentence}»`), examMuted(inst.legend)],
      prompt: "¿Cuál es la negación de la frase?",
      question: { mode: "single", options },
      solution: [examMath(`\\lnot\\left(${predTex(inst.formula)}\\right) \\equiv ${predTex(good.formula)}`, `no (${inst.formula}) equivale a ${good.formula}`)],
    };
  },
});

const sameSets = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

const numbersAdapter = examAdapter({
  type: PRED_NUMBERS,
  ask: "En qué conjuntos de ℕ, ℤ, ℚ, ℝ es verdadero un enunciado, o qué instancia de «x divide a y» lo es (opción múltiple).",
  build(inst) {
    if (inst.kind === "divide") {
      return {
        kind: "choice",
        stem: [
          examP("Sea el predicado sobre los enteros"),
          examMath("p(x, y) \\equiv \\exists k \\in \\mathbb{Z} : y = k\\cdot x", "p de x, y equivale a: existe k entero con y igual a k por x"),
        ],
        prompt: "¿Cuál de estas afirmaciones es verdadera?",
        question: {
          mode: "single",
          options: inst.pairs.map(([x, y], i) =>
            opt(`d${i}`, `p(${x}, ${y})`.replace(/-/g, "−"), divides(x, y), divides(x, y) ? `${y} = k·${x} con k entero.`.replace(/-/g, "−") : x === 0 ? "y = k·0 solo da y = 0." : `${y}/${x} no es entero.`.replace(/-/g, "−"), `p(${x}, ${y})`),
          ),
        },
        solution: [examP("p(x, y) dice que y es un múltiplo entero de x (x divide a y). Cuidado con el 0: y = k·0 solo da y = 0.")],
      };
    }
    const f = numberFamily(inst.family);
    const truth = truthSets(f);
    const why = f.why(inst.c);
    return {
      kind: "choice",
      stem: [
        examP("Sea el enunciado"),
        examMath(f.tex(inst.c), f.text(inst.c)),
        examMuted("donde A es uno de los conjuntos ", examTex("\\mathbb{N} = \\{1, 2, 3, \\ldots\\}", "ene igual a 1, 2, 3 y siguientes"), ", ℤ, ℚ o ℝ."),
      ],
      prompt: "¿En cuáles de ℕ, ℤ, ℚ y ℝ es verdadero?",
      question: { mode: "single", options: inst.options.map((o, i) => opt(`s${i}`, setsText(o), sameSets(o, truth))) },
      solution: [examList(NUMBER_SETS.map((s) => [`${SET_TEXT[s]}: ${f.truth[s] ? "verdadero" : "falso"}. ${why[s]}`]))],
    };
  },
});

export const LOGIC_EXAM_ADAPTERS: readonly ExamAdapter[] = [equivalenceAdapter, classifyAdapter, formalizeAdapter, truthTableAdapter, normalFormsAdapter];
export const PRED_EXAM_ADAPTERS: readonly ExamAdapter[] = [negateNLAdapter, numbersAdapter];
