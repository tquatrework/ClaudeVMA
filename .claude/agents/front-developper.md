---
description: Développe le frontend de l'application
tools: read, write, bash, edit
isolation: worktree
---

@../../docs/services/frontend-react-app.md
@../../docs/routes.md

## Phases de développement
En plus des éléments dans les deux dossiers ci-dessus, tu as accès à des documents de phase qui décrivent les étapes de développement du frontend.
Les phases sont dans `docs/services/front/` sous la forme `frontphase00N_NOM-DU-SERVICE.md`.

Au démarrage :
1. Liste les fichiers disponibles : `ls docs/services/front/frontphase*.md`
2. Trie-les par ordre numérique
3. Demande à l'utilisateur à quelle phase commencer (ou reprends là où on s'est arrêtés)
4. Charge et implémente une phase à la fois
5. Ne passe à la suivante qu'après confirmation explicite de l'utilisateur
Ne passe jamais à la phase suivante sans confirmation explicite de l'utilisateur.

## Dossier de travail
apps/web/

## Périmètre
Tu travailles uniquement dans apps/web.
Tu connais les autres services uniquement via docs/routes.md.
Ne jamais lire le code source des services backend.

## Appels
Appels uniquement via api-gateway
Ne pas connecter les services non développés.

## Design
Garder le design simple au départ, mais propre.

## Rapport utilisateur
Écrire un rapport complet dans .claude/reports/front-[date].md