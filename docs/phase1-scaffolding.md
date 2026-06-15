# Phase 1 — Scaffolding monorepo

## Ce qui a été généré

Structure complète dockerisée, prête à lancer avec `docker compose up --build`.

### Infra

| Fichier | Rôle |
|---|---|
| `docker-compose.yml` | Orchestre les 9 conteneurs + postgres + redis |
| `.env.example` | Variables d'environnement à copier en `.env` |
| `scripts/init-databases.sql` | Crée les 8 BDD PostgreSQL au premier démarrage |
| `gateway/api-gateway/nginx.conf` | Routage vers les 8 services |

### Par service NestJS

Chaque service contient :

```
services/<nom>/
├── Dockerfile          # Multi-stage build Node 20 Alpine
├── package.json        # Dépendances NestJS + TypeORM + Swagger
├── tsconfig.json
├── nest-cli.json
└── src/
    ├── main.ts         # Bootstrap + Swagger UI sur /api/docs
    ├── app.module.ts   # TypeORM connecté à sa BDD dédiée
    ├── <domaine>/
    │   ├── <domaine>.module.ts
    │   ├── <domaine>.controller.ts   # Routes documentées @ApiOperation
    │   ├── <domaine>.service.ts      # Logique CRUD TypeORM
    │   ├── entities/                 # Entité TypeORM
    │   └── dto/                      # DTOs avec class-validator
    └── health/
        └── health.controller.ts     # GET /health → 200
```

## Hypothèses faites sur chaque service

Ces hypothèses sont basées sur l'architecture existante (`docs/architecture.md`).
**Elles sont à valider et ajuster avant tout développement métier.**

| Service | Entité principale créée | Routes stub |
|---|---|---|
| auth-service | `User` (email, passwordHash, role) | register, login, refresh, me |
| user-profile-service | `UserProfile` (userId, firstName, lastName, subjects) | CRUD par userId |
| teacher-request-service | `TeacherRequest` (studentId, teacherId, subject, status) | CRUD + PATCH status |
| calendar-service | `CalendarSession` (teacherId, studentId, startTime, endTime) | CRUD + filtres |
| video-session-service | `VideoRoom` (calendarSessionId, roomToken, status) | create, get, join, end |
| communication-service | `Message` (conversationId, senderId, receiverId, content) | send, get conversation, mark read |
| pedagogical-log-service | `PedagogicalLog` (sessionId, studentId, notes, skillsWorked) | create + filtres |
| notification-dashboard-service | `Notification` (userId, type, title, message, isRead) | CRUD + mark-all-read |

## Variables d'environnement requises

```env
POSTGRES_USER=visiomath
POSTGRES_PASSWORD=<secret>
JWT_SECRET=<secret_long_aleatoire>
JWT_EXPIRES_IN=1h
REDIS_PASSWORD=<secret>
NODE_ENV=development
```

## Notes importantes

- **`synchronize: true` uniquement en dev** — en production, activer les migrations TypeORM
- **JWT_SECRET partagé** — tous les services valident les tokens avec le même secret
- **Swagger** accessible à `http://localhost/api/v1/<service>/docs`
- **Health check** : `GET http://localhost/health` (gateway) et `GET /health` sur chaque service
