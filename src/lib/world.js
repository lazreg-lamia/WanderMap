// Toutes les données "du monde" viennent d'ici. Rien n'est inventé :
// - liste des 250 pays et territoires : projet world-countries (via le CDN jsDelivr)
// - frontières des pays pour la carte : projet world-atlas / Natural Earth (via jsDelivr)
// - destinations de chaque pays : Wikidata (villes, sites UNESCO, parcs, attractions)
// - descriptions et photos : Wikipédia
// - recherche de n'importe quel lieu : OpenStreetMap / Nominatim
// - météo et heure locale : Open-Meteo
// Ces services sont gratuits et sans clé d'API.
import { feature } from "topojson-client";

// ---------------------------------------------------------------------------
// Petites aides
// ---------------------------------------------------------------------------
async function getJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Requête échouée (${response.status})`);
  return response.json();
}

// Essaie plusieurs adresses dans l'ordre et garde la première qui répond.
async function firstOk(urls) {
  let lastError;
  for (const url of urls) {
    try { return await getJson(url); } catch (error) { lastError = error; }
  }
  throw lastError;
}

// Cache en mémoire + sessionStorage : on n'interroge pas deux fois le même service pendant une visite.
const memory = new Map();
async function cached(key, loader) {
  if (memory.has(key)) return memory.get(key);
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) { const value = JSON.parse(stored); memory.set(key, value); return value; }
  } catch { /* stockage indisponible : on continue sans */ }
  const promise = loader();
  memory.set(key, promise);
  try {
    const value = await promise;
    memory.set(key, value);
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* quota plein */ }
    return value;
  } catch (error) {
    memory.delete(key); // en cas d'erreur, on pourra réessayer
    throw error;
  }
}

export const flagUrl = (code, width = 80) => `https://flagcdn.com/w${width}/${String(code).toLowerCase()}.png`;

export const REGIONS = { Africa: "Afrique", Americas: "Amériques", Asia: "Asie", Europe: "Europe", Oceania: "Océanie", Antarctic: "Antarctique" };

const SUBREGIONS = {
  "Northern Africa": "Afrique du Nord", "Western Africa": "Afrique de l'Ouest", "Middle Africa": "Afrique centrale",
  "Eastern Africa": "Afrique de l'Est", "Southern Africa": "Afrique australe", "North America": "Amérique du Nord",
  "Northern America": "Amérique du Nord", "Central America": "Amérique centrale", Caribbean: "Caraïbes",
  "South America": "Amérique du Sud", "Western Asia": "Asie de l'Ouest", "Central Asia": "Asie centrale",
  "Southern Asia": "Asie du Sud", "Eastern Asia": "Asie de l'Est", "South-Eastern Asia": "Asie du Sud-Est",
  "Northern Europe": "Europe du Nord", "Western Europe": "Europe de l'Ouest", "Southern Europe": "Europe du Sud",
  "Eastern Europe": "Europe de l'Est", "Central Europe": "Europe centrale", "Southeast Europe": "Europe du Sud-Est",
  "Australia and New Zealand": "Australie et Nouvelle-Zélande", Melanesia: "Mélanésie", Micronesia: "Micronésie", Polynesia: "Polynésie",
};

function displayName(type, code, fallback) {
  try {
    const name = new Intl.DisplayNames(["fr"], { type }).of(code);
    return name && name.toLowerCase() !== code.toLowerCase() ? name : fallback;
  } catch {
    return fallback;
  }
}

// Met en forme un pays (même format que world-countries et REST Countries).
function normalizeCountry(c) {
  return {
    code: c.cca2,
    cca3: c.cca3,
    ccn3: c.ccn3 ? String(c.ccn3).padStart(3, "0") : "",
    name: c.translations?.fra?.common || c.name?.common,
    nameEn: c.name?.common,
    official: c.translations?.fra?.official || c.name?.official,
    capital: Array.isArray(c.capital) ? c.capital.filter(Boolean).join(", ") : c.capital || "",
    region: REGIONS[c.region] || c.region || "",
    subregion: SUBREGIONS[c.subregion] || c.subregion || "",
    lat: c.latlng?.[0] ?? 0,
    lng: c.latlng?.[1] ?? 0,
    area: c.area || 0,
    languages: Object.entries(c.languages || {}).map(([code, name]) => displayName("language", code, name)),
    currencies: Object.entries(c.currencies || {}).map(([code, cur]) => `${displayName("currency", code, cur.name)}${cur.symbol ? ` (${cur.symbol})` : ""}`),
    borders: c.borders || [],
    independent: c.independent !== false,
    landlocked: Boolean(c.landlocked),
    emoji: c.flag || "",
  };
}

// ---------------------------------------------------------------------------
// Pays et frontières (chargés une seule fois)
// ---------------------------------------------------------------------------
let worldPromise;
export function loadWorld() {
  worldPromise ??= (async () => {
    // Données des pays (projet open source "world-countries", servi par le CDN jsDelivr).
    // Secours : l'API publique REST Countries, qui utilise le même format.
    const raw = await firstOk([
      "https://cdn.jsdelivr.net/npm/world-countries@5/countries.json",
      "https://cdn.jsdelivr.net/npm/world-countries@5/dist/countries.json",
      "https://restcountries.com/v3.1/all?fields=name,translations,cca2,cca3,ccn3,capital,region,subregion,latlng,area,languages,currencies,borders,independent,landlocked,flag",
    ]);
    const countries = raw.filter((c) => c.cca2).map(normalizeCountry).sort((a, b) => a.name.localeCompare(b.name, "fr"));
    const byCode = Object.fromEntries(countries.map((c) => [c.code, c]));
    const byCca3 = Object.fromEntries(countries.map((c) => [c.cca3, c]));
    const byNumeric = Object.fromEntries(countries.filter((c) => c.ccn3).map((c) => [c.ccn3, c]));

    // Frontières des pays (Natural Earth 1:50m, projet "world-atlas").
    const topology = await firstOk([
      "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json",
      "https://unpkg.com/world-atlas@2/countries-50m.json",
    ]);
    const features = feature(topology, topology.objects.countries).features.map((f) => {
      const country = byNumeric[String(f.id).padStart(3, "0")];
      return { ...f, properties: { ...f.properties, code: country?.code || null } };
    });
    return { countries, byCode, byCca3, features };
  })();
  worldPromise.catch(() => { worldPromise = undefined; });
  return worldPromise;
}

// ---------------------------------------------------------------------------
// Wikidata : informations et destinations d'un pays
// ---------------------------------------------------------------------------
async function sparql(query) {
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  const data = await getJson(url, { headers: { Accept: "application/sparql-results+json" } });
  return data.results.bindings;
}

const commonsImage = (url, width = 640) => (url ? `${url.replace(/^http:/, "https:")}?width=${width}` : "");
const pointToLatLng = (wkt) => {
  const match = /Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(wkt || "");
  return match ? { lat: Number(match[2]), lng: Number(match[1]) } : null;
};

// Population et titre de l'article Wikipédia du pays.
export function getCountryFacts(code) {
  return cached(`wm_facts_${code}`, async () => {
    const rows = await sparql(`
      SELECT ?country ?links ?pop ?fr ?en WHERE {
        ?country wdt:P297 "${code}" ; wikibase:sitelinks ?links .
        OPTIONAL { ?country wdt:P1082 ?pop . }
        OPTIONAL { ?a schema:about ?country ; schema:isPartOf <https://fr.wikipedia.org/> ; schema:name ?fr . }
        OPTIONAL { ?b schema:about ?country ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?en . }
      } ORDER BY DESC(?links) LIMIT 20`);
    if (!rows.length) return {};
    const best = rows.filter((r) => r.country.value === rows[0].country.value);
    const population = Math.max(0, ...best.map((r) => Number(r.pop?.value || 0)));
    return {
      wikidata: rows[0].country.value.split("/").pop(),
      population: population || null,
      wikiTitle: rows[0].fr?.value || rows[0].en?.value || "",
      wikiLang: rows[0].fr ? "fr" : "en",
    };
  });
}

// Types Wikidata recherchés → catégorie affichée sur le site.
const DESTINATION_TYPES = [
  ["Q515", "city"], ["Q1549591", "city"], ["Q1637706", "city"], ["Q200250", "city"], ["Q5119", "city"],
  ["Q570116", "attraction"], ["Q46169", "nature"], ["Q8502", "nature"], ["Q23397", "nature"], ["Q40080", "nature"],
];
export const KIND_LABELS = { city: "Ville", unesco: "Patrimoine UNESCO", nature: "Nature", attraction: "Site & monument", place: "Lieu", country: "Pays" };

// Les destinations les plus connues d'un pays (classées par nombre d'articles Wikipédia dans le monde).
export function getDestinations(code) {
  return cached(`wm_dest_${code}`, async () => {
    const values = DESTINATION_TYPES.map(([q, kind]) => `(wd:${q} "${kind}")`).join(" ");
    const rows = await sparql(`
      SELECT ?item ?itemLabel ?itemDescription ?links (SAMPLE(?coord) AS ?c) (SAMPLE(?img) AS ?image)
             (GROUP_CONCAT(DISTINCT ?kind; separator=",") AS ?kinds) (SAMPLE(?frTitle) AS ?fr) (SAMPLE(?enTitle) AS ?en)
      WHERE {
        hint:Query hint:optimizer "None" .
        ?country wdt:P297 "${code}" .
        { VALUES (?type ?kind) { ${values} } ?item wdt:P31 ?type . }
        UNION
        { ?item wdt:P1435 wd:Q9259 . BIND("unesco" AS ?kind) }
        ?item wdt:P17 ?country ; wdt:P625 ?coord ; wikibase:sitelinks ?links .
        FILTER(?links >= 5)
        OPTIONAL { ?item wdt:P18 ?img . }
        OPTIONAL { ?fa schema:about ?item ; schema:isPartOf <https://fr.wikipedia.org/> ; schema:name ?frTitle . }
        OPTIONAL { ?ea schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enTitle . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" . }
      }
      GROUP BY ?item ?itemLabel ?itemDescription ?links
      ORDER BY DESC(?links)
      LIMIT 90`);

    const seen = new Set();
    return rows.flatMap((r) => {
      const qid = r.item.value.split("/").pop();
      const point = pointToLatLng(r.c?.value);
      const name = r.itemLabel?.value || "";
      if (seen.has(qid) || !point || !name || /^Q\d+$/.test(name)) return [];
      seen.add(qid);
      const kinds = (r.kinds?.value || "").split(",");
      const kind = ["city", "unesco", "nature", "attraction"].find((k) => kinds.includes(k)) || "attraction";
      return [{
        id: `wd:${qid}`, wikidata: qid, name, kind, countryCode: code, ...point,
        subtitle: r.itemDescription?.value || "", description: r.itemDescription?.value || "",
        image: commonsImage(r.image?.value), wikiTitle: r.fr?.value || r.en?.value || "", wikiLang: r.fr ? "fr" : "en",
        popularity: Number(r.links?.value || 0),
      }];
    });
  });
}

// ---------------------------------------------------------------------------
// Wikipédia : résumé d'un article et lieux à proximité
// ---------------------------------------------------------------------------
export function getSummary(title, lang = "fr") {
  if (!title) return Promise.resolve(null);
  return cached(`wm_sum_${lang}_${title}`, async () => {
    const data = await getJson(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
    return {
      title: data.title, extract: data.extract || "", description: data.description || "",
      image: data.originalimage?.source || data.thumbnail?.source || "", thumbnail: data.thumbnail?.source || "",
      url: data.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    };
  });
}

// Pour un lieu venant d'OpenStreetMap : retrouve son article Wikipédia via Wikidata si besoin.
export async function resolveWiki(place) {
  if (place.wikiTitle) return { title: place.wikiTitle, lang: place.wikiLang || "fr" };
  if (!place.wikidata) return null;
  const data = await cached(`wm_wd_${place.wikidata}`, () => getJson(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${place.wikidata}&props=sitelinks&sitefilter=frwiki|enwiki&format=json&origin=*`,
  ));
  const links = data.entities?.[place.wikidata]?.sitelinks || {};
  if (links.frwiki) return { title: links.frwiki.title, lang: "fr" };
  if (links.enwiki) return { title: links.enwiki.title, lang: "en" };
  return null;
}

export function getNearby(lat, lng, lang = "fr") {
  const key = `wm_near_${lang}_${lat.toFixed(3)}_${lng.toFixed(3)}`;
  return cached(key, async () => {
    const params = new URLSearchParams({
      action: "query", format: "json", origin: "*", generator: "geosearch", ggscoord: `${lat}|${lng}`,
      ggsradius: "10000", ggslimit: "24", prop: "pageimages|coordinates|description", piprop: "thumbnail",
      pithumbsize: "400", pilimit: "max", colimit: "max",
    });
    const data = await getJson(`https://${lang}.wikipedia.org/w/api.php?${params}`);
    return Object.values(data.query?.pages || {})
      .filter((p) => p.coordinates?.[0])
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((p) => ({
        id: `wp:${lang}:${p.pageid}`, name: p.title, kind: "place", lat: p.coordinates[0].lat, lng: p.coordinates[0].lon,
        image: p.thumbnail?.source || "", subtitle: p.description || "", description: p.description || "",
        wikiTitle: p.title, wikiLang: lang,
      }));
  });
}

// ---------------------------------------------------------------------------
// OpenStreetMap / Nominatim : recherche de n'importe quel lieu sur Terre
// ---------------------------------------------------------------------------
function kindFromOsm(r) {
  if (r.addresstype === "country") return "country";
  if (["city", "town", "village", "municipality", "hamlet", "suburb"].includes(r.addresstype) || r.category === "place") return "city";
  if (["natural", "leisure", "waterway"].includes(r.category) || r.type === "national_park") return "nature";
  if (["tourism", "historic", "amenity", "building"].includes(r.category)) return "attraction";
  return "place";
}

export async function searchPlaces(query, { countryCode } = {}) {
  const params = new URLSearchParams({ q: query, format: "jsonv2", limit: "12", addressdetails: "1", extratags: "1", "accept-language": "fr" });
  if (countryCode) params.set("countrycodes", countryCode.toLowerCase());
  const results = await getJson(`https://nominatim.openstreetmap.org/search?${params}`);
  return results.map((r) => {
    const [lang, ...title] = String(r.extratags?.wikipedia || "").split(":");
    const parts = String(r.display_name || "").split(",").map((s) => s.trim());
    return {
      id: `osm:${r.osm_type}/${r.osm_id}`, name: r.name || parts[0], subtitle: parts.slice(1).join(", "),
      kind: kindFromOsm(r), countryCode: (r.address?.country_code || "").toUpperCase(),
      lat: Number(r.lat), lng: Number(r.lon), image: "", description: "",
      bbox: r.boundingbox ? r.boundingbox.map(Number) : null, // [sud, nord, ouest, est]
      wikidata: r.extratags?.wikidata || "", wikiTitle: title.length ? title.join(":") : "", wikiLang: title.length ? lang : "",
    };
  });
}

// ---------------------------------------------------------------------------
// Open-Meteo : météo actuelle, prévisions et heure locale
// ---------------------------------------------------------------------------
const WEATHER = [
  [[0], "Ciel dégagé", "☀️"], [[1, 2], "Peu nuageux", "🌤️"], [[3], "Couvert", "☁️"], [[45, 48], "Brouillard", "🌫️"],
  [[51, 53, 55, 56, 57], "Bruine", "🌦️"], [[61, 63, 65, 66, 67, 80, 81, 82], "Pluie", "🌧️"],
  [[71, 73, 75, 77, 85, 86], "Neige", "❄️"], [[95, 96, 99], "Orage", "⛈️"],
];
export const weatherLabel = (code) => {
  const entry = WEATHER.find(([codes]) => codes.includes(code));
  return entry ? { label: entry[1], icon: entry[2] } : { label: "—", icon: "🌡️" };
};

export function getWeather(lat, lng) {
  const params = new URLSearchParams({
    latitude: lat.toFixed(3), longitude: lng.toFixed(3), timezone: "auto", forecast_days: "5",
    current: "temperature_2m,weather_code,wind_speed_10m", daily: "weather_code,temperature_2m_max,temperature_2m_min",
  });
  return getJson(`https://api.open-meteo.com/v1/forecast?${params}`);
}

// ---------------------------------------------------------------------------
// Calculs
// ---------------------------------------------------------------------------
export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export const formatNumber = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
