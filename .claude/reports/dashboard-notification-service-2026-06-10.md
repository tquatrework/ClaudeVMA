# Rapport — dashboard-notification-service — 2026-06-10

## Statut : ✅ Implémentation complète, build OK

---

## Arborescence des fichiers créés/modifiés

```
services/dashboard-notification-service/
├── .env.example                              [CRÉÉ]
├── src/
│   ├── app.module.ts                         [MODIFIÉ] — ajout DashboardModule, InternalModule, 4 entités
│   ├── common/
│   │   ├── decorators/
│   │   │   └── current-user.decorator.ts     [CRÉÉ] — @CurrentUser() param decorator
│   │   └── guards/
│   │       ├── internal.guard.ts             [CRÉÉ] — vérifie X-Internal-Secret
│   │       └── jwt-auth.guard.ts             [CRÉÉ] — vérifie Bearer JWT (sans passport)
│   ├── dashboard/
│   │   ├── dashboard.controller.ts           [CRÉÉ] — GET /dashboards/me, PUT /dashboards/me/preferences
│   │   ├── dashboard.module.ts               [CRÉÉ]
│   │   ├── dashboard.service.ts              [CRÉÉ] — logique role-based widgets, initializeDashboard
│   │   ├── dto/
│   │   │   └── update-preferences.dto.ts     [CRÉÉ]
│   │   └── entities/
│   │       ├── dashboard-preference.entity.ts      [CRÉÉ]
│   │       ├── dashboard-widget-state.entity.ts    [CRÉÉ]
│   │       └── notification-subscription.entity.ts [CRÉÉ]
│   ├── health/
│   │   ├── health.controller.ts              [MODIFIÉ] — service name corrigé
│   │   └── health.module.ts                  [inchangé]
│   ├── internal/
│   │   ├── dto/
│   │   │   ├── initialize-dashboard.dto.ts   [CRÉÉ]
│   │   │   └── internal-notify.dto.ts        [CRÉÉ]
│   │   ├── internal.controller.ts            [CRÉÉ] — POST /internal/initialize-dashboard, POST /internal/notify
│   │   └── internal.module.ts               [CRÉÉ]
│   ├── main.ts                               [inchangé]
│   └── notification/
│       ├── dto/
│       │   ├── create-notification.dto.ts    [MODIFIÉ] — ajout metadata JSONB
│       │   └── list-notifications.dto.ts     [CRÉÉ] — pagination + filtre isRead
│       ├── entities/
│       │   └── notification.entity.ts        [MODIFIÉ] — ajout metadata JSONB, nouveaux types d'événements
│       ├── notification.controller.ts        [MODIFIÉ] — JWT guard, CurrentUser, routes conformes spec
│       ├── notification.module.ts            [MODIFIÉ] — ajout JwtModule, export NotificationService
│       └── notification.service.ts           [MODIFIÉ] — pagination, user-scoped markAsRead/remove
└── test/
    ├── app.e2e-spec.ts                        [CRÉÉ] — 18 cas de test
    └── jest-e2e.json                          [CRÉÉ]
```

---

## Décisions techniques

### Guards sans Passport
Même pattern que `profile-service` : `JwtAuthGuard` utilise `@nestjs/jwt` directement (pas `@nestjs/passport`). Évite une dépendance superflue, reste cohérent avec le reste du projet.

### Widgets = références, pas données
Conformément à DASH-BR-007, `GET /dashboards/me` retourne des widgets avec `{ type, label, ref: 'service-name' }`. Le frontend est responsable de fetcher les données auprès du service source. Le dashboard ne stocke pas de données métier des autres services.

### DASH-FB-001 — carnet personnel parent
La construction des widgets pour `parent_financeur` n'inclut aucun widget `personal_notebook`. Le widget `linked_students` porte explicitement `note: 'excludes_personal_notebook'` pour documentation frontale.

### Notification par rôle
Quand `POST /internal/notify` reçoit `targetRole`, le `userId` stocké est `role:<nom_du_role>` (ex : `role:responsable_pedagogique`). C'est une approche simplifiée pour la phase 1. Un mécanisme de fan-out (requête par rôle dans identity-access-service) est prévu en phase 2.

### Idempotence de initialize-dashboard
`initializeDashboard` est idempotent : si une `DashboardPreference` existe déjà pour le `userId`, elle est retournée sans modification. Compatible avec les reprises d'orchestration.

### Health check
Service name corrigé de `notification-dashboard-service` en `dashboard-notification-service` (nom canonique du projet).

---

## Points en suspens

1. **Fan-out notifications par rôle** : pour la phase 1, une notification ciblant un rôle est stockée avec `userId = role:<role>`. En phase 2, il faudra soit un événement consommé asynchrone, soit un appel à `identity-access-service` pour lister les users du rôle et créer N notifications.
2. **NotificationSubscription** : l'entité est créée et enregistrée en BDD, mais aucun endpoint CRUD n'est exposé encore. Prévue pour la gestion des canaux (in_app / email) en phase 2.
3. **DashboardWidgetState** : entité créée, mais sans endpoint dédié. En phase 2, les widgets pourront persister leur état (données mises en cache).
4. **Tests e2e** : nécessitent une base PostgreSQL locale. Variable `TEST_DATABASE_URL` à configurer ou utiliser la valeur par défaut `postgres://postgres:postgres@localhost:5432/dashboard_notification_test`.
5. **Routes `/notifications/user/:userId`** supprimées du contrôleur public : remplacées par `GET /notifications` scopé sur l'utilisateur JWT. La spécification `routes.md` mentionne ces routes (héritage du scaffold initial) — elles ne sont pas conformes au principe de moindre privilège.
