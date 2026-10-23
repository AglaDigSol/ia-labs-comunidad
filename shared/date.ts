// Fecha civil (aaaa-mm-dd) en la zona horaria del navegador. El repaso SM-2 cuenta días civiles.
const pad = (n: number) => String(n).padStart(2, "0");

export function localCivilDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
