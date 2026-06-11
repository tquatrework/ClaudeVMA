# Rapport — Activation des routes nginx (4 services) — 2026-06-11

## Résumé

Activation des 4 blocs commentés dans `gateway/api-gateway/nginx.conf` et mise à jour de `docs/routes.md` pour refléter les routes réelles vérifiées par audit.

---

## 1. Upstreams décommentés

Les 4 upstreams suivants ont été activés (lignes 30-33 de nginx.conf) :

```nginx
upstream video_session    { server video-session-service:3000; }
upstream communication    { server communication-service:3000; }
upstream pedagogical_log  { server pedagogical-log-service:3000; }
upstream dashboard        { server dashboard-notification-service:3000; }
```

---

## 2. Blocs nginx activés et corrigés

### video-session-service
1 bloc `location /api/v1/video/` — proxy_pass corrigé de `/` vers `/video/` pour restituer le préfixe controller.
Support WebSocket (Upgrade/Connection headers) + proxy_read_timeout 3600s conservés.

```nginx
location /api/v1/video/ {
  auth_request /internal/auth;
  proxy_pass http://video_session/video/;
  ...WebSocket headers...
}
```

### communication-service
3 blocs distincts (le bloc unique `messages` original ne couvrait pas les conversations ni les incidents) :

```nginx
location /api/v1/conversations/ { proxy_pass http://communication/conversations/; ...WS... }
location /api/v1/messages/      { proxy_pass http://communication/messages/; ...WS... }
location /api/v1/incidents/     { proxy_pass http://communication/incidents/; }
```

Le bloc `/api/v1/incidents/` n'a pas de headers WebSocket (routes HTTP REST uniquement).

### pedagogical-log-service
3 blocs distincts (le bloc unique `logs` original ne couvrait pas memos ni le carnet notebook) :

```nginx
location /api/v1/logs/     { proxy_pass http://pedagogical_log/logs/; }
location /api/v1/memos/    { proxy_pass http://pedagogical_log/memos/; }
location /api/v1/students/ { proxy_pass http://pedagogical_log/students/; }
```

### dashboard-notification-service
2 blocs (le bloc `dashboard` original utilisait le mauvais préfixe gateway `/api/v1/dashboard/` — corrigé en `/api/v1/dashboards/`) :

```nginx
location /api/v1/notifications/ { proxy_pass http://dashboard/notifications/; }
location /api/v1/dashboards/    { proxy_pass http://dashboard/dashboards/; }
```

---

## 3. Routes `/internal/*` — confirmation non-exposition

Aucune `location` ne proxifie un chemin commençant par `/internal`. Les routes internes suivantes restent inaccessibles depuis nginx :
- `GET /internal/video/*` (video-session-service)
- `POST /internal/sync-contacts` (communication-service)
- `POST /internal/initialize-dashboard`, `POST /internal/notify` (dashboard-notification-service)

---

## 4. Corrections apportées dans `docs/routes.md`

### Suppressions de mentions de port
- Supprimé `(port 3001)` dans le titre identity-access-service
- Supprimé `(port 3003)` dans le titre profile-service
- Tous les services tournent sur le port 3000 en interne (géré par les upstreams nginx)

### video-session-service
- `POST /video/rooms/:id/end` → remplacé par `POST /video/rooms/:id/close`
- Ajouté : `GET /video/rooms/:id/join` (génère un token d'accès)
- Ajouté : `POST /video/rooms/:id/attendance` (enregistrement de présence)
- Ajouté : mention des routes internes non exposées

### communication-service
- Remplacé le modèle simple (POST /messages) par le vrai modèle conversation-first :
  - Section Conversations : POST/GET /conversations, POST /conversations/:id/messages
  - Section Messages : GET /messages/conversation/:id, PATCH /messages/:id/read
  - Section Incidents (TI uniquement) : POST/GET/GET/:id/PUT /:id/status /incidents
- Ajouté : mention de la route interne `POST /internal/sync-contacts`

### pedagogical-log-service
- Ajouté section Mémos : POST, GET (liste), GET/:id, DELETE/:id /memos
- Ajouté section Carnet personnel : 5 routes CRUD /students/:studentId/notebook
- Complété les routes logs avec PATCH /logs/:id (manquant)

### dashboard-notification-service
- Renommé section de `notification-dashboard-service` en `dashboard-notification-service` (nom canonique)
- Remplacé `POST /notifications` (créer — usage interne) par `GET /notifications` (liste — usage client)
- Supprimé les routes admin-only qui passent par `/internal`
- Ajouté section Tableaux de bord : GET /dashboards/me, PUT /dashboards/me/preferences
- Ajouté : mention des routes internes non exposées

---

## 5. Services non modifiés (déjà actifs)

- identity-access-service : blocs `/api/v1/auth/`, `/api/v1/accounts/`, `/api/v1/consents/` — inchangés
- profile-service : blocs `/api/v1/profiles/`, `/api/v1/relations/` — inchangés
- teacher-request-service : bloc `/api/v1/requests/` — inchangé
- calendar-service : bloc `/api/v1/calendar/` — inchangé
- orchestration-service : blocs workflows/commands/events/callbacks — inchangés (callbacks déjà corrigé précédemment)
