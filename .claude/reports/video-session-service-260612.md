# BUG-003b — video-session-service — Correction chemin de démarrage

**Date :** 2026-06-12
**Statut :** ✅ Corrigé

---

## Analyse

### Fichiers inspectés

- `services/video-session-service/tsconfig.json` — `outDir: ./dist`, pas de `rootDir` explicite
- `services/video-session-service/nest-cli.json` — `sourceRoot: src`, `deleteOutDir: true`
- `services/video-session-service/Dockerfile` — ligne `CMD ["node", "dist/main"]` (avant correction)
- `services/video-session-service/package.json` — `start:prod: "node dist/main"` (avant correction)

### Diagnostic

La configuration est identique à celle de `communication-service`, `identity-access-service` et `profile-service` :
- `tsconfig.json` : `outDir: ./dist` sans `rootDir` explicite
- `nest-cli.json` : `sourceRoot: src` avec `deleteOutDir: true`

Avec `sourceRoot: src` dans nest-cli.json, le NestJS CLI produit les fichiers compilés dans `dist/src/` (et non directement dans `dist/`). Ceci est confirmé par les autres services du projet :

```
communication-service/dist/src/main.js   ✅
identity-access-service/dist/src/main.js ✅
video-session-service/dist/main.js       ❌ (stale build — ne reflète pas la config actuelle)
```

Le dist actuel de `video-session-service` est issu d'une build ancienne ou manuelle, antérieure à l'alignement sur nest-cli.json. Avec `deleteOutDir: true`, le prochain `nest build` effacera le dist et produira `dist/src/main.js`.

### Conclusion

Le chemin `dist/main` dans Dockerfile et package.json est incorrect par rapport à la config réelle du projet. La correction `dist/src/main` est nécessaire et alignée sur tous les autres services.

---

## Modifications apportées

### `services/video-session-service/Dockerfile`

```diff
- CMD ["node", "dist/main"]
+ CMD ["node", "dist/src/main"]
```

### `services/video-session-service/package.json`

```diff
- "start:prod": "node dist/main",
+ "start:prod": "node dist/src/main",
```

---

## Blocages

Aucun.

---

## Points d'attention

- Le répertoire `dist/` actuel contient un build stale avec `main.js` directement à la racine. Ce build sera écrasé dès le prochain `nest build` grâce à `deleteOutDir: true`. Aucune action manuelle requise.
- La correction est purement mécanique et n'affecte aucune logique métier.
