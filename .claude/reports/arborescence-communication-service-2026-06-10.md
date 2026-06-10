# Arborescence — communication-service (2026-06-10)

## Arborescence complète avec descriptions

```
services/communication-service/
├── CLAUDE.md                                      # Contexte agent : pointe vers docs/services/communication-service.md
├── Dockerfile                                     # Build multi-stage Node 20 Alpine, EXPOSE 3000, HEALTHCHECK sur /health
├── nest-cli.json                                  # Config NestJS CLI, sourceRoot=src, deleteOutDir=true
├── package.json                                   # Déclaration du projet, scripts, dépendances NestJS + TypeORM + Swagger
├── tsconfig.json                                  # Config TypeScript, target ES2021, strictNullChecks désactivé
└── src/
    ├── main.ts                                    # Point d'entrée : crée l'app NestJS, active ValidationPipe, CORS et Swagger
    ├── app.module.ts                              # Module racine : ConfigModule global + TypeORM (PostgreSQL async) + CommunicationModule + HealthModule
    ├── communication/
    │   ├── communication.module.ts                # Module NestJS : enregistre l'entité Message, le controller et le service
    │   ├── communication.controller.ts            # Controller REST /messages : 3 routes (POST, GET, PATCH), décorateurs Swagger complets
    │   ├── communication.service.ts               # Service métier : send, findByConversation, markAsRead via TypeORM Repository
    │   ├── dto/
    │   │   └── send-message.dto.ts                # DTO d'envoi : conversationId, senderId, receiverId (UUIDs), content (string)
    │   └── entities/
    │       └── message.entity.ts                  # Entité TypeORM table "messages" : id (UUID PK), conversationId, senderId, receiverId, content (text), isRead (bool), sentAt (timestamp auto)
    └── health/
        ├── health.module.ts                       # Module NestJS minimal : déclare uniquement HealthController
        └── health.controller.ts                   # Controller GET /health : retourne { status, service, timestamp }
```

## Routes HTTP exposées

| Méthode | Chemin                                 | Description                                                         | Auth       |
|---------|----------------------------------------|---------------------------------------------------------------------|------------|
| GET     | /health                                | Health check — retourne { status: "ok", service, timestamp }       | Aucune     |
| POST    | /messages                              | Envoyer un message dans une conversation                            | Bearer JWT |
| GET     | /messages/conversation/:conversationId | Récupérer tous les messages d'une conversation, triés par date ASC  | Bearer JWT |
| PATCH   | /messages/:id/read                     | Marquer un message comme lu (isRead = true)                         | Bearer JWT |
| GET     | /api/docs                              | Interface Swagger UI (auto-générée)                                 | Aucune     |

## Décisions techniques visibles dans le code

### Stack et framework
- NestJS 10 avec TypeORM 0.3 sur PostgreSQL (connexion via DATABASE_URL).
- Swagger exposé sur /api/docs avec addBearerAuth() — documentation exploitable dès le démarrage.
- ValidationPipe global avec `{ whitelist: true, transform: true }` — champs inconnus silencieusement rejetés, types auto-castés.
- CORS activé globalement sans restriction de domaine.

### Modèle de données
- Un Message appartient à une conversation identifiée par UUID (conversationId). Il n'existe pas d'entité Conversation distincte — la conversation est implicite, portée uniquement par la clé UUID partagée.
- senderId et receiverId sont de simples UUIDs non contraints par FK — le service ne valide pas l'existence de ces IDs dans profile-service ou identity-access-service.
- `synchronize: true` en dehors de production — tables auto-migrées en dev/staging.

### Sécurité
- `@ApiBearerAuth()` est posé sur le controller mais aucun guard JWT n'est implémenté — les routes ne sont pas réellement protégées.
- Pas de validation que senderId correspond à l'utilisateur authentifié : un appelant peut envoyer un message au nom d'un autre utilisateur.

### Architecture
- Pas d'event bus ni de publication d'événements métier (ex. MessageSent) — intégration avec les autres services non câblée.
- Pas de pagination sur GET /messages/conversation/:id.
- @nestjs/jwt listé en dépendance mais non importé ni utilisé dans le code actuel.

### Docker
- Build multi-stage propre : stage builder (compile TypeScript), stage production (npm ci --omit=dev, USER node).
- HEALTHCHECK Docker sur `wget -qO- http://localhost:3000/health` toutes les 30 s.

## Points en suspens

- Guard JWT manquant : les routes /messages sont documentées comme protégées mais ne le sont pas réellement.
- Absence d'entité Conversation : pas de gestion du cycle de vie d'une conversation (création, liste, participants autorisés). La règle métier "contacts autorisés venant de profile-service" n'est pas encore implémentée.
- Pas de pagination sur la récupération de messages d'une conversation.
- Pas de tests : ni spec unitaire, ni test e2e présents dans le dépôt.
- @nestjs/jwt importé mais inutilisé : dépendance morte à nettoyer ou à câbler.
- CORS sans restriction : à configurer selon les domaines autorisés avant mise en production.
