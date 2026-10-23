import { useState } from "react";
import type { Course } from "../../../shared/courses/types.ts";
import { keys } from "../../../shared/keys.ts";
import { Button } from "../../components/ui/button.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog.tsx";
import { deleteKv } from "../../lib/kv-store.ts";

export function ResetGradesDialog({ course, onReset }: { course: Course; onReset: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="border-destructive text-destructive">
          Restablecer notas
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Confirmar restablecimiento</DialogTitle>
        <DialogDescription>
          {`Restablecer notas: se borrarán las notas de ${course.id} guardadas en este navegador. No se puede deshacer.`}
        </DialogDescription>
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="secondary">Conservar notas</Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={() => {
              onReset();
              for (const c of course.components) deleteKv(keys.grade(course.id, c.id));
              setOpen(false);
            }}
          >
            Restablecer notas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
