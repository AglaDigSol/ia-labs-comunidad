// Adaptadores de conjuntos, funciones, combinatoria y complejidad.
import { algorithmGivens, algorithmLines } from "../../discrete/algorithms.ts";
import { costOf, costSpoken, costTex, growthText, isLooseBound, optionTex, optionText, sameGrowth } from "../../discrete/bigo.ts";
import { acceptedFormulas, countModel, FORMULAS, substitutedTex, substitutedText } from "../../discrete/count.ts";
import { statementReason, statementText, statementTrue } from "../../discrete/functions.ts";
import { pnpPool } from "../../discrete/pnp.ts";
import { countOf, solveRegions } from "../../sets/cardinal.ts";
import { parseSetExpr, setRegions, setToPlain, setToTex, vennVars, type SetExpr, type SetName } from "../../sets/expr.ts";
import { createRng } from "../../exercises/random.ts";
import { seedFromKey, type ChoiceOption } from "../../exercises/choice.ts";
import { COMB_COMPLEXITY, COMB_FUNCTIONS, COMB_MODEL, COMB_PNP, COMB_PROBLEM, complexityGrowth, problemAnswer, termModels, termValue } from "../../exercises/discrete.ts";
import { CARTESIAN_RELATION, parseSetHypotheses, parseSetRelation, relationSpoken, relationToTex } from "../../sets/relations.ts";
import { relationOptionExplanation, relationsAnswer, SETS_CARDINAL, SETS_EQUAL, SETS_PARTS, SETS_RELATIONS } from "../../exercises/sets.ts";
import { examAdapter, type ExamAdapter } from "../adapter.ts";
import { examCode, examList, examMath, examP, examTex } from "../blocks.ts";

const opt = (id: string, text: string, correct: boolean, why?: string, tex?: string): ChoiceOption => ({ id, text, correct, ...(tex ? { tex } : {}), ...(why ? { why } : {}) });

const setOf = (text: string): SetExpr => {
  const r = parseSetExpr(text);
  if (!r.ok) throw new Error(`expresión ilegible: ${text}`);
  return r.expr;
};

// ---------------------------------------------------------------- Conjuntos

const setsEqualAdapter = examAdapter({
  type: SETS_EQUAL,
  ask: "Igualdad o inclusión entre dos expresiones de conjuntos (opción múltiple).",
  build(inst) {
    const a = setOf(inst.left);
    const b = setOf(inst.right);
    const vars = vennVars(a, b);
    const ra = setRegions(a, vars);
    const rb = setRegions(b, vars);
    const xy = ra.every((x, i) => !x || rb[i]);
    const yx = rb.every((x, i) => !x || ra[i]);
    const right = xy && yx ? "igual" : xy ? "xy" : yx ? "yx" : "ninguno";
    const diff = ra.filter((x, i) => x !== rb[i]).length;
    return {
      kind: "choice",
      stem: [
        examP(`Para conjuntos ${vars.join(", ")} cualesquiera de un universo U, sean`),
        examMath(`X = ${setToTex(a)}`, `X igual a ${setToPlain(a)}`),
        examMath(`Y = ${setToTex(b)}`, `Y igual a ${setToPlain(b)}`),
      ],
      prompt: "¿Qué relación hay entre X e Y?",
      question: {
        mode: "single",
        options: [
          opt("igual", "X = Y", right === "igual", undefined, "X = Y"),
          opt("xy", "X ⊂ Y (X está contenido en Y, pero no son iguales)", right === "xy", undefined, "X \\subset Y"),
          opt("yx", "Y ⊂ X (Y está contenido en X, pero no son iguales)", right === "yx", undefined, "Y \\subset X"),
          opt("ninguno", "En general, ninguno de los dos está contenido en el otro", right === "ninguno"),
        ],
      },
      solution: [
        examP(
          right === "igual"
            ? "Sombrean las mismas regiones del diagrama de Venn: son iguales."
            : `Difieren en ${diff} ${diff === 1 ? "región" : "regiones"} del diagrama de Venn. ${xy ? "Todas las de X están en Y." : yx ? "Todas las de Y están en X." : "Cada una tiene alguna región que la otra no tiene."}`,
        ),
      ],
    };
  },
});

const setsRelationsAdapter = examAdapter({
  type: SETS_RELATIONS,
  ask: "Relaciones entre conjuntos bajo unos supuestos: cuál es siempre cierta o siempre falsa (opción múltiple).",
  build(inst) {
    const h = parseSetHypotheses(inst.hypotheses);
    if (!h.ok) return null;
    const answer = relationsAnswer(inst);
    if (answer < 0) return null;
    const usesC = inst.hypotheses.includes("C") || inst.options.some((o) => o.includes("C"));
    const options = inst.options.map((o, i) => {
      const why = relationOptionExplanation(o, inst.hypotheses);
      if (o === CARTESIAN_RELATION.text) return opt(`o${i}`, o, i === answer, why, CARTESIAN_RELATION.tex);
      const r = parseSetRelation(o);
      if (!r.ok) throw new Error(`relación ilegible: ${o}`);
      return opt(`o${i}`, o, i === answer, why, r.relations.map(relationToTex).join(",\\; "));
    });
    return {
      kind: "choice",
      stem: [
        examP(`Sean ${usesC ? "A, B y C" : "A y B"} conjuntos de un universo U ≠ ∅ tales que`),
        examMath(h.relations.map(relationToTex).join(",\\quad "), h.relations.map(relationSpoken).join("; ")),
      ],
      prompt: `¿Cuál de estas afirmaciones es siempre ${inst.ask === "cierta" ? "verdadera" : "falsa"}?`,
      question: { mode: "single", options },
      solution: [
        examP(
          "Se razona por regiones del diagrama de Venn: los supuestos dejan algunas regiones vacías (o con elementos), y una afirmación es siempre cierta si se cumple en todos los diagramas que los respetan, y siempre falsa si no se cumple en ninguno.",
        ),
      ],
    };
  },
});

const setsCardinalAdapter = examAdapter({
  type: SETS_CARDINAL,
  ask: "Inclusión–exclusión: un cardinal a partir de los datos (numérica, entero).",
  build(inst) {
    const vars = (inst.sets.C ? ["A", "B", "C"] : ["A", "B"]) as SetName[];
    const sol = solveRegions(
      vars,
      inst.data.map((d) => ({ expr: setOf(d.expr), value: d.value })),
    );
    if (!sol.ok) return null;
    const q = inst.questions[0]!;
    const value = countOf(setOf(q.expr), vars, sol.counts);
    const names = vars.map((v) => `${v}: ${inst.sets[v]}`);
    return {
      kind: "numeric",
      stem: [
        examP(inst.story),
        examList(names.map((n) => [n])),
        examList(inst.data.map((d) => (d.expr === "U" ? [`Total: ${d.value}`] : [examTex(`|${setToTex(setOf(d.expr))}| = ${d.value}`, `cardinal de ${d.expr} igual a ${d.value}`)]))),
      ],
      prompt: q.prompt,
      expected: BigInt(value),
      format: "entero",
      label: "Número",
      solution: [
        examP("Se rellena el diagrama de Venn de dentro hacia fuera (la intersección de todos primero) y se suman las regiones que pide la pregunta."),
        examMath(`|${setToTex(setOf(q.expr))}| = ${value}`, `cardinal de ${q.expr} igual a ${value}`),
      ],
    };
  },
});

const setsPartsAdapter = examAdapter({
  type: SETS_PARTS,
  ask: "Cardinal de 𝒫(A), 𝒫(A) × A, A × B o 𝒫(A × B) (numérica, entero).",
  build(inst, level) {
    const A = `\\{${inst.a.join(", ")}\\}`;
    const B = `\\{${inst.b.join(", ")}\\}`;
    const n = inst.a.length;
    const m = inst.b.length;
    if (inst.mode === "partes") {
      const twice = level !== "básico";
      return {
        kind: "numeric",
        stem: [examP("Sea"), examMath(`A = ${A}`, `A igual a ${inst.a.join(", ")}`)],
        prompt: twice ? "¿Cuántos elementos tiene 𝒫(A) × A?" : "¿Cuántos elementos tiene 𝒫(A), el conjunto de partes de A?",
        expected: BigInt(twice ? 2 ** n * n : 2 ** n),
        format: "entero",
        label: twice ? "|𝒫(A) × A|" : "|𝒫(A)|",
        solution: [examP(twice ? `|𝒫(A)| = 2^${n} = ${2 ** n} y |𝒫(A) × A| = ${2 ** n}·${n} = ${2 ** n * n}.` : `|𝒫(A)| = 2^|A| = 2^${n} = ${2 ** n}.`)],
      };
    }
    const parts = level !== "básico";
    return {
      kind: "numeric",
      stem: [examP("Sean"), examMath(`A = ${A},\\quad B = ${B}`, `A igual a ${inst.a.join(", ")}; B igual a ${inst.b.join(", ")}`)],
      prompt: parts ? "¿Cuántos elementos tiene 𝒫(A × B)?" : "¿Cuántos elementos tiene A × B?",
      expected: BigInt(parts ? 2 ** (n * m) : n * m),
      format: "entero",
      label: parts ? "|𝒫(A × B)|" : "|A × B|",
      solution: [examP(parts ? `|A × B| = ${n}·${m} = ${n * m}, así que |𝒫(A × B)| = 2^${n * m} = ${2 ** (n * m)}.` : `|A × B| = |A|·|B| = ${n}·${m} = ${n * m}.`)],
    };
  },
});

const functionsAdapter = examAdapter({
  type: COMB_FUNCTIONS,
  levels: ["básico", "medio"],
  ask: "Funciones entre conjuntos finitos por sus cardinales (opción múltiple).",
  build(inst) {
    if (inst.multi) return null;
    const data = [
      ...(inst.subset ? [["A \\subset B", "A es un subconjunto propio de B"]] : []),
      [`|A| = ${inst.a}`, `cardinal de A igual a ${inst.a}`],
      [`|B| = ${inst.b}`, `cardinal de B igual a ${inst.b}`],
      ...(inst.image !== undefined ? [[`|f(A)| = ${inst.image}`, `cardinal de f de A igual a ${inst.image}`]] : []),
    ];
    return {
      kind: "choice",
      stem: [examP("Sea ", examTex("f\\colon A \\to B", "f de A en B"), " una función, con"), examMath(data.map((d) => d[0]).join(",\\quad "), data.map((d) => d[1]).join("; "))],
      prompt: "¿Cuál de estas afirmaciones es verdadera?",
      question: { mode: "single", options: inst.statements.map((s, i) => opt(`s${i}`, statementText(s), statementTrue(s, inst), statementReason(s, inst))) },
    };
  },
});

// ---------------------------------------------------------------- Combinatoria

const problemAdapter = examAdapter({
  type: COMB_PROBLEM,
  ask: "Problema de recuento (numérica, entero exacto).",
  build(inst) {
    const value = problemAnswer(inst);
    return {
      kind: "numeric",
      stem: [examP(inst.text)],
      prompt: "Escribe el número exacto.",
      expected: value,
      format: "entero",
      label: "Número",
      solution: [
        ...inst.terms.map((t, i) => {
          const sign = i === 0 ? "" : t.sign < 0 ? "-\\;" : "+\\;";
          const said = i === 0 ? "" : t.sign < 0 ? "menos " : "más ";
          const ms = termModels(t);
          if (ms.length === 1) return examMath(`${sign}${substitutedTex(t.model)}`, `${said}${substitutedText(t.model)}`);
          // Varias etapas: cada fórmula con su valor, multiplicadas.
          return examMath(
            `${sign}${ms.map((m) => `\\left(${substitutedTex(m)}\\right)`).join(" \\cdot ")} = ${ms.map((m) => countModel(m).toString()).join(" \\cdot ")} = ${termValue(t).toString()}`,
            `${said}${ms.map((m) => substitutedText(m)).join(" por ")}, que da ${termValue(t).toString()}`,
          );
        }),
        examP(`Resultado: ${value}.`),
      ],
    };
  },
});

const modelAdapter = examAdapter({
  type: COMB_MODEL,
  ask: "Qué fórmula de recuento aplica (opción múltiple).",
  build(inst) {
    const accepted = acceptedFormulas(inst.model);
    return {
      kind: "choice",
      stem: [examP(inst.text)],
      prompt: "¿Qué fórmula cuenta lo que pide el enunciado?",
      question: {
        mode: "single",
        options: inst.options.map((id) => opt(id, `${FORMULAS[id].name}: ${FORMULAS[id].spoken}`, accepted.includes(id), FORMULAS[id].when, `\\text{${FORMULAS[id].name}: } ${FORMULAS[id].tex}`)),
      },
      solution: [examMath(substitutedTex(inst.model), substitutedText(inst.model))],
    };
  },
});

const complexityAdapter = examAdapter({
  type: COMB_COMPLEXITY,
  ask: "Orden exacto (cota O ajustada) de un fragmento o de un coste (opción múltiple, a veces con «Ninguna de las otras»).",
  build(inst) {
    const growth = complexityGrowth(inst);
    const hasNone = inst.options.some((o) => "none" in o);
    const real = inst.options.filter((o) => !("none" in o));
    const exact = (o: (typeof real)[number]) => "growth" in o && (o.coef ?? 1) === 1 && sameGrowth(o.growth, growth);
    const stem =
      inst.kind === "cost"
        ? (() => {
            const c = costOf(inst.cost, ["n", "m"]);
            const lhs = /m/.test(inst.cost) ? "T(n, m)" : "T(n)";
            return [examP("Un algoritmo tiene coste"), examMath(`${lhs} = ${costTex(c)}`, `${lhs} igual a ${costSpoken(c)}`)];
          })()
        : [...algorithmGivens(inst.algo).map((g) => examMath(g.tex, g.label)), examCode(algorithmLines(inst.algo))];
    return {
      kind: "choice",
      stem,
      prompt: inst.kind === "cost" ? "¿De qué orden exacto (cota O ajustada) es el coste?" : "¿De qué orden exacto (cota O ajustada) es el coste de este fragmento?",
      question: {
        mode: "single",
        options: real.map((o, i) => opt(`o${i}`, optionText(o), exact(o), exact(o) ? "Es el término dominante, sin constantes." : "growth" in o && (o.coef ?? 1) !== 1 ? "Dentro de la O no van constantes." : isLooseBound(o, growth) ? "Es una cota superior verdadera, pero no la ajustada: el coste crece más despacio." : undefined, optionTex(o))),
        ...(hasNone ? { noneOfOthers: true } : {}),
      },
      solution: [examP(`El orden es O(${growthText(growth)}).`)],
    };
  },
});

const pnpAdapter = examAdapter({
  type: COMB_PNP,
  ask: "Verdadero o falso sobre P, NP y la notación O (opción múltiple: la verdadera o la falsa).",
  build(inst, level) {
    const pool = pnpPool(level);
    const rng = createRng(seedFromKey(inst.ids.join("|")));
    // Primero las de la instancia, luego el resto del nivel.
    const ordered = [...inst.ids.map((id) => pool.find((s) => s.id === id)!), ...rng.shuffle(pool.filter((s) => !inst.ids.includes(s.id)))];
    const trues = ordered.filter((s) => s.value);
    const falses = ordered.filter((s) => !s.value);
    const askTrue = falses.length >= 3 && (trues.length < 3 || rng.chance(0.5));
    const hit = askTrue ? trues[0] : falses[0];
    const rest = (askTrue ? falses : trues).slice(0, 3);
    if (!hit || rest.length < 3) return null;
    return {
      kind: "choice",
      stem: [],
      prompt: askTrue ? "¿Cuál de estas afirmaciones es VERDADERA?" : "¿Cuál de estas afirmaciones es FALSA?",
      question: { mode: "single", options: [hit, ...rest].map((s) => opt(s.id, s.text, s === hit, `${s.value ? "Verdadera" : "Falsa"}. ${s.why}`)) },
    };
  },
});

export const SETS_EXAM_ADAPTERS: readonly ExamAdapter[] = [setsCardinalAdapter, setsEqualAdapter, setsRelationsAdapter, setsPartsAdapter];
export const COMB_EXAM_ADAPTERS: readonly ExamAdapter[] = [problemAdapter, modelAdapter, functionsAdapter, complexityAdapter, pnpAdapter];
