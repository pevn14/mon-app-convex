# mon-app-convex

Projet de prise en main de [Convex](https://convex.dev), construit sur une base React + Vite + TypeScript.

Le front React est un support minimal. L'objectif est d'explorer les briques Convex étape par étape.

## Feuille de route

| Étape | Brique Convex             | Objectif concret                                        |
| ----- | ------------------------- | ------------------------------------------------------- |
| 1     | Query + Mutation          | Lire et écrire des tâches                               |
| 2     | Temps réel                | Voir la liste se mettre à jour automatiquement          |
| 3     | Schéma + validation       | Structurer proprement les données                       |
| 4     | Auth                      | Introduire l'identité utilisateur                       |
| 5     | Autorisation              | Filtrer les données selon l'utilisateur                 |
| 6     | HTTP Actions / API        | Exposer un endpoint REST ou webhook                     |
| 7     | Action externe            | Appeler une API tierce depuis Convex                    |
| 8     | File storage + scheduling | Upload de fichier puis tâche planifiée                  |

## Stack

- [Vite](https://vite.dev) + React 19 + TypeScript
- [Convex](https://convex.dev) — backend temps réel
