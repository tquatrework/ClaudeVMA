# VisioMath — Référence des routes Phase 1

Toutes les routes sont préfixées par `/api/v1/` via le gateway.
Les routes marquées 🔒 nécessitent un header `Authorization: Bearer <token>`.

---

## identity-access-service

Préfixes gateway : `/api/v1/auth/` (public) · `/api/v1/accounts` (public inscription) · `/api/v1/accounts/check-email` (public) · `/api/v1/accounts/` (🔒) · `/api/v1/consents` (🔒) → identity-access-service

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

> Décision d'architecture du 2026-08-06 (précision apportée après un premier revirement trop large du
> 2026-08-05/2026-08-06, voir `docs/architecture.md` > "Arbitrages rendus") : `firstName`/`lastName`/`phone`
> restent la propriété exclusive de profile-service — identity-access-service ne les persiste **jamais**
> localement (colonnes `first_name`/`last_name`/`phone` supprimées de `users`, aucun consommateur
> interne n'y a accès). Seules les **3 routes d'auto-inscription directe par rôle** ci-dessous
> (`POST /accounts/students`, `POST /accounts/teachers`, `POST /accounts/parents` — celles utilisées par
> le front d'inscription) acceptent `firstName`/`lastName`/`phoneNumber` en entrée, uniquement pour les
> relayer immédiatement à profile-service via `POST /internal/create-administrative-profile` (voir plus
> bas), dans la même transaction locale que la création de compte. La route générique
> `POST /accounts` et la route interne `POST /internal/create-account` (utilisée par
> orchestration-service dans les workflows `student-onboarding`/`teacher-onboarding`, qui transmet ces
> champs séparément et directement à profile-service) **ne collectent pas** ces champs — les envoyer
> renvoie `400` (champs non reconnus rejetés par `whitelist: true`, jamais silencieusement ignorés).

| Méthode | Chemin | Description | Auth | Rôles | Body |
|---|---|---|---|---|---|
| GET | /accounts/check-email | Vérifier la disponibilité d'un email | Non | — | Query: `email` |
| POST | /accounts | Créer un compte générique (auto-inscription, non utilisée par le front) | Non | — | `{email, password, role?, loginIdentifier?}` |
| POST | /accounts/students | Créer un compte élève (+ parent optionnel) | Non | — | `{email, password, firstName, lastName, phoneNumber?, loginIdentifier?, isMember?, parentLoginIdentifier?, parentEmail?, parentPassword?, parentFirstName?, parentLastName?}` |
| POST | /accounts/teachers | Créer un compte formateur | Non | — | `{email, password, firstName, lastName, phoneNumber?, loginIdentifier?, cvReference?}` |
| POST | /accounts/parents | Créer un compte parent / financeur (+ élève optionnel) | Non | — | `{email, password, firstName, lastName, phoneNumber?, studentLoginIdentifier?, studentEmail?, studentPassword?, studentFirstName?, studentLastName?}` |
| GET | /accounts/:accountId | Lire un compte | 🔒 | TI, RP, AdministrateurFinancier | — |
| PUT | /accounts/:accountId/roles | Changer le rôle | 🔒 | RP, TI | `{role}` |
| PUT | /accounts/:accountId/validate | Valider un compte | 🔒 | RP, TI | — |
| PUT | /accounts/:accountId/suspend | Suspendre un compte | 🔒 | TI | — |
| GET | /accounts/:accountId/audit | Journal d'audit | 🔒 | RP, TI | — |

`firstName` et `lastName` sont obligatoires (chaînes non vides, 100 caractères max) sur les 3 routes
d'auto-inscription directe ci-dessus (`students`/`teachers`/`parents`) — `400` si absents ou vides.
`phoneNumber` y est optionnel (chiffres/espaces/`+`/`-`/`.`/parenthèses, 6 à 30 caractères — `400` si
format invalide). `POST /accounts` ne les accepte pas du tout (`400` si envoyés, whitelist stricte).

**`POST /accounts/students` — élève + parent dans le même appel :**
- `parentLoginIdentifier` : lie un compte parent **existant** par identifiant (`404` si introuvable). Prioritaire sur `parentEmail`.
- `parentEmail` (sans `parentLoginIdentifier`) : `0` compte correspondant → crée un nouveau compte parent (`parentFirstName`/`parentLastName` alors **obligatoires**, `400` sinon ; `parentPassword` optionnel, retombe sur `password` sinon) ; `1` compte correspondant → lie ce compte existant (les champs `parentFirstName`/`parentLastName` fournis sont ignorés, le profil existant n'est jamais écrasé) ; `2+` comptes → `409` (utiliser `parentLoginIdentifier`).
- Élève et parent sont créés/liés dans **une seule transaction** : tout échec (parent introuvable, email ambigu, `503` profile-service) annule l'élève ET le parent.
- Quand un parent est lié ou créé dans le même appel, la relation financeur/élève (`finance-owner-student`) est créée **automatiquement et immédiatement côté profile-service, sans flow de demande** (contrairement à `POST /parent-link-requests` côté profile-service, réservé au rattachement après coup entre comptes existants non liés à l'inscription).

**`POST /accounts/parents` — parent + élève dans le même appel (symétrique du point ci-dessus) :**
- `studentLoginIdentifier` : lie un compte élève **existant** par identifiant (`404` si introuvable). Prioritaire sur `studentEmail`.
- `studentEmail` (sans `studentLoginIdentifier`) : `0` compte correspondant → crée un nouveau compte élève (`studentFirstName`/`studentLastName` alors **obligatoires**, `400` sinon ; `studentPassword` optionnel, retombe sur `password` sinon) ; `1` compte correspondant → lie ce compte existant (mêmes garanties que côté élève : jamais écrasé) ; `2+` comptes → `409` (utiliser `studentLoginIdentifier`).
- Mêmes garanties d'atomicité et de liaison automatique finance-owner-student que `POST /accounts/students`.

Règles métier : seuls `eleve`, `parent_financeur` et `formateur` peuvent être auto-inscrits (IAM-FB-002). La validation nécessite les consentements RGPD+CGU signés (IAM-FB-003).

Réponse (compte simple) : `{id, loginIdentifier, email, role, validationStatus, consentSigned, isActive, createdAt}` (`emailAlreadyUsed`/`suggestedLoginIdentifier` optionnels — **ne contient jamais `firstName`/`lastName`/`phone`**, propriété exclusive de profile-service, même sur les 3 routes qui les collectent en entrée).
Réponse `POST /accounts/students` : `{student, parent}` où `student` est au format ci-dessus et `parent` est soit `null`, soit `{...student-like, created: boolean}` (`created: true` si un nouveau compte parent a été créé, `false` s'il a été lié à un compte existant).
Réponse `POST /accounts/parents` : `{parent, student}`, symétrique — `parent` au format ci-dessus, `student` soit `null` soit `{..., created: boolean}`.

`503 Service Unavailable` sur `POST /accounts/students`, `POST /accounts/teachers` et `POST /accounts/parents` uniquement : profile-service indisponible ou en erreur lors du stockage du profil administratif (ou de la liaison financeur/élève) — la création de compte est **intégralement annulée** (transaction locale rollback), aucun compte orphelin n'est laissé en base. Le client peut réessayer l'appel tel quel. `POST /accounts` n'appelle jamais profile-service et ne renvoie donc pas ce statut.

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
| GET | /internal/accounts | Lister les comptes (filtre `role?`) | `X-Internal-Secret` |
| GET | /internal/accounts/by-login-identifier | Résoudre un compte par `loginIdentifier` | `X-Internal-Secret` |
| GET | /internal/accounts/by-user-id/:userId | Résoudre un compte par `userId` | `X-Internal-Secret` |

Body `POST /internal/create-account` : `{email, password, role?, loginIdentifier?}` — réutilise
`CreateAccountDto`, donc **mêmes règles de validation que `POST /accounts`** : n'accepte pas
`firstName`/`lastName`/`phoneNumber` (`400` si envoyés). C'est la route consommée par
orchestration-service dans les workflows `student-onboarding`/`teacher-onboarding` : ces workflows
transmettent `firstName`/`lastName` séparément et directement à profile-service (jamais via cette
route) — voir la section orchestration-service et `docs/architecture.md` > "Arbitrages rendus".

Réponse `POST /internal/create-account` : `{accountId, email, role}`
Réponse `GET /internal/accounts/by-user-id/:userId` : `{userId, loginIdentifier, role}` — **ne contient jamais `firstName`/`lastName`/`phone`** (identity-access-service ne les possède pas ; un consommateur qui a besoin de ces champs doit les demander à profile-service).

### Appel sortant vers profile-service (écriture primaire, pas une synchronisation)

> Décision d'architecture du 2026-08-06 : identity-access-service ne conserve **aucune** copie de
> `firstName`/`lastName`/`phone` — profile-service en est l'unique propriétaire. Seules les 3 routes
> d'auto-inscription directe par rôle (`students`/`teachers`/`parents`) déclenchent cet appel sortant ;
> `POST /accounts` et `POST /internal/create-account` ne le déclenchent jamais (ils ne collectent pas
> ces champs).

Après validation de forme (DTO) et avant de retourner `201`, `POST /accounts/students`,
`POST /accounts/teachers` et `POST /accounts/parents` appellent en sortant, **dans la même transaction
locale** que la création du ou des comptes :

1. `POST /internal/create-administrative-profile` sur profile-service avec `{userId, firstName,
   lastName, phone?}` (header `X-Internal-Secret`) — une fois par compte nouvellement créé
   (jamais pour un compte parent/élève simplement **lié** à un compte préexistant : son profil existant
   n'est jamais écrasé par les champs saisis côté élève/parent lors de la liaison). Le champ est nommé
   `phone` côté profile-service (convention déjà établie sur ses autres routes internes) alors que le DTO
   d'entrée public d'identity-access-service utilise `phoneNumber` — seul le mapping effectué au moment
   de cet appel sortant fait la conversion de nom.
2. Si un élève et un parent financeur sont créés/liés dans le même appel (`POST /accounts/students`
   avec `parentLoginIdentifier`/`parentEmail`, ou `POST /accounts/parents` avec
   `studentLoginIdentifier`/`studentEmail`) : `POST /internal/link-parent` sur profile-service avec
   `{studentId, financeOwnerId}` (header `X-Internal-Secret`) — crée la relation finance-owner-student
   immédiatement, sans flow de demande.

Ces appels sont **bloquants et obligatoires** sur ces 3 routes : toute erreur (réseau, timeout 3s, HTTP
non-2xx) fait échouer toute la transaction locale — rollback du ou des comptes tout juste insérés — et
la route retourne `503` au client. Aucun compte créé par l'une de ces 3 routes ne l'est donc jamais sans
que son profil administratif ne soit durablement enregistré côté profile-service. Idempotence côté
profile-service : `create-administrative-profile` est un upsert par `userId`, `link-parent` est
idempotent par paire `(studentId, financeOwnerId)`.

### Événements publiés

`AccountCreated` · `RoleChanged` · `ConsentSigned` · `AccountValidated` · `AccountSuspended`

---

## profile-service

Préfixes gateway : `/api/v1/profiles` · `/api/v1/relations` · `/api/v1/parent-link-requests` (🔒) → profile-service

Rôles disponibles : `eleve`, `parent_financeur`, `formateur`, `animateur_pedagogique`, `responsable_pedagogique`, `technicien_informatique`, `administrateur_financier`

### Profils

| Méthode | Chemin | Auth | Rôles autorisés | Description | Réponse attendue |
|---|---|---|---|---|---|
| GET | /profiles/:userId | 🔒 | eleve (soi-même), formateur (contacts liés), parent_financeur (élèves liés), responsable_pedagogique, animateur_pedagogique, technicien_informatique, administrateur_financier | Lire un profil selon droits. **Strictement en lecture seule** : cette route ne crée jamais rien en base (voir « Existence du profil administratif/pédagogique » dans `docs/architecture.md`) | `200 {userId, loginIdentifier, administrative, pedagogical}` — **clés courtes**, à ne pas confondre avec `administrativeProfile`/`pedagogicalProfile` que renvoient les routes `/internal/*` ; `loginIdentifier` peut être `null` si identity-access-service est injoignable ; `pedagogical` est `null` tant que l'utilisateur n'a pas renseigné son profil pédagogique (**état normal**, ce profil étant facultatif et créé au premier `PUT /profiles/:userId/pedagogical`) · `401` sans token · `403` accès refusé · `404` `userId` inconnu de identity-access-service · `500` compte existant mais sans profil administratif (incohérence de données, loguée côté serveur comme anomalie) |
| PUT | /profiles/:userId/administrative | 🔒 | eleve (soi-même), responsable_pedagogique, technicien_informatique | Modifier le profil administratif (`firstName`/`lastName` restent optionnels pour ne pas modifier le champ, mais rejettent une chaîne vide) | `200 {userId, ...champsAdmin}` · `400` firstName/lastName vide · `401` · `403` · `404` |
| PUT | /profiles/:userId/pedagogical | 🔒 | eleve (soi-même), formateur (soi-même), responsable_pedagogique, technicien_informatique | Modifier le profil pédagogique | `200 {userId, ...champsPedago}` · `401` · `403` · `404` |
| POST | /profiles/:teacherId/ap-status | 🔒 | responsable_pedagogique | Promouvoir un formateur en Animateur Pédagogique | `201 {userId, isAnimateurPedagogique: true}` · `401` · `403` · `404` |
| GET | /profiles/:userId/internal-notes | 🔒 | responsable_pedagogique, animateur_pedagogique, technicien_informatique, administrateur_financier | Lister les notes internes confidentielles (non visibles par l'élève, le parent/financeur ni le formateur) | `200 [{id, authorId, content, createdAt}]` · `401` · `403` |
| POST | /profiles/:userId/internal-notes | 🔒 | responsable_pedagogique, animateur_pedagogique | Créer une note interne confidentielle (non visible par l'élève, le parent/financeur ni le formateur) | `201 {id, authorId, content, createdAt}` · `400` body vide · `401` · `403` |
| PUT | /profiles/:userId/internal-notes/:id | 🔒 | auteur, responsable_pedagogique | Modifier une note interne | `200 {id, authorId, content, updatedAt}` · `401` · `403` · `404` |
| DELETE | /profiles/:userId/internal-notes/:id | 🔒 | responsable_pedagogique | Supprimer une note interne | `204` · `401` · `403` · `404` |

### Validation des formateurs

Machine à trois états : `pending` → `in_review` → `validated` | `rejected`.

- `pending` : état initial d'un formateur nouvellement inscrit. L'absence d'enregistrement de validation équivaut à `pending`.
- `in_review` : le RP a pris le dossier en charge et l'instruit.
- `validated` / `rejected` : états terminaux.

Transitions autorisées (toute autre transition, y compris vers le statut courant, → `403`) :

| Transition | Rôle autorisé | Commentaire |
|---|---|---|
| `pending` → `in_review` | responsable_pedagogique | Prise en charge du dossier. Le TI ne peut pas le faire |
| `in_review` → `validated` | responsable_pedagogique, technicien_informatique | Publie l'événement `TeacherValidated` |
| `in_review` → `rejected` | responsable_pedagogique, technicien_informatique | Aucun événement publié |
| `pending` → `validated` | technicien_informatique **uniquement** | Bypass administratif de l'étape `in_review`. Publie `TeacherValidated` |
| `pending` → `rejected` | technicien_informatique **uniquement** | Bypass administratif de l'étape `in_review` |

| Méthode | Chemin | Auth | Rôles autorisés | Description | Réponse attendue |
|---|---|---|---|---|---|
| GET | /profiles/teachers/pending-validation | 🔒 | responsable_pedagogique | Lister les formateurs en attente de validation (statut `pending`), triés par ancienneté, enrichis du nom depuis le profil administratif | `200 [{id, teacherId, firstName, lastName, createdAt}]` (liste éventuellement vide ; `firstName`/`lastName` à `null` si aucun profil administratif) · `401` · `403` rôle ≠ RP |
| PATCH | /profiles/:teacherId/validation | 🔒 | responsable_pedagogique, technicien_informatique | Changer le statut de validation d'un formateur. Body : `{status: "pending"\|"in_review"\|"validated"\|"rejected", comment?}` (`comment` ≤ 2000 caractères). Upsert : l'enregistrement est créé s'il n'existe pas encore | `200 {id, teacherId, status, validatedBy, validatorRole, comment, createdAt, updatedAt}` · `400` statut hors énumération · `401` · `403` rôle non autorisé **ou transition interdite pour ce rôle** (voir tableau ci-dessus) |
| GET | /profiles/:teacherId/validation | 🔒 | responsable_pedagogique, technicien_informatique, administrateur_financier, formateur (soi-même) | Lire le statut de validation courant d'un formateur | `200 {id, teacherId, status, validatedBy, validatorRole, comment, createdAt, updatedAt}` ou `200 {teacherId, status: "pending"}` si aucun enregistrement n'existe encore · `401` · `403` autre formateur |

### Relations

| Méthode | Chemin | Auth | Rôles autorisés | Description | Réponse attendue |
|---|---|---|---|---|---|
| POST | /relations/finance-owner-student | 🔒 | responsable_pedagogique | Lier un parent financeur à un élève | `201 {financeOwnerId, studentId, createdAt}` · `400` body incomplet · `401` · `403` · `409` doublon |
| GET | /relations/finance-owner-student/by-student/:studentId | 🔒 | eleve (soi-même), responsable_pedagogique, administrateur_financier, technicien_informatique | Lister les financeurs rattachés à un élève (symétrique) | `200 [{financeOwnerId, studentId, createdAt, financeOwnerName}]` — `financeOwnerName` est `{firstName, lastName}` (valeurs `string \| null`) résolu depuis le profil administratif du financeur, ou `null` si ce profil administratif n'existe pas · `401` · `403` |
| GET | /relations/finance-owner-student/:financeOwnerId | 🔒 | parent_financeur (soi-même), responsable_pedagogique, administrateur_financier, technicien_informatique | Lister les élèves rattachés à un financeur | `200 [{financeOwnerId, studentId, createdAt, studentName}]` — `studentName` est `{firstName, lastName}` (valeurs `string \| null`) résolu depuis le profil administratif de l'élève, ou `null` si ce profil administratif n'existe pas · `401` · `403` |
| POST | /relations/teacher-student | 🔒 | responsable_pedagogique | Lier un formateur à un élève (avec flag professeur principal) | `201 {teacherId, studentId, isPrincipalTeacher, createdAt}` · `400` · `401` · `403` · `409` doublon |
| POST | /relations/pedagogical-coordinator | 🔒 | responsable_pedagogique | Lier un RP ou AP comme coordinateur pédagogique d'un élève | `201 {coordinatorId, studentId, coordinatorRole, createdAt}` · `400` rôle invalide · `401` · `403` · `409` doublon |
| GET | /relations/pedagogical-coordinator/:coordinatorId | 🔒 | responsable_pedagogique, animateur_pedagogique (soi-même), technicien_informatique | Lister les liens de coordination d'un coordinateur | `200 [{coordinatorId, studentId, coordinatorRole}]` · `401` · `403` |

### API interne inter-services (non exposée via nginx)

> Exclue de Swagger (`@ApiExcludeController`). Protégée par `X-Internal-Secret: <INTERNAL_SECRET>`.
> Utilisée par orchestration-service dans les workflows d'onboarding.

| Méthode | Chemin | Description | Header requis |
|---|---|---|---|
| POST | /internal/create-administrative-profile | Créer (ou mettre à jour) le profil administratif d'un compte quelconque (élève, formateur, parent, générique) juste après sa création par identity-access-service. Body : `{userId, firstName, lastName, phone?}`. `firstName`/`lastName` obligatoires (`400` sinon), `phone` optionnel mais validé (`@IsNotEmpty @MaxLength(20)` si fourni). **Seul point d'écriture** pour firstName/lastName/phone : identity-access-service ne persiste plus ces champs lui-même et appelle cette route de façon obligatoire (non best-effort) à chaque création de compte. **Seul point de création** d'un profil administratif : `GET /profiles/:userId` ne crée plus rien à la volée depuis l'arbitrage du 2026-08-07. Upsert idempotent : si une ligne existe déjà pour `userId` (rappel de la route, ou ligne héritée de l'ancien lazy-init), elle est mise à jour avec les valeurs reçues (y compris `phone`) au lieu d'échouer sur la contrainte d'unicité — voir décision C6/C7/C8 dans `docs/services/profile-service.md`. Erreurs de validation → `400` explicite (distinct d'un `5xx`) | `X-Internal-Secret` |
| POST | /internal/create-student-profiles | Créer les profils initiaux d'un élève (`firstName`/`lastName` obligatoires, `400` sinon) | `X-Internal-Secret` |
| POST | /internal/create-teacher-profiles | Créer les profils initiaux d'un formateur (`firstName`/`lastName` obligatoires, `400` sinon) | `X-Internal-Secret` |
| POST | /internal/create-administrative-profile | Créer/mettre à jour le profil administratif minimal d'un compte (upsert par `userId`) — `{userId, firstName, lastName, phone?}` — utilisée par identity-access-service comme unique écriture de `firstName`/`lastName`/`phone` à la création de compte (décision du 2026-08-05, voir section identity-access-service ; le DTO d'entrée d'identity-access-service utilise `phoneNumber`, mappé vers `phone` au moment de l'appel) | `X-Internal-Secret` |
| POST | /internal/link-parent | Lier un parent financeur à un élève (idempotent par paire `studentId`/`financeOwnerId`) — utilisée par identity-access-service pour la liaison automatique élève+parent créés/liés dans le même appel de création de compte | `X-Internal-Secret` |
| POST | /internal/create-teacher-student-relation | Créer la relation formateur-élève | `X-Internal-Secret` |
| POST | /internal/link-coordinator | Lier un coordinateur pédagogique à un élève | `X-Internal-Secret` |

Note : `PUT /profiles/:userId/administrative` expose également `phone` (et non plus `telephone`), aligné sur les DTO internes ci-dessus ; `phone` est mappé en interne sur la colonne `telephone` en base. `ValidationPipe` global : `forbidNonWhitelisted: true` (tout champ inconnu dans un body → `400` explicite au lieu d'être silencieusement ignoré).

### Demandes de rattachement parent↔élève

Flux en deux temps : le parent fournit le `studentId` qu'il connaît hors-plateforme. L'élève ou un RP/TI valide. Aucune liste d'élèves n'est exposée au parent.

Statuts : `pending` → `approved` (lien finance-owner-student créé) / `rejected`

| Méthode | Chemin | Auth | Rôles autorisés | Description | Réponse attendue |
|---|---|---|---|---|---|
| POST | /parent-link-requests | 🔒 | `parent_financeur` | Soumet une demande de rattachement (direction: parent_initiated) | Body : `{ studentLoginIdentifier }` · `201 { id, parentId, studentId, status: "pending", direction: "parent_initiated", requestedAt }` · `400` identifiant non trouvé ou compte non élève · `404` identifiant élève introuvable · `409` demande pending déjà en cours |
| POST | /parent-link-requests/student-initiated | 🔒 | `eleve` | L'élève invite son parent (direction: student_initiated) | Body : `{ parentLoginIdentifier }` · `201 { id, parentId, studentId, status: "pending", direction: "student_initiated", requestedAt }` · `400` identifiant non trouvé ou compte non parent_financeur · `404` identifiant parent introuvable · `409` demande pending déjà en cours |
| GET | /parent-link-requests | 🔒 | `parent_financeur` (ses demandes, les deux directions), `eleve` (demandes le ciblant + ses invitations), `responsable_pedagogique`, `technicien_informatique` (toutes) | Liste filtrée selon le rôle | `200 [{ id, parentId, studentId, status, direction, requestedAt, processedAt, processedBy }]` |
| POST | /parent-link-requests/:id/approve | 🔒 | `eleve` (si parent_initiated, uniquement si ciblé), `parent_financeur` (si student_initiated, uniquement si ciblé), `responsable_pedagogique`, `technicien_informatique` | Approuve → crée le lien finance-owner-student | `200 { id, status: "approved", processedAt, processedBy }` · `403` · `404` |
| POST | /parent-link-requests/:id/reject | 🔒 | `eleve` (si parent_initiated, uniquement si ciblé), `parent_financeur` (si student_initiated, uniquement si ciblé), `responsable_pedagogique`, `technicien_informatique` | Rejette la demande | `200 { id, status: "rejected", processedAt, processedBy }` · `403` · `404` |

### Événements publiés

`ProfileUpdated` · `StudentLinkedToFinanceOwner` · `TeacherLinkedToStudent` · `CoordinatorLinkedToStudent` · `TeacherPromotedToPedagogicalAnimator` · `ParentLinkRequested` · `ParentLinkApproved` · `ParentLinkRejected`

---

## teacher-request-service

Préfixe gateway canonique : `/api/v1/teacher-requests` → contrôleur `/teacher-requests`

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

Préfixes gateway : `/api/v1/calendars` · `/api/v1/events` · `/api/v1/activities` · `/api/v1/reminders` (🔒) → calendar-service

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

Préfixe gateway canonique : `/api/v1/video-sessions` → contrôleur `/video-sessions` (alias legacy : `/api/v1/video` → `/video`)

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

Préfixes gateway : `/api/v1/contacts` · `/api/v1/messages` · `/api/v1/conversations` · `/api/v1/threads` · `/api/v1/incidents` (🔒) → communication-service

### Contacts autorisés

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| GET | /contacts | Lister les contacts autorisés (obligatoires + précontacts) | 🔒 |
| POST | /contacts/:id/activate | Activer un précontact (status: precontact → active) | 🔒 |
| DELETE | /contacts/:id | Supprimer un contact actif (interdit si mandatory: true → 403) | 🔒 |
| PATCH | /contacts/:id/visibility | Modifier la visibilité (visible/hidden) | 🔒 |

Retour Contact : `{id, userId, email?, displayName?, role?, status: 'active'|'precontact', mandatory: boolean, visibility?: 'visible'|'hidden'}`

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

Préfixe gateway canonique : `/api/v1/pedagogical-logs` → contrôleur `/pedagogical-logs`
Préfixes complémentaires : `/api/v1/students` → `/students` · `/api/v1/logs` → `/logs` (legacy)

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /pedagogical-logs | Lister les pages de cahier de texte (filtré par rôle) | 🔒 | Tout rôle authentifié | `200 [PedagogicalLogPage]` |
| POST | /pedagogical-logs | Ajouter une page de cahier de texte | 🔒 | formateur, RP, AP, TI | `201 {id, studentId, authorId, authorRole, content, visibility, isSpecialPage, hiddenFromStudent, linkedResources?, ...}` · `400` validation · `403` rôle non autorisé |
| PUT | /pedagogical-logs/:id | Modifier une page (auteur, RP, TI) | 🔒 | Auteur, RP, TI | `200 PedagogicalLogPage` · `403` non auteur · `404` introuvable |
| DELETE | /pedagogical-logs/:id | Supprimer une page | 🔒 | Auteur, responsable_pedagogique | `204` · `403` · `404` introuvable |
| GET | /students/:studentId/pedagogical-log | Lire le cahier de texte d'un élève (filtré par rôle) | 🔒 | Tout rôle authentifié | `200 [PedagogicalLogPage]` — élève: hors pages hiddenFromStudent · parent: eleve_parent_formateur + special · RP/Formateur: tout |
| POST | /students/:studentId/pedagogical-log | Ajouter une page liée à un élève précis | 🔒 | formateur, RP, AP, TI | `201 {id, studentId, ...}` · `400` validation · `403` rôle non autorisé |
| POST | /students/:studentId/pedagogical-log/special-pages | Créer une page spéciale avec visibilité ciblée (RP uniquement) | 🔒 | responsable_pedagogique | `201 {id, ..., isSpecialPage: true, hiddenFromStudent, visibility: "special"}` · `403` réservé RP |
| GET | /logs/session/:sessionId | Logs d'une séance (filtrés par rôle) | 🔒 | Tout rôle authentifié | `200 [PedagogicalLogPage]` |
| GET | /logs/:id | Détail d'une page | 🔒 | Selon visibilité et rôle | `200 PedagogicalLogPage` · `403` visibilité bloquée · `404` introuvable |
| PATCH | /logs/:id | Modifier une page (legacy) | 🔒 | Auteur, RP, TI | `200 PedagogicalLogPage` · `403` non auteur · `404` introuvable |
| DELETE | /logs/:id | Supprimer une page (legacy) | 🔒 | Auteur, responsable_pedagogique | `204` · `403` · `404` introuvable |

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
| GET | /memos/:id | Lire un mémo | 🔒 | eleve (propriétaire), formateur lié (lecture), RP lié (lecture) | `200 Memo` · `403` parent/autre · `404` introuvable |
| POST | /memos | Créer un mémo | 🔒 | eleve uniquement | `201 Memo` · `403` formateur/RP/parent → refusé |
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

Préfixes gateway : `/api/v1/notifications` · `/api/v1/dashboard` (🔒) → dashboard-notification-service

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
| GET | /workflows/:workflowInstanceId | Lire l'état d'une instance de workflow | 🔒 | Path: `workflowInstanceId` (UUID) | `200 {id, workflowType, correlationId, status, error, initiatedBy, createdAt, steps[]}` · `400` UUID invalide · `404` instance introuvable |
| POST | /workflows/:workflowInstanceId/suspend | Suspendre un workflow en attente d'arbitrage utilisateur (ORCH-BR-006) | 🔒 | Path: `workflowInstanceId` (UUID) · Body: `{reason}` | `200 {workflowInstanceId, status: "needs_arbitration", reason}` · `400` UUID invalide |
| POST | /workflows/:workflowInstanceId/resume | Reprendre un workflow après arbitrage ou forcage TI (ORCH-BR-006/007) | 🔒 | Path: `workflowInstanceId` (UUID) · Body: `{tiOverride?}` (`true` = forcage TI audité) | `200 {workflowInstanceId, status: "in_progress", tiOverride}` · `400` UUID invalide |

Types de workflows phase 1 : `student-onboarding`, `teacher-onboarding`, `teacher-request-to-assignment`, `scheduled-video-course`.

Validation du `payload` de démarrage selon `workflowId` (`400` si invalide, avant tout appel aux services cibles) :
- `student-onboarding` : `firstName`/`lastName` obligatoires. `parentAccountId` optionnel — lie un compte parent **déjà existant** (le parent a fourni son propre prénom/nom lors de la création de son compte) ; aucun nom parent n'est requis ni transmis ici.
- `teacher-onboarding` : `firstName`/`lastName` obligatoires.
- Les autres types de workflow conservent un `payload` de routage pur, non validé par orchestration-service (il relaie le body métier tel quel aux services cibles).

### Commandes d'intégration

| Méthode | Chemin | Description | Auth | Body | Réponse attendue |
|---|---|---|---|---|---|
| POST | /commands | Émettre une commande idempotente vers un microservice cible | 🔒 | `{targetService, action, payload, idempotencyKey, correlationId?}` | `201 commande dispatchée` · `409` clé d'idempotence déjà utilisée |

### Événements d'intégration

| Méthode | Chemin | Description | Auth | Paramètres | Réponse attendue |
|---|---|---|---|---|---|
| GET | /events/:correlationId | Lire l'historique chronologique des événements pour un correlationId | 🔒 | Path: `correlationId` (UUID) | `200 {correlationId, count, events[]}` · `400` UUID invalide |

### Callbacks externes (webhooks)

| Méthode | Chemin | Description | Auth | Paramètres / Body | Réponse attendue |
|---|---|---|---|---|---|
| POST | /callbacks/:provider | Recevoir un webhook d'un fournisseur externe (vidéo, paiement, etc.) | Non (webhook) | Path: `provider` (ex: `video-provider`) · Body: `{correlationId?, eventType?, ...payload}` | `200 {received: true, correlationId}` |

Note : la route `/callbacks/:provider` n'est **pas** protégée par `auth_request` nginx — les providers externes ne peuvent pas fournir un JWT utilisateur. La protection repose sur le header `X-Webhook-Secret` validé côté service. Le `correlationId` est lu depuis `body.correlationId` ou `body.correlation_id`, ou généré automatiquement si absent.

---

## finance-credit-service

Phase 2 — Gestion des profils financiers, paiements, paramètres et archives financières.

Préfixe gateway canonique : `/api/v1/finance/` (strip de préfixe — le backend reçoit le chemin sans `/finance`)
Préfixes legacy conservés (ne routent pas vers les contrôleurs actuels) : `/api/v1/credits` · `/api/v1/payments` · `/api/v1/invoices`

Toutes les routes 🔒 nécessitent `Authorization: Bearer <access_token>`.

### Profils financiers

Via gateway : `GET /api/v1/finance/financial-profiles/:ownerId` → backend reçoit `GET /financial-profiles/:ownerId`

| Méthode | Chemin (backend) | Description | Auth | Rôles autorisés | Body / Params | Réponse attendue |
|---|---|---|---|---|---|---|
| GET | /financial-profiles/:ownerId | Lire le profil financier d'un financeur | 🔒 | owner (soi-même), administrateur_financier, responsable_pedagogique, technicien_informatique | — | `200 {id, ownerId, profileType, pointsBalance, fundingEndDate, paymentMethod, paymentReference}` · `401` · `403` · `404` |
| PATCH | /financial-profiles/:ownerId | Modifier les moyens de paiement ou paramètres | 🔒 | owner (soi-même), administrateur_financier, technicien_informatique | `{paymentMethod?, paymentReference?, fundingEndDate?}` | `200 {profileType mis à jour}` · `400` · `401` · `403` · `404` |

Valeurs `profileType` : `limite` (compte non encore activé — inscription non payée) · `membre` (inscription payée).
Valeurs `paymentMethod` : `cb` · `virement` · `paypal`.

### Paiements

Via gateway : `POST /api/v1/finance/payments` → backend reçoit `POST /payments`

| Méthode | Chemin (backend) | Description | Auth | Body | Réponse attendue |
|---|---|---|---|---|---|
| POST | /payments | Initier un paiement (inscription, abonnement, versement ponctuel) | 🔒 | `{paymentType, amountCents, externalReference?, correlationId?}` | `201 {payment, invoice}` · `400` validation · `401` · `409` doublon inscription (FIN-AC-002) |

Règles métier :
- Une inscription confirmée : crée/upgrade le profil financier en `membre`, génère une `Invoice`, un `FinancialArchiveItem`, crédite des points (1 pt/€) et publie `PaymentConfirmed` + `InvoiceIssued`.
- Un seul paiement `inscription` confirmé par financeur est autorisé (`409` si doublon).
- Valeurs `paymentType` : `inscription` · `abonnement` · `versement_ponctuel`.

### Archives financières

Via gateway : `GET /api/v1/finance/financial-archives/:ownerId` → backend reçoit `GET /financial-archives/:ownerId`

| Méthode | Chemin (backend) | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /financial-archives/:ownerId | Lister les archives financières d'un financeur | 🔒 | owner (soi-même), administrateur_financier, responsable_pedagogique, technicien_informatique | `200 [{id, ownerId, itemType, referenceId, label, amountCents, balanceSnapshot, occurredAt}]` · `401` · `403` |

Les archives sont triées par `occurredAt DESC`. Types d'items : `payment` · `invoice` · `ledger_entry`.

### Paramètres financiers (rewards)

> Corrigé le 2026-07-21 : la version précédente de cette section documentait un contrôleur
> `/settings` qui n'existe pas dans le code. Le contrôleur réel est `financial-settings`.

Via gateway : `GET/PATCH /api/v1/finance/financial-settings` → backend reçoit `/financial-settings` · `PATCH /api/v1/finance/financial-settings/rewards` → backend reçoit `/financial-settings/rewards`

| Méthode | Chemin (backend) | Description | Auth | Rôles autorisés | Body / Params | Réponse attendue |
|---|---|---|---|---|---|---|
| GET | /financial-settings/rewards | Lire les paramètres de valorisation (points par euro, etc.) | 🔒 | administrateur_financier, technicien_informatique | — | `200 {...}` · `401` · `403` |
| PATCH | /financial-settings/rewards | Modifier les paramètres de valorisation | 🔒 | administrateur_financier | `{settings: [{settingKey, label, value, description?}], correlationId?}` — `settingKey` inclut notamment `points_per_euro` | `200 {...}` · `400` · `401` · `403` |

### Événements financiers

> Ajouté le 2026-07-21 : route existante côté backend (`FinanceEventsController`), absente de
> cette documentation jusqu'ici.

Via gateway : `GET /api/v1/finance/finance-events` → backend reçoit `GET /finance-events`

| Méthode | Chemin (backend) | Description | Auth | Rôles autorisés | Body / Params | Réponse attendue |
|---|---|---|---|---|---|---|
| GET | /finance-events | Lister les événements financiers | 🔒 | administrateur_financier, technicien_informatique | Query : `ownerId?` | `200 [{id, eventType, payload?, occurredAt}]` · `401` · `403` |

### Demandes de paiement formateur

> Corrigé le 2026-07-21 : la liste globale (`GET /teacher-payment-requests` sans paramètre)
> et la validation via `PATCH .../status` documentées précédemment n'existent pas dans le code.
> Seule une liste **par formateur** existe ; il n'y a aujourd'hui aucun endpoint permettant à
> l'administrateur financier de lister toutes les demandes en attente tous formateurs confondus —
> c'est un gap produit réel, pas seulement documentaire (suivi côté front : le rôle AF affiche un
> état "fonctionnalité indisponible" plutôt qu'un appel voué à échouer).

Via gateway : `/api/v1/finance/teacher-payment-requests` → backend reçoit `/teacher-payment-requests`

| Méthode | Chemin (backend) | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /teacher-payment-requests/by-teacher/:teacherId | Lister les demandes de rémunération d'un formateur donné | 🔒 | formateur (soi-même) | `200 [{id, teacherId, amountCents, status, ...}]` · `401` · `403` |
| POST | /teacher-payment-requests | Créer une demande de rémunération | 🔒 | formateur | `201 {id, teacherId, amountCents, status, createdAt}` · `400` · `401` · `403` |
| POST | /teacher-payment-requests/:id/validate | Valider une demande | 🔒 | administrateur_financier | `200 {id, status}` · `401` · `403` · `404` |

**Gap produit ouvert** : pas de route de liste globale/toutes-demandes-en-attente pour l'AF/TI — à arbitrer (nouvel endpoint backend `GET /teacher-payment-requests` avec filtrage par statut, ou autre mécanisme) avant que la validation groupée par l'AF soit réellement utilisable.

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

## Health checks (non authentifié)

Chaque service expose `GET /health` → `{status: "ok", service: "...", timestamp: "..."}`

---

## legal-document-service

Préfixes gateway : `/api/v1/legal-documents` · `/api/v1/mandates` · `/api/v1/legal-templates` (🔒) → legal-document-service

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

---

## admin-observability-service

Préfixe gateway canonique : `/api/v1/admin` → contrôleur `/admin`
Préfixes legacy conservés : `/api/v1/audit` · `/api/v1/activity-logs` (ne correspondent pas aux routes contrôleur actuelles)

### Logs d'activité

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /admin/activity-log | Lister les logs d'activité utilisateur (paginés, filtrables) | 🔒 | technicien_informatique, responsable_pedagogique, administrateur_financier | `200 [ActivityLogEntry]` ou `200 {data, meta}` · `401` · `403` |

Query params : `userId?`, `action?`, `from?`, `to?`, `page?`, `pageSize?`

### Logs techniques

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /admin/technical-logs | Lister les logs techniques des microservices (paginés, filtrables) | 🔒 | technicien_informatique | `200 [TechnicalLogEntry]` ou `200 {data, meta}` · `401` · `403` |

Query params : `level?` (debug/info/warn/error/fatal), `service?`, `from?`, `to?`, `page?`, `pageSize?`

### Overrides de visibilité (masquage temporaire)

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| POST | /admin/visibility-overrides | Masquer temporairement une ressource sans suppression | 🔒 | technicien_informatique | `201 VisibilityOverride` · `400` · `401` · `403` |
| DELETE | /admin/visibility-overrides/:id | Lever un masquage | 🔒 | technicien_informatique | `204` · `401` · `403` · `404` |

Body `POST` : `{targetType: "account"|"profile"|"content", targetId, reason, expiresAt?}`

### Santé des services

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /admin/health | Rapport de santé agrégé de tous les microservices | 🔒 | technicien_informatique | `200 {overallStatus, services[], checkedAt}` · `401` · `403` |

### Métadonnées du site

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| PATCH | /admin/site-metadata/:id | Mettre à jour les métadonnées globales du site | 🔒 | technicien_informatique | `200 SiteMetadata` · `400` · `401` · `403` · `404` |

Body : `{siteName?, maintenanceMessage?, isMaintenanceMode?, contactEmail?, supportUrl?, announcementBanner?}`
