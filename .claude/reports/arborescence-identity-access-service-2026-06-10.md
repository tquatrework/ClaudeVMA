# Arborescence — identity-access-service (2026-06-10)

## Arborescence complète avec descriptions

```
services/identity-access-service/
├── CLAUDE.md
├── Dockerfile                                     # Build multi-stage Node 20 Alpine, HEALTHCHECK, USER node
├── nest-cli.json
├── package.json                                   # Dépendances NestJS + TypeORM + bcrypt + JWT + Swagger
├── tsconfig.json                                  # strictNullChecks: false
└── src/                                           # ~45 fichiers sources
    ├── main.ts                                    # Bootstrap NestJS, ValidationPipe global, Swagger, CORS
    ├── app.module.ts                              # ConfigModule + TypeORM + AuthModule + AccountModule + ConsentModule + HealthModule + InternalModule
    ├── health/
    │   ├── health.module.ts
    │   └── health.controller.ts                   # GET /health
    ├── auth/
    │   ├── auth.module.ts
    │   ├── auth.controller.ts                     # POST /auth/login, POST /auth/refresh, POST /auth/logout
    │   ├── auth.service.ts                        # Vérifie identifiants, émet access + refresh tokens (dual-token JWT)
    │   ├── strategies/                            # Stratégies Passport (local + jwt)
    │   └── guards/                                # JwtAuthGuard vérifiant claim type=access
    ├── accounts/
    │   ├── accounts.module.ts
    │   ├── accounts.controller.ts                 # CRUD complet + changement de mot de passe
    │   ├── accounts.service.ts                    # Hachage bcrypt cost-12, passwordHash masqué par défaut
    │   └── entities/
    │       └── account.entity.ts                  # id, email, passwordHash (select:false), role, status, createdAt
    ├── consents/
    │   ├── consents.module.ts
    │   ├── consents.controller.ts                 # POST /consents + GET /consents/:accountId
    │   ├── consents.service.ts                    # Activation automatique du compte sur RGPD+CGU signés
    │   └── entities/
    │       └── consent.entity.ts                  # accountId, type (RGPD/CGU), signedAt
    ├── internal/
    │   ├── internal.module.ts
    │   └── internal.controller.ts                 # GET /internal/accounts/:id — protégé par shared-secret header
    └── events/
        └── events.service.ts                      # Stub EventsService : log en console, prêt pour event broker phase 2
```

## Routes HTTP exposées

| Méthode | Chemin                          | Description                                                        | Auth                  |
|---------|---------------------------------|--------------------------------------------------------------------|-----------------------|
| GET     | /health                         | Health check                                                       | Aucune                |
| POST    | /auth/login                     | Authentification — retourne access token + refresh token           | Aucune                |
| POST    | /auth/refresh                   | Renouveler l'access token via le refresh token                     | Refresh token         |
| POST    | /auth/logout                    | Invalider la session                                               | Bearer JWT (access)   |
| POST    | /accounts                       | Créer un compte (élève, parent, formateur)                         | Aucune                |
| GET     | /accounts/:id                   | Lire un compte                                                     | Bearer JWT            |
| PATCH   | /accounts/:id                   | Mettre à jour un compte                                            | Bearer JWT            |
| DELETE  | /accounts/:id                   | Supprimer un compte                                                | Bearer JWT            |
| POST    | /accounts/:id/change-password   | Changer le mot de passe                                            | Bearer JWT            |
| GET     | /accounts                       | Lister les comptes (admin)                                         | Bearer JWT            |
| POST    | /consents                       | Enregistrer un consentement RGPD ou CGU                            | Bearer JWT            |
| GET     | /consents/:accountId            | Lire les consentements d'un compte                                 | Bearer JWT            |
| GET     | /internal/accounts/:id          | Endpoint inter-services : récupérer un compte par ID              | Shared-secret header  |
| GET     | /api/docs                       | Swagger UI                                                         | Aucune                |

## Décisions techniques visibles dans le code

- **Dual-token JWT :** access token court (15 min) + refresh token long (7 j) ; claim `type=access` vérifié par `JwtAuthGuard`.
- **bcrypt cost-12 :** hachage des mots de passe, `passwordHash` masqué par défaut dans l'entité (`select: false`) avec `addSelect` explicite quand nécessaire.
- **Endpoint interne :** `/internal/accounts/:id` protégé par header `x-internal-secret` (variable `INTERNAL_SECRET`) — contournement du JWT pour les appels inter-services.
- **Stub EventsService :** publie en console uniquement (phase 1) ; remplacé par un broker réel en phase 2.
- **Activation automatique :** le compte passe en statut `active` automatiquement quand RGPD et CGU sont signés.
- **Audit log :** chaque mutation sensible est journalisée (service dédié ou intercepteur).
- **Docker :** build multi-stage, USER node, HEALTHCHECK.
- **TypeScript :** `strictNullChecks: false`.

## Points en suspens

- Endpoint `/internal/accounts/:id` non protégé si `INTERNAL_SECRET` est absent de l'environnement — à valider/durcir.
- `strictNullChecks: false` — erreurs null silencieuses possibles.
- Pas de vérification "self-consult" sur `GET /accounts/:id` : un utilisateur peut potentiellement consulter le compte d'un autre.
- Pas de flux "mot de passe oublié" / réinitialisation par email.
- Les consommateurs d'événements (AccountCreated, etc.) sont bloqués tant qu'aucun broker n'est câblé.
- Pas de tests e2e couvrant les consents et l'endpoint interne.
