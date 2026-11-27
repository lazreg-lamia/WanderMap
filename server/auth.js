// Sécurité des comptes : hachage des mots de passe et jetons de connexion (JWT).
// Tout est fait avec le module crypto de Node.js, sans dépendance externe.
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./db.js";

// --- Mots de passe -------------------------------------------------------
// scrypt est un algorithme volontairement lent : il rend les attaques par force brute coûteuses.
// Format stocké : "scrypt:<sel en hex>:<hash en hex>"
export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password, stored) {
  const [algo, saltHex, hashHex] = String(stored).split(":");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(expected, actual); // comparaison à temps constant
}

// --- Jetons JWT (HS256) ----------------------------------------------------
// La clé secrète vient de la variable d'environnement JWT_SECRET, sinon elle est générée
// une fois puis gardée dans server/data/.jwt-secret (ainsi les sessions survivent au redémarrage).
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = join(DATA_DIR, ".jwt-secret");
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  const secret = randomBytes(48).toString("hex");
  writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}
const SECRET = loadSecret();
const TOKEN_LIFETIME = 60 * 60 * 24 * 7; // 7 jours, en secondes

const b64url = (input) => Buffer.from(input).toString("base64url");
const sign = (data) => createHmac("sha256", SECRET).update(data).digest("base64url");

export function createToken(userId) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ sub: userId, iat: now, exp: now + TOKEN_LIFETIME }));
  return `${header}.${payload}.${sign(`${header}.${payload}`)}`;
}

// Retourne l'identifiant de l'utilisateur si le jeton est valide et non expiré, sinon null.
export function readToken(token) {
  if (!token) return null;
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;
  const expected = Buffer.from(sign(`${header}.${payload}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.exp !== "number" || data.exp < Date.now() / 1000) return null;
    return Number(data.sub) || null;
  } catch {
    return null;
  }
}
