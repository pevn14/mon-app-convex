# mon-app-convex

Projet de prise en main de [Convex](https://convex.dev), construit sur une base React + Vite + TypeScript.

Le front React est un support minimal. L'objectif est d'explorer les briques Convex étape par étape.

## Feuille de route

| Étape | Brique Convex             | Objectif concret                                        | Statut |
| ----- | ------------------------- | ------------------------------------------------------- | ------ |
| 1     | Query + Mutation          | Lire et écrire des tâches                               | ✅     |
| 2     | Temps réel                | Voir la liste se mettre à jour automatiquement          | ✅     |
| 3     | Schéma + validation       | Structurer proprement les données                       | ✅     |
| 4     | Auth (Clerk)              | Introduire l'identité utilisateur via Clerk             | ✅     |
| 5     | Autorisation              | Filtrer les données selon l'utilisateur                 | ✅     |
| 6     | HTTP Actions / API        | Exposer un endpoint REST ou webhook                     |        |
| 7     | Action externe            | Appeler une API tierce depuis Convex                    |        |
| 8     | File storage + scheduling | Upload de fichier puis tâche planifiée                  |        |

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

## Stack

- [Vite](https://vite.dev) + React 19 + TypeScript
- [Convex](https://convex.dev) — backend temps réel
