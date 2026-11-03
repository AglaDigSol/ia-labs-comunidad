// Práctica con ejercicios generados dentro de un laboratorio: nivel (básico, medio, avanzado), «Otro
// ejercicio» (semilla nueva) y la vista del tipo, la misma que en el banco de ejercicios. Cada
// ejercicio nuevo vuelve a montar la vista (key), así que no arrastra respuestas.
import { SkipForward } from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";
import { randomSeed } from "../../../../shared/exercises/random.ts";
import type { ExerciseLevel, ExerciseType } from "../../../../shared/exercises/types.ts";
import { Button } from "../../../components/ui/button.tsx";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { levelLabel } from "../linalg/common.tsx";

export function GeneratedPractice<I>({ type, View, firstSeed = 1 }: { type: ExerciseType<I>; View: ComponentType<{ instance: I; onSolved?: () => void }>; firstSeed?: number }) {
  const [level, setLevel] = useState<ExerciseLevel>(type.levels[0]!);
  const [seed, setSeed] = useState(firstSeed);
  const instance = useMemo(() => type.generate(seed, level), [type, seed, level]);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          value={level}
          aria-label="Nivel"
          className="grid max-w-full grid-cols-3 self-start sm:inline-flex"
          onValueChange={(v) => {
            const l = type.levels.find((x) => x === v);
            if (l) setLevel(l);
          }}
        >
          {type.levels.map((l) => (
            <ToggleGroupItem key={l} value={l}>
              {levelLabel(l)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button onClick={() => setSeed(randomSeed())}>
          <SkipForward size={16} aria-hidden="true" />
          Otro ejercicio
        </Button>
      </div>
      <View key={`${type.id}|${seed}|${level}`} instance={instance} />
    </div>
  );
}
