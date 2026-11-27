// Base de données SQLite de WanderMap.
// On utilise le module SQLite intégré à Node.js (node:sqlite, Node 22.13+) : aucune
// dépendance à installer, et toutes les données sont dans un seul fichier : server/data/wandermap.db
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR || join(here, "data");
mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(process.env.DB_FILE || join(DATA_DIR, "wandermap.db"));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  -- Comptes utilisateurs (le mot de passe n'est jamais stocké en clair)
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    bio           TEXT NOT NULL DEFAULT '',
    home_country  TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Lieux enregistrés en favoris (data = JSON du lieu : nom, coordonnées, image...)
  CREATE TABLE IF NOT EXISTS saved_places (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    place_id   TEXT NOT NULL,
    data       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, place_id)
  );

  -- Statut de chaque pays pour un utilisateur : visité ou à visiter
  CREATE TABLE IF NOT EXISTS country_status (
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    country_code TEXT NOT NULL,
    status       TEXT NOT NULL CHECK (status IN ('visited', 'wishlist')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, country_code)
  );

  -- Voyages planifiés (stops = JSON : liste ordonnée des étapes)
  CREATE TABLE IF NOT EXISTS trips (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    country_code TEXT,
    start_date   TEXT,
    end_date     TEXT,
    notes        TEXT NOT NULL DEFAULT '',
    stops        TEXT NOT NULL DEFAULT '[]',
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
