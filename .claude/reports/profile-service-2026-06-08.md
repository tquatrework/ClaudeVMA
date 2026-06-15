# profile-service — rapport e2e fallback local DB — 2026-06-08

## Problème
Testcontainers ne peut pas démarrer un conteneur PostgreSQL dans cet environnement
(socket Docker inaccessible : `permission denied while trying to connect to the docker API`).

## Solution implémentée

### Fichiers modifiés

**`services/profile-service/test/e2e/helpers/app.helper.ts`**
- Import ajouté : `getDataSourceToken` (NestJS/TypeORM) et `DataSource` (TypeORM)
- `createTestApp()` enrichi d'un mécanisme de fallback conditionnel :
  1. Si `USE_LOCAL_DB=true` → utilise directement le PostgreSQL local via `buildLocalDatabaseUrl()`
  2. Sinon → tente Testcontainers ; si erreur (Docker inaccessible), bascule automatiquement sur le PG local
- Après démarrage de l'app, appel de `dataSource.synchronize(true)` pour remettre le schéma à zéro avant chaque suite (isolation des données)
- Nouvelle fonction `loadDotEnvTest()` qui charge `.env.test` avant toute initialisation
- Nouvelle fonction `buildLocalDatabaseUrl()` qui compose la DATABASE_URL depuis les variables `TEST_DB_*`
- Tous les blocs ajoutés sont marqués `// TODO: remove when Testcontainers has Docker permissions`

**`services/profile-service/.env.test`** (fichier créé)
```
USE_LOCAL_DB=true
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_NAME=profile_test
TEST_DB_USER=visiomath
TEST_DB_PASSWORD=visiomath_secret
```

**`services/profile-service/package.json`**
- Script `test:e2e` mis à jour : `jest --config ./test/jest-e2e.json --runInBand`
- `--runInBand` force l'exécution séquentielle des suites ; indispensable car `synchronize(true)`
  est une opération destructive qui ne peut pas tourner en parallèle sur la même base.

## Résultat des tests

```
Test Suites: 4 passed, 4 total
Tests:       75 passed, 75 total
Snapshots:   0 total
Time:        4.657 s
```

Toutes les 75 assertions passent sans erreur.

## Instructions pour lancer les tests localement

Pré-requis : PostgreSQL tourne sur `localhost:5432` avec l'utilisateur `visiomath` / `visiomath_secret`.
La base `profile_test` doit exister (créée une seule fois) :
```bash
PGPASSWORD=visiomath_secret psql -h localhost -p 5432 -U visiomath -d postgres \
  -c "CREATE DATABASE profile_test;"
```

Lancer les tests :
```bash
cd services/profile-service
USE_LOCAL_DB=true npm run test:e2e
```

Ou, sans variable d'environnement explicite (`.env.test` contient déjà `USE_LOCAL_DB=true`) :
```bash
cd services/profile-service
npm run test:e2e
```

## Points en suspens / TODO

- Supprimer le fallback (`loadDotEnvTest`, `buildLocalDatabaseUrl`, bloc `catch` Testcontainers,
  `synchronize(true)`, `--runInBand`) une fois que Docker est accessible dans l'environnement CI.
- Vérifier que `.env.test` est bien listé dans `.gitignore` au niveau projet
  (il ne contient pas de secrets critiques, mais c'est une bonne pratique).
