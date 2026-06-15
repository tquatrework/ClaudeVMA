# Rapport — dashboard-notification-service — 2026-06-12

## BUG-003a — Chemin de démarrage dist/main → dist/src/main

**Analyse :**
- `tsconfig.json` : `outDir = ./dist`, pas de `rootDir` explicite.
- `nest build` (via `@nestjs/cli`) utilise `src` comme racine implicite, produisant `dist/src/main.js`.
- Le chemin `dist/main` référencé dans Dockerfile et package.json était donc incorrect.

**Corrections appliquées :**
- `Dockerfile` ligne 18 : `CMD ["node", "dist/main"]` → `CMD ["node", "dist/src/main"]`
- `package.json` script `start:prod` : `node dist/main` → `node dist/src/main`

---

## BUG-007 — InternalGuard fail-open quand INTERNAL_SECRET est absent

**Analyse :**
- `src/common/guards/internal.guard.ts` lignes 18–21 : si `INTERNAL_SECRET` est absent, le guard loggue un warning et retourne `true`, rendant les endpoints internes accessibles sans authentification.

**Correction appliquée :**
- Remplacement du `return true` par `throw new UnauthorizedException('Internal access only')`.
- Le `logger.warn` remplacé par `logger.error` pour refléter la gravité du problème.
- Aucune condition sur `NODE_ENV` introduite — le comportement fail-closed est systématique.

---

## Fichiers modifiés

- `services/dashboard-notification-service/Dockerfile`
- `services/dashboard-notification-service/package.json`
- `services/dashboard-notification-service/src/common/guards/internal.guard.ts`

## Blocages

Aucun.
