// Navigation très simple basée sur l'adresse après le # (ex. #/pays/DZ).
// Avantages : pas de dépendance, et le site fonctionne sur n'importe quel hébergement.
import { useEffect, useState } from "react";

const readHash = () => window.location.hash.slice(1) || "/";

export function useRoute() {
  const [hash, setHash] = useState(readHash);
  useEffect(() => {
    const onChange = () => { setHash(readHash()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const [path, search = ""] = hash.split("?");
  return { path, parts: path.split("/").filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(search), hash };
}

export const navigate = (to) => { window.location.hash = to; };
