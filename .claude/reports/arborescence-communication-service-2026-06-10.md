# Arborescence — communication-service (2026-06-10)

## Arborescence complète avec descriptions

```
services/communication-service/
├── .env.example                                   # Variables requises : DATABASE_URL, JWT_SECRET, INTERNAL_SECRET, PORT
├── CLAUDE.md                                      # Contexte agent : pointe vers docs/services/communication-service.md
├── Dockerfile                                     # Build multi-stage Node 20 Alpine, EXPOSE 3000, HEALTHCHECK sur /health
├── nest-cli.json                                  # Config NestJS CLI, sourceRoot=src, deleteOutDir=true
├── package.json                                   # Dépendances NestJS 10 + TypeORM 0.3 + Swagger + class-validator
├── package-lock.json                              # Lockfile npm
├── tsconfig.json                                  # Config TypeScript, target ES2021
├── src/
│   ├── main.ts                                    # Point d'entrée : ValidationPipe global, CORS, Swagger sur /api/docs
│   ├── app.module.ts                              # Module racine : ConfigModule + TypeORM (PostgreSQL) + 5 modules métier
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts          # @CurrentUser() — extrait le payload JWT de la requête
│   │   │   └── roles.decorator.ts                 # @Roles(...) — déclare les rôles autorisés sur une route
│   │   ├── enums/
│   │   │   └── user-role.enum.ts                  # Enum UserRole : eleve, parent, formateur, rp, ap, ti, admin_financier
│   │   └── guards/
│   │       ├── jwt-auth.guard.ts                  # JwtAuthGuard — vérifie et décode le JWT (pattern pedagogical-log-service)
│   │       └── roles.guard.ts                     # RolesGuard — contrôle d'accès par rôle via @Roles()
│   ├── health/
│   │   ├── health.module.ts                       # Module health minimaliste
│   │   └── health.controller.ts                   # GET /health → { status: "ok", service, timestamp }
│   ├── conversation/                              # Threads de messagerie et messages
│   │   ├── conversation.module.ts                 # Module NestJS : Conversation + Message + controller + service
│   │   ├── conversation.controller.ts             # Routes /conversations et /conversations/:id/messages
│   │   ├── conversation.service.ts                # Logique : création, liste filtrée par participant, envoi/lecture messages
│   │   ├── dto/
│   │   │   ├── create-conversation.dto.ts         # DTO création : participantIds (UUID[]), optional title
│   │   │   └── send-message.dto.ts                # DTO message : content (string), optional isSystem (bool)
│   │   └── entities/
│   │       ├── conversation.entity.ts             # Entité TypeORM "conversations" : id (UUID), participantIds (text[]),
│   │       │                                      #   isIncident (bool), title?, timestamps
│   │       └── message.entity.ts                  # Entité TypeORM "messages" : id (UUID), conversationId (FK),
│   │                                              #   senderId, content, isSystem, isRead, timestamps
│   ├── contact/                                   # Politique de contacts autorisés
│   │   ├── contact.module.ts                      # Module NestJS : ContactPolicy + service (pas de controller propre)
│   │   ├── contact.service.ts                     # canCommunicate() : vérifie ContactPolicy avant envoi de message
│   │   ├── dto/
│   │   │   └── sync-contacts.dto.ts               # DTO sync : userId, contacts[] { contactId, expiresAt? }
│   │   └── entities/
│   │       └── contact-policy.entity.ts           # Entité TypeORM "contact_policies" : userId, contactId,
│   │                                              #   expiresAt? (fenêtre temporelle parent-formateur), timestamps
│   ├── incident/                                  # Fils d'incident TI
│   │   ├── incident.module.ts                     # Module NestJS : IncidentThread + controller + service
│   │   ├── incident.controller.ts                 # Routes /incidents : POST, GET :id, PATCH :id/status
│   │   ├── incident.service.ts                    # Logique : création incident, mise à jour statut
│   │   ├── dto/
│   │   │   ├── create-incident.dto.ts             # DTO création : subject, description, relatedUserId?
│   │   │   └── update-incident-status.dto.ts      # DTO statut : status (enum open/in_progress/resolved/closed)
│   │   └── entities/
│   │       └── incident-thread.entity.ts          # Entité TypeORM "incident_threads" : id (UUID), subject,
│   │                                              #   description, status (enum), reporterId, relatedUserId?, timestamps
│   ├── internal/                                  # Endpoint interservice (non exposé publiquement)
│   │   ├── internal.module.ts                     # Module NestJS : importe ContactModule
│   │   └── internal.controller.ts                 # POST /internal/sync-contacts (X-Internal-Secret) —
│   │                                              #   initialise/met à jour les contacts autorisés depuis l'orchestrateur
│   └── communication/                             # Résidu du scaffold initial (à nettoyer)
│       ├── communication.module.ts                # Module plat pré-refacto (remplacé par conversation + contact)
│       ├── communication.controller.ts            # Routes /messages ancienne génération
│       ├── communication.service.ts               # Service ancienne génération
│       ├── dto/
│       │   └── send-message.dto.ts                # DTO ancienne génération
│       └── entities/
│           └── message.entity.ts                  # Entité ancienne génération (duplique conversation/entities/message)
└── test/
    └── e2e/
        ├── helpers/
        │   └── app.helper.ts                      # Bootstrap du module de test avec SQLite en mémoire
        ├── health.e2e-spec.ts                     # Tests e2e : GET /health
        └── communication.e2e-spec.ts              # Tests e2e : 46 cas — COM-BR-010, COM-FB-001/002/003, COM-RA-006,
                                                   #   création conversation, envoi message, incidents, sync contacts
```

## Routes HTTP exposées

| Méthode | Chemin                                   | Description                                                            | Auth / Guard          |
|---------|------------------------------------------|------------------------------------------------------------------------|-----------------------|
| GET     | /health                                  | Health check — `{ status: "ok", service, timestamp }`                 | Aucun                 |
| POST    | /conversations                           | Créer une nouvelle conversation entre participants autorisés           | JwtAuthGuard          |
| GET     | /conversations                           | Lister les conversations de l'utilisateur connecté                     | JwtAuthGuard          |
| POST    | /conversations/:id/messages              | Envoyer un message dans une conversation                               | JwtAuthGuard          |
| GET     | /conversations/:id/messages              | Lister les messages d'une conversation (accès participant uniquement)  | JwtAuthGuard          |
| PATCH   | /conversations/:id/messages/:msgId/read  | Marquer un message comme lu                                            | JwtAuthGuard          |
| GET     | /contacts                                | Lister les contacts autorisés de l'utilisateur connecté                | JwtAuthGuard          |
| POST    | /incidents                               | Créer un fil d'incident TI                                             | JwtAuthGuard + Roles  |
| GET     | /incidents/:id                           | Lire un incident                                                       | JwtAuthGuard + Roles  |
| PATCH   | /incidents/:id/status                    | Mettre à jour le statut d'un incident                                  | JwtAuthGuard + Roles(ti) |
| POST    | /internal/sync-contacts                  | Synchroniser les contacts autorisés (interservice, X-Internal-Secret)  | InternalGuard (secret header) |
| GET     | /api/docs                                | Interface Swagger UI (auto-générée)                                    | Aucun                 |

## Décisions techniques

### Architecture des modules
- 4 modules métier distincts : `conversation`, `contact`, `incident`, `internal`.
- `contact` n'expose pas de controller propre — son service `canCommunicate()` est utilisé par `ConversationService` avant tout envoi de message (COM-BR-010).
- `internal` expose un unique endpoint sécurisé par header `X-Internal-Secret` (pas de JWT) pour les appels interservices de l'orchestrateur.

### Modèle de données
- `conversations.participantIds` stocké en `text[]` (tableau PostgreSQL natif) — évite une table de jointure `conversation_participants`.
- `contact_policies.expiresAt` nullable : fenêtre temporelle pour la relation parent-formateur (expire après fin de prestation).
- `incident_threads.status` : enum `open | in_progress | resolved | closed`.
- 4 tables physiquement distinctes : `conversations`, `messages`, `contact_policies`, `incident_threads`.

### Sécurité
- `JwtAuthGuard` + `RolesGuard` répliqués de `pedagogical-log-service` sans modification.
- Endpoint `/internal/sync-contacts` protégé par `X-Internal-Secret` (variable `INTERNAL_SECRET` dans `.env`) — pas de JWT, conçu pour les appels machine-to-machine.
- `canCommunicate()` vérifie l'existence d'une `ContactPolicy` bidirectionnelle avant création de message.

### Résidu de scaffold
Le dossier `src/communication/` est un résidu du scaffold initial non supprimé lors de la refacto. Il est enregistré dans `app.module.ts` mais ses routes sont masquées par le nouveau module `conversation`. **À supprimer** lors d'un prochain passage de nettoyage.

### Tests
- 46 tests e2e avec SQLite en mémoire.
- Couverture : règles COM-BR-010 (contacts autorisés), COM-FB-001/002/003 (accès refusé), COM-RA-006 (incidents TI), erreurs 400/401/403/404.

### Docker
- Build multi-stage : stage `builder` (compile TypeScript), stage `production` (`npm ci --omit=dev`, `USER node`).
- Point d'entrée : `dist/src/main.js`.
- `HEALTHCHECK` Docker sur `/health` toutes les 30 s.

## Points en suspens

- **Résidu `src/communication/`** : module scaffold non supprimé, à nettoyer (duplique partiellement `conversation`).
- **COM-BR-007** (messages système automatiques) : champ `isSystem` présent sur `Message`, mais l'envoi automatique sur événement nécessite un event bus — phase 2.
- **COM-BR-009** (lien d'accord utilisateur) : dépend de `admin-observability-service` — phase 2.
- **Pagination** : les listes (`/conversations`, `/conversations/:id/messages`) ne sont pas paginées.
- **Propagation `x-correlation-id`** : non implémentée (contrat technique global du projet).
- **CORS** : activé globalement sans restriction de domaine — à configurer avant mise en production.
