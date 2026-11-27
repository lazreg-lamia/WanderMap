// Profil : informations du compte, statistiques, changement de mot de passe, suppression du compte.
import { useState } from "react";
import { LogOut, KeyRound, Trash2, Pencil } from "lucide-react";
import { useApp } from "../lib/store.jsx";
import { useWorld } from "../lib/useWorld.js";
import PageHeader, { LoginGate } from "../components/PageHeader.jsx";
import { CountrySelect } from "../components/TripForm.jsx";
import { Flag, Modal } from "../components/ui.jsx";

export default function Profile() {
  const { user, saved, trips, countries, updateProfile, changePassword, deleteAccount, logout } = useApp();
  const { byCode } = useWorld();
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState(null); // "password" | "delete"
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const header = <PageHeader title="Mon profil" subtitle="Votre histoire de voyage, au même endroit." />;
  if (!user) return <>{header}<LoginGate title="Vous n'êtes pas connecté·e" text="Connectez-vous pour voir et modifier votre profil." /></>;

  const visited = Object.values(countries).filter((s) => s === "visited").length;
  const wishlist = Object.values(countries).filter((s) => s === "wishlist").length;
  const home = byCode?.[user.homeCountry];
  const since = new Date(`${user.createdAt.replace(" ", "T")}Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  // Exécute une action de formulaire en affichant l'erreur éventuelle du serveur.
  const run = (action) => async (event) => {
    event.preventDefault();
    setError(""); setBusy(true);
    try { await action(new FormData(event.currentTarget)); setEditing(false); setDialog(null); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const close = () => { setEditing(false); setDialog(null); setError(""); };

  return <>
    {header}
    <div className="profile-layout">
      <section className="panel profile">
        <div className="cover" />
        <div className="profile-body">
          <span className="profile-avatar">{user.name[0]?.toUpperCase()}</span>
          <button className="outline-button" onClick={() => setEditing(true)}><Pencil size={14} /> Modifier</button>
          <h2>{user.name}</h2>
          <p className="muted">{user.email} · membre depuis {since}</p>
          {home && <p className="home-country"><Flag code={home.code} size={20} emoji={home.emoji} /> Vit en {home.name}</p>}
          <p>{user.bio || <span className="muted">Ajoutez quelques mots sur vous et vos envies de voyage.</span>}</p>
          <div className="profile-counts">
            <span><b>{visited}</b>Pays visités</span>
            <span><b>{wishlist}</b>Pays à visiter</span>
            <span><b>{saved.length}</b>Favoris</span>
            <span><b>{trips.length}</b>Voyages</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <small className="eyebrow">SÉCURITÉ ET COMPTE</small>
        <h2>Paramètres</h2>
        <div className="settings">
          <button className="setting" onClick={() => setDialog("password")}><KeyRound size={17} /><span><b>Mot de passe</b><small>Modifier votre mot de passe</small></span></button>
          <button className="setting" onClick={logout}><LogOut size={17} /><span><b>Se déconnecter</b><small>Fermer la session sur cet appareil</small></span></button>
          <button className="setting danger" onClick={() => setDialog("delete")}><Trash2 size={17} /><span><b>Supprimer mon compte</b><small>Efface définitivement toutes vos données</small></span></button>
        </div>
      </section>
    </div>

    {editing && <Modal onClose={close}>
      <div className="form-body">
        <small className="eyebrow">VOTRE COMPTE</small><h2>Modifier le profil</h2>
        <ProfileForm user={user} busy={busy} error={error}
          onSubmit={run((d) => updateProfile({ name: d.get("name"), bio: d.get("bio"), homeCountry: d.get("homeCountry") }))} />
      </div>
    </Modal>}

    {dialog === "password" && <Modal onClose={close}>
      <div className="form-body">
        <small className="eyebrow">SÉCURITÉ</small><h2>Changer de mot de passe</h2>
        <form onSubmit={run((d) => {
          if (d.get("next") !== d.get("confirm")) throw new Error("Les deux nouveaux mots de passe ne correspondent pas.");
          return changePassword({ current: d.get("current"), next: d.get("next") });
        })}>
          <label>Mot de passe actuel<input name="current" type="password" required autoComplete="current-password" /></label>
          <label>Nouveau mot de passe<input name="next" type="password" required minLength={8} autoComplete="new-password" /></label>
          <label>Confirmer le nouveau mot de passe<input name="confirm" type="password" required minLength={8} autoComplete="new-password" /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="dark-button wide" disabled={busy}>Mettre à jour</button>
        </form>
      </div>
    </Modal>}

    {dialog === "delete" && <Modal onClose={close}>
      <div className="form-body">
        <h2>Supprimer votre compte ?</h2>
        <p className="muted">Vos favoris, vos pays et vos {trips.length} voyage(s) seront effacés. Cette action est irréversible.</p>
        <form onSubmit={run((d) => deleteAccount(d.get("password")))}>
          <label>Confirmez avec votre mot de passe<input name="password" type="password" required autoComplete="current-password" /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="danger-button wide" disabled={busy}>Supprimer définitivement</button>
        </form>
      </div>
    </Modal>}
  </>;
}

function ProfileForm({ user, busy, error, onSubmit }) {
  const [home, setHome] = useState(user.homeCountry || "");
  return (
    <form onSubmit={onSubmit}>
      <label>Nom<input name="name" required minLength={2} maxLength={80} defaultValue={user.name} /></label>
      <label>Pays de résidence<CountrySelect name="homeCountry" value={home} onChange={setHome} placeholder="Non précisé" /></label>
      <label>À propos de vous<textarea name="bio" rows="3" maxLength={500} defaultValue={user.bio} /></label>
      {error && <p className="form-error">{error}</p>}
      <button className="dark-button wide" disabled={busy}>Enregistrer</button>
    </form>
  );
}
