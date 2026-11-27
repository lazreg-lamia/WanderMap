// Mes favoris : tous les lieux enregistrés, sur une carte et en liste, filtrables par pays.
import { useMemo, useState } from "react";
import { Heart } from "lucide-react";
import { useApp } from "../lib/store.jsx";
import { useWorld } from "../lib/useWorld.js";
import { navigate } from "../lib/router.js";
import WorldMap from "../components/WorldMap.jsx";
import PageHeader, { LoginGate } from "../components/PageHeader.jsx";
import { Empty, Flag, PlaceCard } from "../components/ui.jsx";

export default function Saved() {
  const { user, saved, openPlace } = useApp();
  const { byCode } = useWorld();
  const [country, setCountry] = useState("");

  const countriesInList = useMemo(() => [...new Set(saved.map((p) => p.countryCode).filter(Boolean))]
    .map((code) => byCode?.[code]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, "fr")), [saved, byCode]);
  const visible = useMemo(() => (country ? saved.filter((p) => p.countryCode === country) : saved), [saved, country]);

  const header = <PageHeader title="Mes favoris" subtitle="Tous les lieux que vous voulez garder en tête." />;
  if (!user) return <>{header}<LoginGate title="Gardez vos coups de cœur" text="Créez un compte pour enregistrer des lieux du monde entier et les retrouver sur votre carte." /></>;
  if (!saved.length) return <>{header}<Empty icon={Heart} title="Votre liste vous attend" text="Enregistrez des lieux depuis la fiche d'un pays ou la recherche." action="Découvrir des lieux" onAction={() => navigate("/explorer")} /></>;

  return <>
    {header}
    <section className="map-card saved-map">
      <WorldMap markers={visible} onMarkerClick={openPlace} fit={{ markers: true, maxZoom: 9 }} />
    </section>
    <div className="chips">
      <button className={`chip ${!country ? "active" : ""}`} onClick={() => setCountry("")}>Tous <small>{saved.length}</small></button>
      {countriesInList.map((c) => (
        <button key={c.code} className={`chip ${country === c.code ? "active" : ""}`} onClick={() => setCountry(c.code)}>
          <Flag code={c.code} size={18} emoji={c.emoji} /> {c.name} <small>{saved.filter((p) => p.countryCode === c.code).length}</small>
        </button>
      ))}
    </div>
    <div className="grid">{visible.map((p) => <PlaceCard key={p.id} place={p} countryName={byCode?.[p.countryCode]?.name} />)}</div>
  </>;
}
