// Page d'accueil : recherche, statistiques, pays à la une (change chaque jour), continents, prochain voyage.
import { useState } from "react";
import { ArrowUpRight, Search, Sparkles, Globe2, Map, Bookmark, Plane, Plus, CalendarDays, MapPin } from "lucide-react";
import { useApp } from "../lib/store.jsx";
import { useAsync, useWorld } from "../lib/useWorld.js";
import { getCountryFacts, getDestinations, getSummary } from "../lib/world.js";
import { navigate } from "../lib/router.js";
import PageHeader from "../components/PageHeader.jsx";
import { ErrorBox, Flag, PlaceCard, SectionHeading, SkeletonGrid } from "../components/ui.jsx";

const FEATURED = ["JP", "IT", "MA", "PE", "IS", "DZ", "TR", "MX", "ID", "NZ", "EG", "GR", "VN", "PT", "AR", "ZA", "NO", "TH", "JO", "CA", "CL", "KE", "ES", "IN", "CN", "GB", "TN", "TZ", "CH", "FR"];
const CONTINENTS = [
  ["Afrique", "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=700&q=80"],
  ["Europe", "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=700&q=80"],
  ["Asie", "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=700&q=80"],
  ["Amériques", "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=700&q=80"],
  ["Océanie", "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=700&q=80"],
];

// Coupe un texte long à la fin d'une phrase, vers 320 caractères.
export function shortText(text, max = 320) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = cut.lastIndexOf(". ");
  return end > 120 ? cut.slice(0, end + 1) : `${cut.trim()}…`;
}

export const daysUntil = (date) => Math.ceil((new Date(`${date}T00:00`) - new Date(new Date().toDateString())) / 86400000);

export default function Home() {
  const { user, saved, countries: statuses, trips, openTripForm } = useApp();
  const { countries, byCode } = useWorld();
  const [query, setQuery] = useState("");

  const visited = Object.values(statuses).filter((s) => s === "visited").length;
  const total = countries ? countries.filter((c) => c.independent).length : 195;
  const upcoming = trips.filter((t) => t.startDate && daysUntil(t.startDate) >= 0).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const featuredCode = FEATURED[Math.floor(Date.now() / 86400000) % FEATURED.length];

  const stats = user
    ? [[Globe2, "Pays visités", visited, "Votre voyage jusqu'ici"], [Map, "Monde exploré", `${((visited / total) * 100).toFixed(1)} %`, `Sur ${total} pays`],
      [Bookmark, "Lieux favoris", saved.length, "Sur votre liste d'envies"], [Plane, "Voyages", trips.length, "En préparation"]]
    : [[Globe2, "Pays et territoires", countries?.length || 250, "Tous sur la carte"], [Map, "Destinations", "100 000+", "Villes, sites, parcs"],
      [Bookmark, "Favoris", "∞", "Gardez vos coups de cœur"], [Plane, "Voyages", "Gratuit", "Planifiez étape par étape"]];

  function submit(event) {
    event.preventDefault();
    if (query.trim()) navigate(`/explorer?q=${encodeURIComponent(query.trim())}`);
  }

  return <>
    <PageHeader title={user ? `Bonjour, ${user.name.split(" ")[0]}.` : "Bienvenue, explorateur·rice."} subtitle="Chaque voyage commence par un peu de curiosité." />

    <section className="hero">
      <div className="hero-copy">
        <small><Sparkles size={14} /> VOTRE HISTOIRE, VOTRE CARTE</small>
        <h2>Le monde entier<br /><em>vous attend.</em></h2>
        <p>Explorez chaque pays, découvrez ses plus beaux lieux, gardez vos favoris et planifiez vos prochains voyages.</p>
        <form className="hero-search" onSubmit={submit}>
          <Search size={17} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Une ville, un pays, un monument…" aria-label="Rechercher une destination" />
          <button className="light-button">Chercher <ArrowUpRight size={15} /></button>
        </form>
      </div>
      <label>⌖ Côte amalfitaine, Italie</label>
    </section>

    <section className="stats">{stats.map(([Icon, label, value, note]) => (
      <div className="stat" key={label}><Icon size={18} /><small>{label}</small><b>{value}</b><span>{note}</span></div>
    ))}</section>

    {byCode?.[featuredCode] && <FeaturedCountry country={byCode[featuredCode]} />}

    <SectionHeading eyebrow="PAR OÙ COMMENCER ?" title="Explorer par continent" action={<a className="text-link" href="#/explorer">Tous les pays <ArrowUpRight size={15} /></a>} />
    <div className="continents">{CONTINENTS.map(([name, image]) => (
      <a key={name} href={`#/explorer?region=${encodeURIComponent(name)}`} style={{ backgroundImage: `linear-gradient(transparent 30%, #1e392fcc), url(${image})` }}>
        <b>{name}</b><small>{countries ? `${countries.filter((c) => c.region === name).length} pays et territoires` : " "}</small>
      </a>
    ))}</div>

    {upcoming ? (
      <section className="callout">
        <div>
          <small className="eyebrow">PROCHAIN DÉPART · {daysUntil(upcoming.startDate) === 0 ? "AUJOURD'HUI" : `DANS ${daysUntil(upcoming.startDate)} JOUR${daysUntil(upcoming.startDate) > 1 ? "S" : ""}`}</small>
          <h3>{upcoming.name}</h3>
          <p><CalendarDays size={13} /> {new Date(`${upcoming.startDate}T12:00`).toLocaleDateString("fr-FR", { dateStyle: "long" })}
            {upcoming.countryCode && byCode?.[upcoming.countryCode] && <> · <MapPin size={13} /> {byCode[upcoming.countryCode].name}</>}</p>
        </div>
        <a className="dark-button" href={`#/voyages/${upcoming.id}`}>Voir le voyage <ArrowUpRight size={16} /></a>
      </section>
    ) : (
      <section className="callout">
        <div><small className="eyebrow">VOTRE PROCHAIN CHAPITRE</small><h3>Prêt·e pour une nouvelle aventure ?</h3><p>Créez un voyage et rassemblez toutes vos étapes au même endroit.</p></div>
        <button className="dark-button" onClick={() => openTripForm()}>Créer un voyage <Plus size={16} /></button>
      </section>
    )}
  </>;
}

function FeaturedCountry({ country }) {
  const destinations = useAsync(() => getDestinations(country.code), [country.code]);
  const facts = useAsync(async () => {
    const f = await getCountryFacts(country.code);
    return f.wikiTitle ? getSummary(f.wikiTitle, f.wikiLang) : null;
  }, [country.code]);
  const top = (destinations.data || []).filter((d) => d.image).slice(0, 3);

  return <>
    <SectionHeading eyebrow="PAYS À LA UNE AUJOURD'HUI" title={<span className="title-flag"><Flag code={country.code} size={30} emoji={country.emoji} /> {country.name}</span>}
      action={<a className="text-link" href={`#/pays/${country.code}`}>Découvrir le pays <ArrowUpRight size={15} /></a>} />
    {facts.data?.extract && <p className="lead">{shortText(facts.data.extract)}</p>}
    {destinations.loading && <SkeletonGrid count={3} />}
    {destinations.error && <ErrorBox message="Les destinations n'ont pas pu être chargées." onRetry={destinations.retry} />}
    {top.length > 0 && <div className="grid">{top.map((p) => <PlaceCard key={p.id} place={p} countryName={country.name} />)}</div>}
  </>;
}

