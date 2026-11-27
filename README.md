# WanderMap — Version 2

Site web de voyage : explorez **tous les pays du monde** sur une **carte interactive**, découvrez leurs destinations, **créez un compte**, enregistrez vos lieux favoris, coloriez les pays visités et planifiez vos voyages étape par étape.

## Lancer le projet

Prérequis : **Node.js 22.13 ou plus récent** (`node -v` pour vérifier). Le serveur utilise la base SQLite intégrée à Node, il n'y a rien d'autre à installer.

```bash
npm install
npm run dev
```

Ouvrez ensuite **http://localhost:5173**.
`npm run dev` démarre deux choses en même temps : le serveur API (port 3001) et le site Vite (port 5173).

> Le dossier `node_modules` n'est pas inclus dans le ZIP : `npm install` le recrée (il ajoute aussi les nouvelles bibliothèques `leaflet` et `topojson-client`).

### Mise en ligne (production)

```bash
npm run build   # compile le site dans dist/
npm start       # un seul serveur sert le site ET l'API sur le port 3001 (ou $PORT)
```

Hébergeur conseillé : un service qui exécute Node.js avec un **disque persistant** (Render, Railway, Fly.io, un VPS…), car la base SQLite est un fichier. Variables d'environnement utiles :

| Variable | Rôle |
|---|---|
| `PORT` | Port du serveur (défaut 3001) |
| `JWT_SECRET` | Clé secrète des sessions (sinon générée automatiquement dans `server/data/.jwt-secret`) |
| `DATA_DIR` | Dossier de la base de données (défaut `server/data/`) |

## Ce qui a changé par rapport à la version 1

| Version 1 | Version 2 |
|---|---|
| 6 destinations écrites à la main | Les **250 pays et territoires** + des milliers de destinations réelles (Wikidata) |
| Carte dessinée en CSS | **Vraie carte Leaflet** : zoom, plan / épuré / satellite, frontières cliquables, marqueurs, itinéraires |
| Profil fictif, pas de compte | **Inscription, connexion, déconnexion**, changement de mot de passe, suppression du compte |
| Données dans le navigateur (localStorage) | **Base de données SQLite** sur le serveur : on retrouve ses données sur n'importe quel appareil |
| Recherche dans 6 lieux | **Recherche de n'importe quel lieu sur Terre** (OpenStreetMap) |
| — | Fiche de lieu : description et photo Wikipédia, **météo et heure locale**, lieux à proximité, itinéraire Google Maps |
| — | Fiche pays : capitale, population, langues, monnaie, présentation, carte, destinations par catégorie, pays voisins |
| Voyages = nom + dates | Voyages avec **étapes ordonnées**, carte de l'itinéraire, distances, durée, notes |
| Interface en anglais | Interface en français, adaptée au mobile |

## D'où viennent les données ?

Tous ces services sont **gratuits et sans clé d'API** :

- **world-countries** (via le CDN jsDelivr) : liste des pays, noms français, capitales, langues, monnaies, frontières. Secours : REST Countries.
- **world-atlas / Natural Earth** : contours des pays pour la carte.
- **Wikidata** : destinations de chaque pays (villes, sites UNESCO, parcs nationaux, attractions), classées par notoriété ; population.
- **Wikipédia** : descriptions, photos, lieux à proximité.
- **OpenStreetMap / Nominatim** : recherche de lieux. Leur règle d'usage interdit les requêtes massives : la recherche ne part que quand on valide.
- **Open-Meteo** : météo et fuseau horaire.
- **Fonds de carte** : CARTO (OpenStreetMap) et Esri (satellite). **Drapeaux** : flagcdn.com.

Le site a besoin d'Internet pour ces données. Les comptes, favoris, pays et voyages, eux, sont dans notre propre base.

## Organisation des fichiers

```
WanderMap/
├── index.html               Page HTML de départ (titre, polices, icône)
├── package.json             Dépendances et commandes npm
├── vite.config.js           Configuration Vite + redirection de /api vers le serveur
├── scripts/dev.mjs          Lance serveur + site avec une seule commande
├── server/                  ── BACK-END (Node.js, sans framework) ──
│   ├── index.js             Serveur HTTP : toutes les routes /api + service du site compilé
│   ├── db.js                Création de la base SQLite et des 4 tables
│   └── auth.js              Hachage des mots de passe (scrypt) et jetons de connexion (JWT)
└── src/                     ── FRONT-END (React) ──
    ├── main.jsx             Point d'entrée React
    ├── App.jsx              Menu latéral, navigation entre les pages, notifications
    ├── styles.css           Tout le design (même identité visuelle que la V1)
    ├── lib/
    │   ├── world.js         Accès aux données mondiales (pays, Wikidata, Wikipédia, OSM, météo)
    │   ├── api.js           Appels à notre serveur avec le jeton de connexion
    │   ├── store.jsx        État global : utilisateur, favoris, pays, voyages + actions
    │   ├── router.js        Navigation par adresse (#/pays/DZ, #/voyages/3…)
    │   └── useWorld.js      Hooks de chargement des données
    ├── components/
    │   ├── WorldMap.jsx     Carte Leaflet réutilisable (pays, marqueurs, itinéraire)
    │   ├── PlaceModal.jsx   Fiche détaillée d'un lieu
    │   ├── TripForm.jsx     Formulaire « Créer un voyage » + sélecteur de pays
    │   ├── PageHeader.jsx   En-tête de page + écran « connectez-vous »
    │   └── ui.jsx           Petits composants : carte de lieu, fenêtre modale, drapeau…
    └── pages/
        ├── Home.jsx         Accueil (recherche, stats, pays du jour, continents)
        ├── Explore.jsx      Carte du monde + recherche + liste des pays
        ├── Country.jsx      Fiche d'un pays
        ├── MyWorld.jsx      Ma carte des pays visités / à visiter
        ├── Saved.jsx        Mes favoris
        ├── Trips.jsx        Liste des voyages
        ├── Trip.jsx         Détail d'un voyage (étapes, carte, infos)
        ├── Profile.jsx      Profil et paramètres du compte
        └── Auth.jsx         Connexion / inscription
```

## Base de données

| Table | Contenu |
|---|---|
| `users` | id, nom, email (unique), mot de passe **haché**, bio, pays de résidence, date d'inscription |
| `saved_places` | lieux favoris d'un utilisateur (le lieu est stocké en JSON) |
| `country_status` | pour chaque utilisateur et pays : `visited` ou `wishlist` |
| `trips` | voyages : nom, pays, dates, notes, étapes (JSON ordonné) |

Supprimer un utilisateur supprime automatiquement ses favoris, pays et voyages (`ON DELETE CASCADE`).

## API du serveur

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/auth/register` | Créer un compte → renvoie un jeton |
| POST | `/api/auth/login` | Se connecter → renvoie un jeton |
| GET | `/api/me` | Compte + favoris + pays + voyages |
| PUT | `/api/me` | Modifier le profil |
| PUT | `/api/me/password` | Changer le mot de passe |
| DELETE | `/api/me` | Supprimer le compte (mot de passe demandé) |
| POST / DELETE | `/api/saved` · `/api/saved/:id` | Ajouter / retirer un favori |
| PUT / DELETE | `/api/countries/:code` | Marquer un pays visité / à visiter / retirer |
| POST / PUT / DELETE | `/api/trips` · `/api/trips/:id` | Créer / modifier / supprimer un voyage |

Toutes les routes sauf inscription et connexion exigent l'en-tête `Authorization: Bearer <jeton>`.

## Sécurité (à présenter en soutenance)

- Mots de passe hachés avec **scrypt** et un sel aléatoire, jamais stockés en clair.
- Sessions par **jeton JWT signé** (HMAC-SHA256), valable 7 jours.
- Chaque requête vérifie que la donnée appartient bien à l'utilisateur connecté.
- Toutes les entrées sont validées et limitées en taille côté serveur.
- Limite de 10 tentatives de connexion par 15 minutes.
- Les textes venant de sources externes sont échappés avant affichage (pas d'injection HTML).
