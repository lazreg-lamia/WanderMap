// État global de l'application : utilisateur connecté, favoris, pays, voyages, notifications
// et fenêtres partagées (fiche d'un lieu, formulaire de voyage).
// Chaque action met à jour l'écran tout de suite, puis enregistre dans la base via l'API.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, getToken, setToken } from "./api.js";
import { navigate } from "./router.js";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [saved, setSaved] = useState([]);
  const [countries, setCountries] = useState({}); // { "DZ": "visited", "JP": "wishlist" }
  const [trips, setTrips] = useState([]);
  const [toast, setToast] = useState(null);
  const [openedPlace, setOpenedPlace] = useState(null);
  const [tripDraft, setTripDraft] = useState(null); // formulaire "nouveau voyage" ouvert ou non
  const toastTimer = useRef();

  const notify = useCallback((message, type = "success") => {
    setToast({ message, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const loadBundle = useCallback((data) => {
    setUser(data.user);
    setSaved(data.saved || []);
    setCountries(data.countries || {});
    setTrips(data.trips || []);
  }, []);

  // Au chargement : si un jeton existe, on récupère le compte.
  useEffect(() => {
    if (!getToken()) { setReady(true); return; }
    api("/me")
      .then(loadBundle)
      .catch((error) => { if (error.status === 401) setToken(null); })
      .finally(() => setReady(true));
  }, [loadBundle]);

  // Exécute une action seulement si l'utilisateur est connecté ; sinon l'envoie vers la connexion.
  const requireLogin = useCallback((message = "Connectez-vous pour continuer.") => {
    if (user) return true;
    try { sessionStorage.setItem("wm_next", window.location.hash || "#/"); } catch { /* ignore */ }
    setOpenedPlace(null);
    notify(message, "info");
    navigate("/connexion");
    return false;
  }, [user, notify]);

  const afterLogin = useCallback((data) => {
    setToken(data.token);
    loadBundle(data);
    let next = "#/";
    try { next = sessionStorage.getItem("wm_next") || "#/"; sessionStorage.removeItem("wm_next"); } catch { /* ignore */ }
    window.location.hash = next.replace(/^#/, "") || "/";
  }, [loadBundle]);

  // Annule une modification affichée si le serveur la refuse.
  const guarded = useCallback(async (request, rollback) => {
    try { return await request(); }
    catch (error) { rollback?.(); notify(error.message, "error"); return null; }
  }, [notify]);

  const actions = useMemo(() => ({
    notify,
    requireLogin,
    openPlace: setOpenedPlace,
    closePlace: () => setOpenedPlace(null),
    openTripForm: (draft = {}) => { if (requireLogin("Créez un compte pour planifier vos voyages.")) setTripDraft(draft); },
    closeTripForm: () => setTripDraft(null),

    async register(form) { afterLogin(await api("/auth/register", { method: "POST", body: form })); notify(`Bienvenue sur WanderMap, ${form.name.split(" ")[0]} !`); },
    async login(form) { const data = await api("/auth/login", { method: "POST", body: form }); afterLogin(data); notify(`Bon retour, ${data.user.name.split(" ")[0]} !`); },
    logout() {
      setToken(null); setUser(null); setSaved([]); setCountries({}); setTrips([]);
      navigate("/"); notify("Vous êtes déconnecté·e.", "info");
    },

    isSaved: (id) => saved.some((p) => p.id === id),
    async toggleSave(place) {
      if (!requireLogin("Créez un compte pour enregistrer vos lieux préférés.")) return;
      const already = saved.some((p) => p.id === place.id);
      const previous = saved;
      if (already) {
        setSaved((list) => list.filter((p) => p.id !== place.id));
        const done = await guarded(() => api(`/saved/${encodeURIComponent(place.id)}`, { method: "DELETE" }).then(() => true), () => setSaved(previous));
        if (done) notify("Retiré de vos favoris", "info");
      } else {
        setSaved((list) => [place, ...list]);
        const result = await guarded(() => api("/saved", { method: "POST", body: { place } }), () => setSaved(previous));
        if (!result) return;
        setSaved((list) => list.map((p) => (p.id === result.place.id ? result.place : p)));
        notify("Ajouté à vos favoris");
      }
    },

    async setCountryStatus(code, status) {
      if (!requireLogin("Créez un compte pour construire votre carte du monde.")) return;
      const previous = countries;
      setCountries((map) => { const next = { ...map }; if (status) next[code] = status; else delete next[code]; return next; });
      await guarded(
        () => (status ? api(`/countries/${code}`, { method: "PUT", body: { status } }) : api(`/countries/${code}`, { method: "DELETE" })),
        () => setCountries(previous),
      );
    },

    async createTrip(trip) {
      const result = await guarded(() => api("/trips", { method: "POST", body: trip }));
      if (!result) return null;
      setTrips((list) => [...list, result.trip]);
      notify("Votre voyage a été créé !");
      return result.trip;
    },
    async updateTrip(id, changes) {
      const current = trips.find((t) => t.id === id);
      if (!current) return null;
      const merged = { ...current, ...changes };
      setTrips((list) => list.map((t) => (t.id === id ? merged : t)));
      const result = await guarded(() => api(`/trips/${id}`, { method: "PUT", body: merged }), () => setTrips((list) => list.map((t) => (t.id === id ? current : t))));
      if (!result) return null;
      setTrips((list) => list.map((t) => (t.id === id ? result.trip : t)));
      return result.trip;
    },
    async deleteTrip(id) {
      const previous = trips;
      setTrips((list) => list.filter((t) => t.id !== id));
      const done = await guarded(() => api(`/trips/${id}`, { method: "DELETE" }).then(() => true), () => setTrips(previous));
      if (done) notify("Voyage supprimé", "info");
    },
    async addStop(tripId, place) {
      const trip = trips.find((t) => t.id === tripId);
      if (!trip) return;
      if (trip.stops.some((s) => s.id === place.id)) { notify("Ce lieu est déjà dans ce voyage", "info"); return; }
      const updated = await actions.updateTrip(tripId, { stops: [...trip.stops, place] });
      if (updated) notify(`Ajouté au voyage « ${trip.name} »`);
    },

    async updateProfile(form) {
      const { user: updated } = await api("/me", { method: "PUT", body: form });
      setUser(updated);
      notify("Profil mis à jour");
    },
    async changePassword(form) {
      await api("/me/password", { method: "PUT", body: form });
      notify("Mot de passe modifié");
    },
    async deleteAccount(password) {
      await api("/me", { method: "DELETE", body: { password } });
      setToken(null); setUser(null); setSaved([]); setCountries({}); setTrips([]);
      navigate("/");
      notify("Votre compte a été supprimé.", "info");
    },
  }), [notify, requireLogin, afterLogin, guarded, saved, countries, trips]);

  const value = { ready, user, saved, countries, trips, toast, openedPlace, tripDraft, ...actions };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
