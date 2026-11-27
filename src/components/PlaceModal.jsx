// Fiche détaillée d'un lieu : photo et description Wikipédia, météo et heure locale,
// carte avec les lieux à proximité, ajout aux favoris ou à un voyage.
import { useMemo, useState } from "react";
import { Heart, MapPin, ExternalLink, Navigation, Plus, CalendarDays, Clock, Wind } from "lucide-react";
import { useApp } from "../lib/store.jsx";
import { useAsync, useWorld } from "../lib/useWorld.js";
import { getNearby, getSummary, getWeather, resolveWiki, weatherLabel } from "../lib/world.js";
import { navigate } from "../lib/router.js";
import WorldMap from "./WorldMap.jsx";
import { Flag, KindBadge, Modal, PlaceImage, Spinner } from "./ui.jsx";

export default function PlaceModalHost() {
  const { openedPlace } = useApp();
  return openedPlace ? <PlaceModal key={openedPlace.id} place={openedPlace} /> : null;
}

function localTime(timezone) {
  try { return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date()); }
  catch { return ""; }
}

function PlaceModal({ place }) {
  const { closePlace, openPlace, isSaved, toggleSave, trips, addStop, openTripForm, user } = useApp();
  const { byCode } = useWorld();
  const country = byCode?.[place.countryCode];
  const [tripId, setTripId] = useState("");

  const wiki = useAsync(async () => {
    const link = await resolveWiki(place);
    return link ? getSummary(link.title, link.lang) : null;
  }, [place.id]);
  const weather = useAsync(() => getWeather(place.lat, place.lng), [place.id]);
  const nearby = useAsync(() => getNearby(place.lat, place.lng, place.wikiLang === "en" ? "en" : "fr"), [place.id]);

  const summary = wiki.data;
  const fullPlace = useMemo(() => ({
    ...place,
    image: place.image || summary?.thumbnail || "",
    description: place.description || summary?.description || "",
  }), [place, summary]);

  const around = useMemo(
    () => (nearby.data || []).filter((p) => p.name !== place.name && p.name !== summary?.title).slice(0, 12)
      .map((p) => ({ ...p, countryCode: place.countryCode })),
    [nearby.data, place.name, place.countryCode, summary?.title],
  );
  const mapMarkers = useMemo(() => [fullPlace, ...around], [fullPlace, around]);

  const saved = isSaved(place.id);
  const current = weather.data?.current;
  const now = current ? weatherLabel(current.weather_code) : null;

  function addToTrip() {
    if (!tripId) return;
    addStop(Number(tripId), fullPlace);
  }

  return (
    <Modal onClose={closePlace} wide>
      <div className="place-modal">
        <div className="place-modal-media">
          <PlaceImage className="modal-image" src={summary?.image || place.image} alt={place.name} />
          <div className="place-modal-map">
            <WorldMap markers={mapMarkers} activeMarkerId={place.id} onMarkerClick={(p) => p.id !== place.id && openPlace(p)}
              fit={{ center: [place.lat, place.lng], zoom: place.kind === "city" ? 11 : 13 }} />
          </div>
        </div>

        <div className="modal-body">
          <div className="badges"><KindBadge kind={place.kind} />
            {country && <button className="chip" onClick={() => { closePlace(); navigate(`/pays/${country.code}`); }}><Flag code={country.code} size={16} emoji={country.emoji} />{country.name}</button>}
          </div>
          <h2>{place.name}</h2>
          {place.subtitle && <p className="muted small">{place.subtitle}</p>}

          {wiki.loading ? <Spinner label="Recherche de la description..." /> :
            summary?.extract ? <p className="extract">{summary.extract}</p> :
            <p className="muted">{place.description || "Pas encore de description pour ce lieu."}</p>}

          <div className="weather-box">
            {weather.loading && <Spinner label="Météo..." />}
            {current && <>
              <div className="weather-now"><span className="weather-icon">{now.icon}</span><div><b>{Math.round(current.temperature_2m)}°C</b><small>{now.label}</small></div></div>
              <div className="weather-meta">
                <span><Clock size={13} /> {localTime(weather.data.timezone)} heure locale</span>
                <span><Wind size={13} /> {Math.round(current.wind_speed_10m)} km/h</span>
              </div>
              <div className="forecast">{weather.data.daily.time.slice(1).map((day, i) => (
                <span key={day}>
                  <small>{new Date(`${day}T12:00`).toLocaleDateString("fr-FR", { weekday: "short" })}</small>
                  {weatherLabel(weather.data.daily.weather_code[i + 1]).icon}
                  <b>{Math.round(weather.data.daily.temperature_2m_max[i + 1])}°</b>
                </span>
              ))}</div>
            </>}
            {weather.error && <small className="muted">Météo indisponible pour le moment.</small>}
          </div>

          <button className={`${saved ? "outline-button" : "dark-button"} wide`} onClick={() => toggleSave(fullPlace)}>
            <Heart size={16} fill={saved ? "currentColor" : "none"} />{saved ? "Retirer de mes favoris" : "Enregistrer ce lieu"}
          </button>

          {user && trips.length > 0 ? (
            <div className="add-trip">
              <select value={tripId} onChange={(e) => setTripId(e.target.value)} aria-label="Choisir un voyage">
                <option value="">Ajouter à un voyage…</option>
                {trips.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button className="outline-button" disabled={!tripId} onClick={addToTrip}><Plus size={15} /> Ajouter</button>
            </div>
          ) : (
            <button className="outline-button wide" onClick={() => { closePlace(); openTripForm({ name: `Voyage à ${place.name}`, countryCode: place.countryCode, stops: [fullPlace] }); }}>
              <CalendarDays size={15} /> Planifier un voyage ici
            </button>
          )}

          <div className="link-row">
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`} target="_blank" rel="noreferrer"><Navigation size={14} /> Itinéraire</a>
            <a href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=14/${place.lat}/${place.lng}`} target="_blank" rel="noreferrer"><MapPin size={14} /> OpenStreetMap</a>
            {summary?.url && <a href={summary.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Wikipédia</a>}
          </div>

          {around.length > 0 && <>
            <h3 className="mini-title">À proximité</h3>
            <div className="nearby">{around.slice(0, 8).map((p) => (
              <button key={p.id} onClick={() => openPlace(p)}>
                <PlaceImage src={p.image} alt="" /><span><b>{p.name}</b><small>{p.description}</small></span>
              </button>
            ))}</div>
          </>}
        </div>
      </div>
    </Modal>
  );
}
