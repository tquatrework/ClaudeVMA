# Rapport test-writer — orchestration-service — 2026-06-18

## État avant intervention

**10 suites de tests — 58 tests — tous verts**

### Critères d'acceptance couverts avant intervention

| ID critère | Fichier de test | Description |
|---|---|---|
| ORCH-WS-001 à 004 | `test/unit/common/guards/webhook-secret.guard.spec.ts` | Guard webhook secret (header correct/absent/incorrect/env absente) |
| ORCH-MW-001 à 003 | `test/unit/common/middleware/correlation.middleware.spec.ts` | Middleware de corrélation |
| ORCH-CB-001 à 005 | `test/unit/callback/callback.controller.spec.ts` | Contrôleur de callbacks externes |
| ORCH-CMD-001 à 006 | `test/unit/command/command.service.spec.ts` | Service de dispatch de commandes + findByCorrelation |
| ORCH-EVT-001 à 004 | `test/unit/event/event.service.spec.ts` | Service d'événements (record, markProcessed, findByCorrelation) |
| ORCH-TRACE-001 à 004 | `test/unit/correlation/correlation-trace.service.spec.ts` | Service de traces de corrélation |
| ORCH-HTTP-001 à 006 | `test/unit/http-client/http-client.service.spec.ts` | Client HTTP inter-services |
| ORCH-WF-ENGINE-001 à 007 | `test/unit/workflow/workflow-engine.service.spec.ts` | Moteur de workflow (start, execute, compensation, skip optional, idempotence, retry) |
| ORCH-WF-ENGINE-008/009 | `test/unit/workflow/workflow-engine.service.spec.ts` | suspendForArbitration / resumeAfterArbitration (présents mais sans libellé ID) |
| ORCH-WF-001 à 010 | `test/unit/workflow/workflow.controller.spec.ts` | Contrôleur de workflows (start, getOne, suspend, resume, listDefinitions) |
| — | `test/unit/idempotency/idempotency.service.spec.ts` | Service d'idempotence (check, register, expiration) |

### Critères sans test avant intervention

- Aucun test pour `CommandController` (POST /commands)
- Aucun test pour `EventController` (GET /events/:correlationId)
- Aucun test pour `HealthController` (GET /health) — contrat technique `/health` non couvert
- Identifiants ORCH-WF-ENGINE-008/009 absents des descriptions dans le fichier moteur

---

## Tests ajoutés

### 1. `test/unit/command/command.controller.spec.ts` — *créé*

| Cas testé | Critère lié |
|---|---|
| dispatch délègue au service et retourne le résultat en succès | ORCH-CMD-001 (côté contrôleur) |
| dispatch passe l'échec du service sans altération | ORCH-CMD-002 (côté contrôleur) |
| dispatch retourne la commande cached quand la clé existe | ORCH-CMD-003 (côté contrôleur) |

### 2. `test/unit/event/event.controller.spec.ts` — *créé*

| Cas testé | Critère lié |
|---|---|
| findByCorrelation retourne les événements avec count (liste non vide) | ORCH-EVT-004 (côté contrôleur) |
| findByCorrelation retourne liste vide et count=0 quand aucun match | Cas limite |
| findByCorrelation retourne CONSUMED et PUBLISHED dans la même réponse | ORCH-EVT-001/002 (côté contrôleur) |

### 3. `test/unit/health/health.controller.spec.ts` — *créé*

| Cas testé | Critère lié |
|---|---|
| GET /health retourne `{status: 'ok', service: 'orchestration-service'}` | Contrat technique `/health` (microservices.md) |

### 4. `test/unit/workflow/workflow-engine.service.spec.ts` — *modifié*

- Séparation des blocs `describe` pour isoler `ORCH-WF-ENGINE-008` (suspendForArbitration) et `ORCH-WF-ENGINE-009` (resumeAfterArbitration)
- Ajout d'un test pour `resumeAfterArbitration` avec `tiOverride: false` (cas par défaut — critère ORCH-WF-ENGINE-009 côté non-TI)

---

## Résultat après intervention

```
Test Suites: 13 passed, 13 total
Tests:       66 passed, 66 total
Snapshots:   0 total
Time:        ~8.3 s
```

**+3 suites créées, +8 tests ajoutés, 0 régression.**

---

## Critères non couverts (code ne permet pas de les tester)

Aucun. Tous les critères d'acceptance listés dans `docs/acceptance-criteria.md` pour `orchestration-service` sont désormais couverts par au moins un test unitaire.

### Note sur les critères de haut niveau (spécification service)

Les critères métiers de `orchestration-service.md` (`acceptanceCriteria`) sont couverts indirectement :

| Critère spec | Couverture |
|---|---|
| Workflow expose un état consultable et relancable sans doublon | ORCH-WF-004/005 + ORCH-CMD-003 (idempotence) |
| Inscription client ne devient membre qu'après conditions finance/legal | ORCH-WF-ENGINE-003/004/005 (étapes optionnelles) |
| Correction non prise crée activité non pourvue (phase 3) | Hors périmètre phase 1 — pas de workflow correspondant implémenté |
| Workflows respectent les phases | ORCH-WF-010 (4 workflows phase 1 présents) |
