// Mon monde : votre carte personnelle. Cliquez sur un pays pour le marquer "visité" ou "à visiter".
import { useMemo, useState } from "react";
import { Check, Star, X, ArrowUpRight } from "lucide-react";
import { useApp } from "../lib/store.jsx";
import { useWorld } from "../lib/useWorld.js";
import { REGIONS } from "../lib/world.js";
import WorldMap, { COUNTRY_COLORS } from "../components/WorldMap.jsx";
import PageHeader, { LoginGate } from "../components/PageHeader.jsx";
import { CountrySelect } from "../components/TripForm.jsx";
import { Flag, Spinner } from "../components/ui.jsx";

export default function MyWorld() {
  const { user, countries: statuses, setCountryStatus } = useApp();
  const world = useWorld();
  const [selected, setSelected] = useState(null);

  const total = world.countries ? world.countries.filter((c) => c.independent).length : 195;
  const visited = Object.keys(statuses).filter((c) => statuses[c] === "visited");
  const wishlist = Object.keys(statuses).filter((c) => statuses[c] === "wishlist");
  const percent = (visited.length / total) * 100;

  const byRegion = useMemo(() => {
    if (!world.countries) return [];
    return Object.values(REGIONS).filter((r) => r !== "Antarctique").map((region) => {
      const list = world.countries.filter((c) => c.region === region);
      return { region, total: list.length, visited: list.filter((c) => statuses[c.code] === "visited").length };
    });
  }, [world.countries, statuses]);

  const header = <PageHeader title="Mon monde" subtitle="Une carte de tous les endroits où vous êtes allé·e — et de tous ceux dont vous rêvez." />;
  if (!user) return <>{header}<LoginGate title="Votre carte du monde vous attend" text="Créez un compte gratuit pour colorier les pays que vous avez visités et ceux qui vous font rêver." /></>;
  if (world.loading) return <>{header}<Spinner /></>;

  const country = selected && world.byCode?.[selected];
  const sortByName = (codes) => codes.map((c) => world.byCode?.[c]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return <>
    {header}
    <div className="world-layout">
      <section className="map-card">
        <WorldMap className="tall" features={world.features}
          countryStyle={(f) => {
            const s = statuses[f.properties.code];
            const isSelected = f.properties.code && f.properties.code === selected;
            return {
              ...(s ? { fillColor: COUNTRY_COLORS[s], fillOpacity: 0.6 } : { fillOpacity: 0.05 }),
              ...(isSelected ? { color: "#1e392f", weight: 2.2 } : {}),
            };
          }}
          styleKey={`${JSON.stringify(statuses)}|${selected}`}
          tooltip={(f) => {
            const name = world.byCode?.[f.properties.code]?.name || f.properties.name;
            const s = statuses[f.properties.code];
            return s ? `${name} · ${s === "visited" ? "visité" : "à visiter"}` : name;
          }}
          onCountryClick={(f) => f.properties.code && setSelected(f.properties.code)}
          fit={{ world: true }} />
        <div className="legend">
          <span><i style={{ background: COUNTRY_COLORS.visited }} /> Visité ({visited.length})</span>
          <span><i style={{ background: COUNTRY_COLORS.wishlist }} /> À visiter ({wishlist.length})</span>
          <span className="muted">Cliquez sur un pays pour le marquer</span>
        </div>

        {country && (
          <div className="map-popover">
            <button className="icon-button close-pop" onClick={() => setSelected(null)} aria-label="Fermer"><X size={15} /></button>
            <div className="pop-title"><Flag code={country.code} size={30} emoji={country.emoji} /><div><b>{country.name}</b><small>{country.capital}</small></div></div>
            <div className="pop-actions">
              <button className={`status-button ${statuses[country.code] === "visited" ? "on" : ""}`}
                onClick={() => setCountryStatus(country.code, statuses[country.code] === "visited" ? null : "visited")}><Check size={14} /> Visité</button>
              <button className={`status-button wish ${statuses[country.code] === "wishlist" ? "on" : ""}`}
                onClick={() => setCountryStatus(country.code, statuses[country.code] === "wishlist" ? null : "wishlist")}><Star size={14} /> À visiter</button>
            </div>
            <a className="text-link" href={`#/pays/${country.code}`}>Voir la fiche du pays <ArrowUpRight size={14} /></a>
          </div>
        )}
      </section>

      <section className="panel">
        <small className="eyebrow">PAYS VISITÉS</small>
        <h2 className="big-number">{visited.length}<small> / {total}</small></h2>
        <div className="progress"><i style={{ width: `${Math.min(100, percent)}%` }} /></div>
        <p className="muted small">{percent.toFixed(1)} % des pays du monde explorés</p>

        <div className="region-progress">{byRegion.map((r) => (
          <div key={r.region}>
            <span>{r.region}<small>{r.visited} / {r.total}</small></span>
            <div className="progress thin"><i style={{ width: `${(r.visited / r.total) * 100}%` }} /></div>
          </div>
        ))}</div>

        <label className="field-label">Ajouter un pays visité
          <CountrySelect value="" onChange={(code) => code && setCountryStatus(code, "visited")} placeholder="Choisir dans la liste…" />
        </label>

        <h3 className="mini-title">Visités</h3>
        {!visited.length && <p className="muted small">Aucun pays pour l'instant — cliquez sur la carte !</p>}
        <div className="flag-list">{sortByName(visited).map((c) => <button key={c.code} className="chip" onClick={() => setSelected(c.code)}><Flag code={c.code} size={18} emoji={c.emoji} />{c.name}</button>)}</div>

        <h3 className="mini-title">À visiter</h3>
        {!wishlist.length && <p className="muted small">Ajoutez les pays qui vous font rêver.</p>}
        <div className="flag-list">{sortByName(wishlist).map((c) => <button key={c.code} className="chip" onClick={() => setSelected(c.code)}><Flag code={c.code} size={18} emoji={c.emoji} />{c.name}</button>)}</div>
      </section>
    </div>
  </>;
}
