# Arborescence — profile-service (2026-06-10)

**Branche :** feat/phase1-canonical-services
**Stack :** NestJS 10 / TypeORM 0.3 / PostgreSQL / JWT (sans Passport)

---

## Arborescence complète avec descriptions

```
services/profile-service/
├── Dockerfile                        # Build multi-stage (builder + production), Node 20 Alpine, HEALTHCHECK sur /health
├── nest-cli.json
├── package.json                      # Dépendances : NestJS, TypeORM, pg, Swagger, jwt, class-validator
├── tsconfig.json
├── .env                              # Secrets runtime (gitignored)
├── .env.test                         # Secrets de test (fallback DB locale)
├── postman.profile-service.environment.json  # Environnement Postman pour tests manuels
├── CLAUDE.md                         # Instructions du sous-agent
│
└── src/
    ├── main.ts                       # Bootstrap : ValidationPipe (whitelist+transform), CORS, Swagger sur /api/docs
    ├── app.module.ts                 # Module racine : TypeORM async (DATABASE_URL), synchronize=true hors prod
    │                                 # Modules : EventsModule, ProfilesModule, RelationsModule, HealthModule, InternalModule
    │
    ├── common/
    │   ├── decorators/
    │   │   └── roles.decorator.ts    # @Roles(...roles) — SetMetadata shorthand
    │   ├── enums/
    │   │   └── user-role.enum.ts     # 7 rôles : eleve, parent_financeur, formateur, animateur_pedagogique,
    │   │                             # responsable_pedagogique, technicien_informatique, administrateur_financier
    │   └── guards/
    │       ├── jwt-auth.guard.ts     # JWT manuel (sans Passport) — vérifie type='access', peuple request.user
    │       └── roles.guard.ts        # Lit ROLES_KEY, lève 403 si rôle absent
    │
    ├── events/
    │   ├── events.module.ts
    │   └── events.service.ts         # Stub phase 1 : log JSON structuré via NestJS Logger
    │                                 # Événements : ProfileUpdated, StudentLinkedToFinanceOwner,
    │                                 # TeacherLinkedToStudent, CoordinatorLinkedToStudent,
    │                                 # TeacherPromotedToPedagogicalAnimator
    │
    ├── health/
    │   ├── health.module.ts
    │   └── health.controller.ts      # GET /health → { status: 'ok', service: 'user-profile-service', timestamp }
    │                                 # NOTE: service retourne 'user-profile-service' au lieu de 'profile-service'
    │
    ├── profiles/
    │   ├── profiles.module.ts        # JwtModule async + TypeORM sur 4 entités profil + 2 entités relation
    │   ├── profiles.controller.ts    # 6 routes sous /profiles
    │   ├── profiles.service.ts       # Logique métier + helpers de contrôle d'accès ; exporte interface Actor
    │   ├── profiles.service.spec.ts  # Tests unitaires Jest (20+ cas)
    │   ├── dto/
    │   │   ├── update-administrative-profile.dto.ts   # Tout optionnel : name, DOB, phone, address, avatarUrl
    │   │   ├── update-pedagogical-profile.dto.ts      # 2 classes : UpdateStudentPedagogicalProfileDto
    │   │   │                                          # et UpdateTeacherPedagogicalProfileDto
    │   │   └── create-internal-note.dto.ts            # { content: string, max 5000 chars }
    │   └── entities/
    │       ├── administrative-profile.entity.ts       # Table "administrative_profiles" — PK = userId (UUID de identity-access-service)
    │       │                                          # Champs : name, DOB, phone, address, avatarUrl
    │       ├── student-pedagogical-profile.entity.ts  # Table "student_pedagogical_profiles" — PK = userId
    │       │                                          # Champs : niveauScolaire, matieres (simple-array),
    │       │                                          # objectifsPedagogiques, besoinsSpecifiques
    │       ├── teacher-pedagogical-profile.entity.ts  # Table "teacher_pedagogical_profiles" — PK = userId
    │       │                                          # Champs : niveauxEnseignes, matieresEnseignees,
    │       │                                          # experiencePedagogique, resultatsTests, isAnimateurPedagogique
    │       └── internal-profile-note.entity.ts        # Table "internal_profile_notes" — PK = UUID auto
    │                                                  # Champs : targetUserId, authorId, authorRole, content (text)
    │                                                  # Append-only (pas de updatedAt)
    │
    ├── relations/
    │   ├── relations.module.ts        # JwtModule async + 3 entités relation
    │   ├── relations.controller.ts    # 6 routes sous /relations
    │   ├── relations.service.ts       # Logique métier + guards d'accès par méthode
    │   ├── relations.service.spec.ts  # Tests unitaires Jest (20+ cas)
    │   ├── dto/
    │   │   ├── create-finance-owner-student-link.dto.ts   # { financeOwnerId, studentId }
    │   │   ├── create-teacher-student-link.dto.ts         # { teacherId, studentId, isPrincipalTeacher? }
    │   │   └── create-pedagogical-coordinator-link.dto.ts # { coordinatorId, studentId, coordinatorRole }
    │   └── entities/
    │       ├── finance-owner-student-link.entity.ts       # Table "finance_owner_student_links"
    │       │                                              # Unique(financeOwnerId, studentId)
    │       ├── teacher-student-link.entity.ts             # Table "teacher_student_links"
    │       │                                              # Unique(teacherId, studentId) ; isPrincipalTeacher boolean
    │       └── pedagogical-coordinator-link.entity.ts     # Table "pedagogical_coordinator_links"
    │                                                      # Unique(coordinatorId, studentId) ; coordinatorRole string
    │
    ├── internal/
    │   ├── internal.module.ts         # Pas de JwtModule ; InternalGuard uniquement
    │   │                              # TypeORM sur toutes les 6 entités
    │   ├── internal.controller.ts     # 5 routes sous /internal — exclu de Swagger (@ApiExcludeController)
    │   ├── internal.service.ts        # Upserts idempotents pour profils ; détection de conflits pour relations
    │   └── internal.guard.ts          # Vérifie header x-internal-secret contre INTERNAL_SECRET
    │                                  # Si env var absente → warning + autorise tout
    │
    ├── user-profile/                  # SCAFFOLD OBSOLÈTE — placeholder vide à supprimer
    │   ├── user-profile.module.ts     # @Module({}) vide
    │   ├── user-profile.controller.ts # @Controller() vide
    │   ├── user-profile.service.ts    # @Injectable() vide
    │   └── entities/
    │       └── user-profile.entity.ts # Entité "user_profiles" — non enregistrée dans AppModule, inutilisée
    │
    └── test/
        ├── jest-e2e.json              # Config Jest e2e, rootDir=test, runInBand
        └── e2e/
            ├── helpers/app.helper.ts  # createTestApp() : testcontainers (PostgreSqlContainer) + fallback DB locale
            │                          # dataSource.synchronize(true) — recrée le schéma entre suites
            ├── health.e2e-spec.ts     # 2 tests : 200 + timestamp ISO
            ├── profiles.e2e-spec.ts   # 20+ tests : CRUD, guards, accès par rôle, notes internes, 404
            ├── relations.e2e-spec.ts  # 20+ tests : 5 routes relation, multi-élève parent, PROF-TEST-001/002
            └── internal.e2e-spec.ts   # 15+ tests : sécurité InternalGuard, idempotence, 400/409
```

---

## Routes HTTP exposées

### Routes publiques

| Méthode | Chemin  | Description                                             | Auth   |
|---------|---------|---------------------------------------------------------|--------|
| GET     | /health | Health check — retourne { status, service, timestamp } | Aucune |

### Profiles (`/profiles`) — Bearer JWT requis

| Méthode | Chemin                           | Description                                                                      | Rôles autorisés          |
|---------|----------------------------------|----------------------------------------------------------------------------------|--------------------------|
| GET     | /profiles/:userId                | Lire le profil complet (admin + pédagogique). Filtrage selon rôle de l'acteur.   | Tous (avec restrictions) |
| PUT     | /profiles/:userId/administrative | Upsert du profil administratif (nom, adresse, téléphone, avatar)                 | Tous (propre) + RP/TI/AdminFin (tous) |
| PUT     | /profiles/:userId/pedagogical    | Upsert du profil pédagogique. Duck-typing élève vs formateur sur le DTO          | Tous (propre) + RP/TI (tous) |
| GET     | /profiles/:userId/internal-notes | Lister les notes internes sur un utilisateur (PROF-FB-002), les plus récentes en premier | RP, AdminFin uniquement |
| POST    | /profiles/:userId/internal-notes | Ajouter une note interne (append-only, max 5000 chars)                           | RP, AdminFin uniquement |
| POST    | /profiles/:teacherId/ap-status   | Promouvoir un formateur en Animateur Pédagogique (PROF-BR-008). Publie `TeacherPromotedToPedagogicalAnimator` | RP uniquement |

### Relations (`/relations`) — Bearer JWT requis

| Méthode | Chemin                                         | Description                                                             | Rôles autorisés              |
|---------|------------------------------------------------|-------------------------------------------------------------------------|------------------------------|
| POST    | /relations/finance-owner-student               | Créer lien financeur→élève. 409 si doublon. Publie `StudentLinkedToFinanceOwner` | RP, AdminFin |
| GET     | /relations/finance-owner-student/:financeOwnerId | Lister les élèves d'un financeur                                      | RP, AdminFin, TI, ou le financeur lui-même |
| POST    | /relations/teacher-student                     | Créer lien formateur→élève (PROF-BR-007). 409 si doublon. Publie `TeacherLinkedToStudent` | RP uniquement |
| GET     | /relations/teacher-student/:studentId          | Lister les formateurs d'un élève. Formateur voit seulement son propre lien (PROF-FB-003) | RP, TI, l'élève, formateur lié |
| POST    | /relations/pedagogical-coordinator             | Assigner RP ou AP comme coordinateur d'un élève. 409 si doublon. Publie `CoordinatorLinkedToStudent` | RP uniquement |
| GET     | /relations/pedagogical-coordinator/:coordinatorId | Lister les élèves d'un coordinateur                               | RP, TI, le coordinateur lui-même |

### Routes internes (`/internal`) — header x-internal-secret requis

Exclues de Swagger. Destinées aux appels inter-services depuis `orchestration-service`.

| Méthode | Chemin                                   | Description                                                             |
|---------|------------------------------------------|-------------------------------------------------------------------------|
| POST    | /internal/create-student-profiles        | Upsert idempotent profil admin + pédagogique élève                      |
| POST    | /internal/create-teacher-profiles        | Upsert idempotent profil admin + pédagogique formateur                  |
| POST    | /internal/link-parent                    | Créer lien financeur→élève. 409 si doublon                              |
| POST    | /internal/create-teacher-student-relation | Créer lien formateur→élève. 409 si doublon                             |
| POST    | /internal/link-coordinator               | Assigner coordinateur à un élève. 409 si doublon                        |

---

## Décisions techniques visibles dans le code

- **Pas de Passport — JWT manuel.** `JwtAuthGuard` vérifie directement le Bearer token via `@nestjs/jwt`. Requiert `type: 'access'`. Peuple `request.user` avec `{id, email, role, validationStatus, jti}`.
- **userId comme clé primaire.** Toutes les entités profil utilisent le `userId` d'`identity-access-service` comme PK directe — pas de clé surrogat sur les tables profil.
- **Endpoint `getProfile` retourne un payload composite.** `GET /profiles/:userId` retourne `{userId, administrative, pedagogical}` — `pedagogical` est le profil élève OU formateur (union, pas les deux).
- **Duck-typing pour `updatePedagogical`.** La distinction élève/formateur repose sur la présence de champs comme `niveauScolaire`, `objectifsPedagogiques` ou `besoinsSpecifiques` — fragile si des champs sont ajoutés plus tard.
- **Stub EventsService.** Log JSON structuré en console phase 1 ; interface prête pour RabbitMQ/Kafka en phase 2.
- **InternalGuard à défaillance ouverte.** Si `INTERNAL_SECRET` absent, loggue un warning et laisse passer — risque en prod.
- **TypeORM `synchronize: true` hors production.** Pas de fichiers de migration.
- **Tests e2e via testcontainers + fallback DB locale.** `createTestApp()` tente un container PostgreSQL, sinon utilise une DB locale. Schéma recréé entre suites.

---

## Points en suspens

### Code
- **`src/user-profile/` est un scaffold mort** — entité, controller, service, module et DTOs non utilisés. À supprimer.
- **`service: 'user-profile-service'`** dans la réponse `/health` — incohérence avec le nom canonique `profile-service`.

### Fonctionnel
- **Pas de `DELETE` sur les relations** — impossible de délier un financeur, un formateur ou un coordinateur d'un élève via l'API publique.
- **`isPrincipalTeacher` non enforced en base** — pas de contrainte unique sur `(studentId, isPrincipalTeacher=true)` — plusieurs PP possibles par élève.
- **`updatePedagogical` duck-typing fragile** — un discriminant explicite (`profileType: 'student' | 'teacher'`) serait plus sûr.
- **`isAnimateurPedagogique` écrivable via PUT pedagogical** — un formateur pourrait se promouvoir lui-même en contournant la route RP-only `/ap-status`.
- **Pas de lookup inverse financeur→élève** — `GET /relations/finance-owner-student/:financeOwnerId` existe, mais pas `GET /relations/finance-owner-student?studentId=...`.
- **`parent_financeur` ne peut pas appeler `GET /relations/teacher-student/:studentId`** — lève 403 alors que l'architecture prévoit que le parent voit tout ce qui concerne ses élèves (sauf carnet personnel).

### Sécurité
- **`InternalGuard` à défaillance ouverte** — doit passer en mode hard-fail si `INTERNAL_SECRET` est absent en staging/prod.
- **Pas de système de migrations** — `synchronize: true` en développement, aucun fichier de migration.

### Tests
- **Fallback DB locale à supprimer** une fois que Testcontainers a accès à Docker en CI.
- **`isAnimateurPedagogique` bypass non testé** dans les suites e2e actuelles.
