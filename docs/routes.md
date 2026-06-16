# VisioMath — Référence des routes Phase 1

Toutes les routes sont préfixées par `/api/v1/` via le gateway.
Les routes marquées 🔒 nécessitent un header `Authorization: Bearer <token>`.

---

## identity-access-service

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

## profile-service

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

Types d'événements : `cours`, `masterclass`, `pedagogique`, `financier`, `rappel`, `invitation`

Délais de rappel valides : `1week`, `1day`, `1hour`, `15min`, `none`

### Calendriers et événements

| Méthode | Chemin | Description | Auth | Rôles / Remarques |
|---|---|---|---|---|
| GET | /calendars/:ownerId/events | Lister les événements autorisés | 🔒 | Query: `type?`, `personId?`. Filtrage par rôle côté serveur. |
| POST | /calendars/:ownerId/events | Créer un événement selon rôle | 🔒 | `eleve` → `rappel` · `formateur` → `cours/masterclass/pedagogique/rappel` · `animateur_pedagogique` → `pedagogique/rappel` · `responsable_pedagogique` → tous |
| GET | /calendars/:ownerId/availability | Lire les disponibilités | 🔒 | — |

Body `POST /calendars/:ownerId/events` : `{title, startAt, endAt, eventType, description?, inviteeIds?}`

Réponse `GET /calendars/:ownerId/events` : `[{id, title, startAt, endAt, eventType, status, ownerId, invitations?, reminderRules?}]`

### Invitations

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| POST | /events/:id/invitees/:userId/accept | Accepter une invitation | 🔒 |
| POST | /events/:id/invitees/:userId/decline | Refuser une invitation (retire l'invité) | 🔒 |

### Annulations

| Méthode | Chemin | Description | Auth | Remarques |
|---|---|---|---|---|
| POST | /events/:id/cancel-request | Demander ou appliquer une annulation | 🔒 | Si < 48h avant l'événement → `status: pending_approval`. Si ≥ 48h → annulation immédiate. |

Body : `{reason?}`

### Rappels

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| POST | /events/:id/reminders | Configurer les rappels | 🔒 |

Body : `{delay: "1week"|"1day"|"1hour"|"15min"|"none"}`

### Accès visibilité (RP uniquement)

| Méthode | Chemin | Description | Auth | Rôles |
|---|---|---|---|---|
| POST | /calendars/:ownerId/grants | Autoriser un utilisateur à voir ce calendrier | 🔒 | `responsable_pedagogique` |
| DELETE | /calendars/:ownerId/grants/:granteeId | Révoquer un accès visibilité | 🔒 | `responsable_pedagogique` |

### Événements publiés

`CalendarEventCreated` · `InvitationAccepted` · `InvitationDeclined` · `CancellationRequested` · `ReminderDue`

---

## video-session-service

### Salles vidéo

| Méthode | Chemin | Description | Auth | Rôles autorisés |
|---|---|---|---|---|
| POST | /video/rooms | Créer une salle vidéo | 🔒 | formateur, RP, AP, TI |
| GET | /video/rooms/:id | Info d'une salle | 🔒 | Tout utilisateur authentifié |
| GET | /video/rooms/:id/join | Rejoindre la salle (générer un token d'accès) | 🔒 | élève, formateur, RP, AP, TI — parent_financeur refusé (VID-FB-001) |
| POST | /video/rooms/:id/attendance | Enregistrer la présence | 🔒 | élève, formateur, RP, AP, TI — parent_financeur refusé |
| POST | /video/rooms/:id/close | Clôturer la session | 🔒 | formateur, RP, AP, TI |

### Enregistrements

| Méthode | Chemin | Description | Auth | Rôles autorisés |
|---|---|---|---|---|
| POST | /video/rooms/:roomId/recordings | Déclarer un enregistrement (expire dans 30 jours) | 🔒 | formateur, RP, AP, TI — parent_financeur et élève refusés (VID-AC-001) |
| GET | /video/rooms/:roomId/recordings | Lister les enregistrements visibles | 🔒 | élève, formateur, RP, AP, TI — parent_financeur refusé (VID-FB-001, VID-AC-001) |

Body `POST /video/rooms/:roomId/recordings` : `{downloadUrl?}` (URL facultative — peut être ajoutée plus tard)

### Commentaires horodatés

| Méthode | Chemin | Description | Auth | Rôles autorisés |
|---|---|---|---|---|
| POST | /recordings/:recordingId/comments | Ajouter un commentaire horodaté sur un enregistrement | 🔒 | élève (si enregistrement non expiré), formateur, RP, AP, TI — parent_financeur refusé (VID-FB-001) |

Body `POST /recordings/:recordingId/comments` : `{timestampSeconds: number, content: string}`

Réponse : `201 {id, recordingId, userId, timestampSeconds, content, createdAt}` · `400` enregistrement expiré (élève) · `403` rôle non autorisé · `404` enregistrement introuvable

### Résumés de cours

| Méthode | Chemin | Description | Auth | Rôles autorisés |
|---|---|---|---|---|
| POST | /video/rooms/:roomId/summary | Publier le résumé de cours (permanent, survit à l'expiration vidéo) | 🔒 | formateur, RP, AP — élève, TI et parent_financeur refusés (VID-AC-002) |

Body `POST /video/rooms/:roomId/summary` : `{content: string}`

Réponse : `201 {id, roomId, authorId, content, isPermanent: true, publishedAt, createdAt}` · `403` rôle non autorisé · `404` salle introuvable

### Événements publiés

`VideoRoomCreated` · `VideoSessionStarted` · `VideoSessionEnded` · `AttendanceRecorded` · `VideoRecordingAvailable` · `CourseSummaryPublished`

### Critères d'acceptation

- Un parent financeur ne peut pas ouvrir une visio ni accéder aux enregistrements (VID-FB-001)
- La vidéo est téléchargeable pendant 30 jours puis expire (VID-AC-001)
- Le résumé de cours reste dans les archives pédagogiques après expiration vidéo (`isPermanent: true`) (VID-AC-002)

API interne (non exposée via nginx) : `GET /internal/video/*` — protégée par `X-Internal-Secret`.

---

## communication-service

### Conversations

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| POST | /conversations | Créer une conversation | 🔒 |
| GET | /conversations | Lister mes conversations | 🔒 |
| POST | /conversations/:id/messages | Envoyer un message | 🔒 |

### Messages

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| GET | /messages/conversation/:id | Messages d'une conversation | 🔒 |
| PATCH | /messages/:id/read | Marquer comme lu | 🔒 |

### Incidents (TI uniquement)

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| POST | /incidents | Créer un incident | 🔒 |
| GET | /incidents | Lister les incidents | 🔒 |
| GET | /incidents/:id | Détail d'un incident | 🔒 |
| PUT | /incidents/:id/status | Changer le statut d'un incident | 🔒 |

API interne (non exposée via nginx) : `POST /internal/sync-contacts` — protégée par `X-Internal-Secret`.

---

## pedagogical-log-service

### Logs (cahier de texte)

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| POST | /logs | Créer un log pédagogique | 🔒 |
| GET | /logs/student/:studentId | Logs d'un élève | 🔒 |
| GET | /logs/session/:sessionId | Logs d'une séance | 🔒 |
| GET | /logs/:id | Détail d'un log | 🔒 |
| PATCH | /logs/:id | Modifier un log | 🔒 |

### Mémos

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| POST | /memos | Créer un mémo | 🔒 |
| GET | /memos | Lister mes mémos | 🔒 |
| GET | /memos/:id | Détail d'un mémo | 🔒 |
| DELETE | /memos/:id | Supprimer un mémo | 🔒 |

### Carnet personnel (élève uniquement)

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| POST | /students/:studentId/notebook | Créer une entrée carnet | 🔒 |
| GET | /students/:studentId/notebook | Lister les entrées | 🔒 |
| GET | /students/:studentId/notebook/:id | Détail d'une entrée | 🔒 |
| PATCH | /students/:studentId/notebook/:id | Modifier une entrée | 🔒 |
| DELETE | /students/:studentId/notebook/:id | Supprimer une entrée | 🔒 |

---

## dashboard-notification-service

### Notifications

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| GET | /notifications | Lister mes notifications | 🔒 |
| POST | /notifications/:id/read | Marquer une notification comme lue | 🔒 |
| DELETE | /notifications/:id | Supprimer une notification | 🔒 |

### Tableaux de bord

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| GET | /dashboards/me | Mon tableau de bord | 🔒 |
| PUT | /dashboards/me/preferences | Mettre à jour les préférences | 🔒 |

API interne (non exposée via nginx) : `POST /internal/initialize-dashboard`, `POST /internal/notify` — protégées par `X-Internal-Secret`.

---

## orchestration-service

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

Note : la route `/callbacks/:provider` n'est **pas** protégée par `auth_request` nginx — les providers externes ne peuvent pas fournir un JWT utilisateur. La protection repose sur le header `X-Webhook-Secret` validé côté service. Le `correlationId` est lu depuis `body.correlationId` ou `body.correlation_id`, ou généré automatiquement si absent.

---

## Health checks (non authentifié)

Chaque service expose `GET /health` → `{status: "ok", service: "...", timestamp: "..."}`
