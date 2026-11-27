// Structure générale du site : menu latéral, navigation entre les pages, fenêtres partagées.
import { useEffect, useState } from "react";
import { Compass, Globe2, Map, Bookmark, CalendarDays, UserRound, Menu, LogOut, LogIn, UserPlus, Check, Info, AlertTriangle } from "lucide-react";
import { AppProvider, useApp } from "./lib/store.jsx";
import { navigate, useRoute } from "./lib/router.js";
import PlaceModalHost from "./components/PlaceModal.jsx";
import TripFormHost from "./components/TripForm.jsx";
import { Empty } from "./components/ui.jsx";
import Home from "./pages/Home.jsx";
import Explore from "./pages/Explore.jsx";
import Country from "./pages/Country.jsx";
import MyWorld from "./pages/MyWorld.jsx";
import Saved from "./pages/Saved.jsx";
import Trips from "./pages/Trips.jsx";
import Trip from "./pages/Trip.jsx";
import Profile from "./pages/Profile.jsx";
import Auth from "./pages/Auth.jsx";

const NAV = [
  ["", "Accueil", Compass],
  ["explorer", "Explorer le monde", Map],
  ["monde", "Mon monde", Globe2],
  ["favoris", "Mes favoris", Bookmark],
  ["voyages", "Mes voyages", CalendarDays],
];

export default function App() {
  return <AppProvider><Shell /></AppProvider>;
}

function Shell() {
  const route = useRoute();
  const { user, ready, logout, toast } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [section, id] = route.parts;

  useEffect(() => setMenuOpen(false), [route.hash]);

  let page;
  switch (section) {
    case undefined: page = <Home />; break;
    case "explorer": page = <Explore query={route.query} />; break;
    case "pays": page = <Country code={(id || "").toUpperCase()} />; break;
    case "monde": page = <MyWorld />; break;
    case "favoris": page = <Saved />; break;
    case "voyages": page = id ? <Trip id={Number(id)} /> : <Trips />; break;
    case "profil": page = <Profile />; break;
    case "connexion": page = <Auth mode="login" />; break;
    case "inscription": page = <Auth mode="register" />; break;
    default: page = <Empty title="Page introuvable" text="Cette page n'existe pas (ou plus)." action="Retour à l'accueil" onAction={() => navigate("/")} />;
  }

  const ToastIcon = toast?.type === "error" ? AlertTriangle : toast?.type === "info" ? Info : Check;

  return (
    <div className="layout">
      {menuOpen && <div className="menu-scrim" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <a className="logo" href="#/"><span>✦</span> WanderMap</a>
        <small className="nav-caption">NAVIGATION</small>
        <nav>
          {NAV.map(([target, label, Icon]) => (
            <a key={label} href={`#/${target}`} className={(section || "") === target || (target === "explorer" && section === "pays") ? "active" : ""}>
              <Icon size={18} />{label}
            </a>
          ))}
        </nav>
        <div className="account">
          <small className="nav-caption">COMPTE</small>
          {user ? <>
            <a href="#/profil" className={section === "profil" ? "active" : ""}><UserRound size={18} />Mon profil</a>
            <div className="mini">
              <span>{user.name[0]?.toUpperCase()}</span>
              <div><b>{user.name}</b><small>{user.email}</small></div>
              <button title="Se déconnecter" aria-label="Se déconnecter" onClick={logout}><LogOut size={15} /></button>
            </div>
          </> : ready && <>
            <a href="#/connexion" className={section === "connexion" ? "active" : ""}><LogIn size={18} />Se connecter</a>
            <a href="#/inscription" className={`signup ${section === "inscription" ? "active" : ""}`}><UserPlus size={18} />Créer un compte</a>
          </>}
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu"><Menu /></button>
          <a className="logo mobile-logo" href="#/"><span>✦</span> WanderMap</a>
          <div className="topbar-spacer" />
          {user
            ? <a className="user-badge" href="#/profil" title="Mon profil">{user.name[0]?.toUpperCase()}</a>
            : ready && <a className="outline-button" href="#/connexion"><LogIn size={14} /> Connexion</a>}
        </div>
        {page}
        <footer className="footer">
          Données : <a href="https://www.wikidata.org" target="_blank" rel="noreferrer">Wikidata</a>, <a href="https://fr.wikipedia.org" target="_blank" rel="noreferrer">Wikipédia</a>,{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>, <a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a>, Natural Earth.
        </footer>
      </main>

      <PlaceModalHost />
      <TripFormHost />
      {toast && <div className={`toast toast-${toast.type}`} role="status"><ToastIcon size={16} />{toast.message}</div>}
    </div>
  );
}
