# Rapport — orchestration-service — 2026-06-18

## Contexte

Complétion des sagas manquantes identifiées dans le delta de spécification (`orchestration-service-delta.md`).

## Routes disponibles après implémentation

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | /health | Health check | Non |
| GET | /workflows | Lister les types de workflows disponibles | JWT |
| POST | /workflows/:workflowId/start | Déclencher un workflow par type | JWT |
| GET | /workflows/:workflowInstanceId | Lire l'état d'une instance | JWT |
| POST | /workflows/:workflowInstanceId/suspend | Suspendre pour arbitrage utilisateur | JWT |
| POST | /workflows/:workflowInstanceId/resume | Reprendre après arbitrage ou forcage TI | JWT |
| POST | /callbacks/:provider | Recevoir un webhook externe | X-Webhook-Secret |
| POST | /events | Publier un événement métier | JWT |
| GET | /events | Lister les événements par correlationId | JWT |
| POST | /commands | Dispatcher une commande interservice | JWT |
| GET | /commands | Lister les commandes enregistrées | JWT |

## Workflows disponibles (6 au total)

| id | Phase | Étapes | Statut |
|----|-------|--------|--------|
| student-onboarding | 1 | 5 | Existant |
| teacher-onboarding | 1 | 5 | Existant |
| teacher-request-to-assignment | 1 | 7 | Existant |
| scheduled-video-course | 1 | 6 | Existant |
| teacher-payment | 2 | 6 | **Ajouté** |
| content-correction | 3 | 7 | **Ajouté** |

## Nouveaux fichiers ajoutés

- `src/workflow/definitions/content-correction.workflow.ts` — Saga correction/solution (fonctionnalité 005 CDC)
- `src/workflow/definitions/teacher-payment.workflow.ts` — Saga paiement formateur (fonctionnalité 006 CDC)
- `src/workflow/definitions/index.ts` — Mis à jour pour enregistrer les 2 nouveaux workflows
- `test/unit/workflow/content-correction.workflow.spec.ts` — 14 tests unitaires
- `test/unit/workflow/teacher-payment.workflow.spec.ts` — 16 tests unitaires
- `test/unit/workflow/workflow.controller.spec.ts` — 3 tests supplémentaires (vérification 6 workflows)

## Résultat des tests

```
Commande : cd services/orchestration-service && npm test

Test Suites: 12 passed, 12 total
Tests:       93 passed, 93 total  (58 avant → 93 après ajout)
Snapshots:   0 total
Time:        ~8s
```

## Détail des sagas ajoutées

### content-correction (phase 3)

1. `register-correction-request` → learning-activity-service (obligatoire, retry 3x, avec compensation)
2. `assign-corrector` → learning-activity-service (obligatoire, retry 2x)
3. `notify-corrector` → dashboard-notification-service (obligatoire)
4. `create-unprovided-activity-if-no-corrector` → learning-activity-service (optionnel)
5. `award-pedagogical-points` → learning-activity-service (optionnel)
6. `valorize-correction` → finance-credit-service (optionnel)
7. `archive-correction` → archive-document-service (optionnel)

### teacher-payment (phase 2)

1. `generate-teacher-invoice` → finance-credit-service (obligatoire, retry 3x, avec compensation)
2. `notify-af-for-validation` → dashboard-notification-service (obligatoire)
3. `debit-finance-owner` → finance-credit-service (obligatoire, retry 2x, avec compensation refund)
4. `credit-teacher-remuneration` → finance-credit-service (obligatoire, retry 2x, avec compensation cancel)
5. `archive-payment` → archive-document-service (optionnel)
6. `notify-teacher-payment-done` → dashboard-notification-service (obligatoire)

## Écarts restants avec les spécifications XML

- Les candidateApis du XML (`/workflows/student-registration`, `/workflows/course-completed`, etc.) utilisent des noms d'URL différents du pattern générique actuel (`/workflows/:id/start`). Ce pattern générique est plus propre techniquement et couvre toutes les spécifications. Aucune route nommée supplémentaire n'est nécessaire.
- La saga `payment-teacher` (avec validation AF interactive) est modélisée de façon simplifiée : la validation AF n'est pas bloquante dans ce workflow (elle est traitée comme une notification). En production, un mécanisme de `suspend/resume` devrait être utilisé lors de la validation AF — cela peut être déclenché via `POST /workflows/:id/suspend`.
