// Petits composants d'interface réutilisés partout dans le site.
import { useEffect, useState } from "react";
import { Compass, Heart, X, AlertTriangle, RotateCw, MapPin, Landmark, Building2, Trees, Star } from "lucide-react";
import { flagUrl, KIND_LABELS } from "../lib/world.js";
import { useApp } from "../lib/store.jsx";

export function Modal({ children, onClose, wide = false }) {
  // Fermeture avec la touche Échap + blocage du défilement de la page derrière.
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true">
        <button className="close" onClick={onClose} aria-label="Fermer"><X size={19} /></button>
        {children}
      </div>
    </div>
  );
}

export function SectionHeading({ title, eyebrow, action }) {
  return (
    <div className="section-heading">
      <div>{eyebrow && <small className="eyebrow">{eyebrow}</small>}<h2>{title}</h2></div>
      {action}
    </div>
  );
}

export function Empty({ title, text, action, onAction, icon: Icon = Compass }) {
  return (
    <div className="empty">
      <Icon size={27} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <button className="dark-button" onClick={onAction}>{action}</button>}
    </div>
  );
}

export function Flag({ code, size = 22, emoji = "" }) {
  const [failed, setFailed] = useState(false);
  if (!code) return null;
  if (failed) return <span className="flag-emoji" style={{ fontSize: size * 0.8 }}>{emoji || "🏳️"}</span>;
  return (
    <img className="flag" src={flagUrl(code, size > 40 ? 160 : 80)} alt="" width={size} height={Math.round(size * 0.68)}
      loading="lazy" onError={() => setFailed(true)} />
  );
}

export function Spinner({ label = "Chargement..." }) {
  return <div className="spinner"><span />{label}</div>;
}

export function ErrorBox({ message = "Impossible de charger ces données.", onRetry }) {
  return (
    <div className="error-box">
      <AlertTriangle size={18} />
      <span>{message}</span>
      {onRetry && <button className="outline-button" onClick={onRetry}><RotateCw size={14} /> Réessayer</button>}
    </div>
  );
}

const KIND_ICONS = { city: Building2, unesco: Star, nature: Trees, attraction: Landmark, place: MapPin, country: MapPin };

export function KindBadge({ kind }) {
  const Icon = KIND_ICONS[kind] || MapPin;
  return <span className={`kind-badge kind-${kind}`}><Icon size={12} />{KIND_LABELS[kind] || "Lieu"}</span>;
}

// Image avec repli élégant si la photo n'existe pas ou ne charge pas.
export function PlaceImage({ src, alt, className = "" }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className={`image-fallback ${className}`}><Compass size={28} /></div>;
  return <img className={className} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

export function PlaceCard({ place, countryName }) {
  const { isSaved, toggleSave, openPlace } = useApp();
  const saved = isSaved(place.id);
  return (
    <article className="place-card">
      <button className="photo" onClick={() => openPlace(place)} aria-label={`Voir ${place.name}`}>
        <PlaceImage src={place.image} alt={place.name} />
        <KindBadge kind={place.kind} />
      </button>
      <button className={`heart ${saved ? "chosen" : ""}`} onClick={() => toggleSave(place)} aria-label={saved ? "Retirer des favoris" : "Ajouter aux favoris"}>
        <Heart size={17} fill={saved ? "currentColor" : "none"} />
      </button>
      <div className="place-info">
        <small>{countryName || " "}</small>
        <button className="place-name" onClick={() => openPlace(place)}>{place.name}</button>
        {(place.description || place.subtitle) && <p>{place.description || place.subtitle}</p>}
      </div>
    </article>
  );
}

export function SkeletonGrid({ count = 6 }) {
  return <div className="grid">{Array.from({ length: count }, (_, i) => <div key={i} className="place-card skeleton"><div className="photo" /><div className="place-info"><i /><i /><i /></div></div>)}</div>;
}
