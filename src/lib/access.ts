// Frase de acceso opcional (ver README, «Acceso con frase»). El control real lo hace nginx en el
// servidor; aquí solo se borra la cookie para «Salir».
export const ACCESS_COOKIE = "labs_key";

export function hasAccessCookie(cookie: string = typeof document === "undefined" ? "" : document.cookie): boolean {
  return cookie.split(";").some((c) => c.trim().startsWith(`${ACCESS_COOKIE}=`));
}

export function clearAccessCookie(): void {
  try {
    document.cookie = `${ACCESS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
  } catch {
    // sin cookies
  }
}
