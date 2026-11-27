// Mes voyages : liste des voyages planifiés, à venir et passés.
import { Plane, Plus, CalendarDays, MapPin, ArrowUpRight } from "lucide-react";
import { useApp } from "../lib/store.jsx";
import { useWorld } from "../lib/useWorld.js";
import PageHeader, { LoginGate } from "../components/PageHeader.jsx";
import { Empty, Flag, SectionHeading } from "../components/ui.jsx";
import { daysUntil } from "./Home.jsx";

export const formatDate = (d) => (d ? new Date(`${d}T12:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "");

export default function Trips() {
  const { user, trips, openTripForm } = useApp();
  const { byCode } = useWorld();
  const header = <PageHeader title="Mes voyages" subtitle="Transformez vos lieux favoris en voyages inoubliables." />;
  if (!user) return <>{header}<LoginGate title="Planifiez vos prochains voyages" text="Créez un compte pour organiser vos voyages étape par étape, avec carte et itinéraire." /></>;

  const upcoming = trips.filter((t) => !t.endDate || daysUntil(t.endDate) >= 0);
  const past = trips.filter((t) => t.endDate && daysUntil(t.endDate) < 0);

  const card = (t) => {
    const country = byCode?.[t.countryCode];
    const left = t.startDate ? daysUntil(t.startDate) : null;
    return (
      <a className="trip" key={t.id} href={`#/voyages/${t.id}`}>
        {country ? <Flag code={country.code} size={34} emoji={country.emoji} /> : <Plane />}
        <div>
          <small className="eyebrow">{left === null ? "DATES À DÉFINIR" : left > 0 ? `DÉPART DANS ${left} JOUR${left > 1 ? "S" : ""}` : left === 0 ? "DÉPART AUJOURD'HUI" : daysUntil(t.endDate || t.startDate) >= 0 ? "EN COURS" : "TERMINÉ"}</small>
          <h3>{t.name}</h3>
          <p><MapPin size={14} /> {country?.name || "Plusieurs destinations"} · {t.stops.length} étape{t.stops.length > 1 ? "s" : ""}</p>
          <p><CalendarDays size={14} /> {t.startDate ? `${formatDate(t.startDate)}${t.endDate ? ` — ${formatDate(t.endDate)}` : ""}` : "Dates non définies"}</p>
        </div>
        <ArrowUpRight size={18} className="trip-arrow" />
      </a>
    );
  };

  return <>
    {header}
    <SectionHeading title="À venir" action={<button className="dark-button" onClick={() => openTripForm()}><Plus size={16} /> Nouveau voyage</button>} />
    {upcoming.map(card)}
    {!upcoming.length && <Empty title="Aucun voyage prévu" text="Créez votre premier voyage et ajoutez-y des étapes depuis n'importe quelle fiche de lieu." action="Créer un voyage" onAction={() => openTripForm()} />}
    {past.length > 0 && <><SectionHeading title="Souvenirs" />{past.map(card)}</>}
  </>;
}
