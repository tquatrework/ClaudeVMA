# Rapport — orchestration-service — 2026-06-11

## Objectif

Protéger `POST /callbacks/:provider` par un `WebhookSecretGuard` NestJS (secret partagé dans `X-Webhook-Secret`), sans JWT, car les providers externes n'ont pas de token utilisateur.

---

## Guard créé

**Fichier** : `src/common/guards/webhook-secret.guard.ts`

- Lit `request.headers['x-webhook-secret']` et compare à `process.env.WEBHOOK_SECRET`.
- **Comportement fail-closed** : si `WEBHOOK_SECRET` n'est pas définie dans l'environnement, `canActivate` retourne `false` immédiatement — aucun accès n'est accordé.
- Pas de dépendance injectable (`JwtService`, `ConfigService`) — lecture directe de `process.env` pour éviter toute injection NestJS complexe dans un guard stateless.

---

## Controller modifié

**Fichier** : `src/callback/callback.controller.ts`

- `@UseGuards(WebhookSecretGuard)` ajouté sur la méthode `receive` (route `POST :provider`).
- `JwtAuthGuard` absent sur cette route — décision délibérée, pas de JWT pour les providers.
- Décorateurs Swagger ajoutés :
  - `@ApiHeader({ name: 'X-Webhook-Secret', description: 'Secret partagé provider/service', required: true })`
  - `@ApiResponse({ status: 403, description: 'Secret invalide ou absent' })`
  - `@ApiOperation.summary` mis à jour : « Recevoir un webhook de provider externe »

---

## Variable d'env ajoutée

**Fichier** : `.env.example`

```
WEBHOOK_SECRET=change-me-shared-secret
```

---

## Tests créés

**Fichier** : `test/unit/common/guards/webhook-secret.guard.spec.ts`

| ID | Cas | Résultat attendu |
|---|---|---|
| ORCH-WS-001 | Header présent et correct | `true` |
| ORCH-WS-002 | Header absent | `false` |
| ORCH-WS-003 | Header incorrect | `false` |
| ORCH-WS-004 | `WEBHOOK_SECRET` non définie (fail-closed) | `false` |

### Résultats `npm test`

```
Test Suites: 10 passed, 10 total
Tests:       58 passed, 58 total
```

Aucun test existant n'a été cassé. Les 4 nouveaux tests passent.

---

## Documentation mise à jour

**Fichier** : `docs/services/orchestration-service.md`

- Nouvelle section « Sécurité webhook — session 2026-06-11 » ajoutée.
- Tableau APIs mis à jour avec la colonne `Auth` distinguant JWT vs `X-Webhook-Secret`.

---

## Points à noter pour le déploiement

- `WEBHOOK_SECRET` doit être définie dans les secrets Kubernetes / docker-compose (valeur différente de `change-me`).
- Le gateway nginx doit retirer `auth_request` pour la route `/callbacks/*` côté ingress (protection déléguée au service).
