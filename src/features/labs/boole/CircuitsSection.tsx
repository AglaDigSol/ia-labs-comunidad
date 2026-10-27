// «Puertas y circuitos»: práctica «Circuito → función» (primero, en modo «Comprueba tu respuesta»),
// visualizador «Función → circuito» con traducción a solo NAND o solo NOR, y la referencia de las
// siete puertas.
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import type { BuildMode } from "./boole-storage.ts";
import { CircuitBuilder } from "./CircuitBuilder.tsx";
import { CircuitPractice } from "./CircuitPractice.tsx";
import { GateReference } from "./GateReference.tsx";

export type CircuitsView = "practica" | "construir" | "puertas";
export const isCircuitsView = (x: unknown): x is CircuitsView => x === "practica" || x === "construir" || x === "puertas";

export function CircuitsSection({
  view,
  onView,
  circuit,
  onCircuit,
  build,
  buildMode,
  onBuild,
}: {
  view: CircuitsView;
  onView: (v: CircuitsView) => void;
  circuit: string | null;
  onCircuit: (id: string) => void;
  build: string;
  buildMode: BuildMode;
  onBuild: (expr: string, mode: BuildMode) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        type="single"
        value={view}
        aria-label="Parte"
        onValueChange={(v) => {
          if (isCircuitsView(v)) onView(v);
        }}
        className="grid max-w-full grid-cols-3 self-start sm:inline-flex"
      >
        <ToggleGroupItem value="practica" className="px-3 py-1 leading-tight">
          Circuito → función
        </ToggleGroupItem>
        <ToggleGroupItem value="construir" className="px-3 py-1 leading-tight">
          Función → circuito
        </ToggleGroupItem>
        <ToggleGroupItem value="puertas" className="px-3 py-1 leading-tight">
          Las puertas
        </ToggleGroupItem>
      </ToggleGroup>
      {view === "practica" ? (
        <CircuitPractice circuitId={circuit} onChoose={onCircuit} />
      ) : view === "construir" ? (
        <CircuitBuilder expr={build} mode={buildMode} onChange={onBuild} />
      ) : (
        <GateReference />
      )}
    </div>
  );
}
