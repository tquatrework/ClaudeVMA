# Arborescence — pedagogical-log-service (2026-06-10)

## Arborescence complète avec descriptions

```
services/pedagogical-log-service/
├── .env.example                                   # Variables d'environnement requises (DATABASE_URL, JWT_SECRET, PORT)
├── Dockerfile                                     # Build multi-stage Node 20 Alpine, EXPOSE 3000, HEALTHCHECK sur /health
├── nest-cli.json                                  # Config NestJS CLI
├── package.json                                   # Dépendances NestJS + TypeORM + Swagger + class-validator
├── package-lock.json                              # Lockfile npm
├── tsconfig.json                                  # Config TypeScript
├── src/
│   ├── main.ts                                    # Point d'entrée NestJS, ValidationPipe global, CORS, Swagger
│   ├── app.module.ts                              # Module racine : ConfigModule + TypeORM (PostgreSQL) + 3 domaines + HealthModule
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts          # @CurrentUser() — extrait le payload JWT de la requête
│   │   │   └── roles.decorator.ts                 # @Roles(...) — déclare les rôles autorisés sur une route
│   │   ├── enums/
│   │   │   └── user-role.enum.ts                  # Enum UserRole : eleve, parent, formateur, rp, ap, ti, admin_financier
│   │   └── guards/
│   │       ├── jwt-auth.guard.ts                  # JwtAuthGuard — vérifie et décode le JWT (répliqué de calendar-service)
│   │       └── roles.guard.ts                     # RolesGuard — contrôle d'accès par rôle via @Roles()
│   ├── health/
│   │   ├── health.module.ts                       # Module health minimaliste
│   │   └── health.controller.ts                   # GET /health → { status: "ok", service, timestamp }
│   ├── pedagogical-log/                           # Cahier de texte
│   │   ├── pedagogical-log.module.ts              # Module NestJS : entité + controller + service
│   │   ├── pedagogical-log.controller.ts          # Routes /logs : POST, GET liste filtrée, PATCH
│   │   ├── pedagogical-log.service.ts             # Logique métier : visibilité différenciée selon rôle, filtrage SQL
│   │   ├── dto/
│   │   │   ├── create-log.dto.ts                  # DTO création : studentId, teacherId, activityId, content, visibility
│   │   │   └── update-log.dto.ts                  # DTO mise à jour partielle (PartialType)
│   │   └── entities/
│   │       └── pedagogical-log.entity.ts          # Entité TypeORM "pedagogical_logs" : id (UUID), studentId, teacherId,
│   │                                              #   activityId?, content, visibility (enum 4 niveaux), authorId, timestamps
│   ├── notebook/                                  # Carnet personnel (réservé à l'élève)
│   │   ├── notebook.module.ts                     # Module NestJS : table physiquement séparée
│   │   ├── notebook.controller.ts                 # Routes /students/:id/notebook : POST, GET liste, GET :entryId, PATCH, DELETE
│   │   ├── notebook.service.ts                    # assertIsOwner() — vérifie que l'appelant est bien l'élève propriétaire
│   │   ├── dto/
│   │   │   ├── create-notebook-entry.dto.ts       # DTO création : title, content
│   │   │   └── update-notebook-entry.dto.ts       # DTO mise à jour partielle
│   │   └── entities/
│   │       └── notebook-entry.entity.ts           # Entité TypeORM "notebook_entries" : id (UUID), studentId (owner),
│   │                                              #   title, content, timestamps
│   └── memo/                                      # Mémos rapides
│       ├── memo.module.ts                         # Module NestJS
│       ├── memo.controller.ts                     # Routes /memos : POST, GET liste, GET :id
│       ├── memo.service.ts                        # Accès réservé aux formateurs, RP, AP
│       ├── dto/
│       │   └── create-memo.dto.ts                 # DTO création : studentId?, activityId?, content
│       └── entities/
│           └── memo.entity.ts                     # Entité TypeORM "memos" : id (UUID), authorId, studentId?,
│                                                  #   activityId?, content, timestamps
└── test/
    └── e2e/
        ├── helpers/
        │   └── app.helper.ts                      # Bootstrap du module de test avec SQLite en mémoire
        ├── health.e2e-spec.ts                     # Tests e2e : GET /health
        └── pedagogical-log.e2e-spec.ts            # Tests e2e : 59 cas couvrant les 3 domaines, les règles
                                                   #   de visibilité (PLOG-BR-001 à PLOG-FB-003) et les erreurs 4xx
```

## Routes HTTP exposées

| Méthode | Chemin                                    | Description                                                        | Rôles autorisés              |
|---------|-------------------------------------------|--------------------------------------------------------------------|------------------------------|
| GET     | /health                                   | Health check — `{ status: "ok", service, timestamp }`             | Aucun                        |
| POST    | /logs                                     | Créer une entrée de cahier de texte                                | formateur, rp, ap            |
| GET     | /logs                                     | Lister les entrées (filtrées selon visibilité + rôle)              | eleve, parent, formateur, rp |
| PATCH   | /logs/:id                                 | Modifier une entrée (auteur ou rp/ti)                              | formateur, rp, ti            |
| POST    | /students/:studentId/notebook             | Créer une entrée de carnet personnel                               | eleve (propriétaire)         |
| GET     | /students/:studentId/notebook             | Lister les entrées du carnet                                       | eleve (propriétaire)         |
| GET     | /students/:studentId/notebook/:entryId    | Lire une entrée du carnet                                          | eleve (propriétaire)         |
| PATCH   | /students/:studentId/notebook/:entryId    | Modifier une entrée du carnet                                      | eleve (propriétaire)         |
| DELETE  | /students/:studentId/notebook/:entryId    | Supprimer une entrée du carnet                                     | eleve (propriétaire)         |
| POST    | /memos                                    | Créer un mémo rapide                                               | formateur, rp, ap            |
| GET     | /memos                                    | Lister les mémos                                                   | formateur, rp, ap            |
| GET     | /memos/:id                                | Lire un mémo par id                                                | formateur, rp, ap            |
| GET     | /api/docs                                 | Interface Swagger UI (auto-générée)                                | Aucun                        |

## Décisions techniques

### Stack et framework
- NestJS 10 avec TypeORM 0.3 sur PostgreSQL (connexion via `DATABASE_URL`).
- `synchronize: true` en développement/test — migrations explicites à activer en production.
- 3 tables distinctes : `pedagogical_logs`, `notebook_entries`, `memos` — isolation physique garantissant PLOG-FB-001/FB-002.

### Visibilité du cahier de texte
4 niveaux encodés dans la colonne `visibility` de `pedagogical_logs` :
- `eleve_parent_formateur` — visible par l'élève, son parent et le formateur auteur
- `eleve_formateur` — visible par l'élève et le formateur uniquement
- `formateur_rp` — visible par le formateur et le RP
- `special` — réservé aux rôles internes (RP, TI, AP)

Le filtrage est appliqué directement en SQL dans `pedagogical-log.service.ts` selon le rôle extrait du JWT.

### Carnet personnel
- Table `notebook_entries` physiquement séparée de `pedagogical_logs`.
- `assertIsOwner()` dans le service vérifie que `req.user.sub === studentId` avant toute opération.
- Garantit PLOG-FB-001 (pas de lecture parent) et PLOG-FB-002 (pas de lecture formateur).

### Sécurité
- `JwtAuthGuard` + `RolesGuard` répliqués de `calendar-service` sans modification.
- `@CurrentUser()` extrait `userId` et `role` du payload JWT validé.
- Toutes les routes protégées sont décorées `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)`.

### Tests
- 59 tests e2e avec SQLite en mémoire (base embarquée, zéro dépendance externe).
- Couverture : création, lecture filtrée par rôle, accès propriétaire carnet, erreurs 400/401/403/404.

### Docker
- Build multi-stage : stage `builder` (compile TypeScript), stage `production` (`npm ci --omit=dev`, `USER node`).
- Point d'entrée : `dist/src/main.js`.
- `HEALTHCHECK` Docker sur `/health` toutes les 30 s.

## Points en suspens

- **PLOG-FB-003 partiel** : le rôle `formateur` est vérifié, mais la vérification que le formateur est bien lié à l'élève concerné nécessite un appel interservice vers `profile-service` non encore disponible. À compléter en phase 2.
- **Propagation `x-correlation-id`** : non implémentée (contrat technique du projet — à ajouter via intercepteur global).
- **Pagination** : les listes (`/logs`, `/memos`) ne sont pas paginées.
- **Migrations TypeORM** : `synchronize: true` acceptable en développement, doit être remplacé par des migrations versionnées avant mise en production.
