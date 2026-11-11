// «Repaso de hoy» del inicio (módulo flashcards): cuántas tarjetas tocan hoy y el botón para repasarlas.
// Chunk aparte: el almacén de las flashcards y las barajas del diccionario solo se cargan si el módulo
// está encendido.
import { Layers } from "lucide-react";
import { Link } from "react-router";
import { buttonVariants } from "../../components/ui/button.tsx";
import { t } from "../../i18n/index.ts";
import { localCivilDate } from "../../../shared/date.ts";
import { addDays } from "../../../shared/srs/sm2.ts";
import { useDueSummary } from "../../lib/cards-store.ts";
import { useNow } from "../../lib/use-now.ts";
import { HomeCard } from "./HomeCard.tsx";

const tarjetas = (n: number) => (n === 1 ? "1 tarjeta" : `${n} tarjetas`);
const dayLabel = (date: string, today: string) => (date === addDays(today, 1) ? "mañana" : `${date.slice(8, 10)}/${date.slice(5, 7)}`);

export function HomeReview() {
  const summary = useDueSummary();
  const today = localCivilDate(useNow(60_000));
  const n = summary.total;
  return (
    <HomeCard title={t.home.reviewTitle} icon={Layers}>
      {n > 0 ? (
        <>
          <p>
            <span className="mono font-semibold">{n}</span> {n === 1 ? "tarjeta para hoy" : "tarjetas para hoy"}
          </p>
          <div className="mt-auto">
            <Link to="/flashcards/repaso" className={buttonVariants({ variant: "primary" })}>
              {`Repasar ${tarjetas(n)}`}
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="text-muted">
            {summary.next ? `No te toca ninguna tarjeta hoy. Próximo repaso: ${dayLabel(summary.next.date, today)}.` : "No te toca ninguna tarjeta hoy."}
          </p>
          <div className="mt-auto">
            <Link to="/flashcards" className={buttonVariants({ variant: "secondary" })}>
              Ver los mazos
            </Link>
          </div>
        </>
      )}
    </HomeCard>
  );
}
