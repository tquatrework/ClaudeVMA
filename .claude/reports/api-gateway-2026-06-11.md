# Rapport — api-gateway — 2026-06-11

## Changement effectué

### Fichier : `gateway/api-gateway/nginx.conf`

**Bloc modifié :** `location /api/v1/orchestration/callbacks/`

**Avant (lignes 309-316) :**
```nginx
location /api/v1/orchestration/callbacks/ {
  auth_request /internal/auth;
  proxy_pass http://orchestration/callbacks/;
  proxy_set_header Host            $host;
  proxy_set_header X-Real-IP       $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header Authorization   $http_authorization;
}
```

**Après :**
```nginx
# Webhooks externes : pas d'auth JWT utilisateur.
# Protection assurée côté service par X-Webhook-Secret (WEBHOOK_SECRET).
location /api/v1/orchestration/callbacks/ {
  proxy_pass http://orchestration/callbacks/;
  proxy_set_header Host            $host;
  proxy_set_header X-Real-IP       $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Modifications : suppression de `auth_request /internal/auth;` et du header `Authorization $http_authorization;` (inutile sans auth JWT), ajout du commentaire explicatif.

### Fichier : `docs/routes.md`

**Section :** orchestration-service > Callbacks externes (webhooks) > Note

**Avant :**
> Note : la route `/callbacks/:provider` est exposée via nginx avec `auth_request`, mais est conçue pour recevoir des webhooks de fournisseurs externes.

**Après :**
> Note : la route `/callbacks/:provider` n'est **pas** protégée par `auth_request` nginx — les providers externes ne peuvent pas fournir un JWT utilisateur. La protection repose sur le header `X-Webhook-Secret` validé côté service.

## Règle documentée

Les webhooks de providers externes (fournisseur visio, paiement, etc.) ne peuvent pas fournir un JWT utilisateur valide. L'authentification `auth_request /internal/auth` proxie vers `GET /auth/me` de l'identity-access-service et renvoie 401 si aucun Bearer token n'est présent, ce qui bloque systématiquement tous les webhooks entrants.

La protection de cette route repose sur un `WebhookSecretGuard` NestJS côté orchestration-service, qui valide le header `X-Webhook-Secret` contre la variable d'environnement `WEBHOOK_SECRET`.

## Vérification des routes non affectées

- Routes `/internal/*` : non exposées via nginx (seul `/internal/auth` existe avec le flag `internal;` — inaccessible depuis l'extérieur). Aucune modification.
- Routes orchestration protégées :
  - `/api/v1/orchestration/workflows/` — `auth_request /internal/auth;` conservé ✓
  - `/api/v1/orchestration/commands/` — `auth_request /internal/auth;` conservé ✓
  - `/api/v1/orchestration/events/` — `auth_request /internal/auth;` conservé ✓
- Toutes les autres routes du gateway (identity-access, profile, teacher-request, calendar) — non touchées ✓
- Routes commentées (video, communication, pedagogical-log, dashboard) — non réactivées ✓

## Statut

✅ Correction appliquée. La route `/api/v1/orchestration/callbacks/` ne bloque plus les webhooks externes avec 401. Les autres routes conservent leur protection JWT intacte.
