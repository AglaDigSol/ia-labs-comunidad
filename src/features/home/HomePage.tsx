// «Inicio» de la app independiente: qué viene ahora en pocos segundos. «Continuar» (lo último que se
// hizo en los laboratorios, de recent.ts), el repaso de hoy de las flashcards y lo próximo del
// calendario (si sus módulos están encendidos) y una ranura «Comunidad» que solo aparece si el
// despliegue la rellena. El repaso y el calendario son chunks perezosos: el inicio pinta enseguida.
import { ArrowRight, FlaskConical, Users } from "lucide-react";
import { lazy, Suspense, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { buttonVariants } from "../../components/ui/button.tsx";
import { t } from "../../i18n/index.ts";
import { safeHttpsUrl } from "../../lib/safe-url.ts";
import { latestActivity, loadRecent } from "../labs/recent.ts";
import { HomeCard } from "./HomeCard.tsx";

const HomeReview = lazy(() => import("./HomeReview.tsx").then((m) => ({ default: m.HomeReview })));
const HomeNext = lazy(() => import("./HomeNext.tsx").then((m) => ({ default: m.HomeNext })));

export interface HomePageProps {
  /** Tarjeta «Repaso de hoy» (módulo flashcards). */
  flashcards?: boolean;
  /** Tarjeta «Próximo en el calendario» (módulo calendario). */
  calendar?: boolean;
  /** Ranura «Comunidad»: lo que ponga el despliegue (por defecto, nada). */
  community?: ReactNode;
  /** Ruta del área de laboratorios. */
  labsPath?: string;
}

function CardFallback() {
  return <div aria-hidden="true" className="min-h-[148px] animate-pulse rounded-lg bg-sunken motion-reduce:animate-none" />;
}

export function HomePage({ flashcards = false, calendar = false, community = null, labsPath = "/laboratorios" }: HomePageProps) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 tabIndex={-1} className="font-display text-[28px] font-semibold leading-[1.2]">
          {t.home.title}
        </h1>
        <p className="text-muted">{t.home.intro}</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <ContinueCard labsPath={labsPath} />
        {calendar ? (
          <Suspense fallback={<CardFallback />}>
            <HomeNext />
          </Suspense>
        ) : null}
        {flashcards ? (
          <Suspense fallback={<CardFallback />}>
            <HomeReview />
          </Suspense>
        ) : null}
        {community}
      </div>
    </div>
  );
}

/** «Continuar»: la última pestaña o el último ejercicio; sin nada guardado, «Empezar por Simbología». */
function ContinueCard({ labsPath }: { labsPath: string }) {
  const [last] = useState(() => latestActivity(loadRecent()));
  const base = labsPath.replace(/\/+$/, "");
  return (
    <HomeCard title={t.home.continueTitle} icon={FlaskConical}>
      {last ? (
        <>
          <p>
            {last.kind === "exercise" ? (
              <>
                <span className="text-muted">{t.home.lastExercise} </span>
                <span className="font-semibold">{last.label}</span>
                <span className="text-muted">{` · nivel ${last.level}`}</span>
              </>
            ) : (
              <>
                <span className="text-muted">{t.home.lastLab} </span>
                <span className="font-semibold">{last.label}</span>
              </>
            )}
          </p>
          <div className="mt-auto">
            <Link to={`${base}/${last.href}`} className={buttonVariants({ variant: "primary" })}>
              {t.home.continueAction}
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="text-muted">{t.home.firstVisit}</p>
          <div className="mt-auto">
            <Link to={`${base}/simbolos`} className={buttonVariants({ variant: "primary" })}>
              {t.home.startAction}
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
        </>
      )}
    </HomeCard>
  );
}

/**
 * Tarjeta «Comunidad» para la ranura del inicio: un enlace https que se abre en otra pestaña. Con una
 * dirección vacía o que no sea https no pinta nada.
 */
export function CommunityCard({ href, description = t.home.communityText }: { href: string | undefined; description?: string }) {
  const url = safeHttpsUrl(href);
  if (!url) return null;
  return (
    <HomeCard title={t.home.communityTitle} icon={Users}>
      <p className="text-muted">{description}</p>
      <div className="mt-auto">
        <a href={url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary" })}>
          {t.home.communityAction}
          <span className="sr-only"> (se abre en otra pestaña)</span>
        </a>
      </div>
    </HomeCard>
  );
}
