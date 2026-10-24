// Lista corta de ciudades para «Mi ciudad» (zona IANA). «Otra zona» usa Intl.supportedValuesOf.
export const CITIES: Array<{ label: string; tz: string }> = [
  { label: "Madrid", tz: "Europe/Madrid" },
  { label: "Canarias", tz: "Atlantic/Canary" },
  { label: "Lisboa", tz: "Europe/Lisbon" },
  { label: "Londres", tz: "Europe/London" },
  { label: "Ciudad de México", tz: "America/Mexico_City" },
  { label: "Guatemala", tz: "America/Guatemala" },
  { label: "San Salvador", tz: "America/El_Salvador" },
  { label: "Tegucigalpa", tz: "America/Tegucigalpa" },
  { label: "Managua", tz: "America/Managua" },
  { label: "San José", tz: "America/Costa_Rica" },
  { label: "Panamá", tz: "America/Panama" },
  { label: "Bogotá", tz: "America/Bogota" },
  { label: "Quito", tz: "America/Guayaquil" },
  { label: "Lima", tz: "America/Lima" },
  { label: "Caracas", tz: "America/Caracas" },
  { label: "Santo Domingo", tz: "America/Santo_Domingo" },
  { label: "La Paz", tz: "America/La_Paz" },
  { label: "Asunción", tz: "America/Asuncion" },
  { label: "Santiago", tz: "America/Santiago" },
  { label: "Buenos Aires", tz: "America/Argentina/Buenos_Aires" },
  { label: "Montevideo", tz: "America/Montevideo" },
  { label: "Houston/Chicago", tz: "America/Chicago" },
  { label: "Miami/Nueva York", tz: "America/New_York" },
  { label: "Los Ángeles", tz: "America/Los_Angeles" },
];

/** Nombre corto para mostrar una zona: la ciudad de la lista o el último tramo del id IANA. */
export function zoneLabel(tz: string): string {
  const c = CITIES.find((x) => x.tz === tz);
  if (c) return c.label;
  return (tz.split("/").pop() ?? tz).replace(/_/g, " ");
}

export function detectZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid";
  } catch {
    return "Europe/Madrid";
  }
}

export function allZones(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    return fn ? fn("timeZone") : CITIES.map((c) => c.tz);
  } catch {
    return CITIES.map((c) => c.tz);
  }
}
