// Carte interactive réutilisable (Leaflet + fonds OpenStreetMap / CARTO / Esri).
// Elle affiche : les frontières de tous les pays (colorées selon vos pays visités / à visiter),
// des marqueurs de lieux, et éventuellement l'itinéraire d'un voyage.
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const COUNTRY_COLORS = { visited: "#3f7a5c", wishlist: "#d59a4a", none: "#284b3d" };

const defaultStyle = { color: "#9fb3a3", weight: 0.6, fillColor: COUNTRY_COLORS.none, fillOpacity: 0.04 };

export default function WorldMap({
  features, countryStyle, styleKey, tooltip, onCountryClick,
  markers = [], activeMarkerId, onMarkerClick, route = false, numbered = false,
  fit, className = "",
}) {
  const container = useRef(null);
  const map = useRef(null);
  const countryLayer = useRef(null);
  const markerLayer = useRef(null);
  // Les fonctions passées en props changent à chaque rendu : on garde toujours la dernière version ici.
  const handlers = useRef({});
  handlers.current = { countryStyle, tooltip, onCountryClick, onMarkerClick };

  // 1. Création de la carte (une seule fois)
  useEffect(() => {
    const m = L.map(container.current, { zoomControl: false, worldCopyJump: true, minZoom: 2, maxBoundsViscosity: 0.8 })
      .setView([25, 10], 2);
    m.setMaxBounds([[-85, -400], [85, 400]]);
    const layers = {
      Plan: L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd", maxZoom: 19,
      }),
      Épuré: L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd", maxZoom: 19,
      }),
      Satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Imagerie &copy; Esri, Maxar, Earthstar Geographics", maxZoom: 19,
      }),
    };
    layers.Plan.addTo(m);
    L.control.layers(layers, null, { position: "topright" }).addTo(m);
    L.control.zoom({ position: "bottomright", zoomInTitle: "Zoomer", zoomOutTitle: "Dézoomer" }).addTo(m);
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(m);
    markerLayer.current = L.layerGroup().addTo(m);
    map.current = m;

    // La carte se recalcule si son conteneur change de taille (menu mobile, fenêtre...).
    const observer = new ResizeObserver(() => m.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); m.remove(); map.current = null; };
  }, []);

  // 2. Frontières des pays
  useEffect(() => {
    if (!features || !map.current) return undefined;
    const layer = L.geoJSON({ type: "FeatureCollection", features }, {
      style: (f) => ({ ...defaultStyle, ...(handlers.current.countryStyle?.(f) || {}) }),
      onEachFeature: (f, l) => {
        if (handlers.current.tooltip) l.bindTooltip(() => escapeHtml(handlers.current.tooltip(f)), { sticky: true, className: "map-tip", direction: "top" });
        l.on({
          mouseover: (e) => e.target.setStyle({ weight: 1.6, color: "#284b3d", fillOpacity: Math.max(0.18, e.target.options.fillOpacity) }),
          mouseout: (e) => layer.resetStyle(e.target),
          click: (e) => handlers.current.onCountryClick?.(f, e.latlng),
        });
      },
    }).addTo(map.current);
    countryLayer.current = layer;
    return () => { layer.remove(); countryLayer.current = null; };
  }, [features]);

  // 3. Mise à jour des couleurs (ex. quand vous marquez un pays comme visité)
  useEffect(() => {
    countryLayer.current?.setStyle((f) => ({ ...defaultStyle, ...(handlers.current.countryStyle?.(f) || {}) }));
  }, [styleKey, features]);

  // 4. Marqueurs et itinéraire
  useEffect(() => {
    const group = markerLayer.current;
    if (!group) return;
    group.clearLayers();
    const points = markers.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    points.forEach((place, index) => {
      const active = place.id === activeMarkerId ? " active" : "";
      const label = numbered ? `<b>${index + 1}</b>` : "";
      const icon = L.divIcon({
        className: "pin-wrap",
        html: `<span class="pin kind-${escapeHtml(place.kind || "place")}${active}${numbered ? " numbered" : ""}">${label}</span>`,
        iconSize: numbered ? [26, 26] : [18, 18],
        iconAnchor: numbered ? [13, 13] : [9, 9],
      });
      L.marker([place.lat, place.lng], { icon, riseOnHover: true, zIndexOffset: active ? 1000 : 0 })
        .bindTooltip(escapeHtml(place.name), { direction: "top", offset: [0, -8], className: "map-tip" })
        .on("click", () => handlers.current.onMarkerClick?.(place))
        .addTo(group);
    });
    if (route && points.length > 1) {
      L.polyline(points.map((p) => [p.lat, p.lng]), { color: "#284b3d", weight: 3, opacity: 0.75, dashArray: "6 8" }).addTo(group);
    }
  }, [markers, activeMarkerId, route, numbered]);

  // 5. Cadrage de la carte (monde entier, un pays, des marqueurs, une zone...)
  const fitKey = fit ? JSON.stringify({ ...fit, features: undefined }) : "";
  useEffect(() => {
    const m = map.current;
    if (!m || !fit) return;
    const options = { padding: [28, 28], maxZoom: fit.maxZoom ?? 12, animate: true };
    if (fit.world) { m.setView([25, 10], 2); return; }
    if (fit.center) { m.setView(fit.center, fit.zoom ?? 6); return; }
    if (fit.bounds) { m.fitBounds(fit.bounds, options); return; }
    if (fit.countryCode && countryLayer.current) {
      const layers = countryLayer.current.getLayers().filter((l) => l.feature?.properties?.code === fit.countryCode);
      if (layers.length) {
        const bounds = L.latLngBounds([]);
        layers.forEach((l) => bounds.extend(l.getBounds()));
        // Pays à cheval sur la ligne de changement de date (Russie, Fidji...) : on recentre simplement.
        if (bounds.getEast() - bounds.getWest() > 180 && fit.fallbackCenter) m.setView(fit.fallbackCenter, 3);
        else m.fitBounds(bounds, { ...options, maxZoom: fit.maxZoom ?? 7 });
        return;
      }
      if (fit.fallbackCenter) m.setView(fit.fallbackCenter, 6);
      return;
    }
    if (fit.markers) {
      const points = markers.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      if (points.length === 1) m.setView([points[0].lat, points[0].lng], fit.maxZoom ?? 10);
      else if (points.length > 1) m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), options);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, features, fit?.markers ? markers : null]);

  return <div ref={container} className={`world-map ${className}`} />;
}
