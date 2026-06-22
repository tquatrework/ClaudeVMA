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
| POST | /accounts | Créer un compte générique (auto-inscription) | Non | — | `{email, password, role?}` |
| POST | /accounts/students | Créer un compte élève (+ parent optionnel) | Non | — | `{email, password, isMember?, parentEmail?, parentPassword?}` |
| POST | /accounts/teachers | Créer un compte formateur | Non | — | `{email, password, cvReference?}` |
| POST | /accounts/parents | Créer un compte parent / financeur | Non | — | `{email, password}` |
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
| GET | /profiles/:userId/internal-notes | 🔒 | responsable_pedagogique, animateur_pedagogique, technicien_informatique, administrateur_financier | Lister les notes internes confidentielles (non visibles par l'élève, le parent/financeur ni le formateur) | `200 [{id, authorId, content, createdAt}]` · `401` · `403` |
| POST | /profiles/:userId/internal-notes | 🔒 | responsable_pedagogique, animateur_pedagogique | Créer une note interne confidentielle (non visible par l'élève, le parent/financeur ni le formateur) | `201 {id, authorId, content, createdAt}` · `400` body vide · `401` · `403` |
| PUT | /profiles/:userId/internal-notes/:id | 🔒 | auteur, responsable_pedagogique | Modifier une note interne | `200 {id, authorId, content, updatedAt}` · `401` · `403` · `404` |
| DELETE | /profiles/:userId/internal-notes/:id | 🔒 | responsable_pedagogique | Supprimer une note interne | `204` · `401` · `403` · `404` |

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

### Demandes de rattachement parent↔élève

Flux en deux temps : le parent fournit le `studentId` qu'il connaît hors-plateforme. L'élève ou un RP/TI valide. Aucune liste d'élèves n'est exposée au parent.

Statuts : `pending` → `approved` (lien finance-owner-student créé) / `rejected`

| Méthode | Chemin | Auth | Rôles autorisés | Description | Réponse attendue |
|---|---|---|---|---|---|
| POST | /parent-link-requests | 🔒 | `parent_financeur` | Soumet une demande de rattachement | Body : `{ studentId }` · `201 { id, parentId, studentId, status: "pending", requestedAt }` · `400` studentId inexistant · `409` demande pending déjà en cours |
| GET | /parent-link-requests | 🔒 | `parent_financeur` (ses demandes), `eleve` (demandes le ciblant), `responsable_pedagogique`, `technicien_informatique` (toutes) | Liste filtrée selon le rôle | `200 [{ id, parentId, studentId, status, requestedAt, processedAt, processedBy }]` |
| POST | /parent-link-requests/:id/approve | 🔒 | `eleve` (uniquement si ciblé), `responsable_pedagogique`, `technicien_informatique` | Approuve → crée le lien finance-owner-student | `200 { id, status: "approved", processedAt, processedBy }` · `403` · `404` |
| POST | /parent-link-requests/:id/reject | 🔒 | `eleve` (uniquement si ciblé), `responsable_pedagogique`, `technicien_informatique` | Rejette la demande | `200 { id, status: "rejected", processedAt, processedBy }` · `403` · `404` |

### Événements publiés

`ProfileUpdated` · `StudentLinkedToFinanceOwner` · `TeacherLinkedToStudent` · `CoordinatorLinkedToStudent` · `TeacherPromotedToPedagogicalAnimator` · `ParentLinkRequested` · `ParentLinkApproved` · `ParentLinkRejected`

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

### Cahier de texte — tenu par le formateur ou le RP, suivi séance après séance

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /students/:studentId/pedagogical-log | Lire le cahier de texte d'un élève (filtré par rôle) | 🔒 | Tout rôle authentifié | `200 [PedagogicalLogPage]` — élève: hors pages hiddenFromStudent · parent: eleve_parent_formateur + special · RP/Formateur: tout |
| POST | /students/:studentId/pedagogical-log | Ajouter une page de cahier de texte | 🔒 | formateur, RP, AP, TI | `201 {id, studentId, authorId, authorRole, content, visibility, isSpecialPage, hiddenFromStudent, linkedResources?, ...}` · `400` validation · `403` rôle non autorisé |
| POST | /students/:studentId/pedagogical-log/special-pages | Créer une page spéciale avec visibilité ciblée (RP uniquement) | 🔒 | responsable_pedagogique | `201 {id, ..., isSpecialPage: true, hiddenFromStudent, visibility: "special"}` · `403` réservé RP |
| GET | /logs/session/:sessionId | Logs d'une séance (filtrés par rôle) | 🔒 | Tout rôle authentifié | `200 [PedagogicalLogPage]` |
| GET | /logs/:id | Détail d'une page | 🔒 | Selon visibilité et rôle | `200 PedagogicalLogPage` · `403` visibilité bloquée · `404` introuvable |
| PATCH | /logs/:id | Modifier une page | 🔒 | Auteur, RP, TI | `200 PedagogicalLogPage` · `403` non auteur · `404` introuvable |
| DELETE | /logs/:id | Supprimer une page | 🔒 | Auteur, responsable_pedagogique | `204` · `403` · `404` introuvable |
| GET | /pedagogical-logs | Lister les entrées du cahier de texte | 🔒 | formateur, responsable_pedagogique, animateur_pedagogique, eleve, parent_financeur | `200 [PedagogicalLogPage]` — filtrage par rôle · élève: hors pages hiddenFromStudent · parent: hors pages eleve_formateur |
| POST | /pedagogical-logs | Créer une entrée de cahier de texte | 🔒 | formateur, responsable_pedagogique | `201 {id, studentId, authorId, authorRole, content, visibility, isSpecialPage, hiddenFromStudent, linkedResources?, ...}` · `400` validation · `403` rôle non autorisé |
| GET | /pedagogical-logs/:id | Lire une entrée | 🔒 | Selon visibilité et rôle | `200 PedagogicalLogPage` · `403` visibilité bloquée · `404` introuvable |
| PUT | /pedagogical-logs/:id | Modifier une entrée | 🔒 | Auteur | `200 PedagogicalLogPage` · `403` non auteur · `404` introuvable |
| DELETE | /pedagogical-logs/:id | Supprimer une entrée | 🔒 | Auteur, responsable_pedagogique | `204` · `403` · `404` introuvable |

Règles de visibilité :
- `eleve_parent_formateur` : élève, parent, formateur, RP, AP, TI
- `eleve_formateur` : élève et formateur (pas le parent)
- `formateur_rp` : formateur et RP uniquement
- `special` : pages spéciales — RP, formateur, parent (sauf si `hiddenFromStudent=true`, l'élève ne voit pas)

`hiddenFromStudent=true` : masque la page à l'élève — applicable aux pages spéciales parent/financeur (XML spec func 003).

### Mémo élève — formulaire structuré appartenant à l'élève

Le mémo est un outil personnel de l'élève (formules, trucs essentiels). Il n'est PAS une note interne du personnel. L'élève propriétaire crée, modifie et supprime ses propres entrées. Les acteurs autorisés (formateur lié, RP, AP) peuvent lire selon rattachement, sans droit d'écriture.

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /memos | Lister chapitres + items du mémo de l'élève connecté | 🔒 | eleve uniquement | `200 [MemoChapter avec items]` · `403` tout autre rôle |
| GET | /memos/search?q= | Recherche dans le mémo | 🔒 | eleve uniquement | `200 [MemoItem]` · `400` q vide · `403` tout autre rôle |
| POST | /memos | Créer un mémo | 🔒 | eleve uniquement | `201 Memo` · `403` formateur/RP/parent → refusé |
| GET | /memos/:id | Lire un mémo | 🔒 | eleve (propriétaire), formateur lié (lecture), RP lié (lecture) | `200 Memo` · `403` parent/autre · `404` introuvable |
| PUT | /memos/:id | Modifier un mémo | 🔒 | eleve (propriétaire) uniquement | `200 Memo` · `403` tout autre rôle · `404` introuvable |
| DELETE | /memos/:id | Supprimer un mémo | 🔒 | eleve (propriétaire) uniquement | `204` · `403` tout autre rôle · `404` introuvable |

CRITIQUE: Un formateur tente d'écrire dans le mémo → `403 ForbiddenException`. Types d'items supportés dans le contenu : `text`, `formula` (LaTeX), `image` (max 500 Ko) (XML spec func 004, 005).

### Chapitres de mémo — étiquettes de classement optionnelles

Les mémos sont affichés groupés par chapitre. Les mémos sans chapitre (`chapterId` null) apparaissent sous la catégorie virtuelle "Général".

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /memos/chapters | Lister les chapitres de l'élève connecté | 🔒 | eleve uniquement | `200 [Chapter]` · `403` tout autre rôle |
| POST | /memos/chapters | Créer un chapitre | 🔒 | eleve uniquement | `201 MemoChapter` · `403` formateur/RP/parent → refusé |
| GET | /memos/chapters/:id | Détail d'un chapitre et ses mémos | 🔒 | eleve (propriétaire), formateur lié (lecture), RP lié (lecture) | `200 {id, title, studentId, createdAt, memos: [Memo]}` · `403` parent/autre · `404` introuvable |
| PUT | /memos/chapters/:id | Renommer un chapitre | 🔒 | eleve (propriétaire) uniquement | `200 {id, title, studentId, createdAt}` · `403` tout autre rôle · `404` introuvable |
| DELETE | /memos/chapters/:id | Supprimer un chapitre (les mémos associés passent à `chapterId=null`) | 🔒 | eleve (propriétaire) uniquement | `204` · `403` tout autre rôle · `404` introuvable |
| POST | /memos/chapters/:chapterId/items | Ajouter un item (texte/formule/image) | 🔒 | eleve uniquement | `201 MemoItem` · `400` image > 500 Ko · `403` autre rôle · `404` chapitre introuvable |

### Carnet personnel (élève uniquement)

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| POST | /students/:studentId/notebook | Ajouter une entrée carnet | 🔒 | eleve (propriétaire) | `201 NotebookEntry` · `403` non propriétaire ou parent/RP |
| GET | /students/:studentId/notebook | Lister les entrées carnet | 🔒 | eleve (propriétaire), TI (incident) | `200 [NotebookEntry]` · `403` parent → refusé, RP → refusé (Phase 1) |
| GET | /students/:studentId/notebook/:id | Détail d'une entrée | 🔒 | eleve (propriétaire), TI | `200 NotebookEntry` · `403` parent/RP · `404` introuvable |
| PATCH | /students/:studentId/notebook/:id | Modifier une entrée | 🔒 | eleve (propriétaire) uniquement | `200 NotebookEntry` · `403` · `404` |
| DELETE | /students/:studentId/notebook/:id | Supprimer une entrée | 🔒 | eleve (propriétaire) uniquement | `204` · `403` · `404` |

Arbitrage Phase 1 : RP n'a PAS accès au carnet personnel (décision conservatrice — à arbitrer en Phase 2).
Le parent financeur ne voit JAMAIS le carnet personnel (PLOG-FB-001).

---
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

## finance-credit-service

Phase 2 — Gestion des profils financiers, paiements, factures et archives financières.

Toutes les routes 🔒 nécessitent `Authorization: Bearer <access_token>`.

### Profils financiers

| Méthode | Chemin | Description | Auth | Rôles autorisés | Body / Params | Réponse attendue |
|---|---|---|---|---|---|---|
| GET | /financial-profiles/:ownerId | Lire le profil financier d'un financeur | 🔒 | owner (soi-même), administrateur_financier, responsable_pedagogique, technicien_informatique | — | `200 {id, ownerId, profileType, pointsBalance, fundingEndDate, paymentMethod, paymentReference}` · `401` · `403` · `404` |
| PATCH | /financial-profiles/:ownerId | Modifier les moyens de paiement ou paramètres | 🔒 | owner (soi-même), administrateur_financier, technicien_informatique | `{paymentMethod?, paymentReference?, fundingEndDate?}` | `200 {profileType mise à jour}` · `400` · `401` · `403` · `404` |

Valeurs `profileType` : `limite` (compte non encore activé — inscription non payée) · `membre` (inscription payée).
Valeurs `paymentMethod` : `cb` · `virement` · `paypal`.

### Paiements

| Méthode | Chemin | Description | Auth | Body | Réponse attendue |
|---|---|---|---|---|---|
| POST | /payments | Initier un paiement (inscription, abonnement, versement ponctuel) | 🔒 | `{paymentType, amountCents, externalReference?, correlationId?}` | `201 {payment, invoice}` · `400` validation · `401` · `409` doublon inscription (FIN-AC-002) |

Règles métier :
- Une inscription confirmée : crée/upgrade le profil financier en `membre`, génère une `Invoice`, un `FinancialArchiveItem`, crédite des points (1 pt/€) et publie `PaymentConfirmed` + `InvoiceIssued`.
- Un seul paiement `inscription` confirmé par financeur est autorisé (`409` si doublon).
- Valeurs `paymentType` : `inscription` · `abonnement` · `versement_ponctuel`.

### Archives financières

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /financial-archives/:ownerId | Lister les archives financières d'un financeur | 🔒 | owner (soi-même), administrateur_financier, responsable_pedagogique, technicien_informatique | `200 [{id, ownerId, itemType, referenceId, label, amountCents, balanceSnapshot, occurredAt}]` · `401` · `403` |

Les archives sont triées par `occurredAt DESC`. Types d'items : `payment` · `invoice` · `ledger_entry`.

### Healthcheck

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| GET | /health | Vérifier l'état du service | Non |

### API interne inter-services (non exposée via nginx)

> Exclue de Swagger (`@ApiExcludeController`). Protégée par `X-Internal-Secret: <INTERNAL_SECRET>`.
> Utilisée par orchestration-service et legal-document-service pour conditionner le statut membre.

| Méthode | Chemin | Description | Header requis | Réponse attendue |
|---|---|---|---|---|
| POST | /internal/check-payment-status/:ownerId | Vérifier si l'inscription est payée pour un financeur | `X-Internal-Secret` | `200 {isPaid: bool, paymentId: string\|null}` · `401` |

### Événements publiés

`PaymentConfirmed` · `InvoiceIssued` · `PointsCredited`

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

---

## legal-document-service

Gère les mandats clients, contrats formateurs, modèles légaux et enregistrements de signature.

Règles métier clés :
- `LDS-BR-001` : seul `administrateur_financier` peut créer ou modifier les modèles.
- `LDS-BR-002` : la signature est unique et non rejouable — toute re-signature retourne HTTP 409.
- `LDS-BR-003` : un mandat client signé (`MANDAT_CLIENT`) conditionne la validation du compte membre.
- `LDS-BR-004` : un contrat formateur signé (`CONTRAT_FORMATEUR`) conditionne la validation du formateur.

Statuts de document : `A_SIGNER` → `SIGNE` (transition unique, irréversible).

Types de documents : `MANDAT_CLIENT`, `CONTRAT_FORMATEUR`.

### Documents légaux

| Méthode | Chemin | Description | Auth | Rôles | Body / Params | Réponse attendue |
|---|---|---|---|---|---|---|
| GET | /legal-documents/:ownerId | Lister les documents légaux d'un utilisateur | 🔒 | Propriétaire, RP, TI, AF | Path: `ownerId` | `200 [{id, ownerId, documentType, status, templateId, templateVersion, signatureRecord?, createdAt}]` · `401` · `403 LDS-FB-001` |
| POST | /legal-documents/:id/sign | Signer un document (transition A_SIGNER → SIGNE) | 🔒 | Propriétaire du document uniquement | Path: `id` · Body: `{signerName, signerEmail?}` | `201 {legalDocument, signatureRecord}` · `403 LDS-FB-002` · `404` · `409 LDS-BR-002 déjà signé` |

### Modèles légaux

| Méthode | Chemin | Description | Auth | Rôles | Body / Params | Réponse attendue |
|---|---|---|---|---|---|---|
| POST | /legal-templates | Créer un modèle légal | 🔒 | `administrateur_financier` uniquement | Body: `{title, documentType, content}` | `201 {id, title, documentType, version: 1, content, isActive, createdBy, createdAt}` · `400` · `403 LDS-BR-001` |
| PATCH | /legal-templates/:id | Modifier un modèle (incrémente la version) | 🔒 | `administrateur_financier` uniquement | Path: `id` · Body: `{title?, content?}` | `200 {id, title, documentType, version: N+1, content, lastModifiedBy, updatedAt}` · `403 LDS-BR-001` · `404` |

### API interne inter-services (non exposée via nginx)

> Exclue de Swagger (`@ApiExcludeController`). Protégée par `X-Internal-Secret: <INTERNAL_SECRET>`.
> Utilisée par orchestration-service dans les workflows d'onboarding et de validation.

| Méthode | Chemin | Description | Header requis | Réponse attendue |
|---|---|---|---|---|
| GET | /internal/check-signature-status/:ownerId | Vérifier si les documents requis sont signés pour un utilisateur | `X-Internal-Secret` | `200 {ownerId, mandatClientSigne: bool, contratFormateurSigne: bool, documents[{documentType, status, signedAt?}]}` · `401` |

### Événements publiés (phase 2 — event bus non disponible en dev)

`LegalDocumentSigned` · `LegalTemplateUpdated` · `SecureCopyStored`

---

## finance-credit-service

Phase 2 — Gestion des profils financiers, paiements, factures et archives financières.

Toutes les routes 🔒 nécessitent `Authorization: Bearer <access_token>`.

### Profils financiers

| Méthode | Chemin | Description | Auth | Rôles autorisés | Body / Params | Réponse attendue |
|---|---|---|---|---|---|---|
| GET | /financial-profiles/:ownerId | Lire le profil financier d'un financeur | 🔒 | owner (soi-même), administrateur_financier, responsable_pedagogique, technicien_informatique | — | `200 {id, ownerId, profileType, pointsBalance, fundingEndDate, paymentMethod, paymentReference}` · `401` · `403` · `404` |
| PATCH | /financial-profiles/:ownerId | Modifier les moyens de paiement ou paramètres | 🔒 | owner (soi-même), administrateur_financier, technicien_informatique | `{paymentMethod?, paymentReference?, fundingEndDate?}` | `200 {profileType mise à jour}` · `400` · `401` · `403` · `404` |

Valeurs `profileType` : `limite` (compte non encore activé — inscription non payée) · `membre` (inscription payée).
Valeurs `paymentMethod` : `cb` · `virement` · `paypal`.

### Paiements

| Méthode | Chemin | Description | Auth | Body | Réponse attendue |
|---|---|---|---|---|---|
| POST | /payments | Initier un paiement (inscription, abonnement, versement ponctuel) | 🔒 | `{paymentType, amountCents, externalReference?, correlationId?}` | `201 {payment, invoice}` · `400` validation · `401` · `409` doublon inscription (FIN-AC-002) |

Règles métier :
- Une inscription confirmée : crée/upgrade le profil financier en `membre`, génère une `Invoice`, un `FinancialArchiveItem`, crédite des points (1 pt/€) et publie `PaymentConfirmed` + `InvoiceIssued`.
- Un seul paiement `inscription` confirmé par financeur est autorisé (`409` si doublon).
- Valeurs `paymentType` : `inscription` · `abonnement` · `versement_ponctuel`.

### Archives financières

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /financial-archives/:ownerId | Lister les archives financières d'un financeur | 🔒 | owner (soi-même), administrateur_financier, responsable_pedagogique, technicien_informatique | `200 [{id, ownerId, itemType, referenceId, label, amountCents, balanceSnapshot, occurredAt}]` · `401` · `403` |

Les archives sont triées par `occurredAt DESC`. Types d'items : `payment` · `invoice` · `ledger_entry`.

### Healthcheck

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| GET | /health | Vérifier l'état du service | Non |

### API interne inter-services (non exposée via nginx)

> Exclue de Swagger (`@ApiExcludeController`). Protégée par `X-Internal-Secret: <INTERNAL_SECRET>`.
> Utilisée par orchestration-service et legal-document-service pour conditionner le statut membre.

| Méthode | Chemin | Description | Header requis | Réponse attendue |
|---|---|---|---|---|
| POST | /internal/check-payment-status/:ownerId | Vérifier si l'inscription est payée pour un financeur | `X-Internal-Secret` | `200 {isPaid: bool, paymentId: string\|null}` · `401` |

### Événements publiés

`PaymentConfirmed` · `InvoiceIssued` · `PointsCredited`

---

## archive-document-service

Phase 2 — Archives pédagogiques chronologiques et liens durables issus des activités.

Règles métier clés :
- Le parent financeur ne peut pas accéder aux entrées de type `notebook_entry` (carnet personnel réservé à l'élève).
- Les résumés de cours (`course_summary`) sont permanents et restent accessibles après expiration de l'enregistrement vidéo (VID-AC-002).

Types d'items : `pedagogical_log` · `course_summary` · `notebook_entry` · `recording` · `content_catalog`

### Archives pédagogiques

> Préfixe gateway : `/api/v1/archives` → service reçoit `/archives/...`
> Téléchargement : `/api/v1/documents` → service reçoit `/documents/...`

| Méthode | Chemin (via gateway) | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /api/v1/archives/students/:studentId/pedagogical-archives | Lister les archives pédagogiques d'un élève | 🔒 | élève (soi-même), formateur (liés), parent_financeur (hors carnet_personnel), RP, TI, AF | `200 [{id, studentId, itemType, title, description?, downloadUrl?, occurredAt, createdAt, isParentVisible}]` · `401` · `403` |
| POST | /api/v1/archives/students/:studentId/archive-links | Créer un lien d'archive depuis un service source | 🔒 | formateur, RP, AP, TI | `201 {id, studentId, itemType, title, ...}` · `200` idempotent · `400` · `401` · `403` · `409` clé idempotence conflit |
| GET | /api/v1/archives/students/:studentId/archive-timeline | Timeline chronologique des archives (groupée par date) | 🔒 | élève, formateur, parent_financeur (hors carnet_personnel), RP, TI, AF | `200 {data: [{date, items}], page, limit, total, totalPages}` · `401` · `403` |

### Téléchargement

| Méthode | Chemin (via gateway) | Description | Auth | Réponse attendue |
|---|---|---|---|---|
| GET | /api/v1/documents/:id/download | Télécharger un document d'archive (redirection 302 vers URL source) | 🔒 | Selon rôle et type d'archive | `302` redirect · `401` · `403` carnet_personnel interdit au parent · `404` introuvable ou pas d'URL |
