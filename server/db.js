// Base de données de WanderMap.
// Deux modes, avec exactement les mêmes tables et les mêmes requêtes SQL :
//  - EN LIGNE (Render)  : base Turso (SQLite hébergé gratuitement), si TURSO_DATABASE_URL est défini.
//                         Les données sont gardées chez Turso : rien ne se perd quand Render redémarre.
//  - EN LOCAL (votre Mac) : fichier SQLite server/data/wandermap.db (module node:sqlite intégré à Node).
// Le reste du serveur utilise seulement db.get / db.all / db.run, sans savoir quel mode est actif.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR || join(here, "data");
mkdirSync(DATA_DIR, { recursive: true });

const SCHEMA = [
  // Comptes utilisateurs (le mot de passe n'est jamais stocké en clair)
  `CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    bio           TEXT NOT NULL DEFAULT '',
    home_country  TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  // Lieux enregistrés en favoris (data = JSON du lieu : nom, coordonnées, image...)
  `CREATE TABLE IF NOT EXISTS saved_places (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    place_id   TEXT NOT NULL,
    data       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, place_id)
  )`,
  // Statut de chaque pays pour un utilisateur : visité ou à visiter
  `CREATE TABLE IF NOT EXISTS country_status (
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    country_code TEXT NOT NULL,
    status       TEXT NOT NULL CHECK (status IN ('visited', 'wishlist')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, country_code)
  )`,
  // Voyages planifiés (stops = JSON : liste ordonnée des étapes)
  `CREATE TABLE IF NOT EXISTS trips (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    country_code TEXT,
    start_date   TEXT,
    end_date     TEXT,
    notes        TEXT NOT NULL DEFAULT '',
    stops        TEXT NOT NULL DEFAULT '[]',
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

// Les bases n'acceptent pas "undefined" comme valeur : on le remplace par null.
const clean = (args) => args.map((a) => (a === undefined ? null : a));

// --- Mode Turso (en ligne) -----------------------------------------------------
// "client" est un client @libsql/client. Les résultats sont convertis en objets simples
// { colonne: valeur }, comme en local.
export function tursoAdapter(client) {
  const toObjects = (result) => result.rows.map((row) => Object.fromEntries(result.columns.map((col, i) => [col, row[i]])));
  return {
    mode: "turso",
    async get(sql, ...args) { return toObjects(await client.execute({ sql, args: clean(args) }))[0]; },
    async all(sql, ...args) { return toObjects(await client.execute({ sql, args: clean(args) })); },
    async run(sql, ...args) {
      const result = await client.execute({ sql, args: clean(args) });
      return { changes: result.rowsAffected, lastInsertRowid: Number(result.lastInsertRowid ?? 0) };
    },
    async init() { for (const statement of SCHEMA) await client.execute(statement); },
  };
}

// --- Mode local (fichier SQLite) ------------------------------------------------
async function localAdapter() {
  const { DatabaseSync } = await import("node:sqlite");
  const file = process.env.DB_FILE || join(DATA_DIR, "wandermap.db");
  const sqlite = new DatabaseSync(file);
  sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  return {
    mode: `fichier local (${file})`,
    async get(sql, ...args) { return sqlite.prepare(sql).get(...clean(args)); },
    async all(sql, ...args) { return sqlite.prepare(sql).all(...clean(args)); },
    async run(sql, ...args) {
      const result = sqlite.prepare(sql).run(...clean(args));
      return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) };
    },
    async init() { for (const statement of SCHEMA) sqlite.exec(statement); },
  };
}

async function connect() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) return localAdapter();
  // Client "web" de Turso : il passe par HTTPS et n'a besoin d'aucun module natif.
  const { createClient } = await import("@libsql/client/web");
  const client = createClient({ url: url.replace(/^libsql:\/\//, "https://"), authToken: process.env.TURSO_AUTH_TOKEN });
  return tursoAdapter(client);
}

export const db = await connect();
await db.init();
console.log(`✦ Base de données : ${db.mode}`);
