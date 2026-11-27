// Serveur API de WanderMap (Node.js pur, sans framework).
// - /api/...  : comptes, profil, favoris, pays visités, voyages (données en SQLite)
// - le reste  : en production, sert le site compilé (dossier dist/) produit par "npm run build"
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, normalize, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./db.js";
import { hashPassword, verifyPassword, createToken, readToken } from "./auth.js";

const PORT = Number(process.env.PORT) || 3001;
const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 200_000) throw new HttpError(413, "Requête trop volumineuse.");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new HttpError(400, "JSON invalide."); }
}

const text = (value, max = 200) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
const isCountryCode = (value) => /^[A-Z]{2}$/.test(value);
const isDate = (value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value);

// Transforme une ligne SQL en objet envoyé au navigateur (jamais le hash du mot de passe).
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, bio: u.bio, homeCountry: u.home_country, createdAt: u.created_at });
const publicTrip = (t) => ({
  id: t.id, name: t.name, countryCode: t.country_code, startDate: t.start_date || "", endDate: t.end_date || "",
  notes: t.notes, stops: JSON.parse(t.stops || "[]"), createdAt: t.created_at,
});

// Nettoie un lieu reçu du navigateur avant de le stocker.
function cleanPlace(p) {
  if (!p || typeof p !== "object") throw new HttpError(400, "Lieu manquant.");
  const place = {
    id: text(p.id, 120), name: text(p.name, 200), subtitle: text(p.subtitle, 200), kind: text(p.kind, 40),
    countryCode: text(p.countryCode, 2).toUpperCase(), image: text(p.image, 600), description: text(p.description, 400),
    wikiTitle: text(p.wikiTitle, 200), wikiLang: text(p.wikiLang, 5),
    lat: Number(p.lat), lng: Number(p.lng),
  };
  if (!place.id || !place.name) throw new HttpError(400, "Le lieu doit avoir un identifiant et un nom.");
  if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) throw new HttpError(400, "Coordonnées invalides.");
  return place;
}

function cleanTrip(body) {
  const trip = {
    name: text(body.name, 120), countryCode: text(body.countryCode, 2).toUpperCase() || null,
    startDate: text(body.startDate, 10), endDate: text(body.endDate, 10), notes: text(body.notes, 4000),
    stops: Array.isArray(body.stops) ? body.stops.slice(0, 100).map(cleanPlace) : [],
  };
  if (!trip.name) throw new HttpError(400, "Donnez un nom à votre voyage.");
  if (trip.countryCode && !isCountryCode(trip.countryCode)) throw new HttpError(400, "Code pays invalide.");
  if (!isDate(trip.startDate) || !isDate(trip.endDate)) throw new HttpError(400, "Dates invalides.");
  if (trip.startDate && trip.endDate && trip.endDate < trip.startDate) throw new HttpError(400, "La date de retour est avant la date de départ.");
  return trip;
}

// Limite simple contre les tentatives de connexion répétées (10 essais / 15 min par IP + email).
const attempts = new Map();
function checkRateLimit(key) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.start > 15 * 60_000) { attempts.set(key, { start: now, count: 1 }); return; }
  entry.count += 1;
  if (entry.count > 10) throw new HttpError(429, "Trop de tentatives. Réessayez dans quelques minutes.");
}

async function currentUser(req) {
  const header = req.headers.authorization || "";
  const userId = readToken(header.startsWith("Bearer ") ? header.slice(7) : "");
  const user = userId && (await db.get("SELECT * FROM users WHERE id = ?", userId));
  if (!user) throw new HttpError(401, "Veuillez vous connecter.");
  return user;
}

// Toutes les données d'un utilisateur, renvoyées en une seule fois après la connexion.
async function userBundle(user) {
  const saved = (await db.all("SELECT data FROM saved_places WHERE user_id = ? ORDER BY created_at DESC, id DESC", user.id))
    .map((row) => JSON.parse(row.data));
  const countries = Object.fromEntries(
    (await db.all("SELECT country_code, status FROM country_status WHERE user_id = ?", user.id)).map((r) => [r.country_code, r.status]),
  );
  const trips = (await db.all("SELECT * FROM trips WHERE user_id = ? ORDER BY COALESCE(start_date, '9999'), id DESC", user.id)).map(publicTrip);
  return { user: publicUser(user), saved, countries, trips };
}

// ---------------------------------------------------------------------------
// Routes de l'API
// ---------------------------------------------------------------------------
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, pattern: new RegExp(`^${pattern}$`), handler });

route("GET", "/api/health", () => ({ ok: true }));

route("POST", "/api/auth/register", async (req) => {
  const body = await readJson(req);
  const name = text(body.name, 80);
  const email = text(body.email, 160).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  if (name.length < 2) throw new HttpError(400, "Votre nom doit contenir au moins 2 caractères.");
  if (!isEmail(email)) throw new HttpError(400, "Adresse email invalide.");
  if (password.length < 8 || password.length > 200) throw new HttpError(400, "Le mot de passe doit contenir au moins 8 caractères.");
  if ((await db.get("SELECT 1 FROM users WHERE email = ?", email))) throw new HttpError(409, "Un compte existe déjà avec cet email.");
  const { lastInsertRowid } = (await db.run("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)", name, email, hashPassword(password)));
  const user = (await db.get("SELECT * FROM users WHERE id = ?", lastInsertRowid));
  return [201, { token: createToken(user.id), ...(await userBundle(user)) }];
});

route("POST", "/api/auth/login", async (req) => {
  const body = await readJson(req);
  const email = text(body.email, 160).toLowerCase();
  checkRateLimit(`${req.socket.remoteAddress}|${email}`);
  const user = (await db.get("SELECT * FROM users WHERE email = ?", email));
  if (!user || !verifyPassword(String(body.password || ""), user.password_hash)) {
    throw new HttpError(401, "Email ou mot de passe incorrect.");
  }
  return { token: createToken(user.id), ...(await userBundle(user)) };
});

route("GET", "/api/me", async (req) => userBundle(await currentUser(req)));

route("PUT", "/api/me", async (req) => {
  const user = await currentUser(req);
  const body = await readJson(req);
  const name = text(body.name, 80);
  const homeCountry = text(body.homeCountry, 2).toUpperCase() || null;
  if (name.length < 2) throw new HttpError(400, "Votre nom doit contenir au moins 2 caractères.");
  if (homeCountry && !isCountryCode(homeCountry)) throw new HttpError(400, "Code pays invalide.");
  (await db.run("UPDATE users SET name = ?, bio = ?, home_country = ? WHERE id = ?", name, text(body.bio, 500), homeCountry, user.id));
  return { user: publicUser((await db.get("SELECT * FROM users WHERE id = ?", user.id))) };
});

route("PUT", "/api/me/password", async (req) => {
  const user = await currentUser(req);
  const body = await readJson(req);
  if (!verifyPassword(String(body.current || ""), user.password_hash)) throw new HttpError(400, "Mot de passe actuel incorrect.");
  const next = typeof body.next === "string" ? body.next : "";
  if (next.length < 8 || next.length > 200) throw new HttpError(400, "Le nouveau mot de passe doit contenir au moins 8 caractères.");
  (await db.run("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(next), user.id));
  return { ok: true };
});

route("DELETE", "/api/me", async (req) => {
  const user = await currentUser(req);
  const body = await readJson(req);
  if (!verifyPassword(String(body.password || ""), user.password_hash)) throw new HttpError(400, "Mot de passe incorrect.");
  // On efface d'abord les données liées, puis le compte.
  for (const table of ["saved_places", "country_status", "trips"]) await db.run(`DELETE FROM ${table} WHERE user_id = ?`, user.id);
  await db.run("DELETE FROM users WHERE id = ?", user.id);
  return [204];
});

route("POST", "/api/saved", async (req) => {
  const user = await currentUser(req);
  const place = cleanPlace((await readJson(req)).place);
  (await db.run("INSERT INTO saved_places (user_id, place_id, data) VALUES (?, ?, ?) ON CONFLICT (user_id, place_id) DO UPDATE SET data = excluded.data", user.id, place.id, JSON.stringify(place)));
  return [201, { place }];
});

route("DELETE", "/api/saved/(?<placeId>[^/]+)", async (req, params) => {
  const user = await currentUser(req);
  (await db.run("DELETE FROM saved_places WHERE user_id = ? AND place_id = ?", user.id, decodeURIComponent(params.placeId)));
  return [204];
});

route("PUT", "/api/countries/(?<code>[A-Za-z]{2})", async (req, params) => {
  const user = await currentUser(req);
  const { status } = await readJson(req);
  if (status !== "visited" && status !== "wishlist") throw new HttpError(400, "Statut invalide.");
  (await db.run(`INSERT INTO country_status (user_id, country_code, status) VALUES (?, ?, ?)
              ON CONFLICT (user_id, country_code) DO UPDATE SET status = excluded.status, updated_at = datetime('now')`, user.id, params.code.toUpperCase(), status));
  return { code: params.code.toUpperCase(), status };
});

route("DELETE", "/api/countries/(?<code>[A-Za-z]{2})", async (req, params) => {
  const user = await currentUser(req);
  (await db.run("DELETE FROM country_status WHERE user_id = ? AND country_code = ?", user.id, params.code.toUpperCase()));
  return [204];
});

route("POST", "/api/trips", async (req) => {
  const user = await currentUser(req);
  const t = cleanTrip(await readJson(req));
  const { lastInsertRowid } = await db.run(
    "INSERT INTO trips (user_id, name, country_code, start_date, end_date, notes, stops) VALUES (?, ?, ?, ?, ?, ?, ?)",
    user.id, t.name, t.countryCode, t.startDate || null, t.endDate || null, t.notes, JSON.stringify(t.stops),
  );
  return [201, { trip: publicTrip((await db.get("SELECT * FROM trips WHERE id = ?", lastInsertRowid))) }];
});

route("PUT", "/api/trips/(?<id>\\d+)", async (req, params) => {
  const user = await currentUser(req);
  const t = cleanTrip(await readJson(req));
  const result = await db.run(
    "UPDATE trips SET name = ?, country_code = ?, start_date = ?, end_date = ?, notes = ?, stops = ? WHERE id = ? AND user_id = ?",
    t.name, t.countryCode, t.startDate || null, t.endDate || null, t.notes, JSON.stringify(t.stops), Number(params.id), user.id,
  );
  if (!result.changes) throw new HttpError(404, "Voyage introuvable.");
  return { trip: publicTrip((await db.get("SELECT * FROM trips WHERE id = ?", Number(params.id)))) };
});

route("DELETE", "/api/trips/(?<id>\\d+)", async (req, params) => {
  const user = await currentUser(req);
  (await db.run("DELETE FROM trips WHERE id = ? AND user_id = ?", Number(params.id), user.id));
  return [204];
});

// ---------------------------------------------------------------------------
// Fichiers statiques (site compilé) — uniquement si le dossier dist/ existe
// ---------------------------------------------------------------------------
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2",
};

function serveStatic(req, res, pathname) {
  if (!existsSync(DIST)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("API WanderMap en ligne. En développement, ouvrez le site via Vite (http://localhost:5173).");
  }
  let file = normalize(join(DIST, decodeURIComponent(pathname)));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, "index.html"); // application monopage
  const headers = { "Content-Type": TYPES[extname(file)] || "application/octet-stream" };
  if (file.includes(`${join(DIST, "assets")}`)) headers["Cache-Control"] = "public, max-age=31536000, immutable";
  res.writeHead(200, headers);
  res.end(readFileSync(file));
}

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------
const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  if (!pathname.startsWith("/api/")) return serveStatic(req, res, pathname);
  try {
    for (const r of routes) {
      const match = r.method === req.method && pathname.match(r.pattern);
      if (!match) continue;
      const result = await r.handler(req, match.groups || {});
      return Array.isArray(result) ? send(res, result[0], result[1]) : send(res, 200, result);
    }
    throw new HttpError(404, "Route inconnue.");
  } catch (error) {
    if (!(error instanceof HttpError)) console.error(error);
    send(res, error.status || 500, { error: error.status ? error.message : "Erreur interne du serveur." });
  }
});

server.listen(PORT, () => console.log(`✦ WanderMap prêt sur http://localhost:${PORT}`));
