// Formulaire "Créer un voyage" (ouvert depuis n'importe quelle page) + sélecteur de pays réutilisable.
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useApp } from "../lib/store.jsx";
import { useWorld } from "../lib/useWorld.js";
import { navigate } from "../lib/router.js";
import { Modal } from "./ui.jsx";

export function CountrySelect({ value, onChange, name, placeholder = "Choisir un pays", required = false }) {
  const { countries } = useWorld();
  return (
    <select name={name} value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} required={required}>
      <option value="">{placeholder}</option>
      {(countries || []).map((c) => <option key={c.code} value={c.code}>{c.emoji} {c.name}</option>)}
    </select>
  );
}

export default function TripFormHost() {
  const { tripDraft } = useApp();
  return tripDraft ? <TripForm draft={tripDraft} /> : null;
}

function TripForm({ draft }) {
  const { closeTripForm, createTrip } = useApp();
  const [countryCode, setCountryCode] = useState(draft.countryCode || "");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    const trip = await createTrip({
      name: data.get("name"), countryCode, startDate: data.get("start"), endDate: data.get("end"),
      notes: data.get("notes"), stops: draft.stops || [],
    });
    setBusy(false);
    if (trip) { closeTripForm(); navigate(`/voyages/${trip.id}`); }
  }

  return (
    <Modal onClose={closeTripForm}>
      <div className="form-body">
        <small className="eyebrow">PLANIFIEZ QUELQUE CHOSE DE BEAU</small>
        <h2>Créer un voyage</h2>
        <form onSubmit={submit}>
          <label>Nom du voyage<input name="name" required maxLength={120} defaultValue={draft.name || ""} placeholder="ex. Un été en Italie" /></label>
          <label>Pays principal<CountrySelect value={countryCode} onChange={setCountryCode} placeholder="Plusieurs pays / non défini" /></label>
          <div className="form-row">
            <label>Départ<input name="start" type="date" /></label>
            <label>Retour<input name="end" type="date" /></label>
          </div>
          <label>Notes<textarea name="notes" rows="3" placeholder="Budget, envies, choses à ne pas oublier…" /></label>
          {draft.stops?.length > 0 && <p className="muted small">Étape incluse : {draft.stops.map((s) => s.name).join(", ")}</p>}
          <button className="dark-button wide" disabled={busy}>{busy ? "Création..." : "Créer le voyage"} <ArrowUpRight size={16} /></button>
        </form>
      </div>
    </Modal>
  );
}
