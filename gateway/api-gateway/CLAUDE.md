## Service : api-gateway

Voir @docs/architecture.md pour le contexte global.

## Rôle
Point d'entrée unique de la plateforme. Route les requêtes vers les microservices,
valide les JWT via `auth_request` avant chaque route protégée, et gère le load balancing.

## Stack
- **Framework** : nginx 1.25-alpine (reverse-proxy pur, aucune logique métier)
- **Port exposé** : 80 (mapped en 80:80 dans docker-compose)
- **Auth** : `auth_request /internal/auth` → proxie vers `GET /auth/me` de identity-access-service
  - Retour 200 → requête autorisée, Authorization header transmis au service en aval
  - Retour 401 → nginx répond immédiatement 401 JSON

## Routes exposées

| Préfixe gateway          | Service cible               | Auth |
|--------------------------|-----------------------------|----|
| `/api/v1/auth/`          | identity-access-service     | Non (public) |
| `/api/v1/accounts/`      | identity-access-service     | Oui |
| `/api/v1/consents/`      | identity-access-service     | Oui |
| `/api/v1/profiles/`      | profile-service             | Oui |
| `/api/v1/relations/`     | profile-service             | Oui |
| `/api/v1/requests/`      | teacher-request-service     | Oui |
| `/api/v1/calendar/`      | calendar-service            | Oui |
| `/api/v1/video/`         | video-session-service       | Oui + WS |
| `/api/v1/messages/`      | communication-service       | Oui + WS |
| `/api/v1/logs/`          | pedagogical-log-service     | Oui |
| `/api/v1/notifications/` | dashboard-notification-service | Oui |
| `/api/v1/orchestration/workflows/`  | orchestration-service | Oui |
| `/api/v1/orchestration/commands/`   | orchestration-service | Oui |
| `/api/v1/orchestration/events/`     | orchestration-service | Oui |
| `/api/v1/orchestration/callbacks/`  | orchestration-service | Oui |
| `/health`                | gateway (nginx)             | Non |
| `/docs`                  | gateway (nginx) — index     | Non |

## Règles
- Aucune logique métier dans ce service
- Tout appel non authentifié est rejeté sauf `/api/v1/auth/*` et `/health`
- Toutes les requêtes sont loggées (access_log format `main`)
- Rate limiting : `10r/m` sur `/api/v1/auth/` (anti-brute-force), `30r/s` disponible ailleurs
- WebSocket activé sur `/api/v1/video/` et `/api/v1/messages/` (Upgrade/Connection headers)
