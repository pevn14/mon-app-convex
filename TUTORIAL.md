# Tutoriel — Découvrir Convex à travers un projet concret

## 1. Introduction

Ce document retrace, étape par étape, la construction d'une petite application de tâches qui sert de support à la découverte de **Convex**. Le fil conducteur est le [README.md](README.md) du projet, qui décrit la feuille de route en neuf étapes.

L'objectif n'est pas d'écrire une documentation de référence sur Convex, mais d'**expliquer le code réellement écrit** pour comprendre *quand* et *pourquoi* utiliser chaque primitive de la plateforme.

### Pour qui ?

Un développeur familier de React, TypeScript et du dev web full-stack, mais qui découvre Convex. Vous y trouverez :

- comment Convex remplace, dans un projet moderne, la base de données, l'API serveur, le pub/sub temps réel et le stockage de fichiers ;
- comment Clerk s'y branche pour fournir l'authentification ;
- les pièges concrets rencontrés en construisant ce projet.

### Périmètre : l'authentification n'est pas le sujet

Ce point est central et conditionne plusieurs choix du projet.

Le but de ce tutoriel est de découvrir **Convex**. Clerk a été retenu **par pragmatisme** : c'est l'option la plus rapide pour disposer d'une auth simple et fonctionnelle, sans détourner l'attention du sujet principal.

**Convex Auth** et **Better Auth** sont hors périmètre ici. Ils feront l'objet d'un projet d'apprentissage séparé, dédié à l'authentification. Ce document ne propose donc pas de comparatif entre solutions d'auth.

---

## 2. Vue d'ensemble du projet

Le projet est construit en neuf étapes. Chacune introduit une nouvelle brique Convex et se consomme indépendamment :

| Étape | Brique                    | Ce qu'on apprend                                  |
| ----- | ------------------------- | ------------------------------------------------- |
| 1     | Query + Mutation          | Lire et écrire dans une table                     |
| 2     | Temps réel                | Comprendre que la réactivité est gratuite         |
| 3     | Schéma + validation       | Structurer et valider les données                 |
| 4     | Auth (Clerk)              | Brancher un provider externe                      |
| 5     | Autorisation              | Filtrer par utilisateur                           |
| 6     | HTTP Actions              | Exposer un endpoint REST                          |
| 7     | Actions externes          | Appeler une API tierce                            |
| 8     | Scheduling                | `runAfter` et cron jobs                           |
| 9     | File storage              | Uploader et servir des fichiers                   |

La stack reste volontairement minimaliste : **Vite + React 19 + TypeScript** côté front, **Convex** côté back, **Clerk** pour l'auth, et le composant **`@convex-dev/rate-limiter`** pour limiter les appels API. Le frontend est un simple support — l'intérêt du projet est ce qui se passe côté backend.

---

## 3. Architecture en une page

```
┌──────────────┐    JWT signé     ┌──────────┐
│  Navigateur  │ ───────────────► │  Clerk   │
│ React + SDK  │ ◄─── session ─── │          │
└──────┬───────┘                  └──────────┘
       │
       │ WebSocket (queries, mutations, actions)
       │ HTTP (httpActions)
       ▼
┌─────────────────────────────────────────────┐
│                  Convex                     │
│  fonctions  │  base de données  │  storage  │
│  scheduler  │  cron             │  HTTP     │
└─────────────────────────────────────────────┘
```

Trois principes structurent tout le reste :

1. Le SDK Convex côté client n'envoie pas des HTTP requests classiques. Il maintient une **connexion WebSocket** et expose les queries comme des **souscriptions** — c'est ce qui rend le temps réel gratuit.
2. Les fonctions Convex tournent dans un **isolat V8**, pas dans Node.js. `fetch` est disponible, mais pas `node:fs` ou `node:crypto`.
3. L'authentification n'est pas intégrée à Convex : un **provider externe** signe des JWTs que Convex vérifie. Dans ce projet, ce provider est Clerk.

### Le dossier `convex/`

Tout le backend vit ici :

```
convex/
├── _generated/      # types et bindings auto-générés
├── auth.config.ts   # configuration du provider auth
├── convex.config.ts # composants Convex installés
├── schema.ts        # tables et leurs champs
├── tasks.ts         # fonctions liées aux tâches
├── files.ts         # fonctions liées aux fichiers
├── actions.ts       # actions externes (fetch)
├── http.ts          # routes HTTP exposées
├── rateLimiter.ts   # configuration du rate limiter
└── crons.ts         # crons + leurs handlers
```

Chaque fichier exporte des fonctions qui deviennent des endpoints accessibles via l'objet généré `api`.

---

## 4. Mise en route

### Installation

```bash
pnpm install
npx convex dev   # à laisser tourner en parallèle de pnpm dev
pnpm dev
```

`npx convex dev` crée le deployment de dev, écrit `CONVEX_DEPLOYMENT` et `VITE_CONVEX_URL` dans `.env.local`, puis synchronise les fonctions à chaque sauvegarde.

### Le point d'entrée React

Dans [src/main.tsx](src/main.tsx), Clerk et Convex sont imbriqués :

```tsx
<ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
  <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
    <App />
  </ConvexProviderWithClerk>
</ClerkProvider>
```

`ConvexProviderWithClerk` attache automatiquement le JWT Clerk à chaque appel Convex. La configuration détaillée (Clerk dashboard, JWT template, variables d'env) est dans [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 5. Le tutoriel, étape par étape

Chaque étape suit le même gabarit : *le besoin*, *le concept Convex*, *le code clé dans le projet*, *ce qu'il faut retenir*. Les étapes se lisent dans l'ordre, mais chacune reste indépendante des suivantes.

---

### Étape 1 — La première query, la première mutation

**Le besoin.** Lire et écrire des tâches.

**Le concept.** Convex distingue deux types de fonctions sur la base de données :

- une **query** lit la base. Elle est mise en cache et **réactive** (sa valeur côté client se rafraîchit toute seule).
- une **mutation** écrit en base. Elle est transactionnelle et **ne peut pas faire de `fetch`**.

**Le code.** Dans [convex/tasks.ts](convex/tasks.ts), la query initiale était simplement :

```ts
export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query('tasks').collect(),
})
```

Côté React :

```tsx
const tasks = useQuery(api.tasks.list)
```

`api` est un objet **généré automatiquement** par Convex à partir des exports du dossier `convex/`. Pas de routeur à écrire, pas d'endpoint à déclarer.

> **À retenir.** Une fonction exportée dans `convex/` devient un endpoint typé, consommable directement par le front. C'est la promesse centrale de Convex.

---

### Étape 2 — Le temps réel sans rien faire

**Le besoin.** Une tâche créée dans un onglet doit apparaître instantanément dans les autres.

**Le concept.** À ce stade, **aucun code supplémentaire** n'est nécessaire. `useQuery` ouvre une souscription WebSocket : Convex trace quelles lignes la query a lues et notifie les clients dès qu'une mutation modifie ces lignes.

C'est l'écart fondamental avec une stack REST + WebSocket : ni canal pub/sub à créer, ni invalidation manuelle à coder.

> **Limite.** Cette réactivité ne couvre que les opérations sur la base. Si vos données viennent d'un `fetch` externe (étape 7), elles ne sont pas réactives — ce sont les écritures en base qui le sont.

---

### Étape 3 — Un schéma pour structurer

**Le besoin.** Garantir que toute tâche a bien un `text: string` et un `completed: boolean`.

**Le concept.** Convex peut fonctionner sans schéma (les tables sont alors typées `any`). En déclarer un apporte trois bénéfices : validation à l'écriture, types précis générés (`Doc<'tasks'>`) et documentation vivante du modèle.

**Le code.** Dans [convex/schema.ts](convex/schema.ts) :

```ts
export default defineSchema({
  tasks: defineTable({
    text: v.string(),
    completed: v.boolean(),
    userId: v.string(),
    fileId: v.optional(v.id('files')),
  }),
  // ... counters, files (ajoutés aux étapes 8 et 9)
})
```

Les validateurs `v.*` servent aussi à valider les **arguments** des fonctions :

```ts
export const createTask = mutation({
  args: { text: v.string() },   // rejeté avant exécution si mal typé
  handler: async (ctx, args) => { /* ... */ },
})
```

> **À retenir.** Schéma et validateurs sont la même primitive (`v.*`), utilisée à deux endroits : champs de tables et arguments de fonctions.

---

### Étape 4 — Brancher Clerk

**Le besoin.** Permettre à un utilisateur de se connecter et identifier ses requêtes.

> **Rappel.** L'auth n'est pas le sujet du projet. Clerk a été choisi par pragmatisme : composants UI, gestion de session et JWT signé prêts à l'emploi. Convex Auth et Better Auth seront explorés ailleurs.

**Le concept.** Convex ne gère pas l'auth. Il valide un JWT signé par un provider de confiance. La chaîne est la suivante :

```
Navigateur ──► Clerk émet un JWT
            ──► ConvexProviderWithClerk attache le JWT à chaque requête Convex
            ──► Convex valide la signature (via `domain` dans auth.config.ts)
            ──► ctx.auth.getUserIdentity() retourne l'identité
```

**Trois fichiers** à connaître :

[src/main.tsx](src/main.tsx) — branchement Clerk + Convex (voir section 4).

[convex/auth.config.ts](convex/auth.config.ts) — déclaration du provider de confiance :

```ts
export default {
  providers: [
    {
      domain: "https://relaxing-gelding-48.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
}
```

Côté **Clerk dashboard**, créer un JWT Template nommé `convex` (preset disponible). Sans ce template, tous les JWTs sont rejetés par Convex.

**Récupérer l'identité dans une fonction Convex :**

```ts
const identity = await ctx.auth.getUserIdentity()
if (identity === null) throw new Error('Non authentifié')
// identity.subject = l'id utilisateur unique
```

> **À retenir.** Le couple `domain` (côté Convex) ↔ JWT Template (côté Clerk) est ce qui établit la confiance. Une fois en place, le reste du code applicatif ignore qui est le provider.

---

### Étape 5 — Autoriser, pas seulement authentifier

**Le besoin.** Chaque utilisateur ne doit voir et modifier que ses propres tâches.

**Le concept.** Authentification = *qui ?*. Autorisation = *quoi ?*. Convex valide la signature du JWT (auth), mais c'est à **votre code** de comparer `identity.subject` avec `task.userId` (autorisation).

**Le pattern.** Toutes les fonctions sensibles dans [convex/tasks.ts](convex/tasks.ts) suivent la même structure :

```ts
export const deleteTask = mutation({
  args: { id: v.id('tasks') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) throw new Error('Non authentifié')
    const task = await ctx.db.get(args.id)
    if (task?.userId !== identity.subject) throw new Error('Non autorisé')
    await ctx.db.delete(args.id)
  },
})
```

**Pour la query `list`**, retourner un tableau vide plutôt que lever — React affiche alors une liste vide quand personne n'est connecté, ce qui est plus naturel qu'un état d'erreur.

> **Piège classique.** Oublier ce contrôle dans une nouvelle fonction. Convex ne le fait pas pour vous : c'est une responsabilité 100 % applicative.

---

### Étape 6 — Exposer un endpoint REST

**Le besoin.** Permettre à un script externe (curl, webhook) d'interagir avec l'app.

**Le concept.** Les queries et mutations ne sont accessibles qu'au SDK Convex. Pour parler en HTTP classique, on utilise les **HTTP actions**, servies sur `*.convex.site` (à ne pas confondre avec `*.convex.cloud` du SDK).

Trois particularités à garder en tête :

- pas d'accès à `ctx.db` — il faut déléguer à `ctx.runQuery` ou `ctx.runMutation` ;
- les fonctions appelées sont typiquement des **`internalQuery` / `internalMutation`**, privées, inaccessibles depuis le front ;
- le code applicatif est responsable de **toute** la sécurité : auth, rate limit, validation.

**Le code.** [convex/http.ts](convex/http.ts) déclare les routes :

```ts
const http = httpRouter()

http.route({
  path: "/tasks",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const unauthorized = requireApiKey(req)
    if (unauthorized) return unauthorized
    const limited = await checkRateLimit(ctx, req)
    if (limited) return limited
    const tasks = await ctx.runQuery(internal.tasks.listAll)
    return new Response(JSON.stringify(tasks), { status: 200 })
  }),
})
```

**Protection.** Deux mécanismes empilés :

- Vérification d'une clé API stockée dans `process.env.API_KEY` (définie dans le dashboard Convex).
- Rate limiting via le composant officiel `@convex-dev/rate-limiter` (10 appels/minute, par clé API).

Le rate limiter est un **composant Convex**, déclaré dans [convex/convex.config.ts](convex/convex.config.ts) :

```ts
const app = defineApp()
app.use(rateLimiter)
export default app
```

et configuré dans [convex/rateLimiter.ts](convex/rateLimiter.ts) :

```ts
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  api: { kind: "fixed window", rate: 10, period: 60_000 },
})
```

> **À retenir.** Une HTTP action est un *front* HTTP. Elle ne contient pas la logique métier ; elle l'appelle via les fonctions internes. Cette séparation rend la logique réutilisable depuis d'autres contextes (un webhook, un cron…).

#### Approfondissement — Pourquoi `*.convex.site` est différent de `*.convex.cloud`

Le SDK Convex (utilisé par React) parle à `*.convex.cloud` en WebSocket. Les HTTP actions sont servies sur `*.convex.site` parce qu'elles répondent au protocole HTTP standard et peuvent être appelées par n'importe qui. Garder les deux séparés évite de mélanger trafic SDK et trafic HTTP public dans la même URL et permet de configurer du caching, des règles CDN, etc., différemment.

---

### Étape 7 — Appeler une API tierce

**Le besoin.** Importer une tâche depuis `jsonplaceholder.typicode.com`.

**Le concept.** Une `mutation` est transactionnelle et ne peut pas faire de `fetch`. Pour appeler une API externe, on utilise une **`action`**.

Une action :

- peut faire `fetch` ;
- peut appeler `ctx.runQuery` / `ctx.runMutation` ;
- n'a **pas** accès à `ctx.db` (comme les HTTP actions) ;
- contrairement aux scheduled functions (étape 8), reçoit l'identité Clerk.

**Le code.** Dans [convex/actions.ts](convex/actions.ts) :

```ts
export const importTodo = action({
  args: { id: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) throw new Error('Non authentifié')
    const response = await fetch(`https://jsonplaceholder.typicode.com/todos/${args.id}`)
    const todo = await response.json()
    await ctx.runMutation(internal.tasks.createImportedTask, {
      text: todo.title,
      completed: todo.completed,
      userId: identity.subject,
    })
  },
})
```

Côté React, on utilise `useAction` au lieu de `useMutation`.

**Le cheminement complet :**

```
useAction → action importTodo
           ├─ getUserIdentity()       (auth)
           ├─ fetch externe
           └─ runMutation interne     (écriture transactionnelle)
                                       → useQuery se met à jour en temps réel
```

> **À retenir.** L'action orchestre des étapes potentiellement non-déterministes. La mutation reste pure et transactionnelle. Cette séparation est ce qui permet à Convex de garantir la cohérence forte des écritures sans subir l'incertitude du réseau.

---

### Étape 8 — Planifier l'exécution

**Le besoin.**

- Capitaliser le texte d'une tâche **2 secondes après** sa création (effet différé).
- Incrémenter un compteur **toutes les 2 minutes** (récurrent).

**Le concept.** Convex propose deux mécanismes complémentaires :

- **`ctx.scheduler.runAfter(ms, fn, args)`** — planification ponctuelle, déclenchée depuis le code.
- **`cronJobs()` dans `convex/crons.ts`** — planification récurrente, déclarée statiquement.

#### Le différé : `runAfter`

Dans [convex/tasks.ts](convex/tasks.ts), `createTask` planifie une capitalisation après l'insertion :

```ts
const id = await ctx.db.insert('tasks', { /* ... */ })
await ctx.scheduler.runAfter(2_000, internal.tasks.capitalizeTask, { id })
```

et le handler :

```ts
export const capitalizeTask = internalMutation({
  args: { id: v.id('tasks') },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id)
    if (task === null) return                         // l'utilisateur a pu supprimer
    const capitalized = task.text.charAt(0).toUpperCase() + task.text.slice(1)
    if (capitalized === task.text) return             // idempotent
    await ctx.db.patch(args.id, { text: capitalized })
  },
})
```

#### Le récurrent : cron

Dans [convex/crons.ts](convex/crons.ts) :

```ts
const crons = cronJobs()
crons.interval("heartbeat toutes les 2 minutes", { minutes: 2 }, internal.crons.incrementCounter, {})
export default crons
```

Côté React, `useQuery(api.crons.getCronCounter)` affiche le compteur en temps réel — le même mécanisme que pour les tâches : la mutation du cron déclenche une notification aux abonnés.

> **Trois pièges à connaître**
>
> - **Pas d'auth.** `ctx.auth.getUserIdentity()` retourne `null` dans une fonction planifiée. Si vous avez besoin de `userId`, passez-le en argument explicite.
> - **Arguments sérialisés.** Ce que vous passez à `runAfter` est sérialisé et désérialisé plus tard. Ne supposez pas que l'état de la base n'a pas changé entre temps — relisez la donnée dans le handler.
> - **Idempotence.** Une fonction planifiée peut être rejouée. Concevez le handler pour que rejouer soit sans effet (ici : on vérifie `capitalized === task.text` avant de patcher).

---

### Étape 9 — Le stockage de fichiers

**Le besoin.** Uploader un fichier et l'attacher à une tâche.

**Le concept.** Convex sépare deux choses : le **blob binaire** vit dans `_storage` (manipulé via `ctx.storage`), et les **métadonnées applicatives** (nom, type MIME, propriétaire...) vivent dans une table classique.

Le projet utilise une table `files` qui porte les métadonnées et référence le blob via un `storageId`. La tâche, elle, référence la **ligne `files`** — pas directement le blob.

```
tasks.fileId  ──►  files._id  ──►  files.storageId  ──►  _storage (binaire)
```

#### Le flux d'upload (4 étapes)

```
1. generateUploadUrl()                  → URL pré-signée temporaire (mutation)
2. fetch(url, { method: POST, body })   → upload direct, en bypass des fonctions
3. saveFile({ storageId, filename, … }) → Id<"files"> retourné (mutation)
4. attachFile({ taskId, fileId })       → tâche liée au document files
```

Pourquoi cette danse en plusieurs étapes ? **Le blob ne passe pas par les fonctions Convex.** Le navigateur l'envoie directement au stockage via une URL signée, ce qui évite de saturer les fonctions avec du binaire volumineux.

**Le code clé** ([convex/files.ts](convex/files.ts)) :

```ts
export const listFiles = query({
  args: {},
  handler: async (ctx) => {
    const files = await ctx.db.query("files").take(20)
    return await Promise.all(
      files.map(async (file) => ({
        ...file,
        url: await ctx.storage.getUrl(file.storageId),  // pré-signée ~1h
      }))
    )
  },
})
```

`ctx.storage.getUrl` retourne `null` si le fichier n'existe plus — toujours vérifier avant d'afficher.

> **Cascade delete.** Convex **ne supprime pas** les références automatiquement. Si vous supprimez un fichier référencé par une tâche, le `fileId` reste sur la tâche et pointe dans le vide. Trois choix : supprimer la référence manuellement, refuser la suppression, ou accepter l'orphelin (choix du projet, qui est un projet d'apprentissage).

---

## 6. Approfondissement : l'intégration Clerk

> **Rappel.** Clerk a été retenu pour mettre l'auth en place rapidement et garder l'attention sur Convex. Convex Auth et Better Auth seront traités dans un projet séparé.

### Comment l'identité circule

```
Clerk émet le JWT
   ↓
ClerkProvider le garde côté React
   ↓
useAuth (Clerk)  +  ConvexProviderWithClerk (Convex)
   ↓
chaque appel Convex part avec le header Authorization: Bearer …
   ↓
Convex valide la signature (clé publique récupérée depuis `domain`)
   ↓
ctx.auth.getUserIdentity() retourne identity.subject, identity.email, …
```

### Configuration : où ça se passe

| Côté | Fichier | Rôle |
|---|---|---|
| Clerk dashboard | JWT Templates | Crée un template nommé `convex` (preset disponible) |
| Front | `.env.local` | `VITE_CLERK_PUBLISHABLE_KEY` |
| Front | `src/main.tsx` | Imbrique `<ClerkProvider>` et `<ConvexProviderWithClerk>` |
| Back | `convex/auth.config.ts` | Déclare l'Issuer URL Clerk comme provider de confiance |

### Trois cas où `getUserIdentity()` retourne `null`

1. **HTTP actions** appelées sans JWT (cas typique : un script avec une clé API). Le projet utilise donc `process.env.API_KEY` pour ces routes.
2. **Scheduled functions** (`runAfter`) : l'identité n'est pas sérialisée. Passez `userId` en argument.
3. **Cron jobs** : aucun utilisateur n'y est associé.

### Implication pratique

L'identité n'est qu'**un signal**, pas une autorisation. Le code applicatif reste responsable de comparer `identity.subject` avec le `userId` stocké sur la ressource accédée. Voir étape 5.

---

## 7. Synthèse des primitives Convex

| Type | Appelable depuis le client | `ctx.db` | `fetch` | Identité | Exemple |
|---|---|---|---|---|---|
| `query` | oui (`useQuery`) | lecture | non | oui | `tasks.list` |
| `mutation` | oui (`useMutation`) | lecture/écriture | non | oui | `tasks.createTask` |
| `action` | oui (`useAction`) | non (via `run*`) | oui | oui | `actions.importTodo` |
| `internalQuery` | **non** | lecture | non | oui | `tasks.listAll` |
| `internalMutation` | **non** | lecture/écriture | non | oui | `tasks.createTaskAsApi` |
| `httpAction` | (sur `*.convex.site`) | non (via `run*`) | oui | si JWT en header | routes dans `http.ts` |
| Scheduled (`runAfter`) | non | selon type planifié | selon type | **non** | `tasks.capitalizeTask` |
| Cron | non | selon type planifié | selon type | **non** | `crons.incrementCounter` |

**Règle d'or :** prendre le type le plus restrictif qui suffit. Pas besoin d'écrire ? c'est une `query`. Pas appelée depuis le front ? c'est une `internal*`.

---

## 8. Pièges courants (vu dans le projet)

- **Oublier le contrôle d'autorisation** dans une nouvelle fonction. Convex ne le fait pas pour vous.
- **Confondre `*.convex.cloud` et `*.convex.site`**. Le premier pour le SDK, le second pour les HTTP actions.
- **Compter sur `getUserIdentity()` dans une scheduled function ou un cron**. Toujours `null`.
- **Oublier l'idempotence** d'une scheduled function : elle peut être rejouée.
- **Oublier de vérifier l'existence** d'une donnée dans un handler différé : elle a pu être supprimée entre temps.
- **Supposer que Convex cascade les suppressions**. Non. Vos références doivent être nettoyées à la main.
- **Penser que `pnpm run build` type-checke `convex/`**. Ce n'est pas le cas — `convex/tsconfig.json` n'est pas référencé par le tsconfig racine. C'est pourquoi le build Vercel utilise `npx convex deploy --cmd 'vite build'` (voir [DEPLOYMENT.md](DEPLOYMENT.md)).

---

## 9. Conclusion

Le projet montre qu'il est possible de construire une application full-stack qui couvre :

- une base de données réactive,
- des endpoints HTTP exposés,
- des appels d'API tierces,
- du scheduling et du cron,
- du stockage de fichiers,

… **sans gérer soi-même de serveur, ni de base, ni de pub/sub**. Le travail conceptuel consiste essentiellement à choisir, pour chaque besoin, la bonne primitive Convex.

### Trois choses à retenir

1. **Le dossier `convex/` est votre backend.** Un fichier par domaine, des fonctions typées exportées. Pas de routeur à écrire.
2. **Le temps réel est gratuit.** Tout `useQuery` est une souscription. Pensez vos UIs en termes de *donnée actuelle*, pas en termes de *rafraîchir après une action*.
3. **L'autorisation reste applicative.** Convex valide les schémas et les JWTs. C'est à vous de comparer `identity.subject` à `userId` sur chaque ressource.

### Périmètre — ce qui n'a pas été traité

- **L'authentification en profondeur.** Clerk a été choisi par pragmatisme pour ne pas alourdir le projet. Un projet d'apprentissage séparé est prévu pour explorer **Convex Auth** et **Better Auth**, chacun avec son propre modèle d'intégration.
- **La synchronisation d'utilisateurs.** En l'état, il n'y a pas de table `users` côté Convex — les webhooks Clerk pourraient y être branchés pour maintenir un miroir local.
- **La pagination.** Les queries `list` et `listFiles` collectent toutes les lignes ; un projet réel utiliserait `.paginate()`.
- **Les index applicatifs.** La query `list` filtre par `userId` sans index — un `by_userId` accélérerait considérablement.

Pour la configuration et le déploiement, voir [DEPLOYMENT.md](DEPLOYMENT.md).
