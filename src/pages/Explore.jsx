// Explorer : grande carte du monde + recherche de n'importe quel lieu + liste de tous les pays.
import { useEffect, useMemo, useState } from "react";
import { Search, X, MapPin, ArrowUpRight } from "lucide-react";
import { useApp } from "../lib/store.jsx";
import { useWorld } from "../lib/useWorld.js";
import { searchPlaces, KIND_LABELS } from "../lib/world.js";
import { navigate } from "../lib/router.js";
import WorldMap, { COUNTRY_COLORS } from "../components/WorldMap.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { ErrorBox, Flag, Spinner } from "../components/ui.jsx";

const REGION_FILTERS = ["Tous", "Afrique", "Amériques", "Asie", "Europe", "Océanie", "Antarctique"];
export const normalize = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default function Explore({ query }) {
  const { countries: statuses, openPlace } = useApp();
  const world = useWorld();
  const [text, setText] = useState(query.get("q") || "");
  const [region, setRegion] = useState(REGION_FILTERS.includes(query.get("region")) ? query.get("region") : "Tous");
  const [results, setResults] = useState(null); // résultats de recherche de lieux
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [activeId, setActiveId] = useState(null);

  async function runSearch(value) {
    const q = value.trim();
    if (q.length < 2) return;
    setSearching(true); setSearchError(null);
    try {
      const found = await searchPlaces(q);
      setResults(found);
      setActiveId(null);
    } catch {
      setSearchError("La recherche est momentanément indisponible. Réessayez dans un instant.");
    } finally {
      setSearching(false);
    }
  }

  // Si on arrive avec ?q=... (depuis l'accueil), on lance la recherche directement.
  useEffect(() => {
    const q = query.get("q");
    if (q) { setText(q); runSearch(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.get("q")]);

  const filteredCountries = useMemo(() => {
    if (!world.countries) return [];
    const q = normalize(text);
    return world.countries.filter((c) =>
      (region === "Tous" || c.region === region) &&
      (!q || normalize(`${c.name} ${c.nameEn} ${c.capital}`).includes(q)));
  }, [world.countries, text, region]);

  const regionCodes = useMemo(() => new Set(filteredCountries.map((c) => c.code)), [filteredCountries]);
  const places = useMemo(() => (results || []).filter((r) => r.kind !== "country"), [results]);

  const style = (f) => {
    const code = f.properties.code;
    const status = statuses[code];
    const dimmed = region !== "Tous" && !regionCodes.has(code);
    if (status) return { fillColor: COUNTRY_COLORS[status], fillOpacity: dimmed ? 0.2 : 0.5 };
    return { fillOpacity: dimmed ? 0 : region !== "Tous" ? 0.14 : 0.04 };
  };

  function openResult(r) {
    if (r.kind === "country" && world.byCode?.[r.countryCode]) navigate(`/pays/${r.countryCode}`);
    else { setActiveId(r.id); openPlace(r); }
  }

  const fit = places.length ? { markers: true, maxZoom: 11 } : { world: true };

  return <>
    <PageHeader eyebrow="250 PAYS ET TERRITOIRES" title="Explorer le monde" subtitle="Cliquez sur un pays de la carte, ou cherchez n'importe quel lieu sur Terre." />

    <div className="explore-layout">
      <section className="panel explore-panel">
        <form className="search" onSubmit={(e) => { e.preventDefault(); runSearch(text); }}>
          <Search size={17} />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ville, pays, monument, plage…" aria-label="Rechercher" />
          {text && <button type="button" className="icon-button" onClick={() => { setText(""); setResults(null); }} aria-label="Effacer"><X size={15} /></button>}
          <button className="dark-button small">Chercher</button>
        </form>

        <div className="chips">{REGION_FILTERS.map((r) => (
          <button key={r} className={`chip ${region === r ? "active" : ""}`} onClick={() => setRegion(r)}>{r}</button>
        ))}</div>

        {searching && <Spinner label="Recherche dans OpenStreetMap..." />}
        {searchError && <ErrorBox message={searchError} onRetry={() => runSearch(text)} />}
        {results && !searching && <>
          <h3 className="mini-title">Lieux trouvés <small>({results.length})</small></h3>
          {!results.length && <p className="muted small">Aucun lieu trouvé. Essayez une autre orthographe.</p>}
          <div className="result-list">{results.map((r) => (
            <button key={r.id} className={`result ${activeId === r.id ? "active" : ""}`} onClick={() => openResult(r)}>
              {r.countryCode ? <Flag code={r.countryCode} size={22} /> : <MapPin size={18} />}
              <span><b>{r.name}</b><small>{KIND_LABELS[r.kind]} · {r.subtitle}</small></span>
              <ArrowUpRight size={15} />
            </button>
          ))}</div>
        </>}

        <h3 className="mini-title">Pays <small>({filteredCountries.length})</small></h3>
        {world.loading && <Spinner label="Chargement des pays..." />}
        {world.error && <ErrorBox message="Impossible de charger la liste des pays." onRetry={world.retry} />}
        <div className="country-list">{filteredCountries.map((c) => (
          <a key={c.code} href={`#/pays/${c.code}`} className="country-row">
            <Flag code={c.code} size={26} emoji={c.emoji} />
            <span><b>{c.name}</b><small>{c.capital || c.subregion}</small></span>
            {statuses[c.code] && <i className={`status-dot ${statuses[c.code]}`} title={statuses[c.code] === "visited" ? "Visité" : "À visiter"} />}
          </a>
        ))}</div>
      </section>

      <section className="map-card">
        <WorldMap
          className="tall"
          features={world.features}
          countryStyle={style}
          styleKey={`${JSON.stringify(statuses)}|${region}|${text}`}
          tooltip={(f) => world.byCode?.[f.properties.code]?.name || f.properties.name}
          onCountryClick={(f) => f.properties.code && navigate(`/pays/${f.properties.code}`)}
          markers={places}
          activeMarkerId={activeId}
          onMarkerClick={openResult}
          fit={fit}
        />
        <div className="legend">
          <span><i style={{ background: COUNTRY_COLORS.visited }} /> Visité</span>
          <span><i style={{ background: COUNTRY_COLORS.wishlist }} /> À visiter</span>
          {places.length > 0 && <span><i className="legend-pin" /> Résultats de recherche</span>}
        </div>
      </section>
    </div>
  </>;
}

