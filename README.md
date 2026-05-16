# mon-app-convex

Projet de prise en main de [Convex](https://convex.dev), construit sur une base React + Vite + TypeScript.

Le front React est un support minimal. L'objectif est d'explorer les briques Convex étape par étape.

## Documentation

Ce README sert de **journal d'implémentation** : ce qui a été fait, fichier par fichier, pour chacune des neuf étapes du projet.

Deux documents complètent cette base :

- **[TUTORIAL.md](TUTORIAL.md)** — tutoriel pédagogique pas à pas pour comprendre Convex à travers ce projet. À lire en premier pour découvrir les concepts (queries, mutations, actions, scheduling, file storage, intégration Clerk…).
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — guide de configuration et de déploiement, du setup local jusqu'à la mise en production sur Vercel avec déploiement Convex automatique.

## Feuille de route

| Étape | Brique Convex             | Objectif concret                                        | Statut |
| ----- | ------------------------- | ------------------------------------------------------- | ------ |
| 1     | Query + Mutation          | Lire et écrire des tâches                               | ✅     |
| 2     | Temps réel                | Voir la liste se mettre à jour automatiquement          | ✅     |
| 3     | Schéma + validation       | Structurer proprement les données                       | ✅     |
| 4     | Auth (Clerk)              | Introduire l'identité utilisateur via Clerk             | ✅     |
| 5     | Autorisation              | Filtrer les données selon l'utilisateur                 | ✅     |
| 6     | HTTP Actions / API        | Exposer un endpoint REST ou webhook                     | ✅     |
| 7     | Action externe            | Appeler une API tierce depuis Convex                    | ✅     |
| 8     | Scheduling                | Fonctions différées et cron jobs récurrents             | ✅     |
| 9     | File storage              | Upload et lecture de fichiers                           | ✅     |

## Ce qui a été implémenté

### Étape 1 — Query + Mutation

- **`convex/tasks.ts`** : query `list` pour lire toutes les tâches, mutations `createTask`, `toggleTask`, `deleteTask`
- **`src/main.tsx`** : branchement du `ConvexProvider` avec le client Convex
- **`src/App.tsx`** : `useQuery` pour lire la liste, `useMutation` pour créer, cocher et supprimer une tâche

### Étape 2 — Temps réel

Implémenté implicitement dans l'étape 1.

`useQuery` n'est pas un simple fetch : il ouvre une souscription WebSocket persistante. Convex trace automatiquement quelles tables chaque query lit, et pousse une mise à jour à tous les abonnés dès qu'une mutation modifie ces tables. Aucun code supplémentaire n'est nécessaire.

**Pour l'observer** : ouvrir deux onglets sur l'app et modifier une tâche dans l'un — l'autre se met à jour instantanément sans rechargement.

### Étape 3 — Schéma + validation

- **`convex/schema.ts`** : schéma explicite de la table `tasks` avec `defineSchema` et `defineTable`
- Les champs `text: v.string()` et `completed: v.boolean()` sont validés à l'écriture par Convex
- Les types générés dans `_generated/dataModel.d.ts` passent de `any` à `Doc<'tasks'>` précis
- Aucun changement nécessaire dans `tasks.ts` ni dans le front : le code était déjà conforme

### Étape 4 — Auth via Clerk

Alternative à Convex Auth (voir branche `master`) utilisant [Clerk](https://clerk.com) comme provider externe.

- **`convex/auth.config.ts`** : déclare Clerk comme domaine de confiance pour la validation des JWTs Convex
- **`src/main.tsx`** : `ClerkProvider` gère la session Clerk ; `ConvexProviderWithClerk` transmet automatiquement le JWT Clerk à chaque requête Convex
- **`src/App.tsx`** : composants Clerk (`SignedIn`, `SignedOut`, `SignInButton`, `SignOutButton`) — aucun formulaire à écrire, Clerk fournit son propre UI

Différence clé avec Convex Auth : Clerk gère entièrement l'authentification côté client. Côté Convex, `ctx.auth.getUserIdentity()` fonctionne de façon identique quel que soit le provider.

### Étape 5 — Autorisation

- **`convex/schema.ts`** : ajout de `userId: v.string()` sur la table `tasks`
- **`convex/tasks.ts`** :
  - `list` filtre les tâches par `userId` — chaque utilisateur ne voit que les siennes
  - `createTask` récupère l'identité via `ctx.auth.getUserIdentity()` et stocke `identity.subject` (l'identifiant Clerk)
  - `toggleTask` et `deleteTask` vérifient que `task.userId === identity.subject` avant d'agir
- **`src/App.tsx`** : `useUser()` de Clerk pour afficher l'email de l'utilisateur connecté

`ctx.auth.getUserIdentity()` est l'API Convex standard, identique quel que soit le provider (Clerk, Convex Auth, Better Auth…). `identity.subject` contient l'identifiant unique de l'utilisateur fourni par le provider.

### Étape 6 — HTTP Actions

- **`convex/convex.config.ts`** : enregistrement du composant `@convex-dev/rate-limiter`
- **`convex/rateLimiter.ts`** : règle `api` — fixed window, 10 appels/minute par clé
- **`convex/http.ts`** : routeur HTTP Convex avec 5 endpoints
- **`convex/tasks.ts`** : ajout de `listAll` (internalQuery) et `createTaskAsApi` / `deleteTaskAsApi` (internalMutation) sans vérification d'identité Clerk

Les HTTP Actions s'exposent sur le **site URL** Convex (`*.convex.site`), distinct du cloud URL (`*.convex.cloud`) utilisé par le SDK React.

#### Endpoints

| Méthode | Route    | Auth + Rate limit          | Description                                    |
| ------- | -------- | -------------------------- | ---------------------------------------------- |
| GET     | `/ping`  | —                          | Health check, retourne `{ ok: true }`          |
| POST    | `/echo`  | —                          | Renvoie le body JSON reçu                      |
| GET     | `/tasks` | API key + 10 appels/min    | Liste toutes les tâches (vue admin)            |
| POST    | `/tasks` | API key + 10 appels/min    | Crée une tâche avec `userId: "api"`            |
| DELETE  | `/task`  | API key + 10 appels/min    | Supprime une tâche par `?id=` (404 si absente) |

#### Concepts clés

- Une HTTP Action ne peut pas accéder à `ctx.db` directement — elle délègue via `ctx.runQuery` / `ctx.runMutation`
- `internalQuery` / `internalMutation` : fonctions privées, inaccessibles depuis le client React, appelables uniquement depuis le serveur Convex
- L'API key est stockée comme variable d'environnement Convex (`API_KEY`) et lue via `process.env.API_KEY`
- Les tâches créées via API ont `userId: "api"` — elles n'apparaissent pas dans l'UI React (filtrée par userId Clerk) mais sont visibles dans la vue admin
- Le rate limiting utilise une **fixed window** de 60s : compteur remis à zéro toutes les minutes, par clé API. Retourne 429 si la limite est dépassée.

#### Exemple curl

```bash
# Lister toutes les tâches
curl https://<deployment>.convex.site/tasks -H "x-api-key: <clé>"

# Créer une tâche
curl -X POST https://<deployment>.convex.site/tasks \
  -H "Content-Type: application/json" \
  -H "x-api-key: <clé>" \
  -d '{"text": "tâche via API"}'

# Supprimer une tâche
curl -X DELETE "https://<deployment>.convex.site/task?id=<id>" \
  -H "x-api-key: <clé>"
```

### Étape 7 — Actions externes

- **`convex/actions.ts`** :
  - `fetchPost` : appelle `jsonplaceholder.typicode.com/posts/:id` et retourne le JSON brut au front
  - `importTodo` : appelle `jsonplaceholder.typicode.com/todos/:id`, mappe le résultat, délègue l'écriture à une `internalMutation`
- **`convex/tasks.ts`** : ajout de `createImportedTask` (internalMutation) — reçoit `text`, `completed` et `userId`, insère en base
- **`src/App.tsx`** : `useAction` pour appeler les deux actions depuis React, compteur 1→100 pour `importTodo`

#### Concepts clés

- Les actions peuvent appeler des API externes via `fetch` (disponible nativement, sans `"use node"`)
- `ctx.auth.getUserIdentity()` fonctionne dans les actions — le JWT Clerk est transmis automatiquement par le SDK
- Les actions ne peuvent pas écrire en base directement — elles délèguent via `ctx.runMutation`
- La `internalMutation` est privée (inaccessible depuis le front) et transactionnelle

#### Cheminement d'un appel `importTodo` depuis React

```
[React] useAction → importTodo (action)
  → ctx.auth.getUserIdentity()     — vérifie le JWT
  → fetch(jsonplaceholder/todos/N) — appel réseau externe
  → ctx.runMutation(createImportedTask, { text, completed, userId })
      → ctx.db.insert('tasks', ...)  — écriture transactionnelle
          → useQuery(list) mis à jour en temps réel
```

### Étape 8 — Scheduling

- **`convex/schema.ts`** : ajout de la table `counters` (name, value) avec index `by_name`
- **`convex/tasks.ts`** : `capitalizeTask` (internalMutation) — planifiée 2s après la création d'une tâche via `ctx.scheduler.runAfter`
- **`convex/crons.ts`** : `incrementCounter` (internalMutation) + cron toutes les 2 minutes via `crons.interval` ; `getCronCounter` (query) pour lire le compteur
- **`src/App.tsx`** : affichage du compteur cron en temps réel via `useQuery`

#### Scheduled function — `runAfter`

Déclenchée depuis `createTask` après insertion en base :

```ts
const id = await ctx.db.insert('tasks', { ... })
await ctx.scheduler.runAfter(2_000, internal.tasks.capitalizeTask, { id })
```

- Le délai est en millisecondes
- La fonction reçoit ses arguments sérialisés — relire la donnée depuis la base au moment de l'exécution
- L'auth n'est pas propagée : `ctx.auth.getUserIdentity()` retourne `null` dans une scheduled function
- Toujours vérifier que la donnée existe encore avant d'agir

#### Cron job — `crons.interval`

Déclaré dans `convex/crons.ts`, exécuté automatiquement toutes les 2 minutes :

```ts
crons.interval("heartbeat", { minutes: 2 }, internal.crons.incrementCounter, {});
```

| | `runAfter` | Cron |
|---|---|---|
| Déclenchement | Depuis le code, une fois | Automatique, récurrent |
| Planification | Dynamique | Statique dans `crons.ts` |
| Usage | Effet différé après un événement | Tâche périodique |

### Étape 9 — File Storage

- **`convex/schema.ts`** : ajout de la table `files` (`storageId`, `filename`, `contentType`) + champ `fileId: v.optional(v.id("files"))` sur `tasks`
- **`convex/files.ts`** : `generateUploadUrl`, `saveFile`, `listFiles`, `deleteFile`
- **`convex/tasks.ts`** : mutation `attachFile` — associe un document `files` à une tâche (bloque si un fichier est déjà attaché)
- **`src/App.tsx`** : upload + sauvegarde métadonnées + attachement à une tâche + affichage image/lien + suppression

#### Flux d'upload

```
1. generateUploadUrl()              → URL pré-signée temporaire
2. fetch(url, { method: POST, body: file })  → upload direct vers Convex Storage
3. saveFile(storageId, filename, contentType)  → Id<"files">
4. attachFile(taskId, fileId)       → tâche liée au document files
```

#### Concepts clés

- Le fichier binaire est dans `_storage` — les métadonnées applicatives sont dans la table `files`
- `v.id("files")` sur la tâche crée une référence typée vers l'entité fichier, pas vers le blob brut
- `ctx.storage.getUrl(storageId)` retourne une URL pré-signée (~1h) ou `null` si le fichier n'existe plus — toujours vérifier avant d'afficher
- Convex ne cascade pas les suppressions : supprimer un fichier laisse les références dans les tâches orphelines

## Stack

- [Vite](https://vite.dev) + React 19 + TypeScript
- [Convex](https://convex.dev) — backend temps réel
- [Clerk](https://clerk.com) — authentification (voir [TUTORIAL.md](TUTORIAL.md) pour le périmètre et la justification de ce choix)
- Hébergement : Convex (backend) + Vercel (frontend) — détails dans [DEPLOYMENT.md](DEPLOYMENT.md)
