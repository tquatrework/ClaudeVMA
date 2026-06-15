# identity-access-service — Rapport du 2026-06-14

## Routes disponibles après modifications

### Auth (`/auth`)
| Méthode | Chemin | Rôles autorisés | Statut |
|---------|--------|-----------------|--------|
| POST | /auth/password-reset/request | Tous (public) | ✅ Ajouté |
| POST | /auth/login | Tous (public) | ✅ Existait |
| POST | /auth/logout | Authentifié (JWT) | ✅ Existait |
| POST | /auth/refresh | Tous (public) | ✅ Existait |
| GET  | /auth/me | Authentifié (JWT) | ✅ Existait |

### Accounts (`/accounts`)
| Méthode | Chemin | Rôles autorisés | Statut |
|---------|--------|-----------------|--------|
| POST | /accounts | Public (auto-inscription) | ✅ Existait |
| POST | /accounts/students | Public (auto-inscription) | ✅ Ajouté |
| POST | /accounts/teachers | Public (auto-inscription) | ✅ Ajouté |
| GET  | /accounts/:id | TI, RP, ADMINISTRATEUR_FINANCIER | ✅ Existait |
| PUT  | /accounts/:id/roles | RP, TI | ✅ Existait |
| PUT  | /accounts/:id/validate | RP, TI | ✅ Existait |
| PUT  | /accounts/:id/suspend | TI | ✅ Existait |
| PATCH | /accounts/:id/status | RP, TI | ✅ Ajouté |
| POST | /accounts/:id/access/regenerate | TI | ✅ Ajouté |
| GET  | /accounts/:id/audit | RP, TI | ✅ Existait |

### Consents (`/consents`)
| Méthode | Chemin | Rôles autorisés | Statut |
|---------|--------|-----------------|--------|
| POST | /consents | Authentifié (JWT) | ✅ Existait |
| GET  | /consents | Authentifié (JWT) | ✅ Existait |

### Delegations (`/delegations`)
| Méthode | Chemin | Rôles autorisés | Statut |
|---------|--------|-----------------|--------|
| POST | /delegations | RP, TI | ✅ Ajouté |
| GET  | /delegations | RP, TI | ✅ Ajouté |

### Internal (`/internal`)
| Méthode | Chemin | Rôles autorisés | Statut |
|---------|--------|-----------------|--------|
| POST | /internal/create-account | Service interne (InternalGuard) | ✅ Existait |

### Health (`/health`)
| Méthode | Chemin | Rôles autorisés |
|---------|--------|-----------------|
| GET | /health | Public | ✅ Existait |

## Nouvelles entités créées

- `PasswordResetToken` — tokens hachés pour récupération de mot de passe (2h TTL)
- `DelegatedAccessRequest` — demandes d'action déléguée RP/TI avec statut et audit

## Nouveaux fichiers créés

```
src/auth/entities/password-reset-token.entity.ts
src/auth/dto/password-reset-request.dto.ts
src/accounts/dto/create-student-account.dto.ts
src/accounts/dto/create-teacher-account.dto.ts
src/accounts/dto/update-account-status.dto.ts
src/delegations/
  ├── entities/delegated-access-request.entity.ts
  ├── dto/create-delegation.dto.ts
  ├── delegations.service.ts
  ├── delegations.controller.ts
  └── delegations.module.ts
test/unit/
  ├── auth.service.spec.ts       (mis à jour + nouveaux tests)
  ├── accounts.service.spec.ts   (mis à jour + nouveaux tests)
  ├── consents.service.spec.ts   (mis à jour imports)
  └── delegations.service.spec.ts (nouveau)
```

## Tests lancés

Commande : `npm test`

```
PASS test/unit/delegations.service.spec.ts
PASS test/unit/consents.service.spec.ts
PASS test/unit/auth.service.spec.ts
PASS test/unit/accounts.service.spec.ts

Test Suites: 4 passed, 4 total
Tests:       48 passed, 48 total
```

## Écarts restants avec les XML

### Petits écarts intentionnels
- **`POST /auth/password-reset/request`** : Phase 1 stub — le token est créé en base mais l'email n'est pas réellement envoyé (pas de service email configuré). Un event `PasswordResetRequested` est publié pour observabilité. Un endpoint de confirmation de reset (avec le token) n'est pas requis par les XML candidateApis et n'a pas été ajouté.
- **`PATCH /accounts/{id}/status`** côtoie les anciens `PUT /accounts/{id}/validate` et `PUT /accounts/{id}/suspend` : les deux sets d'endpoints sont présents. Les anciens ne cassent rien et restent utiles pour une compatibilité éventuelle.
- **`POST /accounts/{id}/access/regenerate`** : La révocation des sessions actives est déléguée au client (les sessions en DB ne sont pas toutes révoquées car la table sessions est dans auth.service ; le service accounts.service n'y a pas accès direct). L'audit et la réactivation du compte sont bien tracés.

### Non implémenté
- Endpoint de confirmation de reset de mot de passe (POST /auth/password-reset/confirm) — non requis par les candidateApis XML.
- Impersonation réelle (accès TI au compte d'autrui) — hors scope Phase 1.
