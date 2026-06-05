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

## Décisions techniques

### Stack : nginx pur (pas de NestJS / FastAPI)
La gateway ne contient aucune logique métier. nginx est suffisant et performant.
Pas de code applicatif à maintenir — seul `nginx.conf` évolue.

### Validation JWT via `auth_request`
nginx délègue la validation à `GET /auth/me` de identity-access-service.
- 200 → token valide, requête transmise au service en aval avec `Authorization` header
- 401 → nginx répond immédiatement `{"statusCode":401,"message":"Unauthorized"}`
- Les services en aval valident aussi le JWT en propre (défense en profondeur).

### Routing orchestration-service
Le service expose 4 contrôleurs racine (`/workflows`, `/commands`, `/events`, `/callbacks`).
La gateway les expose sous `/api/v1/orchestration/<contrôleur>/`.

### WebSocket
Les locations `/api/v1/video/` et `/api/v1/messages/` transmettent les headers
`Upgrade` et `Connection` avec `proxy_read_timeout 3600s` pour les connexions longues.

### Rate limiting
- Zone `auth` : 10 req/min sur `/api/v1/auth/` — protection anti-brute-force
- Zone `api` : 30 req/s disponible, à activer par location si nécessaire

## Points en suspens
- Ajouter un endpoint `/auth/verify` léger dans identity-access-service (sans requête DB,
  juste validation de signature JWT) pour réduire la charge sur `/auth/me` en production.
- Envisager TLS termination (certbot ou Traefik devant nginx) pour la prod.
- Exposer les métriques nginx (stub_status ou prometheus-exporter) pour l'observabilité.
