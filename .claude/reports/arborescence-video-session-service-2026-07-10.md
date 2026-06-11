# Arborescence — video-session-service (2026-06-11)

## Arborescence complète avec descriptions

```
services/video-session-service/
├── .env.example                                   # Variables requises : DATABASE_URL, JWT_SECRET, INTERNAL_SECRET, PORT, NODE_ENV
├── CLAUDE.md
├── Dockerfile                                     # Build multi-stage Node 20 Alpine, HEALTHCHECK sur /health, USER node
├── nest-cli.json
├── package.json                                   # Dépendances NestJS + TypeORM + SQLite + uuid + Swagger + class-validator
├── tsconfig.json                                  # strictNullChecks: false, noImplicitAny: false
├── test/
│   └── jest-e2e.json                              # Config Jest e2e (à alimenter)
└── src/
    ├── main.ts                                    # Bootstrap NestJS, ValidationPipe global, Swagger sur /api/docs, CORS, PORT configurable
    ├── app.module.ts                              # Module racine : ConfigModule global + TypeORM async (SQLite) + VideoSessionModule + InternalModule + HealthModule
    ├── common/
    │   ├── decorators/
    │   │   ├── current-user.decorator.ts          # @CurrentUser() — extrait le payload JWT de la requête
    │   │   └── roles.decorator.ts                 # @Roles(...) — déclare les rôles autorisés sur une route
    │   ├── enums/
    │   │   └── user-role.enum.ts                  # Enum UserRole : eleve, formateur, parent_financeur, responsable_pedagogique, etc.
    │   └── guards/
    │       ├── jwt-auth.guard.ts                  # Guard JWT — valide le Bearer token via JwtModule
    │       └── roles.guard.ts                     # Guard rôles — vérifie UserRole contre @Roles()
    ├── health/
    │   ├── health.module.ts                       # Module health minimaliste
    │   └── health.controller.ts                   # GET /health → { status: "ok", service, timestamp }
    ├── internal/
    │   ├── internal.module.ts                     # Module interne non exposé via nginx
    │   ├── internal.controller.ts                 # Routes /internal/video/* protégées par X-Internal-Secret
    │   └── internal-secret.guard.ts               # Guard validant le header X-Internal-Secret
    └── video-session/
        ├── video-session.module.ts                # Module NestJS : entités VideoRoom + VideoAccessToken + AttendanceRecord + controller + service
        ├── video-session.controller.ts            # Controller REST : 4 routes avec @UseGuards(JwtAuthGuard), @ApiOperation, @ApiResponse
        ├── video-session.service.ts               # Service métier : create, join (token access), attendance, close + événements
        ├── video-session.service.spec.ts          # 22 tests unitaires — VID-BR-005 (accès token) et VID-BR-006 (fin de session)
        ├── dto/
        │   ├── create-room.dto.ts                 # DTO création : calendarSessionId (UUID requis), participantIds[]
        │   └── record-attendance.dto.ts           # DTO présence : userId (UUID requis), joinedAt, leftAt
        └── entities/
            ├── video-room.entity.ts               # Table "video_rooms" : id, calendarSessionId, roomToken, status (enum), startedAt, endedAt, createdAt
            ├── video-access-token.entity.ts       # Table "video_access_tokens" : id, roomId (FK), userId, token (UUID), expiresAt
            └── attendance-record.entity.ts        # Table "attendance_records" : id, roomId (FK), userId, joinedAt, leftAt, durationSeconds
```

## Routes HTTP exposées

### Routes publiques / authentifiées (JWT)

| Méthode | Chemin                           | Description                                                                 | Auth       |
|---------|----------------------------------|-----------------------------------------------------------------------------|------------|
| GET     | /health                          | Health check — `{ status: "ok", service, timestamp }`                       | Aucune     |
| POST    | /video-rooms                     | Créer une salle vidéo liée à une activité calendrier (VID-BR-004)           | Bearer JWT |
| GET     | /video-rooms/:roomId/join        | Obtenir un token d'accès — réservé aux participants autorisés (VID-BR-005)  | Bearer JWT |
| POST    | /video-rooms/:roomId/attendance  | Enregistrer la présence d'un participant (VID-BR-006)                       | Bearer JWT |
| POST    | /video-rooms/:roomId/close       | Clôturer la session — publie `VideoSessionEnded` (VID-BR-006)               | Bearer JWT |
| GET     | /api/docs                        | Interface Swagger UI (auto-générée)                                          | Aucune     |

### Routes internes inter-services (X-Internal-Secret)

| Méthode | Chemin                            | Description                                              |
|---------|-----------------------------------|----------------------------------------------------------|
| POST    | /internal/video/rooms             | Créer une salle depuis l'orchestrateur                   |
| GET     | /internal/video/rooms/:roomId     | Lire l'état d'une salle                                  |
| POST    | /internal/video/rooms/:roomId/close | Clôturer une session depuis l'orchestrateur            |
| GET     | /internal/video/rooms/:roomId/attendance | Récupérer les enregistrements de présence        |

## Décisions techniques

- **Stack :** NestJS 10, TypeORM 0.3, SQLite (phase 1), uuid v9, class-validator, Swagger.
- **Accès visio :** token UUID généré par `VideoAccessToken` — valide uniquement pour les `participantIds` déclarés à la création (VID-BR-005).
- **Statut de salle :** enum `RoomStatus` (waiting → active → ended) ; transitions validées en service.
- **Participants autorisés :** formateur et élève uniquement — `parent_financeur` explicitement exclu (VID-FB-001).
- **Événements publiés :** `VideoRoomCreated`, `VideoSessionStarted`, `VideoSessionEnded`, `AttendanceRecorded` — simulés en phase 1 (log console), à câbler sur un event bus en phase 2.
- **Module internal :** exclu de Swagger (`@ApiExcludeController`), protégé par `InternalSecretGuard` vérifiant `X-Internal-Secret`.
- **TypeORM `synchronize` :** désactivé en production, actif en développement.
- **Docker :** build multi-stage, `npm ci --omit=dev`, USER node (non-root), HEALTHCHECK natif.

## Points en suspens

- **Vérification participant côté calendar-service :** la logique actuelle vérifie les `participantIds` stockés localement à la création ; un appel `calendar-service` pour valider l'activité reste à câbler en phase 2.
- **VideoProviderConfig :** provider simulé en phase 1 (token UUID) — SDK réel (Jitsi, Daily.co, etc.) à intégrer en phase 2.
- **Propagation `x-correlation-id` :** non implémentée — à ajouter avant mise en production.
- **Tests e2e :** répertoire `test/` créé, fichier `jest-e2e.json` présent — scénarios à écrire (VID-TEST-001/002/003).
