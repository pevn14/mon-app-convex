# Configuration et déploiement — Convex + Clerk + Vercel

Ce document décrit pas à pas comment mettre en place et déployer ce projet, de l'environnement de développement local jusqu'à la production.

Stack :
- **Frontend** : React + Vite + TypeScript, hébergé sur Vercel
- **Backend** : Convex (base de données temps réel + fonctions serverless)
- **Auth** : Clerk

---

## Prérequis

- Node.js 18+ et pnpm (`npm install -g pnpm`)
- Comptes gratuits sur :
  - [Convex](https://convex.dev)
  - [Clerk](https://clerk.com)
  - [Vercel](https://vercel.com)
  - [GitHub](https://github.com)

---

## Vue d'ensemble des environnements

Convex distingue deux **deployments** par projet :

| | Dev | Production |
|---|---|---|
| URL exemple | `grandiose-wombat-774.convex.cloud` | `artful-goat-266.convex.cloud` |
| Base de données | Isolée | Isolée |
| Variables d'env | Configurées dans l'onglet **Development** du dashboard | Configurées dans l'onglet **Production** |
| Mise à jour | `npx convex dev` (hot reload) | `npx convex deploy` (snapshot) |

Côté Clerk, on utilise une **instance dev** unique — elle fonctionne aussi bien en local qu'en production sur un domaine `.vercel.app`. Une instance Clerk **prod** nécessiterait un vrai domaine personnalisé.

---

## 1. Installation locale (dev)

### 1.1. Cloner et installer

```bash
git clone <url-du-repo>
cd mon-app-convex
pnpm install
```

### 1.2. Créer le projet Convex

```bash
npx convex dev
```

Au premier lancement :
1. Connexion via navigateur à ton compte Convex
2. Choisir « Create a new project »
3. Convex génère un deployment de dev et écrit automatiquement dans `.env.local` :
   ```
   CONVEX_DEPLOYMENT=dev:grandiose-wombat-774
   VITE_CONVEX_URL=https://grandiose-wombat-774.convex.cloud
   ```

Laisser cette commande tourner dans un terminal — elle synchronise les fonctions Convex à chaque sauvegarde.

### 1.3. Créer l'application Clerk

Sur [dashboard.clerk.com](https://dashboard.clerk.com) :
1. **Create application** → choisir un nom
2. Sélectionner les méthodes d'authentification souhaitées (email, Google, etc.)
3. Une fois créée, ouvrir **API Keys** et copier la **Publishable key** (`pk_test_...`)

### 1.4. Connecter Clerk à Convex

Dans le dashboard Clerk :
1. **JWT Templates** > **New template** > choisir le preset **Convex**
2. Copier l'**Issuer URL** affichée (format : `https://xxx-yyy-00.clerk.accounts.dev`)
3. Sauvegarder le template (ne pas modifier les claims)

Dans le projet, le fichier `convex/auth.config.ts` doit contenir :

```ts
export default {
  providers: [
    {
      domain: "https://xxx-yyy-00.clerk.accounts.dev", // ton Issuer URL
      applicationID: "convex",
    },
  ],
};
```

Au prochain rechargement de `npx convex dev`, Convex prend en compte ce nouveau provider auth.

### 1.5. Compléter `.env.local`

Ajouter manuellement la clé Clerk :

```bash
# Déjà rempli par `npx convex dev`
CONVEX_DEPLOYMENT=dev:grandiose-wombat-774
VITE_CONVEX_URL=https://grandiose-wombat-774.convex.cloud

# À ajouter
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxx
```

### 1.6. Variables d'environnement côté Convex (dev)

Si l'application a besoin de secrets côté serveur Convex (ex: `API_KEY` pour les HTTP Actions) :

1. Aller sur [dashboard.convex.dev](https://dashboard.convex.dev) > ton projet
2. Onglet **Development**
3. **Settings** > **Environment Variables**
4. Ajouter les variables nécessaires

Ces variables sont lues dans le code Convex via `process.env.NOM_DE_LA_VARIABLE`.

### 1.7. Lancer l'application

Dans deux terminaux distincts :

```bash
# Terminal 1 — synchronisation Convex
npx convex dev

# Terminal 2 — serveur de dev Vite
pnpm dev
```

Ouvrir http://localhost:5173.

---

## 2. Déploiement en production

### 2.1. Comprendre la chaîne de déploiement

Le pipeline complet :

```
git push
  ↓
Vercel détecte le push GitHub
  ↓
Vercel installe les dépendances (pnpm install)
  ↓
Vercel lance la build command :
  npx convex deploy --cmd 'vite build'
    ├─ npx convex deploy  → pousse les fonctions vers Convex prod
    │                        et exporte VITE_CONVEX_URL automatiquement
    └─ vite build         → bundle frontend avec l'URL prod injectée
  ↓
Vercel publie le bundle sur <projet>.vercel.app
```

Avantage : un seul `git push` met à jour le front **et** le back.

### 2.2. Pousser le projet sur GitHub

Si ce n'est pas déjà fait :

```bash
git init
git add .
git commit -m "Initial commit"

# Créer un repo vide sur github.com (sans README ni .gitignore)
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin master
```

Vérifier que `.env.local` n'est **pas** poussé (il doit être dans `.gitignore`).

### 2.3. Créer le deployment Convex prod

Depuis le terminal, à la racine du projet :

```bash
npx convex deploy
```

La commande :
- Crée un deployment de prod distinct du dev (ex: `artful-goat-266`)
- Pousse toutes les fonctions vers ce deployment
- Affiche l'URL prod : `https://artful-goat-266.convex.cloud`

### 2.4. Configurer les variables d'env Convex prod

Dans [dashboard.convex.dev](https://dashboard.convex.dev) > ton projet :

1. **Important** : basculer sur l'onglet **Production** (sélecteur en haut à droite)
2. **Settings** > **Environment Variables**
3. Ajouter les mêmes secrets que ceux configurés en dev (ex: `API_KEY`)

> Les variables dev ne sont **pas** copiées automatiquement en prod.

### 2.5. Générer la Convex Deploy Key

Toujours dans le dashboard Convex, **sur l'onglet Production** :

1. **Settings** > **Deploy Keys**
2. Cliquer **Generate Production Deploy Key**
3. Copier la clé (elle commence par `prod:...`)

> Erreur classique : générer la clé depuis l'onglet Development. Vercel pousserait alors les fonctions sur le deployment dev, et le front pointerait sur l'URL dev. **Toujours vérifier qu'on est bien sur l'onglet Production.**

### 2.6. Importer le projet dans Vercel

1. Sur [vercel.com](https://vercel.com) > **Add New...** > **Project**
2. Importer le repo GitHub (autoriser l'accès Vercel→GitHub si demandé)
3. Vercel détecte automatiquement Vite — laisser le framework preset par défaut

### 2.7. Configurer la Build Command

Avant de cliquer Deploy, ouvrir **Build and Output Settings** puis activer l'override de **Build Command** avec :

```
npx convex deploy --cmd 'vite build'
```

Cette commande remplace le `pnpm run build` par défaut.

### 2.8. Configurer les variables d'environnement Vercel

Dans la section **Environment Variables** de la page d'import :

| Variable | Valeur | Scope |
|---|---|---|
| `CONVEX_DEPLOY_KEY` | la clé prod générée à l'étape 2.5 | Production |
| `VITE_CLERK_PUBLISHABLE_KEY` | la même clé qu'en dev | Production |

> **Ne pas ajouter `VITE_CONVEX_URL`** — `npx convex deploy --cmd` l'injecte automatiquement dans l'environnement de build en fonction de la `CONVEX_DEPLOY_KEY`.

### 2.9. Premier déploiement

Cliquer **Deploy**. Vercel exécute :
1. `pnpm install`
2. La build command configurée
3. Publication du bundle généré dans `dist/`

À la fin, Vercel donne une URL : `https://<projet>.vercel.app`.

### 2.10. Vérification post-déploiement

- L'app se charge sans erreur dans la console (DevTools)
- Le **Sign In** Clerk fonctionne et redirige correctement
- Créer / modifier / supprimer une donnée fonctionne et se synchronise en temps réel
- Ouvrir **DevTools > Network > filtre `WS`** : la connexion WebSocket doit pointer sur l'URL **prod** Convex (ex: `wss://artful-goat-266.convex.cloud`)
- Côté Convex Dashboard > Production > Logs : pas d'erreurs

---

## 3. Workflow quotidien

### Modifier le code

1. Coder en local avec `npx convex dev` + `pnpm dev`
2. Commit + push sur GitHub
3. Vercel redéploie automatiquement (front + back en une seule étape)

### Modifier une variable d'environnement Convex en prod

1. Dashboard Convex > onglet **Production** > Settings > Environment Variables
2. Pas besoin de redéployer — la fonction lit la nouvelle valeur à la prochaine exécution

### Modifier une variable d'environnement Vercel

1. Vercel > Settings > Environment Variables
2. **Redéployer sans cache** pour que la nouvelle valeur soit injectée dans le bundle

---

## 4. Troubleshooting

### Le frontend pointe sur l'instance dev de Convex en production

Symptôme : dans DevTools > Network > WS, l'URL WebSocket contient le nom du deployment dev.

Causes possibles :
- `CONVEX_DEPLOY_KEY` a été générée depuis l'onglet **Development** du dashboard Convex — régénérer depuis l'onglet **Production**
- Une variable `VITE_CONVEX_URL` est définie en dur dans Vercel et pointe sur dev — la supprimer (la build command l'injecte automatiquement)

### Erreur de build « Cannot find name 'process' » dans `convex/http.ts`

Le `tsc -b` du script `pnpm run build` ne sait pas que les fichiers `convex/` doivent être typés avec `@types/node`.

Solution : utiliser `npx convex deploy --cmd 'vite build'` comme build command Vercel. Cette commande exécute le check TypeScript via `convex/tsconfig.json`, qui a déjà `"types": ["node"]`.

### Clerk refuse le domaine `vercel.app`

Message d'erreur : *« \*.vercel.app domains are not supported for production instances »*.

Cause : tentative de créer une instance Clerk **production**.

Solutions :
- Pour un projet d'apprentissage : garder l'instance Clerk **dev** (elle accepte tous les domaines, y compris `.vercel.app`)
- Pour un vrai projet : acheter un domaine et le configurer dans Vercel et Clerk

### `npx convex deploy` ouvre une fenêtre de connexion en local mais pas sur Vercel

Comportement normal. En local, Convex utilise ta session navigateur. En CI, il utilise `CONVEX_DEPLOY_KEY` — c'est pour ça qu'il faut absolument la configurer dans Vercel.

---

## 5. Glossaire

| Terme | Signification |
|---|---|
| **Deployment Convex** | Une instance isolée Convex (dev ou prod) avec sa propre base de données et ses propres fonctions |
| **Deploy Key** | Token d'authentification permettant à un CI/CD de pousser du code vers un deployment Convex sans navigateur |
| **Issuer URL** | URL d'une instance Clerk, utilisée par Convex pour valider les JWTs reçus du frontend |
| **Publishable Key** | Clé publique Clerk utilisée côté navigateur pour initialiser le SDK |
| **`VITE_*` env var** | Variable d'environnement Vite : remplacée au moment du build dans le bundle JS. Elle finit en clair dans le code livré au navigateur, donc jamais de secret ici |

---

## 6. Récapitulatif des variables d'environnement

### En local (`.env.local`)

| Variable | Source | Rôle |
|---|---|---|
| `CONVEX_DEPLOYMENT` | Auto-générée par `npx convex dev` | Identifie le deployment dev |
| `VITE_CONVEX_URL` | Auto-générée par `npx convex dev` | URL utilisée par le client Convex React |
| `VITE_CLERK_PUBLISHABLE_KEY` | Dashboard Clerk > API Keys | Clé publique Clerk |

### Dans Vercel (Production)

| Variable | Source | Rôle |
|---|---|---|
| `CONVEX_DEPLOY_KEY` | Dashboard Convex > Production > Deploy Keys | Authentifie `npx convex deploy` pendant le build |
| `VITE_CLERK_PUBLISHABLE_KEY` | Dashboard Clerk > API Keys | Même valeur qu'en dev |

### Dans le Dashboard Convex (Production)

Les secrets utilisés par les fonctions Convex (ex: `API_KEY`, clés d'API tierces).
