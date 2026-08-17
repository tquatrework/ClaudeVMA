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
| POST | /auth/login | Se connecter | Non | `{loginIdentifier, password}` |
| POST | /auth/logout | Révoquer la session courante | 🔒 | — |
| POST | /auth/refresh | Nouveau token pair | Non | `{refresh_token}` |
| GET | /auth/me | Identité courante | 🔒 | — |

Réponse login/refresh : `{access_token, refresh_token, user: {id, email, role, validationStatus}}`

> Corrigé le 2026-08-08 : cette ligne documentait `{email, password}` alors que le serveur exige — et
> que le front envoie — `{loginIdentifier, password}`. `email` et `loginIdentifier` sont deux données
> **distinctes** (un compte a un email et un identifiant de connexion propre), il n'y avait donc rien à
> renommer : c'était la documentation qui était fausse. `email` reste présent dans la **réponse**,
> comme donnée du compte.

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
| POST | /accounts | Créer un compte générique (auto-inscription, non utilisée par le front) | Non | — | `{email, password, role?, loginIdentifier?, consents?}` |
| POST | /accounts/students | Créer un compte élève (+ parent optionnel) | Non | — | `{email, password, firstName, lastName, phoneNumber?, birthDate?, loginIdentifier?, isMember?, consents?, parentAccountMode?, parentLoginIdentifier?, parentEmail?, parentPassword?, parentFirstName?, parentLastName?}` |
| POST | /accounts/teachers | Créer un compte formateur | Non | — | `{email, password, firstName, lastName, phoneNumber?, loginIdentifier?, cvReference?, consents?}` |
| POST | /accounts/parents | Créer un compte parent / financeur (+ élève optionnel) | Non | — | `{email, password, firstName, lastName, phoneNumber?, loginIdentifier?, consents?, studentAccountMode?, studentLoginIdentifier?, studentEmail?, studentPassword?, studentFirstName?, studentLastName?}` |
| GET | /accounts/:accountId | Lire un compte | 🔒 | TI, RP, AdministrateurFinancier | — |
| PUT | /accounts/:accountId/roles | Changer le rôle | 🔒 | RP, TI | `{role}` |
| PUT | /accounts/:accountId/validate | Valider un compte | 🔒 | RP, TI | — |
| PUT | /accounts/:accountId/suspend | Suspendre un compte | 🔒 | TI | — |
| GET | /accounts/:accountId/audit | Journal d'audit | 🔒 | RP, TI | — |

`firstName` et `lastName` sont obligatoires (chaînes non vides, 100 caractères max) sur les 3 routes
d'auto-inscription directe ci-dessus (`students`/`teachers`/`parents`) — `400` si absents ou vides.
`phoneNumber` y est optionnel (chiffres/espaces/`+`/`-`/`.`/parenthèses, 6 à 30 caractères — `400` si
format invalide). `POST /accounts` ne les accepte pas du tout (`400` si envoyés, whitelist stricte).

`birthDate` est accepté **sur `POST /accounts/students` uniquement** (2026-08-09), au format date
calendaire ISO `YYYY-MM-DD`, optionnel. La date est validée localement (forme *et* existence réelle :
`2008-02-30` et `2008-13-01` renvoient `400`) afin qu'une saisie invalide produise un `400` explicite
côté identity-access-service plutôt qu'un `503` provoqué par le refus de profile-service. Comme
`firstName`/`lastName`/`phoneNumber`, le champ est **relayé** à profile-service et **jamais persisté
ici** — la table `users` n'a aucune colonne de date de naissance. Il porte le même nom des deux côtés
(aucun mapping, contrairement à `phoneNumber` → `phone`). Les autres routes de création ne le déclarent
pas : leurs formulaires ne collectent pas de date de naissance, et l'envoyer renvoie `400`. Aucun
`parentBirthDate` / `studentBirthDate` n'existe non plus, pour la même raison — le compte lié renseigne
sa date de naissance via `PUT /profiles/:userId/administrative` sur profile-service.

`loginIdentifier` est optionnel et **identique sur les 3 routes** (`students`/`teachers`/`parents`) : il
nomme le compte principal créé. S'il est omis, un identifiant est dérivé de la partie locale de l'email
(avec suffixe `.2`, `.3`… en cas de collision) ; s'il est fourni et déjà pris, `409`. Avant le
2026-08-09, `POST /accounts/parents` ne déclarait pas ce champ et le jetait silencieusement
(`whitelist: true`) — corrigé, voir `docs/architecture.md` > "Arbitrages rendus" (2026-08-09).

**`consents` — consentements recueillis par le formulaire d'inscription (2026-08-09) :**

Champ **optionnel**, présent sur les 4 routes de création de compte et sur `POST /internal/create-account`.
Forme : **un tableau d'objets identiques au corps de `POST /consents`** —
`consents: [{consentType: 'rgpd' | 'cgu' | 'marketing', version?: string}]`. Un seul nom par donnée :
`consentType` et `version` s'écrivent ici exactement comme sur `POST /consents`.

- Chaque élément est réellement enregistré dans `consent_records` par le **même chemin** que
  `POST /consents` : même table, même version par défaut (`1.0` si `version` est omis), même capture de
  `ip_address` (adresse de la requête d'inscription) et de `signed_at`.
- L'écriture a lieu **dans la transaction de création du compte** : un échec ultérieur (profile-service
  indisponible, identifiant pris…) annule aussi les consentements — jamais de trace orpheline, jamais de
  compte créé en jetant un consentement donné.
- Quand `rgpd` **et** `cgu` sont fournis, le compte est renvoyé `validationStatus: 'active'` et
  `consentSigned: true` **dès la réponse `201`**. Sinon il reste `pending` et l'utilisateur devra signer
  via `POST /consents`.
- Un `consentType` envoyé deux fois dans le même appel → `400` (un consentement est enregistré une fois,
  avec une version).
- Un événement `ConsentSigned` est publié par consentement enregistré, après le commit.
- `POST /consents` **reste nécessaire** : re-consentement, changement de version, consentement
  `marketing` signé plus tard, et signature par un compte lié (ci-dessous).

**Le compte lié créé en parallèle ne reçoit jamais les consentements du créateur.** Il n'existe donc
aucun champ `parentConsents` / `studentConsents` — l'envoyer renvoie `400`. Un consentement est un acte
personnel : ni un élève ne consent pour son parent, ni un parent pour l'élève dont il crée le compte
(ce service ignore l'âge de l'élève, et le compte peut être celui d'un majeur). Le compte lié est créé
`pending` avec `consentSigned: false` et signe les siens via `POST /consents` à sa première connexion.

**Aucun champ inconnu n'est absorbé sur ces routes (2026-08-09) :** les 4 routes de création de compte
et `POST /internal/create-account` rejettent en `400` explicite tout champ que leur DTO ne déclare pas,
en listant les champs inconnus **et** les champs acceptés. Cas concrets encore envoyés par le front au
2026-08-09 et refusés : `teachingSubjects`, `educationLevel` et `bio` sur `/accounts/teachers` — ces
données appartiennent aux profils de profile-service, pas à identity-access-service, et étaient jusqu'ici
perdues en silence. `birthDate` sur `/accounts/students` était dans le même cas jusqu'à ce que
profile-service accepte ce champ à la création du profil administratif : il est depuis **déclaré et
relayé** (voir ci-dessus), et la liste des champs acceptés du message d'erreur l'inclut. `whitelist: true`
reste actif globalement (les autres routes du service continuent d'ignorer les champs inconnus, voir le
point ouvert `TD-forbid-non-whitelisted-global` dans `docs/services/identity-access-service.md`).

**Compte lié créé en parallèle — intention explicite (`parentAccountMode` / `studentAccountMode`) :**

Rattacher un compte **existant** et **créer** un compte lié sont deux intentions distinctes, portées par
un champ de mode (`'none' | 'existing' | 'new'`, absent = `'none'`). Une seule donnée, un seul nom :
`parentLoginIdentifier` / `studentLoginIdentifier` désigne toujours l'identifiant de connexion du compte
lié, son rôle dépendant du mode. **Aucun champ transmis n'est jamais ignoré silencieusement** : un champ
sans effet dans le mode choisi renvoie `400` avec le détail des violations.

**`POST /accounts/students` — élève + parent dans le même appel :**
- `parentAccountMode` **obligatoire dès qu'un champ `parent*` est envoyé** (`400` sinon).
- `parentAccountMode: 'existing'` → rattache le compte parent existant désigné par `parentLoginIdentifier`
  (obligatoire, `404` si introuvable). `parentEmail`/`parentPassword`/`parentFirstName`/`parentLastName`
  sont **interdits** dans ce mode (`400`) — le profil du compte rattaché n'est jamais écrasé.
- `parentAccountMode: 'new'` → crée le compte parent. `parentLoginIdentifier`, `parentEmail`,
  `parentFirstName` et `parentLastName` sont **obligatoires** (`400` sinon) ; `parentPassword` est
  optionnel et retombe sur `password` (celui de l'élève) s'il est omis. L'identifiant de connexion du
  compte créé est **choisi, jamais dérivé de l'email** — c'est avec lui que le parent se connectera.
  `409` si cet identifiant est déjà pris. Si l'email du parent est déjà utilisé par un autre compte, le
  compte est tout de même créé et `emailAlreadyUsed: true` est renvoyé sur l'objet `parent` (même
  comportement que pour le compte principal).
- `parentAccountMode: 'none'` (ou absent) → aucun compte parent ; tout champ `parent*` renvoie `400`.
- Élève et parent sont créés/rattachés dans **une seule transaction** : tout échec (parent introuvable, identifiant pris, `503` profile-service) annule l'élève ET le parent.
- Quand un parent est rattaché ou créé dans le même appel, la relation financeur/élève (`finance-owner-student`) est créée **automatiquement et immédiatement côté profile-service, sans flow de demande** (contrairement à `POST /parent-link-requests` côté profile-service, réservé au rattachement après coup entre comptes existants non liés à l'inscription).

**`POST /accounts/parents` — parent + élève dans le même appel (strictement symétrique) :**
- `studentAccountMode` **obligatoire dès qu'un champ `student*` est envoyé** (`400` sinon).
- `studentAccountMode: 'existing'` → rattache le compte élève existant désigné par `studentLoginIdentifier`
  (obligatoire, `404` si introuvable) ; `studentEmail`/`studentPassword`/`studentFirstName`/`studentLastName` interdits (`400`).
- `studentAccountMode: 'new'` → crée le compte élève ; `studentLoginIdentifier`, `studentEmail`,
  `studentFirstName`, `studentLastName` obligatoires ; `studentPassword` optionnel (retombe sur
  `password`) ; `409` si l'identifiant choisi est pris.
- Mêmes garanties d'atomicité et de liaison automatique finance-owner-student que `POST /accounts/students`.

La résolution implicite par email (`0` compte → création / `1` → rattachement / `2+` → `409`) qui
existait avant le 2026-08-09 est **supprimée** : l'intention n'est plus devinée à partir du nombre de
comptes trouvés, elle est déclarée.

Règles métier : seuls `eleve`, `parent_financeur` et `formateur` peuvent être auto-inscrits (IAM-FB-002). La validation nécessite les consentements RGPD+CGU signés (IAM-FB-003).

Réponse (compte simple) : `{id, loginIdentifier, email, role, validationStatus, consentSigned, isActive, createdAt}` (`emailAlreadyUsed`/`suggestedLoginIdentifier` optionnels — **ne contient jamais `firstName`/`lastName`/`phone`**, propriété exclusive de profile-service, même sur les 3 routes qui les collectent en entrée).
Réponse `POST /accounts/students` : `{student, parent}` où `student` est au format ci-dessus et `parent` est soit `null`, soit `{...student-like, created: boolean, emailAlreadyUsed?: true}` (`created: true` si un nouveau compte parent a été créé — mode `'new'` —, `false` s'il s'agit d'un compte existant rattaché — mode `'existing'`).
Réponse `POST /accounts/parents` : `{parent, student}`, symétrique — `parent` au format ci-dessus, `student` soit `null` soit `{..., created: boolean, emailAlreadyUsed?: true}`.

`503 Service Unavailable` sur `POST /accounts/students`, `POST /accounts/teachers` et `POST /accounts/parents` uniquement : profile-service indisponible ou en erreur lors du stockage du profil administratif (ou de la liaison financeur/élève) — la création de compte est **intégralement annulée** (transaction locale rollback), aucun compte orphelin n'est laissé en base. Le client peut réessayer l'appel tel quel. `POST /accounts` n'appelle jamais profile-service et ne renvoie donc pas ce statut.

### Consentements RGPD

| Méthode | Chemin | Description | Auth | Body |
|---|---|---|---|---|
| POST | /consents | Donner un consentement | 🔒 | `{consentType, version?}` |
| POST | /consents/:consentType/withdraw | Retirer un consentement optionnel | 🔒 | — |
| GET | /consents | État courant de mes consentements | 🔒 | — |
| GET | /consents/history | Journal complet de mes consentements (preuve) | 🔒 | — |

Types : `rgpd` (requis), `cgu` (requis), `marketing` (optionnel). Une fois RGPD+CGU donnés, le compte passe automatiquement à `active`.

**`consent_records` est un journal append-only (2026-08-09).** Une ligne = un **événement**
(`action: 'granted' | 'withdrawn'`), jamais un état. Retirer un consentement **ajoute** un événement ;
aucune ligne n'est jamais supprimée ni écrasée, de sorte qu'on peut toujours prouver qu'un consentement
avait été donné, puis retiré, et quand. L'état courant d'un type est le **dernier événement** enregistré
pour ce type. La colonne d'horodatage s'appelle `recorded_at` (et non `signed_at` : un retrait n'est pas
une signature).

**`POST /consents`** — `409` si le consentement est **actuellement accordé**. Le conflit porte sur l'état
courant, pas sur l'existence d'une ligne : un consentement retiré peut être redonné, et le cycle
accorder → retirer → accorder est rejouable autant de fois que voulu.
Cette route reste le point d'entrée pour : les **re-consentements** et **changements de version**, le
consentement `marketing` signé après coup, la **ré-acceptation après retrait**, et la signature par un
**compte lié** créé lors de l'inscription de quelqu'un d'autre (qui n'hérite jamais des consentements du
créateur). Les consentements donnés **pendant** le formulaire d'inscription passent, eux, par le champ
`consents` des routes de création de compte (voir plus haut) — même table, même trace, en une seule
requête.

**`POST /consents/:consentType/withdraw`** — `POST` et non `DELETE` : le retrait ajoute un événement au
journal, il ne supprime aucune ressource. Réponse `201` avec l'événement créé
(`{id, userId, consentType, action: 'withdrawn', version, recordedAt}`) ; `version` est celle du
consentement en vigueur, pour dire quel document a été révoqué.

| Code | Cas |
|---|---|
| `201` | Retrait enregistré |
| `400` | `consentType` inconnu (hors `rgpd`/`cgu`/`marketing`) |
| `401` | Sans JWT |
| `403` | Consentement **obligatoire** (`rgpd`, `cgu`) : non retirable, message orientant vers la fermeture de compte |
| `404` | Ce compte n'a **jamais** donné ce consentement |
| `409` | Ce consentement est **déjà retiré** |

Seuls les consentements **optionnels** sont retirables — aujourd'hui `marketing`. `rgpd` et `cgu`
conditionnent le fonctionnement du service : les révoquer relève d'une **fermeture de compte**, parcours
distinct non implémenté. La tentative est refusée explicitement (`403`), jamais absorbée en silence ni
traitée comme un succès. Corollaire : **retirer un consentement ne désactive jamais un compte** —
`consent_signed` et le passage à `active` ne dépendent que des consentements obligatoires, qui ne peuvent
pas être retirés ici.

**`GET /consents`** — renvoie l'**état courant**, un élément par type, **toujours les trois**, y compris
ceux jamais donnés. Les lignes brutes du journal ne sont pas exposées ici : un écran qui afficherait
« Signé » pour un consentement retiré serait un mensonge.

```json
[
  {
    "consentType": "marketing",
    "status": "withdrawn",
    "isGranted": false,
    "isMandatory": false,
    "isWithdrawable": true,
    "version": "1.0",
    "grantedAt": "2026-08-09T11:26:44.957Z",
    "withdrawnAt": "2026-08-09T11:26:45.660Z",
    "updatedAt": "2026-08-09T11:26:45.660Z"
  }
]
```

`status` vaut `granted`, `withdrawn` (donné puis retiré) ou `never_granted` (jamais donné). `grantedAt`
est la date du **dernier octroi** et reste renseignée après un retrait — de quoi afficher « accepté le X,
retiré le Y » sans second appel. `withdrawnAt` n'est renseignée que si `status === 'withdrawn'`.
`isWithdrawable` dit au front s'il doit proposer le bouton de retrait ; il ne le déduit pas lui-même.

**`GET /consents/history`** — journal complet, du plus ancien au plus récent :
`[{id, consentType, action, version, recordedAt}]`. L'`ipAddress`, capturée comme preuve, n'est jamais
renvoyée au client.

Événement métier : `ConsentSigned` à l'octroi, `ConsentWithdrawn` au retrait.

### API interne inter-services (non exposée via nginx)

> Exclue de Swagger (`@ApiExcludeController`). Protégée par `X-Internal-Secret: <INTERNAL_SECRET>`.
> Utilisée par orchestration-service dans les workflows d'onboarding.

| Méthode | Chemin | Description | Header requis |
|---|---|---|---|
| POST | /internal/create-account | Créer un compte depuis un service interne | `X-Internal-Secret` |
| GET | /internal/accounts | Lister les comptes (filtre `role?`) | `X-Internal-Secret` |
| GET | /internal/accounts/by-login-identifier | Résoudre un compte par `loginIdentifier` | `X-Internal-Secret` |
| GET | /internal/accounts/by-user-id/:userId | Résoudre un compte par `userId` | `X-Internal-Secret` |

Body `POST /internal/create-account` : `{email, password, role?, loginIdentifier?, consents?}` — réutilise
`CreateAccountDto`, donc **mêmes règles de validation que `POST /accounts`** : n'accepte pas
`firstName`/`lastName`/`phoneNumber` (`400` si envoyés), et rejette en `400` explicite tout autre champ
inconnu. C'est la route consommée par orchestration-service dans les workflows
`student-onboarding`/`teacher-onboarding` : ces workflows transmettent `firstName`/`lastName` séparément
et directement à profile-service (jamais via cette route) — voir la section orchestration-service et
`docs/architecture.md` > "Arbitrages rendus".

`consents` y suit exactement le même contrat que sur les routes publiques
(`[{consentType, version?}]`). orchestration-service transmettait déjà ce champ depuis
`buildPayload` de l'étape `create-account` des deux workflows d'onboarding, mais il était
silencieusement jeté faute d'être déclaré ; il est désormais enregistré (avec `ip_address` vide, l'appel
étant interservice) et le compte ressort `active` quand `rgpd` + `cgu` sont fournis.

Réponse `POST /internal/create-account` : `{accountId, email, role}`
Réponse `GET /internal/accounts/by-user-id/:userId` : `{userId, loginIdentifier, role}` — **ne contient jamais `firstName`/`lastName`/`phone`** (identity-access-service ne les possède pas ; un consommateur qui a besoin de ces champs doit les demander à profile-service).

### Appel sortant vers profile-service (écriture primaire, pas une synchronisation)

> Décision d'architecture du 2026-08-06 : identity-access-service ne conserve **aucune** copie de
> `firstName`/`lastName`/`phone` — profile-service en est l'unique propriétaire. Seules les 3 routes
> d'auto-inscription directe par rôle (`students`/`teachers`/`parents`) déclenchent cet appel sortant ;
> `POST /accounts` et `POST /internal/create-account` ne le déclenchent jamais (ils ne collectent pas
> ces champs).
>
> Conséquence à connaître depuis le 2026-08-12 : le `role` transmis à profile-service (voir ci-dessous)
> ne l'est donc **que** par ces 3 routes. Un formateur créé par le workflow `teacher-onboarding` via
> `POST /internal/create-account` n'obtient d'enregistrement de validation que si **orchestration-service**
> transmet lui-même le rôle lors de son propre appel à `create-administrative-profile` —
> identity-access-service n'est pas sur ce chemin.

Après validation de forme (DTO) et avant de retourner `201`, `POST /accounts/students`,
`POST /accounts/teachers` et `POST /accounts/parents` appellent en sortant, **dans la même transaction
locale** que la création du ou des comptes :

1. `POST /internal/create-administrative-profile` sur profile-service avec `{userId, firstName,
   lastName, phone?, birthDate?, role}` (header `X-Internal-Secret`) — une fois par compte nouvellement
   créé (jamais pour un compte parent/élève simplement **lié** à un compte préexistant : son profil
   existant n'est jamais écrasé par les champs saisis côté élève/parent lors de la liaison). Le champ est
   nommé `phone` côté profile-service (convention déjà établie sur ses autres routes internes) alors que
   le DTO d'entrée public d'identity-access-service utilise `phoneNumber` — seul le mapping effectué au
   moment de cet appel sortant fait la conversion de nom. `birthDate` porte en revanche le même nom des
   deux côtés (aucun mapping) et n'est envoyé que par `POST /accounts/students`, seule route dont le
   formulaire collecte une date de naissance ; il est omis du corps quand il n'a pas été saisi, et jamais
   envoyé pour un compte lié créé en parallèle.

   `role` (valeurs de `UserRole`, mêmes chaînes que partout ailleurs : `eleve`, `parent_financeur`,
   `formateur`, …) est envoyé **pour tous les rôles et à chaque appel**, au même titre que
   `x-correlation-id` (arbitrage du 2026-08-07, « Propagation du rôle ») : le destinataire applique ses
   règles sans avoir à le redemander ni à le deviner. Il est **facultatif côté receveur** — ne rien
   envoyer ne casse rien — mais seul `formateur` a aujourd'hui un effet observable : profile-service crée
   alors l'enregistrement de validation qui fait apparaître le nouveau formateur dans la file du RP
   (arbitrage du 2026-08-12, « Validation des nouveaux formateurs »). Sans ce champ, un formateur
   fraîchement inscrit n'est jamais vu du RP, donc jamais validé, donc jamais proposable.
   identity-access-service reste l'**unique propriétaire** du rôle : il le transporte comme contexte de
   décision, profile-service ne le persiste pas comme donnée propre et ne l'expose pas en lecture.
   Ajouté le 2026-08-12 ; couvre le chemin **réellement emprunté** par `POST /accounts/teachers`, qui
   passe par `create-administrative-profile` et non par une route `create-teacher-profiles`.
2. Si un élève et un parent financeur sont créés/rattachés dans le même appel (`POST /accounts/students`
   avec `parentAccountMode` `'existing'` ou `'new'`, ou `POST /accounts/parents` avec
   `studentAccountMode` `'existing'` ou `'new'`) : `POST /internal/link-parent` sur profile-service avec
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
| GET | /profiles/:userId | 🔒 | eleve (soi-même), formateur (contacts liés), parent_financeur (élèves liés), responsable_pedagogique, animateur_pedagogique, technicien_informatique, administrateur_financier | Lire un profil selon droits. **Strictement en lecture seule** : cette route ne crée jamais rien en base (voir « Existence du profil administratif/pédagogique » dans `docs/architecture.md`). **Filtrée champ par champ** selon les réglages du titulaire — voir « Visibilité champ par champ » ci-dessous | `200 {userId, loginIdentifier, administrative, pedagogical, pedagogicalType, visibility}` — `administrative`/`pedagogical` sont les **seuls** noms de ces blocs, ici comme sur les routes `/internal/*` (arbitrage du 2026-08-08) ; **`pedagogical` porte le profil pédagogique COMPLET, sections confondues et à plat** : champs déclaratifs *et* champs de prescription (le titulaire lit sa prescription, il ne l'écrit jamais) ; `pedagogicalType` vaut `"student"`, `"teacher"` ou `null` ; `loginIdentifier` peut être `null` si identity-access-service est injoignable ; `pedagogical` est `null` tant que l'utilisateur n'a pas renseigné son profil pédagogique (**état normal**, ce profil étant facultatif et créé au premier `PUT /profiles/:userId/pedagogical`) ; `visibility` = `{isFiltered, hiddenFields}` — un champ masqué est **absent** du bloc et **nommé** dans `hiddenFields`, jamais remplacé par `null` · `401` sans token · `403` accès refusé · `404` `userId` inconnu de identity-access-service · `500` compte existant mais sans profil administratif (incohérence de données, loguée côté serveur comme anomalie) |
| GET | /profiles/:userId/statistics | 🔒 | **piloté par la relation, pas par une liste de rôles** (voir « Droit d'accès aux statistiques » ci-dessous) | Statistiques pédagogiques consolidées (phase 1 : données du profil pédagogique). **Filtrée par les mêmes réglages** que le bloc `pedagogical` — sinon elle en serait le contournement exact | `200 {userId, profileType, statistics, visibility}` — `visibility` suit le même contrat que ci-dessus ; `isAnimateurPedagogique` est structurel et jamais masqué · `401` · `404` aucune statistique **ou** aucune relation ouvrant ce droit (les deux cas sont volontairement indiscernables ; **cette route ne renvoie plus `403`**) |
| PUT | /profiles/:userId/administrative | 🔒 | eleve (soi-même), responsable_pedagogique, technicien_informatique | Modifier le profil administratif (`firstName`/`lastName` restent optionnels pour ne pas modifier le champ, mais rejettent une chaîne vide). Champs acceptés : voir « Noms de champs des profils » ci-dessous | `200 {userId, ...champsAdmin}` · `400` firstName/lastName vide, champ inconnu, ou type invalide · `401` · `403` · `404` |
| PUT | /profiles/:userId/pedagogical | 🔒 | eleve (soi-même), formateur (soi-même), responsable_pedagogique, technicien_informatique | Modifier la **section déclarative** du profil pédagogique — ce que le titulaire déclare sur lui-même. Le rôle cible (élève/formateur) est résolu depuis le rôle du compte auprès d'identity-access-service, puis à défaut depuis les champs présents. **N'accepte aucun champ de prescription** ni `filledBy`/`filledAt` ni `isAnimateurPedagogique` | `200 {userId, ...champsPedago}` · `400` champ inconnu, champ de prescription, ou champ appartenant à l'autre rôle (refusé au lieu d'être ignoré) · `401` · `403` · `404` |
| PUT | /profiles/:userId/prescription | 🔒 | **responsable_pedagogique uniquement** | Modifier la **section prescription** du profil pédagogique — ce que le RP prescrit *sur* la personne. Réservé au RP **y compris quand la cible est l'appelant lui-même** : un élève ne rédige pas ses préconisations, un formateur pas ses résultats de test. `filledBy`/`filledAt` sont posés **côté serveur** (acteur authentifié + horloge serveur) et rendent la prescription opposable | `200 {userId, ...profilPédagoComplet, filledBy, filledAt}` · `400` champ inconnu (dont `filledBy`/`filledAt` ou tout champ déclaratif), corps mélangeant les deux rôles, ou champ de l'autre rôle · `401` · `403` tout rôle autre que RP · `404` |
| GET | /profiles/:userId/field-visibility | 🔒 | eleve/formateur (soi-même), responsable_pedagogique, technicien_informatique, administrateur_financier | Lire la visibilité **effective des champs administrables pour ce titulaire** — un seul appel suffit à construire l'écran de confidentialité. **Filtré par le rôle réel du titulaire** (arbitrage du 2026-08-17, résolu auprès d'identity-access-service) : le bloc `administrative` est toujours présent, mais un **seul** bloc pédagogique l'est — celui du rôle réel (élève → `pedagogical-student`, formateur → `pedagogical-teacher`), **jamais les deux** ; un rôle sans profil pédagogique (parent, RP, AP, TI, AF) n'a que le bloc administratif. **`firstName`/`lastName` ne figurent plus au catalogue** : ils ne sont plus réglables et restent toujours visibles, quel que soit le lecteur. **Défaut commun `linked` depuis le 2026-08-17** pour tous les autres champs, section prescription comprise (l'ancien défaut plus restrictif `self` disparaît, sauf réglage explicite du titulaire) | `200 {userId, fields: [{fieldName, block, audience, defaultAudience, isExplicit, isPrescription, isReserved}]}` · `401` · `403` · `404` `userId` inconnu de identity-access-service |
| PUT | /profiles/:userId/field-visibility | 🔒 | eleve/formateur (soi-même), responsable_pedagogique, technicien_informatique, administrateur_financier | Régler la visibilité champ par champ. Body `{fields: [{fieldName, audience}]}`. **Upsert partiel** : seuls les champs listés sont modifiés, les autres gardent leur réglage. Pour revenir au défaut, renvoyer le champ avec son `defaultAudience`. Le `fieldName` doit appartenir au **sous-catalogue applicable à ce titulaire** (administratif + son seul bloc pédagogique) : `firstName`/`lastName`, ou un champ du bloc pédagogique de l'**autre** rôle, sont refusés comme n'importe quel `fieldName` hors catalogue | `200` (même forme que le `GET`) · `400` `fieldName` hors du catalogue applicable — dont `firstName`/`lastName` (jamais réglables) et tout champ du bloc pédagogique de l'autre rôle — (message listant les noms acceptés pour ce titulaire), `fieldName` dupliqué, `audience` hors énumération, tableau `fields` vide · `401` · `403` · `404` `userId` inconnu de identity-access-service |
| POST | /profiles/:teacherId/ap-status | 🔒 | responsable_pedagogique | Promouvoir un formateur en Animateur Pédagogique. **Seul point d'écriture** de `isAnimateurPedagogique` : c'est un droit, pas une déclaration, et il a été retiré du DTO de `PUT /profiles/:userId/pedagogical` | `201 {userId, isAnimateurPedagogique: true}` · `401` · `403` · `404` |
| GET | /profiles/:userId/internal-notes | 🔒 | responsable_pedagogique, animateur_pedagogique, technicien_informatique, administrateur_financier | Lister les notes internes confidentielles (non visibles par l'élève, le parent/financeur ni le formateur) | `200 [{id, authorId, content, createdAt}]` · `401` · `403` |
| POST | /profiles/:userId/internal-notes | 🔒 | responsable_pedagogique, animateur_pedagogique | Créer une note interne confidentielle (non visible par l'élève, le parent/financeur ni le formateur) | `201 {id, authorId, content, createdAt}` · `400` body vide · `401` · `403` |
| PUT | /profiles/:userId/internal-notes/:id | 🔒 | auteur, responsable_pedagogique | Modifier une note interne | `200 {id, authorId, content, updatedAt}` · `401` · `403` · `404` |
| DELETE | /profiles/:userId/internal-notes/:id | 🔒 | responsable_pedagogique | Supprimer une note interne | `204` · `401` · `403` · `404` |

### Photo de profil

> Ajoutée le 2026-08-10. `avatarUrl` n'est plus une URL externe collée à la main : les octets sont
> stockés par l'application, sur le volume nommé `media_data` (`MEDIA_STORAGE_PATH`). En conséquence,
> **envoyer `avatarUrl` à `PUT /profiles/:userId/administrative` renvoie `400`** — le champ reste
> **lisible** dans le bloc `administrative`, où il porte l'URL de lecture ci-dessous.

| Méthode | Chemin | Auth | Rôles autorisés | Description | Réponse attendue |
|---|---|---|---|---|---|
| GET | /profiles/avatar/constraints | 🔒 | tout compte authentifié | **À lire AVANT d'ouvrir le sélecteur de fichier.** Publie les contraintes d'envoi en vigueur, pour que le front les affiche et rejette localement un fichier trop lourd, plutôt que de laisser l'utilisateur le découvrir après plusieurs secondes d'envoi. Pas de `:userId` : les contraintes ne dépendent ni du profil visé ni du lecteur. **Ces valeurs ne doivent pas être codées en dur côté front** — elles viennent de la même configuration que celle opposée à l'envoi, une copie divergerait au premier ajustement et annoncerait alors une limite fausse | `200 {maxUploadBytes, acceptedContentTypes, outputContentType, maxDimensionPixels}` — ex. `{"maxUploadBytes":1000000,"acceptedContentTypes":["image/jpeg","image/png","image/webp","image/gif","image/avif"],"outputContentType":"image/webp","maxDimensionPixels":512}` · `401` |
| POST | /profiles/:userId/avatar | 🔒 | **le titulaire seul** | Envoyer ou remplacer la photo. **Multipart**, champ `file`, un seul fichier. Le type est détecté sur les **octets réels** (nombres magiques) — ni l'extension ni le `Content-Type` du client ne sont consultés, tous deux étant sous son contrôle. L'image est **intégralement ré-encodée** en WebP borné à 512 px, ce qui neutralise toute charge dissimulée et **supprime les métadonnées EXIF**, géolocalisation comprise. **SVG refusé** (document XML exécutable). Le nom du fichier stocké est un UUID généré par le serveur. Le fichier précédent est supprimé du volume. Formats acceptés : JPEG, PNG, WebP, GIF, AVIF | `200 {avatarUrl}` — URL de lecture versionnée, identique à celle du bloc `administrative` · `400` aucun fichier, format non reconnu, SVG, HEIC/HEIF, image illisible · `401` · `403` appelant autre que le titulaire · `413` au-delà de `MEDIA_MAX_UPLOAD_BYTES` (**1 000 000 octets** par défaut) — **corps structuré, voir ci-dessous** · `500` profil administratif absent, ou stockage indisponible |
| GET | /profiles/:userId/avatar | 🔒 | mêmes règles de lecture que le champ `avatarUrl` | Renvoie les **octets** de l'image (`image/webp`), pas une redirection. Passe par le **même** port de filtrage de visibilité que `GET /profiles/:userId` : ne refiltre rien de son côté, sinon elle en serait le contournement exact. **Photo masquée pour ce lecteur ⇒ `404`, pas `403`** — cohérent avec « un champ masqué est absent », un `403` révélerait son existence. Le message est **le même** que pour une absence de photo, et c'est voulu | `200` octets + en-têtes `Content-Type: image/webp`, `Content-Length`, `ETag`, `Cache-Control: private, max-age=60, must-revalidate` · `401` · `403` aucun droit de lecture sur le **profil** (formateur ou parent non rattaché, élève consultant autrui) · `404` pas de photo **ou** photo masquée pour ce lecteur |
| DELETE | /profiles/:userId/avatar | 🔒 | **le titulaire seul** | Supprime la photo : la référence en base **et** le fichier sur le volume. **Idempotent** : supprimer une photo déjà absente répond `204`, pas `404` — l'état visé est atteint, et un double clic sur « Supprimer » ne doit pas produire d'erreur. Ce n'est pas un champ accepté puis ignoré, mais la sémantique normale de DELETE. Après suppression, `avatarUrl` vaut `null` | `204` · `401` · `403` appelant autre que le titulaire |

**Droit d'écriture — le titulaire seul, sans exception administrative.** Plus restrictif que
`PUT /profiles/:userId/administrative`, qui ouvre l'écriture au RP, au TI et à l'AF : chaque rôle
administratif écrit **dans son domaine**, or la photo n'appartient au domaine d'aucun d'eux. Le
parent financeur **lit tout mais n'écrit rien** (arbitrage du 2026-08-09). Le TI qui doit neutraliser
une photo passe par `POST /admin/visibility-overrides`, pas par un remplacement.

**`avatarUrl` — forme exacte** : `/api/v1/profiles/{userId}/avatar?v={horodatage}`, ou `null` quand
il n'y a pas de photo. Le préfixe est réglable par `AVATAR_PUBLIC_PATH_PREFIX`. Le paramètre `v`
porte l'horodatage du dernier envoi : il **change à chaque remplacement**, ce qui évite qu'une photo
remplacée reste affichée depuis le cache du navigateur. **Aucun chemin de fichier ni clé de stockage
n'apparaît jamais** dans une réponse ni dans un message d'erreur — c'est ce qui rendra le passage à
un stockage objet possible sans toucher un seul appelant.

> ⚠️ **`<img src={avatarUrl}>` ne fonctionne pas directement.** La route est authentifiée par le JWT
> porté dans l'en-tête `Authorization`, que le navigateur n'envoie pas sur une balise `<img>`. Le
> front doit récupérer les octets (`fetch` avec le jeton) puis construire un object URL.

**Taille maximale — 1 000 000 octets (1 Mo), et pourquoi cette valeur précise.**

Le reverse-proxy `nginx-global` placé devant l'application ne déclare aucun `client_max_body_size` :
son défaut de **1 Mio (1 048 576 octets)** s'applique donc, et il porte sur le **corps entier** de la
requête — enveloppe multipart, frontières et en-têtes de partie compris —, pas seulement sur les
octets du fichier. Au-delà, nginx répond un `413` **en HTML** sans jamais transmettre la requête : le
service ne voit rien, le front reçoit une page qu'il ne sait pas lire, l'utilisateur n'obtient aucun
message exploitable. Vérifié le 2026-08-10 : 0,5 Mo passe, 2 Mo est déjà coupé.

Le plafond applicatif est donc fixé **sous** celui du proxy, à 1 000 000 octets (1 Mo au sens SI),
soit ~48 Ko de marge : de quoi absorber l'enveloppe multipart et garantir que **le refus vienne
toujours de l'application**, avec un corps JSON exploitable. Un plafond réglé à 1 Mio pile aurait
laissé une bande de quelques kilo-octets où le fichier passe le contrôle applicatif mais où
l'enveloppe fait dépasser nginx.

**Il y a trois couches, pas deux.** `api-gateway` est lui aussi un nginx, et il ne déclarait aucun
`client_max_body_size` : son défaut de 1 Mio s'appliquait donc une seconde fois, en silence.
Vérifié le 2026-08-10 en attaquant la gateway directement, hors `nginx-global` : 1 048 000 octets
passaient, 1 048 500 repartaient en `413` HTML. Le plafond est désormais **déclaré à 10 Mio** dans
`gateway/api-gateway/nginx.conf`, franchement au-dessus des deux autres, pour que la gateway ne soit
jamais le maillon qui coupe ; un `413` qu'elle émettrait malgré tout répond maintenant en JSON.

| Couche | Plafond | Emplacement | Réponse au-delà |
|---|---|---|---|
| `nginx-global` | 1 Mio (défaut **non déclaré**) | hors dépôt | `413` HTML |
| `api-gateway` | 10 Mio (déclaré) | `gateway/api-gateway/nginx.conf` | `413` JSON |
| `profile-service` | 1 000 000 o | `MEDIA_MAX_UPLOAD_BYTES` | `413` JSON structuré ci-dessous |

> ⚠️ Ce n'est **pas** la limite souhaitable à terme — une photo de téléphone pèse couramment 2 à
> 5 Mo. Elle est basse parce que le `client_max_body_size` qui contraint réellement vit **hors de ce
> dépôt** (`/home/debian/NginxGlobal/nginx.conf`, bloc `location /api/v1/` de
> `claudevma.visioprof.fr`) et n'a pas encore été corrigé. Le jour où il le sera, remonter
> `MEDIA_MAX_UPLOAD_BYTES` dans `docker-compose.yml` **et** `DEFAULT_MAX_UPLOAD_BYTES` dans
> `src/media/media.config.ts`, en conservant la même marge sous le plafond du proxy — et **vérifier
> au passage** que le plafond de `api-gateway` reste au-dessus des deux.

Le refus est prononcé **en streaming**, par multer, dès le dépassement : le contrôleur n'est pas
atteint et les octets excédentaires ne sont jamais chargés en mémoire. Un contrôle placé seulement
après lecture complète aurait offert à tout appelant authentifié un moyen de faire enfler la mémoire
du service. Le service refait le contrôle derrière, pour les appels qui n'empruntent pas
l'intercepteur.

**Corps de la réponse `413` — clés stables.** Le front teste `code`, **jamais** `message` : celui-ci
est en anglais technique, le libellé français est construit côté client à partir de `maxUploadBytes`
(règle de langue du 2026-08-09).

```json
{
  "statusCode": 413,
  "error": "Payload Too Large",
  "code": "UPLOAD_FILE_TOO_LARGE",
  "message": "Uploaded file exceeds the maximum allowed size",
  "maxUploadBytes": 1000000,
  "receivedBytes": null,
  "requestBodyBytes": 1258291
}
```

| Clé | Type | Signification |
|---|---|---|
| `code` | `string` | `UPLOAD_FILE_TOO_LARGE`. **Toujours présent**, c'est le seul point d'accroche stable du front |
| `maxUploadBytes` | `number` | Plafond appliqué, en octets, sur les octets du **fichier** avant ré-encodage. **Toujours présent** |
| `receivedBytes` | `number \| null` | Taille **exacte** du fichier, connue uniquement si le fichier a été lu en entier (refus par le service). `null` quand multer a coupé le flux : le fichier n'a jamais été reçu en entier, annoncer une taille serait une invention |
| `requestBodyBytes` | `number \| null` | `Content-Length` **déclaré** par le client pour le corps entier, enveloppe multipart comprise — donc toujours un peu supérieur au fichier. `null` si le client n'a rien déclaré. Diagnostic seulement : déclaré n'est pas vérifié |

Le front connaît de toute façon `File.size` avant l'envoi : la clé qui compte vraiment est
`maxUploadBytes`, les deux autres servent au diagnostic et aux journaux.

> ⚠️ **Le front doit tolérer un `413` dont le corps n'est pas du JSON.** Si les deux plafonds
> venaient à diverger, celui de nginx s'appliquerait le premier et renverrait une page HTML, sans
> aucune de ces clés. Le réglage actuel rend ce cas improbable, pas impossible.

### Noms de champs des profils

> Arbitrage du 2026-08-07 : **tous les noms de champs des profils sont en anglais**, à l'entrée
> comme à la sortie. Les noms français qui circulaient auparavant (`telephone`, `adresseLigne1`,
> `niveauScolaire`, `matieres`, `objectifsPedagogiques`…) ne sont **plus acceptés** et renvoient
> désormais `400` (`forbidNonWhitelisted`). Les noms de **colonnes en base** restent inchangés :
> ils sont mappés dans les entités et ne sont visibles d'aucun client.
>
> Ces listes sont exhaustives et identiques en écriture (`PUT`) et en lecture
> (`GET /profiles/:userId`) : tout champ absent de ces tableaux fait échouer la requête en `400`.

**Profil administratif** — `PUT /profiles/:userId/administrative`, bloc `administrative` de `GET /profiles/:userId`

| Champ | Type | Remarque |
|---|---|---|
| `firstName` | `string` | Non vide si fourni (100 max) |
| `lastName` | `string` | Non vide si fourni (100 max) |
| `birthDate` | `string` | Date ISO (`2005-06-15`) |
| `phone` | `string` | Non vide si fourni (20 max) |
| `addressLine1` | `string` | **Première ligne** d'adresse (numéro et voie), pas l'adresse complète (200 max) |
| `addressLine2` | `string` | Seconde ligne (appartement, étage, bâtiment…) (200 max) |
| `postalCode` | `string` | 20 max |
| `city` | `string` | 100 max |
| `country` | `string` | 100 max |
| `avatarUrl` | `string` | **LECTURE SEULE — `400` si envoyé.** Géré par l'application depuis le 2026-08-10 : URL construite par le serveur vers `GET /profiles/:userId/avatar`, avec un jeton de version (`?v=`). Voir « Photo de profil » ci-dessus |
| `passions` | `string[]` | Centres d'intérêt / hobbies |

> `department` a été **supprimé le 2026-08-11** (demande utilisateur). La colonne `departement` est
> droppée, le champ ne figure plus ni au catalogue de visibilité ni dans la réponse. L'envoyer
> renvoie désormais `400 property department should not exist`.

**Profil pédagogique — section déclarative** — `PUT /profiles/:userId/pedagogical`

Ce que le **titulaire** déclare sur lui-même.

| Champ | Type | Profil | Remarque |
|---|---|---|---|
| `level` | `string` | Élève | Niveau scolaire suivi (100 max) |
| `schoolName` | `string` | Élève | **Nom de l'établissement** scolaire fréquenté (200 max). Un nom propre, pas une description : tout ce qui relève de la situation scolaire va dans `schoolContext` |
| `goals` | `string` | Élève | Objectifs pédagogiques (2000 max) |
| `specificNeeds` | `string` | Élève | **Aménagements reconnus** : DYS, PAP, PPS (2000 max) |
| `difficulties` | `string` | Élève | **Ce sur quoi l'élève bute** (2000 max). À ne PAS confondre avec `specificNeeds` : le premier est une difficulté d'apprentissage, le second un aménagement reconnu |
| `familyContext` | `string` | Élève | Situation **familiale** utile au suivi : fratrie, séparation, disponibilité des parents… (2000 max) |
| `schoolContext` | `string` | Élève | Situation **scolaire** utile au suivi : redoublement, changement d'établissement, options, ambiance de classe… (2000 max) |
| `equipment` | `string` | Élève | **Lieu des cours et équipement** : pièce dédiée, ordinateur, tablette, connexion, webcam… (2000 max). UN SEUL champ libre, volontairement pas deux |
| `levels` | `string[]` | Formateur | Niveaux enseignés |
| `experience` | `string` | Formateur | Expérience pédagogique (3000 max) |
| `diplomas` | `string` | Formateur | Titres et certifications déclarés (2000 max) |
| `specialties` | `string[]` | Formateur | **Distinct de `subjects`** : « Préparation Grand Oral », « Remise à niveau ». `subjects` porte la matière, `specialties` le type d'accompagnement |
| `particularities` | `string` | Formateur | Modalités, contraintes, publics particuliers (3000 max) |
| `cvDocumentId` | `string` | Formateur | **Référence** du CV auprès d'`archive-document-service` (255 max). Jamais une URL de fichier : `profile-service` ne stocke aucun document |
| `subjects` | `string[]` | Les deux | Matières étudiées (profil élève) ou enseignées (profil formateur). **Toujours un tableau**, jamais une chaîne |

> Le champ unique `context` a été **séparé le 2026-08-11** en `familyContext` et `schoolContext`
> (demande utilisateur). La colonne `context` est droppée ; son contenu a été recopié dans
> `family_context` par la migration `1754910000000-SplitStudentContextAndDropDepartment`, avant le
> DROP. Envoyer `context` renvoie désormais `400 property context should not exist`.

**Profil pédagogique — section prescription** — `PUT /profiles/:userId/prescription` (**RP seul**)

Ce que le **responsable pédagogique** prescrit *sur* la personne. Le titulaire **lit** ces champs
dans `pedagogical` (`GET /profiles/:userId`) mais ne peut **jamais** les écrire : les envoyer à
`PUT /profiles/:userId/pedagogical` renvoie `400`.

| Champ | Type | Profil | Remarque |
|---|---|---|---|
| `generalAssessment` | `string` | Élève | Considération générale (4000 max) |
| `recommendedPace` | `string` | Élève | Rythme préconisé (2000 max) |
| `recommendedTeacherProfile` | `string` | Élève | Type de formateur préconisé (2000 max) |
| `recommendedPath` | `string` | Élève | Parcours préconisé (2000 max) |
| `recommendedActivities` | `string` | Élève | Activités préconisées (2000 max) |
| `maxValidatedLevel` | `string` | Formateur | Niveau maximum validé (100 max) |
| `audienceType` | `string` | Formateur | Type de public habilité (2000 max) |
| `testResults` | `string` | Formateur | Résultats de tests (2000 max). **Déplacé** de la section déclarative : c'est une évaluation menée par le RP, un formateur ne doit pas pouvoir écrire ses propres résultats |
| `testComments` | `string` | Formateur | Commentaires du RP sur les tests (4000 max) |
| `filledBy` | `uuid` | Les deux | **Lecture seule.** `userId` du RP auteur, posé côté serveur. Envoyé dans le corps → `400` |
| `filledAt` | `string` | Les deux | **Lecture seule.** Horodatage ISO posé côté serveur. Envoyé dans le corps → `400` |

**Résolution du profil cible (élève vs formateur)** — commune aux deux routes d'écriture :

1. corps mélangeant des champs des deux rôles → `400` ;
2. rôle du compte auprès d'identity-access-service (`eleve` → élève ; `formateur`/`animateur_pedagogique` → formateur) — **source autoritative**, elle referme l'ambiguïté historique d'un corps ne contenant que `subjects` ;
3. si identity-access-service est injoignable : les champs présents ;
4. à défaut, le profil déjà existant en base ;
5. en dernier recours, le profil formateur (comportement hérité).

Une fois le rôle résolu, un champ appartenant à l'autre rôle est **refusé en `400`**, jamais ignoré
en silence — un champ envoyé et non pris en compte ne doit pas produire un `200` trompeur.

`GET /profiles/:userId` renvoie `pedagogical: null` et `pedagogicalType: null` tant qu'aucun profil
pédagogique n'existe — état normal. Le premier `PUT` (déclaratif ou prescription) le crée.

**Champ retiré** : `isAnimateurPedagogique` n'est plus accepté par `PUT /profiles/:userId/pedagogical`
(`400`). C'est un droit, attribué par `POST /profiles/:teacherId/ap-status` ; le laisser dans le DTO
de profil exposait une promotion de rôle à une route d'auto-édition. Il reste **lisible** dans le
bloc `pedagogical`.

### Visibilité champ par champ

> Remplace `GET`/`PATCH /profiles/:userId/visibility-preferences`, **supprimées** (`404` désormais)
> avec la table `profile_visibility_preferences` et ses deux booléens nommés en dur
> (`hideDifficultiesFromContacts`, `restrictCommentsToPrincipalTeacher`). Chaque nouveau champ
> masquable y aurait ajouté une colonne. Les réglages existants ont été migrés en lignes sans
> perte — `true` → `self`, `false` → `linked`, les deux sens repris explicitement.

`audience` ∈ `self` (titulaire et administrateurs seuls) | `linked` (aussi les personnes liées) |
`all` (tout utilisateur authentifié).

**Révision du 2026-08-17.** `firstName` et `lastName` **ont quitté le catalogue** : ils ne sont
plus réglables (`PUT` les refuse en `400`) et sont **toujours visibles**, quel que soit le lecteur —
aucun réglage ne peut plus les masquer. **Tous les champs restant au catalogue** — section
déclarative et section prescription confondues, sans exception — partagent désormais **le même
défaut : `linked`** (visible des personnes liées). L'ancien socle étroit
(`avatarUrl`/`level`/`subjects` seuls visibles par défaut, tout le reste `self`) a disparu. Un
défaut plus restrictif (`self`) reste atteignable par un réglage explicite du titulaire. Ce
changement de défaut s'applique **sans migration** aux profils existants : le défaut est calculé à
la lecture, jamais écrit en base à la création d'un profil.

**Catalogue filtré par le rôle réel du titulaire** (même révision) : `GET`/`PUT` sur
`/profiles/:userId/field-visibility` ne portent que sur le bloc `administrative` **et** le seul
bloc pédagogique correspondant au rôle réel de `:userId` (résolu auprès d'identity-access-service)
— élève → `pedagogical-student` uniquement, formateur → `pedagogical-teacher` uniquement, tout
autre rôle → aucun bloc pédagogique. Avant cette révision, le catalogue entier (les deux blocs
pédagogiques) était renvoyé à tout titulaire — un élève se voyait proposer de régler des champs du
profil pédagogique **formateur**, bug corrigé ici.

Le `fieldName` doit appartenir au sous-catalogue **applicable à ce titulaire**
(`src/profiles/field-visibility.catalog.ts`, filtré comme ci-dessus). Liste complète du catalogue
(avant filtrage par rôle), dans l'ordre alphabétique renvoyé par le message d'erreur `400` :
`addressLine1`, `addressLine2`, `audienceType`, `avatarUrl`, `birthDate`, `city`, `comments`,
`country`, `cvDocumentId`, `difficulties`, `diplomas`, `equipment`, `experience`, `familyContext`,
`generalAssessment`, `goals`, `level`, `levels`, `maxValidatedLevel`,
`particularities`, `passions`, `phone`, `postalCode`, `recommendedActivities`, `recommendedPace`,
`recommendedPath`, `recommendedTeacherProfile`, `schoolContext`, `schoolName`, `specialties`,
`specificNeeds`, `subjects`, `testComments`, `testResults`.

`context` et `department` ont quitté cette liste le 2026-08-11, en même temps que leurs colonnes.
`firstName` et `lastName` en sont sortis le 2026-08-17 (voir ci-dessus).

`comments` est marqué `isReserved: true` : c'est un champ du profil pédagogique élève au sens du
CdC, dont le réglage de visibilité est conservé depuis le modèle hérité, mais qu'aucune colonne ne
porte à ce jour.

#### Application en lecture (2026-08-09)

Ces réglages sont **appliqués** par `GET /profiles/:userId` et `GET /profiles/:userId/statistics`
depuis l'arbitrage du 2026-08-09 (`docs/architecture.md` > « Arbitrages rendus »).

**Exemptés du filtrage — voient la fiche entière :**

| Lecteur | Motif |
|---|---|
| Le **titulaire** | On ne se masque jamais ses propres données. Il lit sa fiche complète, **prescription comprise** (qu'il ne peut toujours pas écrire) |
| Le **parent financeur rattaché** | « Le parent financeur voit tout, sauf le carnet personnel. » Un élève **ne peut pas** masquer une donnée de profil à son parent financeur. Le carnet personnel appartient à `pedagogical-log-service` et n'est pas concerné par ce filtrage |
| `responsable_pedagogique`, `animateur_pedagogique`, `technicien_informatique`, `administrateur_financier` | Administrateurs, chacun dans le périmètre de lecture déjà contrôlé par les règles d'accès. Le RP **écrit** la section prescription, dont tous les champs sont `self` par défaut : filtré, il ne relirait pas ce qu'il vient d'écrire |

L'exemption du parent financeur est **conditionnelle au rattachement** : un parent non rattaché est
refusé avant tout filtrage — l'exemption suppose le lien, elle ne le remplace pas. (`403` sur
`GET /profiles/:userId` ; `404` sur `GET /profiles/:userId/statistics` depuis le 2026-08-11.)

> **Précision du 2026-08-11 pour `GET /profiles/:userId/statistics`.** Les exemptions ci-dessus y
> sont **conditionnées à la relation**, et non au seul rôle :
> - le **parent financeur** est exempté sur **ses élèves**, mais seulement *lié* — donc filtré — sur
>   les **formateurs de ses élèves** : le lien indirect ouvre la lecture, il ne lève pas le masquage ;
> - l'**animateur pédagogique** est exempté sur les **formateurs qu'il anime**, et n'a accès à
>   personne d'autre : il n'est **pas** un administrateur.
>
> `GET /profiles/:userId` n'a **pas** été aligné dans ce lot : il y exempte encore l'AP par son seul
> rôle et refuse à l'élève la lecture du profil de son formateur. Écart connu, à traiter séparément.

**Soumis au filtrage :** les autres contacts liés — aujourd'hui le **formateur** rattaché, demain
élève↔élève. Un lecteur `linked` voit les champs réglés `linked` ou `all` ; un lecteur authentifié
sans lien ne voit que les champs `all`.

> **Professeur principal : non tranché.** En l'absence de décision, il subit les réglages **comme
> tout contact lié** ; le drapeau `isPrincipalTeacher` de `TeacherStudentLink` n'est pas consulté.
> À rouvrir si ce comportement ne convient pas.

**Comment un champ masqué se lit dans la réponse.** `GET /profiles/:userId` et
`GET /profiles/:userId/statistics` renvoient un bloc supplémentaire :

```json
"visibility": { "isFiltered": true, "hiddenFields": ["difficulties", "filledBy", "phone"] }
```

- un champ masqué est **absent** de son bloc, et son nom figure dans `hiddenFields` ;
- il n'est **jamais** remplacé par `null` ni par une chaîne vide.

Le consommateur distingue donc les deux états sans convention implicite :

| Observation | Signification |
|---|---|
| Clé **présente** valant `null` | Champ **non renseigné** |
| Clé **absente** + nom dans `hiddenFields` | Champ **masqué** par le titulaire |

`isFiltered: false` signifie « fiche renvoyée en entier » — ce n'est **pas** la même information
qu'un `hiddenFields` vide chez un lecteur filtré dont tous les champs se trouvent visibles.

**Jamais masqués** (champs de structure, pas des données personnelles — le front en a besoin pour
savoir quoi afficher) : `userId`, `createdAt`, `updatedAt`, `pedagogicalType`, `loginIdentifier` et
`isAnimateurPedagogique` (un droit attribué par le RP, absent du catalogue donc non réglable).

`filledBy` / `filledAt` ne sont pas au catalogue mais **suivent la section prescription** : renvoyés
seulement si au moins un champ de prescription est visible pour ce lecteur — sinon leur seule
présence révélerait qu'un RP a prescrit quelque chose, et quand.

`comments` (marqué `isReserved`) n'apparaît jamais dans `hiddenFields` : aucune colonne ne le porte,
il n'y a donc rien à masquer, et l'annoncer masqué laisserait croire à une donnée cachée.

**Les routes `/internal/*` ne sont pas filtrées** : elles servent des services, pas des utilisateurs
finaux, n'ont aucun acteur authentifié et ne passent pas par `GET /profiles/:userId`.

### Validation des formateurs

Machine à trois états : `pending` → `in_review` → `validated` | `rejected`.

- `pending` : état initial d'un formateur nouvellement inscrit. **L'enregistrement est créé à
  l'inscription** (arbitrage du 2026-08-12) — voir l'encadré ci-dessous.
- `in_review` : le RP a pris le dossier en charge et l'instruit.
- `validated` / `rejected` : états terminaux.

> **L'enregistrement de validation est créé à l'inscription, jamais par une lecture (2026-08-12).**
>
> Défaut corrigé, mesuré contre la pile : un formateur créé par `POST /accounts/teachers` était lu
> `pending` par `GET /profiles/:teacherId/validation` mais **n'apparaissait jamais** dans
> `GET /profiles/teachers/pending-validation`. L'inscription ne créait aucune ligne ; la lecture
> unitaire en fabriquait une de synthèse, la liste ne montrait que les lignes réelles. Le formateur
> n'était donc jamais vu du RP, jamais validé, jamais proposable — cul-de-sac silencieux.
>
> - **Même règle que le profil administratif** : l'enregistrement existe dès la création du compte.
>   Son absence pour un formateur est une **incohérence de données**, pas un état normal — à la
>   différence du profil pédagogique, facultatif par nature.
> - **Le repli de synthèse subsiste, mais ne masque plus.** `GET /profiles/:teacherId/validation`
>   répond toujours `200 {teacherId, status: "pending"}` quand aucune ligne n'existe — refuser la
>   lecture n'aiderait ni le formateur ni le RP — mais l'anomalie est désormais **journalisée en
>   `error`** côté serveur (« ANOMALIE DE DONNEES »), avec le renvoi vers le script de reprise.
> - **Deux chemins de création**, tous deux couverts : `POST /internal/create-teacher-profiles`
>   (workflow orchestré, inconditionnel) et `POST /internal/create-administrative-profile` **avec
>   `role: "formateur"`** — c'est ce dernier qu'emprunte réellement `POST /accounts/teachers`.
> - **Reprise de stock** : `POST /internal/teachers/ensure-validations`, appelée par
>   `scripts/maintenance/backfill-teacher-validations.ts`. Jouée le 2026-08-12 sur la base réelle :
>   **16 enregistrements créés, 2 déjà présents laissés intacts** (statut *et* commentaire du RP).

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
| GET | /profiles/teachers/pending-validation | 🔒 | responsable_pedagogique | **File de travail du RP** : les formateurs dont la validation est `pending`, **triés par ancienneté** (le premier inscrit est le premier examiné), enrichis du nom depuis le profil administratif. **Bornée et paginée depuis le 2026-08-12**, même forme et mêmes plafonds que `/profiles/teachers/validated` : query `page` (défaut `1`) et `limit` (défaut `20`, **maximum `100`**). RP seul : instruire un dossier de formateur est son métier ; le TI peut trancher un dossier ouvert sans disposer de la file | `200 {data: [{userId, firstName, lastName, levels, subjects, pendingSince}], page, limit, total, totalPages}` · `400` `page`/`limit` non entier ou < 1, `limit` > 100, **ou paramètre de requête inconnu** · `401` · `403` tout autre rôle |
| PATCH | /profiles/:teacherId/validation | 🔒 | responsable_pedagogique, technicien_informatique | Changer le statut de validation d'un formateur. Body : `{status: "pending"\|"in_review"\|"validated"\|"rejected", comment?}` (`comment` ≤ 2000 caractères). Upsert : l'enregistrement est créé s'il n'existe pas encore | `200 {id, teacherId, status, validatedBy, validatorRole, comment, createdAt, updatedAt}` · `400` statut hors énumération · `401` · `403` rôle non autorisé **ou transition interdite pour ce rôle** (voir tableau ci-dessus) |
| GET | /profiles/:teacherId/validation | 🔒 | responsable_pedagogique, technicien_informatique, administrateur_financier, formateur (soi-même) | Lire le statut de validation courant d'un formateur | `200 {id, teacherId, status, validatedBy, validatorRole, comment, createdAt, updatedAt}` · `200 {teacherId, status: "pending"}` **repli d'incohérence de données** si aucun enregistrement n'existe : depuis le 2026-08-12 ce n'est plus un état normal, et le serveur journalise « ANOMALIE DE DONNEES » · `401` · `403` autre formateur |

**Lecture par le formateur lui-même, vérifiée le 2026-08-13** (arbitrage « Visibilité du statut de
validation, côté formateur ») : `getTeacherValidation` autorisait déjà le titulaire à lire sa propre
ligne (`actor.id === teacherId` court-circuite la liste de rôles), et aucun `@Roles()` ne restreint
la route côté `TeacherValidationController` — c'était déjà en place et testé depuis la PR #102
(2026-08-12), avant même que l'arbitrage ne soit rendu. Aucun code n'a été modifié ici.

**Horodatage exploitable pour l'année de refus** : `updatedAt` est fiable pour dériver l'année de la
dernière transition vers `rejected`. `rejected` est un état **terminal** — `assertValidationTransition`
n'autorise aucune transition sortante depuis `rejected` — et `bootstrapTeacherValidation` (reprise de
stock, rejeu d'inscription) ne réécrit **jamais** un enregistrement existant, quel que soit son
statut. Une fois `rejected`, `updatedAt` ne bouge donc plus : `new Date(updatedAt).getFullYear()` sur
la réponse de `GET /profiles/:teacherId/validation` donne l'année du refus, sans champ dédié à
ajouter. Vérifié contre PostgreSQL réel le 2026-08-13.

**Changement de contrat du 2026-08-12 sur `pending-validation`** — le front doit être rebranché :

| | Avant | Après |
|---|---|---|
| Enveloppe | tableau nu, **non borné** | `{data, page, limit, total, totalPages}` |
| Identifiant | `teacherId` | `userId` — même nom que dans `/teachers/validated` et partout ailleurs |
| Date | `createdAt` | `pendingSince` — dans une liste de *personnes*, `createdAt` se lisait « date de création du formateur » |
| Champ `id` | id de l'enregistrement de validation | **supprimé** : `PATCH /profiles/:teacherId/validation` adresse par `teacherId`, le front n'en avait aucun usage, et c'était un UUID de plus exposé |
| Champs ajoutés | — | `levels`, `subjects` : le RP décide plus vite, et les deux listes deviennent identiques au champ `pendingSince` près |

Les deux listes de formateurs partagent désormais **un seul DTO de pagination**
(`TeachersPageQueryDto`) et **une seule mécanique de requête** (`TeacherDirectoryService`). C'est ce
qui rend la divergence impossible à réintroduire : c'est précisément parce qu'elles vivaient dans
deux services distincts que l'une était bornée et l'autre pas.

**Messages de refus en français** (règle du 2026-08-09) : les messages du cycle de validation
étaient en anglais (`"Only TI may bypass the in_review step…"`) et remontaient jusqu'à l'écran. Ils
sont traduits, et les libellés d'état (`en attente`, `en cours d'examen`, `validé`, `refusé`) sont
tenus **en un point unique** côté serveur (`teacher-validation.entity.ts`) plutôt que réécrits dans
chaque message. Le refus générique de `RolesGuard` (`"Insufficient role"`), partagé par **toutes**
les routes du service, est traduit lui aussi.

### Annuaire des formateurs validés (2026-08-12)

> Arbitrage du 2026-08-12 (`docs/architecture.md` > « Annuaire des formateurs validés »), en levée du
> blocage de l'**étape 3 du flow « demande de professeur »** : le RP devait désigner les formateurs
> destinataires d'une proposition, sans qu'aucune route ne lui permette de les lister. Faire saisir un
> UUID est interdit (arbitrage du 2026-08-09), et `GET /profiles/teachers/pending-validation` liste les
> formateurs **en attente**, c'est-à-dire précisément ceux qu'on ne propose pas.

| Méthode | Chemin | Auth | Rôles autorisés | Description | Réponse attendue |
|---|---|---|---|---|---|
| GET | /profiles/teachers/validated | 🔒 | responsable_pedagogique, administrateur_financier, technicien_informatique | **Annuaire des formateurs dont la validation est `validated`.** Query : `page` (défaut `1`) et `limit` (défaut `20`, **maximum `100`**). Liste **triée par nom puis prénom sur l'ensemble**, pas page par page. Contenu **limité au socle de visibilité** — rien de plus, bien que les administrateurs soient exemptés du filtrage champ par champ : servir la fiche entière ferait de cette liste une porte dérobée à ce filtrage | `200 {data: [{userId, firstName, lastName, levels, subjects}], page, limit, total, totalPages}` · `400` `page`/`limit` non entier ou < 1, `limit` > 100, **ou paramètre de requête inconnu** · `401` · `403` tout autre rôle, **animateur pédagogique compris** |

Précisions qui font contrat :

- **Le chemin comporte deux segments à dessein.** `GET /profiles/teachers` est capté par
  `GET /profiles/:userId` et répond `400` (« teachers » lu comme un UUID) : c'est le constat du
  2026-08-12. Toute liste ajoutée sous `/profiles` doit comporter au moins deux segments.
- **Le plafond est déclaré et refusé explicitement.** `limit=101` renvoie `400` avec un message en
  français citant le plafond ; la demande n'est **jamais** ramenée à 100 en silence — rogner sans le
  dire ferait croire à l'appelant qu'il a tout reçu.
- **Une page au-delà de la dernière renvoie `200 {data: []}`**, jamais `404` : l'absence de formateur
  à cet endroit de la liste n'est pas une erreur. `total` et `totalPages` valent `0` sur un annuaire vide.
- `levels` / `subjects` à `null` = **non renseigné** (le profil pédagogique est facultatif) ; `[]` = liste
  vide enregistrée. Les deux ne se confondent pas, comme partout ailleurs dans ce service.
- `firstName` / `lastName` à `null` signalent une **incohérence de données** (le profil administratif est
  obligatoire, créé à l'inscription). Le formateur reste **dans la liste** et l'anomalie est journalisée :
  un enregistrement abîmé ne doit pas priver le RP de tout l'annuaire. Ces entrées sont triées en fin de
  liste (`NULLS LAST`).
- `userId` sert **uniquement** à désigner le formateur dans l'appel suivant ; il n'est jamais affiché
  (arbitrage du 2026-08-09).
- **La recherche par niveau, disponibilités et points reste en phase 2.** Cette route livre une liste,
  pas un moteur.
- Aucune modification de `api-gateway` n'a été nécessaire : `/api/v1/profiles` est proxifié **en bloc**
  (`location ^~`), donc `/api/v1/profiles/teachers/validated` est joint sans déclaration nouvelle.

### Relations

| Méthode | Chemin | Auth | Rôles autorisés | Description | Réponse attendue |
|---|---|---|---|---|---|
| POST | /relations/finance-owner-student | 🔒 | responsable_pedagogique, administrateur_financier | Lier un parent financeur à un élève | `201 {id, financeOwnerId, studentId, createdAt, endedAt: null, endedBy: null}` · `400` body incomplet · `401` · `403` · `409` **un lien ACTIF existe déjà** — le conflit porte sur l'état courant, pas sur l'existence d'une ligne : un lien rompu ne bloque jamais un nouveau rattachement |
| DELETE | /relations/finance-owner-student/:financeOwnerId/:studentId | 🔒 | **piloté par la propriété du lien** (`@OwnerAccess()`, aucune liste de rôles) : les **deux parties** (le parent financeur, l'élève), plus RP et TI. L'**AF en est exclu** — il constate les rattachements, il ne décide pas de les rompre | **« Délier »** un parent financeur et un élève (2026-08-11), depuis l'un ou l'autre côté. **Aucune ligne n'est supprimée** malgré le verbe : la rupture renseigne `endedAt`/`endedBy`, la table est un journal — on doit pouvoir prouver que le lien a existé, puis a été rompu, et quand. **Idempotent** : deux appels renvoient `200`, avec la **même** date de rupture (la date initiale n'est jamais réécrite). **Referme d'un coup tous les droits ouverts par la relation** : profil, statistiques, et archives pédagogiques via `GET /internal/relations/...`. Publie `StudentUnlinkedFromFinanceOwner` | `200 {id, financeOwnerId, studentId, createdAt, endedAt, endedBy}` — `endedAt` non nul vaut confirmation · `400` UUID mal formé · `401` · `404` **aucun lien OU appelant sans droit sur ce lien : même code, même message** (`« Aucun lien de financement trouvé entre ces deux personnes »`) — un `403` révélerait à un tiers qui finance qui |
| GET | /relations/finance-owner-student/by-student/:studentId | 🔒 | eleve (soi-même), responsable_pedagogique, administrateur_financier, technicien_informatique | Lister les financeurs **actifs** rattachés à un élève (symétrique). Un lien rompu n'y figure plus | `200 [{id, financeOwnerId, studentId, createdAt, endedAt: null, endedBy: null, financeOwnerName}]` — `financeOwnerName` est `{firstName, lastName}` (valeurs `string \| null`) résolu depuis le profil administratif du financeur, ou `null` si ce profil administratif n'existe pas · `401` · `403` |
| GET | /relations/finance-owner-student/:financeOwnerId | 🔒 | parent_financeur (soi-même), responsable_pedagogique, administrateur_financier, technicien_informatique | Lister les élèves **actifs** rattachés à un financeur. Un lien rompu n'y figure plus | `200 [{id, financeOwnerId, studentId, createdAt, endedAt: null, endedBy: null, studentName}]` — `studentName` est `{firstName, lastName}` (valeurs `string \| null`) résolu depuis le profil administratif de l'élève, ou `null` si ce profil administratif n'existe pas · `401` · `403` |
| POST | /relations/teacher-student | 🔒 | responsable_pedagogique | Lier un formateur à un élève (avec flag professeur principal) | `201 {id, teacherId, studentId, isPrincipalTeacher, createdAt, endedAt: null, endedBy: null, endReason: null}` · `400` · `401` · `403` · `409` **une relation ACTIVE existe déjà** — le conflit porte sur l'état courant, pas sur l'existence d'une ligne : une relation terminée ne bloque jamais une nouvelle affectation |
| DELETE | /relations/teacher-student/:teacherId/:studentId | 🔒 | **responsable_pedagogique UNIQUEMENT** | **Mettre fin à la relation élève ↔ formateur** (2026-08-12), depuis la **fiche de l'élève**. **Différence assumée** avec le déliement parent financeur, où les deux parties peuvent rompre : une affectation pédagogique est prononcée par le RP, elle se défait par le RP. Le formateur, l'élève, le parent financeur, l'AF **et le TI** sont refusés. **Aucune ligne n'est supprimée** malgré le verbe et malgré le libellé « Supprimer » à l'écran : la fin renseigne `endedAt`/`endedBy`/`endReason`, la table est un journal. **Motif optionnel** dans le corps (`{reason?}`, ≤ 1000 caractères) — le déclencheur étant hors logiciel, le RP est le seul à pouvoir le consigner ; le corps entier peut être omis. **Idempotent** : deux appels renvoient `200`, avec la **même** date **et le même motif** (la trace initiale n'est jamais réécrite). **Referme d'un coup tous les droits ouverts par la relation** : profil, statistiques, et archives pédagogiques via `GET /internal/relations/...`. **Aucune fin automatique** : valider un nouveau professeur ne met pas fin au précédent. Publie `TeacherUnlinkedFromStudent` | `200 {id, teacherId, studentId, isPrincipalTeacher, createdAt, endedAt, endedBy, endReason}` — `endedAt` non nul vaut confirmation · `400` UUID mal formé ou motif > 1000 caractères · `401` · `403` tout rôle autre que RP · `404` aucune relation entre ces deux personnes, ni active ni terminée (`« Aucune relation trouvée entre ce professeur et cet élève »`) |
| GET | /relations/teacher-student/:studentId | 🔒 | responsable_pedagogique, technicien_informatique, administrateur_financier, eleve (soi-même), parent_financeur lié à cet élève, formateur (**son propre lien uniquement**, PROF-FB-003) | Lister les formateurs **actifs** d'un élève — une relation terminée n'y figure plus. C'est la liste affichée sur la **fiche de l'élève**, à partir de laquelle le RP met fin à une relation | `200 [{id, teacherId, studentId, isPrincipalTeacher, createdAt, endedAt: null, endedBy: null, endReason: null, teacherName}]` — `teacherName` est `{firstName, lastName}` résolu depuis le profil administratif du formateur, ou `null` s'il n'en a pas ; **aucun écran n'a donc à afficher un UUID** · `401` · `403` |
| POST | /relations/pedagogical-coordinator | 🔒 | responsable_pedagogique | Lier un RP ou AP comme coordinateur pédagogique d'un élève | `201 {coordinatorId, studentId, coordinatorRole, createdAt}` · `400` rôle invalide · `401` · `403` · `409` doublon |
| GET | /relations/pedagogical-coordinator/:coordinatorId | 🔒 | responsable_pedagogique, animateur_pedagogique (soi-même), technicien_informatique | Lister les liens de coordination d'un coordinateur | `200 [{coordinatorId, studentId, coordinatorRole}]` · `401` · `403` |
| POST | /relations/animator-teacher | 🔒 | responsable_pedagogique | **Rattacher un AP à un formateur qu'il anime** (2026-08-11). Aucune table ne portait cette relation : `pedagogical-coordinator` lie un coordinateur à un **élève**, pas à un formateur. C'est elle, et elle seule, qui ouvre à l'AP la lecture des statistiques (et bientôt des archives) du formateur. Réservé au RP : c'est lui qui promeut un formateur en AP, c'est donc lui qui décide de ce qu'un AP anime | `201 {id, animatorId, teacherId, createdAt}` · `400` champ absent ou non-UUID · `401` · `403` tout rôle autre que RP, AP compris · `409` doublon |
| GET | /relations/animator-teacher/:animatorId | 🔒 | responsable_pedagogique, technicien_informatique, animateur_pedagogique (soi-même) | Lister les formateurs animés par un AP | `200 [{id, animatorId, teacherId, createdAt, teacherName}]` — `teacherName` est `{firstName, lastName}`, ou `null` si le formateur n'a pas de profil administratif · `401` · `403` |
| GET | /relations/my-contacts | 🔒 | **tout compte authentifié** (`@OwnerAccess()`, aucune liste de rôles) | **Les personnes auxquelles l'utilisateur AUTHENTIFIÉ est relié**, avec leur **prénom, nom** et la **nature du lien**. Aucun paramètre d'identifiant : il n'y a rien à falsifier, on ne renvoie jamais les relations d'un tiers. Destinée aux écrans qui doivent faire choisir « qui consulter ? » (`/archives`, « mes élèves ») **sans afficher un seul UUID** — `userId` n'y est que pour construire l'appel suivant. Inclut les liens **indirects** (parent ↔ formateur de son élève), qu'aucune table ne porte | `200 [{userId, firstName, lastName, relations: [{kind, isPrincipalTeacher?, throughUserIds?}]}]`, trié par nom, `firstName`/`lastName` à `null` sans profil administratif ; un compte sans lien reçoit `200 []` · `401` |

#### Droit d'accès aux statistiques — piloté par la relation (2026-08-11)

> Arbitrage du 2026-08-11 (`docs/architecture.md` > « Arbitrages rendus »). Il prolonge la règle du
> 2026-08-07 sur la lecture d'un profil : **le droit vient de la relation métier**, pas d'une liste de
> rôles — une liste oublie un rôle à chaque évolution, défaut corrigé le même jour dans
> `finance-credit-service`, où `formateur` et `animateur_pedagogique` manquaient.

| Lecteur | Voit les statistiques de | Filtrage champ par champ |
|---|---|---|
| Le **titulaire** | lui-même | aucun |
| **RP, AF, TI** (administrateurs) | tout le monde, sans distinction pour l'instant | aucun |
| **Parent financeur** | ses élèves | aucun (il voit tout de ses élèves) |
| **Parent financeur** | les **formateurs de ses élèves** (lien indirect) | **oui** — le lien indirect ouvre la lecture, il ne lève pas le masquage |
| **Élève** | ses formateurs | oui |
| **Formateur** | ses élèves | oui |
| **AP** | les formateurs qu'il anime | aucun (sinon il serait aveugle au dossier qu'il anime) |
| **Coordinateur** (RP/AP) | les élèves qu'il coordonne | selon son rôle |

Toute autre paire est **refusée en `404`**, avec le **même message** qu'une absence de statistiques
(`No pedagogical statistics found for user <id>`) : un `403` révélerait l'existence de ce qu'on refuse
de montrer — même règle que les médias masqués (2026-08-10). Le contrôle a lieu **avant** toute
lecture en base.

**L'AP n'est pas un administrateur** : sans lien `animator-teacher`, il ne voit les statistiques de
personne. La table étant vide à sa création, les liens doivent être créés par le RP.

**Valeurs de `kind`** (orientées lecteur → cible) : `finance_owner_of_student`,
`student_of_finance_owner`, `teacher_of_student`, `student_of_teacher`, `animator_of_teacher`,
`teacher_of_animator`, `coordinator_of_student`, `student_of_coordinator`,
`finance_owner_of_student_of_teacher`, `teacher_of_student_of_finance_owner`.

**Un lien rompu n'ouvre plus rien.** Depuis le 2026-08-11, un lien parent financeur ↔ élève peut être
rompu (`DELETE /relations/finance-owner-student/:financeOwnerId/:studentId`) ; depuis le 2026-08-12,
une relation élève ↔ formateur peut prendre fin
(`DELETE /relations/teacher-student/:teacherId/:studentId`, **RP uniquement**). Toutes les résolutions
de relation — celle-ci, `GET /relations/my-contacts`, `GET /internal/relations/:viewerId/:targetId` —
ne lisent que les liens **actifs** (`endedAt IS NULL`). La fin referme donc d'un seul geste le profil,
les statistiques et les archives pédagogiques, sans qu'aucun service consommateur ait à être prévenu.
Vérifié contre la pile réelle pour le lien parent : après rupture, le parent reçoit `403` sur
`GET /profiles/:studentId`, `404` sur `/statistics` et `404` sur
`/api/v1/archives/students/:studentId/pedagogical-archives`, et `200 []` sur `my-contacts`.
Vérifié contre la pile réelle pour la relation formateur (2026-08-12) : le formateur passe de `200` à
**`403`** sur `GET /profiles/:studentId`, de `200` à **`404`** sur `/statistics`, et
`GET /internal/relations/:teacherId/:studentId?viewerRole=formateur` passe de
`[{kind: "teacher_of_student"}]` à **`[]`** — c'est cette dernière que consomme
`archive-document-service`. Les trois redeviennent ouverts si le RP recrée la relation.

### API interne inter-services (non exposée via nginx)

> Exclue de Swagger (`@ApiExcludeController`). Protégée par `X-Internal-Secret: <INTERNAL_SECRET>`.
> Utilisée par orchestration-service dans les workflows d'onboarding, et depuis le 2026-08-12 par
> `teacher-request-service` pour le flow « demande de professeur ».
>
> **Aucune de ces routes n'est exposée par api-gateway** — c'est leur protection, avec le secret
> partagé, et elle doit le rester : `GET /internal/profiles/:userId/display-name` sert une identité
> **sans contrôle de lecteur**. L'exclusion de Swagger est délibérée pour la même raison ; les
> `@ApiOperation`/`@ApiResponse` du contrôleur documentent le contrat dans le code, **la référence
> lisible est ce tableau**.
>
> **Porte fermée le 2026-08-12.** `InternalGuard` journalisait auparavant un avertissement puis
> **laissait passer** quand `INTERNAL_SECRET` n'était pas configuré : ces routes étaient alors
> servies sans aucune authentification. Le passage en clair est supprimé, et
> **`profile-service` refuse désormais de démarrer** si `INTERNAL_SECRET` est absent ou vide
> (`src/config/env.validation.ts`, même forme que `teacher-request-service`). Une garde qui
> s'ouvre quand sa configuration manque échoue dans le mauvais sens : un service mal configuré
> doit refuser de servir, pas servir sans contrôle.

| Méthode | Chemin | Description | Header requis | Réponse attendue |
|---|---|---|---|---|
| POST | /internal/create-administrative-profile | Créer (ou mettre à jour) le profil administratif d'un compte quelconque (élève, formateur, parent, générique) juste après sa création par identity-access-service. Body : `{userId, firstName, lastName, phone?, birthDate?}`. `firstName`/`lastName` obligatoires (`400` sinon), `phone` optionnel mais validé (`@IsNotEmpty @MaxLength(20)` si fourni), **`birthDate` optionnel au format ISO `YYYY-MM-DD`** (`@IsDateString`, `400` si mal formée) — accepté à la création depuis le 2026-08-09 pour qu'identity-access-service puisse le relayer dès l'inscription : la colonne existait déjà et le champ était modifiable, mais la création l'ignorait, ce qui avait fait retirer `birthDate` du formulaire d'inscription. **Seul point d'écriture** pour firstName/lastName/phone : identity-access-service ne persiste plus ces champs lui-même et appelle cette route de façon obligatoire (non best-effort) à chaque création de compte (le DTO d'entrée d'identity-access-service utilise `phoneNumber`, mappé vers `phone` au moment de l'appel). **Seul point de création** d'un profil administratif : `GET /profiles/:userId` ne crée plus rien à la volée depuis l'arbitrage du 2026-08-07. Upsert idempotent par `userId` : si une ligne existe déjà (rappel de la route, ou ligne héritée de l'ancien lazy-init), elle est mise à jour avec les valeurs reçues (y compris `phone`) au lieu d'échouer sur la contrainte d'unicité — voir décision C6/C7/C8 dans `docs/services/profile-service.md`. Erreurs de validation → `400` explicite (distinct d'un `5xx`). **`role` accepté depuis le 2026-08-12** (facultatif, valeurs de `UserRole`) : le rôle doit accompagner systématiquement les appels interservices (arbitrage du 2026-08-07), et `role: "formateur"` déclenche la création de l'enregistrement de validation — c'est cette route qu'emprunte réellement `POST /accounts/teachers`. **Non persisté, non exposé** : `identity-access-service` reste l'unique propriétaire du rôle, `profile-service` ne s'en sert que comme contexte de décision. Facultatif à dessein — l'exiger ferait échouer toute création de compte en `400` tant que l'appelant ne l'envoie pas ; son absence est en revanche journalisée en `warn` | `X-Internal-Secret` | `201 {userId, administrative}` · `400` validation · `401`/`403` secret absent ou invalide |
| POST | /internal/create-student-profiles | Créer les profils initiaux d'un élève (`firstName`/`lastName` obligatoires, `400` sinon) | `X-Internal-Secret` | `201 {userId, administrative, pedagogical}` · `400` · `401`/`403` |
| POST | /internal/create-teacher-profiles | Créer les profils initiaux d'un formateur (`firstName`/`lastName` obligatoires, `400` sinon). **Crée aussi l'enregistrement de validation au statut `pending`** depuis le 2026-08-12, inconditionnellement — la route dit elle-même que le compte est un formateur, aucun rôle n'a à être transmis. Idempotent et **non destructeur** : rejouer l'appel ne repasse jamais un formateur `validated`/`rejected` à `pending` | `X-Internal-Secret` | `201 {userId, administrative, pedagogical, validation}` · `400` · `401`/`403` |
| POST | /internal/teachers/ensure-validations | **Reprise de stock** des formateurs sans enregistrement de validation (arbitrage du 2026-08-12, point 3). Body : `{teacherIds: string[]}` (UUID, **200 au maximum**, plafond déclaré). **Idempotente et non destructrice** : un formateur déjà `validated` ou `rejected` est laissé strictement intact — statut *et* commentaire — et compté dans `alreadyPresent`. Doublons réduits à une entrée. `200` et non `201` : dans le cas nominal du rejeu, rien n'est créé. Appelée par `scripts/maintenance/backfill-teacher-validations.ts`. **Jamais exposée par api-gateway** | `X-Internal-Secret` | `200 {created: string[], alreadyPresent: string[]}` · `400` liste vide, au-delà du plafond, ou UUID invalide · `401` secret absent ou invalide |
| POST | /internal/link-parent | Lier un parent financeur à un élève (idempotent par paire `studentId`/`financeOwnerId`) — utilisée par identity-access-service pour la liaison automatique élève+parent créés/liés dans le même appel de création de compte | `X-Internal-Secret` | `201 {linked: true, contacts: [financeOwnerId]}` · `401`/`403` |
| POST | /internal/create-teacher-student-relation | **Créer le lien élève↔formateur**, dont `profile-service` est l'unique propriétaire (arbitrage du 2026-08-12, point 5) — appelée par `teacher-request-service` quand le RP valide l'acceptation d'un formateur. Body : `{teacherId, studentId, isPrincipalTeacher?}` (UUID, `isPrincipalTeacher` optionnel, `false` par défaut). **Idempotente depuis le 2026-08-12** : rejouer la validation d'un RP ne crée pas de second lien et n'échoue pas. Le code HTTP distingue les deux cas, le corps est identique. Ce lien ouvre des droits de lecture réels (statistiques, archives pédagogiques) et publie `TeacherLinkedToStudent`, comme le chemin humain `POST /relations/teacher-student` | `X-Internal-Secret` | `201 {teacherId, studentId, isPrincipalTeacher}` création · `200` même corps, le lien identique existait déjà (rejeu) · `409` un lien existe avec un **statut de professeur principal différent** — ce n'est pas un rejeu et l'appelant doit le remonter · `400` UUID manquant ou invalide · `401` secret absent ou invalide |
| POST | /internal/link-coordinator | Lier un coordinateur pédagogique à un élève | `X-Internal-Secret` | `201 {coordinatorId, studentId, coordinatorRole}` · `400` rôle invalide · `409` doublon · `401`/`403` |
| GET | /internal/profiles/:userId/display-name | **Résoudre le prénom et le nom d'une personne** pour un service appelant (arbitrage du 2026-08-12, « Resolution des noms entre services »). Servie **sans lecteur** et **sans filtrage champ par champ** : un formateur qui reçoit une proposition n'est encore lié à aucun élève, la route publique lui répondrait `403` et l'écran retomberait sur un UUID. **Contrat figé : `firstName` et `lastName`, jamais un champ de plus** — l'étendre en ferait une porte dérobée contournant le filtrage de visibilité pour tout service détenant `INTERNAL_SECRET`. Tout autre besoin passe par `GET /profiles/:userId` et ses règles de droit. `x-correlation-id` accepté et propagé. **Jamais exposée par api-gateway** | `X-Internal-Secret` | `200 {userId, firstName, lastName}` — valeurs `string\|null` · `400` `userId` non-UUID · `401` secret absent ou invalide · `404` `userId` inconnu de identity-access-service · `500` compte connu **sans** profil administratif (incohérence de données, jamais masquée) |
| POST | /internal/profiles/display-names | **Variante par lot** de la route ci-dessus, pour qu'une liste de N lignes ne coûte pas N appels HTTP (une seule requête SQL). `POST` alors que l'opération est une **lecture** : le corps porte la liste, qu'une query string ne peut pas transporter sans limite de longueur — d'où le `200`, aucune ressource n'est créée. Body : `{userIds: string[]}`, UUID, **200 identifiants au maximum** (plafond déclaré, pas de défaut caché). Ordre d'entrée conservé, doublons réduits à une entrée. Un `userId` sans profil administratif est **absent** de la réponse plutôt que de faire échouer le lot (l'anomalie reste tracée côté serveur) : un identifiant douteux ne prive pas l'appelant des autres noms. Même contrat figé que la route unitaire. **Jamais exposée par api-gateway** | `X-Internal-Secret` | `200 {displayNames: [{userId, firstName, lastName}]}` · `400` liste vide, au-delà du plafond, ou identifiant non-UUID · `401` secret absent ou invalide |
| GET | /internal/relations/finance-owners/:studentId | **Résoudre les parents financeurs d'un élève** pour un appelant interservices — arbitrage du 2026-08-14 (`docs/architecture.md` > « Systeme de notifications transversal », point 5). Premier consommateur : `dashboard-notification-service`, pour notifier les parents financeurs quand un professeur est validé pour leur élève. Réutilise directement `RelationsService.getFinanceOwnersByStudent` (liens **actifs** uniquement — un parent délié n'apparaît plus). **Périmètre volontairement étroit : `userId` uniquement**, jamais de nom ni de statut de lien — la résolution de nom passe séparément par `GET /internal/profiles/:userId/display-name` / `POST /internal/profiles/display-names`. **Déclarée avant** `GET /internal/relations/:viewerId/:targetId` ci-dessous dans le contrôleur : même nombre de segments, `finance-owners` serait sinon capturé comme `:viewerId`. **Jamais exposée par api-gateway** | `X-Internal-Secret` | `200 {studentId, financeOwnerUserIds: string[]}` — liste vide si aucun parent financeur actif · `400` `studentId` non-UUID · `401` secret absent ou invalide |
| GET | /internal/relations/:viewerId/:targetId | **Lire la nature et le sens des relations entre deux personnes**, pour qu'un service appelant applique la même règle sans tenir de copie des relations — `profile-service` en reste l'unique propriétaire (arbitrage du 2026-08-11). Premier consommateur : `archive-document-service`. Query **obligatoire** `viewerRole` (`400` si absent ou hors énumération, avec la liste des valeurs acceptées) : le rôle accompagne systématiquement les appels interservices, `profile-service` ne le persiste ni ne l'expose. La réponse est **suffisante pour décider** : elle donne le **sens** du lien, pas un booléen — un élève voit les statistiques de son formateur mais **pas** ses archives pédagogiques, distinction impossible à faire sans lui. Ce service **ne rend pas le verdict** à la place de l'appelant : il fournit les faits, chaque service propriétaire décide de sa surface | `X-Internal-Secret` | `200 {viewerId, targetId, isSelf, isAdministrator, relations: [{kind, isPrincipalTeacher?, throughUserIds?}]}` — `relations: []` = aucun lien (et toujours `[]` quand `isSelf`) ; `isAdministrator` vaut `true` pour RP, AF, TI, **jamais pour l'AP** ; valeurs de `kind` : voir « Droit d'accès aux statistiques » ci-dessus · `400` UUID ou `viewerRole` invalide · `401` secret absent ou invalide |

**Noms des blocs de profil — `administrative` / `pedagogical`, ici comme partout ailleurs.**

> Arbitrage du 2026-08-08 (`docs/architecture.md` > « Arbitrages rendus ») : une même donnée porte un
> seul nom dans tout le système ; aucune route, publique ou interne, n'expose sa propre variante.
> Ces routes renvoyaient jusqu'ici `administrativeProfile`/`pedagogicalProfile` là où
> `GET /profiles/:userId` renvoie `administrative`/`pedagogical`. **La paire longue a été supprimée**,
> sans champ d'alias de compatibilité : un alias recréerait exactement la divergence que l'arbitrage
> résorbe. C'est cette paire longue qui re-contaminait le front à chaque itération.
>
> Consommateurs : identity-access-service ignore le corps de réponse de ces routes (il ne lit que le
> code HTTP) et n'est donc pas impacté ; le script `scripts/maintenance/backfill-profiles.ts` non plus.
> Le workflow `teacher-onboarding` d'orchestration-service lit `profileId` dans la sortie de l'étape
> `create-teacher-profiles` — ce champ **n'a jamais existé** dans la réponse ci-dessus (avant comme
> après le renommage) : anomalie préexistante à traiter côté orchestration-service, sans lien avec
> cet arbitrage.

Les **noms de champs** à l'intérieur de ces blocs (`firstName`, `lastName`, `phone`, `birthDate`,
`level`, `subjects`, `levels`, `bio`) étaient déjà en anglais et sont inchangés depuis l'alignement du
2026-08-07, qui n'a porté que sur les routes publiques `PUT /profiles/:userId/administrative` et
`PUT /profiles/:userId/pedagogical` (voir « Noms de champs des profils » plus haut).

`ValidationPipe` global : `whitelist` + `forbidNonWhitelisted: true` + `transform` (tout champ
inconnu dans un body → `400` explicite au lieu d'être silencieusement ignoré).

### Demandes de rattachement parent↔élève

Flux en deux temps : le parent fournit le `studentId` qu'il connaît hors-plateforme. L'élève ou un RP/TI valide. Aucune liste d'élèves n'est exposée au parent.

Statuts : `pending` → `approved` (lien finance-owner-student créé) / `rejected`

**Ce parcours reste utilisable après une rupture** (2026-08-11) : délier deux personnes ne les empêche
jamais de se rattacher de nouveau. L'approbation crée une **nouvelle** ligne de lien, la ligne rompue
restant en base comme preuve de la période passée. Vérifié contre la pile réelle : rupture, puis
`POST /parent-link-requests` → `201`, approbation par l'élève → `201`, et les droits sont rouverts.

| Méthode | Chemin | Auth | Rôles autorisés | Description | Réponse attendue |
|---|---|---|---|---|---|
| POST | /parent-link-requests | 🔒 | `parent_financeur` | Soumet une demande de rattachement (direction: parent_initiated) | Body : `{ studentLoginIdentifier }` · `201 { id, parentId, studentId, status: "pending", direction: "parent_initiated", requestedAt }` · `400` identifiant non trouvé ou compte non élève · `404` identifiant élève introuvable · `409` demande pending déjà en cours |
| POST | /parent-link-requests/student-initiated | 🔒 | `eleve` | L'élève invite son parent (direction: student_initiated) | Body : `{ parentLoginIdentifier }` · `201 { id, parentId, studentId, status: "pending", direction: "student_initiated", requestedAt }` · `400` identifiant non trouvé ou compte non parent_financeur · `404` identifiant parent introuvable · `409` demande pending déjà en cours |
| GET | /parent-link-requests | 🔒 | `parent_financeur` (ses demandes, les deux directions), `eleve` (demandes le ciblant + ses invitations), `responsable_pedagogique`, `technicien_informatique` (toutes) | Liste filtrée selon le rôle | `200 [{ id, parentId, studentId, status, direction, requestedAt, processedAt, processedBy }]` |
| POST | /parent-link-requests/:id/approve | 🔒 | `eleve` (si parent_initiated, uniquement si ciblé), `parent_financeur` (si student_initiated, uniquement si ciblé), `responsable_pedagogique`, `technicien_informatique` | Approuve → crée le lien finance-owner-student | `200 { id, status: "approved", processedAt, processedBy }` · `403` · `404` |
| POST | /parent-link-requests/:id/reject | 🔒 | `eleve` (si parent_initiated, uniquement si ciblé), `parent_financeur` (si student_initiated, uniquement si ciblé), `responsable_pedagogique`, `technicien_informatique` | Rejette la demande | `200 { id, status: "rejected", processedAt, processedBy }` · `403` · `404` |

### Événements publiés

`ProfileUpdated` · `StudentLinkedToFinanceOwner` · `StudentUnlinkedFromFinanceOwner` · `TeacherLinkedToStudent` · `TeacherUnlinkedFromStudent` · `CoordinatorLinkedToStudent` · `AnimatorLinkedToTeacher` · `TeacherPromotedToPedagogicalAnimator` · `ParentLinkRequested` · `ParentLinkApproved` · `ParentLinkRejected`

> `StudentUnlinkedFromFinanceOwner` (2026-08-11) est le **pendant** de `StudentLinkedToFinanceOwner` :
> publier la liaison sans publier la rupture laisserait tout abonné sur une vue périmée. Aucun service
> ne consomme aujourd'hui l'un ni l'autre — le publieur est un journal structuré, pas encore un bus.
> Charge utile : `{financeOwnerId, studentId, actorId, endedAt}`.

> `TeacherUnlinkedFromStudent` (2026-08-12) est le **pendant** de `TeacherLinkedToStudent`, pour la
> même raison — et ici la vue périmée porterait des **droits** (statistiques, archives pédagogiques),
> pas seulement un affichage. Publié uniquement sur une fin réelle : un rejeu idempotent n'émet
> **rien**, sans quoi un abonné compterait deux fins pour une seule décision.
> Charge utile : `{teacherId, studentId, actorId, endedAt, reason}` — `reason` vaut `null` quand le RP
> n'en a pas consigné.

---

## teacher-request-service

Préfixe gateway canonique : `/api/v1/teacher-requests` → contrôleur `/requests`.
Également proxifiés : `/api/v1/requests` (historique), `/api/v1/proposals`, `/api/v1/assignments`.

> **Le flow a été refondu le 2026-08-12** (`docs/architecture.md` > « Flow de la demande de
> professeur »). Trois modèles de décision coexistaient ; un seul subsiste : **c'est le RP qui
> tranche, et lui seul**. L'acceptation d'un formateur enregistre une **candidature**, jamais une
> affectation. Les routes `POST /requests/:id/select` (réservée à l'élève et au parent) et
> `POST /requests/:id/selected-candidates` **ont été supprimées** : elles relevaient de modèles
> abandonnés et étaient de toute façon inatteignables dès qu'un formateur avait répondu.

Toutes les routes acceptent et **renvoient** `x-correlation-id` (généré si absent).
Les commandes (`POST`) acceptent `Idempotency-Key` : rejouer la même clé renvoie la première
réponse au lieu d'exécuter la commande une seconde fois.
`ValidationPipe` global : `whitelist` + **`forbidNonWhitelisted`** + `transform` — un champ inconnu
provoque un `400` explicite, en français, au lieu d'être absorbé en silence.
**Tous les messages d'erreur sont en français.**

### Le flow, étape par étape

| Méthode | Chemin | Étape | Rôles autorisés | Description | Réponse attendue |
|---|---|---|---|---|---|
| POST | /requests | 1 | eleve, parent_financeur, responsable_pedagogique | Créer une demande. Body : **`{description}`** (texte long, **requis**, ≤ 5000 car.) et `studentId?` (obligatoire si l'appelant n'est pas l'élève). `subject`, `level`, `sector` **ne sont plus acceptés** (`400`). Le lien parent↔élève est vérifié **à chaque appel** auprès de `profile-service` | `201 {id, requesterId, requesterRole, studentId, studentName, description, status: "pending", type, chosenTeacherId, chosenTeacherName, closedAt, createdAt, updatedAt}` · `400` corps invalide ou champ inconnu · `401` · `403` rôle sans droit · **`404` élève inconnu OU aucun lien avec l'appelant — les deux cas sont indiscernables** · `503` profile-service injoignable |
| GET | /requests | 2, 4 | eleve, parent_financeur, responsable_pedagogique, formateur | Query `scope` = `open` (**défaut**) / `closed` / `all`. **La forme dépend du rôle, jamais du contenu** : élève/parent/RP → demandes ; formateur → **boîte de réception** de ses propositions. Le parent ne voit que les demandes des élèves auxquels il est **encore** lié. Le RP reçoit en plus `acceptedProposalCount` et `pendingProposalCount` | `200 [TeacherRequest]` ou `200 [TeacherProposalInbox]` · `401` · `403` |
| GET | /requests/:id | 2, 4 | élève concerné, parent lié et auteur, administrateurs, **formateur destinataire d'une proposition** | Détail. Le formateur y avait droit à un `403` avant le 2026-08-12 | `200 {…, studentName}` · `400` UUID mal formé · `401` · `404` inexistante **ou** hors de portée |
| POST | /requests/:requestId/proposals | 3 | responsable_pedagogique | **Envoi groupé et atomique.** Body : `{teacherIds: string[] (1..50, uniques), message (requis, ≤ 5000), availabilityNote?, compensationNote?, responseDeadline?}` — les trois derniers sont les champs indicatifs *créneaux possibles*, *rémunération*, *date limite de réponse*. **Chaque `teacherId` doit être `validated` auprès de `profile-service` (`GET /profiles/:teacherId/validation`, arbitrage du 2026-08-13) — vérifié à chaque appel, jamais en cache.** Bascule la demande en `redirected` | `201 [{id, requestId, teacherId, teacherName, message, availabilityNote, compensationNote, responseDeadline, status: "pending", respondedAt, createdAt, updatedAt}]` · `400` demande clôturée, formateur déjà sollicité, **ou un/plusieurs formateurs du lot ne sont pas validés — refus explicite citant leur nom, l'envoi entier est rejeté (jamais un envoi partiel)** · `401` · `403` · `404` · `503` `profile-service` injoignable pour vérifier un statut de validation |
| GET | /requests/:requestId/proposals | 5 | responsable_pedagogique | **Lire qui a accepté, refusé ou n'a pas répondu.** Cette lecture n'existait pas : `404` avant le 2026-08-12, ce qui rendait l'arbitrage du RP impossible | `200 [TeacherProposal]` · `401` · `403` · `404` |
| POST | /proposals/:proposalId/accept | 4 | formateur destinataire | **Enregistre une candidature, et rien d'autre** : aucune affectation n'est créée ici | `201 {id, requestId, requestDescription, studentName, message, …, status: "accepted", requestStatus}` · `400` réponse déjà donnée, ou demande clôturée · `401` · `403` · `404` inexistante **ou adressée à un autre formateur** |
| POST | /proposals/:proposalId/decline | 4 | formateur destinataire | Refus du formateur | idem, `status: "declined"` |
| POST | /requests/:id/validate | 5, 6 | responsable_pedagogique | **Point de décision unique.** Body : `{proposalId, isPrincipalTeacher?}`. Crée le lien élève↔formateur **dans `profile-service`**, clôture la demande, passe les autres candidats en `not_selected` et les propositions sans réponse en `expired`. Le lien est demandé **avant** la clôture : si `profile-service` refuse, rien n'est clôturé | `201 {…, status: "closed", chosenTeacherId, chosenTeacherName, closedAt}` · `400` demande déjà clôturée, proposition étrangère à la demande, ou formateur n'ayant pas accepté · `401` · `403` · `404` · `409` un lien élève↔formateur **contradictoire** existe déjà (statut de professeur principal différent) — remonté tel quel depuis `profile-service`, jamais transformé en succès · `503` |
| PATCH | /requests/:id/status | — | responsable_pedagogique | Body `{status}` ∈ `declined` / `cancelled` / `closed`. **`closed` n'est accepté que sur une demande héritée restée en `assigned`** : une demande se clôture normalement en retenant un formateur. Solde les propositions ouvertes | `200 {…}` · `400` transition refusée · `401` · `403` · `404` |
| DELETE | /requests/:id | — | responsable_pedagogique | Supprimer une demande | `204` · `401` · `403` · `404` |
| POST | /requests/pp-change | hors flow | parent_financeur | Changement de professeur principal. Body : **`{studentId, currentPpTeacherId?, description}`** — aligné sur `POST /requests` (`subject` supprimé, `message` renommé `description`). Le lien parent↔élève est **désormais vérifié** | `201 {…, type: "pp_change"}` · `400` · `401` · `403` · `404` |

### États

**Demande** — `pending` → `redirected` → **`closed`** (état terminal créé le 2026-08-12, sans lequel
« les demandes traitées disparaissent » était inexprimable). Terminaux : `closed`, `cancelled`,
`declined`. Valeurs héritées, jamais écrites par le flow mais encore portées par des lignes :
`assigned` (qui garde une transition sortante vers `closed`), `accepted`, `candidates_published`,
`candidates_selected`, `candidate_chosen`.

**Proposition** — `pending` → `accepted` / `declined`, puis, à la clôture de la demande :
`not_selected` (**avait accepté, un autre a été choisi**) ou `expired` (**n'a jamais répondu**).
Ces deux états sont créés par l'arbitrage : les confondre avec `declined` serait un mensonge
affiché au formateur, `declined` signifiant « le formateur a refusé ».

### Ce que le service demande à profile-service

`profile-service` est l'**unique propriétaire des relations** ; ce service n'en tient aucune copie
et l'interroge **à chaque action**, jamais en cache — un lien peut être rompu entre deux appels.

| Appel | Usage | Politique d'échec |
|---|---|---|
| `GET /internal/relations/:viewerId/:targetId?viewerRole=` | Droit d'agir d'un parent, droit de lecture | **Refuse** l'action (`503`) — laisser passer donnerait l'illusion du contrôle |
| `POST /internal/create-teacher-student-relation` | Créer le lien à la validation du RP. **Idempotente depuis le 2026-08-12** : `201` création, `200` rejeu — l'appelant ne traite plus un `409` comme un succès (branche retirée le 2026-08-12), et le `409` restant (professeur principal différent) est **remonté au RP en `409`**, avec un message français | **Fait échouer** la validation ; la demande reste ouverte |
| `GET /internal/profiles/:userId/display-name` | Afficher des noms plutôt que des UUID, y compris pour un formateur qu'aucune relation ne lie encore à l'élève. **Livrée le 2026-08-12** | Retombe sur `GET /profiles/:userId` avec le jeton de l'appelant ; à défaut `null` |
| `POST /internal/profiles/display-names` | Même chose **par lot**, pour qu'une liste RP ne coûte pas un appel HTTP par ligne. **Livrée le 2026-08-12** | Identifiants non résolus absents de la réponse ; l'appelant retombe sur son propre repli |
| `GET /profiles/:teacherId/validation` | **Route publique** (pas d'équivalent interne) : vérifier qu'un formateur est `validated` avant `POST /requests/:requestId/proposals` (arbitrage du 2026-08-13, « Reprise de candidature après un refus formateur », point 6). Appelée avec le **jeton du RP appelant relayé** (`Authorization`), cette route l'acceptant déjà par son rôle — le secret interne ne s'y substitue pas. **Livrée le 2026-08-13** | **Refuse** l'action (`503`) — même politique que la vérification de relation : un échec silencieux laisserait passer un formateur non validé |

### Événements

`TeacherRequestCreated` · `TeacherRequestStatusUpdated` · `TeacherRequestDeleted` ·
`TeacherRequestClosed` · `TeacherProposalSent` · `TeacherProposalAccepted` ·
`TeacherProposalDeclined` · `TeacherProposalNotSelected` · `TeacherProposalExpired` ·
`TeacherAssigned` · `MainTeacherAssigned`

> Ils ne sont plus des `logger.log`. Chaque événement est écrit dans la table **`domain_events`**
> (boîte d'envoi), **dans la même transaction** que le changement d'état qui le produit, puis remis
> au flux Redis **`visiomath:events`** (`XADD`). Un flux, et non un `PUBLISH` : un abonné absent au
> moment de l'émission pourra relire. Sans `REDIS_URL`, les événements restent en attente et ne sont
> **jamais perdus**. Champs du flux : `eventId`, `eventName`, `aggregateType`, `aggregateId`,
> `correlationId`, `occurredAt`, `payload` (JSON).

### Héritage — route conservée, non alimentée par le flow

La table `assignments` n'est **plus écrite** : le lien élève↔formateur appartient à
`profile-service`. Cette route ne sert donc que les affectations créées par l'ancien modèle.

| Méthode | Chemin | Rôles | Remarque |
|---|---|---|---|
| POST | /assignments/:assignmentId/main-teacher | responsable_pedagogique, eleve | Sur le flow courant, le professeur principal se déclare via `isPrincipalTeacher` de `POST /requests/:id/validate` |

> **Retiré le 2026-08-13** (arbitrage du 2026-08-12, « Fin d'une relation élève-formateur »,
> point 7) : `POST /assignments/:assignmentId/termination` et son alias
> `POST /collaborations/:assignmentId/stop-request` (formateur, body `{noticeDate, reason?}`)
> portaient le modèle abandonné où le formateur décidait de l'arrêt. Seul le RP met désormais fin
> à une relation élève↔formateur, via `DELETE /relations/teacher-student/:teacherId/:studentId`
> sur `profile-service`. Le contrôleur `/collaborations` et l'entité `termination_requests` ont été
> supprimés du service ; `/api/v1/assignments` reste proxifié par la gateway (prefixe générique,
> aucun changement nécessaire côté `api-gateway`).

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
| GET | /notifications/unread-count | Compter mes notifications non lues (badge de la cloche front) — chargé une fois au montage, mis à jour localement après chaque lecture, pas de polling (arbitrage du 2026-08-14, point 10) | 🔒 |
| POST | /notifications/:id/read | Marquer une notification comme lue | 🔒 |
| DELETE | /notifications/:id | Supprimer une notification | 🔒 |

Réponse `GET /notifications/unread-count` : `200 {count: number}`.

`title`/`message` de `NotificationResponseDto` sont désormais **nullables** (2026-08-14) : les
notifications produites par le consommateur du flux Redis (voir ci-dessous) laissent ces deux
champs à `null` et portent leur contenu structuré dans `metadata` uniquement — un seul point de
traduction technique→français, côté front (règle du 2026-08-09). Les notifications créées via
`POST /internal/notify` (orchestrateur) continuent de porter `title`/`message`, inchangé.

### Tableaux de bord

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| GET | /dashboards/me | Mon tableau de bord | 🔒 |
| PUT | /dashboards/me/preferences | Mettre à jour les préférences | 🔒 |

API interne (non exposée via nginx) : `POST /internal/initialize-dashboard`, `POST /internal/notify` — protégées par `X-Internal-Secret`.

**`POST /internal/notify`, correctif du 2026-08-17 (vrai fan-out par rôle).** `{targetUserId?, targetRole?, type, title, message, metadata?}`,
exactement l'un des deux `target*` requis (`400` sinon). Réponse **toujours un tableau**
`201 NotificationResponseDto[]` — un élément pour `targetUserId`, un élément par compte réel
détenant le rôle pour `targetRole` (potentiellement `[]` si aucun compte ne détient ce rôle,
jamais une erreur). Avant ce correctif, `targetRole` créait une **unique** ligne avec
`userId = "role:<role>"`, un identifiant fictif ne correspondant à aucun compte — invisible pour
tout utilisateur réel puisque `GET /notifications` filtre toujours par l'`userId` réel de
l'appelant. `dashboard-notification-service` résout désormais la liste des `userId` réels auprès
de `identity-access-service` (`GET /internal/accounts?role=...`, route déjà existante et
inchangée) — `identity-access-service` reste l'unique propriétaire du rôle
(`docs/architecture.md` > « Propriété du rôle »). Le même correctif s'applique au fan-out interne
du consommateur d'événements Redis (`EventProcessorService`, événements `TeacherRequestCreated`,
`TeacherProposalAccepted`, `TeacherProposalDeclined` → rôle RP) — voir
`docs/services/dashboard-notification-service.md`, section « Correctif — vrai fan-out des
notifications par rôle ».

### Consommateur d'événements — flux Redis `visiomath:events`

> Ajouté le 2026-08-14 (`docs/architecture.md` > « Systeme de notifications transversal »).
> Ce n'est pas une route HTTP : `dashboard-notification-service` s'abonne au flux Redis déjà
> produit par `teacher-request-service` (`XADD`, boîte d'envoi `domain_events`), via un groupe de
> consommateurs nommé `dashboard-notification-service` (`XGROUP`/`XREADGROUP`/`XACK`). Démarré
> depuis le **début** du flux (`0`, pas `$`) pour ne perdre aucun événement publié avant que ce
> consommateur n'existe — sûr grâce à la déduplication par `eventId` (table `processed_events`).
> Une passe périodique (`@nestjs/schedule`, toutes les 30s, `XAUTOCLAIM`) réclame les entrées
> restées non acquittées plus de 60s (crash, ou échec transitoire d'un appel à profile-service) et
> les rejoue.
>
> Types traités, et destinataire(s) : `TeacherRequestCreated` → rôle RP · `TeacherProposalSent` →
> le formateur sollicité · `TeacherProposalAccepted`/`TeacherProposalDeclined` → rôle RP ·
> `TeacherProposalNotSelected`/`TeacherProposalExpired` → le formateur concerné ·
> `TeacherAssigned`/`MainTeacherAssigned` (legacy) → le formateur choisi, l'élève, et chaque parent
> financeur (résolus via `GET /internal/relations/finance-owners/:studentId` sur profile-service)
> · `TeacherRequestStatusUpdated` → l'élève et ses parents financeurs · `TeacherRequestClosed` et
> `TeacherRequestDeleted` → aucune notification. Tout `eventName` non reconnu est journalisé en
> avertissement puis acquitté sans effet — un type inconnu ne doit jamais bloquer le flux.
>
> Avant de créer une notification, les noms sont résolus via `GET /internal/profiles/:userId/display-name`
> / `POST /internal/profiles/display-names` sur profile-service (jamais d'UUID stocké comme donnée
> d'affichage) et stockés dans `metadata`. **Si la résolution de nom ou des parents financeurs
> échoue, l'entrée du flux n'est pas acquittée** (retry via XAUTOCLAIM) plutôt que de publier une
> notification dégradée — voir `EventProcessorService`.

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
| GET | /financial-profiles/:ownerId | Lire son propre profil financier, ou celui d'un tiers si rôle privilégié | 🔒 | **owner (soi-même), quel que soit son rôle** · sur un tiers : administrateur_financier, responsable_pedagogique, technicien_informatique | — | `200 {id, ownerId, profileType, pointsBalance, fundingEndDate, paymentMethod, paymentReference}` · `401` · `403` · `404` |
| PATCH | /financial-profiles/:ownerId | Modifier les moyens de paiement ou paramètres | 🔒 | owner **si parent_financeur**, administrateur_financier, technicien_informatique | `{paymentMethod?, paymentReference?, fundingEndDate?}` | `200 {profileType mis à jour}` · `400` · `401` · `403` · `404` |

Valeurs `profileType` : `limite` (compte non encore activé — inscription non payée) · `membre` (inscription payée).
Valeurs `paymentMethod` : `cb` · `virement` · `paypal`.

> **Corrigé le 2026-08-11 — le titulaire lit son propre profil financier quel que soit son rôle.**
> La colonne « Rôles autorisés » annonçait déjà « owner (soi-même) », mais le code ne le faisait pas :
> le `RolesGuard` filtrait sur une liste de rôles (`parent_financeur`, AF, RP, TI) **avant** que le
> contrôle de propriété du service ne s'exécute. Un `formateur` demandant son **propre** profil
> recevait `403 {"message":"Insufficient role"}`, alors que le README lui promet un suivi financier
> et qu'il est rémunéré par ce service. `animateur_pedagogique` — un formateur promu, rémunéré de la
> même façon — était touché à l'identique.
> L'accès est désormais piloté par la **propriété**, pas par une liste de rôles qui oublie un rôle à
> chaque évolution : les routes de lecture par propriétaire portent `@OwnerAccess()` et la décision
> revient au service. **L'accès au profil d'autrui est inchangé** (AF, RP, TI).
>
> Distinction `403` / `404`, sur laquelle le front s'appuie :
> - `403` = « pas le droit » ; le contrôle de permission passe **avant** la recherche en base, donc un
>   `404` ne révèle jamais l'existence d'un profil à qui n'a pas le droit de le savoir ;
> - `404` = « pas encore de profil », état **normal** que le client traite en « profil à créer ».
>
> **L'écriture (PATCH) n'a pas bougé** et reste plus restrictive que la lecture : un `formateur` ou un
> `animateur_pedagogique` lit son profil financier mais ne peut pas encore l'écrire (`403 "Insufficient
> role"`). Ouvrir l'écriture est une décision distincte, non prise ici.

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
| GET | /financial-archives/:ownerId | Lister ses propres archives financières, ou celles d'un tiers si rôle privilégié | 🔒 | **owner (soi-même), quel que soit son rôle** · sur un tiers : administrateur_financier, responsable_pedagogique, technicien_informatique | `200 [{id, ownerId, itemType, referenceId, label, amountCents, balanceSnapshot, occurredAt}]` · `401` · `403` |

Les archives sont triées par `occurredAt DESC`. Types d'items : `payment` · `invoice` · `ledger_entry`.
Un titulaire sans aucun événement financier reçoit `200 []` — jamais une erreur.

> **Corrigé le 2026-08-11**, même défaut et même correction que `GET /financial-profiles/:ownerId`
> ci-dessus : un `formateur` demandant ses **propres** archives recevait `403 "Insufficient role"`.
> L'accès est désormais piloté par la propriété ; l'accès aux archives d'autrui est inchangé.

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
| GET | /teacher-payment-requests/by-teacher/:teacherId | Lister ses propres demandes de rémunération, ou celles d'un tiers si rôle privilégié | 🔒 | **le formateur lui-même, `formateur` comme `animateur_pedagogique`** · sur un tiers : administrateur_financier, responsable_pedagogique, technicien_informatique | `200 [{id, teacherId, amountCents, status, ...}]` · `401` · `403` |
| POST | /teacher-payment-requests | Créer une demande de rémunération | 🔒 | formateur | `201 {id, teacherId, amountCents, status, createdAt}` · `400` · `401` · `403` |
| POST | /teacher-payment-requests/:id/validate | Valider une demande | 🔒 | administrateur_financier | `200 {id, status}` · `401` · `403` · `404` |

> **Corrigé le 2026-08-11** sur `GET .../by-teacher/:teacherId` : la liste de rôles du contrôleur
> (`formateur`, AF, TI) contredisait sa propre description Swagger, qui annonçait le RP — le
> `responsable_pedagogique` était donc refusé à tort, et `animateur_pedagogique` ne pouvait pas voir
> ses propres demandes. Route désormais pilotée par la propriété (`@OwnerAccess()`), comme les deux
> routes de lecture financière ci-dessus.
>
> **Point en suspens (écriture, non tranché)** : `POST /teacher-payment-requests` reste réservé au rôle
> `formateur`. Un `animateur_pedagogique` — formateur promu, rémunéré comme tel — ne peut donc pas
> soumettre de demande de rémunération. C'est une écriture, hors périmètre de la correction du
> 2026-08-11 ; à arbitrer.

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
- Le parent financeur ne peut pas accéder aux entrées de type `carnet_personnel` (réservé à l'élève).
- Les résumés de cours (`resume_de_cours`) sont permanents et restent accessibles après expiration de l'enregistrement vidéo (VID-AC-002).
- **Ce service ne porte AUCUNE archive financière.** Les archives financières appartiennent à
  `finance-credit-service` (`GET /api/v1/finance/financial-archives/:ownerId`) et restent au seul
  titulaire et aux administrateurs : une relation pédagogique n'y ouvre rien.

Types d'items (valeurs réelles renvoyées par le serveur) : `cahier_de_texte` · `carnet_personnel` ·
`resume_de_cours` · `contenu_eleve` · `parcours` · `exercice_evaluation` · `video`

> **Correction du 2026-08-11.** Ce tableau annonçait jusqu'ici `pedagogical_log` · `course_summary` ·
> `notebook_entry` · `recording` · `content_catalog` — cinq valeurs qui n'ont jamais existé côté
> serveur, et que le front déclarait dans `apps/web/src/api/archiveDocument.ts`. Deux noms pour une
> même donnée : l'écart est résorbé des deux côtés — le front déclare les sept valeurs ci-dessus
> depuis le 2026-08-11, avec un point unique `itemType` → libellé français
> (`apps/web/src/utils/archiveLabels.ts`).

#### Droit d'accès aux archives pédagogiques — piloté par la relation (2026-08-11)

> Arbitrage du 2026-08-11 (`docs/architecture.md` > « Arbitrages rendus »), même règle que pour les
> statistiques : **le droit vient de la relation métier**, pas d'une liste de rôles. Le contrôle
> est fait par le serveur, qui demande les relations à `profile-service`
> (`GET /internal/relations/:viewerId/:targetId`) — unique propriétaire, aucune copie ici.

| Lecteur | Accède aux archives pédagogiques de |
|---|---|
| Le **titulaire** | les siennes |
| **RP, AF, TI** (administrateurs) | tout le monde, sans distinction pour l'instant |
| **Formateur** | ses élèves |
| **Parent financeur** | ses élèves (hors `carnet_personnel`) |
| **AP** | les formateurs qu'il anime |
| **Coordinateur** (RP/AP) | les élèves qu'il coordonne |

**L'asymétrie à ne pas manquer :** un élève et le parent de cet élève voient les **statistiques**
pédagogiques du formateur (`profile-service`) mais **pas ses archives pédagogiques** — l'archive
d'un formateur porte son historique d'exercice, elle ne regarde pas ses élèves. En termes de `kind` :
`teacher_of_student`, `finance_owner_of_student`, `animator_of_teacher` et `coordinator_of_student`
**ouvrent** ; `student_of_teacher`, `student_of_finance_owner`, `teacher_of_animator`,
`student_of_coordinator`, `finance_owner_of_student_of_teacher` et
`teacher_of_student_of_finance_owner` **n'ouvrent pas**.

Toute paire refusée reçoit **`404`** avec le **même message** qu'une absence d'archive
(`Aucune archive pédagogique accessible pour cette personne`), prononcé **avant toute lecture en
base** : un `403` révélerait l'existence de ce qu'on refuse de montrer. **Ces routes ne renvoient
plus `403` en lecture.** Un titulaire sans aucune archive reçoit donc lui aussi `404` — c'est ce qui
rend les deux cas indiscernables, et c'est le comportement que le front traite déjà comme un état
normal.

**L'AP n'est pas un administrateur** : sans lien `animator-teacher` créé par un RP, il ne voit les
archives de personne. La table naît vide.

### Archives pédagogiques

> Préfixe gateway : `/api/v1/archives` → service reçoit `/archives/...`
> Téléchargement : `/api/v1/documents` → service reçoit `/documents/...`
>
> **Corrigé le 2026-08-11 :** le contrôleur était monté sur `/students/...` et
> `/archive-documents/...` alors que la gateway transmet `/archives/students/...` et
> `/documents/...`. **Aucune route archive n'existait à l'adresse appelée** : la pile réelle
> répondait `404 "Cannot GET /archives/students/…/pedagogical-archives"` à tous les rôles, y compris
> au titulaire. Les préfixes du service sont désormais alignés sur ceux de la gateway.

| Méthode | Chemin (via gateway) | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /api/v1/archives/students/:studentId/pedagogical-archives | Lister les archives pédagogiques d'un **titulaire** (élève, ou formateur quand un AP le consulte) | 🔒 | **piloté par la relation** (`@OwnerAccess()`, aucune liste de rôles) — voir le tableau ci-dessus | `200 {data: [{id, studentId, itemType, title, description, downloadUrl, score, pedagogicalPoints, occurredAt, isParentVisible, idempotencyKey, createdAt, updatedAt}], page, limit, total, totalPages}` · `400` UUID mal formé · `401` · `404` aucune archive **ou** aucune relation ouvrant ce droit (indiscernables) · `503` `profile-service` injoignable |
| POST | /api/v1/archives/students/:studentId/archive-links | Créer un lien d'archive depuis un service source | 🔒 | **liste de rôles explicite** : formateur, AP, RP, TI, AF — une relation ouvre la lecture, jamais l'écriture | `201 {id, studentId, itemType, title, ...}` · `200` idempotent · `400` · `401` · `403` rôle non autorisé · `409` clé d'idempotence appartenant à un autre titulaire |
| GET | /api/v1/archives/students/:studentId/archive-timeline | Timeline chronologique des archives (groupée par date) | 🔒 | **piloté par la relation**, mêmes droits que la liste | `200 {data: [{date, items: [{id, itemType, title, sourceId, sourceService, score, pedagogicalPoints}]}], page, limit, total, totalPages}` · `400` · `401` · `404` · `503` |

Pagination : `page` (défaut 1) et `limit` (défaut 20, max 100). La liste renvoie une **enveloppe**
`{data, page, limit, total, totalPages}`, pas un tableau nu. Le front lisait un tableau
(`Array.isArray(data) ? data : []`) et affichait donc un état vide ; le repli a été supprimé le
2026-08-11 — une enveloppe inattendue doit se voir, pas se taire.

### Téléchargement

| Méthode | Chemin (via gateway) | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /api/v1/documents/:id/download | Télécharger un document d'archive (redirection 302 vers l'URL du service source) | 🔒 | **piloté par la relation**, mêmes droits que la liste | `302` redirect · `400` UUID mal formé · `401` · `404` document introuvable, aucune relation, `carnet_personnel` demandé par un parent financeur, ou aucune URL de téléchargement — **quatre cas, un seul message** · `503` |

### API interne inter-services (non exposée via nginx)

> Exclue de Swagger (`@ApiExcludeController`). Protégée par `X-Internal-Secret: <INTERNAL_SECRET>`.

| Méthode | Chemin | Description | Header requis | Réponse attendue |
|---|---|---|---|---|
| GET | /internal/students/:studentId/archives | Lister toutes les archives d'un titulaire, **sans filtrage de relation ni de carnet personnel** — destinée aux workflows d'orchestration, jamais à un appelant utilisateur | `X-Internal-Secret` | `200 [{id, studentId, itemType, ...}]` · `401` secret absent ou invalide |

**Dépendance sortante :** ce service appelle `GET /internal/relations/:viewerId/:targetId` de
`profile-service` (variable `PROFILE_SERVICE_URL`, en-tête `X-Internal-Secret`, `x-correlation-id`
propagé, délai 3 s) à **chaque lecture**. Il n'en conserve rien. Si l'appel échoue, la lecture
répond `503` : on n'ouvre ni ne ferme un droit par défaut.

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
