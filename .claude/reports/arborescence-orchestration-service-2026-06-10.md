# Arborescence — orchestration-service (2026-06-10)

**Branche :** feat/phase1-canonical-services
**Stack :** NestJS 10 / TypeORM 0.3 / PostgreSQL

---

## Arborescence complète avec descriptions

```
services/orchestration-service/
├── Dockerfile                          # Build multi-stage Node 20 Alpine ; HEALTHCHECK sur /health
├── nest-cli.json
├── package.json                        # Dépendances ; scripts build/start/test/test:e2e
├── tsconfig.json                       # ES2021, strictNullChecks désactivé, noImplicitAny désactivé
├── .env.example                        # Variables d'environnement attendues
├── CLAUDE.md
│
└── src/
    ├── main.ts                         # Bootstrap NestJS ; ValidationPipe globale ; Swagger sur /api/docs ; port $PORT (défaut 3000)
    ├── app.module.ts                   # Module racine ; TypeORM async (PostgreSQL) ; CorrelationMiddleware sur toutes les routes
    │
    ├── health/
    │   ├── health.controller.ts        # GET /health → { status: "ok", service: "orchestration-service" } — NON authentifié
    │   └── health.module.ts
    │
    ├── workflow/
    │   ├── workflow.controller.ts      # Routes CRUD + lifecycle des instances de workflow
    │   ├── workflow.module.ts          # Importe JwtModule, HttpClientModule, IdempotencyModule, EventModule, CorrelationTraceModule
    │   ├── workflow-engine.service.ts  # Moteur d'exécution séquentielle, retry, compensation saga, suspend/resume
    │   ├── dto/
    │   │   └── start-workflow.dto.ts   # workflowType, payload, initiatedBy?, correlationId?
    │   ├── entities/
    │   │   ├── workflow-instance.entity.ts   # Table "workflow_instances" — type, correlationId (UNIQUE), status, payload (jsonb), context (jsonb), error, initiatedBy
    │   │   ├── workflow-step.entity.ts       # Table "workflow_steps" — order, name, targetService, action, status, input/output (jsonb), idempotencyKey
    │   │   ├── compensation-action.entity.ts # Table "compensation_actions" — status : pending/completed/failed
    │   │   └── retry-policy.entity.ts        # Table "retry_policies" — trace de chaque tentative échouée
    │   └── definitions/
    │       ├── workflow-definition.interface.ts    # Interfaces WorkflowContext, RetryConfig, WorkflowStepDefinition, WorkflowDefinition
    │       ├── index.ts                            # Registre WORKFLOW_DEFINITIONS (Record<string, WorkflowDefinition>)
    │       ├── student-onboarding.workflow.ts      # 5 étapes — inscription élève
    │       ├── teacher-onboarding.workflow.ts      # 5 étapes — inscription formateur
    │       ├── teacher-request.workflow.ts         # 7 étapes — demande prof → affectation
    │       └── video-session.workflow.ts           # 6 étapes — planification visio
    │
    ├── command/
    │   ├── command.controller.ts       # POST /commands — dispatch de commande idempotente
    │   ├── command.module.ts
    │   ├── command.service.ts          # Vérif idempotence → appel HTTP → enregistrement résultat
    │   ├── dto/
    │   │   └── dispatch-command.dto.ts # targetService, action, payload, idempotencyKey, correlationId?
    │   └── entities/
    │       └── integration-command.entity.ts  # Table "integration_commands"
    │
    ├── event/
    │   ├── event.controller.ts         # GET /events/:correlationId — lecture de l'historique
    │   ├── event.module.ts
    │   ├── event.service.ts            # record(), markProcessed(), findByCorrelation()
    │   └── entities/
    │       └── integration-event.entity.ts   # Table "integration_events" ; enum direction : consumed|published
    │
    ├── callback/
    │   ├── callback.controller.ts      # POST /callbacks/:provider — webhook externe, NON authentifié
    │   └── callback.module.ts
    │
    ├── idempotency/
    │   ├── idempotency.module.ts
    │   ├── idempotency.service.ts      # check() avec TTL, register() via upsert (défaut 24h)
    │   └── entities/
    │       └── idempotency-key.entity.ts  # Table "idempotency_keys" — PK = key ; responseSnapshot (jsonb) ; expiresAt
    │
    ├── correlation/
    │   ├── correlation-trace.module.ts
    │   ├── correlation-trace.service.ts  # record() + findByCorrelation() ; trace isTiOverride
    │   └── entities/
    │       └── correlation-trace.entity.ts  # Table "correlation_traces" — index sur correlationId ; entityType, action, metadata (jsonb), actor, isTiOverride
    │
    ├── http-client/
    │   ├── http-client.module.ts       # @nestjs/axios avec timeout 10 000 ms
    │   └── http-client.service.ts      # Résolution URL par service via env vars ; appelle POST /internal/<action>
    │                                   # Headers : x-correlation-id, x-idempotency-key, x-internal-secret
    │                                   # Graceful skip si URL absente (non-prod)
    │
    └── common/
        ├── guards/
        │   └── jwt-auth.guard.ts       # JwtAuthGuard : vérifie Bearer token, type='access', injecte req.user
        ├── middleware/
        │   └── correlation.middleware.ts  # Lit x-correlation-id (ou génère un UUID) et le propage en réponse
        └── enums/
            ├── workflow-status.enum.ts  # PENDING | IN_PROGRESS | COMPLETED | FAILED | COMPENSATING | COMPENSATED | NEEDS_ARBITRATION
            └── step-status.enum.ts      # PENDING | IN_PROGRESS | COMPLETED | FAILED | SKIPPED | COMPENSATED

test/
├── jest-e2e.json                    # Config Jest e2e ; timeout 60s
├── e2e/
│   ├── helpers/app.helper.ts        # createTestApp() sur PostgreSQL local (orchestration_test) ; makeJwt() ; IDS
│   ├── health.e2e-spec.ts
│   ├── workflows.e2e-spec.ts        # 5 routes WorkflowController
│   ├── commands.e2e-spec.ts         # POST /commands (auth + validation + idempotence)
│   ├── events.e2e-spec.ts           # GET /events/:correlationId
│   └── callbacks.e2e-spec.ts        # POST /callbacks/:provider (route publique)
└── unit/
    └── (suites par module : workflow-engine, command, event, callback, correlation, http-client, idempotency, correlation-middleware)
```

---

## Routes HTTP exposées

| Méthode | Chemin                                     | Description                                                                          | Auth       |
|---------|--------------------------------------------|--------------------------------------------------------------------------------------|------------|
| GET     | /health                                    | Health check — { status: "ok", service: "orchestration-service" }                   | Aucune     |
| GET     | /workflows                                 | Lister les types de workflows disponibles (id, name, phase, stepCount)               | Bearer JWT |
| POST    | /workflows/:workflowId/start               | Démarrer un workflow. Exécution async via `setImmediate`. Retourne l'instance créée.  | Bearer JWT |
| GET     | /workflows/:workflowInstanceId             | Lire l'état d'une instance (instance + steps ordonnés)                               | Bearer JWT |
| POST    | /workflows/:workflowInstanceId/suspend     | Suspendre un workflow en `NEEDS_ARBITRATION` (ORCH-BR-006). Body : { reason }        | Bearer JWT |
| POST    | /workflows/:workflowInstanceId/resume      | Reprendre après arbitrage. Body : { tiOverride?: boolean } — tracé en base           | Bearer JWT |
| POST    | /commands                                  | Émettre une commande idempotente vers un service cible                               | Bearer JWT |
| GET     | /events/:correlationId                     | Historique chronologique des événements pour un correlationId                         | Bearer JWT |
| POST    | /callbacks/:provider                       | Point d'entrée générique pour webhooks externes                                       | Aucune     |
| GET     | /api/docs                                  | Swagger UI                                                                           | Aucune     |

---

## Définitions de workflows (Phase 1)

### `student-onboarding` — 5 étapes
| # | Étape | Service | Action | Optionnel | Compensation |
|---|-------|---------|--------|-----------|-------------|
| 1 | create-student-account | identity-access-service | create-account | non | delete-account |
| 2 | create-student-profiles | profile-service | create-student-profiles | non | delete-profiles |
| 3 | link-parent | profile-service | link-parent | **oui** | — |
| 4 | init-dashboard | dashboard-notification-service | init-dashboard | non | — |
| 5 | init-messaging | communication-service | init-messaging | non | — |

### `teacher-onboarding` — 5 étapes
| # | Étape | Service | Action | Optionnel |
|---|-------|---------|--------|-----------|
| 1 | create-teacher-account | identity-access-service | create-account | non |
| 2 | create-teacher-profiles | profile-service | create-teacher-profiles | non |
| 3 | init-financial-profile | finance-credit-service | init-teacher-financial-profile | **oui** |
| 4 | trigger-teacher-contract | legal-document-service | create-teacher-contract | **oui** |
| 5 | notify-rp-for-validation | dashboard-notification-service | notify-teacher-pending-validation | non |

### `teacher-request-to-assignment` — 7 étapes
| # | Étape | Service | Action | Optionnel |
|---|-------|---------|--------|-----------|
| 1 | record-teacher-request | teacher-request-service | create-request | non |
| 2 | notify-rp | dashboard-notification-service | notify-new-teacher-request | non |
| 3 | broadcast-to-teachers | teacher-request-service | broadcast-request | non |
| 4 | check-calendar-availability | calendar-service | check-availability | **oui** |
| 5 | create-assignment | teacher-request-service | create-assignment | non |
| 6 | create-teacher-student-relation | profile-service | create-teacher-student-relation | non |
| 7 | notify-all-parties | dashboard-notification-service | notify-teacher-assigned | non |

### `scheduled-video-course` — 6 étapes
| # | Étape | Service | Action | Optionnel |
|---|-------|---------|--------|-----------|
| 1 | schedule-activity | calendar-service | schedule-activity | non |
| 2 | create-video-room | video-session-service | create-session | non |
| 3 | notify-participants | dashboard-notification-service | notify-session-scheduled | non |
| 4 | trace-session-end | video-session-service | register-end-hook | non |
| 5 | prompt-pedagogical-log | pedagogical-log-service | create-log-entry-placeholder | non |
| 6 | debit-credits | finance-credit-service | reserve-credits | **oui** |

---

## Décisions techniques visibles dans le code

- **Saga séquentielle dans `setImmediate`** : l'exécution est lancée dans le même processus Node sans queue distribuée. Un redémarrage en cours laisse l'instance bloquée en `IN_PROGRESS` sans reprise automatique.
- **Compensation saga** : chaque étape réussie avec un `compensationAction` génère une `CompensationAction`. En cas d'échec d'une étape requise, les compensations sont rejouées en ordre inverse (`registeredAt DESC`).
- **Idempotence à deux niveaux** : table `idempotency_keys` (TTL 24h) consultée avant tout appel HTTP ; clés de step préfixées `wf:<instanceId>:step:<order>`.
- **HTTP interne** : `HttpClientService` appelle `POST /internal/<action>` sur chaque service avec `x-correlation-id`, `x-idempotency-key`, `x-internal-secret`. Si l'URL est absente (dev), l'étape est marquée `COMPLETED` avec `{ skipped: true }`.
- **JwtAuthGuard local** : vérifie le JWT sans appel réseau. `JWT_SECRET` partagé par configuration. Contrôle `type: 'access'`.
- **CorrelationId** : propagé via middleware HTTP et stocké sur chaque instance, step, event et trace. Généré automatiquement si absent.
- **Arbitrage TI** : `suspend` / `resume` sont des endpoints métier ; `isTiOverride` tracé en base dans `correlation_traces` — conformément à la règle "le forçage TI doit être audité".
- **TypeORM `synchronize`** : actif hors production. Pas de migrations.
- **Swagger** : documenté sur `/api/docs`, `@ApiTags`, `@ApiOperation`, `@ApiResponse` sur chaque contrôleur.

---

## Points en suspens

### Critique
1. **Exécution en mémoire** : un redémarrage pod pendant un workflow laisse celui-ci bloqué. Pas de job de récupération des instances bloquées (`stuck workflows`).
2. **Pas de migrations TypeORM** : `synchronize: true` en dev/test, incompatible avec CI/CD.
3. **`strictNullChecks: false` et `noImplicitAny: false`** — sécurité TypeScript réduite.

### Fonctionnel
4. **Pas de liste des instances** — `GET /workflows` liste les *types*, pas les instances actives/échouées.
5. **Pas de route de retry manuel** — un workflow `FAILED` ne peut pas être relancé via l'API.
6. **Compensations non définies** pour la plupart des étapes des workflows 3 et 4.
7. **CORS ouvert** (`app.enableCors()`) — aucune restriction d'origine.
8. **Callbacks non authentifiés** — `/callbacks/:provider` est public sans vérification de signature webhook (HMAC).
9. **Pas de contrôle de rôle dans `JwtAuthGuard`** — n'importe quel rôle (élève inclus) peut déclencher un workflow ou forcer un `tiOverride`.
10. **`workflow_instances.correlationId` UNIQUE** — collision non interceptée proprement (pas de 409 HTTP explicite).
11. **Pas de timeout au niveau workflow** — une instance `NEEDS_ARBITRATION` peut rester bloquée indéfiniment.

### Infrastructure
12. **Tests e2e requièrent une base PostgreSQL locale** (`orchestration_test`, user `visiomath`) non automatisée.
13. **Timeout HTTP fixe à 10 000 ms** — pas configurable par service cible.
