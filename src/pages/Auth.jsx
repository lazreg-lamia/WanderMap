// Connexion et création de compte.
import { useState } from "react";
import { Eye, EyeOff, ArrowUpRight } from "lucide-react";
import { useApp } from "../lib/store.jsx";
import { navigate } from "../lib/router.js";

export default function Auth({ mode }) {
  const { login, register, user } = useApp();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isRegister = mode === "register";

  if (user) {
    return <div className="auth-card"><h2>Vous êtes connecté·e</h2><p className="muted">Bonjour {user.name} !</p><button className="dark-button" onClick={() => navigate("/")}>Aller à l'accueil</button></div>;
  }

  async function submit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setError("");
    if (isRegister && data.password !== data.confirm) { setError("Les deux mots de passe ne correspondent pas."); return; }
    setBusy(true);
    try {
      if (isRegister) await register({ name: data.name, email: data.email, password: data.password });
      else await login({ email: data.email, password: data.password });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-visual">
        <span className="logo light"><span>✦</span> WanderMap</span>
        <h2>{isRegister ? <>Votre atlas personnel,<br /><em>gratuit.</em></> : <>Content de vous<br /><em>revoir.</em></>}</h2>
        <ul>
          <li>Coloriez les pays que vous avez visités</li>
          <li>Enregistrez des lieux du monde entier</li>
          <li>Planifiez vos voyages étape par étape</li>
        </ul>
      </section>

      <section className="auth-card">
        <small className="eyebrow">{isRegister ? "CRÉER UN COMPTE" : "CONNEXION"}</small>
        <h2>{isRegister ? "Rejoindre WanderMap" : "Se connecter"}</h2>
        <form onSubmit={submit} key={mode}>
          {isRegister && <label>Nom<input name="name" required minLength={2} maxLength={80} autoComplete="name" placeholder="ex. Amel Benali" /></label>}
          <label>Email<input name="email" type="email" required autoComplete="email" placeholder="vous@exemple.com" /></label>
          <label>Mot de passe
            <span className="password-field">
              <input name="password" type={showPassword ? "text" : "password"} required minLength={isRegister ? 8 : 1}
                autoComplete={isRegister ? "new-password" : "current-password"} placeholder={isRegister ? "8 caractères minimum" : ""} />
              <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Masquer" : "Afficher"}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>
          {isRegister && <label>Confirmer le mot de passe<input name="confirm" type={showPassword ? "text" : "password"} required minLength={8} autoComplete="new-password" /></label>}
          {error && <p className="form-error">{error}</p>}
          <button className="dark-button wide" disabled={busy}>{busy ? "Un instant..." : isRegister ? "Créer mon compte" : "Se connecter"} <ArrowUpRight size={16} /></button>
        </form>
        <p className="auth-switch">
          {isRegister ? <>Déjà inscrit·e ? <a href="#/connexion">Se connecter</a></> : <>Pas encore de compte ? <a href="#/inscription">Créer un compte</a></>}
        </p>
      </section>
    </div>
  );
}
