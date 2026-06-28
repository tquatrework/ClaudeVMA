# Rapport — identity-access-service : parcours email
Date : 2026-06-27

## Statut global : ✅

---

## Ce qui a été implémenté

### 1. MailModule / MailService (`src/mail/`)
- `mail.service.ts` : service nodemailer réutilisable, SMTP Infomaniak (SSL port 465)
  - `sendEmailVerification(email, firstName, rawToken)` → lien `FRONT_BASE_URL/verify-email?token=...`
  - `sendIdentifierRecovery(email, loginIdentifiers[])` → liste des identifiants en HTML
  - `sendPasswordReset(email, firstName, rawToken)` → lien `FRONT_BASE_URL/reset-password?token=...`
  - Les erreurs SMTP sont loguées silencieusement (jamais propagées au client — anti-enumeration)
- `mail.module.ts` : module NestJS exportant `MailService`

### 2. Nouvelles entités TypeORM
- `src/auth/entities/email-verification-token.entity.ts` : table `email_verification_tokens`
- `src/auth/entities/identifier-recovery-token.entity.ts` : table `identifier_recovery_tokens`
- `src/auth/entities/user.entity.ts` : champ `emailVerified: boolean` ajouté

### 3. Migration
- `src/migrations/1750100000000-AddEmailTokenTables.ts`
  - Crée `email_verification_tokens` avec index sur `user_id`
  - Crée `identifier_recovery_tokens` avec index sur `email`
  - Ajoute `email_verified BOOLEAN DEFAULT FALSE` sur `users`

### 4. Nouveaux DTOs
- `src/auth/dto/send-verification-email.dto.ts`
- `src/auth/dto/verify-email.dto.ts`
- `src/auth/dto/reset-password.dto.ts`

### 5. Endpoints implémentés (AuthController)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | /auth/send-verification-email | Envoi email de vérification — réponse neutre |
| POST | /auth/verify-email | Confirme le token et marque emailVerified=true |
| POST | /auth/recover-identifier | Envoie les identifiants par email — réponse neutre |
| POST | /auth/forgot-password | Alias de password-reset/request |
| POST | /auth/password-reset/request | Demande reset — réponse neutre |
| POST | /auth/reset-password | Applique le nouveau MDP, révoque les sessions |

Routes déjà présentes et vérifiées :
- POST /auth/login
- POST /auth/logout
- POST /auth/refresh
- GET  /auth/me

### 6. Sécurité
- Tokens : `crypto.randomBytes(48).toString('hex')` — 96 bits d'entropie
- Stockage : hash SHA-256 uniquement en base (token brut jamais persisté)
- TTL configurable par variable d'environnement
- Usage unique : `usedAt` renseigné après usage, bloquant les réutilisations
- Réponses neutres sur tous les endpoints publics (anti-enumeration email/identifiant)
- Révocation de toutes les sessions actives lors d'un reset de mot de passe

### 7. .env.example mis à jour
Ajout des variables SMTP, MAIL_FROM_*, FRONT_BASE_URL, API_BASE_URL, TTL des tokens.

### 8. Gateway nginx
Aucune modification nécessaire : la route `/api/v1/auth/` est déjà déclarée publique (sans `auth_request`) en `^~` — couvre automatiquement toutes les sous-routes auth.

### 9. Tests
- `test/unit/mail.service.spec.ts` : nouveau, 9 cas (envoi correct, fallback nom, silence SMTP)
- `test/unit/auth.service.spec.ts` : mis à jour — 22 cas couvrant tous les nouveaux endpoints
- `test/unit/auth.controller.spec.ts` : mis à jour — 14 cas
- Corrections collatérales sur 4 autres spec files (`emailVerified` manquant dans mocks User)
- Bug pré-existant corrigé : `accounts.service.spec.ts` manquait `ConfigService` dans les providers

### 10. EventsService
Ajout des types `EmailVerified` et `PasswordReset` dans `DomainEventType`.

### 11. Bugs pré-existants corrigés
- `accounts.service.ts` : 2 implémentations dupliquées de `createParentAccount` supprimées
- `accounts.service.ts` : `dto.loginIdentifier` inexistant sur `CreateParentAccountDto` → corrigé en `undefined`

---

## Résultat build & tests
- `npm run build` : ✅ 0 erreur
- `npm test` : ✅ 160/160 tests passent, 12 suites

---

## Points en suspens
- L'envoi d'email est en mode "best effort" — si le SMTP Infomaniak est inaccessible, l'opération est loguée silencieusement. En production, envisager une queue de retry (Bull/Redis) pour garantir la délivrabilité.
- Le token de `recover-identifier` est tracé en base (table `identifier_recovery_tokens`) mais n'est pas utilisé dans un lien de retour — c'est voulu (récupération directe sans confirmation).
- `check-email` non implémenté : aucune route front ne l'utilise selon l'analyse, et le besoin fonctionnel est couvert par `send-verification-email` + `verify-email`.
