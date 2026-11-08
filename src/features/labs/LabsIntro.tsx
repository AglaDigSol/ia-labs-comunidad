// Orientación de la primera visita a los laboratorios: qué hay en las pestañas y dónde están los dos
// simulacros de examen. Se cierra con «Entendido» y se recuerda en el dispositivo (clave `labsIntro`
// de los laboratorios: "0" cerrada).
import { Compass, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "../../components/ui/button.tsx";
import { readLabItem, writeLabItem } from "./labs-storage.ts";

export function LabsIntro({ base, python }: { base: string; python: boolean }) {
  const [open, setOpen] = useState(() => readLabItem("labsIntro") !== "0");
  if (!open) return null;
  const close = () => {
    writeLabItem("labsIntro", "0");
    setOpen(false);
  };
  return (
    <section aria-labelledby="labs-intro-title" className="relative flex flex-col gap-3 rounded-lg border border-border bg-raised p-4 pr-12" data-labs-intro="">
      <p id="labs-intro-title" className="flex items-center gap-2 font-display text-[18px] font-semibold">
        <Compass size={20} strokeWidth={1.75} aria-hidden="true" />
        Cómo están organizados los laboratorios
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-[14px]">
        <li>
          <strong>Una pestaña por tema</strong> (Lógica, Conjuntos, Combinatoria, Álgebra lineal, Cálculo, Probabilidad, Markov…): explora,
          dibuja y practica con corrección paso a paso. <span className="lg:hidden">Desliza la barra de pestañas o usa las flechas para ver todas.</span>
        </li>
        <li>
          <strong>Simbología</strong>: cómo se lee cada símbolo en clase y su equivalente en Python.
        </li>
        <li>
          <strong>Ejercicios</strong>: el banco de ejercicios de todos los temas, con tres niveles y semilla para repetirlos.
          {python ? (
            <>
              {" "}
              <strong>Python</strong>: Python en el navegador, con NumPy, pandas y matplotlib.
            </>
          ) : null}
        </li>
      </ul>
      <div className="flex flex-wrap gap-2">
        <Link to={`${base}/ejercicios/simulacro`} className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-[14px] font-semibold text-accent hover:bg-sunken">
          Simulacro de examen de 02MIAR (Matemáticas)
        </Link>
        {python ? (
          <Link to={`${base}/python/simulacro`} className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-[14px] font-semibold text-accent hover:bg-sunken">
            Simulacro de examen de 01MIAR (Python)
          </Link>
        ) : null}
        <Button variant="primary" onClick={close}>
          Entendido
        </Button>
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="Cerrar la orientación"
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-md text-muted hover:bg-sunken hover:text-fg"
      >
        <X size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </section>
  );
}
