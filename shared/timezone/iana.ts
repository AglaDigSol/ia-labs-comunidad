/**
 * Catálogo y utilidades de zonas horarias IANA para Docentes 2.0 / IA Labs.
 * Conforme a CAL-08: Identificadores IANA, detección de dispositivo con Intl,
 * selector buscable, sin geolocalización GPS, con persistencia local tolerante a fallos.
 */

export interface TimezoneOption {
  readonly iana: string;
  readonly label: string;
  readonly region: string;
  readonly referenceCity: string;
}

/**
 * Catálogo de zonas IANA relevantes para estudiantes de habla hispana y servidores.
 */
export const POPULAR_TIMEZONES: readonly TimezoneOption[] = [
  { iana: "Europe/Madrid", label: "Madrid / Península", region: "España", referenceCity: "Madrid" },
  { iana: "Atlantic/Canary", label: "Canarias", region: "España", referenceCity: "Las Palmas / Tenerife" },
  { iana: "America/Caracas", label: "Caracas", region: "Venezuela", referenceCity: "Caracas" },
  { iana: "America/Bogota", label: "Bogotá", region: "Colombia", referenceCity: "Bogotá" },
  { iana: "America/Mexico_City", label: "Ciudad de México", region: "México", referenceCity: "Ciudad de México" },
  { iana: "America/Chicago", label: "Houston / Servidor", region: "Estados Unidos", referenceCity: "Houston" },
  { iana: "America/New_York", label: "Miami / Nueva York", region: "Estados Unidos", referenceCity: "Miami" },
  { iana: "America/Argentina/Buenos_Aires", label: "Buenos Aires", region: "Argentina", referenceCity: "Buenos Aires" },
  { iana: "America/Santiago", label: "Santiago de Chile", region: "Chile", referenceCity: "Santiago" },
  { iana: "America/Lima", label: "Lima", region: "Perú", referenceCity: "Lima" },
  { iana: "America/Guayaquil", label: "Quito / Guayaquil", region: "Ecuador", referenceCity: "Quito" },
  { iana: "America/Montevideo", label: "Montevideo", region: "Uruguay", referenceCity: "Montevideo" },
  { iana: "America/Santo_Domingo", label: "Santo Domingo", region: "República Dominicana", referenceCity: "Santo Domingo" },
  { iana: "America/Panama", label: "Panamá", region: "Panamá", referenceCity: "Panamá" },
  { iana: "America/Costa_Rica", label: "San José", region: "Costa Rica", referenceCity: "San José" },
  { iana: "UTC", label: "Tiempo Universal Coordinado (UTC)", region: "Global", referenceCity: "UTC" },
] as const;

export const DEFAULT_SOURCE_TIMEZONE = "Europe/Madrid";

const TZ_STORAGE_KEY = "ia_labs_preferred_timezone";

/**
 * Detecta la zona horaria del dispositivo del usuario usando la API estándar Intl.
 * Si falla o no está disponible, recurre a DEFAULT_SOURCE_TIMEZONE.
 */
export function detectDeviceTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (isValidIanaTimezone(tz)) {
      return tz;
    }
  } catch {
    // Entornos sin Intl o soporte limitado
  }
  return DEFAULT_SOURCE_TIMEZONE;
}

/**
 * Comprueba si una cadena es un identificador de zona IANA válido.
 */
export function isValidIanaTimezone(tz: string): boolean {
  if (!tz || typeof tz !== "string" || tz.trim() === "") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Obtiene la zona preferida guardada localmente o la del dispositivo.
 */
export function getSavedTimezone(): string {
  try {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(TZ_STORAGE_KEY);
      if (saved && isValidIanaTimezone(saved)) {
        return saved;
      }
    }
  } catch {
    // Almacenamiento restringido o en modo incógnito
  }
  return detectDeviceTimezone();
}

/**
 * Guarda la zona horaria preferida en localStorage (tolerante a fallos de almacenamiento).
 */
export function saveTimezone(iana: string): boolean {
  if (!isValidIanaTimezone(iana)) return false;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(TZ_STORAGE_KEY, iana);
      return true;
    }
  } catch {
    // Almacenamiento no disponible
  }
  return false;
}

/**
 * Borra la zona guardada para volver a la detección automática del dispositivo.
 */
export function resetSavedTimezone(): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(TZ_STORAGE_KEY);
    }
  } catch {
    // noop
  }
}

/**
 * Calcula el desplazamiento UTC actual de una zona IANA en minutos para una fecha dada.
 */
export function getTimezoneOffsetMinutes(iana: string, date: Date = new Date()): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: iana,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    // Parsea GMT, GMT+1, GMT-5, GMT+03:30
    const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(tzPart);
    if (!match) return 0;
    const sign = match[1] === "-" ? -1 : 1;
    const hours = parseInt(match[2], 10);
    const mins = match[3] ? parseInt(match[3], 10) : 0;
    return sign * (hours * 60 + mins);
  } catch {
    return 0;
  }
}

/**
 * Devuelve una etiqueta legible del desplazamiento, ej. "UTC+02:00" o "UTC-05:00".
 */
export function formatTimezoneOffset(iana: string, date: Date = new Date()): string {
  const offsetMins = getTimezoneOffsetMinutes(iana, date);
  const sign = offsetMins >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMins);
  const hours = Math.floor(abs / 60).toString().padStart(2, "0");
  const mins = (abs % 60).toString().padStart(2, "0");
  return `UTC${sign}${hours}:${mins}`;
}
