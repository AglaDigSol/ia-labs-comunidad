// Referencia de las siete puertas: símbolo, función con la notación de clase y tabla de verdad.
// Textos y dibujos propios.
import { GATE_NAMES, GATE_TYPES, gateValue, type GateType } from "../../../../shared/boole/circuit.ts";
import { Tex } from "../../../lib/tex.tsx";
import { GateIcon } from "./GateSymbol.tsx";

const INFO: Record<GateType, { tex: string; plain: string; note: string }> = {
  or: { tex: "x \\oplus y", plain: "x ⊕ y", note: "Vale 1 si al menos una entrada vale 1. Es la suma de clase." },
  and: { tex: "x \\odot y", plain: "x ⊙ y", note: "Vale 1 solo si todas las entradas valen 1. Es el producto." },
  xor: {
    tex: "x \\veebar y = x \\odot y' \\oplus x' \\odot y",
    plain: "x ⊻ y = x ⊙ y′ ⊕ x′ ⊙ y",
    note: "Vale 1 si las entradas son distintas (con más entradas, si hay un número impar de unos).",
  },
  not: { tex: "x'", plain: "x′", note: "Una sola entrada: devuelve el complemento. La burbuja marca la negación." },
  nor: { tex: "(x \\oplus y)' = x' \\odot y'", plain: "(x ⊕ y)′ = x′ ⊙ y′", note: "OR seguida de NOT. Por De Morgan, es el producto de los complementos." },
  nand: { tex: "(x \\odot y)' = x' \\oplus y'", plain: "(x ⊙ y)′ = x′ ⊕ y′", note: "AND seguida de NOT. Por De Morgan, es la suma de los complementos." },
  xnor: {
    tex: "(x \\veebar y)' = x \\odot y \\oplus x' \\odot y'",
    plain: "(x ⊻ y)′ = x ⊙ y ⊕ x′ ⊙ y′",
    note: "XOR seguida de NOT: vale 1 si las entradas son iguales.",
  },
};

const cell = "border border-border px-2 py-0.5 text-center font-mono text-[14px]";

function GateTable({ type }: { type: GateType }) {
  const rows = type === "not" ? [[false], [true]] : [[false, false], [false, true], [true, false], [true, true]];
  const vars = type === "not" ? ["x"] : ["x", "y"];
  const b = (v: boolean) => (v ? "1" : "0");
  return (
    <table className="border-collapse">
      <caption className="sr-only">{`Tabla de verdad de ${GATE_NAMES[type]}`}</caption>
      <thead>
        <tr>
          {vars.map((v) => (
            <th key={v} scope="col" className={`${cell} bg-sunken`}>
              {v}
            </th>
          ))}
          <th scope="col" className={`${cell} bg-sunken`}>
            {GATE_NAMES[type]}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.map(b).join("")}>
            {r.map((v, i) => (
              <td key={i} className={cell}>
                {b(v)}
              </td>
            ))}
            <td className={`${cell} font-semibold`}>{b(gateValue(type, r))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function GateReference() {
  return (
    <section aria-labelledby="gates-title" className="flex flex-col gap-3">
      <h2 id="gates-title" className="font-display text-[20px] font-semibold">
        Las siete puertas
      </h2>
      <p className="text-[14px] text-muted">
        Símbolos con las formas ANSI habituales. La burbuja a la salida significa «complemento». ⊕ es la suma (OR), ⊙ el
        producto (AND) y ⊻ la disyunción exclusiva (XOR).
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {GATE_TYPES.map((t) => (
          <li key={t} className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3" data-testid={`gate-${t}`}>
            <h3 className="font-display text-[18px] font-semibold">{GATE_NAMES[t]}</h3>
            <div className="flex flex-wrap items-center gap-4">
              <GateIcon type={t} label={`Símbolo de la puerta ${GATE_NAMES[t]}: ${INFO[t].plain}`} />
              <GateTable type={t} />
            </div>
            <div className="max-w-full overflow-x-auto py-1 text-[17px]">
              <Tex tex={INFO[t].tex} label={INFO[t].plain} />
            </div>
            <p className="text-[14px] text-muted">{INFO[t].note}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
