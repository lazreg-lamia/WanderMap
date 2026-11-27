// Fiche d'un pays : drapeau, chiffres clés, présentation Wikipédia, carte, destinations, pays voisins.
import { useMemo, useState } from "react";
import { Check, Star, ExternalLink, CalendarDays, ArrowLeft, Users, Ruler, Landmark, Languages, Coins, Globe2 } from "lucide-react";
import { useApp } from "../lib/store.jsx";
import { useAsync, useWorld } from "../lib/useWorld.js";
import { formatNumber, getCountryFacts, getDestinations, getSummary, KIND_LABELS } from "../lib/world.js";
import { navigate } from "../lib/router.js";
import WorldMap from "../components/WorldMap.jsx";
import { Empty, ErrorBox, Flag, PlaceCard, SectionHeading, SkeletonGrid, Spinner } from "../components/ui.jsx";

const TABS = ["all", "city", "unesco", "nature", "attraction"];

export default function Country({ code }) {
  const world = useWorld();
  if (world.loading) return <Spinner label="Chargement..." />;
  if (world.error) return <ErrorBox message="Impossible de charger les pays." onRetry={world.retry} />;
  const country = world.byCode[code];
  if (!country) return <Empty title="Pays introuvable" text={`Aucun pays ne correspond au code « ${code} ».`} action="Explorer le monde" onAction={() => navigate("/explorer")} />;
  return <CountryView key={code} country={country} world={world} />;
}

function CountryView({ country, world }) {
  const { countries: statuses, setCountryStatus, openTripForm, openPlace, user } = useApp();
  const [tab, setTab] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const status = statuses[country.code];

  const facts = useAsync(async () => {
    let f = {};
    try { f = await getCountryFacts(country.code); } catch { /* Wikidata indisponible : on tente Wikipédia directement */ }
    const summary = await getSummary(f.wikiTitle || country.name, f.wikiTitle ? f.wikiLang : "fr").catch(() => null);
    return { ...f, summary };
  }, [country.code]);
  const destinations = useAsync(() => getDestinations(country.code), [country.code]);

  const all = destinations.data || [];
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t, t === "all" ? all.length : all.filter((d) => d.kind === t).length])), [all]);
  const visible = useMemo(() => (tab === "all" ? all : all.filter((d) => d.kind === tab)), [all, tab]);
  const shown = showAll ? visible : visible.slice(0, 12);
  const cover = all.find((d) => d.image)?.image?.replace("width=640", "width=1400");
  const neighbours = country.borders.map((c) => world.byCca3[c]).filter(Boolean);

  const facts_ = [
    [Landmark, "Capitale", country.capital || "—"],
    [Users, "Population", facts.data?.population ? formatNumber(facts.data.population) : facts.loading ? "…" : "—"],
    [Ruler, "Superficie", country.area ? `${formatNumber(country.area)} km²` : "—"],
    [Languages, "Langues", country.languages.join(", ") || "—"],
    [Coins, "Monnaie", country.currencies.join(", ") || "—"],
    [Globe2, "Région", [country.subregion, country.region].filter(Boolean).join(" · ") || "—"],
  ];

  const style = (f) => (f.properties.code === country.code
    ? { fillColor: "#3f7a5c", fillOpacity: 0.22, color: "#284b3d", weight: 1.6 }
    : { fillOpacity: 0.02 });

  return <>
    <a className="back-link" href="#/explorer"><ArrowLeft size={15} /> Tous les pays</a>

    <section className="country-hero" style={cover ? { backgroundImage: `linear-gradient(90deg, #1e392fee 0%, #1e392fb0 45%, #1e392f30), url("${cover}")` } : undefined}>
      <Flag code={country.code} size={64} emoji={country.emoji} />
      <div>
        <small>{[country.subregion, country.region].filter(Boolean).join(" · ").toUpperCase()}</small>
        <h1>{country.name}</h1>
        <p>{country.official}</p>
      </div>
      <div className="country-actions">
        <button className={`status-button ${status === "visited" ? "on" : ""}`} onClick={() => setCountryStatus(country.code, status === "visited" ? null : "visited")}>
          <Check size={15} /> {status === "visited" ? "Visité" : "J'y suis allé·e"}
        </button>
        <button className={`status-button wish ${status === "wishlist" ? "on" : ""}`} onClick={() => setCountryStatus(country.code, status === "wishlist" ? null : "wishlist")}>
          <Star size={15} fill={status === "wishlist" ? "currentColor" : "none"} /> {status === "wishlist" ? "Sur ma liste" : "À visiter"}
        </button>
        <button className="light-button" onClick={() => openTripForm({ name: `Voyage en ${country.name}`, countryCode: country.code })}>
          <CalendarDays size={15} /> Planifier un voyage
        </button>
      </div>
    </section>
    {!user && <p className="muted small hint">Créez un compte pour marquer ce pays comme visité et enregistrer ses lieux.</p>}

    <div className="country-layout">
      <section className="panel">
        <small className="eyebrow">EN BREF</small>
        <div className="facts">{facts_.map(([Icon, label, value]) => <div key={label}><Icon size={16} /><small>{label}</small><b>{value}</b></div>)}</div>
        {facts.loading && <Spinner label="Chargement de la présentation..." />}
        {facts.data?.summary?.extract && <>
          <p className="extract">{facts.data.summary.extract}</p>
          <a className="text-link" href={facts.data.summary.url} target="_blank" rel="noreferrer">Lire la suite sur Wikipédia <ExternalLink size={13} /></a>
        </>}
      </section>
      <section className="map-card">
        <WorldMap features={world.features} countryStyle={style} styleKey={country.code}
          tooltip={(f) => world.byCode[f.properties.code]?.name || f.properties.name}
          onCountryClick={(f) => f.properties.code && f.properties.code !== country.code && navigate(`/pays/${f.properties.code}`)}
          markers={visible} onMarkerClick={openPlace}
          fit={{ countryCode: country.code, fallbackCenter: [country.lat, country.lng] }} />
      </section>
    </div>

    <SectionHeading eyebrow="LES PLUS CONNUES DU PAYS" title="Destinations à découvrir" />
    <div className="chips">{TABS.filter((t) => t === "all" || counts[t]).map((t) => (
      <button key={t} className={`chip ${tab === t ? "active" : ""}`} onClick={() => { setTab(t); setShowAll(false); }}>
        {t === "all" ? "Tout" : KIND_LABELS[t]} <small>{counts[t]}</small>
      </button>
    ))}</div>
    {destinations.loading && <><p className="muted small">Interrogation de Wikidata (quelques secondes pour les grands pays)…</p><SkeletonGrid /></>}
    {destinations.error && <ErrorBox message="Les destinations de ce pays n'ont pas pu être chargées (Wikidata est peut-être surchargé)." onRetry={destinations.retry} />}
    {destinations.data && !all.length && <Empty title="Peu de données pour ce pays" text="Utilisez la recherche de l'onglet Explorer pour trouver des lieux précis." action="Rechercher un lieu" onAction={() => navigate(`/explorer?q=${encodeURIComponent(country.name)}`)} />}
    <div className="grid">{shown.map((p) => <PlaceCard key={p.id} place={p} countryName={country.name} />)}</div>
    {visible.length > shown.length && <button className="outline-button more" onClick={() => setShowAll(true)}>Voir les {visible.length - shown.length} autres destinations</button>}

    {neighbours.length > 0 && <>
      <SectionHeading eyebrow="FRONTIÈRES" title="Pays voisins" />
      <div className="chips">{neighbours.map((n) => <a key={n.code} className="chip" href={`#/pays/${n.code}`}><Flag code={n.code} size={18} emoji={n.emoji} /> {n.name}</a>)}</div>
    </>}
  </>;
}
