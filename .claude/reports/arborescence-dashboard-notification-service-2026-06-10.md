# Arborescence — dashboard-notification-service (2026-06-10)

**Branche :** feat/phase1-canonical-services
**Stack :** NestJS 10 / TypeORM 0.3 / PostgreSQL / Swagger

---

## Arborescence complète avec descriptions

```
services/dashboard-notification-service/
├── .env.example                          # Template de variables d'environnement (non commité)
├── CLAUDE.md                             # Règles de périmètre de l'agent pour ce service
├── Dockerfile                            # Build multi-stage (builder → production), node:20-alpine
├── nest-cli.json                         # Config NestJS CLI — sourceRoot: src
├── package.json                          # Dépendances : NestJS, TypeORM, pg, JWT, Swagger, class-validator
├── package-lock.json                     # Lock file (non tracké, présent localement)
├── tsconfig.json                         # TypeScript — target ES2021, strictNullChecks off
│
└── src/
    ├── main.ts                           # Bootstrap : ValidationPipe (whitelist+transform), CORS, Swagger sur /api/docs
    ├── app.module.ts                     # Module racine : TypeORM async config, enregistre les 4 modules
    │
    ├── common/
    │   ├── decorators/
    │   │   └── current-user.decorator.ts # @CurrentUser() — extrait AuthUser de request.user
    │   └── guards/
    │       ├── jwt-auth.guard.ts         # Valide Bearer JWT ; vérifie payload.type === 'access' ; peuple request.user
    │       └── internal.guard.ts         # Valide header X-Internal-Secret contre env INTERNAL_SECRET ; avertit si non configuré
    │
    ├── health/
    │   ├── health.controller.ts          # GET /health — non authentifié, retourne status/service/timestamp
    │   └── health.module.ts              # Module fin, aucun provider
    │
    ├── notification/
    │   ├── entities/
    │   │   └── notification.entity.ts    # Table "notifications" : id, userId, type (enum), title, message, isRead, metadata (jsonb), createdAt
    │   ├── dto/
    │   │   ├── create-notification.dto.ts  # userId, type?, title, message, metadata?
    │   │   └── list-notifications.dto.ts   # isRead?, page (défaut 1), limit (défaut 20, max 100)
    │   ├── notification.controller.ts    # GET /notifications, POST /:id/read, DELETE /:id — protégé JWT
    │   ├── notification.service.ts       # create, findByUser (paginé), findRecentByUser, markAsRead, markAllAsRead, remove
    │   └── notification.module.ts        # Enregistre JwtModule async, exporte NotificationService
    │
    ├── dashboard/
    │   ├── entities/
    │   │   ├── dashboard-preference.entity.ts      # Table "dashboard_preferences" : userId (unique), role, widgetConfig (jsonb)
    │   │   ├── dashboard-widget-state.entity.ts    # Table "dashboard_widget_states" : userId, widgetType, data (jsonb), lastRefreshedAt — NON UTILISÉ
    │   │   └── notification-subscription.entity.ts # Table "notification_subscriptions" : userId, eventType, channel (enum: in_app|email) — NON UTILISÉ
    │   ├── dto/
    │   │   └── update-preferences.dto.ts           # widgetConfig: Record<string, unknown>
    │   ├── dashboard.controller.ts                 # GET /dashboards/me, PUT /dashboards/me/preferences — protégé JWT
    │   ├── dashboard.service.ts                    # getMyDashboard, updatePreferences, initializeDashboard ; DEFAULT_WIDGET_CONFIGS par rôle
    │   └── dashboard.module.ts                     # Enregistre 3 entités + JwtModule async + NotificationModule ; exporte DashboardService
    │
    ├── internal/
    │   ├── dto/
    │   │   ├── initialize-dashboard.dto.ts  # userId (UUID), role (string)
    │   │   └── internal-notify.dto.ts       # targetUserId? | targetRole?, type (enum), title, message, metadata?
    │   ├── internal.controller.ts           # POST /internal/initialize-dashboard, POST /internal/notify — InternalGuard
    │   └── internal.module.ts               # Importe DashboardModule + NotificationModule
    │
    └── test/
        ├── jest-e2e.json                    # Config Jest e2e — rootDir: .
        └── app.e2e-spec.ts                  # Tests d'intégration sur PostgreSQL réel (TEST_DATABASE_URL)
```

---

## Routes HTTP exposées

### Routes publiques

| Méthode | Chemin  | Description                                              | Auth   |
|---------|---------|----------------------------------------------------------|--------|
| GET     | /health | Health check — retourne { status, service, timestamp }  | Aucune |
| GET     | /api/docs | Interface Swagger UI                                   | Aucune |

### Routes utilisateur (JWT Bearer requis)

| Méthode | Chemin                              | Description                                                                              | Auth       |
|---------|-------------------------------------|------------------------------------------------------------------------------------------|------------|
| GET     | /dashboards/me                      | Retourne le dashboard contextualisé par rôle : descripteurs de widgets + 10 dernières notifications | Bearer JWT |
| PUT     | /dashboards/me/preferences          | Sauvegarde/met à jour le widgetConfig de l'utilisateur (upsert sur dashboard_preferences) | Bearer JWT |
| GET     | /notifications                      | Liste paginée des notifications de l'utilisateur (`isRead`, `page`, `limit`)             | Bearer JWT |
| POST    | /notifications/:notificationId/read | Marque une notification comme lue (404 si elle n'appartient pas à l'utilisateur)         | Bearer JWT |
| DELETE  | /notifications/:id                  | Supprime une notification (404 si non propriétaire)                                      | Bearer JWT |

### Routes inter-services (header X-Internal-Secret requis)

| Méthode | Chemin                           | Description                                                                                   | Auth              |
|---------|----------------------------------|-----------------------------------------------------------------------------------------------|-------------------|
| POST    | /internal/initialize-dashboard   | Initialise le tableau de bord lors de l'onboarding (idempotent — retourne l'existant si déjà créé) | X-Internal-Secret |
| POST    | /internal/notify                 | Pousse une notification vers un `targetUserId` ou un `targetRole` (fan-out stub)              | X-Internal-Secret |

---

## Décisions techniques visibles dans le code

### Séparation authentification
- **JwtAuthGuard** : vérification manuelle (`jwtService.verify`) avec contrôle explicite `type === 'access'`. Extrait `sub`, `email`, `role`, `validationStatus`, `jti`. Sans dépendance Passport.
- **InternalGuard** : header `X-Internal-Secret`. Si `INTERNAL_SECRET` non configuré, laisse passer avec un warning — intentionnel en dev, risque en staging.

### Dashboard = référence de widgets, pas agrégateur
`GET /dashboards/me` retourne des *descripteurs* de widgets (`type`, `label`, `ref`) et non des données. Le frontend récupère les données réelles auprès des services référencés. Cela maintient le service stateless vis-à-vis des données externes.

### Configs de widgets par défaut
7 rôles préconfigurés : `eleve`, `parent_financeur`, `formateur`, `responsable_pedagogique`, `technicien_informatique`, `administrateur_financier`, `animateur_pedagogique`. Règle DASH-FB-001 : le widget `personal_notebook` est exclu du rôle `parent_financeur`.

### Fan-out de notifications par rôle (stub)
`POST /internal/notify` avec `targetRole` insère **un seul** enregistrement avec `userId = "role:<roleName>"`. La vraie diffusion (un enregistrement par utilisateur ayant ce rôle) n'est pas encore implémentée.

### TypeORM `synchronize`
Actif hors production (`NODE_ENV !== 'production'`). Migrations requises avant tout déploiement.

### Tests e2e
Tournent contre une instance PostgreSQL réelle (`TEST_DATABASE_URL`). Couvrent l'idempotence de `initialize-dashboard`, le contenu par rôle, et le comportement du préfixe `role:`.

---

## Points en suspens

| # | Sujet | Description |
|---|-------|-------------|
| 1 | Fan-out rôle | `POST /internal/notify` avec `targetRole` est un stub — un seul enregistrement inséré, pas de diffusion réelle. |
| 2 | `markAllAsRead` non exposé | `NotificationService.markAllAsRead` existe mais aucun endpoint HTTP ne l'appelle (probablement `POST /notifications/read-all` manquant). |
| 3 | `DashboardWidgetState` inutilisé | Entité enregistrée mais aucune route ne l'utilise. À implémenter ou supprimer. |
| 4 | `NotificationSubscription` inutilisée | Entité enregistrée mais aucun CRUD. Les préférences de canal (email vs in-app) ne sont pas opérationnelles. |
| 5 | `InternalGuard` ouvert par défaut | Si `INTERNAL_SECRET` absent, autorise tout avec warning — dangereux en staging/prod. |
| 6 | Pas de migrations TypeORM | `synchronize: true` hors production. |
| 7 | `strictNullChecks: false` | Sécurité TypeScript réduite. |
| 8 | Pas de tests unitaires | Uniquement des tests e2e. Pas de `*.spec.ts` dans `src/`. |
| 9 | Pas de propagation `x-correlation-id` | Contrat technique global non respecté. |
| 10 | `DELETE /notifications/:id` retourne 200 | La convention REST voudrait 204 No Content. |
| 11 | Exclusion carnet non appliquée au niveau des données | Un `parent_financeur` peut sauvegarder une préférence incluant `personal_notebook` via PUT — aucun guard ne l'empêche. |
