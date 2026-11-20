/**
 * Formateo y conversión de fechas según la zona horaria del usuario.
 * Respeta DST, cambios de día y fechas de día completo.
 */

import { isValidIanaTimezone } from "./iana.ts";

/**
 * Formatea una fecha o instante ISO en la zona IANA especificada.
 */
export function formatInTimezone(
  dateOrIso: Date | string,
  iana: string,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
): string {
  const date = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  if (isNaN(date.getTime())) return "Fecha no válida";

  const targetTz = isValidIanaTimezone(iana) ? iana : "UTC";
  try {
    return new Intl.DateTimeFormat("es-ES", {
      ...options,
      timeZone: targetTz,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/**
 * Obtiene componentes de fecha (año, mes, día, hora, minutos) en la zona horaria indicada.
 */
export function getDatePartsInTimezone(dateOrIso: Date | string, iana: string) {
  const date = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  const targetTz = isValidIanaTimezone(iana) ? iana : "UTC";

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: targetTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";

  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    hour: parseInt(get("hour"), 10),
    minute: parseInt(get("minute"), 10),
    second: parseInt(get("second"), 10),
    isoDate: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

/**
 * Comprueba si dos fechas corresponden al mismo día en la zona horaria dada.
 */
export function isSameDayInTimezone(d1: Date | string, d2: Date | string, iana: string): boolean {
  const p1 = getDatePartsInTimezone(d1, iana);
  const p2 = getDatePartsInTimezone(d2, iana);
  return p1.year === p2.year && p1.month === p2.month && p1.day === p2.day;
}

/**
 * Formatea un rango horario en una zona (ej: "18:00 – 19:30").
 */
export function formatTimeRangeInTimezone(
  startOrIso: Date | string,
  endOrIso: Date | string | undefined,
  iana: string,
): string {
  const startStr = formatInTimezone(startOrIso, iana, { hour: "2-digit", minute: "2-digit" });
  if (!endOrIso) return startStr;
  const endStr = formatInTimezone(endOrIso, iana, { hour: "2-digit", minute: "2-digit" });
  return `${startStr} – ${endStr}`;
}
