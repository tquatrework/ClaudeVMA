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

### API interne inter-services (non exposée via nginx)

> Exclue de Swagger (`@ApiExcludeController`). Protégée par `X-Internal-Secret: <INTERNAL_SECRET>`.
> Utilisée par orchestration-service dans les workflows d'onboarding.

| Méthode | Chemin | Description | Header requis |
|---|---|---|---|
| POST | /internal/create-account | Créer un compte depuis un service interne | `X-Internal-Secret` |

Réponse : `{accountId, email, role}`

### Événements publiés

`AccountCreated` · `RoleChanged` · `ConsentSigned` · `AccountValidated` · `AccountSuspended`

---

## profile-service (port 3003)

Rôles disponibles : `eleve`, `parent_financeur`, `formateur`, `animateur_pedagogique`, `responsable_pedagogique`, `technicien_informatique`, `administrateur_financier`

### Profils

| Méthode | Chemin | Auth | Rôles autorisés | Description | Réponse attendue |
|---|---|---|---|---|---|
| GET | /profiles/:userId | 🔒 | eleve (soi-même), formateur (contacts liés), parent_financeur (élèves liés), responsable_pedagogique, animateur_pedagogique, technicien_informatique, administrateur_financier | Lire un profil selon droits | `200 {userId, administrativeProfile, pedagogicalProfile}` · `401` sans token · `403` accès refusé · `404` profil inexistant |
| PUT | /profiles/:userId/administrative | 🔒 | eleve (soi-même), responsable_pedagogique, technicien_informatique | Modifier le profil administratif | `200 {userId, ...champsAdmin}` · `401` · `403` · `404` |
| PUT | /profiles/:userId/pedagogical | 🔒 | eleve (soi-même), formateur (soi-même), responsable_pedagogique, technicien_informatique | Modifier le profil pédagogique | `200 {userId, ...champsPedago}` · `401` · `403` · `404` |
| POST | /profiles/:teacherId/ap-status | 🔒 | responsable_pedagogique | Promouvoir un formateur en Animateur Pédagogique | `201 {userId, isAnimateurPedagogique: true}` · `401` · `403` · `404` |
| POST | /profiles/:userId/internal-notes | 🔒 | responsable_pedagogique, administrateur_financier | Ajouter une note interne (invisible pour clients/formateurs) | `201 {id, authorId, content, createdAt}` · `400` body vide · `401` · `403` |

### Relations

| Méthode | Chemin | Auth | Rôles autorisés | Description | Réponse attendue |
|---|---|---|---|---|---|
| POST | /relations/finance-owner-student | 🔒 | responsable_pedagogique | Lier un parent financeur à un élève | `201 {financeOwnerId, studentId, createdAt}` · `400` body incomplet · `401` · `403` · `409` doublon |
| POST | /relations/teacher-student | 🔒 | responsable_pedagogique | Lier un formateur à un élève (avec flag professeur principal) | `201 {teacherId, studentId, isPrincipalTeacher, createdAt}` · `400` · `401` · `403` · `409` doublon |
| POST | /relations/pedagogical-coordinator | 🔒 | responsable_pedagogique | Lier un RP ou AP comme coordinateur pédagogique d'un élève | `201 {coordinatorId, studentId, coordinatorRole, createdAt}` · `400` rôle invalide · `401` · `403` · `409` doublon |
| GET | /relations/pedagogical-coordinator/:coordinatorId | 🔒 | responsable_pedagogique, animateur_pedagogique (soi-même), technicien_informatique | Lister les liens de coordination d'un coordinateur | `200 [{coordinatorId, studentId, coordinatorRole}]` · `401` · `403` |

### API interne inter-services (non exposée via nginx)

> Exclue de Swagger (`@ApiExcludeController`). Protégée par `X-Internal-Secret: <INTERNAL_SECRET>`.
> Utilisée par orchestration-service dans les workflows d'onboarding.

| Méthode | Chemin | Description | Header requis |
|---|---|---|---|
| POST | /internal/create-student-profiles | Créer les profils initiaux d'un élève | `X-Internal-Secret` |
| POST | /internal/create-teacher-profiles | Créer les profils initiaux d'un formateur | `X-Internal-Secret` |
| POST | /internal/link-parent | Lier un parent financeur à un élève | `X-Internal-Secret` |
| POST | /internal/create-teacher-student-relation | Créer la relation formateur-élève | `X-Internal-Secret` |
| POST | /internal/link-coordinator | Lier un coordinateur pédagogique à un élève | `X-Internal-Secret` |

### Événements publiés

`ProfileUpdated` · `StudentLinkedToFinanceOwner` · `TeacherLinkedToStudent` · `CoordinatorLinkedToStudent` · `TeacherPromotedToPedagogicalAnimator`

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

## orchestration-service (port 3000 interne)

Toutes les routes sont accessibles via le gateway sous le préfixe `/api/v1/orchestration/`.
Les routes de callbacks sont techniquement protégées par `auth_request` nginx, mais destinées aux webhooks externes : le `correlationId` est lu depuis le body ou généré automatiquement.

### Workflows

| Méthode | Chemin | Description | Auth | Paramètres / Body | Réponse attendue |
|---|---|---|---|---|---|
| GET | /workflows | Lister les types de workflows disponibles | 🔒 | — | `200 [{id, name, phase, stepCount}]` |
| POST | /workflows/:workflowId/start | Déclencher un workflow transverse (ex: `student-onboarding`) | 🔒 | Path: `workflowId` (type de workflow) · Body: `{workflowType, payload, initiatedBy?, correlationId?}` | `202 {workflowInstanceId, workflowType, correlationId, status, startedAt}` · `404` type inconnu |
| GET | /workflows/:workflowInstanceId | Lire l'état d'une instance de workflow | 🔒 | Path: `workflowInstanceId` (UUID) | `200 {instance, steps, status}` · `404` instance introuvable |
| POST | /workflows/:workflowInstanceId/suspend | Suspendre un workflow en attente d'arbitrage utilisateur (ORCH-BR-006) | 🔒 | Path: `workflowInstanceId` · Body: `{reason}` | `200 {workflowInstanceId, status: "needs_arbitration", reason}` |
| POST | /workflows/:workflowInstanceId/resume | Reprendre un workflow après arbitrage ou forcage TI (ORCH-BR-006/007) | 🔒 | Path: `workflowInstanceId` · Body: `{tiOverride?}` (`true` = forcage TI audité) | `200 {workflowInstanceId, status: "in_progress", tiOverride}` |

Types de workflows phase 1 : `student-onboarding`, `teacher-onboarding`, `teacher-request-to-assignment`, `scheduled-video-course`.

### Commandes d'intégration

| Méthode | Chemin | Description | Auth | Body | Réponse attendue |
|---|---|---|---|---|---|
| POST | /commands | Émettre une commande idempotente vers un microservice cible | 🔒 | `{targetService, action, payload, idempotencyKey, correlationId?}` | `201 commande dispatchée` · `409` clé d'idempotence déjà utilisée |

### Événements d'intégration

| Méthode | Chemin | Description | Auth | Paramètres | Réponse attendue |
|---|---|---|---|---|---|
| GET | /events/:correlationId | Lire l'historique chronologique des événements pour un correlationId | 🔒 | Path: `correlationId` (UUID) | `200 {correlationId, count, events[]}` |

### Callbacks externes (webhooks)

| Méthode | Chemin | Description | Auth | Paramètres / Body | Réponse attendue |
|---|---|---|---|---|---|
| POST | /callbacks/:provider | Recevoir un webhook d'un fournisseur externe (vidéo, paiement, etc.) | Non (webhook) | Path: `provider` (ex: `video-provider`) · Body: `{correlationId?, eventType?, ...payload}` | `200 {received: true, correlationId}` |

Note : la route `/callbacks/:provider` est exposée via nginx avec `auth_request`, mais est conçue pour recevoir des webhooks de fournisseurs externes. Le `correlationId` est lu depuis `body.correlationId` ou `body.correlation_id`, ou généré automatiquement si absent.

---

## Health checks (non authentifié)

Chaque service expose `GET /health` → `{status: "ok", service: "...", timestamp: "..."}`
