# Rapport — finance-credit-service — 2026-06-17

## Statut : ✅ Complété

## Ce qui existait déjà

| Module | Fichiers | État |
|---|---|---|
| financial-profiles | entity, service, controller, dto | Complet |
| payments | entity (Payment, Invoice, Ledger), service, controller, dto | Complet |
| financial-archives | entity, service, controller | Complet |
| internal | controller (check-payment-status) | Complet |
| health | controller /health | Complet |
| events | EventsService stub | Complet |
| common | guards (JWT, Roles, Internal), decorators | Complet |

Tests existants : 3 fichiers, 27 tests.

## Ce qui a été implémenté

### Module `teacher-payment-requests`
- Entité `TeacherPaymentRequest` avec statuts PENDING/VALIDATED/REJECTED, clé d'idempotence, referenceId
- DTO `CreateTeacherPaymentRequestDto` + `ValidateTeacherPaymentRequestDto`
- Service : création avec idempotence, validation AF (débit points financier, archive), liste par formateur
- Contrôleur : POST `/teacher-payment-requests`, POST `/teacher-payment-requests/:id/validate`, GET `/teacher-payment-requests/by-teacher/:teacherId`
- Événements publiés : `TeacherPaymentRequested`, `TeacherPaymentValidated`, `PaymentIncidentDetected`
- 15 tests unitaires

### Module `financial-settings`
- Entité `RewardSetting` (clé unique, valeur entière, audit trail)
- DTO `UpdateRewardSettingsDto` avec validation par tableau (upsert multiple)
- Service : lecture/upsert des settings (AF only), agrégat finance-events
- Contrôleurs : GET/PATCH `/financial-settings/rewards`, GET `/finance-events?ownerId=`
- Événement publié : `RewardSettingUpdated`
- 9 tests unitaires

### `app.module.ts`
- Ajout des deux nouveaux modules et entités (`TeacherPaymentRequest`, `RewardSetting`)

## Routes disponibles

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| GET | /health | Health check | Public |
| GET | /financial-profiles/:ownerId | Lire profil financier | JWT (owner, AF, RP, TI) |
| PATCH | /financial-profiles/:ownerId | Modifier profil financier | JWT (owner, AF, TI) |
| POST | /payments | Initier paiement (inscription/abonnement/ponctuel) | JWT |
| GET | /financial-archives/:ownerId | Lister archives financières | JWT (owner, AF, RP, TI) |
| POST | /teacher-payment-requests | Soumettre demande paiement formateur | JWT (formateur) |
| POST | /teacher-payment-requests/:id/validate | Valider/rejeter demande (AF only) | JWT (AF) |
| GET | /teacher-payment-requests/by-teacher/:teacherId | Lister demandes d'un formateur | JWT (teacher, AF, RP, TI) |
| GET | /financial-settings/rewards | Lire paramètres récompenses | JWT (AF) |
| PATCH | /financial-settings/rewards | Mettre à jour paramètres récompenses | JWT (AF) |
| GET | /finance-events | Interface AF — tous événements financiers | JWT (AF) |
| POST | /internal/check-payment-status/:ownerId | Vérifier paiement inscription | X-Internal-Secret |

## Tests

Commande : `npx jest --testPathPattern="test/unit" --no-coverage`

Résultat :
- 5 suites de tests
- **51 tests passants, 0 échec, 0 skip**
- Compilation TypeScript : `tsc --noEmit` sans erreur

## Décisions techniques

1. **Idempotence teacher-payment-requests** : clé unique sur `idempotency_key`, retour de l'existant si match (pas d'erreur 409 — comportement idempotent par définition).
2. **Débit de points** : 1 point par euro (même règle que le crédit à l'inscription). Le calcul `Math.floor(amountCents / 100)` est cohérent avec `PaymentsService`.
3. **RewardSetting** : upsert par `settingKey` unique, supporte plusieurs settings en un seul appel PATCH.
4. **finance-events** : agrégat sur `FinancialArchiveItem` (source de vérité des événements financiers), filtre optionnel `ownerId`.
5. **Contrôleurs dans financial-settings** : deux contrôleurs dans un même module (`FinancialSettingsController` + `FinanceEventsController`) pour garder la cohérence de domaine sans multiplier les modules.

## Écarts restants avec les specs XML

| Spec | État | Commentaire |
|---|---|---|
| `StudentFundingPlan` (entité) | Non implémenté | Spec mentionne l'entité mais aucune API candidate ni workflow précis — reporté |
| `TeacherRate` (entité) | Non implémenté | Tarifs formateur mentionnés en fonctionnalité 004, mais pas de route candidate ni de workflow concret — reporté |
| `PaymentIncident` (entité séparée) | Partiellement couvert | L'événement `PaymentIncidentDetected` est publié au rejet. Une table dédiée aux incidents n'est pas dans les routes candidates — reporté |
| Subscription active/gestion abonnement | Partiel | Le type `abonnement` existe dans Payment mais pas de gestion de cycle (renouvellement, expiration) — hors routes candidates |
| Export CSV/PDF archives | Non implémenté | Mentionné comme "téléchargeable" mais aucune route candidate précise dans les specs |

## Branche Git

`feat/finance-credit-service-complete` — commit `b293a89`

En attente de PR et review.
