# Arborescence — video-session-service (2026-06-10)

## Arborescence complète avec descriptions

```
services/video-session-service/
├── CLAUDE.md
├── Dockerfile                                     # Build multi-stage Node 20 Alpine, HEALTHCHECK sur /health, USER node
├── nest-cli.json
├── package.json                                   # Dépendances NestJS + TypeORM + uuid + Swagger
├── tsconfig.json                                  # strictNullChecks: false, noImplicitAny: false
└── src/
    ├── main.ts                                    # Bootstrap NestJS, ValidationPipe global, Swagger sur /api/docs, CORS, PORT configurable
    ├── app.module.ts                              # Module racine : ConfigModule global + TypeORM async (PostgreSQL) + VideoSessionModule + HealthModule
    ├── health/
    │   ├── health.module.ts                       # Module health minimaliste
    │   └── health.controller.ts                   # GET /health → { status: "ok", service, timestamp }
    └── video-session/
        ├── video-session.module.ts                # Module NestJS : entité VideoRoom + controller + service
        ├── video-session.controller.ts            # Controller REST /video : 4 routes avec @ApiBearerAuth()
        ├── video-session.service.ts               # Service métier : create, findOne, join (waiting→active), end (→ended)
        ├── dto/
        │   └── create-room.dto.ts                 # DTO de création : calendarSessionId (UUID requis)
        └── entities/
            └── video-room.entity.ts               # Entité TypeORM table "video_rooms" : id, calendarSessionId, roomToken (unique, UUID auto), status (enum), startedAt, endedAt, createdAt, updatedAt
```

## Routes HTTP exposées

| Méthode | Chemin              | Description                                                    | Auth       |
|---------|---------------------|----------------------------------------------------------------|------------|
| GET     | /health             | Health check — retourne { status: "ok", service, timestamp }  | Aucune     |
| POST    | /video/rooms        | Créer une salle vidéo liée à une session calendrier            | Bearer JWT |
| GET     | /video/rooms/:id    | Récupérer les informations d'une salle par son UUID            | Bearer JWT |
| POST    | /video/rooms/:id/join | Rejoindre une salle (waiting→active, enregistre startedAt)  | Bearer JWT |
| POST    | /video/rooms/:id/end  | Clôturer une session (→ended, enregistre endedAt)            | Bearer JWT |
| GET     | /api/docs           | Interface Swagger UI (auto-générée)                            | Aucune     |

## Décisions techniques visibles dans le code

- **Stack :** NestJS 10, TypeORM 0.3, PostgreSQL, uuid v9.
- **roomToken :** généré via `uuidv4()` à la création — opaque, unique en base, sert d'identifiant de salle.
- **Statut de salle :** enum `RoomStatus` (waiting / active / ended) avec transitions : create→waiting, join→active, end→ended.
- **Lien calendar-service :** `calendarSessionId` référencé sans Foreign Key inter-service — couplage lâche conforme à l'architecture microservices.
- **TypeORM `synchronize` :** désactivé en production (`NODE_ENV === 'production'`), actif en développement.
- **Swagger :** `@ApiBearerAuth()` déclaré sur toutes les routes /video, opérations et réponses documentées.
- **Docker :** build multi-stage, `npm ci --omit=dev` en production, USER node (non-root), HEALTHCHECK natif Docker.
- **TypeScript :** config souple (`strictNullChecks: false`, `noImplicitAny: false`), cohérent avec les autres services phase 1.

## Points en suspens

- Guard JWT déclaré via `@ApiBearerAuth()` mais non implémenté — routes non protégées en réalité.
- Aucune vérification que seuls les participants autorisés (formateur, élève) peuvent rejoindre ou clôturer.
- Pas d'événement `SessionEnded` publié — `pedagogical-log-service` et `finance-credit-service` ne peuvent pas réagir automatiquement.
- Propagation de `x-correlation-id` non implémentée.
- Pas de `.env.example` (variables requises : `DATABASE_URL`, `PORT`, `NODE_ENV`).
- Pas de `package-lock.json` commité — à synchroniser avant CI.
- Pas de tests (ni unitaires ni e2e).
