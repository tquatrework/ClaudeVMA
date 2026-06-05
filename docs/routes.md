# VisioMath — Référence des routes Phase 1

Toutes les routes sont préfixées par `/api/v1/` via le gateway.
Les routes marquées 🔒 nécessitent un header `Authorization: Bearer <token>`.

---

## identity-access-service (port 3001)

Rôles disponibles : `eleve`, `parent_financeur`, `formateur`, `animateur_pedagogique`, `responsable_pedagogique`, `technicien_informatique`, `administrateur_financier`

Statuts de validation : `pending` (avant consentements) → `active` (consentements RGPD+CGU signés) → `suspended`

### Authentification

| Méthode | Chemin | Description | Auth | Body / Params |
|---|---|---|---|---|
| POST | /auth/login | Se connecter | Non | `{email, password}` |
| POST | /auth/logout | Révoquer la session courante | 🔒 | — |
| POST | /auth/refresh | Nouveau token pair | Non | `{refresh_token}` |
| GET | /auth/me | Identité courante | 🔒 | — |

Réponse login/refresh : `{access_token, refresh_token, user: {id, email, role, validationStatus}}`

### Comptes

| Méthode | Chemin | Description | Auth | Rôles | Body |
|---|---|---|---|---|---|
| POST | /accounts | Créer un compte (auto-inscription) | Non | — | `{email, password, role?}` |
| GET | /accounts/:accountId | Lire un compte | 🔒 | TI, RP, AdministrateurFinancier | — |
| PUT | /accounts/:accountId/roles | Changer le rôle | 🔒 | RP, TI | `{role}` |
| PUT | /accounts/:accountId/validate | Valider un compte | 🔒 | RP, TI | — |
| PUT | /accounts/:accountId/suspend | Suspendre un compte | 🔒 | TI | — |
| GET | /accounts/:accountId/audit | Journal d'audit | 🔒 | RP, TI | — |

Règles métier : seuls `eleve`, `parent_financeur` et `formateur` peuvent être auto-inscrits (IAM-FB-002). La validation nécessite les consentements RGPD+CGU signés (IAM-FB-003).

### Consentements RGPD

| Méthode | Chemin | Description | Auth | Body |
|---|---|---|---|---|
| POST | /consents | Signer un consentement | 🔒 | `{consentType, version?}` |
| GET | /consents | Mes consentements | 🔒 | — |

Types : `rgpd` (requis), `cgu` (requis), `marketing` (optionnel). Une fois RGPD+CGU signés, le compte passe automatiquement à `active`.

### Événements publiés

`AccountCreated` · `RoleChanged` · `ConsentSigned` · `AccountValidated` · `AccountSuspended`

---

## user-profile-service

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| POST | /profiles | Créer un profil | 🔒 |
| GET | /profiles | Lister tous les profils | 🔒 |
| GET | /profiles/:userId | Profil d'un utilisateur | 🔒 |
| PATCH | /profiles/:userId | Mettre à jour un profil | 🔒 |
| DELETE | /profiles/:userId | Supprimer un profil | 🔒 |

---

## teacher-request-service

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| POST | /requests | Créer une demande | 🔒 |
| GET | /requests | Lister toutes les demandes | 🔒 |
| GET | /requests/:id | Détail d'une demande | 🔒 |
| PATCH | /requests/:id/status | Changer le statut | 🔒 |
| DELETE | /requests/:id | Supprimer une demande | 🔒 |

Statuts : `pending` → `accepted` / `declined` / `cancelled`

---

## calendar-service

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| POST | /calendar | Créer une séance | 🔒 |
| GET | /calendar | Lister les séances | 🔒 |
| GET | /calendar?teacherId=X | Séances d'un professeur | 🔒 |
| GET | /calendar?studentId=X | Séances d'un élève | 🔒 |
| GET | /calendar/:id | Détail d'une séance | 🔒 |
| PATCH | /calendar/:id | Modifier une séance | 🔒 |
| DELETE | /calendar/:id | Supprimer une séance | 🔒 |

---

## video-session-service

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| POST | /video/rooms | Créer une salle vidéo | 🔒 |
| GET | /video/rooms/:id | Info d'une salle | 🔒 |
| POST | /video/rooms/:id/join | Rejoindre la salle | 🔒 |
| POST | /video/rooms/:id/end | Terminer la session | 🔒 |

---

## communication-service

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| POST | /messages | Envoyer un message | 🔒 |
| GET | /messages/conversation/:id | Messages d'une conversation | 🔒 |
| PATCH | /messages/:id/read | Marquer comme lu | 🔒 |

---

## pedagogical-log-service

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| POST | /logs | Créer un log | 🔒 |
| GET | /logs/student/:studentId | Logs d'un élève | 🔒 |
| GET | /logs/session/:sessionId | Logs d'une séance | 🔒 |
| GET | /logs/:id | Détail d'un log | 🔒 |

---

## notification-dashboard-service

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| POST | /notifications | Créer une notification | 🔒 |
| GET | /notifications/user/:userId | Notifications d'un utilisateur | 🔒 |
| PATCH | /notifications/:id/read | Marquer comme lue | 🔒 |
| PATCH | /notifications/user/:userId/read-all | Tout marquer comme lu | 🔒 |
| DELETE | /notifications/:id | Supprimer une notification | 🔒 |

---

## Health checks (non authentifié)

Chaque service expose `GET /health` → `{status: "ok", service: "...", timestamp: "..."}`
