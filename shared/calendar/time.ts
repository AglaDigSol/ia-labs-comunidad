// Motor de zonas horarias solo con Intl (sin dependencias). Las cuentas usan los offsets reales de
// cada zona en cada instante: no hay fechas de cambio de hora escritas a mano.
export const ES = "Europe/Madrid";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: string };

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("es-ES", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    });
    formatters.set(tz, f);
  }
  return f;
}

export function isValidZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("es-ES", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function parts(tz: string, ms: number): Parts {
  const o: Record<string, string> = {};
  for (const p of formatter(tz).formatToParts(new Date(ms))) o[p.type] = p.value;
  return {
    year: Number(o.year),
    month: Number(o.month),
    day: Number(o.day),
    hour: o.hour === "24" ? 0 : Number(o.hour),
    minute: Number(o.minute),
    second: Number(o.second),
    weekday: (o.weekday ?? "").replace(/\.$/, ""),
  };
}

/** Minutos al este de UTC de `tz` en el instante `ms`. */
export function offsetMin(tz: string, ms: number): number {
  const p = parts(tz, ms);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / MIN);
}

/** Hora de pared "aaaa-mm-ddThh:mm" en `tz` → instante (ms). En la hora repetida elige la primera. */
export function wallToMs(wall: string, tz: string = ES): number {
  const [d = "", t = "00:00"] = wall.split("T");
  const [y = 1970, mo = 1, dd = 1] = d.split("-").map(Number);
  const [h = 0, mi = 0] = t.split(":").map(Number);
  const naive = Date.UTC(y, mo - 1, dd, h, mi);
  const first = naive - offsetMin(tz, naive - 3 * HOUR) * MIN;
  if (offsetMin(tz, first) * MIN === naive - first) return first;
  const second = naive - offsetMin(tz, naive + 3 * HOUR) * MIN;
  if (offsetMin(tz, second) * MIN === naive - second) return second;
  // Hora inexistente (salto de primavera): se adelanta al primer minuto válido.
  return naive - offsetMin(tz, naive) * MIN;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function civilDate(tz: string, ms: number): string {
  const p = parts(tz, ms);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function fmtTime(tz: string, ms: number): string {
  const p = parts(tz, ms);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** «lun 27/10» */
export function fmtDay(tz: string, ms: number): string {
  const p = parts(tz, ms);
  return `${p.weekday} ${pad(p.day)}/${pad(p.month)}`;
}

/** −1, 0 o +1: el día civil en `tz` respecto al de `ref`. */
export function dayShift(tz: string, ms: number, ref: string = ES): -1 | 0 | 1 {
  const a = civilDate(tz, ms);
  const b = civilDate(ref, ms);
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Diferencia en minutos entre Madrid y `tz` (positiva si Madrid va por delante). */
export function diffFromMadrid(tz: string, ms: number): number {
  return offsetMin(ES, ms) - offsetMin(tz, ms);
}

export type OffsetChange = { atMs: number; beforeMin: number; afterMin: number };

/**
 * Cambios de la diferencia Madrid ↔ `tz` entre `from` y `from + days`. Recorre en pasos de 1 h y
 * busca el minuto exacto por bisección.
 */
export function offsetChanges(tz: string, from: number, days = 7): OffsetChange[] {
  const out: OffsetChange[] = [];
  const end = from + days * DAY;
  let a = from;
  let da = diffFromMadrid(tz, a);
  while (a < end) {
    const b = Math.min(a + HOUR, end);
    const db = diffFromMadrid(tz, b);
    if (db !== da) {
      let lo = a;
      let hi = b;
      while (hi - lo > MIN) {
        const mid = lo + Math.floor((hi - lo) / MIN / 2) * MIN;
        if (diffFromMadrid(tz, mid) === da) lo = mid;
        else hi = mid;
      }
      out.push({ atMs: hi, beforeMin: da, afterMin: db });
    }
    a = b;
    da = db;
  }
  return out;
}

/** «7 h», «−1 h 30 min». */
export function fmtDiff(min: number): string {
  const sign = min < 0 ? "−" : "";
  const m = Math.abs(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${sign}${h} h${r ? ` ${r} min` : ""}`;
}

export function formatCountdown(deltaMs: number): string {
  const ms = Math.max(0, deltaMs);
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  const m = Math.floor((ms % HOUR) / MIN);
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${pad(m)} min`;
  return `${m} min`;
}
