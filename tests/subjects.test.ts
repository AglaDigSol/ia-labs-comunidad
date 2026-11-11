// Tabla única de asignaturas (shared/courses/subjects.ts): el contenido, el calendario, las barajas y
// los textos de la interfaz usan los mismos códigos y nombres.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CALENDARIO } from "../content/calendario/index.ts";
import { COURSES } from "../content/courses/index.ts";
import { SUBJECTS, subjectByCode, subjectLabel } from "../shared/courses/subjects.ts";
import { SEED_DECKS } from "../shared/srs/decks.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

function filesUnder(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    return statSync(join(root, path)).isDirectory() ? filesUnder(path) : /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe("tabla de asignaturas", () => {
  it("01MIAR es Python para la IA y 02MIAR, Matemáticas para la IA (guías 2026-2027)", () => {
    expect(SUBJECTS.map((s) => [s.code, s.short])).toEqual([
      ["01MIAR", "Python para la IA"],
      ["02MIAR", "Matemáticas para la IA"],
    ]);
    expect(subjectLabel("02MIAR")).toBe("02MIAR · Matemáticas para la IA");
    expect(subjectLabel("01MIAR", "long")).toBe("01MIAR · Python para la Inteligencia Artificial");
    expect(subjectLabel("01MIAR", "tag")).toBe("01MIAR · Python");
    expect(subjectLabel("99XYZ")).toBe("99XYZ");
    expect(subjectByCode("99XYZ")).toBeNull();
  });

  it("las asignaturas de la calculadora de notas, el calendario y las barajas están en la tabla, con su nombre", () => {
    for (const c of COURSES) {
      expect(subjectByCode(c.id)?.name, c.id).toBe(c.name);
      expect(c.meta.subject).toBe(subjectLabel(c.id, "long"));
    }
    for (const e of CALENDARIO.eventos) expect(subjectByCode(e.materia), e.id).not.toBeNull();
    for (const d of SEED_DECKS) expect(subjectByCode(d.course), d.id).not.toBeNull();
  });

  it("ningún texto escribe a mano un nombre de asignatura distinto del de la tabla", () => {
    const allowed = new Set<string>(SUBJECTS.flatMap((s) => [s.name, s.short, s.tag]));
    const wrong: string[] = [];
    for (const file of [...filesUnder("content"), ...filesUnder("shared"), ...filesUnder("src")]) {
      const text = readFileSync(join(root, file), "utf8");
      for (const m of text.matchAll(/\b(\d{2}MIAR) · ([A-ZÁÉÍÓÚ][^"`»)\n]*?)(?=["`»)\n]|$)/g)) {
        const [, code, name] = m;
        const s = subjectByCode(code!);
        if (!s || !allowed.has(name!.trim())) wrong.push(`${relative(root, join(root, file))}: ${m[0]}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});
