// «Mis grupos» guardados (pref/calGroups), con la migración desde la preferencia global antigua
// (pref/calGroup y pref/calSlot): mientras no se elija nada aquí, cada materia toma la antigua.
import { useCallback, useMemo } from "react";
import { effectiveGroupPrefs, subjectGroups, type GroupChoice, type GroupPrefs, type SubjectGroups } from "../../../shared/calendar/groups.ts";
import type { CalendarEvent } from "../../../shared/calendar/types.ts";
import { keys } from "../../../shared/keys.ts";
import { setKv, useKv } from "../../lib/kv-store.ts";

export function useGroupPrefs(events: readonly CalendarEvent[]): {
  options: SubjectGroups[];
  prefs: GroupPrefs;
  setChoice: (materia: string, choice: GroupChoice) => void;
} {
  const options = useMemo(() => subjectGroups(events), [events]);
  const stored = useKv<unknown>(keys.pref.calGroups, undefined);
  const grupo = useKv<unknown>(keys.pref.calGroup, undefined);
  const franja = useKv<unknown>(keys.pref.calSlot, undefined);
  const prefs = useMemo(() => effectiveGroupPrefs(stored, { grupo, franja }, options), [stored, grupo, franja, options]);
  const setChoice = useCallback(
    (materia: string, choice: GroupChoice) => {
      // Se guarda la elección de todas las materias: así la migración queda hecha de una vez. Las
      // materias guardadas que hoy no tienen grupos se conservan.
      const prev = stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as GroupPrefs) : {};
      setKv(keys.pref.calGroups, { ...prev, ...prefs, [materia]: { grupo: choice.grupo, franja: choice.franja } });
    },
    [stored, prefs],
  );
  return { options, prefs, setChoice };
}
