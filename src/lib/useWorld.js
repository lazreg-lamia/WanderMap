// Hook React qui donne accès à la liste des pays et à leurs frontières (chargées une seule fois).
import { useEffect, useState } from "react";
import { loadWorld } from "./world.js";

let snapshot = null;

export function useWorld() {
  const [state, setState] = useState(() => (snapshot ? { ...snapshot, loading: false, error: null } : { loading: true, error: null }));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (snapshot) return;
    let alive = true;
    loadWorld()
      .then((world) => { snapshot = world; if (alive) setState({ ...world, loading: false, error: null }); })
      .catch((error) => { if (alive) setState({ loading: false, error }); });
    return () => { alive = false; };
  }, [attempt]);

  return { ...state, retry: () => { setState({ loading: true, error: null }); setAttempt((n) => n + 1); } };
}

// Hook générique pour charger une donnée asynchrone (destinations, météo...).
export function useAsync(loader, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setState({ data: null, loading: true, error: null });
    Promise.resolve()
      .then(loader)
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState({ data: null, loading: false, error }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);
  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
