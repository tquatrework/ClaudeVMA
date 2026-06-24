# Rapport — dashboard-notification-service — 2026-06-16

## Routes disponibles

### Routes publiques authentifiées (JWT Bearer)

| Méthode | Chemin | Description |
|---|---|---|
| GET | /health | Healthcheck (non authentifié) |
| GET | /notifications | Lister les notifications paginées de l'utilisateur courant |
| POST | /notifications/:notificationId/read | Marquer une notification comme lue |
| DELETE | /notifications/:id | Supprimer une notification |
| GET | /dashboards/me | Tableau de bord composé selon rôle |
| PUT | /dashboards/me/preferences | Mettre à jour la config widget de l'utilisateur |

### API interne (X-Internal-Secret)

| Méthode | Chemin | Description |
|---|---|---|
| POST | /internal/initialize-dashboard | Initialiser un tableau de bord (onboarding) |
| POST | /internal/notify | Créer une notification vers userId ou role |

## Résultat des tests

- **Tests unitaires** : 32/32 passés (3 suites)
  - `notification.service.spec.ts` : 17 tests — create, findByUser, findRecentByUser, markAsRead, markAllAsRead, remove
  - `dashboard.service.spec.ts` : 11 tests — getMyDashboard (par rôle), updatePreferences, initializeDashboard, getPreference
  - `internal.controller.spec.ts` : 4 tests — initializeDashboard, notify (userId / role / BadRequest / metadata)

- **Tests e2e** : non lancés (nécessitent une DB Postgres — hors périmètre du `npm run test`)

## Écarts avec la spec XML (candidateApis)

| Route spec XML | Statut | Décision |
|---|---|---|
| `GET /dashboard` | Implémenté sous `GET /dashboards/me` | Aligné sur docs/routes.md |
| `GET /dashboard/users/{userId}` | Absent | Non référencé dans docs/routes.md — hors périmètre Phase 1 |
| `GET /dashboard/news` | Absent | Non référencé dans docs/routes.md — hors périmètre Phase 1 |
| `PATCH /notifications/{id}/read` | Implémenté en `POST /notifications/:notificationId/read` | Aligné sur docs/routes.md |
| `POST /notifications` | Délégué à `/internal/notify` | Réservé aux services internes |

## Décisions techniques

- La route `GET /dashboard/users/{userId}` (vue tiers autorisée) n'est pas dans docs/routes.md. Elle est différée sans implémentation spéculative.
- La route `GET /dashboard/news` (news réseau) n'est pas dans docs/routes.md. Différée.
- Les guards du controller interne sont correctement mockés dans les tests unitaires (`overrideGuard(InternalGuard)`).
- `POST /notifications/:notificationId/read` (et non PATCH) est conforme au contrat docs/routes.md.

## Points en suspens

- Vue tiers `GET /dashboards/users/:userId` : à arbitrer en Phase 2 avec les droits parent_financeur.
- News réseau `GET /dashboard/news` : à spécifier (source de données, filtrage par niveau/rôle).
- Fan-out notifications par rôle : actuellement stocké sous `userId = "role:xxx"` — à remplacer par une vraie table d'abonnements en Phase 2.
- Tests e2e nécessitent une base de données de test (`TEST_DATABASE_URL`) — non intégrés dans la CI actuelle.
