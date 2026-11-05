// Tiempos de los simulacros (02MIAR y 01MIAR): el reloj que queda y lo que se tardó.

/** «1:59:30» o «4:05». */
export function clockText(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (x: number) => String(x).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}

/** «1 h 23 min», «12 min», «45 s». */
export function durationText(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h${m > 0 ? ` ${m} min` : ""}`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

/** «Quedan 15 minutos.» */
export const remainingAnnouncement = (m: number) => (m === 1 ? "Queda 1 minuto." : `Quedan ${m} minutos.`);

/** Avisos del reloj: cada 15 minutos, a los 5 y al último minuto. */
export function announcementMarks(totalMinutes: number): number[] {
  const out: number[] = [];
  for (let m = Math.floor((totalMinutes - 1) / 15) * 15; m >= 15; m -= 15) out.push(m);
  out.push(5, 1);
  return [...new Set(out)].filter((m) => m < totalMinutes).sort((a, b) => b - a);
}
