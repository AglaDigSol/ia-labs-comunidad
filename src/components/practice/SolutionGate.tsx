import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "../ui/button.tsx";

export const REVEAL_LABEL = "Ver la solución completa";
export const HIDE_LABEL = "Ocultar la solución";
export const INTEGRITY_NOTE =
  "Primero inténtalo tú. Usa la solución para entender el procedimiento, no para copiar respuestas de actividades evaluables.";

/**
 * Modo «Comprueba tu respuesta»: la solución completa (tablas, pasos, resultados) queda detrás de una
 * acción explícita. Se vuelve a ocultar cuando cambia `resetKey` (por ejemplo, otra fórmula).
 */
export function SolutionGate({ resetKey, children }: { resetKey?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [resetKey]);
  if (open) {
    return (
      <div className="flex flex-col gap-4" data-testid="solution">
        <div>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            <EyeOff size={16} aria-hidden="true" />
            {HIDE_LABEL}
          </Button>
        </div>
        {children}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border p-3">
      <p className="flex items-start gap-2 text-[14px] text-muted">
        <ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" className="mt-1 shrink-0" />
        {INTEGRITY_NOTE}
      </p>
      <Button onClick={() => setOpen(true)}>
        <Eye size={16} aria-hidden="true" />
        {REVEAL_LABEL}
      </Button>
    </div>
  );
}
