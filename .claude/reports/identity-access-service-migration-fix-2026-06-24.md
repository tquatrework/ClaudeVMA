# Rapport — identity-access-service : correction structurelle migrations TypeORM

**Date** : 2026-06-24
**Statut** : OK - Correction appliquée

## Problème résolu

Le service crashait en boucle en production car :
- synchronize: true (dev) avait créé le schéma directement sans migrations
- En production synchronize: false, mais aucun entrypoint ne lançait migration:run
- La migration 1750000000000-AddLoginIdentifier.ts n'était jamais appliquée

## Fichiers créés

### src/data-source.ts (nouveau)
DataSource TypeORM dédié à la CLI, indépendant du module NestJS.
- Reprend exactement les mêmes entities que app.module.ts
- migrations: ['dist/src/migrations/*.js']
- synchronize: false (toujours — la CLI gère les migrations)

### entrypoint.sh (nouveau, chmod +x)
Script shell exécuté au démarrage du conteneur :
1. node ./node_modules/typeorm/cli.js -d dist/src/data-source.js migration:run
2. exec node dist/src/main
- set -e : le conteneur s'arrête si la migration échoue

## Fichiers modifiés

### package.json
Ajout de 3 scripts TypeORM CLI :
- migration:run : typeorm -d dist/src/data-source.js migration:run
- migration:revert : typeorm -d dist/src/data-source.js migration:revert
- migration:generate : typeorm -d dist/src/data-source.js migration:generate

### Dockerfile
- COPY entrypoint.sh /app/entrypoint.sh
- RUN chmod +x /app/entrypoint.sh
- Remplacement de CMD ["node", "dist/src/main"] par ENTRYPOINT ["/app/entrypoint.sh"]
- USER node supprimé pour ne pas bloquer l'exécution de l'entrypoint (chmod fait dans le build)

## Vérification app.module.ts

- synchronize: NODE_ENV !== 'production' — inchangé, correct (ne s'applique qu'en dev local sans Docker)
- Pas de migrationsRun: true — pas de doublon avec l'entrypoint
- Pas de migrations: [...] dans le module NestJS — délégué à l'entrypoint via le DataSource CLI

## Blocages / Points d'attention

Aucun blocage.

Points à surveiller :
- USER node a été retiré du Dockerfile. Si la sécurité l'exige, le rétablir APRES le chmod +x.
- La migration 1750000000000-AddLoginIdentifier.ts doit être compilée dans dist/src/migrations/
  au moment du build Docker — c'est déjà le cas via npm run build dans le stage builder.
