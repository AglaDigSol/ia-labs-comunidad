// Orientación de la primera visita a los laboratorios: qué hay en las pestañas y dónde están los dos
// simulacros de examen. Se cierra con «Entendido» o la X y se recuerda en el dispositivo (clave
// `labsIntro` de los laboratorios: "0" cerrada). En el móvil (< 1024 px) es una sola línea plegada que
// se despliega al tocarla, para no empujar el laboratorio hacia abajo.
import { ChevronDown, Compass, X } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router";
import { subject } from "../../../shared/courses/subjects.ts";
import { Button } from "../../components/ui/button.tsx";
import { cn } from "../../lib/cn.ts";
import { readLabItem, writeLabItem } from "./labs-storage.ts";

export function LabsIntro({ base, python }: { base: string; python: boolean }) {
  const [open, setOpen] = useState(() => readLabItem("labsIntro") !== "0");
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();
  if (!open) return null;
  const close = () => {
    writeLabItem("labsIntro", "0");
    setOpen(false);
  };
  return (
    <section
      aria-labelledby="labs-intro-title"
      className="relative flex flex-col gap-3 rounded-lg border border-border bg-raised pr-12 lg:p-4 lg:pr-12"
      data-labs-intro=""
    >
      {/* Móvil: una línea que se despliega. Escritorio: el título, siempre abierto. */}
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={() => setExpanded((x) => !x)}
        className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg pl-3 text-left text-[14px] font-semibold lg:hidden"
      >
        <Compass size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">Cómo están organizados los laboratorios</span>
        <ChevronDown
          size={18}
          strokeWidth={1.75}
          aria-hidden="true"
          className={cn("shrink-0 transition-transform motion-reduce:transition-none", expanded && "rotate-180")}
        />
      </button>
      <p id="labs-intro-title" className="hidden items-center gap-2 font-display text-[18px] font-semibold lg:flex">
        <Compass size={20} strokeWidth={1.75} aria-hidden="true" />
        Cómo están organizados los laboratorios
      </p>
      <div id={bodyId} data-labs-intro-body="" className={cn("flex-col gap-3 lg:flex", expanded ? "flex px-3 pb-3 lg:p-0" : "hidden")}>
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
          </li>
          {python ? (
            <li>
              <strong>Python</strong>: Python en el navegador, con NumPy, pandas y matplotlib.
            </li>
          ) : null}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Link to={`${base}/ejercicios/simulacro`} className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-[14px] font-semibold text-accent hover:bg-sunken">
            {`Simulacro de examen de 02MIAR (${subject("02MIAR").tag})`}
          </Link>
          {python ? (
            <Link to={`${base}/python/simulacro`} className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-[14px] font-semibold text-accent hover:bg-sunken">
              {`Simulacro de examen de 01MIAR (${subject("01MIAR").tag})`}
            </Link>
          ) : null}
          <Button variant="primary" onClick={close}>
            Entendido
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="Cerrar la orientación"
        className="absolute right-0 top-0 flex h-11 w-11 lg:right-1 lg:top-1 items-center justify-center rounded-md text-muted hover:bg-sunken hover:text-fg"
      >
        <X size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </section>
  );
}
