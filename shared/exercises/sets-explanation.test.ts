import { describe, expect, it } from "vitest";
import { EXERCISE_LEVELS as ALL_LEVELS } from "./types.ts";
import { CARTESIAN_RELATION } from "../sets/relations.ts";
import { relationOptionExplanation, relationOptionVerdict, SETS_RELATIONS } from "./sets.ts";

// Las explicaciones de «Depende» y «Siempre falsa» se leen como frases completas: cada «se cumple» y
// cada «falla» lleva su condición («si solo hay elementos en …») y, si falla, el porqué.
const REGION = String.raw`(?:[ABC]ᶜ?(?: ∩ [ABC]ᶜ?)*)`;
const PLACE = String.raw`(?:en ${REGION}(?:, ${REGION})*(?: y ${REGION})?|fuera de [ABC](?:, [ABC])*(?: y [ABC])? \((?:los dos|todos) vacíos\))`;
const DEPENDE = new RegExp(String.raw`^Depende de cómo sean los conjuntos\. Se cumple, por ejemplo, si solo hay elementos ${PLACE}\. Falla, por ejemplo, si solo hay elementos ${PLACE}, porque .{10,}\.$`, "u");
const NUNCA = new RegExp(String.raw`^Siempre falsa: no se cumple en ningún diagrama que cumpla los supuestos\. Por ejemplo, si solo hay elementos ${PLACE}, falla porque .{10,}\.$`, "u");

describe("explicaciones de relaciones entre conjuntos", () => {
  it("recorre todas las variantes: frases completas, sin «;» que corten la frase", () => {
    const seen = { depende: 0, nunca: 0, siempre: 0 };
    for (const level of ALL_LEVELS) {
      for (let seed = 1; seed <= 150; seed++) {
        const inst = SETS_RELATIONS.generate(seed, level);
        for (const o of inst.options) {
          if (o === CARTESIAN_RELATION.text) continue;
          const v = relationOptionVerdict(o, inst.hypotheses);
          const text = relationOptionExplanation(o, inst.hypotheses);
          seen[v]++;
          expect(text, `${level} ${seed} ${o}`).not.toContain(";");
          if (v === "depende") expect(text, `${level} ${seed} ${o}`).toMatch(DEPENDE);
          if (v === "nunca") expect(text, `${level} ${seed} ${o}`).toMatch(NUNCA);
        }
      }
    }
    expect(seen.depende).toBeGreaterThan(50);
    expect(seen.nunca).toBeGreaterThan(10);
  });
});
