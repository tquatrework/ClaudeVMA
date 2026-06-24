# Rapport — identity-access-service : migration loginIdentifier
Date : 2026-06-22

## Résumé

Migration complète du modèle d'authentification : `email` → `loginIdentifier` comme identifiant unique de connexion. Build et 135 tests passent.

---

## Statut par point

| # | Point | Statut | Fichiers |
|---|-------|--------|---------|
| 1 | Entité User — ajout `loginIdentifier`, retrait `unique` sur `email` | ✅ | `src/auth/entities/user.entity.ts` |
| 2 | Migration TypeORM | ✅ | `src/migrations/1750000000000-AddLoginIdentifier.ts` |
| 3 | `generateLoginIdentifier()` dans AccountsService | ✅ | `src/accounts/accounts.service.ts` |
| 4 | LoginDto → `loginIdentifier` | ✅ | `src/auth/dto/login.dto.ts` |
| 5 | PasswordResetRequestDto → `loginIdentifier` | ✅ | `src/auth/dto/password-reset-request.dto.ts` |
| 6 | Nouveau RecoverIdentifierDto | ✅ | `src/auth/dto/recover-identifier.dto.ts` |
| 7 | JwtPayload — `loginIdentifier` + `email` | ✅ | `src/auth/strategies/jwt.strategy.ts`, `src/auth/auth.service.ts` |
| 8 | auth.service.ts — validateUser, requestPasswordReset, recoverIdentifier, buildTokenResponse | ✅ | `src/auth/auth.service.ts` |
| 9 | auth.controller.ts — login, reset, recover-identifier, me | ✅ | `src/auth/auth.controller.ts` |
| 10 | accounts.service.ts — création email non-unique, parentLoginIdentifier, parentEmail multi-résultats | ✅ | `src/accounts/accounts.service.ts` |
| 11 | GET /accounts/check-email | ✅ | `src/accounts/accounts.service.ts`, `src/accounts/accounts.controller.ts` |
| 12 | UpdateMeDto — `loginIdentifier?` optionnel | ✅ | `src/accounts/dto/update-me.dto.ts` |
| 13 | toPublic() — inclut `loginIdentifier` partout | ✅ | `src/accounts/accounts.service.ts` |
| — | EventsService — ajout type `IdentifierRecoveryRequested` | ✅ | `src/events/events.service.ts` |
| — | Tests mis à jour | ✅ | 11 suites, 135 tests passent |

---

## Fichiers modifiés

- `src/auth/entities/user.entity.ts` — champ `loginIdentifier` ajouté, `unique: true` retiré de `email`
- `src/auth/dto/login.dto.ts` — `email` → `loginIdentifier`
- `src/auth/dto/password-reset-request.dto.ts` — `email` → `loginIdentifier`
- `src/auth/strategies/jwt.strategy.ts` — interface `JwtPayload` étendue avec `loginIdentifier`
- `src/auth/auth.service.ts` — validateUser, requestPasswordReset, recoverIdentifier, buildTokenResponse
- `src/auth/auth.controller.ts` — routes mises à jour + nouveau POST /auth/recover-identifier
- `src/accounts/dto/create-account.dto.ts` — `loginIdentifier?` optionnel
- `src/accounts/dto/create-student-account.dto.ts` — `loginIdentifier?`, `parentLoginIdentifier?` ajoutés
- `src/accounts/dto/create-teacher-account.dto.ts` — `loginIdentifier?` optionnel
- `src/accounts/dto/create-parent-account.dto.ts` — `loginIdentifier?` optionnel
- `src/accounts/dto/update-me.dto.ts` — `loginIdentifier?` optionnel, email non-unique
- `src/accounts/accounts.service.ts` — refonte complète : génération/résolution loginIdentifier, email non-unique, parentEmail multi-résultats, checkEmail
- `src/accounts/accounts.controller.ts` — GET /accounts/check-email, Swagger mis à jour
- `src/internal/internal.controller.ts` — retourne `loginIdentifier` dans la réponse
- `src/events/events.service.ts` — type `IdentifierRecoveryRequested` ajouté

## Fichiers créés

- `src/migrations/1750000000000-AddLoginIdentifier.ts` — migration PL/pgSQL avec gestion des collisions
- `src/auth/dto/recover-identifier.dto.ts` — nouveau DTO

---

## Décisions techniques

1. **`synchronize: false` implicite en production** : la migration doit être exécutée manuellement. En dev, `synchronize: true` ajoutera la colonne automatiquement, mais sans peupler les lignes existantes → utiliser la migration en environnement avec données existantes.

2. **`generateLoginIdentifier` en mémoire** : la résolution de collision utilise des `findOne` successifs. Acceptable en phase 1 (faible concurrence). En production haute charge, envisager une contrainte DB + retry.

3. **`parentEmail` multi-résultats** → 409 explicite avec message demandant d'utiliser `parentLoginIdentifier`. Pas d'auto-sélection arbitraire.

4. **`recoverIdentifier`** : émet un événement `IdentifierRecoveryRequested` avec la liste des loginIdentifiers. L'envoi effectif de l'email est délégué à un handler aval (stub Phase 1).

---

## Points en suspens

- La migration nécessite un test de non-régression sur une base avec données existantes avant passage en production.
- Les autres services consommant le JWT (`profile-service`, `orchestration-service`, etc.) reçoivent déjà `loginIdentifier` dans le payload : pas de breaking change car `email` est maintenu.
