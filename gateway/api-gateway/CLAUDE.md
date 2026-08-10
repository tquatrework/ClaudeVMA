## Service : api-gateway

Voir @docs/architecture.md pour le contexte global.
Et @docs/services/api-gateway.md pour le contexte service

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
| `/api/v1/parent-link-requests/` | profile-service      | Oui |
| `/api/v1/teacher-requests/` | teacher-request-service   | Oui | → `/` (contrôleurs: /requests, /proposals, /assignments) |
| `/api/v1/calendar/`      | calendar-service            | Oui | → `/` (service root) |
| `/api/v1/video/`         | video-session-service       | Oui + WS | → `/` (service root) |
| `/api/v1/messages/`      | communication-service       | Oui + WS | → `/` (service root) |
| `/api/v1/logs/`          | pedagogical-log-service     | Oui | → `/` (service root) |
| `/api/v1/notifications/` | dashboard-notification-service | Oui | → `/notifications/` |
| `/api/v1/dashboard/`     | dashboard-notification-service | Oui | → `/dashboards/` |
| `/api/v1/orchestration/workflows/`  | orchestration-service | Oui |
| `/api/v1/orchestration/commands/`   | orchestration-service | Oui |
| `/api/v1/orchestration/events/`     | orchestration-service | Oui |
| `/api/v1/orchestration/callbacks/`  | orchestration-service | Oui |
| `/health`                | gateway (nginx)             | Non |
| `/docs`                  | gateway (nginx) — index     | Non |

## Tests
`bash gateway/api-gateway/test/nginx-conf.test.sh` — `nginx -t` dans l'image réelle + garanties de
routage et de taille de corps. Partie « gateway vivante » activée par `GATEWAY_URL` et `ACCESS_TOKEN`.

## Règles
- Aucune logique métier dans ce service
- **Proxifier par préfixe, jamais route par route** : une nouvelle route d'un service doit être
  jointe sans toucher à ce fichier. Corollaire : aucune `location` par expression régulière, aucun
  `rewrite` — la gateway ne réinterprète jamais un segment d'URL.
- **`client_max_body_size` doit rester déclaré** et au-dessus du plafond applicatif d'envoi. Sans
  directive, nginx applique 1 Mio et la gateway devient un plafond caché qui répond en HTML.
  Voir `docs/services/api-gateway.md`.
- Tout appel non authentifié est rejeté sauf `/api/v1/auth/*` et `/health`
- Toutes les requêtes sont loggées (access_log format `main`)
- Rate limiting : `10r/m` sur `/api/v1/auth/` (anti-brute-force), `30r/s` disponible ailleurs
- WebSocket activé sur `/api/v1/video/` et `/api/v1/messages/` (Upgrade/Connection headers)
