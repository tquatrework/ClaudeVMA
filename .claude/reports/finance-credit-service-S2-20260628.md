# finance-credit-service — S2 Normalisation droits contrôleur

**Date :** 2026-06-28  
**Branche :** feat/phase1-canonical-services  
**Statut :** ✅

---

## Contexte

Mission S2 : normaliser la déclaration des droits au niveau contrôleur dans `finance-credit-service`.
Deux contrôleurs utilisaient `@UseGuards(JwtAuthGuard, RolesGuard)` sans `@Roles(...)`, rendant
les droits illisibles à l'audit.

---

## Analyse par contrôleur

### financial-profiles.controller.ts

| Endpoint | Avant | Après | Justification |
|----------|-------|-------|---------------|
| `GET :ownerId` | `@UseGuards(JwtAuthGuard, RolesGuard)` sans `@Roles` | `@UseGuards(JwtAuthGuard)` + commentaire contextuel | Droits : propriétaire OU AF / RP / TI — vérification dynamique dans `assertCanRead` |
| `PATCH :ownerId` | `@UseGuards(JwtAuthGuard, RolesGuard)` sans `@Roles` | `@UseGuards(JwtAuthGuard)` + commentaire contextuel | Droits : propriétaire OU AF / TI — vérification dynamique dans `assertCanWrite` |

**Décision RolesGuard :** retiré du contrôleur (et de l'import).  
Raison : `RolesGuard` sans `@Roles` retourne toujours `true` (cf. implémentation) → présence
trompeuse. Les droits sont 100% contextuels (requester = owner OU rôle privilégié selon la
ressource), incompatibles avec un `@Roles` fixe au niveau contrôleur.

Commentaire de classe ajouté + commentaire sur chaque endpoint.

### payments.controller.ts

| Endpoint | Avant | Après | Justification |
|----------|-------|-------|---------------|
| `POST /` | `@UseGuards(JwtAuthGuard, RolesGuard)` sans `@Roles` | `@UseGuards(JwtAuthGuard)` + commentaire contextuel | Tout utilisateur authentifié peut initier un paiement pour son propre compte (ownerId = req.user.id). Aucune restriction de rôle dans `PaymentsService.initiatePayment`. |

**Décision RolesGuard :** retiré du contrôleur (et de l'import).  
Raison identique — présence inutile, droits 100% contextuels (auto-paiement).

---

## Fichiers modifiés

- `services/finance-credit-service/src/financial-profiles/financial-profiles.controller.ts`
- `services/finance-credit-service/src/payments/payments.controller.ts`

## Build

`npm run build` : ✅ aucune erreur TypeScript.

---

## Points en suspens

Aucun. Les services métier (`FinancialProfilesService`, `PaymentsService`) n'ont pas été modifiés.
