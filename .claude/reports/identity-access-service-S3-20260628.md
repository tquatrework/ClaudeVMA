# Audit sécurité S3 — identity-access-service
## Date : 2026-06-28
## Mission : Identifiants utilisateur dans l'URL

---

## Statut global : ⚠️ (1 faille corrigée — système sain sinon)

---

## Périmètre audité

Contrôleurs examinés :
- accounts.controller.ts — 8 endpoints dont 7 avec :accountId en URL
- consents.controller.ts — 0 endpoint avec ID en URL
- delegations.controller.ts — 0 endpoint avec ID en URL
- auth.controller.ts — 0 endpoint avec ID en URL
- internal.controller.ts — 1 endpoint avec :userId en URL

---

## Tableau endpoint par endpoint

| Endpoint | ID en URL | Protection contrôleur | Vérification service | Statut |
|---|---|---|---|---|
| GET /accounts/:accountId | :accountId | Roles(TI, RP, AF) + JWT | lecture seule rôle interne | OK |
| PUT /accounts/:accountId/roles | :accountId | Roles(RP, TI) + JWT | Double-check acteur dans service | OK |
| PUT /accounts/:accountId/validate | :accountId | Roles(RP, TI) + JWT | Double-check acteur dans service | OK |
| PUT /accounts/:accountId/suspend | :accountId | Roles(TI) + JWT | Double-check TI dans service | OK |
| PATCH /accounts/:accountId/status | :accountId | Roles(RP, TI) + JWT | Double-check acteur dans service | OK |
| POST /accounts/:accountId/access/regenerate | :accountId | Roles(TI) + JWT | Double-check TI dans service | OK |
| GET /accounts/:accountId/audit | :accountId | Roles(RP, TI) + JWT | lecture seule rôle interne | OK |
| GET /internal/accounts/by-user-id/:userId | :userId | InternalGuard (x-internal-secret) | usage interne | CORRIGE (faille) |
| PATCH /accounts/me | Pas d'ID URL | JWT → req.user.id injecté | findOrFail(req.user.id) | OK |
| POST /consents | Pas d'ID URL | JWT → req.user.id injecté | signConsent(req.user.id, ...) | OK |
| GET /consents | Pas d'ID URL | JWT → req.user.id injecté | getConsents(req.user.id) | OK |
| POST /delegations | Pas d'ID URL | Roles(RP, TI) + JWT | createDelegation(dto, req.user) | OK |
| GET /delegations | Pas d'ID URL | Roles(RP, TI) + JWT | listDelegations(req.user) filtre acteur | OK |

---

## Faille identifiée et corrigée

### S3-IAM-001 : InternalGuard fail-open si INTERNAL_SECRET absent

**Fichier** : src/internal/internal.guard.ts

**Description** : Quand la variable d'environnement INTERNAL_SECRET n'est pas configurée,
le garde loguait un warning mais retournait true, laissant tous les endpoints /internal/*
complètement ouverts sans authentification. En absence de configuration (environnement de
développement, CI, pod mal configuré), n'importe quel appelant pouvait lire la liste de
tous les comptes, rechercher par loginIdentifier, et récupérer un profil complet par userId.

**Gravité** : Haute — exposition de données personnelles (PII) en masse sans authentification.

**Correction appliquée** : Remplacement du return true par une UnauthorizedException et
passage du niveau de log de warn à error. Le garde est maintenant fail-closed.

---

## Points sains confirmés

### Routes :accountId en URL (accounts.controller.ts)

Toutes les routes avec un ID de compte en URL sont protégées à deux niveaux :
1. Contrôleur : guard JWT + RolesGuard avec rôle interne requis (TI, RP, AF)
2. Service : double-vérification du rôle de l'acteur dans la méthode service

Aucun endpoint ne permet à un utilisateur ordinaire (élève, parent, formateur)
d'accéder au compte d'un autre utilisateur via un ID en URL.

### Pattern IDOR non présent

Les utilisateurs accèdent uniquement à leurs propres données via /accounts/me
et /consents — l'ID est injecté depuis le JWT, jamais passé en URL.

### Double-check service systématique

Pour updateRoles, validateAccount, suspendAccount, updateAccountStatus, regenerateAccess,
le service re-vérifie le rôle de l'acteur en plus du guard contrôleur (défense en profondeur).

---

## Commit

d9e5d7b — fix(identity-access-service): corriger accès par identifiant URL sans vérification demandeur (S3)
Branche : worktree-agent-a450a9478e5d28e05

---

## Recommandations restantes (hors périmètre S3)

1. S'assurer que INTERNAL_SECRET est bien défini dans tous les environnements et documenté
   dans le .env.example du service.
2. Confirmer que /internal/* n'est pas exposé publiquement — accessible uniquement depuis
   le réseau interne des microservices.
