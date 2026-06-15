# Arborescence — teacher-request-service (2026-06-10)

## Arborescence complète avec descriptions

```
services/teacher-request-service/
│
├── CLAUDE.md                            # Instructions contextuelles du subagent (référence docs/services/teacher-request-service.md)
├── Dockerfile                           # Build multi-étapes Node 20 Alpine ; HEALTHCHECK sur GET /health
├── nest-cli.json                        # Config NestJS CLI (sourceRoot: src, deleteOutDir: true)
├── package.json                         # Dépendances : NestJS 10, TypeORM 0.3, @nestjs/jwt, Swagger ; scripts test/test:e2e
├── package-lock.json                    # Lockfile npm
├── tsconfig.json                        # Cible ES2021, strictNullChecks: false, noImplicitAny: false
│
├── src/
│   ├── main.ts                          # Point d'entrée : NestFactory, ValidationPipe (whitelist+transform), CORS, Swagger sur /api/docs, PORT=3000
│   ├── app.module.ts                    # Module racine : ConfigModule (global), TypeOrmModule async (PostgreSQL via DATABASE_URL), synchronize hors production
│   │
│   ├── common/
│   │   ├── jwt.guard.ts                 # JwtAuthGuard : lit le header Authorization Bearer, vérifie type=access, expose JwtPayload (id, role, email, jti)
│   │   ├── current-user.decorator.ts   # Décorateur @CurrentUser() : extrait request.user (JwtPayload) injecté par le guard
│   │   └── user-role.enum.ts           # Enum UserRole : ELEVE, PARENT_FINANCEUR, FORMATEUR, ANIMATEUR_PEDAGOGIQUE, RESPONSABLE_PEDAGOGIQUE, TECHNICIEN_INFORMATIQUE, ADMINISTRATEUR_FINANCIER
│   │
│   ├── health/
│   │   ├── health.module.ts            # Module NestJS exposant uniquement HealthController
│   │   └── health.controller.ts        # GET /health — pas d'authentification, retourne { status, service, timestamp }
│   │
│   └── teacher-request/
│       ├── teacher-request.module.ts   # Module métier : TypeORM (4 entités), JwtModule async, 3 controllers, EventsService, JwtAuthGuard
│       ├── teacher-request.controller.ts  # 3 controllers dans un seul fichier (voir détail routes ci-dessous)
│       ├── teacher-request.service.ts  # Service central : logique métier, contrôles RBAC, transitions d'état, émission d'événements
│       ├── teacher-request.service.spec.ts  # Tests unitaires Jest (mocks TypeORM) couvrant tous les cas nominaux et d'erreur
│       ├── events.service.ts           # Stub d'événements : log JSON (event + payload + timestamp) — pas d'event bus réel en phase 1
│       │
│       ├── dto/
│       │   ├── create-request.dto.ts    # Création de demande : subject (requis), studentId (UUID optionnel), level, sector, message
│       │   ├── update-status.dto.ts     # Patch statut : champ status (enum RequestStatus, validé par @IsEnum)
│       │   ├── create-proposal.dto.ts   # Redirection vers un formateur : teacherId (UUID requis), availabilityNote (optionnel)
│       │   └── create-termination.dto.ts # Résiliation : noticeDate (ISO 8601 requis), reason (optionnel)
│       │
│       └── entities/
│           ├── teacher-request.entity.ts    # Table teacher_requests : id UUID, requesterId, requesterRole, studentId, subject, level, sector, message, status (pending/accepted/declined/redirected/assigned/cancelled), timestamps
│           ├── teacher-proposal.entity.ts   # Table teacher_proposals : id UUID, requestId, teacherId, availabilityNote, status (pending/accepted/declined), timestamps
│           ├── assignment.entity.ts         # Table assignments : id UUID, studentId, teacherId, proposalId, requestId, isMainTeacher (bool), status (active/termination_requested/terminated), timestamps
│           └── termination-request.entity.ts  # Table termination_requests : id UUID, assignmentId, teacherId, noticeDate (date), reason, status (pending/acknowledged), createdAt
│
└── test/
    ├── jest-e2e.json                   # Config Jest e2e : timeout 60s, testRegex .e2e-spec.ts, ts-jest
    └── e2e/
        ├── helpers/
        │   └── app.helper.ts           # Bootstrap NestJS en test sur PostgreSQL local (teacher_request_test), makeJwt(), IDS (UUIDs fixes)
        ├── health.e2e-spec.ts          # E2E : GET /health — 200, shape { status, service, timestamp }, ISO 8601
        └── requests.e2e-spec.ts        # E2E : 16 critères TR-AUTH-001 + TR-BR-001 à TR-BR-016 sur /requests (POST/GET/PATCH/DELETE)
```

---

## Routes HTTP exposées

Toutes les routes sauf `/health` requièrent un JWT Bearer valide (`Authorization: Bearer <token>`).
Swagger disponible sur `GET /api/docs`.

### Health

| Méthode | Chemin    | Auth | Description                                      |
|---------|-----------|------|--------------------------------------------------|
| GET     | /health   | Non  | Healthcheck — retourne `{ status, service, timestamp }` |

### Requests (`@Controller('requests')` — tag Swagger : `requests`)

| Méthode | Chemin                      | Auth | Rôles autorisés                                    | Description |
|---------|-----------------------------|------|----------------------------------------------------|-------------|
| POST    | /requests                   | JWT  | ELEVE, PARENT_FINANCEUR, RESPONSABLE_PEDAGOGIQUE  | Créer une demande professeur. Le `studentId` est requis si le requérant n'est pas ELEVE. Statut initial : `pending`. |
| GET     | /requests                   | JWT  | ELEVE, PARENT_FINANCEUR, FORMATEUR, RP            | Lister les demandes. Vue filtrée par rôle : ELEVE/PARENT voient leurs demandes, RP voit tout, FORMATEUR voit ses propositions. |
| GET     | /requests/:id               | JWT  | ELEVE (own), PARENT (own), RP (all)               | Détail d'une demande par UUID. 404 si introuvable, 403 si accès interdit. |
| PATCH   | /requests/:id/status        | JWT  | RESPONSABLE_PEDAGOGIQUE uniquement                | Changer le statut d'une demande. Transitions valides : `pending → accepted / declined / cancelled`. |
| DELETE  | /requests/:id               | JWT  | RESPONSABLE_PEDAGOGIQUE uniquement                | Supprimer définitivement une demande. 204 si succès. |

### Proposals — sous-route et contrôleur dédié

| Méthode | Chemin                           | Auth | Rôles autorisés                  | Description |
|---------|----------------------------------|------|----------------------------------|-------------|
| POST    | /requests/:requestId/proposals   | JWT  | RESPONSABLE_PEDAGOGIQUE          | Rediriger une demande vers un formateur (créer une proposition). Passe la demande en `redirected`. |
| POST    | /proposals/:proposalId/accept    | JWT  | FORMATEUR (destinataire uniquement) | Accepter une proposition. Crée un `Assignment`, passe la proposition en `accepted` et la demande en `assigned`. |

### Assignments

| Méthode | Chemin                                    | Auth | Rôles autorisés                         | Description |
|---------|-------------------------------------------|------|-----------------------------------------|-------------|
| POST    | /assignments/:assignmentId/main-teacher   | JWT  | RESPONSABLE_PEDAGOGIQUE, ELEVE (own)   | Désigner le formateur principal (PP) d'un élève. L'assignment doit être `active`. |
| POST    | /assignments/:assignmentId/termination    | JWT  | FORMATEUR (assigné uniquement)          | Demander la fin de relation avec préavis (`noticeDate` ISO 8601). Passe l'assignment en `termination_requested`. |

---

## Décisions techniques visibles dans le code

### Architecture et structure

- **Trois controllers dans un seul fichier** (`teacher-request.controller.ts`) : `TeacherRequestController`, `ProposalController`, `AssignmentController`. Choix pragmatique pour garder la cohérence du domaine, au prix d'un fichier plus long.
- **Module NestJS auto-suffisant** : `TeacherRequestModule` embarque TypeORM, JwtModule et tous ses providers ; aucune dépendance inter-module hormis `ConfigModule` (global).
- **TypeORM `synchronize: true` hors production** : la migration de schéma est automatique en dev/test, désactivée en production.

### Authentification et autorisation

- **JwtAuthGuard maison** (pas de Passport) : extrait le token Bearer, vérifie `type === 'access'` (rejet des refresh tokens), mappe `sub → id`. Le secret est lu depuis `JWT_SECRET` avec fallback `'dev-secret'`.
- **RBAC inline** dans le service : chaque méthode vérifie le rôle via `UserRole` enum avant toute opération. Pas de guards dédiés par rôle, pas de décorateurs `@Roles()`.
- **Isolation formateur** (règle TRQ-FB-001) : le `GET /requests` pour un `FORMATEUR` requête `teacher_proposals` et non `teacher_requests`, empêchant tout accès aux demandes brutes.

### Machines d'état

- **RequestStatus** : `pending → accepted | declined | cancelled | redirected → assigned`. Seule la transition depuis `pending` est autorisée par `updateRequestStatus`.
- **ProposalStatus** : `pending → accepted | declined`.
- **AssignmentStatus** : `active → termination_requested → terminated`. Le flag `isMainTeacher` est indépendant du statut.
- **TerminationStatus** : `pending → acknowledged` (statut défini en entité mais la transition `acknowledged` n'est pas encore implémentée en phase 1).

### Événements

- **EventsService stub** : les événements (`TeacherRequestCreated`, `TeacherProposalSent`, `TeacherAssigned`, `MainTeacherAssigned`, `TeacherRelationTerminationRequested`, etc.) sont loggés en JSON via `Logger`. Pas d'event bus réel en phase 1 — interface prête pour substitution.

### Tests

- **Tests unitaires** (`teacher-request.service.spec.ts`) : couverture complète de tous les cas nominaux et d'erreur (ForbiddenException, NotFoundException, BadRequestException) avec mocks TypeORM.
- **Tests e2e** (`requests.e2e-spec.ts`) : 16 critères métier formalisés (TR-AUTH-001, TR-BR-001 à TR-BR-016), base de données PostgreSQL locale (`teacher_request_test`), JWT forgés avec `jsonwebtoken` direct.
- **Base e2e** : connexion directe à PostgreSQL local (pas de testcontainers actif), `synchronize: true` en mode test pour auto-migration.

### Points en suspens / phase 1 non implémentés

- La transition `TerminationStatus.PENDING → ACKNOWLEDGED` est définie en entité mais aucune route ne la déclenche.
- `ProposalStatus.DECLINED` est défini mais aucune route `POST /proposals/:id/decline` n'existe.
- `strictNullChecks: false` et `noImplicitAny: false` dans `tsconfig.json` — permissif, à renforcer si la couverture de types devient critique.
- Les tests e2e couvrent uniquement les routes `/requests` ; les routes `/proposals` et `/assignments` ne disposent pas encore de suite e2e dédiée.
