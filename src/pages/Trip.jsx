// Détail d'un voyage : infos modifiables, étapes ordonnées, itinéraire sur la carte, ajout d'étapes.
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowUp, ArrowDown, Trash2, Search, Plus, Save, Route, CalendarDays, Heart } from "lucide-react";
import { useApp } from "../lib/store.jsx";
import { useWorld } from "../lib/useWorld.js";
import { distanceKm, formatNumber, searchPlaces } from "../lib/world.js";
import { navigate } from "../lib/router.js";
import WorldMap from "../components/WorldMap.jsx";
import PageHeader, { LoginGate } from "../components/PageHeader.jsx";
import { CountrySelect } from "../components/TripForm.jsx";
import { Empty, ErrorBox, Flag, KindBadge, Modal, PlaceImage, Spinner } from "../components/ui.jsx";
import { daysUntil } from "./Home.jsx";

export default function Trip({ id }) {
  const { user, ready, trips } = useApp();
  if (!ready) return <Spinner />;
  if (!user) return <LoginGate title="Connectez-vous" text="Connectez-vous pour voir ce voyage." />;
  const trip = trips.find((t) => t.id === id);
  if (!trip) return <Empty title="Voyage introuvable" text="Ce voyage n'existe pas ou a été supprimé." action="Mes voyages" onAction={() => navigate("/voyages")} />;
  return <TripView key={trip.id} trip={trip} />;
}

function TripView({ trip }) {
  const { updateTrip, deleteTrip, openPlace, saved } = useApp();
  const { byCode } = useWorld();
  const [form, setForm] = useState({ name: trip.name, countryCode: trip.countryCode || "", startDate: trip.startDate, endDate: trip.endDate, notes: trip.notes });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const stops = trip.stops;
  const dirty = form.name !== trip.name || form.countryCode !== (trip.countryCode || "") || form.startDate !== trip.startDate || form.endDate !== trip.endDate || form.notes !== trip.notes;
  const totalKm = stops.slice(1).reduce((sum, s, i) => sum + distanceKm(stops[i], s), 0);
  const days = form.startDate && form.endDate ? daysUntil(form.endDate) - daysUntil(form.startDate) + 1 : null;
  const country = byCode?.[form.countryCode];
  const fromSaved = useMemo(() => saved.filter((p) => !stops.some((s) => s.id === p.id)), [saved, stops]);

  const setStops = (next) => updateTrip(trip.id, { stops: next });
  const move = (index, delta) => {
    const next = [...stops];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setStops(next);
  };
  const addStop = (place) => {
    if (stops.some((s) => s.id === place.id)) return;
    const { bbox, popularity, ...clean } = place; // on ne garde que les champs utiles
    setStops([...stops, clean]);
  };

  async function search(event) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true); setSearchError("");
    try { setResults((await searchPlaces(query.trim(), { countryCode: form.countryCode })).filter((r) => r.kind !== "country")); }
    catch { setSearchError("Recherche indisponible pour le moment."); }
    finally { setSearching(false); }
  }

  async function saveInfo(event) {
    event.preventDefault();
    await updateTrip(trip.id, form);
  }

  const fit = useMemo(() => (stops.length ? { markers: true, maxZoom: 11 } : form.countryCode && country ? { center: [country.lat, country.lng], zoom: 5 } : { world: true }), [stops.length, form.countryCode, country]);

  return <>
    <a className="back-link" href="#/voyages"><ArrowLeft size={15} /> Mes voyages</a>
    <PageHeader eyebrow={country ? country.name.toUpperCase() : "VOYAGE"} title={trip.name}
      subtitle={`${stops.length} étape${stops.length > 1 ? "s" : ""}${totalKm ? ` · environ ${formatNumber(totalKm)} km à vol d'oiseau` : ""}${days > 0 ? ` · ${days} jour${days > 1 ? "s" : ""}` : ""}`}>
      {country && <Flag code={country.code} size={48} emoji={country.emoji} />}
    </PageHeader>

    <div className="trip-layout">
      <section className="map-card">
        <WorldMap className="tall" markers={stops} route numbered onMarkerClick={openPlace} fit={fit} />
      </section>

      <div className="trip-side">
        <section className="panel">
          <h3 className="panel-title"><Route size={17} /> Itinéraire</h3>
          {!stops.length && <p className="muted small">Aucune étape. Ajoutez des lieux avec la recherche ci-dessous ou depuis vos favoris.</p>}
          <ol className="stops">{stops.map((s, i) => (
            <li key={s.id}>
              <span className="stop-number">{i + 1}</span>
              <button className="stop-main" onClick={() => openPlace(s)}>
                <PlaceImage src={s.image} alt="" /><span><b>{s.name}</b><small>{i > 0 ? `${formatNumber(distanceKm(stops[i - 1], s))} km depuis l'étape ${i}` : "Départ"}</small></span>
              </button>
              <div className="stop-tools">
                <button className="icon-button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Monter"><ArrowUp size={14} /></button>
                <button className="icon-button" disabled={i === stops.length - 1} onClick={() => move(i, 1)} aria-label="Descendre"><ArrowDown size={14} /></button>
                <button className="icon-button danger" onClick={() => setStops(stops.filter((x) => x.id !== s.id))} aria-label="Retirer"><Trash2 size={14} /></button>
              </div>
            </li>
          ))}</ol>

          <form className="search compact" onSubmit={search}>
            <Search size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={country ? `Ajouter un lieu en ${country.name}…` : "Ajouter un lieu…"} />
            <button className="dark-button small">Chercher</button>
          </form>
          {searching && <Spinner label="Recherche..." />}
          {searchError && <ErrorBox message={searchError} />}
          {results && !searching && <div className="result-list">{results.length ? results.map((r) => (
            <button key={r.id} className="result" onClick={() => { addStop(r); setResults(null); setQuery(""); }}>
              <KindBadge kind={r.kind} /><span><b>{r.name}</b><small>{r.subtitle}</small></span><Plus size={15} />
            </button>
          )) : <p className="muted small">Aucun résultat.</p>}</div>}

          {fromSaved.length > 0 && <>
            <h4 className="mini-title"><Heart size={13} /> Depuis mes favoris</h4>
            <div className="result-list">{fromSaved.slice(0, 8).map((p) => (
              <button key={p.id} className="result" onClick={() => addStop(p)}>
                <Flag code={p.countryCode} size={20} /><span><b>{p.name}</b><small>{byCode?.[p.countryCode]?.name}</small></span><Plus size={15} />
              </button>
            ))}</div>
          </>}
        </section>

        <section className="panel">
          <h3 className="panel-title"><CalendarDays size={17} /> Informations</h3>
          <form className="stack-form" onSubmit={saveInfo}>
            <label>Nom<input value={form.name} required maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Pays principal<CountrySelect value={form.countryCode} onChange={(v) => setForm({ ...form, countryCode: v })} placeholder="Plusieurs pays / non défini" /></label>
            <div className="form-row">
              <label>Départ<input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
              <label>Retour<input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
            </div>
            <label>Notes<textarea rows="4" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Budget, réservations, idées…" /></label>
            <button className="dark-button" disabled={!dirty}><Save size={15} /> Enregistrer</button>
          </form>
          <button className="text-link danger-link" onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Supprimer ce voyage</button>
        </section>
      </div>
    </div>

    {confirmDelete && <Modal onClose={() => setConfirmDelete(false)}>
      <div className="form-body">
        <h2>Supprimer « {trip.name} » ?</h2>
        <p className="muted">Le voyage et ses {stops.length} étape(s) seront supprimés définitivement.</p>
        <div className="form-row">
          <button className="outline-button" onClick={() => setConfirmDelete(false)}>Annuler</button>
          <button className="danger-button" onClick={async () => { await deleteTrip(trip.id); navigate("/voyages"); }}>Supprimer</button>
        </div>
      </div>
    </Modal>}
  </>;
}
