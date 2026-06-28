# api-gateway

## Rôle
Reverse-proxy nginx qui constitue le point d'entrée unique de la plateforme VisioMath.
Il route les requêtes HTTP/WebSocket vers les 9 services de Phase 1, valide les JWT
en délégant à identity-access-service, et applique le rate-limiting.

## Arborescence

```
gateway/api-gateway/
├── nginx.conf     — configuration complète nginx (routing, auth_request, rate-limiting)
├── Dockerfile     — image nginx:1.25-alpine, COPY nginx.conf, EXPOSE 80
└── CLAUDE.md      — documentation du service et table des routes
```

## Services routés (Phase 1 — état au 2026-06-28)

| Service | Locations nginx (gateway) | proxy_pass (upstream) | Upstream | Auth JWT | Notes |
|---|---|---|---|---|---|
| identity-access-service | `/api/v1/auth/` | `/auth/` | `identity_access` | Non (public) | Rate-limit 10r/m |
| identity-access-service | `= /api/v1/accounts` | `/accounts` | `identity_access` | Non (POST only) | Inscription |
| identity-access-service | `= /api/v1/accounts/check-email` | `/accounts/check-email` | `identity_access` | Non (public) | Vérif. dispo email — Rate-limit zone auth |
| identity-access-service | `^~ /api/v1/accounts/` | `/accounts/` | `identity_access` | Oui | Gestion compte |
| identity-access-service | `/api/v1/consents/` | `/consents/` | `identity_access` | Oui | Consentements RGPD |
| profile-service | `/api/v1/profiles/` | `/profiles/` | `profile` | Oui | |
| profile-service | `/api/v1/relations/` | `/relations/` | `profile` | Oui | |
| profile-service | `^~ /api/v1/parent-link-requests` | `/parent-link-requests` | `profile` | Oui | Gap gateway corrigé 2026-06-28 |
| teacher-request-service | `/api/v1/requests/` | `/` | `teacher_request` | Oui | |
| calendar-service | `/api/v1/calendar/` | `/` | `calendar` | Oui | |
| video-session-service | `/api/v1/video/` | `/video/` | `video_session` | Oui | WebSocket |
| communication-service | `/api/v1/conversations/` | `/conversations/` | `communication` | Oui | WebSocket |
| communication-service | `/api/v1/messages/` | `/messages/` | `communication` | Oui | WebSocket |
| communication-service | `/api/v1/incidents/` | `/incidents/` | `communication` | Oui | |
| pedagogical-log-service | `/api/v1/logs/` | `/logs/` | `pedagogical_log` | Oui | Cahier de texte |
| pedagogical-log-service | `/api/v1/memos/` | `/memos/` | `pedagogical_log` | Oui | Mémos formateur |
| pedagogical-log-service | `/api/v1/students/` | `/students/` | `pedagogical_log` | Oui | Carnet élève |
| dashboard-notification-service | `/api/v1/notifications/` | `/notifications/` | `dashboard` | Oui | |
| dashboard-notification-service | `/api/v1/dashboards/` | `/dashboards/` | `dashboard` | Oui | |
| orchestration-service | `/api/v1/orchestration/workflows/` | `/workflows/` | `orchestration` | Oui | |
| orchestration-service | `/api/v1/orchestration/commands/` | `/commands/` | `orchestration` | Oui | |
| orchestration-service | `/api/v1/orchestration/events/` | `/events/` | `orchestration` | Oui | |
| orchestration-service | `/api/v1/orchestration/callbacks/` | `/callbacks/` | `orchestration` | **Non** | Protection X-Webhook-Secret |
| legal-document-service | `^~ /api/v1/legal-templates` | `/legal-templates` | `legal_document` | Oui | Gap gateway corrigé 2026-06-28 |
| gateway (nginx) | `/health` | — | — | Non | Healthcheck gateway |
| gateway (nginx) | `/docs` | — | — | Non | Index JSON des Swagger |

## Règles d'authentification

`auth_request /internal/auth` est actif sur toutes les routes **sauf** :

| Route | Raison |
|---|---|
| `/api/v1/auth/` | Public — login, logout, refresh |
| `= /api/v1/accounts` (POST) | Public — inscription |
| `= /api/v1/accounts/check-email` | Public — vérification disponibilité email (inscription, rate-limit zone auth) |
| `/api/v1/orchestration/callbacks/` | Webhooks providers externes — pas de JWT émetteur ; protection assurée côté service par `WebhookSecretGuard` (header `X-Webhook-Secret`) |
| `/health` | Healthcheck infrastructure |
| `/docs` | Index des documentations |
| `**/docs` (locations Swagger) | Documentation Swagger de chaque service |

Le mécanisme `auth_request` proxie vers `GET /auth/me` de identity-access-service :
- 200 → token valide, requête transmise au service en aval avec `Authorization` header
- 401 → nginx répond immédiatement `{"statusCode":401,"message":"Unauthorized"}`
- Les services en aval valident aussi le JWT en propre (défense en profondeur).

## Décisions techniques

### Stack : nginx pur (pas de NestJS / FastAPI)
La gateway ne contient aucune logique métier. nginx est suffisant et performant.
Pas de code applicatif à maintenir — seul `nginx.conf` évolue.

### Validation JWT via `auth_request`
nginx délègue la validation à `GET /auth/me` de identity-access-service.

### Routing orchestration-service
Le service expose 4 contrôleurs racine (`/workflows`, `/commands`, `/events`, `/callbacks`).
La gateway les expose sous `/api/v1/orchestration/<contrôleur>/`.

### WebSocket
Les locations `/api/v1/video/`, `/api/v1/conversations/` et `/api/v1/messages/` transmettent
les headers `Upgrade` et `Connection` avec `proxy_read_timeout 3600s` pour les connexions longues.

### Rate limiting
- Zone `auth` : 10 req/min sur `/api/v1/auth/` — protection anti-brute-force
- Zone `api` : 30 req/s disponible, à activer par location si nécessaire

### Session 2026-06-11 — Callbacks webhooks : retrait de `auth_request`
Les providers externes (Stripe, etc.) ne peuvent pas fournir un JWT utilisateur lors de leurs
appels entrants. `auth_request /internal/auth` a donc été retiré de
`location /api/v1/orchestration/callbacks/`. La protection est désormais assurée côté
orchestration-service par `WebhookSecretGuard` qui vérifie le header `X-Webhook-Secret`
(secret partagé). La décision est documentée dans `docs/routes.md`.

### Session 2026-06-11 — Pattern `proxy_pass` avec préfixe controller
nginx substitue la location par le chemin `proxy_pass` : pour qu'un service NestJS reçoive
la bonne URL, le `proxy_pass` doit inclure le préfixe du contrôleur.
Exemple : `location /api/v1/video/` → `proxy_pass http://video_session/video/`
(et non `proxy_pass http://video_session/`).

### Session 2026-06-11 — Services multi-controllers
communication-service et pedagogical-log-service exposent plusieurs contrôleurs distincts ;
chacun est routé via une `location` nginx séparée pointant vers le même upstream.

### Session 2026-06-11 — Activation des routes Phase 1b
Quatre services précédemment commentés ont été activés dans nginx.conf :
- `video-session-service` : location `/api/v1/video/`
- `communication-service` : locations `/api/v1/conversations/`, `/api/v1/messages/`, `/api/v1/incidents/`
- `pedagogical-log-service` : locations `/api/v1/logs/`, `/api/v1/memos/`, `/api/v1/students/`
- `dashboard-notification-service` : locations `/api/v1/notifications/`, `/api/v1/dashboards/`

Correction incluse : `/api/v1/dashboard/` renommé en `/api/v1/dashboards/` (pluriel, conforme au contrôleur NestJS).

### Session 2026-06-28 — Trois nouvelles locations ajoutées
1. `= /api/v1/accounts/check-email` : route publique (zone auth, rate-limit) placée avant la location protégée `^~ /api/v1/accounts/` pour permettre la vérification de disponibilité d'email pendant l'inscription sans JWT.
2. `^~ /api/v1/parent-link-requests` → profile-service (JWT) : gap corrigé — le frontend appelait cette route mais aucune location nginx ne la couvrait.
3. `^~ /api/v1/legal-templates` → legal-document-service (JWT) : même situation de gap gateway confirmée et corrigée.

## Points en suspens
- `WEBHOOK_SECRET` à définir dans docker-compose/Kubernetes secrets (ne pas committer en clair).
- Tests de charge / rate limiting à affiner pour les nouvelles routes activées (video, communication, logs, dashboards).
- Health checks des services individuels non exposés via gateway — à prévoir (`/api/v1/<service>/health` ou route interne).
- Ajouter un endpoint `/auth/verify` léger dans identity-access-service (sans requête DB,
  juste validation de signature JWT) pour réduire la charge sur `/auth/me` en production.
- Envisager TLS termination (certbot ou Traefik devant nginx) pour la prod.
- Exposer les métriques nginx (stub_status ou prometheus-exporter) pour l'observabilité.
