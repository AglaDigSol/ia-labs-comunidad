// «Página no encontrada»: lo que se ve en una ruta que no existe, en la app y dentro del área de
// laboratorios (en lugar de redirigir en silencio a Simbología). Enlaza el inicio y los laboratorios.
import { FlaskConical, Home, SearchX } from "lucide-react";
import { Link } from "react-router";
import { buttonVariants } from "../ui/button.tsx";

export interface NotFoundPageProps {
  /** Ruta del inicio; con null no hay enlace (una app anfitriona sin inicio). */
  homeHref?: string | null;
  /** Ruta del área de laboratorios. */
  labsHref?: string;
}

export function NotFoundPage({ homeHref = "/", labsHref = "/laboratorios" }: NotFoundPageProps) {
  return (
    <section aria-labelledby="no-encontrada" className="flex flex-col items-start gap-4 py-6" data-not-found="">
      <SearchX size={40} strokeWidth={1.5} aria-hidden="true" className="text-muted" />
      <h1 id="no-encontrada" tabIndex={-1} className="font-display text-[28px] font-semibold leading-[1.2]">
        Página no encontrada
      </h1>
      <p className="text-muted">Esta dirección no existe en la app. Puede que el enlace esté mal escrito o que la página haya cambiado de sitio.</p>
      <div className="flex flex-wrap gap-2">
        {homeHref !== null ? (
          <Link to={homeHref} className={buttonVariants({ variant: "primary" })}>
            <Home size={16} strokeWidth={1.75} aria-hidden="true" />
            Ir al inicio
          </Link>
        ) : null}
        <Link to={labsHref} className={buttonVariants({ variant: homeHref === null ? "primary" : "secondary" })}>
          <FlaskConical size={16} strokeWidth={1.75} aria-hidden="true" />
          Ir a los laboratorios
        </Link>
      </div>
    </section>
  );
}
