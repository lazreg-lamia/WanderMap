// En-tête commun à toutes les pages (petit sur-titre, grand titre, phrase d'accroche).
export default function PageHeader({ eyebrow = "VOTRE ATLAS DE VOYAGE PERSONNEL", title, subtitle, children }) {
  return (
    <header className="header">
      <div>
        <small className="eyebrow">{eyebrow}</small>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}

// Affiché à la place d'une page réservée aux membres quand on n'est pas connecté.
export function LoginGate({ title, text }) {
  // On retient la page actuelle pour y revenir juste après la connexion.
  const remember = () => { try { sessionStorage.setItem("wm_next", window.location.hash); } catch { /* ignore */ } };
  return (
    <div className="gate">
      <h3>{title}</h3>
      <p>{text}</p>
      <div className="gate-actions">
        <a className="dark-button" href="#/inscription" onClick={remember}>Créer un compte gratuit</a>
        <a className="outline-button" href="#/connexion" onClick={remember}>J'ai déjà un compte</a>
      </div>
    </div>
  );
}
