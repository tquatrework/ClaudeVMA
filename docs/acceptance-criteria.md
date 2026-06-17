## Auth service
- [ ] Login avec email/password → JWT valide 24h
- [ ] Refresh token révocable
- [ ] Rate limiting : 5 tentatives / 10 min par IP

## Order service  
- [ ] Commande impossible si stock < 1
- [ ] Notification async sous 30s après confirmation

## Profile service

### Profils administratifs et pédagogiques
- [ ] PROF-BR-001 — Chaque élève possède un profil administratif créé à l'inscription
- [ ] PROF-BR-002 — Chaque élève possède un profil pédagogique décrivant sa situation et sa mission
- [ ] PROF-BR-003 — Chaque formateur possède un profil administratif créé à l'inscription
- [ ] PROF-BR-004 — Chaque formateur possède un profil pédagogique (niveau, expérience, résultats aux tests)
- [ ] PROF-BR-008 — Un formateur promu AP voit `isAnimateurPedagogique: true` dans son profil pédagogique

### Relations métier
- [ ] PROF-BR-005 — Un financeur peut être relié à plusieurs élèves ; la liaison est idempotente (doublon → 409)
- [ ] PROF-BR-006 — Un élève peut avoir plusieurs formateurs liés ; la liaison est idempotente (doublon → 409)
- [ ] PROF-BR-007 — Dans la relation formateur-élève, le flag `isPrincipalTeacher` peut être positionné à `true`

### Contrôle d'accès aux profils (PROF-BR-011, PROF-BR-012)
- [ ] PROF-RA-001 — Un élève peut lire et modifier ses propres profils administratif et pédagogique ; il ne peut pas modifier ceux d'un autre utilisateur (→ 403)
- [ ] PROF-RA-002 — Un parent financeur lié peut consulter le profil de chaque élève auquel il est rattaché (→ 200)
- [ ] PROF-RA-003 — Un formateur lié peut consulter le profil de l'élève auquel il est rattaché (→ 200)
- [ ] PROF-BR-011 — Le parent voit tout ce qui concerne les élèves liés, sauf le carnet personnel (champ `personalNotebook` / `carnetPersonnel` absent de la réponse)

### Cas interdits
- [ ] PROF-FB-001 — Le parent ne voit jamais le carnet personnel de l'élève (champ absent de GET /profiles/:userId pour un parent)
- [ ] PROF-FB-002 — Les notes internes RP/finance ne sont pas visibles dans GET /profiles/:userId pour un élève ou un formateur (champ `internalNotes` absent)
- [ ] PROF-FB-003 — Un formateur non lié à un élève reçoit 403 sur GET /profiles/:userId de cet élève

### Notes internes
- [ ] PROF-BR-009 — Un RP peut créer une note interne sur n'importe quel profil (→ 201 avec `authorId` et `content`)
- [ ] PROF-BR-010 — Un administrateur financier peut créer une note interne sur les profils formateurs/financiers (→ 201)
- [ ] PROF-BR-009/010 — Un élève, un parent et un formateur ne peuvent pas créer de note interne (→ 403)

### Point en suspens
- [ ] PROF-BR-012 — Vue filtrée par rôle du lecteur (retour partiel des champs selon droits) — non implémenté Phase 1, tests à créer en Phase 2

---

## identity-access-service

### Authentification et tokens
- [ ] IAS-AUTH-001 — POST /auth/login avec email/password valides retourne `{access_token, refresh_token, user: {id, email, role, validationStatus}}` (→ 200)
- [ ] IAS-AUTH-002 — POST /auth/login avec mot de passe incorrect retourne 401
- [ ] IAS-AUTH-003 — POST /auth/refresh avec un refresh_token valide retourne une nouvelle paire de tokens (→ 200)
- [ ] IAS-AUTH-004 — POST /auth/refresh avec un refresh_token révoqué ou expiré retourne 401
- [ ] IAS-AUTH-005 — POST /auth/logout révoque la session ; un appel ultérieur à GET /auth/me avec l'ancien token retourne 401
- [ ] IAS-AUTH-006 — GET /auth/me sans token retourne 401 ; avec token valide retourne l'identité courante (→ 200)
- [ ] IAS-AUTH-007 — Rate limiting : après 5 tentatives de login échouées en 10 min depuis la même IP, la 6e tentative retourne 429

### Création de compte
- [ ] IAS-BR-001 — POST /accounts avec `{email, password, role: "eleve"}` crée un compte avec `validationStatus: "pending"` (→ 201)
- [ ] IAS-BR-002 — Seuls les rôles `eleve`, `parent_financeur` et `formateur` peuvent être auto-inscrits ; un rôle `responsable_pedagogique` ou `technicien_informatique` en body retourne 403
- [ ] IAS-BR-003 — POST /accounts avec un email déjà existant retourne 409
- [ ] IAS-BR-004 — POST /accounts sans email ou sans password retourne 400

### Consentements et validation
- [ ] IAS-BR-005 — POST /consents avec `consentType: "rgpd"` puis POST /consents avec `consentType: "cgu"` fait passer `validationStatus` à `active` automatiquement (→ GET /auth/me renvoie `validationStatus: "active"`)
- [ ] IAS-BR-006 — Un compte avec `validationStatus: "pending"` ne peut pas accéder aux routes protégées par les autres services (JWT rejeté ou statut non actif)
- [ ] IAS-BR-007 — Le consentement `marketing` est optionnel : son absence n'empêche pas le passage à `active`
- [ ] IAS-BR-008 — GET /consents sans token retourne 401 ; avec token retourne la liste des consentements signés par le compte courant

### Gestion des comptes (rôles internes)
- [ ] IAS-RA-001 — GET /accounts/:accountId est accessible uniquement aux rôles `technicien_informatique`, `responsable_pedagogique`, `administrateur_financier` ; un élève reçoit 403
- [ ] IAS-RA-002 — PUT /accounts/:accountId/roles est accessible uniquement aux rôles `responsable_pedagogique` et `technicien_informatique` ; un formateur reçoit 403
- [ ] IAS-RA-003 — PUT /accounts/:accountId/validate est accessible uniquement aux rôles `responsable_pedagogique` et `technicien_informatique`
- [ ] IAS-RA-004 — PUT /accounts/:accountId/suspend est accessible uniquement au rôle `technicien_informatique` ; un RP reçoit 403
- [ ] IAS-RA-005 — GET /accounts/:accountId/audit est accessible uniquement aux rôles `responsable_pedagogique` et `technicien_informatique`

### API interne
- [ ] IAS-INT-001 — POST /internal/create-account sans header `X-Internal-Secret` retourne 401 ou 403
- [ ] IAS-INT-002 — POST /internal/create-account avec secret valide crée un compte et retourne `{accountId, email, role}` (→ 201)

### Événements publiés
- [ ] IAS-EVT-001 — Un événement `AccountCreated` est publié après création de compte réussie
- [ ] IAS-EVT-002 — Un événement `ConsentSigned` est publié après chaque signature de consentement
- [ ] IAS-EVT-003 — Un événement `AccountValidated` est publié quand le compte passe à `active`

---

## teacher-request-service

### Création de demande
- [ ] TR-BR-001 — POST /requests avec body valide crée une demande avec `status: "pending"` (→ 201)
- [ ] TR-BR-002 — POST /requests sans token retourne 401
- [ ] TR-BR-003 — POST /requests sans body ou avec body incomplet retourne 400

### Lecture des demandes
- [ ] TR-BR-004 — GET /requests retourne la liste des demandes accessibles selon le rôle de l'appelant (→ 200)
- [ ] TR-BR-005 — GET /requests/:id sur une demande inexistante retourne 404
- [ ] TR-BR-006 — GET /requests/:id retourne le détail d'une demande existante avec son statut courant (→ 200)

### Transitions de statut
- [ ] TR-BR-007 — PATCH /requests/:id/status avec `status: "accepted"` depuis l'état `pending` fait passer la demande en `accepted` (→ 200)
- [ ] TR-BR-008 — PATCH /requests/:id/status avec `status: "declined"` depuis l'état `pending` fait passer la demande en `declined` (→ 200)
- [ ] TR-BR-009 — PATCH /requests/:id/status avec une transition invalide (ex. `accepted` → `pending`) retourne 422 ou 400
- [ ] TR-BR-010 — PATCH /requests/:id/status sur une demande inexistante retourne 404

### Contrôle d'accès par rôle
- [ ] TR-BR-011 — Seul un RP peut passer une demande en `cancelled` ; un parent ou élève qui tente ce changement reçoit 403
- [ ] TR-BR-012 — Un élève ou un parent ne peut lire que les demandes qui le concernent ; une demande appartenant à un autre utilisateur retourne 403

### Suppression
- [ ] TR-BR-013 — DELETE /requests/:id sur une demande existante retourne 200 ou 204
- [ ] TR-BR-014 — DELETE /requests/:id sur une demande inexistante retourne 404

---

## calendar-service

### Création d'activité
- [ ] CAL-BR-001 — POST /calendar avec les champs requis (date, durée, participants) crée une séance (→ 201)
- [ ] CAL-BR-002 — POST /calendar sans token retourne 401
- [ ] CAL-BR-003 — POST /calendar avec des champs manquants retourne 400
- [ ] CAL-BR-004 — Un événement `ActivityScheduled` est publié après création réussie

### Lecture du calendrier
- [ ] CAL-BR-005 — GET /calendar retourne la liste des séances accessibles selon le rôle du demandeur (→ 200)
- [ ] CAL-BR-006 — GET /calendar?teacherId=X filtre les séances du formateur X (→ 200 avec liste filtrée)
- [ ] CAL-BR-007 — GET /calendar?studentId=X filtre les séances de l'élève X (→ 200 avec liste filtrée)
- [ ] CAL-BR-008 — GET /calendar/:id retourne le détail d'une séance existante (→ 200)
- [ ] CAL-BR-009 — GET /calendar/:id sur une séance inexistante retourne 404

### Modification et suppression
- [ ] CAL-BR-010 — PATCH /calendar/:id modifie une séance existante et publie `ActivityUpdated` (→ 200)
- [ ] CAL-BR-011 — PATCH /calendar/:id sur une séance inexistante retourne 404
- [ ] CAL-BR-012 — DELETE /calendar/:id supprime une séance existante (→ 200 ou 204)
- [ ] CAL-BR-013 — DELETE /calendar/:id sur une séance inexistante retourne 404

### Contrôle d'accès
- [ ] CAL-RA-001 — Un formateur ne peut voir que les séances auxquelles il est associé ; les séances d'autres formateurs retournent 403 ou une liste vide selon le filtre
- [ ] CAL-RA-002 — Un élève ne peut voir que ses propres séances ; les séances d'un autre élève retournent 403 ou liste vide

### Événements publiés
- [ ] CAL-EVT-001 — Un événement `AvailabilityUpdated` est publié lors d'un changement de disponibilité
- [ ] CAL-EVT-002 — Un événement `ReminderCreated` est publié lors de la création d'un rappel

---

## dashboard-notification-service

### Création de notification
- [ ] DASH-BR-001 — POST /notifications avec body valide crée une notification (→ 201)
- [ ] DASH-BR-002 — POST /notifications sans token retourne 401
- [ ] DASH-BR-003 — POST /notifications sans body requis retourne 400

### Lecture des notifications
- [ ] DASH-BR-004 — GET /notifications/user/:userId retourne la liste des notifications de l'utilisateur (→ 200)
- [ ] DASH-BR-005 — Un utilisateur ne peut lire que ses propres notifications ; GET /notifications/user/:autreUserId retourne 403 pour un utilisateur non autorisé
- [ ] DASH-BR-006 — Les notifications reflètent les signaux métier attendus : une nouvelle demande professeur génère une notification pour le RP

### Marquage comme lu
- [ ] DASH-BR-007 — PATCH /notifications/:id/read marque une notification comme lue (→ 200)
- [ ] DASH-BR-008 — PATCH /notifications/:id/read sur une notification inexistante retourne 404
- [ ] DASH-BR-009 — PATCH /notifications/user/:userId/read-all marque toutes les notifications de l'utilisateur comme lues (→ 200)

### Suppression
- [ ] DASH-BR-010 — DELETE /notifications/:id supprime une notification existante (→ 200 ou 204)
- [ ] DASH-BR-011 — DELETE /notifications/:id sur une notification inexistante retourne 404

### Événements consommés
- [ ] DASH-EVT-001 — La réception de l'événement `AccountCreated` provoque la création d'une notification ou l'initialisation d'un tableau de bord pour l'utilisateur concerné
- [ ] DASH-EVT-002 — La réception de l'événement `TeacherRequestCreated` génère une notification visible pour le RP

---

## communication-service

### Envoi de message
- [x] COM-BR-001 — POST /messages avec body valide envoie un message entre deux contacts autorisés (→ 201)
- [x] COM-BR-002 — POST /messages sans token retourne 401
- [x] COM-BR-003 — POST /messages avec un destinataire non autorisé (hors contacts métier liés) retourne 403
- [x] COM-BR-004 — POST /messages sans body requis retourne 400

### Lecture des conversations
- [x] COM-BR-005 — GET /messages/conversation/:id retourne la liste des messages d'une conversation (→ 200)
- [x] COM-BR-006 — GET /messages/conversation/:id pour une conversation à laquelle l'appelant n'appartient pas retourne 403
- [x] COM-BR-007 — GET /messages/conversation/:id sur une conversation inexistante retourne 404

### Marquage comme lu
- [x] COM-BR-008 — PATCH /messages/:id/read marque un message comme lu (→ 200)
- [x] COM-BR-009 — PATCH /messages/:id/read sur un message inexistant retourne 404

### Contacts autorisés
- [x] COM-RA-001 — Un élève ne peut envoyer de message qu'aux contacts issus de ses relations métier (formateur lié, parent lié, RP) ; un contact non lié retourne 403
- [x] COM-RA-002 — Un parent ne peut envoyer de message qu'aux contacts associés à ses élèves (formateur, RP) ; un formateur non lié retourne 403

---

## video-session-service

### Création de salle
- [ ] VID-BR-001 — POST /video/rooms avec les informations d'activité liée crée une salle de visio (→ 201)
- [ ] VID-BR-002 — POST /video/rooms sans token retourne 401
- [ ] VID-BR-003 — POST /video/rooms sans body requis retourne 400

### Accès à une salle
- [ ] VID-BR-004 — GET /video/rooms/:id retourne les informations d'une salle existante (→ 200)
- [ ] VID-BR-005 — GET /video/rooms/:id sur une salle inexistante retourne 404
- [ ] VID-BR-006 — POST /video/rooms/:id/join génère un accès pour un participant autorisé (→ 200 avec lien ou token d'accès)
- [ ] VID-BR-007 — POST /video/rooms/:id/join pour un utilisateur non autorisé (non participant à l'activité liée) retourne 403

### Contrôle d'accès par rôle
- [ ] VID-RA-001 — Le parent n'a pas d'accès à la salle de visio ; POST /video/rooms/:id/join avec un token parent retourne 403
- [ ] VID-RA-002 — Seuls l'élève et le formateur associés à l'activité peuvent rejoindre la salle

### Clôture de session
- [ ] VID-BR-008 — POST /video/rooms/:id/end clôture la session et trace la présence des participants (→ 200)
- [ ] VID-BR-009 — POST /video/rooms/:id/end sur une salle inexistante retourne 404
- [ ] VID-BR-010 — POST /video/rooms/:id/end publie un événement de fin de session exploitable par le cahier de texte (pedagogical-log-service)

---

## pedagogical-log-service

### Création d'entrée
- [ ] PLOG-BR-001 — POST /logs avec body valide crée une entrée de cahier de texte (→ 201)
- [ ] PLOG-BR-002 — POST /logs sans token retourne 401
- [ ] PLOG-BR-003 — POST /logs sans body requis retourne 400

### Lecture des logs
- [ ] PLOG-BR-004 — GET /logs/student/:studentId retourne les entrées de cahier de texte de l'élève (→ 200)
- [ ] PLOG-BR-005 — GET /logs/session/:sessionId retourne les entrées liées à une séance visio (→ 200)
- [ ] PLOG-BR-006 — GET /logs/:id retourne le détail d'une entrée existante (→ 200)
- [ ] PLOG-BR-007 — GET /logs/:id sur une entrée inexistante retourne 404

### Carnet personnel
- [ ] PLOG-BR-008 — Une entrée de type carnet personnel (`type: "personal_notebook"` ou équivalent) n'est lisible que par l'élève propriétaire ; un parent qui tente d'y accéder reçoit 403
- [ ] PLOG-BR-009 — Un formateur lié à l'élève peut lire les entrées de cahier de texte mais pas le carnet personnel (→ 403)

### Contrôle d'accès
- [ ] PLOG-RA-001 — Un formateur lié peut créer une entrée de cahier de texte pour un élève qu'il suit (→ 201)
- [ ] PLOG-RA-002 — Un formateur non lié à l'élève reçoit 403 sur POST /logs pour cet élève
- [ ] PLOG-RA-003 — Un parent lié peut lire les entrées de cahier de texte de son élève (hors carnet personnel) ; un parent non lié reçoit 403
- [ ] PLOG-RA-004 — GET /logs/student/:studentId sans token retourne 401

---

## orchestration-service

### Commandes d'intégration
- [ ] ORCH-CMD-001 — dispatch() d'une commande réussie enregistre la commande, appelle le service cible et enregistre la clé d'idempotence
- [ ] ORCH-CMD-002 — dispatch() d'une commande en échec marque dispatched: false, stocke l'erreur et n'enregistre pas la clé d'idempotence
- [ ] ORCH-CMD-003 — dispatch() avec une clé d'idempotence déjà enregistrée retourne la commande existante sans rappel HTTP
- [ ] ORCH-CMD-004 — dispatch() sans correlationId génère un UUID et le stocke sur la commande
- [ ] ORCH-CMD-005 — dispatch() avec correlationId fourni propage ce correlationId vers le service cible
- [ ] ORCH-CMD-006 — findByCorrelation() retourne les commandes associées au correlationId, triées par createdAt ASC

### Événements d'intégration
- [ ] ORCH-EVT-001 — record() crée et sauvegarde un IntegrationEvent avec eventType, correlationId, direction, payload et processed: false
- [ ] ORCH-EVT-002 — record() d'un événement CONSUMED n'exige pas de sourceService
- [ ] ORCH-EVT-003 — markProcessed() met à jour la propriété processed à true pour l'événement ciblé
- [ ] ORCH-EVT-004 — findByCorrelation() retourne les événements triés chronologiquement par occurredAt ASC

### Traçage de corrélation
- [ ] ORCH-TRACE-001 — record() crée une trace avec tous les champs fournis (correlationId, entityType, action, metadata, actor)
- [ ] ORCH-TRACE-002 — record() sans options explicites utilise isTiOverride: false par défaut
- [ ] ORCH-TRACE-003 — record() avec isTiOverride: true conserve ce flag pour auditer les forcages TI
- [ ] ORCH-TRACE-004 — findByCorrelation() retourne les traces triées par occurredAt ASC

### Client HTTP inter-services
- [ ] ORCH-HTTP-001 — buildStepIdempotencyKey() génère une clé au format wf:<instanceId>:step:<order>
- [ ] ORCH-HTTP-002 — call() vers un service configuré envoie vers /internal/<action> avec les headers x-correlation-id, x-idempotency-key et x-internal-secret
- [ ] ORCH-HTTP-003 — call() sans idempotencyKey n'envoie pas le header x-idempotency-key
- [ ] ORCH-HTTP-004 — call() retourne success: false et extrait l'erreur depuis response.data.message en cas d'erreur HTTP
- [ ] ORCH-HTTP-005 — call() utilise err.message comme erreur de repli quand response.data.message est absent
- [ ] ORCH-HTTP-006 — call() vers un service sans URL configurée retourne success: true avec { skipped: true } sans appel HTTP

### Moteur de workflow
- [ ] ORCH-WF-ENGINE-001 — startWorkflow() avec un type inconnu lève une erreur
- [ ] ORCH-WF-ENGINE-002 — startWorkflow() crée une instance et publie l'événement WorkflowStarted
- [ ] ORCH-WF-ENGINE-003 — executeWorkflow() marque le workflow COMPLETED quand toutes les étapes réussissent
- [ ] ORCH-WF-ENGINE-004 — executeWorkflow() déclenche la compensation et marque COMPENSATED quand une étape requise échoue
- [ ] ORCH-WF-ENGINE-005 — executeWorkflow() saute les étapes optionnelles qui échouent et continue jusqu'à COMPLETED
- [ ] ORCH-WF-ENGINE-006 — executeWorkflow() réutilise la sortie idempotente sans appel HTTP supplémentaire
- [ ] ORCH-WF-ENGINE-007 — executeWorkflow() retente une étape jusqu'à maxAttempts avant de la marquer FAILED
- [ ] ORCH-WF-ENGINE-008 — suspendForArbitration() passe le workflow en NEEDS_ARBITRATION et trace l'événement
- [ ] ORCH-WF-ENGINE-009 — resumeAfterArbitration() repasse en IN_PROGRESS et trace isTiOverride quand TI force la reprise

### Contrôleur de workflows
- [ ] ORCH-WF-001 — POST /workflows/:workflowId/start sur un type connu démarre le workflow et retourne l'instance (→ 202)
- [ ] ORCH-WF-002 — POST /workflows/:workflowId/start sur un type inconnu retourne 404
- [ ] ORCH-WF-003 — POST /workflows/:workflowId/start utilise l'identité JWT comme initiatedBy quand absent du body
- [ ] ORCH-WF-004 — GET /workflows/:workflowInstanceId retourne l'instance avec ses étapes (→ 200)
- [ ] ORCH-WF-005 — GET /workflows/:workflowInstanceId sur une instance inexistante retourne 404
- [ ] ORCH-WF-006 — POST /workflows/:workflowInstanceId/suspend suspend le workflow et retourne status: needs_arbitration
- [ ] ORCH-WF-007 — POST /workflows/:workflowInstanceId/resume avec tiOverride: true reprend le workflow et trace le forcage TI
- [ ] ORCH-WF-008 — POST /workflows/:workflowInstanceId/resume sans tiOverride utilise false par défaut
- [ ] ORCH-WF-009 — GET /workflows retourne la liste résumée de toutes les définitions disponibles
- [ ] ORCH-WF-010 — GET /workflows inclut les quatre workflows de phase 1

### Callbacks externes
- [ ] ORCH-CB-001 — POST /callbacks/:provider enregistre l'événement CONSUMED avec le body et retourne received: true
- [ ] ORCH-CB-002 — POST /callbacks/:provider accepte correlation_id (snake_case) comme fallback de correlationId
- [ ] ORCH-CB-003 — POST /callbacks/:provider génère un correlationId UUID quand aucun n'est fourni
- [ ] ORCH-CB-004 — POST /callbacks/:provider utilise <provider>.callback comme eventType quand eventType est absent
- [ ] ORCH-CB-005 — POST /callbacks/:provider accepte event_type (snake_case) comme fallback de eventType

### Middleware de corrélation
- [ ] ORCH-MW-001 — Le middleware propage le header x-correlation-id existant vers req.correlationId et la réponse
- [ ] ORCH-MW-002 — Le middleware génère un UUID et le définit sur req.correlationId et la réponse quand le header est absent
- [ ] ORCH-MW-003 — Deux requêtes consécutives sans header reçoivent des correlationId différents