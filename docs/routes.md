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

> **Plafond réglable par le TI depuis le 2026-08-26** (arbitrage « Liens et pièces jointes sur une
> entrée de cahier de texte, et paramètres système associés », point 8 de `docs/architecture.md`) :
> `MEDIA_MAX_UPLOAD_BYTES` n'est plus la valeur appliquée, seulement la valeur **d'amorçage**, posée
> en base au tout premier appel si aucun réglage n'existe encore (table `media_settings`, ligne
> singleton). `PATCH /profiles/avatar/settings` (TI seul) la remplace ensuite **à l'exécution, sans
> redéploiement** ; `GET /profiles/avatar/constraints` (déjà documentée ci-dessous, contrat
> **inchangé**) lit désormais cette même valeur en base au lieu de la variable d'environnement.
>
> **Deux plafonds distincts coexistent sur `POST /profiles/:userId/avatar`, et c'est volontaire** :
> multer applique un filet de sécurité **statique** (`MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES`,
> 10 000 000 octets, code) — il ne peut pas être dynamique, les options de `FileInterceptor` étant
> évaluées à l'import du contrôleur, avant qu'un appel en base ne soit possible. C'est le **service**
> (`AvatarService.uploadAvatar`, second verrou) qui applique ensuite la valeur **réellement réglée**
> par le TI et produit, dans l'immense majorité des cas, le `413` structuré ci-dessous. Cette même
> constante (10 000 000 octets) est aussi la borne haute de validation de
> `PATCH /profiles/avatar/settings` : le TI ne peut donc jamais régler une valeur que multer
> refuserait avant même que le service ne la voie.

| Méthode | Chemin | Auth | Rôles autorisés | Description | Réponse attendue |
|---|---|---|---|---|---|
| GET | /profiles/avatar/constraints | 🔒 | tout compte authentifié | **À lire AVANT d'ouvrir le sélecteur de fichier.** Publie les contraintes d'envoi en vigueur, pour que le front les affiche et rejette localement un fichier trop lourd, plutôt que de laisser l'utilisateur le découvrir après plusieurs secondes d'envoi. Pas de `:userId` : les contraintes ne dépendent ni du profil visé ni du lecteur. **Ces valeurs ne doivent pas être codées en dur côté front** — elles viennent de la même configuration que celle opposée à l'envoi (désormais lue en base, voir encadré ci-dessus), une copie divergerait au premier ajustement et annoncerait alors une limite fausse | `200 {maxUploadBytes, acceptedContentTypes, outputContentType, maxDimensionPixels}` — ex. `{"maxUploadBytes":1000000,"acceptedContentTypes":["image/jpeg","image/png","image/webp","image/gif","image/avif"],"outputContentType":"image/webp","maxDimensionPixels":512}` · `401` |
| PATCH | /profiles/avatar/settings | 🔒 | **technicien_informatique SEUL** | Régler le plafond d'envoi de la photo de profil **à l'exécution, sans redéploiement** (voir encadré ci-dessus). Body `{maxAvatarUploadBytes}`, entier en octets. **PAS sous `/admin`** : `location ^~ /api/v1/admin` de `gateway/api-gateway/nginx.conf` route déjà tout ce préfixe vers `admin-observability-service` — une route `profile-service` sous ce chemin serait injoignable sans modifier la gateway (hors périmètre de ce chantier). Volontairement regroupée avec `GET /profiles/avatar/constraints` : même ressource, même contrôleur | `200 {maxAvatarUploadBytes, updatedAt}` — reflète la valeur RELUE en base après écriture, jamais le corps envoyé tel quel (règle du 2026-08-10, point 3bis) · `400` `maxAvatarUploadBytes` absent, non entier, ou hors bornes `[10000, 10000000]` octets, ou champ inconnu (`forbidNonWhitelisted`) · `401` · `403` rôle autre que TI |
| POST | /profiles/:userId/avatar | 🔒 | **le titulaire seul** | Envoyer ou remplacer la photo. **Multipart**, champ `file`, un seul fichier. Le type est détecté sur les **octets réels** (nombres magiques) — ni l'extension ni le `Content-Type` du client ne sont consultés, tous deux étant sous son contrôle. L'image est **intégralement ré-encodée** en WebP borné à 512 px, ce qui neutralise toute charge dissimulée et **supprime les métadonnées EXIF**, géolocalisation comprise. **SVG refusé** (document XML exécutable). Le nom du fichier stocké est un UUID généré par le serveur. Le fichier précédent est supprimé du volume. Formats acceptés : JPEG, PNG, WebP, GIF, AVIF | `200 {avatarUrl}` — URL de lecture versionnée, identique à celle du bloc `administrative` · `400` aucun fichier, format non reconnu, SVG, HEIC/HEIF, image illisible · `401` · `403` appelant autre que le titulaire · `413` au-delà du plafond en vigueur (**réglable par le TI depuis le 2026-08-26**, 1 000 000 octets par défaut à l'amorçage) — **corps structuré, voir ci-dessous** · `500` profil administratif absent, ou stockage indisponible |
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

**Taille maximale — 1 000 000 octets (1 Mo) par défaut à l'amorçage, réglable ensuite par le TI, et
pourquoi cette valeur précise.**

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
| `profile-service` (multer, filet de sécurité **statique**) | 10 000 000 o | `MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES` (code) | `413` JSON structuré ci-dessous, plafond FIXE |
| `profile-service` (service, valeur **dynamique**, réglable par le TI) | 1 000 000 o à l'amorçage | table `media_settings`, `PATCH /profiles/avatar/settings` | `413` JSON structuré ci-dessous, plafond RÉELLEMENT en vigueur |

> ⚠️ **Régler `maxAvatarUploadBytes` au-delà du plafond de `nginx-global` produit le même `413` HTML
> illisible déjà documenté** — cette route ne l'empêche pas, elle documente seulement la conséquence.
> Le `client_max_body_size` qui contraint réellement vit **hors de ce dépôt**
> (`/home/debian/NginxGlobal/nginx.conf`, bloc `location /api/v1/` de `claudevma.visioprof.fr`) et
> n'a pas encore été corrigé. Le jour où il le sera, l'ordre reste le même que documenté depuis le
> 2026-08-10 : relever `nginx-global` d'abord, puis `api-gateway` si besoin — le réglage TI
> (`PATCH /profiles/avatar/settings`), lui, ne demande **aucun redéploiement**.
>
> Le filet de sécurité **statique** de multer (`MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES`, ligne du
> dessus) reste, lui, un plafond de CODE — le relever exige toujours un redéploiement, exactement
> comme avant ce chantier. C'est un choix assumé : les options de `FileInterceptor` sont évaluées à
> l'import du contrôleur, avant qu'un appel asynchrone en base ne soit possible, donc avant de
> connaître la valeur réglée par le TI. Cette même constante borne aussi la valeur haute acceptée par
> `PATCH /profiles/avatar/settings` (`400` au-delà) : le TI ne peut donc jamais régler une valeur que
> ce filet refuserait avant même que le service ne la voie.

Le refus est prononcé **en streaming**, par multer, dès le dépassement du filet de sécurité fixe : le
contrôleur n'est pas atteint et les octets excédentaires ne sont jamais chargés en mémoire — c'est le
seul cas où ceci reste vrai depuis le 2026-08-26. **Dans l'immense majorité des cas** (un fichier
dépassant la valeur réglée par le TI mais restant sous le filet de sécurité fixe), le fichier est reçu
en ENTIER puis refusé par `AvatarService.uploadAvatar`, qui connaît la valeur réellement en vigueur —
c'est ce second contrôle qui produit alors le `413`, avec `receivedBytes` renseigné plutôt qu'à `null`.
Le service refait de toute façon le contrôle pour les appels qui n'empruntent pas l'intercepteur.

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
| GET | /profiles/teachers/validated | 🔒 | responsable_pedagogique, administrateur_financier, technicien_informatique | **Annuaire des formateurs dont la validation est `validated`.** Query : `page` (défaut `1`) et `limit` (défaut `20`, **maximum `100`**), plus `q` (optionnel, ajouté le 2026-09-02 — recherche insensible à la casse sur `firstName`/`lastName`, appliquée côté serveur avant la pagination, combinée au filtre de statut déjà en place ; absent/vide = comportement inchangé). Liste **triée par nom puis prénom sur l'ensemble**, pas page par page. Contenu **limité au socle de visibilité** — rien de plus, bien que les administrateurs soient exemptés du filtrage champ par champ : servir la fiche entière ferait de cette liste une porte dérobée à ce filtrage. `avatarUrl` ajouté le 2026-09-02 (champ additif, mêmes garanties que `AdministrativeProfileView`) pour l'usage tuile de l'annuaire « Visualisation » du RP | `200 {data: [{userId, firstName, lastName, avatarUrl, levels, subjects}], page, limit, total, totalPages}` · `400` `page`/`limit` non entier ou < 1, `limit` > 100, `q` > 100 caractères, **ou paramètre de requête inconnu** · `401` · `403` tout autre rôle, **animateur pédagogique compris** |

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
  pas un moteur. `q` (2026-09-02) est une **recherche par nom** seulement, pas ce moteur — utilisée
  notamment par `GET /profiles/directory/by-role?role=formateur`, qui délègue à cette route et lui
  transmet `q` tel quel.
- Aucune modification de `api-gateway` n'a été nécessaire : `/api/v1/profiles` est proxifié **en bloc**
  (`location ^~`), donc `/api/v1/profiles/teachers/validated` est joint sans déclaration nouvelle.

### Annuaire « Visualisation » par rôle (RP) — 2026-09-02

> `docs/architecture.md` > « Reconstruction du rail gauche du RP », précision du 2026-09-02.
> Le menu « Visualisation » du RP doit retrouver n'importe quel utilisateur élève, parent,
> professeur, AP par rôle, sous forme de tuiles avec liens vers profil/calendrier/cahier de
> texte. Seul le rôle formateur avait déjà un annuaire exploitable
> (`/profiles/teachers/validated` ci-dessus) ; cette route couvre les 4 rôles avec une seule
> forme de réponse, et **délègue** à l'annuaire formateurs pour `role=formateur` plutôt que d'en
> dupliquer la logique.

| Méthode | Chemin | Auth | Rôles autorisés | Description | Réponse attendue |
|---|---|---|---|---|---|
| GET | /profiles/directory/by-role | 🔒 | responsable_pedagogique, administrateur_financier, technicien_informatique | **Annuaire par rôle**, un rôle à la fois. Query : `role` (**requis**, un de `eleve`/`parent_financeur`/`formateur`/`animateur_pedagogique`), `page` (défaut `1`), `limit` (défaut `20`, **maximum `100`**), `q` (optionnel, ajouté le 2026-09-02 — recherche insensible à la casse sur `firstName`/`lastName`, combinée au filtre `role`, appliquée côté serveur avant la pagination ; absent/vide = comportement inchangé, max 100 caractères). `role=formateur` délègue intégralement à `GET /profiles/teachers/validated` (même population, même tri, même contenu, `q` transmis tel quel). Pour les 3 autres rôles, la population fait autorité auprès de `identity-access-service` (`GET /internal/accounts?role=`), croisée avec les profils locaux, triée par nom puis prénom sur l'ensemble | `200 {data: [{userId, firstName, lastName, avatarUrl, level, levels, subjects}], page, limit, total, totalPages}` · `400` `role` absent/hors enum, `page`/`limit` non entier ou < 1, `limit` > 100, `q` > 100 caractères, ou paramètre de requête inconnu · `401` · `403` tout autre rôle |

Précisions qui font contrat :

- **Le chemin comporte deux segments (`directory/by-role`) à dessein**, même motif que
  `teachers/validated` : un chemin à un seul segment sous `/profiles` (ex. `/profiles/directory`
  seul) entrerait en collision avec `GET /profiles/:userId`, quel que soit l'ordre de
  déclaration des contrôleurs — Express route par nombre de segments.
- **`level` (singulier) et `levels` (pluriel) sont deux champs distincts, jamais fusionnés.**
  `level` porte le niveau scolaire **suivi** par un élève (une valeur, non nul seulement pour
  `role=eleve`) ; `levels` porte les niveaux **enseignés** par un formateur/AP (plusieurs
  valeurs, non nul seulement pour `role=formateur`/`role=animateur_pedagogique`). Ce sont deux
  données différentes, déjà nommées différemment sur leurs entités respectives
  (`StudentPedagogicalProfile.level` vs `TeacherPedagogicalProfile.levels`) — les confondre sous
  un seul nom aurait mélangé « le niveau suivi » et « les niveaux enseignés ».
- **`role=parent_financeur` n'a aucun bloc pédagogique** : `level`, `levels` et `subjects` valent
  toujours `null` pour ce rôle, ce n'est ni une anomalie ni une incohérence.
- **`userId` sert uniquement à router** vers les écrans liés (profil/calendrier/cahier de texte
  côté front) ; il n'est jamais affiché comme texte (arbitrage du 2026-08-09).
- **Incohérence de données journalisée, pas bloquante** : un compte connu d'`identity-access-service`
  pour ce rôle mais sans profil administratif local n'apparaît pas dans la liste (le profil
  administratif est obligatoire, créé à l'inscription) et l'écart est journalisé côté serveur —
  contrairement à l'annuaire formateurs, il n'est pas non plus inclus avec des champs `null` :
  la population de référence vient d'un autre service, il n'y a pas de ligne locale à afficher
  malgré tout.
- **Dégradation, pas erreur, si `identity-access-service` est indisponible** pour un rôle
  interrogé (`eleve`/`parent_financeur`/`animateur_pedagogique`) : la route renvoie une page
  vide (`data: [], total: 0`) plutôt qu'un `5xx`, journalisé côté serveur.
- Aucune modification de `api-gateway` n'a été nécessaire, même raisonnement que
  `teachers/validated` (`/api/v1/profiles` proxifié en bloc).
- **Recherche `q` (2026-09-02)** : filtre `ILIKE` insensible à la casse sur `firstName`/`lastName`,
  appliqué **avant** le découpage en page (`WHERE ... AND (firstName ILIKE '%q%' OR lastName ILIKE
  '%q%')`, puis `OFFSET`/`LIMIT`) — jamais un filtrage sur la seule page déjà récupérée. Vérifié
  contre la pile réelle le 2026-09-02 : `q` vide laisse `total` inchangé (166 élèves), un nom exact
  ou partiel (casse différente) restreint `total` à la bonne valeur, une recherche sans résultat
  renvoie `{data: [], total: 0}`, et la pagination reste cohérente avec un filtre actif (`total: 2`
  réparti sur 2 pages de `limit=1`, sans doublon ni omission). Même mécanique côté
  `GET /profiles/teachers/validated` pour `role=formateur`.

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
| GET | /relations/teacher-student/by-teacher/:teacherId | 🔒 | responsable_pedagogique, technicien_informatique, administrateur_financier, formateur (soi-même) | **Sens INVERSE de la route ci-dessus** (2026-09-02, gap « Contacts essentiels » de la Visualisation RP) : lister les élèves **actifs** d'un formateur. Un formateur n'avait jusqu'ici aucun moyen de lister ses propres élèves | `200 [{id, teacherId, studentId, isPrincipalTeacher, createdAt, endedAt: null, endedBy: null, endReason: null, studentName}]` — `studentName` est `{firstName, lastName}` résolu depuis le profil administratif de l'élève, ou `null` s'il n'en a pas · `401` · `403` |
| POST | /relations/pedagogical-coordinator | 🔒 | responsable_pedagogique | Lier un RP ou AP comme coordinateur pédagogique d'un élève | `201 {coordinatorId, studentId, coordinatorRole, createdAt}` · `400` rôle invalide · `401` · `403` · `409` doublon |
| GET | /relations/pedagogical-coordinator/:coordinatorId | 🔒 | responsable_pedagogique, animateur_pedagogique (soi-même), technicien_informatique | Lister les liens de coordination d'un coordinateur | `200 [{coordinatorId, studentId, coordinatorRole}]` · `401` · `403` |
| POST | /relations/animator-teacher | 🔒 | responsable_pedagogique | **Rattacher un AP à un formateur qu'il anime** (2026-08-11). Aucune table ne portait cette relation : `pedagogical-coordinator` lie un coordinateur à un **élève**, pas à un formateur. C'est elle, et elle seule, qui ouvre à l'AP la lecture des statistiques (et bientôt des archives) du formateur. Réservé au RP : c'est lui qui promeut un formateur en AP, c'est donc lui qui décide de ce qu'un AP anime | `201 {id, animatorId, teacherId, createdAt}` · `400` champ absent ou non-UUID · `401` · `403` tout rôle autre que RP, AP compris · `409` doublon |
| GET | /relations/animator-teacher/:animatorId | 🔒 | responsable_pedagogique, technicien_informatique, animateur_pedagogique (soi-même) | Lister les formateurs animés par un AP | `200 [{id, animatorId, teacherId, createdAt, teacherName}]` — `teacherName` est `{firstName, lastName}`, ou `null` si le formateur n'a pas de profil administratif · `401` · `403` |
| GET | /relations/animator-teacher/by-teacher/:teacherId | 🔒 | responsable_pedagogique, technicien_informatique, formateur (soi-même) | **Sens INVERSE de la route ci-dessus** (2026-09-02, gap « Contacts essentiels » de la Visualisation RP) : lister le ou les AP qui animent un formateur. **AF volontairement absent** — relation pédagogique, pas financière | `200 [{id, animatorId, teacherId, createdAt, animatorName}]` — `animatorName` est `{firstName, lastName}`, ou `null` si l'AP n'a pas de profil administratif · `401` · `403` |
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
| GET | /internal/relations/teachers/:studentId | **Résoudre les professeurs actifs d'un élève** pour un appelant interservices — arbitrage du 2026-09-01 (`docs/architecture.md` > « Refonte des Evaluations », point 4b : demande de correction humaine). Premier consommateur prévu : `learning-activity-service`, pour notifier les professeurs liés à l'élève (en plus du RP, notifié par ailleurs via son rôle) quand celui-ci demande une correction. Réutilise directement `RelationsService.getTeachersByStudent` (liens **actifs** uniquement — un professeur délié n'apparaît plus). **Périmètre volontairement étroit : `userId` uniquement**, jamais de nom ni de statut de lien — la résolution de nom passe séparément par `GET /internal/profiles/:userId/display-name` / `POST /internal/profiles/display-names`. **Déclarée avant** `GET /internal/relations/:viewerId/:targetId` ci-dessous dans le contrôleur, même précaution que `finance-owners` juste au-dessus : même nombre de segments, `teachers` serait sinon capturé comme `:viewerId`. **Jamais exposée par api-gateway** | `X-Internal-Secret` | `200 {studentId, teacherUserIds: string[]}` — liste vide si aucun professeur actif · `400` `studentId` non-UUID · `401` secret absent ou invalide |
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
| GET | /calendars/:ownerId/events | Lister les événements autorisés | 🔒 | Query: `type?`, `personId?`. Filtrage par rôle côté serveur. **Bug réel corrigé le 2026-08-20** : renvoie désormais aussi les événements où `ownerId` est **invité** (pas seulement créateur), avec `viewerInvitationStatus` — voir section dédiée ci-dessous. |
| POST | /calendars/:ownerId/events | Créer un événement selon rôle | 🔒 | `eleve` → `rappel` · `formateur` → `cours/masterclass/pedagogique/rappel` · `animateur_pedagogique` → `pedagogique/rappel` · `responsable_pedagogique` → tous |
| DELETE | /calendars/:ownerId/events/:eventId | Supprimer un événement (suppression physique) | 🔒 | **Route ajoutée le 2026-08-20** (absente jusqu'ici, ni codée ni documentée). Créateur, RP ou TI uniquement — même politique que `POST /events/:id/cancel-request`. Réponse `204`. `404` si l'événement n'existe pas ou appartient à un autre `ownerId` (pas de fuite d'existence). Émet `CalendarEventDeleted`. |
| GET | /calendars/:ownerId | Lire le calendrier complet (créneaux de disponibilité + activités) | 🔒 | Titulaire ou rôle interne (RP, TI, AF). `parent_financeur` reçoit en plus `paymentEntries`. **`animateur_pedagogique` retiré le 2026-08-18** (chantier calendrier de disponibilités, point 2) : il donnait jusqu'ici un accès **intégral** à n'importe quel calendrier sans vérification de lien — bug corrigé, l'AP passe désormais exclusivement par `GET /calendars/:ownerId/busy` ci-dessous. Corrige un écart de doc : cette route existait déjà mais n'était pas documentée, tandis que la route `GET /calendars/:ownerId/availability` documentée jusqu'ici **n'a jamais existé** côté code (constat du 2026-08-18). **`activities` réellement porté depuis le 2026-08-18** (chantier calendrier de disponibilités, point 3, gap comblé) — voir section dédiée ci-dessous pour la forme exacte : jusque-là la réponse ne contenait jamais les activités malgré cette même documentation qui le promettait déjà. |
| GET | /calendars/:ownerId/busy | Lire le calendrier **busy/free** d'un tiers lié (jamais le contenu) | 🔒 | Voir section « Visibilité busy/free » ci-dessous. |
| PUT | /calendars/:ownerId/availability | Remplacer en bloc tous les créneaux de disponibilité | 🔒 | Titulaire (`eleve` ou `formateur`), RP ou TI. `animateur_pedagogique` a été retiré des rôles autorisés le 2026-08-18 : il apparaissait dans le décorateur de rôles mais était déjà refusé par le service — décorateur corrigé pour refléter la vraie politique. |
| POST | /calendars/:ownerId/availability-slots | Créer un créneau de disponibilité/indisponibilité, sans toucher aux autres | 🔒 | Mêmes rôles que le `PUT` ci-dessus. `400` si `endTime <= startTime` ou `recurrenceEndDate < startTime`. |
| PATCH | /calendars/:ownerId/availability-slots/:slotId | Modifier un créneau (redimensionner, changer récurrence/date de fin/type) | 🔒 | Mêmes rôles. `404` si le créneau n'existe pas ou appartient à un autre `ownerId` (pas de fuite d'existence). |
| DELETE | /calendars/:ownerId/availability-slots/:slotId | Supprimer un créneau (suppression physique) | 🔒 | Mêmes rôles. Réponse `204`. `404` si le créneau n'existe pas ou appartient à un autre `ownerId`. |

Body `POST /calendars/:ownerId/events` : `{title?, startAt, endAt, eventType, description?, inviteeIds?}`

**Bug corrigé le 2026-08-20** : `title` était documenté et implémenté comme requis
(`@IsString()` sans `@IsOptional()` sur `CreateCalendarEventDto`), alors que le formulaire de
création côté front l'annonçait déjà comme optionnel — signalé par l'utilisateur en testant
`/calendar` en conditions réelles. `@IsOptional()` ajouté au DTO ; la colonne `title` de
`calendar_events`, `NOT NULL` en base, a été rendue nullable par migration
(`MakeCalendarEventTitleOptional1787080000000`). Aucun titre par défaut n'est fabriqué côté
serveur : un événement créé sans `title` est stocké avec `title: null` et relu tel quel —
l'affichage d'un texte de repli (ex. « Sans titre ») reste un sujet front, pas serveur.

**Bug corrigé le 2026-08-19** : le `CreateCalendarEventDto` exigeait en réalité `startTime`/`endTime`
depuis toujours — un écart pur entre le code et cette même documentation, jamais synchronisé. Le
front (conforme à cette doc) envoyait `startAt`/`endAt` et recevait systématiquement `400
"startTime must be a valid ISO 8601 date stringendTime must be a valid ISO 8601 date string"` (les
deux messages de validation concaténés sans séparateur — la concaténation n'a pas sa source dans
`calendar-service`, qui ne construit ni ne joint ce message : `ValidationPipe` par défaut renvoie un
tableau `message: string[]`, sans exception filter local qui le transformerait en chaîne ; à
chercher côté `api-gateway` ou côté front, point ouvert non traité ici). Le DTO a été aligné sur le
nom déjà documenté et déjà envoyé par le front (`startAt`/`endAt`), plutôt que l'inverse — cette
route a toujours documenté `startAt`/`endAt`, sans lien avec les créneaux de disponibilité et les
activités qui utilisent légitimement `startTime`/`endTime` sur leurs propres routes.

Body `POST /calendars/:ownerId/availability-slots` : `{dayOfWeek?, startTime, endTime, recurrence?, recurrenceEndDate?, kind?}`
— `recurrence` : `none` (défaut) · `weekly` · `biweekly`. `recurrenceEndDate` (ISO 8601, instant inclusif) : absent = récurrence illimitée dans le temps, comportement historique préservé. `kind` : `available` (défaut) · `unavailable`.

Body `PATCH /calendars/:ownerId/availability-slots/:slotId` : mêmes champs, tous optionnels. `recurrenceEndDate` accepte explicitement `null` pour effacer une date de fin déjà posée (repasser une récurrence bornée en illimitée).

Réponse `GET /calendars/:ownerId/events` :
`[{id, title, startAt, endAt, eventType, status, ownerId, invitations?, reminderRules?, viewerInvitationStatus}]`
— `viewerInvitationStatus` est **nouveau depuis le 2026-08-20**, voir section dédiée ci-dessous.
Réponse `201` de `POST /calendars/:ownerId/events` (jamais de `viewerInvitationStatus`, l'appelant
étant par construction le créateur) :
`{id, title, startAt, endAt, eventType, status, ownerId, invitations?}`.

`DELETE /calendars/:ownerId/events/:eventId` ne prend **aucun corps** et répond `204` sans corps
en cas de succès — même forme que `DELETE /calendars/:ownerId/availability-slots/:slotId` ci-dessus
et `DELETE /activities/:activityId`. Suppression physique de la ligne (les
`EventInvitation`/`CancellationRequest`/`ReminderRule` liés disparaissent avec elle, `onDelete:
CASCADE`) — même raisonnement que les autres suppressions de ce service : un événement de
calendrier est une donnée opérationnelle d'agenda, pas un enregistrement à valeur probante.

**Écart de doc corrigé le 2026-08-19** : cette forme de réponse (`startAt`/`endAt`) était
documentée depuis le début mais jamais portée par le code — le contrôleur renvoyait l'entité
`CalendarEvent` telle quelle (`startTime`/`endTime`, sans sérialisation dédiée), pour `GET` comme
pour la réponse `201` de `POST`. Corrigé en renommant les propriétés TypeScript de l'entité
`CalendarEvent` (`startTime` → `startAt`, `endTime` → `endAt`) ; la colonne physique en base reste
`start_time`/`end_time` (`@Column({ name: 'start_time' })`), seul le nom exposé en JSON change.
Aucun autre appelant interne de cette entité ne dépendait de `startTime`/`endTime` (vérifié —
seul `calendar-events.service.ts` référence l'entité `CalendarEvent`, corrigé en même temps ; les
routes `availability-slots`/`activities` portent leurs propres entités et gardent légitimement
`startTime`/`endTime`). Le payload interne de l'évènement `CalendarEventCreated` (outbox
`domain_events`) garde volontairement la clé `startTime` — hors périmètre de ce correctif, qui ne
porte que sur la réponse HTTP, pour ne pas modifier un contrat d'évènement interservices sans
concertation.

### `GET /calendars/:ownerId/events` — événements où l'invité est spectateur, jamais créateur (bug réel corrigé le 2026-08-20)

**Bug réel, signalé par un utilisateur réel.** `professeur.lycee` crée un événement partagé avec
`eleve.sixieme` via `inviteeIds` (`POST /calendars/professeur.lycee/events`). L'élève n'a **rien
vu** : ni sur son calendrier, ni de notification — donc aucun moyen d'accepter ou de refuser
l'invitation. Diagnostic confirmé en lisant le code réel : `listEvents` ne filtrait que sur
`event.owner_id = :ownerId` — jamais sur `EventInvitation.invitee_id`. Un événement est toujours
stocké sous le calendrier de son **créateur** (`ownerId` du chemin `POST` = l'appelant), jamais
sous celui de ses invités ; `GET /calendars/eleve.sixieme/events` ne pouvait donc **jamais**
renvoyer un événement créé par `professeur.lycee`, quel que soit le nombre d'invitations posées.

**`GET /calendars/:ownerId` (l'autre route mentionnée dans l'hypothèse initiale) n'est PAS
concernée par ce bug — et ne l'a jamais été.** Elle ne porte que `availabilitySlots` et
`activities` (`ScheduledActivity`, voir section dédiée ci-dessous) ; elle n'a **jamais** inclus
`CalendarEvent` sous quelque forme que ce soit, avant ou après ce correctif — ce n'est pas une
régression de ce correctif, c'est un choix de périmètre déjà en place depuis le chantier du
2026-08-18 (« activités » = `ScheduledActivity`, « événements » = `CalendarEvent`, deux agrégats
distincts avec leurs propres routes). La route dédiée aux `CalendarEvent` est, et reste,
`GET /calendars/:ownerId/events`.

**Correction appliquée**, sur le même principe que `ActivitiesService.findActiveInRange`
(chantier calendrier de disponibilités, point 3, 2026-08-18 — « créateur OU participant ») :
`CalendarEventsService.listEvents` filtre désormais sur
`(event.owner_id = :ownerId OR invitation.invitee_id = :ownerId)` — « créateur OU invité ».

**Requête**, inchangée :

```
GET /calendars/f841ccff-a112-4df8-9dc3-f875c995507d/events
Authorization: Bearer <jwt éleve.sixieme>
```

**Réponse `200`** — l'élève, simple invité (pas créateur), obtient désormais l'événement créé par
le formateur, avec `viewerInvitationStatus` :

```json
[
  {
    "id": "3fa1b6e0-1234-4b2b-9e9e-000000000099",
    "title": "Cours particulier",
    "startAt": "2026-09-10T14:00:00.000Z",
    "endAt": "2026-09-10T15:00:00.000Z",
    "eventType": "cours",
    "status": "active",
    "ownerId": "47a5808b-66c7-41c9-92cd-7367d1cda003",
    "invitations": [
      {
        "id": "8b1a0c40-...",
        "eventId": "3fa1b6e0-1234-4b2b-9e9e-000000000099",
        "inviteeId": "f841ccff-a112-4df8-9dc3-f875c995507d",
        "status": "pending",
        "createdAt": "2026-09-01T10:00:00.000Z",
        "updatedAt": "2026-09-01T10:00:00.000Z"
      }
    ],
    "viewerInvitationStatus": "pending"
  }
]
```

| Champ | Remarque |
|---|---|
| `ownerId` | Le **créateur** de l'événement (`professeur.lycee`), **pas** l'`ownerId` du chemin de la requête (`eleve.sixieme`) — un événement garde toujours le calendrier de son créateur. |
| `invitations` | Pour un événement où le titulaire du `GET` (`ownerId` du chemin) est **créateur** : toutes les invitations de l'événement, comme avant ce correctif. Pour un événement où il est **seulement invité** : **uniquement sa propre invitation** — effet de bord du filtre `LEFT JOIN` + `WHERE`, assumé comme une protection de vie privée (un invité n'a pas à voir la réponse des autres invités). |
| `viewerInvitationStatus` | **Nouveau.** `pending` \| `accepted` \| `declined` — le statut de l'invitation du titulaire du `GET` sur cet événement. `null` si le titulaire n'est pas invité (c'est son propre événement, ou il y accède par un rôle privilégié / un `CalendarVisibilityGrant` sans y être lui-même invité). Ajouté pour que le front distingue visuellement un événement en attente de réponse, sans avoir à parcourir `invitations` lui-même et à retrouver sa propre ligne par `inviteeId`. |

**Non concerné par ce correctif** : le filtre par `personId` (`event.creator_id = :personId OR
invitation.invitee_id = :personId`) existait déjà avant, sur le même principe — il filtre les
événements impliquant un tiers désigné, indépendamment du bug ci-dessus qui portait sur le
créateur/invité **implicite** (`ownerId` du chemin lui-même).

### `GET /calendars/:ownerId` — forme exacte de `activities` (chantier calendrier de disponibilités, point 3, gap comblé le 2026-08-18)

**Gap réel constaté et comblé** : cette route promettait déjà « créneaux de disponibilité +
activités » dans sa propre documentation depuis le tout début du chantier, mais ne les a **jamais**
portées jusqu'ici — un destinataire d'une proposition de créneau n'avait donc aucun moyen de la
découvrir dans l'application. **Décision explicite de l'utilisateur** : le créneau proposé apparaît
**directement dans le calendrier du destinataire**, pas dans une liste séparée.

**Requête**, inchangée :

```
GET /calendars/8d9a2c10-3b21-4b2b-9e9e-000000000001
Authorization: Bearer <jwt>
```

**Réponse `200`** — forme complète, `activities` en plus des champs déjà existants
(`id`, `ownerId`, `ownerRole`, `availabilitySlots`, `createdAt`, `updatedAt`, `paymentEntries?`) :

```json
{
  "id": "b6e0920a-32dd-4a89-b46e-e7a981000001",
  "ownerId": "8d9a2c10-3b21-4b2b-9e9e-000000000001",
  "ownerRole": "eleve",
  "availabilitySlots": [],
  "createdAt": "2026-08-01T09:00:00.000Z",
  "updatedAt": "2026-08-01T09:00:00.000Z",
  "activities": [
    {
      "id": "3fa1b6e0-1234-4b2b-9e9e-000000000099",
      "type": "cours",
      "status": "proposed",
      "startTime": "2026-09-10T14:00:00.000Z",
      "endTime": "2026-09-10T15:00:00.000Z",
      "creatorId": "47a5808b-66c7-41c9-92cd-7367d1cda003",
      "creatorName": "Camille Durand",
      "participantIds": ["8d9a2c10-3b21-4b2b-9e9e-000000000001"]
    }
  ]
}
```

| Champ (dans chaque élément d'`activities`) | Type | Remarque |
|---|---|---|
| `id` | `uuid` | Identifiant de l'activité (`ScheduledActivity`) |
| `type` | `string` | `cours` \| `reunion_pedagogique` \| `entretien_rp` \| `rappel` \| `autre` |
| `status` | `string` | `proposed` \| `confirmed` \| `cancelled` \| `completed` — seuls `proposed`/`confirmed` peuvent apparaître ici, voir périmètre ci-dessous |
| `startTime` / `endTime` | `string` (ISO 8601 UTC, millisecondes) | Mêmes conventions de sérialisation que `GET /calendars/:ownerId/busy` |
| `creatorId` | `uuid` | Identifiant technique du créateur — **usage interne uniquement, ne jamais l'afficher** (voir `creatorName`) |
| `creatorName` | `string \| null` | **Prénom Nom** du créateur, résolu par `calendar-service` auprès de `profile-service` (voir mécanisme ci-dessous). `null` uniquement si `profile-service` était injoignable au moment de la lecture (dégradation gracieuse) — **jamais** un repli sur `creatorId` |
| `participantIds` | `uuid[]` | Identifiants des participants — mêmes réserves d'affichage que `creatorId` |

**Périmètre.** Activités où `ownerId` est **créateur OU participant** (`participantIds` contient
son id), statut `proposed`/`confirmed` uniquement (`cancelled`/`completed` n'occupent plus le
calendrier, même filtre que `busyBlocks` de `GET /calendars/:ownerId/busy` — réutilise directement
`ActivitiesService.findActiveInRange`, aucune nouvelle requête n'a été inventée).

**Fenêtre de temps.** Aucune convention de fenêtre par défaut n'existait déjà dans ce service pour
cette route (vérifié le 2026-08-18) — **2 semaines passées + 4 semaines à venir**, calculées à
l'instant de la requête. Valeur proposée et assumée par `calendar-service`, pas un paramètre de
requête (contrairement à `from`/`to` sur `/busy`) : si une fenêtre différente s'avère nécessaire
plus tard (pagination, requête explicite), c'est une évolution distincte de ce contrat.

**Résolution de `creatorName` — jamais un UUID affiché (arbitrage du 2026-08-09).**
`calendar-service` résout les créateurs distincts de la fenêtre en **un seul appel groupé**
(`POST /internal/profiles/display-names` sur `profile-service` — même route interne que celle déjà
utilisée par `dashboard-notification-service` pour les notifications, réutilisée ici à l'identique
plutôt que d'inventer un nouveau mécanisme). Si `profile-service` est injoignable, `calendar-service`
**dégrade gracieusement** : `creatorName: null` pour les activités concernées, la lecture du
calendrier ne renvoie **jamais** `503` pour cette seule raison — poser une règle d'échec fermé sur
une route de lecture centrale, rechargée à chaque visite de page (règle du 2026-08-10, « Chargement
des données »), aurait rendu tout le calendrier indisponible à chaque panne transitoire de
`profile-service`. Ce choix diverge délibérément de la politique d'échec fermé appliquée aux
décisions d'**accès** (`GET /calendars/:ownerId/busy`, vérification de lien à la création d'une
activité) : ici il ne s'agit pas d'une décision de droit mais d'un enrichissement d'affichage.

### Événement publié à la création d'une proposition — `ActivityScheduled` (chantier calendrier de disponibilités, point 3, gap comblé le 2026-08-18)

**Aucun nouvel événement créé.** `ActivityScheduled` existait déjà (publié par `POST /activities`,
voir « Événements publiés » en fin de section) — son payload est **complété** d'un champ
`recipientId`, jamais dupliqué en un second événement.

```json
{
  "type": "ActivityScheduled",
  "occurredAt": "2026-09-01T10:00:00.000Z",
  "correlationId": null,
  "payload": {
    "activityId": "3fa1b6e0-1234-4b2b-9e9e-000000000099",
    "type": "cours",
    "creatorId": "47a5808b-66c7-41c9-92cd-7367d1cda003",
    "recipientId": "8d9a2c10-3b21-4b2b-9e9e-000000000001",
    "participantIds": ["8d9a2c10-3b21-4b2b-9e9e-000000000001"],
    "startTime": "2026-09-10T14:00:00.000Z"
  }
}
```

- `recipientId` : le **seul** destinataire quand la proposition est 1 proposeur → 1 destinataire
  (`cours`/FORMATEUR, `reunion_pedagogique`/AP, ou une `reunion_pedagogique` RP ciblant un seul
  formateur) — c'est-à-dire quand `participantIds` ne contient qu'un seul élément. `null` pour les
  usages multi-participants existants (RP à plusieurs formateurs, `entretien_rp`, `rappel`,
  `autre`) : il n'y a alors pas UN destinataire mais plusieurs, voir `participantIds`.
- Destiné à `dashboard-notification-service` (tâche séparée, non traitée ici) pour notifier
  « Proposition de cours ajoutée par {nom} » — la résolution du nom se fera côté consommateur, sur
  le même mécanisme que ci-dessus (`POST /internal/profiles/display-names`), jamais en stockant
  `recipientId`/`creatorId` seuls comme donnée d'affichage.

**Mécanisme de publication — réel depuis le 2026-08-18, ce n'était pas le cas avant.**
Corrige une affirmation antérieure de cette même documentation, plus bas dans cette section
(« `EventsService.publish` reste un stub... aucun bus, aucun abonné ») : c'était vrai jusqu'au
2026-08-18, ce ne l'est plus. `calendar-service` adopte désormais **le même mécanisme outbox +
flux Redis que `teacher-request-service`** (arbitrage du 2026-08-14, « Systeme de notifications
transversal », point 1 — « générique pour les autres flux ») : chaque appel à
`EventsService.publish()` écrit une ligne dans la table `domain_events` (nouvelle, migration
`1787070000000-AddDomainEventsOutbox`, schéma identique à celui de `teacher-request-service`), puis
`EventPublisher` la remet sur le **même** flux Redis `visiomath:events` (`XADD`, groupe de
consommateurs `dashboard-notification-service` déjà en place côté consommateur). Sans `REDIS_URL`
configurée, rien n'est perdu : les événements restent en attente dans `domain_events` et seront
publiés dès qu'un bus sera disponible — même garantie que `teacher-request-service`. Ce mécanisme
vaut pour les **treize** points d'émission déjà existants de ce service (`AvailabilityUpdated`,
`ActivityScheduled/Updated/Deleted/Confirmed/Declined`, `ReminderCreated`,
`CalendarEventCreated`, `InvitationAccepted/Declined`, `CancellationRequested`), pas seulement pour
`ActivityScheduled` — la signature de `EventsService.publish()` n'a pas changé, aucun appelant n'a
eu besoin d'être modifié.

### Visibilité busy/free — `GET /calendars/:ownerId/busy` (chantier calendrier de disponibilités, point 2)

Lit les créneaux **occupés/libres** d'un tiers, **jamais le contenu** (aucun id, titre, type ni
liste de participants) — pilotée par la relation métier réelle avec `profile-service`
(`GET /internal/relations/:viewerId/:targetId`), jamais par une simple liste de rôles codée en
dur.

**Requête.** Query obligatoire : `from`, `to` — instants **ISO 8601 avec fuseau** (ex.
`2026-09-10T00:00:00Z` ou `2026-09-10T00:00:00.000Z`), exactement le même format que
`startTime`/`endTime` sur les créneaux de disponibilité (point 1 de ce chantier). `from` est
inclusif, `to` est exclusif. `400` si l'un des deux n'est pas une date ISO valide, ou si
`to <= from`.

```
GET /calendars/8d9a2c10-3b21-4b2b-9e9e-000000000001/busy?from=2026-09-10T00:00:00Z&to=2026-09-17T00:00:00Z
Authorization: Bearer <jwt>
```

**Réponse `200`** — les instants `start`/`end` sont sérialisés en **ISO 8601 UTC avec
millisecondes** (`Date.prototype.toISOString()`, ex. `2026-09-10T09:00:00.000Z`), que la requête
les ait fournis avec ou sans millisecondes :

```json
{
  "ownerId": "8d9a2c10-3b21-4b2b-9e9e-000000000001",
  "from": "2026-09-10T00:00:00.000Z",
  "to": "2026-09-17T00:00:00.000Z",
  "availableWindows": [
    { "start": "2026-09-10T09:00:00.000Z", "end": "2026-09-10T11:00:00.000Z" }
  ],
  "unavailableBlocks": [
    { "start": "2026-09-11T09:00:00.000Z", "end": "2026-09-11T10:00:00.000Z" }
  ],
  "busyBlocks": [
    { "start": "2026-09-13T09:00:00.000Z", "end": "2026-09-13T10:00:00.000Z" }
  ]
}
```

- `availableWindows` / `unavailableBlocks` : projection des créneaux de disponibilité
  (`AvailabilitySlot`, `kind: available`/`unavailable`) sur la fenêtre `[from, to)`, récurrence
  hebdomadaire/bimensuelle incluse.
- `busyBlocks` : activités (`ScheduledActivity`) où le titulaire est créateur ou participant,
  statut `proposed`/`confirmed`, chevauchant `[from, to)`. **Jamais** d'`id`, de `title`, de
  `type` ni de `participantIds` — uniquement `start`/`end`.

**Contrôle d'accès** (`resolveCalendarBusyFreeAccess`, fonction pure, sur le modèle de
`profile-service/src/relations/pedagogical-access.policy.ts`) :

| Lecteur | Condition | Résultat |
|---|---|---|
| Titulaire (`viewerId === ownerId`) | — | `200`, accès complet |
| RP (`responsable_pedagogique`) | Aucune — sans condition de lien, que le titulaire soit élève ou formateur | `200` |
| AF, TI | — | `403` **même sans relation testée** : périmètre admin volontairement restreint au RP seul pour cette route (diverge de `ADMINISTRATOR_ROLES` RP+AF+TI utilisé ailleurs dans le projet — divergence assumée) |
| Titulaire **élève** | Lecteur = parent financeur (`FINANCE_OWNER_OF_STUDENT`) ou formateur actif de l'élève (`TEACHER_OF_STUDENT`) | `200` |
| Titulaire **formateur** | Lecteur = élève lié (`STUDENT_OF_TEACHER`), parent d'un élève de ce formateur (`FINANCE_OWNER_OF_STUDENT_OF_TEACHER`, relation indirecte), ou AP animant ce formateur (`ANIMATOR_OF_TEACHER`) | `200` |
| Tout le reste | — | `403` |

- `403` (pas `404`) en l'absence de lien : contrairement aux archives/statistiques pédagogiques
  d'un autre service (404 uniforme), il n'y a ici aucune ambiguïté d'existence à protéger — le
  calendrier d'un `ownerId` existe toujours.
- `503` si `profile-service` **ou** `identity-access-service` est injoignable ou hors délai (3s
  chacun) — échec fermé, jamais un accès accordé par défaut.
- **Bug corrigé au passage** : `ANIMATEUR_PEDAGOGIQUE` donnait jusqu'ici un accès intégral à
  n'importe quel calendrier via `GET /calendars/:ownerId` (voir ci-dessus) ; il passe désormais
  exclusivement par cette route, avec une vraie vérification de lien (`ANIMATOR_OF_TEACHER`).
- **Bug réel corrigé le 2026-08-18 (CAL-FB-004)**, trouvé en HTTP contre la pile réelle : le rôle
  du titulaire (`ownerRole`, nécessaire pour choisir entre les deux lignes du tableau ci-dessus)
  était lu depuis `Calendar.ownerRole`, colonne renseignée seulement à la création paresseuse de
  la ligne `Calendar` (premier appel à `GET /calendars/:ownerId`,
  `PUT /calendars/:ownerId/availability` ou `POST /calendars/:ownerId/availability-slots`). Un
  titulaire n'ayant **jamais** déclenché cette création voyait donc son rôle traité comme
  inconnu, et le repli défensif fermait l'accès à **tout le monde d'autre**, y compris à une
  relation active réelle et confirmée par `profile-service` (parent financeur, formateur actif,
  etc.) — seul le titulaire lui-même et le RP passaient encore. Corrigé en résolvant `ownerRole`
  auprès d'`identity-access-service` (`GET /internal/accounts/by-user-id/:userId`, unique
  propriétaire du rôle), rendant la décision indépendante de l'existence de la ligne `Calendar`.
  Un compte inconnu d'`identity-access-service` (`404`) reste traité comme un rôle inconnu, même
  repli fermé qu'avant.

### Activités planifiées — cours, réunions pédagogiques, entretiens, rappels

Ces routes existaient déjà côté code mais n'avaient **jamais été documentées** (constat du
2026-08-18, chantier calendrier de disponibilités, point 3) — décalage qui avait causé un `404`
front sur `apps/web/src/api/calendar.ts`, qui appelait à tort `/calendar` au lieu de `/activities`.
Section écrite ici pour la première fois, avec le contrat exact.

| Méthode | Chemin | Description | Auth | Rôles / Remarques |
|---|---|---|---|---|
| POST | /activities | Créer une activité planifiée (`cours`, `reunion_pedagogique`, `entretien_rp`, `rappel`, `autre`) — naît à `status: proposed` | 🔒 | `formateur`, `animateur_pedagogique`, `responsable_pedagogique`. Voir « Vérification de lien à la création » ci-dessous. |
| GET | /activities/:activityId | Lire une activité par id | 🔒 | Créateur, participant déclaré, ou rôle interne (RP, TI, AF). `403` sinon (IDOR), `404` si inconnue. |
| PUT | /activities/:activityId | Modifier une activité (titre, participants, horaires, statut, description…) | 🔒 | Créateur, RP ou TI uniquement (CAL-FB-001). `403` sinon, `404` si inconnue. |
| DELETE | /activities/:activityId | Supprimer une activité (suppression physique) | 🔒 | Créateur, RP ou TI uniquement — même politique que `PUT` (CAL-FB-001). `403` sinon, `404` si inconnue. `204` sans corps. Publie `ActivityDeleted`. |
| POST | /activities/:activityId/accept | Accepter une activité `proposed` → `confirmed` (chantier calendrier, point 3) | 🔒 | Seul le destinataire visé (présent dans `participantIds`) — le créateur ne peut pas accepter sa propre proposition. `409` si déjà traitée, `403` si l'appelant n'est pas le destinataire, `404` si inconnue. Publie `ActivityConfirmed`. |
| POST | /activities/:activityId/decline | Refuser une activité `proposed` → `cancelled` (chantier calendrier, point 3) | 🔒 | Mêmes règles que `accept` ci-dessus. Publie `ActivityDeclined`. |

Body `POST /activities` :

```json
{
  "title": "Cours de géométrie",
  "type": "cours",
  "participantIds": ["8d9a2c10-3b21-4b2b-9e9e-000000000001"],
  "startTime": "2026-09-10T14:00:00Z",
  "endTime": "2026-09-10T15:00:00Z",
  "description": "Révision du chapitre 3"
}
```

- `type` : `cours` · `reunion_pedagogique` · `entretien_rp` · `rappel` · `autre` (minuscules,
  exactement comme `AvailabilitySlot.kind`/`recurrence` — un enum envoyé en majuscules est
  rejeté en `400`, piège déjà rencontré au point 1 de ce chantier).
- `participantIds` : tableau d'UUID v4, **au moins un** élément (`400` si vide — CAL-FB-002).
  Voir « Vérification de lien » ci-dessous pour le cas où la taille exacte est imposée à 1.
- `startTime`/`endTime` : ISO 8601 avec fuseau (ex. `2026-09-10T14:00:00Z`), même format que les
  créneaux de disponibilité.
- `description` et `correlationId` sont optionnels.

Réponse `201` (`POST /activities`), `200` (`GET`/`PUT`), `201` (`accept`/`decline` — défaut
`@Post` de NestJS, comme `POST /events/:id/invitees/:userId/accept` ci-dessous) — forme identique
dans les quatre cas, c'est l'entité `ScheduledActivity` telle qu'enregistrée :

```json
{
  "id": "3fa1b6e0-...",
  "title": "Cours de géométrie",
  "type": "cours",
  "creatorId": "...",
  "creatorRole": "formateur",
  "participantIds": ["8d9a2c10-3b21-4b2b-9e9e-000000000001"],
  "startTime": "2026-09-10T14:00:00.000Z",
  "endTime": "2026-09-10T15:00:00.000Z",
  "status": "proposed",
  "description": "Révision du chapitre 3",
  "correlationId": null,
  "createdAt": "2026-09-01T10:00:00.000Z",
  "updatedAt": "2026-09-01T10:00:00.000Z"
}
```

`status` : `proposed` (valeur à la création) · `confirmed` (après `accept`) · `cancelled` (après
`decline`, ou toute autre annulation) · `completed` (hors du périmètre de ce chantier, non
atteignable par ces routes).

`POST /activities/:activityId/accept` et `.../decline` ne prennent **aucun corps** — seul le
`activityId` dans l'URL et le token du destinataire suffisent, exactement comme
`POST /events/:id/invitees/:userId/accept` ci-dessous.

`DELETE /activities/:activityId` ne prend **aucun corps** et répond `204` sans corps en cas de
succès — même forme que `DELETE /calendars/:ownerId/availability-slots/:slotId` ci-dessous.
Suppression physique de la ligne (pas d'append-only ici : une activité planifiée est une donnée
opérationnelle de type agenda, pas un enregistrement à valeur probante — même raisonnement que
pour la suppression d'un créneau de disponibilité).

#### Vérification de lien à la création — 1 proposeur → 1 destinataire (chantier calendrier, point 3)

Corrige un vrai trou de sécurité : jusqu'ici **aucun lien réel n'était vérifié** — un formateur
pouvait proposer un cours à n'importe quel élève. Portée volontairement limitée aux deux cas
suivants (les autres types/usages multi-participants existants — `entretien_rp`, `rappel`,
`autre`, ou une `reunion_pedagogique` créée par un RP à plusieurs formateurs — ne sont **pas**
concernés, ni par la contrainte de nombre ni par la vérification de lien) :

| Créateur | `type` | Contrainte sur `participantIds` | Lien exigé avec le destinataire | Sinon |
|---|---|---|---|---|
| `formateur` | `cours` | Exactement 1 élément | `TEACHER_OF_STUDENT` (le formateur enseigne à cet élève) | `400` (nombre) ou `403` (lien absent) |
| `animateur_pedagogique` | `reunion_pedagogique` | Exactement 1 élément | `ANIMATOR_OF_TEACHER` (l'AP anime ce formateur) | `400` (nombre) ou `403` (lien absent) |
| `responsable_pedagogique` | tout type | Aucune (peut cibler plusieurs formateurs, usage existant préservé) | Aucune — accès non conditionnel, comme partout ailleurs dans ce service | — |

Le lien est vérifié auprès de `profile-service`
(`GET /internal/relations/:viewerId/:targetId?viewerRole=...`), même client et même politique
d'échec fermé que `GET /calendars/:ownerId/busy` (point 2 de ce chantier) : `503` si
`profile-service` est injoignable ou hors délai (3s), jamais une création acceptée par défaut.

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

`CalendarEventCreated` · `CalendarEventDeleted` · `InvitationAccepted` · `InvitationDeclined` · `CancellationRequested` · `ReminderDue` · `AvailabilityUpdated` · `ActivityScheduled` · `ActivityUpdated` · `ActivityConfirmed` · `ActivityDeclined`

`ActivityConfirmed` (`accept`) et `ActivityDeclined` (`decline`) sont nouveaux (chantier
calendrier de disponibilités, point 3). Payload minimal : `{activityId, confirmedBy}` /
`{activityId, declinedBy}`.

**`CalendarEventDeleted` est nouveau (2026-08-20)** — publié par la route `DELETE
/calendars/:ownerId/events/:eventId` ajoutée le même jour (voir ci-dessus). Payload, sur le modèle
exact d'`ActivityDeleted` :

```json
{
  "type": "CalendarEventDeleted",
  "occurredAt": "2026-09-01T10:00:00.000Z",
  "correlationId": null,
  "payload": {
    "eventId": "3fa1b6e0-1234-4b2b-9e9e-000000000099",
    "ownerId": "47a5808b-66c7-41c9-92cd-7367d1cda003",
    "deletedBy": "47a5808b-66c7-41c9-92cd-7367d1cda003"
  }
}
```

**`CalendarEventCreated` — payload vérifié le 2026-08-20, hypothèse infirmée.** La demande initiale
supposait que ce payload ne portait peut-être pas de quoi notifier chaque invité. Vérification
faite sur le code réel (`CalendarEventsService.createEvent`) : ce n'est **pas** le cas, `inviteeIds`
y figure déjà, sans changement à apporter :

```json
{
  "type": "CalendarEventCreated",
  "occurredAt": "2026-09-01T10:00:00.000Z",
  "correlationId": null,
  "payload": {
    "eventId": "3fa1b6e0-1234-4b2b-9e9e-000000000099",
    "ownerId": "47a5808b-66c7-41c9-92cd-7367d1cda003",
    "title": "Cours de maths",
    "eventType": "cours",
    "creatorId": "47a5808b-66c7-41c9-92cd-7367d1cda003",
    "startTime": "2026-09-10T14:00:00.000Z",
    "inviteeIds": ["f841ccff-a112-4df8-9dc3-f875c995507d"]
  }
}
```

- `inviteeIds` : `[]` (jamais `undefined`) quand l'événement est créé sans `inviteeIds` dans le
  corps de la requête — voir `docs/routes.md`, tests de non-régression associés
  (`calendar-events.service.spec.ts`, describe `createEvent`).
- Suit exactement le même modèle que `ActivityScheduled`/`participantIds` : une liste d'`userId`,
  jamais de nom résolu ici — la résolution de nom pour l'affichage (« Cours ajouté par {nom} »)
  reste à la charge du consommateur (`dashboard-notification-service`, tâche séparée, non traitée
  ici), via `POST /internal/profiles/display-names` sur `profile-service`, comme documenté pour
  `ActivityScheduled` plus haut dans cette section.
- `startTime` (et non `startAt`) est une divergence **assumée et déjà documentée** (voir
  « Écart de doc corrigé le 2026-08-19 » plus haut) : la réponse HTTP porte `startAt`/`endAt`,
  le payload d'événement interne garde `startTime` — deux contrats distincts, pas un défaut à
  aligner ici.
- **`title` — défaut corrigé le 2026-08-20.** Ce champ était absent du payload alors que
  `dashboard-notification-service` le lisait déjà (`payload.title ?? null`, voir section
  dashboard-notification-service ci-dessous, notification `event_invitation_received`) :
  la notification reçue par un invité affichait donc toujours `metadata.title: null`, même
  pour un événement avec un vrai titre. `title` porte désormais la valeur réelle et persistée
  de l'événement (`createdEvent.title`, jamais `dto.title` brut) ; `null` reste la valeur
  correcte quand l'événement n'a pas de titre — le titre est réellement optionnel sur
  `CalendarEvent`, aucun titre par défaut n'est fabriqué côté serveur.

**Mise à jour du 2026-08-18 (gap comblé) : `EventsService.publish` n'est plus un stub.**
Jusqu'au 2026-08-18, `EventsService.publish` de ce service journalisait une ligne structurée et
rien d'autre (aucun bus, aucun abonné) — c'était vrai à la date où la phrase précédente a été
écrite, ce n'est plus le cas. Voir la section dédiée « Événement publié à la création d'une
proposition — `ActivityScheduled` » plus haut pour le mécanisme réel (outbox `domain_events` +
flux Redis `visiomath:events`, même mécanisme que `teacher-request-service`) et
`docs/architecture.md`, arbitrage du 2026-08-14 sur les notifications, pour le précédent déjà
traité côté `teacher-request-service`.

---

## video-session-service

Préfixe gateway canonique : `/api/v1/video-sessions` → contrôleur `/video-sessions` (alias legacy : `/api/v1/video` → `/video`)

> **Chantier calendrier-visio-livekit, point 4 (2026-08-19) — LiveKit auto-hébergé.**
> `VideoRoom` était jusqu'ici un simple stub (UUID généré localement, rien de réel
> derrière). Il porte désormais une vraie salle LiveKit (`livekit-server-sdk`,
> `RoomServiceClient`/`AccessToken`), et une nouvelle voie de création
> **automatique** existe : à la confirmation d'un créneau de cours
> (`ActivityConfirmed`, type `cours`), une salle est créée sans aucune action
> manuelle. Voir `docs/architecture.md` pour l'arbitrage d'exposition réseau de
> LiveKit (ports dédiés, hors `nginx-global` et hors `visiomath_gateway`) et le
> rapport de session `.claude/reports/video-session-service-2026-08-19.md` pour
> le détail complet (variables d'environnement, étapes manuelles de déploiement).
>
> **Suite directe, même jour — terminaison TLS.** Le front étant servi en HTTPS,
> un navigateur refuse une connexion WebSocket non chiffrée (`ws://`) depuis une
> page HTTPS (contenu mixte, bloqué en silence) : `LIVEKIT_PUBLIC_URL` doit donc
> être en `wss://`. `livekit-server` ne sait terminer du TLS que pour son relais
> TURN (`--turn-cert`/`--turn-key`), jamais pour son port de signalisation
> principal (7880) — vérifié contre l'image réelle `livekit/livekit-server:1.13.5`.
> Un nouveau conteneur dédié (`livekit-tls`, Caddy en reverse proxy TLS→HTTP
> local) termine donc le TLS avec un **certificat auto-signé de test**, décision
> assumée de l'utilisateur pour cette phase — voir
> `infra/livekit-tls/certs/README.md` et le rapport de session
> `.claude/reports/video-session-service-tls-2026-08-19.md`.

### Salles vidéo

| Méthode | Chemin | Description | Auth | Rôles autorisés |
|---|---|---|---|---|
| POST | /video/rooms | Créer une salle vidéo **réelle** (LiveKit) | 🔒 | formateur, RP, AP, TI |
| GET | /video/rooms/:id | Info d'une salle | 🔒 | Tout utilisateur authentifié |
| GET | /video/rooms/by-activity/:activityId | Résoudre la salle créée automatiquement pour une activité confirmée | 🔒 | Tout utilisateur authentifié (même politique que `GET /video/rooms/:id`) |
| GET | /video/rooms/:id/join | Rejoindre la salle (générer un token d'accès **LiveKit réel**) | 🔒 | élève, formateur, RP, AP, TI — parent_financeur refusé (VID-FB-001) |
| POST | /video/rooms/:id/attendance | Enregistrer la présence | 🔒 | élève, formateur, RP, AP, TI — parent_financeur refusé |
| POST | /video/rooms/:id/close | Clôturer la session | 🔒 | formateur, RP, AP, TI |

**`POST /video/rooms` — contenu inchangé côté contrat (`{calendarSessionId}` requis,
mêmes rôles), comportement changé.** Crée désormais une vraie salle LiveKit via
`RoomServiceClient.createRoom()` — `roomToken` porte le **nom réel** de la salle
LiveKit (avant : UUID local sans rien derrière). `503` si LiveKit est
injoignable (échec fermé, la ligne `VideoRoom` locale n'est jamais créée orpheline).

**`GET /video/rooms/:id/join` — changement de contrat (2026-08-19), à
répercuter côté front dans une tâche séparée.** Réponse **remplacée** :

- **Avant** (stub) : `200 {accessToken, roomToken, status}` — `accessToken` un
  UUID local sans signification, `joinUrl` sous-entendu par le front
  (`window.open(joinUrl)` dans `VideoJoinPage.tsx`).
- **Maintenant** : `200 {token, url}` — `token` est un vrai JWT LiveKit
  (`AccessToken` du SDK, identité = `userId` de l'appelant, `metadata` porte le
  rôle, grant `{roomJoin: true, room: <nom réel de la salle>}`) ; `url` est
  `LIVEKIT_PUBLIC_URL`, l'adresse que le **SDK client LiveKit** (navigateur)
  doit joindre **directement** — jamais via `api-gateway`, qui ne relaie pas le
  trafic WebRTC. Le front doit intégrer un composant vidéo (`token` + `url`)
  au lieu d'ouvrir un nouvel onglet — hors périmètre de cette session,
  volontairement laissé à la tâche front suivante.
- `400`/`401`/`403`/`404` inchangés. La transition `WAITING → ACTIVE` au premier
  join est inchangée ; elle ne se lit plus dans la réponse de `join` (qui ne
  porte plus `status`) mais via `GET /video/rooms/:id`.

> **Correctif 2026-08-19, même jour — UUID affiché sur les tuiles de
> participants.** Bug réel trouvé par un test Playwright contre la pile
> réelle (`.claude/reports/livekit-join-2026-08-19/livekit-06-teacher-sees-other-participant.png`),
> violation de « aucun UUID ne doit être lu ni affiché par un utilisateur »
> (docs/architecture.md, arbitrage 2026-08-09). `AccessToken` n'était construit
> qu'avec `identity` (le `userId` brut) ; `@livekit/components-react` affiche
> `name` s'il est renseigné, et retombe sur `identity` sinon — d'où l'UUID en
> clair sur les tuiles. **`{token, url}` ne change pas de forme**, seul le
> contenu du JWT change :
>
> - `identity` reste le `userId` brut (LiveKit en a besoin pour distinguer les
>   participants) — donnée technique interne, jamais affichée directement par
>   le SDK tant que `name` est renseigné.
> - `name` porte désormais le prénom + nom de l'appelant, résolu auprès de
>   `profile-service` via la route interne déjà existante
>   `GET /internal/profiles/:userId/display-name` (arbitrage 2026-08-12,
>   « Resolution des noms entre services » — contrat figé à `firstName`/
>   `lastName`, réutilisé tel quel, aucune nouvelle route ajoutée côté
>   `profile-service`).
> - **Dégradation gracieuse, jamais bloquante** : si `profile-service` est
>   injoignable, en timeout (3 s) ou renvoie une erreur, `resolveDisplayName`
>   retourne `null` et **aucun `name` n'est envoyé** à `AccessToken` — jamais
>   l'UUID en repli. Le SDK retombe alors sur `identity` côté affichage
>   (limite documentée du cas de panne, pas une régression du correctif). Même
>   politique que `creatorName` côté `calendar-service`.
> - Nouveau composant `ProfileClientService` (`src/profile/`), appelé par
>   `VideoSessionService.join()` juste avant `LiveKitService.createAccessToken`,
>   qui accepte désormais un 4ᵉ paramètre optionnel `name`. Nouvelle variable
>   d'environnement `PROFILE_SERVICE_URL` (`http://profile-service:3002`),
>   même convention que `archive-document-service`/`dashboard-notification-service`
>   (`X-Internal-Secret`, pas de `x-correlation-id` propagé pour l'instant —
>   aucun mécanisme de corrélation n'existait encore dans ce contrôleur,
>   hors périmètre de ce correctif ciblé).

**`GET /video/rooms/by-activity/:activityId`** (nouvelle route, 2026-08-19) —
permet au front de retrouver la salle liée à une activité de calendrier dont il
ne connaît que l'`activityId` (il n'a jamais l'id de la salle, créée côté
serveur sans action de l'utilisateur). `200` avec les mêmes champs que
`GET /video/rooms/:id` si une salle existe déjà pour cette activité · `404` si
l'activité n'a pas encore de salle (pas encore confirmée, pas de type `cours`,
ou événement pas encore consommé — voir « Événements consommés » ci-dessous).

**`VideoRoom` porte désormais deux champs distincts pour référencer une
activité externe, volontairement non fusionnés** (règle du projet : deux
données distinctes gardent chacune leur nom) :

| Champ | Nullable | Rempli par | Référence |
|---|---|---|---|
| `calendarSessionId` | Oui (depuis 2026-08-19) | `POST /video/rooms` (création manuelle) | **Aucune vérification d'entité** — UUID libre fourni par l'appelant, comme depuis toujours. N'a jamais été une vraie clé étrangère vers un `CalendarEvent`, malgré son nom |
| `activityId` | Oui, **unique** | Création automatique (`ActivityConfirmed`, voir ci-dessous) | `ScheduledActivity.id` de `calendar-service` (ressource « activities », chantier calendrier de disponibilités point 3) |

Un `VideoRoom` créé manuellement n'a jamais d'`activityId` ; un `VideoRoom` créé
automatiquement n'a jamais de `calendarSessionId`.

### Événements consommés — création automatique de salle (2026-08-19)

`video-session-service` s'abonne au flux Redis `visiomath:events` déjà utilisé
par `dashboard-notification-service` (même mécanisme générique outbox + `XADD`,
arbitrage du 2026-08-14), sous son propre groupe de consommateurs
`video-session-service`, avec déduplication par `eventId` (table
`processed_events`, un `eventId` déjà traité est ignoré sans effet de bord).

**Constat vérifié directement contre le flux Redis réel le 2026-08-19 (pas
supposé depuis la documentation) : `ActivityConfirmed` ne porte que
`{activityId, confirmedBy}`** — ni `type`, ni `participantIds`. Décider de créer
une salle pour un `cours` exige donc de connaître le `type` de l'activité, que
seul `ActivityScheduled` porte (`{type, creatorId, startTime, activityId,
recipientId, participantIds}`, également vérifié en direct). `calendar-service`
n'expose aujourd'hui **aucune route interne** pour relire une activité par id
après coup — ce n'est donc pas un choix mais une contrainte réelle.

**Solution retenue** : `video-session-service` projette `ActivityScheduled`
dans une table locale `activity_projections` (clé `activityId`), et la relit
quand `ActivityConfirmed` arrive pour ce même `activityId` :

- Projection introuvable (l'`ActivityScheduled` correspondant n'a jamais été
  observé) → aucune salle créée, avertissement journalisé. Limite documentée,
  pas un oubli.
- `type !== "cours"` → aucune salle créée (hors périmètre de ce chantier —
  `reunion_pedagogique`, `entretien_rp`, `rappel`, `autre` ne déclenchent rien).
- `type === "cours"` → `VideoRoom` créé automatiquement (vraie salle LiveKit,
  `activityId` renseigné, `calendarSessionId` laissé `null`), **idempotent par
  `activityId`** (colonne unique) : un `ActivityConfirmed` rejoué ne crée jamais
  une seconde salle ni un second appel LiveKit.

Le groupe de consommateurs démarre à l'ID `0` (relit tout l'historique du
flux), même choix que celui observé sur le groupe réel de
`dashboard-notification-service` (`entries-read` égal à la longueur totale du
flux). Sans `REDIS_URL` configurée, la création automatique de salle est
simplement **désactivée** (repli explicite, journalisé), la création manuelle
(`POST /video/rooms`) continue de fonctionner normalement.

### Enregistrements

> **Gap réel comblé le 2026-08-19, à l'occasion de ce chantier.** Les entités
> (`VideoRecording`, `RecordingComment`, `CourseSummary`), leurs DTO et leurs
> tests étaient déjà en place, mais **jamais enregistrés dans `AppModule`** ni
> **jamais câblés dans le contrôleur/service** — `synchronize` ne créait donc
> même pas les tables en développement, et `npm test` échouait à la compilation
> avant tout changement de cette session. Contrat inchangé par rapport à cette
> documentation (déjà correcte) ; c'est l'implémentation qui manquait, pas le
> contrat. Nouvelle migration `1787140000000-...` créant ces trois tables (elles
> n'existaient nulle part, pas même en base de dev).

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

Toujours journalisés en stdout uniquement (`EventsService.publishEvent`, stub
inchangé par ce chantier) — **pas** encore le mécanisme outbox + flux Redis
adopté par `calendar-service`/`teacher-request-service`. Ce service est
aujourd'hui **consommateur** du flux `visiomath:events` (voir ci-dessus),
jamais encore producteur dessus ; devenir producteur sur le même flux reste un
point ouvert, hors périmètre de ce chantier.

### Critères d'acceptation

- Un parent financeur ne peut pas ouvrir une visio ni accéder aux enregistrements (VID-FB-001)
- La vidéo est téléchargeable pendant 30 jours puis expire (VID-AC-001)
- Le résumé de cours reste dans les archives pédagogiques après expiration vidéo (`isPermanent: true`) (VID-AC-002)
- Le créneau de cours accepté ouvre automatiquement une salle LiveKit réelle, sans action manuelle (chantier calendrier-visio-livekit, point 4, 2026-08-19)

API interne (non exposée via nginx) : `GET /internal/video/*` — protégée par `X-Internal-Secret`. Inchangée par ce chantier (crée toujours une salle réelle via le même chemin que `POST /video/rooms`, avec les mêmes rôles/comportement LiveKit).

### Configuration LiveKit (variables d'environnement)

| Variable | Rôle |
|---|---|
| `LIVEKIT_API_URL` | Appel serveur-à-serveur (`RoomServiceClient`, `AccessToken`) — interne au réseau Docker, ex. `http://livekit:7880` |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Paire de clés API LiveKit. **Le secret doit faire au moins 32 caractères** (vérifié le 2026-08-19 contre une vraie instance LiveKit 1.13.5 : en dessous, `secret is too short` côté serveur et `401 invalid token, signature is invalid` côté client) |
| `LIVEKIT_PUBLIC_URL` | URL que le **SDK client LiveKit (navigateur)** joint en direct — jamais via `api-gateway`. Renvoyée telle quelle par `GET /video/rooms/:id/join`. **Doit être `wss://` depuis le 2026-08-19** (voir ci-dessous) |
| `REDIS_URL` | Flux `visiomath:events` — optionnelle côté code (repli explicite si absente), nécessaire pour la création automatique de salle |
| `PROFILE_SERVICE_URL` | **Nouvelle, correctif 2026-08-19.** Résolution du prénom/nom de l'appelant avant de générer le token LiveKit (`name`, voir encadré ci-dessus). Optionnelle côté code — repli explicite (`name` omis) si absente ou si `profile-service` est injoignable, jamais bloquante |

**Dépendance sortante (correctif 2026-08-19) :** `GET /video/rooms/:id/join` appelle
`GET /internal/profiles/:userId/display-name` de `profile-service` (variable
`PROFILE_SERVICE_URL`, en-tête `X-Internal-Secret`, délai 3 s) à **chaque join**.
Contrairement à `archive-document-service` (qui répond `503` si l'appel échoue),
ce service **n'échoue jamais** sur cette dépendance : un timeout ou une erreur
retombe sur `name` omis du token, jamais sur un blocage du join ni sur le
`userId` brut envoyé comme nom.

Détail complet (ports à ouvrir, IP publique à renseigner, secrets à changer en
production) : `.claude/reports/video-session-service-2026-08-19.md`.

### TLS pour le port LiveKit (2026-08-19)

Un navigateur ouvert depuis `https://claudevma.visioprof.fr` refuse une
connexion WebSocket non chiffrée (`ws://`) — contenu mixte, bloqué en silence
côté client, sans erreur exploitable. `LIVEKIT_PUBLIC_URL` doit donc être en
`wss://`, ce qui exige un certificat TLS sur le port LiveKit (7880), en dehors
de `nginx-global` (hors dépôt, ne gère que le domaine principal) et de
`visiomath_gateway` (le SDK client LiveKit se connecte en direct, jamais via
l'API HTTP classique).

**`livekit-server` ne termine pas nativement le TLS sur son port de
signalisation/API principal** — vérifié le 2026-08-19 contre l'image réelle
`livekit/livekit-server:1.13.5` (`help-verbose` ne liste `tls_cert_file`/
`tls_key_file` que sous `turn.*`, réservé au relais TURN). Un nouveau conteneur
dédié à LiveKit **uniquement** — `livekit-tls`, image `caddy:2-alpine`, simple
reverse proxy TLS → HTTP local vers `livekit:7880` — termine donc le TLS.
C'est désormais lui, et lui seul, qui publie le port `7880` sur l'hôte ; le
conteneur `livekit` ne publie plus que `7881` (repli TCP) et la plage UDP media
(déjà chiffrés au niveau média, non concernés par le blocage « contenu mixte »
qui ne vise que les WebSocket).

**Certificat auto-signé, explicitement pour une phase de test** (décision
utilisateur du 2026-08-19) : `infra/livekit-tls/certs/` — SAN IP
`193.108.54.226`, sans quoi les navigateurs modernes rejettent le certificat
même après acceptation manuelle. Justification complète du choix de committer
la clé privée avec le certificat (acceptable ici, jamais pour un vrai secret) :
`infra/livekit-tls/certs/README.md`.

⚠️ **Étape manuelle obligatoire côté navigateur, à faire par l'utilisateur** :
ouvrir une fois `https://193.108.54.226:7880/` directement dans le navigateur
et accepter l'avertissement de sécurité du certificat auto-signé, **avant** de
tenter de rejoindre une visio depuis l'application. Sans cette étape, la
connexion WebSocket échoue **en silence** côté client (le navigateur bloque la
connexion `wss://` vers un certificat jamais accepté) alors que tout fonctionne
côté serveur — piège d'expérience utilisateur réel pour cette phase de test,
détaillé dans `.claude/reports/video-session-service-tls-2026-08-19.md`.

Preuve de bout en bout (pas seulement que le conteneur démarre) : script Node
utilisant `livekit-server-sdk` + `ws`, connexion `wss://` réelle à travers le
proxy Caddy avec un token LiveKit valide, handshake HTTP `101`, `WebSocket`
`OPEN`, premier message protobuf du serveur reçu — voir le rapport de session
pour la sortie complète.

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

### Cahier de texte — refondu le 2026-08-20 (5 points demandés par l'utilisateur)

Préfixe gateway canonique : `/api/v1/pedagogical-logs` → contrôleur `/pedagogical-logs`
Préfixes complémentaires : `/api/v1/students` → `/students` · `/api/v1/logs` → `/logs` (legacy)

**Écart de doc préexistant, non corrigé par cette refonte** : `GET`/`POST /pedagogical-logs`,
`GET /pedagogical-logs/student/:studentId`, `GET /pedagogical-logs/session/:sessionId`,
`PUT`/`PATCH`/`DELETE /pedagogical-logs/:id` et `POST /memos` sont documentés ci-dessous depuis
longtemps mais **ne sont jamais montés côté contrôleur** (`PedagogicalLogController` n'expose que
`students/:studentId/pedagogical-log`, `logs/session/:sessionId`, `logs/:id`, `:id` — jamais
`pedagogical-logs` au pluriel) : tout appel réel y répond `404`. Confirmé par la suite e2e du
service elle-même (33 tests en échec avant et après cette session, tous et uniquement sur ces
routes). **Hors périmètre de la refonte du 2026-08-20** (ni demandé, ni touché) — signalé ici pour
que la prochaine session qui y touche ne le redécouvre pas de zéro. Les routes réellement montées
sont celles marquées ci-dessous sans cet avertissement.

**Bug réel corrigé le 2026-08-20 (testé contre `https://claudevma.visioprof.fr` par
l'orchestrateur, pas seulement en direct dans le conteneur)** : `api-gateway` ne proxy vers ce
service que les chemins sous les préfixes connus `/pedagogical-logs`, `/students`, `/logs` — un
chemin **nu** comme l'ancien `DELETE /:id` (ou `PATCH /:id`) n'est **structurellement jamais
routable depuis l'extérieur**, quel que soit son code HTTP en appel direct au service. Constat
initial : `DELETE https://claudevma.visioprof.fr/api/v1/{id}` → `405` (aucune route de ce service
sur ce chemin côté gateway) ; `DELETE https://claudevma.visioprof.fr/api/v1/logs/{id}` → `404`
(la route n'existait pas encore côté contrôleur). **`DELETE /logs/:id` est ajoutée**, mirror exact
de `DELETE /:id` (même garde, même logique déléguée à `PedagogicalLogService.remove()`) — c'est
elle qu'un appelant réel doit utiliser. `/:id` (PATCH et DELETE) est conservée comme **alias
historique non exposé par la gateway** : à ne jamais utiliser pour valider un comportement en
conditions réelles, seulement pour un appel direct au service.

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /pedagogical-logs *(⚠️ non montée, 404 réel — voir ci-dessus)* | — | 🔒 | — | — |
| POST | /pedagogical-logs *(⚠️ non montée, 404 réel — voir ci-dessus)* | — | 🔒 | — | — |
| PUT | /pedagogical-logs/:id *(⚠️ non montée, 404 réel)* | — | 🔒 | — | — |
| DELETE | /pedagogical-logs/:id *(⚠️ non montée, 404 réel)* | — | 🔒 | — | — |
| GET | /students/:studentId/pedagogical-log | Lire le cahier de texte d'un élève (filtré par rôle), trié de la plus récente à la plus ancienne | 🔒 | Tout rôle authentifié (accès filtré par visibilité) | `200 [PedagogicalLogPage]` — voir « Tri et filtrage » ci-dessous |
| POST | /students/:studentId/pedagogical-log | Ajouter une page liée à un élève précis | 🔒 | **formateur titulaire de la relation avec cet élève, uniquement** (RP retiré le 2026-08-20) | `201 {id, studentId, ...}` · `400` validation · `403` rôle non formateur, ou formateur non titulaire de la relation · `503` profile-service injoignable |
| POST | /students/:studentId/pedagogical-log/special-pages | Créer une page spéciale avec visibilité ciblée (RP uniquement) | 🔒 | responsable_pedagogique | `201 {id, ..., isSpecialPage: true, hiddenFromStudent, visibility: "special"}` · `403` réservé RP |
| GET | /logs/session/:sessionId | Logs d'une séance (filtrés par rôle) | 🔒 | Tout rôle authentifié | `200 [PedagogicalLogPage]` |
| GET | /logs/:id | Détail d'une page | 🔒 | Selon visibilité et rôle | `200 PedagogicalLogPage` · `403` visibilité bloquée · `404` introuvable |
| PATCH | /logs/:id | Modifier une page — **route réellement atteignable depuis l'extérieur** | 🔒 | Entrée normale : **formateur auteur, toujours titulaire de la relation, uniquement**. Page spéciale RP : auteur ou RP/TI (mécanisme inchangé) | `200 PedagogicalLogPage` · `403` non autorisé · `404` introuvable · `503` profile-service injoignable (entrée normale) |
| DELETE | /logs/:id | Supprimer une page — **route réellement atteignable depuis l'extérieur, ajoutée le 2026-08-20** (voir bug ci-dessus) | 🔒 | Entrée normale : **formateur auteur, toujours titulaire de la relation, uniquement** (correctif du 2026-08-20 — le RP a perdu ce droit qu'il avait jusqu'ici). Page spéciale RP : auteur ou RP (mécanisme inchangé) | `204` · `403` non autorisé · `404` introuvable · `503` profile-service injoignable (entrée normale) |
| PATCH | /:id *(⚠️ alias historique, jamais proxié par api-gateway — utiliser `PATCH /logs/:id`)* | Modifier une page | 🔒 | Mêmes règles que `PATCH /logs/:id` | idem |
| DELETE | /:id *(⚠️ alias historique, jamais proxié par api-gateway — utiliser `DELETE /logs/:id`)* | Supprimer une page | 🔒 | Mêmes règles que `DELETE /logs/:id` | idem |

Body `POST /students/:studentId/pedagogical-log` (refonte du 2026-08-20, point 2 et point 4) :
`{date?, sessionSummary?, homework?, visibility?, hiddenFromStudent?, linkedResources?, activityId?, sessionId?, skillsWorked?, difficulty?, rating?}`.
Même corps accepté par `PATCH /logs/:id`.

**Liens dans le texte.** Aucun champ structuré dédié : un lien s'insère directement dans
`sessionSummary`/`homework` via la syntaxe légère `[label](url)`, rendue en lien cliquable côté
front à l'affichage uniquement (arbitrage du 2026-08-26, docs/architecture.md "Syntaxe legere
unifiee pour le texte enrichi"). Le champ structuré `resourceLinks` livré le même jour a été
retiré aussitôt après, remplacé par cette approche — voir la note dans la section "Pièces
jointes" plus bas.
**`studentId` n'est plus un champ du corps** : le paramètre de chemin fait seul autorité (correctif
du bug réel où son absence renvoyait `400` — l'identifiant du chemin ne doit jamais être redemandé
dans le corps, convention déjà en place ailleurs dans le projet). Un `studentId` envoyé quand même
dans le corps est silencieusement ignoré par `ValidationPipe({whitelist:true})`, pas une régression :
il n'a jamais eu d'effet, il est juste retiré du contrat OpenAPI.

**`date` / `sessionSummary` / `homework` remplacent `content`** pour les entrées normales — les
trois sont **optionnels** côté serveur (le front pré-remplit `date` à la date du jour, mais le
serveur n'exige rien). `content` reste dans l'entité et son DTO de mise à jour (`UpdateLogDto`)
**uniquement pour les pages spéciales du RP** (`POST .../special-pages`), mécanisme explicitement
hors périmètre de cette refonte et non modifié.

Règles de visibilité (refonte du 2026-08-20, point 1) :
- `eleve_parent_formateur` : élève, parent, formateur, RP, AP, TI
- `parent_formateur` : **parent et formateur (pas l'élève)** — remplace `eleve_formateur`, dont la
  définition était erronée (elle excluait à tort le parent au lieu de l'élève). Une migration
  (`CahierDeTexteRefonte1787280000000`) renomme les lignes existantes en base.
- `formateur_rp` : formateur et RP uniquement
- `special` : pages spéciales — RP, formateur, parent (sauf si `hiddenFromStudent=true`, l'élève ne voit pas)

`hiddenFromStudent=true` : masque la page à l'élève — applicable aux pages spéciales parent/financeur (XML spec func 003).

**Écriture réservée au formateur (point 3, 2026-08-20 — POST/PATCH/DELETE).** Seul le formateur
titulaire de la relation `teacher_of_student` avec l'élève ciblé peut créer, modifier **ou
supprimer** une entrée normale du cahier de texte — vérifié à chaque action auprès de
`profile-service` (`GET /internal/relations/:viewerId/:targetId?viewerRole=formateur`), jamais en
cache : un formateur délié cesse d'agir immédiatement, y compris sur ses propres entrées passées.
Élève, parent et RP sont désormais strictement lecteurs sur ces entrées (le RP a perdu son droit
d'écriture — création, modification et **suppression** — qu'il avait jusqu'ici). **Précision du
2026-08-20** : la restriction couvre `DELETE` au même titre que `POST`/`PATCH` — l'énoncé d'origine
(« seul le formateur les rédige, les autres rôles lisent uniquement ») couvrait déjà toute
écriture, `DELETE` n'était initialement pas corrigé par erreur de lecture, pas par choix assumé.
Le mécanisme des pages spéciales RP (`isSpecialPage`, `POST .../special-pages`) est **hors
périmètre** et continue de fonctionner à l'identique pour les trois verbes (l'auteur ou un RP/TI —
RP seul pour `DELETE` — peut agir, sans vérification de relation) : le RP conserve la capacité de
retirer une page spéciale qu'il a lui-même créée, symétrique de son droit de création et
d'édition. `profile-service` injoignable → `503` (échec fermé), jamais un succès silencieux.

**Tri et filtrage — `GET /students/:studentId/pedagogical-log` (point 6).** La liste est triée de
la plus récente à la plus ancienne par `date` (date de séance) décroissante, les entrées sans
`date` en dernier, puis par `createdAt` décroissant à égalité. Deux paramètres de requête optionnels
permettent au front de se repositionner : `from` et `to` (ISO 8601, ex. `2026-08-01`), filtrant sur
`date`. `createdAt` reste exploitable pour un tri de repli côté front si besoin.

### Création automatique d'une entrée à la confirmation d'un cours (point 5, 2026-08-20)

`pedagogical-log-service` consomme désormais le flux Redis `visiomath:events` (même mécanisme
outbox + `XADD` que `teacher-request-service`/`calendar-service`, groupe de consommateurs
`pedagogical-log-service`, démarré à `0`, déduplication par `eventId` — table `processed_events`).
Précédent direct : `video-session-service` (création automatique de salle), même schéma de
projection locale.

- **`ActivityScheduled`** (`calendar-service`, `{activityId, type, creatorId, recipientId,
  participantIds, startTime}`) est projeté localement dans `activity_projections` (clé `activityId`).
- **`ActivityConfirmed`** (`{activityId, confirmedBy}`, ne porte pas le type) déclenche la relecture
  de la projection : si `type === "cours"` et `recipientId` non nul, une entrée de cahier de texte
  est créée automatiquement — **vide** (`date` = date de l'activité, `sessionSummary`/`homework`
  restent `null`), `studentId = recipientId`, `authorId = creatorId`, `authorRole = "formateur"`,
  `activityId` renseigné, `autoCreated = true`. Idempotent par `eventId` et, en défense
  supplémentaire, par `(activityId, autoCreated=true)`. Projection introuvable ou `type !== "cours"`
  → aucune entrée créée, avertissement journalisé (même limite documentée que
  `video-session-service` : aucune route de secours n'existe côté `calendar-service` pour relire
  une activité après coup).
- **Rappel quotidien (complément du point 5, `@Cron`, 06h00).** `EmptyEntryReminderService` repère
  les entrées `autoCreated=true` dont `sessionSummary` et `homework` sont encore `null` plus de 24h
  après `date`, et notifie le formateur **une seule fois** via `POST /internal/notify` sur
  `dashboard-notification-service` (`targetUserId`, `type: "pedagogical_log_entry_empty"`).
  `remindedAt` n'est posé qu'après un envoi réussi — un échec laisse l'entrée éligible au passage
  suivant (auto-guérison, pas de perte silencieuse). **Approximation assumée** : `ActivityScheduled`
  ne porte pas la date de fin de l'activité (seulement `startTime`), reprise ici comme `date` sur
  l'entrée — le rappel se déclenche donc 24h après la date de séance, pas 24h après l'heure de fin
  réelle du cours (non disponible dans le payload consommé).

Variables d'environnement introduites : `REDIS_URL` (optionnelle — sans elle, le consommateur reste
désactivé et journalise un avertissement au boot, aucune entrée automatique n'est créée),
`PROFILE_SERVICE_URL` et `INTERNAL_SECRET` (vérification de relation, point 3),
`DASHBOARD_NOTIFICATION_SERVICE_URL` (rappel quotidien).

### Mémo élève — assaini le 2026-08-27 (chantier feat/memo-formules)

Le mémo est un pense-bête personnel de l'élève (formules, trucs essentiels), organisé par
chapitres. Écriture (chapitres, items) réservée au titulaire élève. Lecture ouverte au titulaire
et aux tiers reliés (formateur, RP/AP coordinateur, parent financeur) ou administrateurs (RP/AF/TI).

**Constat de départ, corrigé par ce chantier — à ne pas redécouvrir.** Avant le 2026-08-27, deux
implémentations concurrentes coexistaient sous `src/memo/` : `ChapterController`
(`@Controller('memos/chapters')`, entités `Chapter`/`Memo`, **jamais enregistrées** dans
`TypeOrmModule.forRootAsync` de `app.module.ts`) répondait **`500` systématique**, et gagnait par
simple ordre de déclaration la collision de route avec le `MemoController` correct sur
`POST/GET memos/chapters(/:id)` — rendant ce dernier **inatteignable**. Les routes
`POST/GET/PUT/DELETE /memos/:id` documentées ici depuis longtemps **n'ont jamais existé** sur
aucun contrôleur (`CreateMemoDto`/`UpdateMemoDto` étaient du code mort). Et surtout : **aucune
migration ne créait `memo_chapters`/`memo_items`** — ces tables n'existaient en réalité que par un
`synchronize: true` accidentel d'un déploiement antérieur, jamais par une migration réelle.
`ChapterController`/`ChapterService`, les entités `Chapter`/`Memo` et les tables `chapters`/`memos`
sont **retirés** par ce chantier (`CreateMemoTables1789500000000`, migration `up`/`down` vérifiée
contre `visiomath_postgres` avec `synchronize: false`). Le contrat ci-dessous est le contrat réel.

**Rôles autorisés (colonne du tableau) — deux régimes distincts :**
- **Écriture** (`POST`/`PUT`/`DELETE`, toutes les routes chapitres/items) : `eleve` **titulaire**
  uniquement (`assertIsEleve` — rôle `eleve` **et** `callerId === studentId`). Tout autre rôle,
  ou un élève sur le mémo d'un autre élève → `403`.
- **Lecture** (`GET`, toutes les routes) : titulaire élève **ou** tiers relié — vérifié à chaque
  appel auprès de `profile-service`
  (`GET /internal/relations/:viewerId/:targetId?viewerRole=`), **jamais en cache**
  (`MemoService.assertCanRead`, même politique que le cahier de texte). Ouvre la lecture : relation
  `teacher_of_student` (formateur), `coordinator_of_student` (RP/AP coordinateur),
  `finance_owner_of_student` (parent financeur), ou `isAdministrator: true` (RP/AF/TI — accès
  complet). `profile-service` injoignable → `503` (échec fermé) ; relation absente → `403`. Le
  titulaire (`callerId === studentId`) est **toujours** autorisé, sans aucun appel réseau.

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /memos | Lister chapitres + items du mémo de l'élève connecté | 🔒 | eleve uniquement (route hardcodée sur `studentId = callerId`) | `200 [MemoChapter avec items]` · `403` tout autre rôle |
| GET | /memos/search?q= | Recherche textuelle dans les items du mémo de l'élève connecté | 🔒 | eleve uniquement | `200 [MemoItem]` · `400` q vide · `403` tout autre rôle |
| GET | /memos/students/:studentId | **Nouvelle route (B6)** — mémo consolidé d'un élève, même forme que `GET /memos`, pour un tiers relié ou le titulaire lui-même | 🔒 | eleve (soi-même), formateur/RP/AP/parent reliés, ou administrateur (RP/AF/TI) | `200 [MemoChapter avec items]` · `403` aucune relation · `503` profile-service injoignable |
| POST | /memos/chapters | Créer un chapitre | 🔒 | eleve titulaire uniquement | `201 MemoChapter` · `400` validation ou plafond de 50 chapitres atteint · `403` tout autre rôle |
| GET | /memos/chapters/:chapterId | Détail d'un chapitre et de ses items | 🔒 | eleve titulaire, ou tiers relié/administrateur en lecture | `200 MemoChapter avec items` · `403` aucune relation · `404` introuvable · `503` profile-service injoignable |
| PUT | /memos/chapters/:chapterId | Renommer un chapitre (mise à jour partielle : `title?`, `order?`) | 🔒 | eleve titulaire uniquement | `200 MemoChapter` · `400` validation · `403` tout autre rôle · `404` introuvable |
| DELETE | /memos/chapters/:chapterId | Supprimer un chapitre — les items sont supprimés en cascade (FK `ON DELETE CASCADE`), les fichiers image associés sont supprimés explicitement (la cascade ne nettoie que les lignes) | 🔒 | eleve titulaire uniquement | `204` · `403` tout autre rôle · `404` introuvable |
| POST | /memos/chapters/:chapterId/items | Ajouter un item **texte ou formule** (JSON, `{type: "text"\|"formula", content, title?, order?}`) — `type: "image"` refusé ici (`400`), voir la route multipart ci-dessous | 🔒 | eleve titulaire uniquement | `201 MemoItem` · `400` validation, `type` invalide, ou plafond de 200 items/chapitre atteint · `403` tout autre rôle · `404` chapitre introuvable |
| POST | /memos/chapters/:chapterId/items/image | **Nouvelle route** — ajouter un item **image** (multipart, champ `file`, `caption?` optionnel, `title?` optionnel, `order?` optionnel) | 🔒 | eleve titulaire uniquement | `201 MemoItem {type: "image", ...}` · `400` fichier absent, format non reconnu, SVG, ou plafond de 200 items/chapitre atteint · `403` tout autre rôle · `404` chapitre introuvable · `413` image trop volumineuse |
| GET | /memos/chapters/:chapterId/items/:itemId/image | **Nouvelle route** — télécharger les octets d'un item image | 🔒 | eleve titulaire, ou tiers relié/administrateur en lecture (revérifiée à chaque téléchargement) | `200` octets bruts, `Content-Type` = type détecté · `403` aucune relation · `404` chapitre/item introuvable, ou item non-image · `503` profile-service injoignable |
| PUT | /memos/chapters/:chapterId/items/:itemId | Modifier un item (`content?`, `title?`, `order?`) — le type n'est jamais modifiable ; pour un item image, `content` porte la légende, les octets ne se remplacent pas ici (supprimer puis recréer) | 🔒 | eleve titulaire uniquement | `200 MemoItem` · `400` validation · `403` tout autre rôle · `404` chapitre/item introuvable |
| DELETE | /memos/chapters/:chapterId/items/:itemId | Supprimer un item — supprime aussi le fichier image associé le cas échéant | 🔒 | eleve titulaire uniquement | `204` · `403` tout autre rôle · `404` chapitre/item introuvable |

**Les routes `POST/GET/PUT/DELETE /memos/:id` et `GET/POST /memos/chapters` (sans `:chapterId`)
documentées jusqu'ici sont retirées** : elles n'ont jamais existé côté contrôleur (les deux
premières) ou sont remplacées par la forme ci-dessus qui les rend inutiles (`GET /memos` fait déjà
office de liste des chapitres avec leurs items).

**Plafonds — jamais de liste non bornée (`src/memo/memo.constants.ts`) :**
- `content` (texte/formule) : 5000 caractères max (`MEMO_ITEM_CONTENT_MAX_LENGTH`, aligné sur les
  autres champs de texte long du projet — `description`/`message` de `teacher-request-service`).
- `title` de chapitre : 200 caractères max.
- `title` d'item (texte/formule/image, optionnel pour les trois) : 200 caractères max
  (`MEMO_ITEM_TITLE_MAX_LENGTH`, même plafond que le titre de chapitre — ajouté le 2026-08-27,
  voir « Correctif du 2026-08-27 » ci-dessous).
- 50 chapitres par élève max (`MEMO_MAX_CHAPTERS_PER_STUDENT`), 200 items par chapitre max
  (`MEMO_MAX_ITEMS_PER_CHAPTER`) — `400` explicite au-delà, jamais un tronquage silencieux.
- Image : **500 000 octets (500 Ko SI)** max (`MEMO_IMAGE_MAX_BYTES`), refus `413` structuré au
  format `{statusCode, error, code: "UPLOAD_FILE_TOO_LARGE", message, maxUploadBytes,
  receivedBytes}` — même style que le `413` des pièces jointes du cahier de texte. **Non
  paramétrable par le TI** pour l'instant (à la différence des pièces jointes du cahier de texte,
  arbitrage du 2026-08-26) — ce chantier n'a pas demandé de réglage TI pour le Mémo.

**Images — stockage sur fichier séparé, jamais en base64.** Type détecté sur les **octets réels**
(jamais l'extension ni le `Content-Type` client, réutilise `detectAttachmentMimeType` du cahier de
texte), liste blanche stricte **JPEG/PNG/WebP/GIF uniquement** (plus étroite que celle des pièces
jointes du cahier de texte, qui accepte aussi PDF/Office/texte) — **SVG explicitement refusé**
(`400`, document XML exécutable). Stockage sur un volume Docker nommé dédié
`pedagogical_log_memo_images` (`PEDAGOGICAL_LOG_MEMO_IMAGE_PATH`), **distinct** de
`pedagogical_log_media` (pièces jointes du cahier de texte) — deux fonctionnalités du même
service, deux cycles de vie séparés (une image de mémo se supprime avec son item, jamais liée au
cycle de vie d'une entrée de cahier de texte). Nom de fichier stocké généré côté serveur (UUID),
jamais dérivé du nom client. **Non couvert par le dump Postgres, à ajouter à la routine de
sauvegarde** (même rappel que `pedagogical_log_media`).

**Forme d'un `MemoItem`** : `{id, chapterId, type: "text"|"formula"|"image", content, title,
order, createdAt, updatedAt}` pour `text`/`formula` (`content` toujours requis, `title` toujours
optionnel — `null` si absent) ; pour `image` :
`{..., type: "image", content: <légende ou null>, title: <titre ou null>,
imageOriginalFilename, imageStoredFilename, imageMimeType, imageSizeBytes}` (`content` optionnel —
légende, jamais les octets de l'image elle-même, servis par la route de téléchargement dédiée
ci-dessus).

**Correctif du 2026-08-27 : `title` d'item, régression signalée par l'utilisateur.** L'ancien
modèle plat `Memo` (avant l'assainissement du même jour) portait un `title` optionnel, mais la
migration `CreateMemoTables1789500000000` ne l'a jamais repris sur `memo_items` — oubli dans la
spécification du plan de chantier, pas une erreur d'exécution. Un `title` envoyé à la création
était donc silencieusement absorbé sans effet (`ValidationPipe({whitelist:true})` sans
`forbidNonWhitelisted`, et le DTO ne portait aucune propriété `title`). Corrigé par
`AddTitleToMemoItems1789600000000` (colonne `title` varchar nullable sur `memo_items`) et par
l'ajout de `title?` sur `CreateMemoItemDto`/`CreateMemoImageItemDto`/`UpdateMemoItemDto`
(`@IsOptional`, `@MaxLength(MEMO_ITEM_TITLE_MAX_LENGTH)`). **Le réglage global `whitelist: true`
sans `forbidNonWhitelisted` reste inchangé** (`main.ts`, appliqué à tout le service, pas seulement
au mémo) : un champ non prévu par un DTO continue d'être silencieusement ignoré ailleurs dans ce
service — point relevé mais non corrigé ici (portée limitée à `src/memo/` pour ce chantier),
aucun autre champ manquant identifié sur les routes chapitres/items du mémo au passage.

### Carnet personnel — généralisé à tout rôle le 2026-08-27, notes rapides immuables depuis le même jour

Réf. `docs/architecture.md` > "Generalisation du carnet personnel a d'autres roles que l'eleve" et
"Specification fonctionnelle reelle du carnet personnel — notes rapides immuables". Ce n'est PAS
une extension du carnet élève à d'autres rôles : c'est le MÊME mécanisme répliqué par titulaire.
Et ce ne sont PAS des notes éditables : ce sont des **pensées instantanées**, horodatées
automatiquement à la création (`createdAt`, seul horodatage — aucun champ de date n'est ni saisi
ni modifiable par l'utilisateur), **immuables** une fois écrites — on les supprime et on les
réécrit si besoin, on ne les édite jamais — et retrouvées **par recherche**, pas par simple
défilement d'une liste brute.

**Changement observable côté contrat HTTP** par rapport à l'ancienne route `/students/:studentId/notebook` :

- Chemin : `/students/:studentId/notebook` → `/pedagogical-logs/notebook` (préfixe déjà proxié
  par api-gateway, aucun changement côté gateway nécessaire — le nouveau préfixe top-level
  `notebook/` a été délibérément écarté pour ne pas reproduire le bug documenté plus haut dans ce
  fichier : un préfixe non déclaré côté gateway est structurellement injoignable).
- Plus de paramètre de chemin désignant un titulaire : l'appelant lit/écrit toujours SON PROPRE
  carnet, dérivé du seul JWT (`req.user.id`). Il n'existe donc plus d'URL pouvant désigner le
  carnet d'un tiers.
- Champ renvoyé `studentId` → `ownerId`.
- Tout rôle authentifié est accepté (plus de `@Roles(ELEVE)` sur le contrôleur) ; l'ancien accès
  spécial TI "incident" est **retiré**, sans aucune exception résiduelle.
- **`PATCH /pedagogical-logs/notebook/:id` est RETIRÉE** (livrée par la généralisation du
  2026-08-27, retirée le même jour) : une pensée instantanée ne se corrige pas.
- **`GET /pedagogical-logs/notebook` accepte désormais des paramètres de requête optionnels et
  combinables** pour rechercher dans le carnet : `from`/`to` (plage de dates sur `createdAt`, ISO
  8601 ; une date précise s'exprime en passant la même valeur aux deux bornes) et `q` (recherche
  texte libre, insensible à la casse, sur `content`). Sans filtre, comportement inchangé : toutes
  les entrées du titulaire sont renvoyées.

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| POST | /pedagogical-logs/notebook | Ajouter une entrée dans MON carnet | 🔒 | tout rôle authentifié | `201 {id, ownerId, ...}` · `400` validation |
| GET | /pedagogical-logs/notebook | Lister (ou rechercher) MES entrées — query params optionnels `from?`, `to?`, `q?` | 🔒 | tout rôle authentifié | `200 [NotebookEntry]` |
| GET | /pedagogical-logs/notebook/owners/:ownerId | **Nouvelle route (2026-08-28)** — lire (ou rechercher) le carnet d'un TIERS, en lecture seule, mêmes query params `from?`/`to?`/`q?` que ci-dessus. Voir « Accès administratif et parental » ci-dessous | 🔒 | parent_financeur, responsable_pedagogique, technicien_informatique, administrateur_financier (piloté ensuite par le réglage TI, voir ci-dessous) | `200 [NotebookEntry]` · `403` rôle structurellement jamais éligible (eleve, formateur, animateur_pedagogique) · `404` réglage désactivé pour ce rôle, ou relation parent-élève absente/rompue (indiscernable d'un carnet vide) · `503` profile-service injoignable (axe parental uniquement) |
| GET | /pedagogical-logs/notebook/:id | Détail d'une de mes entrées | 🔒 | tout rôle authentifié (titulaire de l'entrée) | `200 NotebookEntry` · `403` non titulaire · `404` introuvable |
| DELETE | /pedagogical-logs/notebook/:id | Supprimer une de mes entrées | 🔒 | titulaire de l'entrée uniquement | `204` · `403` · `404` |

Écriture (création, suppression) : aucune exception, y compris administrative — ni une relation
métier (parent, formateur, AP, RP) ni un rôle administratif (RP, AF, TI) n'ouvre de droit
d'ÉCRITURE sur le carnet d'un tiers. Testé explicitement en e2e pour chaque rôle, y compris
RP/TI/AF (`test/e2e/notebook.e2e-spec.ts`).

#### Accès administratif et parental — arbitrage du 2026-08-28, LECTURE SEULE, désactivé par défaut

Réf. `docs/architecture.md` > "Acces administratif et parental au carnet personnel — parametrable
par le TI, defaut ferme". **Révise** le paragraphe ci-dessus sur l'exception totale : le carnet
personnel n'est plus une exception totale et définitive en lecture, mais reste une exception
totale en écriture — créer/supprimer une entrée reste réservé au seul titulaire dans tous les cas,
même quand l'accès administratif ou parental est activé.

Deux axes indépendants, tous deux gérés par `pedagogical-log-service`, contrôlés à chaque appel
(jamais en cache) :
- **Administratif**, curseur hiérarchique `adminAccess` : `none` (défaut, comportement inchangé)
  < `rp` (ouvre la lecture de TOUS les carnets à `responsable_pedagogique`) < `all_admins` (ouvre
  en plus à `administrateur_financier` et `technicien_informatique`).
- **Parental**, booléen indépendant `parentAccessToOwnChild` (défaut `false`) : ouvre au parent
  financeur la lecture du carnet du **seul élève auquel il est activement rattaché** — relation
  `finance_owner_of_student` vérifiée à chaque lecture auprès de `profile-service`
  (`GET /internal/relations/:viewerId/:targetId?viewerRole=parent_financeur`), jamais en cache.

Le titulaire lisant son propre carnet via `GET .../notebook/owners/:ownerId` reste toujours
autorisé, sans aucun appel réseau, quel que soit le réglage (repli sur le comportement normal).

**Réglages TI, sur le modèle déjà établi pour les pièces jointes** — table singleton distincte de
`pedagogical_log_settings` :

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /pedagogical-logs/settings/notebook-access | Lire les réglages courants d'accès au carnet personnel d'un tiers | 🔒 | tout compte authentifié | `200 {id, adminAccess, parentAccessToOwnChild, updatedAt}` · `401` |
| PATCH | /pedagogical-logs/settings/notebook-access | Modifier les réglages (mise à jour partielle) | 🔒 | technicien_informatique uniquement | `200` (même forme que le GET) · `400` valeur hors énumération pour `adminAccess` · `401` · `403` réservé au TI |

Testé explicitement en e2e (`test/e2e/pedagogical-log.e2e-spec.ts` pour les réglages,
`test/e2e/notebook.e2e-spec.ts` pour la route de lecture tierce elle-même, y compris les deux axes
et le repli 503 côté parent en environnement sans `profile-service`).

### Pièces jointes — arbitrage du 2026-08-26

Réf. `docs/architecture.md` > "Liens et pièces jointes sur une entrée de cahier de texte, et
paramètres système associés" (nouvelle entité `PedagogicalLogAttachment`).

**Le lien externe libre n'est pas un champ structuré.** Un premier champ `resourceLinks`
(`[{label, url}]`, porté directement par `PedagogicalLogPage`) avait été livré le même jour, puis
retiré aussitôt après un test utilisateur réel de la PR : le lien doit s'insérer **dans** le
texte de `sessionSummary`/`homework` via la syntaxe légère `[label](url)`, rendue côté front à
l'affichage — pas dans une liste séparée. Voir « Liens dans le texte » ci-dessus et l'arbitrage
"Syntaxe legere unifiee pour le texte enrichi" dans `docs/architecture.md`. `linkedResources`
(déjà présent, non documenté avant ce chantier) reste inchangé : il exige `{id: UUID, type:
string}` et **jette silencieusement tout `url`** — c'est une référence interne vers une ressource
future de `content-catalog-service` (phase 3), non concernée par ce qui précède.

**Pièces jointes — nouvelles routes, sous le préfixe `/logs` déjà proxié par api-gateway.**

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| POST | /logs/:id/attachments | Ajouter une pièce jointe (multipart, champ `file`, un seul fichier) | 🔒 | **formateur auteur, toujours titulaire de la relation, uniquement** | `201 {id, logEntryId, originalFilename, storedFilename, mimeType, sizeBytes, uploadedBy, createdAt}` · `400` fichier absent, format non reconnu, ou SVG · `401` · `403` rôle non autorisé, non auteur, ou pièces jointes désactivées par le TI · `404` entrée introuvable · `413` fichier ou budget total dépassé (corps structuré, voir ci-dessous) · `503` profile-service injoignable |
| GET | /logs/:id/attachments | Lister les pièces jointes d'une entrée | 🔒 | mêmes droits que l'entrée elle-même (filtrage par `visibility`) | `200 [PedagogicalLogAttachment]` · `401` · `403` visibilité non autorisée · `404` entrée introuvable |
| GET | /logs/:id/attachments/:attachmentId | Télécharger les octets d'une pièce jointe | 🔒 | mêmes droits que l'entrée elle-même — **revérifiés à chaque téléchargement**, ne fait jamais confiance à la seule présence de `attachmentId` dans l'URL | `200` octets bruts, `Content-Type` = type détecté, `Content-Disposition: attachment` · `401` · `403` visibilité non autorisée sur l'entrée · `404` entrée ou pièce jointe introuvable |
| DELETE | /logs/:id/attachments/:attachmentId | Supprimer une pièce jointe | 🔒 | **formateur auteur, toujours titulaire de la relation, uniquement** | `204` · `401` · `403` non autorisé · `404` entrée ou pièce jointe introuvable · `503` profile-service injoignable |

**Autorisation d'écriture** : déléguée à `PedagogicalLogService.getEntryForWrite`, **même régime**
que `PATCH /logs/:id` sur une entrée normale (formateur auteur + relation `teacher_of_student`
vérifiée à chaque appel, jamais en cache). Une page spéciale RP n'est **pas** concernée par les
pièces jointes : seul le rôle `formateur` peut appeler `POST`/`DELETE` (garde de rôle au niveau du
contrôleur), il n'y a pas de carve-out RP même sur une page spéciale — différence assumée avec
`sessionSummary`/`homework`, qui restent éditables par le RP sur ses propres pages spéciales.

**Liste blanche de types acceptés** (détection sur les **octets réels**, jamais l'extension ni le
`Content-Type` client) : PDF, images (JPEG/PNG/WebP/GIF), DOCX/XLSX/PPTX (Office moderne, détectés
individuellement), DOC/XLS/PPT (détectés génériquement comme `application/x-cfb` — la signature
binaire seule ne permet pas de distinguer lequel des trois formats hérités il s'agit), texte/CSV.
**SVG explicitement refusé** (`400`, document XML exécutable), même s'il est précédé d'une
déclaration `<?xml ...?>` — jamais confondu avec du texte inoffensif. Pas de re-encodage
systématique (impossible pour un PDF/DOCX) : la protection vient de la détection + liste blanche.

**Stockage** : volume Docker nommé dédié `pedagogical_log_media` (`PEDAGOGICAL_LOG_MEDIA_PATH`),
jamais le volume `media_data` de `profile-service`. Nom de fichier stocké généré côté serveur
(UUID), jamais dérivé du nom client. **Non couvert par le dump Postgres, à ajouter à la routine de
sauvegarde.**

**Plafonds — deux niveaux, tous deux paramétrables par le TI** (jamais codés en dur côté front) :
par fichier et total par entrée. Par défaut **100 000 octets (100 Ko SI) par fichier**,
**5 000 000 octets (5 Mo SI) par entrée**. Vérifiés **après** lecture complète du fichier par
multer (pas de refus en streaming ici, contrairement à l'avatar de `profile-service` : le plafond
est réglable en base par le TI, donc pas connu au moment où l'intercepteur multer est configuré) —
aux valeurs par défaut, un envoi n'approche jamais les plafonds réseau (`nginx-global` 1 Mio non
déclaré, `api-gateway` 10 Mio déclaré).

Corps de la réponse `413` — même style que le `413` de `profile-service` pour l'avatar :

```json
{
  "statusCode": 413,
  "error": "Payload Too Large",
  "code": "UPLOAD_FILE_TOO_LARGE",
  "message": "Uploaded file exceeds the maximum allowed size",
  "maxUploadBytes": 100000,
  "receivedBytes": 145000,
  "requestBodyBytes": null
}
```

`code` vaut `UPLOAD_FILE_TOO_LARGE` (fichier seul trop lourd) ou `UPLOAD_TOTAL_SIZE_EXCEEDED`
(budget total de l'entrée dépassé une fois ce fichier ajouté) — deux causes distinctes, deux codes
distincts. `requestBodyBytes` est toujours `null` ici (pas d'interception en streaming à ce niveau,
contrairement à l'avatar).

**Réglages système** — sous le préfixe `/pedagogical-logs`, déjà proxié par api-gateway :

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /pedagogical-logs/settings/attachments | Lire les réglages courants des pièces jointes | 🔒 | tout compte authentifié | `200 {id, attachmentsEnabled, maxFileBytes, maxTotalBytesPerEntry, updatedAt}` · `401` |
| PATCH | /pedagogical-logs/settings/attachments | Modifier les réglages (mise à jour partielle) | 🔒 | technicien_informatique uniquement | `200` (même forme que le GET) · `400` plafond par fichier supérieur au plafond total, ou validation · `401` · `403` réservé au TI |

Interrupteur `attachmentsEnabled` (défaut `true`) : quand `false`, `POST /logs/:id/attachments`
refuse explicitement (`403`), jamais un `201` qui ignorerait le fichier envoyé. Ne bloque pas la
lecture ni la suppression d'une pièce jointe déjà existante. Lecture ouverte à tout compte
authentifié (le formateur doit pouvoir lire le plafond avant d'afficher le bouton "Joindre un
fichier", même discipline que `GET /profiles/avatar/constraints`).

`profile-service` reste propriétaire du plafond de la photo de profil (domaine séparé) —
`pedagogical-log-service` n'est propriétaire que de ses propres réglages de pièces jointes.

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
> Types traités, et destinataire(s) : `TeacherRequestCreated` → rôle RP **et** chaque parent
> financeur actif de l'élève demandeur (résolus via `GET /internal/relations/finance-owners/:studentId`
> sur profile-service, même helper que `TeacherAssigned` ci-dessous — correctif du 2026-08-18) ·
> `TeacherProposalSent` →
> le formateur sollicité · `TeacherProposalAccepted`/`TeacherProposalDeclined` → rôle RP ·
> `TeacherProposalNotSelected`/`TeacherProposalExpired` → le formateur concerné ·
> `TeacherAssigned`/`MainTeacherAssigned` (legacy) → le formateur choisi, l'élève, et chaque parent
> financeur (résolus via `GET /internal/relations/finance-owners/:studentId` sur profile-service)
> · `TeacherRequestStatusUpdated` → l'élève et ses parents financeurs · `ActivityScheduled` (publié
> par calendar-service pour **toute** création d'activité) → **le seul `payload.recipientId`
> quand il est non-`null`** (cas 1 proposeur -> 1 destinataire, `cours` typiquement, mais aussi
> `reunion_pedagogique` ciblant un seul destinataire) ; quand `recipientId` est `null` (tout usage
> multi-participants : RP à plusieurs formateurs, `entretien_rp`, `rappel`, `autre`, réunions à
> plusieurs), **aucune notification** — l'entrée est acquittée sans effet, ce n'est pas un type
> non reconnu (arbitrage du 2026-08-19, chantier « calendrier de disponibilités lié à la visio »,
> point 3) · `CalendarEventCreated` (publié par calendar-service pour **toute** création
> d'événement de calendrier) → **un destinataire par élément de `payload.inviteeIds`** (tableau,
> jamais `undefined`, `[]` si aucun invité — à la différence d'`ActivityScheduled`/`recipientId`
> ci-dessus qui ne porte qu'un seul destinataire) ; `inviteeIds` vide → aucune notification,
> entrée acquittée sans effet (2026-08-20, correctif d'un bug réel signalé par un utilisateur en
> conditions réelles) · `TeacherRequestClosed` et
> `TeacherRequestDeleted` → aucune notification. Tout `eventName` non reconnu est journalisé en
> avertissement puis acquitté sans effet — un type inconnu ne doit jamais bloquer le flux.
>
> Avant de créer une notification, les noms sont résolus via `GET /internal/profiles/:userId/display-name`
> / `POST /internal/profiles/display-names` sur profile-service (jamais d'UUID stocké comme donnée
> d'affichage) et stockés dans `metadata`. **Si la résolution de nom ou des parents financeurs
> échoue, l'entrée du flux n'est pas acquittée** (retry via XAUTOCLAIM) plutôt que de publier une
> notification dégradée — voir `EventProcessorService`.
>
> **`ActivityScheduled` → `type: course_slot_proposed`** (nouveau, 2026-08-19). `title`/`message`
> restent `null` comme pour tous les types issus de ce consommateur ; le contenu affichable est
> entièrement porté par `metadata: {proposerName, activityId, activityType, startTime}` —
> `proposerName` est le nom résolu de `payload.creatorId` (jamais d'UUID), `activityType` reprend
> `payload.type` (`cours`/`reunion_pedagogique`), `startTime` est l'horodatage ISO de l'activité.
> Libellé français prévu côté front (`notificationLabels.ts`, non traité par cette session) :
> « Proposition de cours ajoutée par {proposerName} ».
>
> **`CalendarEventCreated` → `type: event_invitation_received`** (nouveau, 2026-08-20). `title`/
> `message` restent `null` comme pour tous les types issus de ce consommateur ; le contenu
> affichable est entièrement porté par `metadata: {creatorName, eventId, eventType, title,
> startAt}` — `creatorName` est le nom résolu de `payload.creatorId` (jamais d'UUID, via
> `POST /internal/profiles/display-names`), `eventId`/`startAt` sont l'identifiant et
> l'horodatage ISO de l'événement de calendrier (pour un futur lien profond, `startAt` reprend
> `payload.startTime` — nom aligné sur la réponse HTTP de calendar-service, pas sur son payload
> d'événement interne), `eventType` reprend `payload.eventType` (`cours`/`rappel`/…), `title`
> peut être `null` (le titre est réellement optionnel sur `CalendarEvent` depuis le correctif du
> même chantier, voir plus haut).
>
> **Libellé révisé le 2026-08-20 (même jour, demande utilisateur) : le titre n'est plus repris.**
> Une première version affichait le titre saisi par le créateur quand il existait ; l'utilisateur a
> demandé à la place le **type d'événement** et **l'heure**, jamais le titre. Libellé réel
> (`notificationLabels.ts`) : « {creatorName} vous a invité à un événement « {type traduit} » le
> {date+heure formatées} » — chaque partie (type, date/heure) est omise si l'information est
> absente côté `metadata`, sans jamais réintroduire le titre. Repli neutre si ni `creatorName`, ni
> `eventType`, ni `startAt` ne sont connus : « Quelqu'un vous a invité à un événement ».
>
> **Défaut corrigé le 2026-08-20 (calendar-service).** Vérifié le 2026-08-20 directement sur le
> flux Redis réel (`XREVRANGE`) : le payload publié par `CalendarEventsService.createEvent` ne
> portait jamais la clé `title` — `dashboard-notification-service` lisait déjà
> `payload.title ?? null` côté consommateur (rien à corriger ici), mais recevait donc toujours
> `null`, même pour un événement avec un vrai titre. `CalendarEventCreated` porte désormais la
> valeur réelle et persistée de l'événement (voir section calendar-service ci-dessus, paragraphe
> « `title` — défaut corrigé le 2026-08-20 »).

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

---

## content-catalog-service

Swagger complet exposé sur `/api/docs` (routes publiques uniquement — les routes `/internal/*`
sont exclues via `@ApiExcludeController()`). Le tableau ci-dessous couvre les routes Quizz
(2026-08-28), Exercices (2026-08-29), Évaluations (2026-09-01) et Tutoriels (2026-09-03) ; voir
`docs/services/content-catalog-service.md` pour l'historique détaillé des chantiers et le contrat
générique de validation (`POST /validations/:type/:id/*`, partagé par les 4 types de contenu).

### Quizz

Arbitrage de répartition avec `learning-activity-service` : `docs/architecture.md`,
"Fonctionnalite Quizz" (2026-08-28). `content-catalog-service` porte la création, la définition,
la solution, le barème et la validation d'un quizz ; `learning-activity-service` porte
l'inscription, le passage et l'historique des tentatives.

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /quizzes | Rechercher les quizz visibles par l'appelant, filtrables par `tag` et `keyword` (titre), paginés (`page`, `limit`). Un quizz non validé reste invisible sauf à son auteur et aux AP/RP/TI. Avec `mine=true`, renvoie tous les quizz de l'appelant, tous statuts confondus. Ne renvoie jamais les questions (liste de synthèse uniquement) | 🔒 | tous rôles authentifiés | `200 {items, total}` · `401` |
| POST | /quizzes | Créer un quizz avec ses questions, sa solution (jamais renvoyée en clair au-delà de l'auteur/AP/RP/TI eux-mêmes non plus), son barème et ses pénalités. `400` si une question est mal formée (choix unique sans exactement une bonne réponse, choix multiple sans aucune bonne réponse, texte court sans mot-clé), ou si `title` est vide/absent. **Une collision de titre avec un autre quizz du même auteur ne bloque plus la création depuis le 2026-09-01** (révision de l'arbitrage initial du même jour) : le serveur suffixe automatiquement `"(N)"` (`N` = plus petit entier ≥ 2 tel que le titre suffixé soit libre pour cet auteur) et enregistre sous ce titre, sans jamais renvoyer `400` sur ce cas — unicité toujours *par auteur* uniquement, deux auteurs différents peuvent choisir le même titre. **Fermeture de la fenêtre de compétition (TOCTOU) depuis le 2026-09-01, étape 2** : un index UNIQUE `(authorId, title)` en base est l'arbitre final ; en cas de collision de dernière seconde (deux écritures concurrentes), le serveur retente automatiquement la disambiguation jusqu'à 10 fois avant de renvoyer `409` — l'erreur Postgres brute n'est jamais remontée à l'appelant. Statut initial : `pending_validation` pour un formateur, `validated` (auto-validé) pour un AP ou un RP | 🔒 | formateur, animateur_pedagogique, responsable_pedagogique | `201 PublicQuizDetail` · `400` · `403` · `409` |
| PUT | /quizzes/:id | Modifier un quizz, réservé à son auteur. Remplace intégralement titre/description/tags/barème/pénalités/questions. `400` si `title` vide. **Même disambiguation automatique par suffixe `"(N)"` qu'à la création** en cas de collision avec un autre quizz du même auteur (le quizz édité est exclu de son propre contrôle — éditer vers son titre actuel ne produit donc aucun suffixe), **avec le même retry borné sur violation de l'index UNIQUE (→ `409` si épuisé)**. Un auteur formateur repasse en `pending_validation` | 🔒 | formateur, animateur_pedagogique, responsable_pedagogique (auteur uniquement) | `200 PublicQuizDetail` · `400` · `403` · `404` · `409` |
| GET | /quizzes/default-title | Suggère un titre par défaut (`"Quizz (N)"`, parenthèses autour du numéro depuis le 2026-09-01 — remplace le format `"Quizz {n}"` sans parenthèses du même jour, plus tôt), `N` = nombre de quizz déjà créés par l'appelant + 1, à lire par le front à l'ouverture du formulaire de création pour pré-remplir le champ (désormais obligatoire) — ne réserve rien, l'utilisateur reste libre de le modifier | 🔒 | formateur, animateur_pedagogique, responsable_pedagogique | `200 {title}` — ex. `{"title":"Quizz (4)"}` · `401` |
| GET | /quizzes/pending-validation | Lister les quizz créés par un professeur en attente de validation, paginés, triés du plus ancien au plus récent | 🔒 | animateur_pedagogique, responsable_pedagogique | `200 {items, total}` · `403` |
| GET | /quizzes/:id | Récupérer un quizz par id — questions et choix, **jamais la solution** (`correctOptionIds`/`keywords` ne sortent jamais de cette route ni d'aucune autre route publique). `404` (jamais `403`) si le quizz n'existe pas ou n'est pas visible pour l'appelant (non validé et appelant ni auteur ni AP/RP/TI) — un quizz masqué se comporte comme un quizz absent, même convention que les autres masquages du projet | 🔒 | tous rôles authentifiés | `200 PublicQuizDetail` · `404` |
| GET | /quizzes/:id/solution | Récupérer la solution complète d'un quizz (bonnes réponses, mots-clés attendus) — réservé à l'auteur et aux AP/RP/TI. `GET /quizzes/:id` reste inchangée et ne renvoie jamais la solution | 🔒 | formateur, animateur_pedagogique, responsable_pedagogique, technicien_informatique | `200 QuizDetailWithSolution` · `403` · `404` |
| POST | /validations/quiz/:id/decision | **Réutilise le flux de validation générique déjà existant** (`ValidationsController`, `ContentType.QUIZ` ajouté à l'énumération partagée) plutôt qu'une route bespoke — un quizz créé par un professeur passe par ce même mécanisme que pour exercice/évaluation/tutoriel. Commentaire obligatoire en cas de rejet. Un quizz déjà auto-validé (créé par AP/RP) n'a pas besoin d'y repasser, mais rien n'empêche techniquement de rappeler cette route dessus (même comportement pré-existant pour les autres types de contenu, non spécifique au quizz) | 🔒 | animateur_pedagogique, responsable_pedagogique | `201 ContentValidation` · `400` commentaire manquant en cas de rejet · `403` · `404` |
| POST | /validations/quiz/:id/request | Réutilise le flux générique de soumission à validation (utile pour resoumettre un quizz `rejected`) | 🔒 | formateur, animateur_pedagogique, responsable_pedagogique | `204` · `403` · `404` |

Body `POST`/`PUT /quizzes` : `{title, description?, tags?: string[], defaultPoints?, penaltyEnabled?,
penaltyPoints?, questions: [{category: "single_choice"|"multiple_choice"|"short_text", prompt,
options?: [{id?, text, isCorrect}], keywords?: string[], multipleChoiceScoringMode?:
"all_or_nothing"|"per_option", shortTextScoringMode?: "all_or_nothing"|"per_keyword",
pointsOverride?, penaltyEnabledOverride?, penaltyPointsOverride?}]}`. Le barème/la pénalité
individuels d'une question, si renseignés, prévalent sur le réglage global du quizz. `title` est
obligatoire (400 si vide) ; l'unicité par auteur reste vraie mais n'est plus imposée par un refus
(400) depuis le 2026-09-01 — voir la disambiguation automatique par suffixe `"(N)"` décrite sur les
lignes `POST`/`PUT` ci-dessus (`docs/architecture.md`, "Titre des Exercices et des Quizz :
disambiguation automatique plutôt que refus").

### Import de quizz depuis un fichier tableur (CSV/Excel)

Ajoutées le 2026-08-29, conformes à `docs/architecture.md`, "Import de Quizz depuis un tableur
(CSV/Excel)". Réutilise intégralement `QuizzesService.create()` bloc par bloc : un quizz importé
par un formateur passe par `pending_validation` exactement comme à la création manuelle, un quizz
importé par un AP ou un RP est auto-validé. Aucune règle de validation n'est contournée par
l'import.

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /quizzes/import/constraints | **À lire AVANT d'ouvrir le sélecteur de fichier**, sur le modèle de `GET /profiles/avatar/constraints`. Publie le plafond de taille en vigueur | 🔒 | tout compte authentifié | `200 {maxFileSizeBytes}` — ex. `{"maxFileSizeBytes":900000}` · `401` |
| GET | /quizzes/import/template | **Ajoutée rétroactivement le 2026-09-02** (`docs/architecture.md`, "Import d'Exercice depuis un tableur (CSV/Excel), et modèle de type identique pour l'import de Quizz", point 7) — l'import de Quizz n'avait jamais eu de fichier modèle depuis sa création (2026-08-29). Fichier CSV directement importable (1 quizz, 3 catégories de question), généré par `buildCsvRow` à partir des mêmes constantes que le parseur réel — vérifié par un test dédié qui le fait repasser dans `parseQuizImportFile` | 🔒 | tout compte authentifié | `200` fichier CSV (`Content-Disposition: attachment; filename="modele-import-quizz.csv"`) · `401` |
| POST | /quizzes/import | **Multipart**, champ `file`, un seul fichier CSV ou Excel (`.xlsx`). Type détecté sur les **octets réels** (signature ZIP pour `.xlsx`, texte sans octet nul pour CSV) — ni l'extension ni le `Content-Type` du client ne sont consultés. Un fichier peut contenir plusieurs quizz empilés (colonnes fixes, discriminant `type=quizz`/`type=question` en première colonne, quoting CSV RFC 4180 — `;` sert à la fois de séparateur de colonnes et, à l'intérieur d'une cellule citée, de séparateur intra-cellule). L'échec d'un bloc (ligne malformée, catégorie inconnue, réponse correcte introuvable parmi les options...) n'empêche **jamais** la création des autres blocs valides du même fichier. **Depuis le 2026-09-01, deux quizz au même titre pour le même auteur dans un même fichier (ou avec un quizz déjà existant) ne produisent plus un bloc en erreur** : chaque appel à `QuizzesService.create()` réutilise la disambiguation automatique par suffixe `"(N)"`, donc le deuxième bloc est créé sous un titre suffixé au lieu d'échouer | 🔒 | formateur, animateur_pedagogique, responsable_pedagogique | `201 [{blockIndex, status: "created"\|"error", quizId?, validationStatus?, errors?: [{row, message}]}]` — un résultat par bloc détecté · `400` aucun fichier, fichier vide, ou format non reconnu (ni CSV ni xlsx) · `403` rôle insuffisant · `413` au-delà du plafond en vigueur — **corps structuré, voir ci-dessous** |

**Format du fichier.** Ligne `quizz` (ouvre un bloc, valable jusqu'à la prochaine ligne `quizz` ou
la fin du fichier) : `type=quizz | titre | tags (";"-séparés) | bareme_global (optionnel, défaut 1)
| penalite_globale (optionnel)`. Ligne `question` : `type=question | categorie
(choix_unique|choix_multiple|texte_court) | enonce | options (";"-séparées, vide si texte_court) |
bonnes_reponses (";"-séparées : options correctes, ou mots-clés pour texte_court) | notation
(unique|par_item) | points (optionnel, prévaut sur le barème global) | penalite (optionnel,
prévaut sur la pénalité globale)`. Le discriminant de première colonne accepte à la fois la valeur
littérale `quizz`/`question` et la forme préfixée `type=quizz`/`type=question` (ambiguïté du
contrat initial, les deux lectures sont acceptées pour ne pas piéger un import sur une
interprétation de format — voir `.claude/reports/content-catalog-service-2026-08-29.md`).

**Taille maximale — 900 000 octets (900 Ko SI) par défaut, réglable uniquement par variable
d'environnement (`QUIZ_IMPORT_MAX_FILE_SIZE_BYTES`), pas de réglage TI en base pour cette
fonctionnalité** (contrairement à l'avatar ou aux pièces jointes du cahier de texte — consigne de
simplicité de code du chantier Quizz). Reste strictement sous le défaut non déclaré de
`nginx-global` (1 Mio) ; `api-gateway` déclare déjà `client_max_body_size 10m`, largement
suffisant — **aucun changement de routage ni de plafond nécessaire côté `api-gateway`** :
`location ^~ /api/v1/quizzes` proxie déjà tout le préfixe par octets bruts, multipart compris,
vérifié le 2026-08-29 en relisant `gateway/api-gateway/nginx.conf`.

Corps de la réponse `413` :

```json
{
  "statusCode": 413,
  "error": "Payload Too Large",
  "code": "QUIZ_IMPORT_FILE_TOO_LARGE",
  "message": "Uploaded file exceeds the maximum allowed size",
  "maxFileSizeBytes": 900000,
  "maxUploadBytes": 900000,
  "requestBodyBytes": 1258291
}
```

`maxUploadBytes` est un **alias** de `maxFileSizeBytes`, même valeur — ajouté le 2026-08-29 pour
que le composant générique de gestion d'erreur d'upload du front (construit pour l'avatar, qui lit
`maxUploadBytes` en priorité) fonctionne sans adaptation sur cette route. `maxFileSizeBytes` reste
le nom canonique de cette fonctionnalité, cohérent avec `GET /quizzes/import/constraints`.

`requestBodyBytes` est la taille **déclarée** par le client (`Content-Length`), jamais vérifiée —
`null` si absente. Le flux étant coupé par multer dès le dépassement, la taille réelle du fichier
n'est jamais connue avec certitude dans ce cas (même limite documentée pour l'avatar).

#### Route interne — jamais exposée par api-gateway

Exclue de Swagger (`@ApiExcludeController`). Protégée par `X-Internal-Secret: <INTERNAL_SECRET>`
(guard `InternalSecretGuard`, échec fermé — refuse `401` si `INTERNAL_SECRET` n'est pas configuré
côté serveur, plutôt que de laisser passer). `INTERNAL_SECRET` est déjà déclarée dans
`docker-compose.yml` pour ce service (valeur par défaut `change_me_in_production`, à faire
correspondre à celle de `learning-activity-service`).

| Méthode | Chemin | Description | Auth | Réponse attendue |
|---|---|---|---|---|
| POST | /internal/quizzes/:quizId/grade | **Contrat figé avec `learning-activity-service`** (`docs/architecture.md`, point 9) : note les réponses soumises pour un quizz sans jamais transmettre la solution en clair. Ne vérifie pas le statut du quizz (pas de garde `validated` ici) — cette responsabilité revient à `learning-activity-service`, propriétaire du cycle de vie de la tentative | `X-Internal-Secret` | `200 {score, maxScore, details: [{questionId, isCorrect, pointsEarned, pointsPossible}]}` · `401` secret absent ou invalide · `404` quizz introuvable |

Body : `{answers: [{questionId, selectedOptionIds?: string[], text?: string}]}`. Notation détaillée
par catégorie de question dans `docs/services/content-catalog-service.md` (barème effectif,
notation par option/mot-clé, non-cumul pénalité/score partiel).

### Exercices — refonte du 2026-08-29, bloc image de premier niveau le 2026-09-01

Conforme à `docs/architecture.md`, "Refonte des Exercices" puis "Bloc 'image' de premier niveau
pour l'Exercice" : un exercice est une séquence ordonnée de blocs à **3 catégories**
`statement`/`image`/`question` (2 catégories jusqu'au 2026-09-01) portant du contenu
texte/formule/image (même mécanisme que le Mémo, `pedagogical-log-service`) ; un bloc `question`
porte exactement une solution (`ExerciseSolution`, 1-à-1 par `partId`), jamais exposée par une
route publique (sauf lecture d'auteur, voir `GET /exercises/:id/solutions`). Droits et cycle de
validation alignés point par point sur le Quizz (2026-08-28) : créateurs formateur/AP/RP, statut
`pending_validation`/`validated` fixé au rôle à la création, édition réservée à l'auteur (fait
repasser en `pending_validation` si l'auteur est formateur), validation RP illimitée / AP scopé par
la relation `animator_of_teacher` (extension du mécanisme Quizz à Exercise dans
`ValidationsService`). `ExerciseAnswer`/`ExerciseCorrection` retirés de ce service — ils migrent
vers `learning-activity-service` (réponse de l'élève, tentative, historique).

**Composition minimale (ajoutée le 2026-09-01)** : un exercice doit comporter au moins un bloc
`statement` (peut être vide) et au moins un bloc `question` non vide — `400` sinon, vérifié à la
création et à l'édition.

**Image de premier niveau (2026-09-01)** : une image se dépose désormais dans un bloc `image`
dédié (exactement un item de type `image` dans `items`), embarquée en **base64** dans le **même**
appel `POST`/`PUT /exercises` que le reste de la séquence — plus de route multipart post-création.
Une image ne peut plus apparaître comme item d'un bloc `statement`/`question` (`400` sinon).
L'ancien mécanisme (`POST /exercises/:id/parts/:partId/images`,
`POST /exercises/:id/parts/:partId/solution/images`) est **retiré**, pas conservé en parallèle. Les
images existantes créées via l'ancien mécanisme ont été migrées vers des blocs `image` équivalents
(migrations `AddImagePartCategoryEnum1792000000000` +
`MigrateExerciseImageItemsToImageBlocks1793000000000`), sans perte — vérifié en HTTP direct contre
la pile réelle après migration (voir `docs/services/content-catalog-service.md`).

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /exercises | Rechercher les exercices visibles par l'appelant, filtrables par `level`, `difficulty`, `theme`, `authorId`, `tag` (`ANY(tags)`, exact), `keyword` (titre), paginés. Un exercice non validé reste invisible sauf à son auteur et aux AP/RP/TI | 🔒 | tous rôles authentifiés | `200 {items, total}` · `401` |
| POST | /exercises | Créer un exercice : séquence ordonnée de blocs `statement`/`image`/`question`, chaque bloc `question` portant une solution obligatoire, chaque bloc `image` portant exactement un item `image` (base64). `400` si un bloc est mal formé, si la composition minimale n'est pas respectée (aucun `statement`, aucun `question`), si une image apparaît hors d'un bloc `image` dédié, ou si `title` est vide/absent. **Une collision de titre avec un autre exercice du même auteur ne bloque plus la création depuis le 2026-09-01** (révision de l'arbitrage initial du même jour) : le serveur suffixe automatiquement `"(N)"` (`N` = plus petit entier ≥ 2 tel que le titre suffixé soit libre pour cet auteur, exercices au statut `removed` exclus du calcul) et enregistre sous ce titre, sans jamais renvoyer `400` sur ce cas — unicité toujours *par auteur* uniquement. **Fermeture de la fenêtre de compétition (TOCTOU) depuis le 2026-09-01, étape 2** : un index UNIQUE partiel `(authorId, title)` (exclut `removed`) en base est l'arbitre final ; en cas de collision de dernière seconde, le serveur retente automatiquement la disambiguation jusqu'à 10 fois avant de renvoyer `409` — l'erreur Postgres brute n'est jamais remontée à l'appelant. Statut initial : `pending_validation` pour un formateur, `validated` (auto-validé) pour un AP ou un RP | 🔒 | formateur, animateur_pedagogique, responsable_pedagogique | `201 PublicExerciseDetail` · `400` · `403` · `409` · `413` |
| PUT | /exercises/:id | Remplace intégralement blocs/items/solutions. Réservé à l'auteur. **Supprime les images précédemment envoyées à chaque édition** (remplacement intégral, pas de diff par identifiant stable) — depuis le 2026-09-01, elles PEUVENT être réintroduites dans le même appel (base64), à charge du front de les renvoyer explicitement. `400` si `title` vide ou composition invalide. **Même disambiguation automatique par suffixe `"(N)"` qu'à la création** en cas de collision avec un autre exercice du même auteur (l'exercice édité est exclu de son propre contrôle — éditer vers son titre actuel ne produit donc aucun suffixe), **avec le même retry borné sur violation de l'index UNIQUE (→ `409` si épuisé)** | 🔒 | formateur, animateur_pedagogique, responsable_pedagogique (auteur uniquement) | `200 PublicExerciseDetail` · `400` · `403` · `404` · `409` · `413` |
| GET | /exercises/default-title | Suggère un titre par défaut (`"Exercice (N)"`, parenthèses autour du numéro depuis le 2026-09-01 — remplace le format `"Exercice {n}"` sans parenthèses du même jour, plus tôt), `N` = nombre d'exercices non `removed` déjà créés par l'appelant + 1, à lire par le front à l'ouverture du formulaire de création pour pré-remplir le champ (obligatoire) — ne réserve rien | 🔒 | formateur, animateur_pedagogique, responsable_pedagogique | `200 {title}` — ex. `{"title":"Exercice (4)"}` · `401` |
| GET | /exercises/image-constraints | **Ajouté le 2026-09-01.** Plafonds d'image à lire par le front avant d'afficher le bouton d'ajout, jamais codés en dur | 🔒 | formateur, animateur_pedagogique, responsable_pedagogique | `200 {maxImageInputBytes, maxImageOutputBytes, maxRequestBodyBytes}` — ex. `{"maxImageInputBytes":600000,"maxImageOutputBytes":500000,"maxRequestBodyBytes":900000}` · `401` |
| GET | /exercises/pending-validation | Lister les exercices en attente de validation ; un AP ne voit que les formateurs qu'il anime, RP voit tout (même mécanisme que Quizz) | 🔒 | animateur_pedagogique, responsable_pedagogique | `200 {items, total}` · `403` · `503` profile-service injoignable |
| GET | /exercises/:id | Récupérer un exercice — blocs et items complets, **jamais le contenu d'une solution** (seulement `hasSolution: boolean` sur un bloc `question`). `404` si non trouvé ou non visible | 🔒 | tous rôles authentifiés | `200 PublicExerciseDetail` · `404` |
| GET | /exercises/:id/solutions | Même forme que `GET /exercises/:id`, mais chaque bloc `question` porte `solution: {items: PublicContentItem[]}` (contenu complet, texte/formule/**image** — une image de solution est désormais embarquée en base64 dans `imageData`, correctif du bug "image de solution jamais rerelisible", 2026-09-01) au lieu de `hasSolution: boolean`. Réservé à l'auteur de l'exercice et aux AP/RP/TI ; `GET /exercises/:id` reste inchangée et ne renvoie jamais la solution, quel que soit l'appelant | 🔒 | formateur, animateur_pedagogique, responsable_pedagogique, technicien_informatique | `200 PublicExerciseDetailWithSolutions` · `403` · `404` |
| GET | /exercises/:id/images/:itemId | Octets d'une image de **bloc uniquement** (y compris un bloc `image` de premier niveau) — une image de solution n'est **jamais** servie ici (`404`). Revérifie la visibilité de l'exercice à chaque téléchargement | 🔒 | tous rôles authentifiés | `200` octets · `404` |
| DELETE | /exercises/:id | Retire un exercice (statut `REMOVED`) | 🔒 | responsable_pedagogique, technicien_informatique, ou auteur | `204` · `403` · `404` |

⚠️ Constaté le 2026-09-01 en vérification HTTP directe : la branche "auteur" de `DELETE
/exercises/:id` documentée ci-dessus est **inatteignable** — le contrôleur restreint la route à
`@Roles(responsable_pedagogique, technicien_informatique)` uniquement, avant même d'appeler le
service. Un auteur formateur reçoit `403` malgré ce que le tableau ci-dessus indique. Incohérence
pré-existante, non corrigée dans cette session (hors périmètre de la tâche) — voir `openPoints` de
la session 2026-09-01 dans `docs/services/content-catalog-service.md`.

**Retiré le 2026-09-01** (ancien mécanisme d'image, remplacé par le bloc `image` de premier
niveau) : `POST /exercises/:id/parts/:partId/images` et
`POST /exercises/:id/parts/:partId/solution/images`.

Body `POST`/`PUT /exercises` : `{title, description?, level?, difficulty?, theme?, competencies?:
string[], tags?: string[], parts: [{category: "statement"|"image"|"question", items?: [{type:
"text"|"formula"|"image", content?, imageData?, imageOriginalFilename?}], solution?: {items: [{type:
"text"|"formula"|"image", content?, imageData?, imageOriginalFilename?}]}}]}`.
- `category="statement"` : `items` texte/formule, **peut être vide ou absent**.
- `category="image"` : `items` doit contenir **exactement un** item `type="image"`.
- `category="question"` : `items` texte/formule non vide **requis** + `solution` **obligatoire**
  (`items` non vide, texte/formule/image).
- Pour `type="image"` : `imageData` (base64, avec ou sans préfixe data URI) **requis**, `content`
  devient une légende optionnelle. Pour `type="text"|"formula"` : `content` requis.
- Une image ne peut **jamais** apparaître dans les `items` d'un bloc `statement`/`question` — `400`
  sinon ("une image se dépose dans un bloc dédié").
- `title` obligatoire (400 si vide) et unique par auteur. `description` optionnelle.
- Plafonds (lisibles via `GET /exercises/image-constraints`, jamais codés en dur côté front) :
  600 000 octets par image en entrée (avant ré-encodage), 500 000 octets en sortie (après
  ré-encodage WebP), **900 000 octets pour le corps JSON entier** de la requête — volontairement
  sous le défaut NON déclaré de nginx-global (1 Mio, vérifié le 2026-09-01 par `nginx -T`, confirmé
  en HTTP direct : un corps de 1,2 Mo reçoit un `413` HTML de nginx-global, un corps de 950 Ko reçoit
  un `413` **JSON** propre de l'application `{"statusCode":413,"message":"request entity too large"}`
  — c'est bien le plafond applicatif qui coupe en premier dans cette fenêtre).

#### Routes internes — jamais exposées par api-gateway

Exclues de Swagger (`@ApiExcludeController`). Protégées par `X-Internal-Secret`
(`InternalSecretGuard`, même échec fermé que pour le Quizz). Le front ne doit jamais pouvoir lire
une solution d'exercice autrement que via `learning-activity-service`.

| Méthode | Chemin | Description | Auth | Réponse attendue |
|---|---|---|---|---|
| POST | /internal/exercises/:exerciseId/parts/:partId/solution | Contrat figé avec `learning-activity-service` (`docs/architecture.md`, point 10) : renvoie le contenu complet de la solution d'un bloc `question`, sous la même forme que le contenu des blocs (`{id, type, order, content, imageMimeType?, imageSizeBytes?}[]`). Pour un item `image`, `id` sert directement d'`itemId` à passer à la route ci-dessous — les octets ne sont jamais embarqués en base64 dans cette réponse | `X-Internal-Secret` | `200 {content: PublicContentItem[]}` · `401` · `404` bloc ou solution introuvable |
| GET | /internal/exercises/images/:itemId | Octets de **n'importe quelle** image (bloc ou solution) — aucune vérification de visibilité ici : le proprietaire de la décision (révéler ou non une solution à l'élève) est `learning-activity-service`, en amont de cet appel | `X-Internal-Secret` | `200` octets · `401` · `404` |

### Import d'exercices depuis un fichier tableur (CSV/Excel)

Ajoutées le 2026-09-02, conformes à `docs/architecture.md`, "Import d'Exercice depuis un tableur
(CSV/Excel), et modèle de type identique pour l'import de Quizz". Réutilise intégralement
`ExercisesService.create()` bloc par bloc, exactement sur le modèle de l'import Quizz (2026-08-29) :
un exercice importé par un formateur passe par `pending_validation` exactement comme à la création
manuelle, un exercice importé par un AP ou un RP est auto-validé. Aucune règle de validation, de
composition minimale (au moins un bloc `statement` + un bloc `question` non vide) ni de titre
(obligatoire, unique par auteur, disambiguation automatique par suffixe `"(N)"`) n'est contournée
par l'import.

**Aucun nouveau champ sur `Exercise`** : `level`, `difficulty`, `theme`, `competencies`, `tags`
existaient déjà (chantier de juin 2026, conservés tels quels par la refonte du 2026-08-29) — vérifié
dans le code réel avant implémentation, contrairement à ce que laissait supposer une première
lecture de l'arbitrage. Aucune migration ajoutée par ce chantier.

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /exercises/import/constraints | À lire avant d'ouvrir le sélecteur de fichier, même modèle que `GET /quizzes/import/constraints` | 🔒 | tout compte authentifié | `200 {maxFileSizeBytes}` — ex. `{"maxFileSizeBytes":900000}` · `401` |
| GET | /exercises/import/template | Fichier CSV modèle directement importable (2 exercices, blocs énoncé/question/solution), généré par `buildCsvRow` à partir des mêmes constantes que le parseur réel — vérifié par un test dédié qui le fait repasser dans `parseExerciseImportFile` | 🔒 | tout compte authentifié | `200` fichier CSV (`Content-Disposition: attachment; filename="modele-import-exercices.csv"`) · `401` |
| POST | /exercises/import | **Multipart**, champ `file`, un seul fichier CSV ou Excel (`.xlsx`). Type détecté sur les **octets réels** (signature ZIP pour `.xlsx`, texte sans octet nul pour CSV). Un fichier peut contenir plusieurs exercices ; chaque bloc s'ouvre sur une ligne `exercice` et se termine à la **première ligne vide OU à la prochaine ligne `exercice`** (les deux terminent un bloc, contrairement au Quizz qui ne s'arrête qu'au prochain `type=quizz`). L'échec d'un bloc n'empêche **jamais** la création des autres blocs valides du même fichier | 🔒 | formateur, animateur_pedagogique, responsable_pedagogique | `201 [{blockIndex, status: "created"\|"error", exerciseId?, validationStatus?, errors?: [{row, message}]}]` — un résultat par bloc détecté · `400` aucun fichier, fichier vide, ou format non reconnu · `403` rôle insuffisant · `413` au-delà du plafond en vigueur — corps structuré, même forme que l'import Quizz (`code: "EXERCISE_IMPORT_FILE_TOO_LARGE"`) |

**Format du fichier.** Colonnes fixes, mêmes pour toutes les lignes du fichier : `type | titre |
niveau | difficulte | tags | themes | competences | contenu | image_data`.
- Ligne `exercice` (ouvre un bloc) : `titre` (obligatoire), `niveau`, `difficulte`, `tags`
  (`;`-séparés, → `Exercise.tags`), `themes` (**une seule valeur au maximum** — `400` si plusieurs
  valeurs `;`-séparées sont fournies : le champ réel `Exercise.theme` est **scalaire**, pas une
  liste, contrairement à `tags`/`competencies`), `competences` (`;`-séparés, →
  `Exercise.competencies`).
- Ligne `enonce` : `contenu` rempli (texte, syntaxe légère `[label](url)`/`$...$`/`$$...$$`
  supportée) → bloc `statement`, item `type="text"`.
- Ligne `question` : `contenu` rempli → bloc `question`, item `type="text"`. **Doit être
  immédiatement suivie d'une ligne `solution`** — sinon le bloc entier est refusé (`error`, message
  citant le numéro de ligne de la question fautive), y compris si la ligne suivante est vide ou une
  nouvelle ligne `exercice`.
- Ligne `solution` : `contenu` rempli, s'attache à la ligne `question` qui la précède
  **immédiatement** (ce n'est pas un bloc de la séquence, contrairement à `enonce`/`question`/
  `image`) — une ligne `solution` sans ligne `question` immédiatement précédente est refusée
  (orpheline).
- Ligne `image` : `image_data` rempli (base64 inline, même encodage que `POST`/`PUT /exercises`) →
  bloc `image`. Techniquement supporté mais peu praticable à la main dans un tableur (réservé à un
  usage scripté/généré) — aucun exemple n'en porte dans le fichier modèle téléchargeable.
- Le discriminant de première colonne accepte à la fois la valeur littérale (`exercice`, `enonce`,
  `question`, `solution`, `image`) et la forme préfixée (`type=exercice`, etc.), insensible à la
  casse — même souplesse que l'import Quizz.

**Taille maximale — 900 000 octets (900 Ko SI) par défaut, réglable uniquement par variable
d'environnement (`EXERCISE_IMPORT_MAX_FILE_SIZE_BYTES`)**, même raisonnement que l'import Quizz
(reste strictement sous le défaut non déclaré de `nginx-global`). Un bloc contenant une image en
base64 consomme ce budget bien plus vite qu'un bloc texte — signalé dans le code comme un point à
reconsidérer si l'usage réel avec images s'avère trop souvent bloqué, non relevé par anticipation.

Corps de la réponse `413` : mêmes clés que l'import Quizz, `code: "EXERCISE_IMPORT_FILE_TOO_LARGE"`.

**Vérifié en HTTP direct contre la pile réelle (2026-09-02)** : élève → `403` ; formateur avec un
fichier portant un bloc valide + un bloc "question sans solution" → `201`, le bloc valide est créé
en `pending_validation` (lu ensuite via `GET /exercises/:id`, contenu et métadonnées conformes), le
bloc invalide renvoie l'erreur exacte sans bloquer le premier ; AP → `201 validated` immédiatement ;
fichier de 950 Ko → `413` structuré avec `maxFileSizeBytes: 900000`. Le fichier modèle téléchargé
via `GET /quizzes/import/template` a également été réimporté avec succès via `POST /quizzes/import`
(`201 pending_validation`), et le fichier modèle Exercice vérifié par test unitaire (round-trip dans
le parseur réel).

### Évaluations

Cycle de vie aligné sur Quizz/Exercice le 2026-09-01 (`docs/architecture.md`, "Refonte des
Evaluations : notation manuelle, demande de correction, notifications" — périmètre
`content-catalog-service` uniquement ; le passage chronométré, la demande de correction et
l'historique de tentative sont portés par `learning-activity-service`, délégation séparée). Une
évaluation reste une liste ordonnée d'exercices existants (`exerciseItems`), pas ses propres
questions — structure inchangée par ce chantier.

**Retiré le 2026-09-01** : `POST /evaluations/:id/attempts` (créait une session `in_progress` sans
aucune suite — ni soumission de réponses, ni calcul de score, code jamais branché depuis juin 2026)
et l'entité `EvaluationAttempt` qui la portait. Un appel sur cette route renvoie désormais `404`
(route absente du contrôleur), jamais `500`. Remplacée par une entité équivalente côté
`learning-activity-service`.

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /evaluations | Rechercher les évaluations, filtrables par `level`, `difficulty`, `theme`, `tag` (`ANY(tags)`, exact — **corrigé le 2026-09-01**, le DTO exposait déjà ce champ sans jamais l'appliquer), `keyword` (titre, ILIKE), paginées. Élèves et parents ne voient que les évaluations `validated` | 🔒 | tous rôles authentifiés | `200 {items, total}` · `401` |
| POST | /evaluations | Créer une évaluation à partir d'une liste d'exercices existants (`exerciseItems`, non vide), avec durée de chronométrage **désormais obligatoire** (`durationSeconds`, entier > 0 — `400` sinon), option de blocage du retour arrière, et **barème informatif optionnel** (`scoring`, arbitrage du 2026-09-02 — voir plus bas). **Statut initial aligné sur Quizz/Exercice depuis le 2026-09-01** (remplace le `DRAFT` systématique antérieur) : `pending_validation` pour un formateur, `validated` (auto-validé) immédiatement pour un AP ou un RP | 🔒 | formateur, animateur_pedagogique, responsable_pedagogique | `201 Evaluation` · `400` liste d'exercices vide, durée absente/invalide, ou barème mal formé (voir plus bas) · `403` |
| PUT | /evaluations/:id | **Ajoutée le 2026-09-02** avec le barème informatif (aucune route d'édition n'existait jusqu'ici). Remplacement intégral, même corps que `POST /evaluations`, même modèle que `PUT /quizzes/:id`/`PUT /exercises/:id` : réservé à l'auteur ; un formateur qui édite fait repasser l'évaluation en `pending_validation` (quel que soit son statut précédent) ; un AP/RP éditant sa propre évaluation ne change jamais son statut | 🔒 | formateur, animateur_pedagogique, responsable_pedagogique, auteur uniquement | `200 Evaluation` · `400` mêmes règles que la création · `403` appelant non auteur · `404` |
| GET | /evaluations/:id | Récupérer une évaluation par id — détail avec ses exercices et son barème informatif éventuel (`scoring`, `null` si non défini). Comportement de visibilité par statut inchangé par ce chantier (`findOne()` ne filtre pas par statut, contrairement à Quizz/Exercice — écart pré-existant, non corrigé ici, hors périmètre explicite de la tâche) | 🔒 | tous rôles authentifiés | `200 Evaluation` · `404` |
| DELETE | /evaluations/:id | Retire une évaluation (statut `REMOVED`) | 🔒 | responsable_pedagogique, technicien_informatique, ou auteur | `204` · `403` · `404` |
| POST | /validations/evaluation/:id/decision | Réutilise le flux de validation générique partagé avec exercise/tutorial/quiz. **Validation AP scopée par la relation `animator_of_teacher` depuis le 2026-09-01** — révise une note du 2026-08-28 qui limitait volontairement ce scoping au Quizz ; réutilise exactement le mécanisme déjà construit pour Quizz/Exercice (`ProfileRelationsClient.hasAnimatorOfTeacherRelation`), pas redéveloppé. RP reste sans restriction | 🔒 | animateur_pedagogique, responsable_pedagogique | `201 ContentValidation` · `400` commentaire manquant en cas de rejet · `403` AP non lié au formateur auteur · `404` |
| POST | /validations/evaluation/:id/request | Réutilise le flux générique de soumission à validation | 🔒 | formateur, animateur_pedagogique, responsable_pedagogique | `204` · `403` · `404` |

Body `POST /evaluations` et `PUT /evaluations/:id` (même forme) : `{title, description?,
exerciseItems: [{exerciseId, titleOverride?, order}] (non vide), level?, difficulty?, theme?,
competencies?: string[], tags?: string[], durationSeconds (obligatoire, > 0),
blockBackNavigation?, scoring?}`. `tags` porte désormais sur une colonne `text[]` postgres native
(comme Quizz/Exercice), convertie depuis `simple-array` par la migration
`ConvertEvaluationTagsToNativeArray1797000000000`.

**Barème informatif (`scoring`, arbitrage du 2026-09-02, `docs/architecture.md` > "Barème
informatif pour l'Évaluation")** — ajouté par la migration `AddEvaluationScoring1799000000000`
(colonne `scoring` jsonb, nullable). **Purement informatif, jamais utilisé pour un calcul
automatique** : la correction reste entièrement manuelle (score + commentaire libre du
professeur, `learning-activity-service`, inchangé). Optionnel — une évaluation peut n'en porter
aucun (`scoring: null`).

Forme : `scoring?: {mode: "per_exercise"|"per_question", entries: [{exerciseId, partId?,
points}]}`.
- `mode` : granularité unique pour toute l'évaluation, pas de mélange.
- En mode `per_exercise` : une entrée par exercice de `exerciseItems` (`exerciseId` + `points`
  uniquement) — `partId` interdit (`400` sinon), doublon d'`exerciseId` interdit (`400`).
- En mode `per_question` : une entrée par bloc de catégorie `question` d'un exercice référencé
  (`exerciseId` + `partId` + `points`, `partId` obligatoire) — `partId` doit être un bloc
  `question` réel appartenant bien à l'`exerciseId` déclaré sur la même entrée (`400` sinon,
  vérifié en base auprès de `ExercisePart`) ; doublon de `(exerciseId, partId)` interdit (`400`).
- Dans les deux modes, chaque `exerciseId` référencé par `scoring` doit figurer dans
  `exerciseItems` de la même requête (`400` sinon, jamais d'entrée orpheline acceptée
  silencieusement).
- `points` : nombre strictement positif (`400` sinon).
- **Aucune contrainte de somme totale** — les poids n'ont pas à totaliser 100 ou un multiple
  donné.
- Renvoyé tel quel (même forme, mêmes clés) par `GET /evaluations`, `GET /evaluations/:id`,
  `POST /evaluations` et `PUT /evaluations/:id` — pas de sérialisation dédiée, l'entité est
  renvoyée directement (contrairement à Quizz/Exercice, qui masquent leur solution : le barème
  n'est pas secret).

**Aucune route de lecture de solution supplémentaire** n'a été construite pour ce chantier
(arbitrage explicite du 2026-09-01, point 6 : "une correction n'a rien à voir avec une solution...
la correction consiste à revoir la tentative/la réponse d'un utilisateur") — la solution d'un
Exercice référencé par une évaluation reste accessible uniquement via les mécanismes déjà existants
côté Exercice (`GET /exercises/:id/solutions`, route interne dédiée à `learning-activity-service`).

**Compatibilité avec le contrat interservices déjà consommé par `learning-activity-service`**
(`GET /evaluations/:id` → `{id, status, durationSeconds, exerciseItems: [...], ...}`, documenté
plus bas dans ce fichier) : l'ajout de `scoring` est **purement additif**, aucun champ existant
n'est retiré ni renommé — `learning-activity-service` ne valide strictement que `durationSeconds`
et `exerciseItems`, un champ supplémentaire ignoré ne casse rien. Non re-testé contre ce service
dans ce chantier (hors périmètre de la tâche), signalé ici par précaution.

### Tutoriels — refonte du 2026-09-03

Conforme à `docs/architecture.md`, "Refonte des Tutos/Vidéos" : remplace intégralement l'ancien
modèle du chantier de juin 2026 (`tutorialType` académie/activité/news, `format` texte/mixte/vidéo,
`textContent` scalaire, toujours `DRAFT` à la création, aucune unicité de titre, aucun scoping AP —
0 ligne en base au moment de la refonte, migration `CleanupPreRefonteTutorialData1800000000000`).
Une seule entité `Tutorial`, deux formats exclusifs : **`video`** (`videoUrl` obligatoire, aucun
bloc) et **`post`** (séquence ordonnée de blocs `title`/`text`/`image`, `videoUrl` interdit).
Métadonnées alignées sur `Evaluation`/`Exercise` (`theme`, `tags`, `level`, `difficulty`,
`competencies`), `description` étant nouveau pour ce type de contenu. Droits et cycle de validation
alignés point par point sur Quizz/Exercice/Évaluation : créateurs formateur/AP/RP, statut fixé au
rôle à la création (`pending_validation` formateur, `validated` AP/RP), édition réservée à l'auteur
(un formateur qui édite un tutoriel `validated` le fait repasser en `pending_validation`), validation
via le flux générique `POST /validations/tutorial/:id/decision` avec AP **désormais scopé** par la
relation `animator_of_teacher` (jusqu'ici seul type de contenu du flux générique resté non scopé,
corrigé par cette refonte). Un bloc `image` réutilise **littéralement** le même mécanisme que
l'Exercice (`ExerciseImageStorageService`/`ExerciseImageTranscoder` injectés tels quels dans
`TutorialsModule`, même volume Docker `content_catalog_exercise_images`, même ré-encodage WebP) —
aucun second service d'image écrit pour ce chantier.

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /tutorials | Rechercher les tutoriels visibles par l'appelant, filtrables par `format`, `level`, `difficulty`, `theme`, `tag` (`ANY(tags)`), `keyword` (titre), `authorId`, paginés. Un tutoriel non validé reste invisible sauf à son auteur, au RP (illimité) et à l'AP (scopé `animator_of_teacher`) | 🔒 | tous rôles authentifiés | `200 {items, total}` · `401` |
| POST | /tutorials | Créer un tutoriel. `400` si le titre est vide, si `format=video` sans `videoUrl` ou avec des `blocks`, si `format=post` avec `videoUrl`, si un bloc `title`/`text` est sans `content`, si un bloc `image` est sans `imageData`, ou si `linkedQuizId` ne correspond à aucun Quizz existant (n'importe quel statut accepté à l'écriture). **Collision de titre avec un autre tutoriel du même auteur** : disambiguation automatique par suffixe `"(N)"` (jamais de `400`), fermée par un index UNIQUE `(authorId, title)` + retry borné (10 tentatives, `409` si épuisé) — même mécanisme exact que Quizz/Exercice/Évaluation | 🔒 | formateur, animateur_pedagogique, responsable_pedagogique | `201 PublicTutorialDetail` · `400` · `403` · `409` |
| PUT | /tutorials/:id | Modifier un tutoriel, réservé à son auteur. Remplacement intégral (blocs et images compris — à renvoyer explicitement en base64 pour les conserver). Mêmes règles de validation et de disambiguation de titre qu'à la création (le tutoriel édité est exclu de son propre contrôle d'unicité) | 🔒 | formateur, animateur_pedagogique, responsable_pedagogique (auteur uniquement) | `200 PublicTutorialDetail` · `400` · `403` · `404` · `409` |
| GET | /tutorials/default-title | Suggère un titre par défaut (`"Tutoriel (N)"`), `N` = nombre de tutoriels déjà créés par l'appelant + 1 — à lire par le front à l'ouverture du formulaire de création | 🔒 | formateur, animateur_pedagogique, responsable_pedagogique | `200 {title}` — ex. `{"title":"Tutoriel (2)"}` · `401` |
| GET | /tutorials/image-constraints | Plafonds applicables à un bloc image (entrée/sortie/corps JSON) — mêmes valeurs que `GET /exercises/image-constraints`, mêmes classes de stockage/transcodage réutilisées | 🔒 | formateur, animateur_pedagogique, responsable_pedagogique | `200 {maxImageInputBytes, maxImageOutputBytes, maxRequestBodyBytes}` · `401` |
| GET | /tutorials/pending-validation | Lister les tutoriels créés par un professeur en attente de validation. Un AP ne voit que les tutoriels des formateurs qu'il anime ; un RP voit tout | 🔒 | animateur_pedagogique, responsable_pedagogique | `200 {items, total}` · `403` |
| GET | /tutorials/:id | Récupérer un tutoriel — métadonnées + contenu (`videoUrl` ou séquence de `blocks`). `linkedQuizId` n'est renvoyé (non `null`) que si le Quizz référencé est `validated` **au moment de la lecture** (jamais mis en cache) — évite un lien mort vers un contenu que l'appelant n'a pas le droit de voir. `404` (jamais `403`) si non trouvé ou non visible pour l'appelant | 🔒 | tous rôles authentifiés | `200 PublicTutorialDetail` · `404` |
| GET | /tutorials/:id/images/:blockId | Télécharger les octets d'un bloc image — revérifie la visibilité du tutoriel parent à chaque téléchargement | 🔒 | tous rôles authentifiés | `200` octets · `404` |
| DELETE | /tutorials/:id | Marque le tutoriel comme retiré (`REMOVED`). **Le `RolesGuard` du contrôleur ne liste que RP/TI** (même divergence assumée et non corrigée que `DELETE /exercises/:id` : le service autorise aussi l'auteur, mais ce rôle n'atteint jamais cette branche via la route publique) | 🔒 | responsable_pedagogique, technicien_informatique | `204` · `403` · `404` |
| POST | /validations/tutorial/:id/decision | Réutilise le flux de validation générique. **AP scopé par la relation `animator_of_teacher` depuis le 2026-09-03** (extension du mécanisme déjà en place pour Quizz/Exercice/Évaluation — Tutorial était le dernier type de contenu du flux générique resté non scopé). RP reste sans restriction | 🔒 | animateur_pedagogique, responsable_pedagogique | `201 ContentValidation` · `400` commentaire manquant en cas de rejet · `403` AP non lié au formateur auteur · `404` |
| POST | /validations/tutorial/:id/request | Réutilise le flux générique de soumission à validation | 🔒 | formateur, animateur_pedagogique, responsable_pedagogique | `204` · `403` · `404` |

Body `POST`/`PUT /tutorials` : `{title, description?, theme?, tags?: string[], level?, difficulty?,
competencies?: string[], format: "video"|"post", videoUrl?, linkedQuizId?,
blocks?: [{category: "title"|"text"|"image", content?, imageData?, imageOriginalFilename?}]}`.
`content` porte la syntaxe légère déjà en place ailleurs dans le projet ($...$/$$...$$ pour une
formule KaTeX, `[label](url)` pour un lien) — texte brut stocké tel quel côté serveur, transformé au
rendu côté client uniquement, aucune validation serveur ne rejette les caractères `$`/`\`.

**Pas d'import CSV/Excel pour ce type de contenu** (contrairement à Quizz/Exercice) — non demandé
par l'arbitrage, pas construit par anticipation.

## learning-activity-service

Swagger complet exposé sur `/api/docs`. Le tableau ci-dessous couvre le module
`evaluation-attempts/` ajouté le 2026-09-01 (`docs/architecture.md`, « Refonte des Evaluations ») ;
voir `docs/services/learning-activity-service.md` pour les modules `quiz-attempts`,
`exercise-attempts` et `open-activities`, documentés via Swagger uniquement jusqu'ici.

### Tentatives d'Évaluation

`content-catalog-service` porte la définition de l'Évaluation (titre, niveau, difficulté, thème,
tags, `durationSeconds`, liste ordonnée d'Exercices via `exerciseItems`) et son cycle de
validation ; `learning-activity-service` porte tout le cycle de vie de la tentative — démarrage
chronométré, réponses, clôture, demande de correction, historique — sur le même principe que
Quizz/Exercice.

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| POST | /evaluation-attempts | Vérifie que l'Évaluation est `validated` auprès de `content-catalog-service` (`GET /evaluations/:id`, jeton de l'appelant forwardé), calcule `deadlineAt = startedAt + durationSeconds`, fige la liste des `exerciseIds` de l'Évaluation | 🔒 | eleve, formateur, animateur_pedagogique, responsable_pedagogique | `201 EvaluationAttemptView` · `400` Évaluation non validée · `403` · `404` Évaluation introuvable · `502`/`503` |
| POST | /evaluation-attempts/:id/answers | Soumet/remplace la réponse à un bloc question d'un Exercice de l'Évaluation. Refusé (400) après `deadlineAt`, si la tentative est déjà close, ou si l'Exercice ne fait pas partie de l'Évaluation. Idempotent par `(exerciseId, partId)` | 🔒 | eleve, formateur, animateur_pedagogique, responsable_pedagogique | `200 EvaluationAttemptView` · `400` · `403` · `404` |
| POST | /evaluation-attempts/:id/submit | « Enregistrer sa réponse » : clôture la tentative (`status: completed`), sans déclencher de correction. Autorisé même après l'échéance | 🔒 | eleve, formateur, animateur_pedagogique, responsable_pedagogique | `200 EvaluationAttemptView` · `400` tentative déjà terminée · `403` · `404` |
| POST | /evaluation-attempts/:id/request-correction | Nécessite une tentative déjà close. Crée une `EvaluationCorrectionRequest` et notifie (événement Redis) les professeurs liés à l'élève + le RP. Un élève sans professeur lié bascule directement en `all_declined` (RP notifié). `400` si une demande active existe déjà pour cette tentative | 🔒 | eleve, formateur, animateur_pedagogique, responsable_pedagogique | `201 EvaluationCorrectionRequest` · `400` · `403` · `404` |
| GET | /evaluation-attempts/history | Tentatives de l'appelant, passées et en cours | 🔒 | tout compte authentifié | `200 EvaluationAttemptView[]` · `401` |
| GET | /evaluation-attempts/:id | État d'une tentative, avec `timeExpired` calculé à la volée | 🔒 | eleve, formateur, animateur_pedagogique, responsable_pedagogique (propriétaire uniquement, 404 sinon) | `200 EvaluationAttemptView` · `403` · `404` |

`EvaluationAttemptView` : `{id, evaluationId, userId, userRole, status: "in_progress"|"completed"|
"abandoned", startedAt, deadlineAt, completedAt, answers: [{exerciseId, partId, content: [{type:
"text"|"formula"|"image", content}], answeredAt}], timeExpired}`. `abandoned` n'est positionné par
aucune route aujourd'hui — réservé pour parité de nommage avec l'ancienne entité de
`content-catalog-service`, point ouvert non traité dans ce chantier.

### Demandes de correction

Machine à états `pending → accepted → corrected`, ou `pending → all_declined` (tous les
professeurs liés ont refusé). La correction ne compare **jamais** à la solution officielle de
l'Exercice (`docs/architecture.md`, point 6) : le correcteur ne lit que la réponse soumise par
l'élève.

| Méthode | Chemin | Description | Auth | Rôles autorisés | Réponse attendue |
|---|---|---|---|---|---|
| GET | /evaluation-corrections/pending | Professeur : demandes `pending` où il est lié à l'élève et n'a pas encore refusé. RP : toutes les demandes `pending` et `all_declined` (état actionnable) | 🔒 | formateur, responsable_pedagogique | `200 EvaluationCorrectionRequest[]` · `403` |
| GET | /evaluation-corrections/mine | Demandes acceptées et/ou corrigées par l'appelant | 🔒 | formateur, responsable_pedagogique | `200 EvaluationCorrectionRequest[]` · `403` |
| GET | /evaluation-corrections/:id | Détail. `attemptAnswers` (réponses de l'élève) jointes uniquement pour l'élève, un professeur lié, le professeur ayant accepté, ou le RP | 🔒 | élève propriétaire, professeur lié, responsable_pedagogique | `200 EvaluationCorrectionRequest` · `403` · `404` |
| POST | /evaluation-corrections/:id/accept | Premier arrivé premier servi : tout `accept` suivant échoue explicitement (`400`, jamais silencieux). Un professeur doit être actuellement lié à l'élève (revérifié en direct auprès de `profile-service`, jamais en cache) et la demande doit être `pending`. Le RP peut accepter en override d'escalade, y compris depuis `all_declined` | 🔒 | formateur (lié), responsable_pedagogique | `200 EvaluationCorrectionRequest` · `400` déjà pris en charge · `403` non lié · `404` · `502`/`503` |
| POST | /evaluation-corrections/:id/decline | Refus individuel. Bascule en `all_declined` (et notifie le RP) seulement quand tous les professeurs **actuellement** liés (relus en direct) ont refusé | 🔒 | formateur (lié) | `200 EvaluationCorrectionRequest` · `400` demande non pending · `403` non lié · `404` |
| POST | /evaluation-corrections/:id/correct | Score et/ou commentaire, réservé à celui qui a accepté (`acceptedByTeacherId`). `400` si ni score ni commentaire | 🔒 | le professeur (ou RP) ayant accepté | `200 EvaluationCorrectionRequest` · `400` · `403` · `404` |

`EvaluationCorrectionRequest` : `{id, attemptId, evaluationId, studentId, status: "pending"|
"accepted"|"corrected"|"all_declined", linkedTeacherIds, declinedByTeacherIds, acceptedByTeacherId,
score, comment, createdAt, acceptedAt, correctedAt, attemptAnswers?}`.

### Contrats interservices

**Vers `content-catalog-service`** (public authentifié, jeton forwardé, pas de
`X-Internal-Secret`) : `GET /evaluations/:id` → `{id, status, durationSeconds, exerciseItems:
[{exerciseId, ...}], ...}`. `learning-activity-service` valide strictement `durationSeconds`
(nombre > 0) et `exerciseItems` (tableau d'`{exerciseId: string}`) ; toute réponse non conforme lève
une `502` — **contrat non confirmé contre une PR réelle de `content-catalog-service` au moment de ce
chantier** (développé en parallèle, alignement du cycle de validation sur Quizz/Exercice et
`durationSeconds` rendu obligatoire).

**Vers `profile-service`** (interne, `X-Internal-Secret`) : `GET
/internal/relations/teachers/:studentId` → `{studentId, teacherUserIds: string[]}`. **Contrat
confirmé** contre la route réelle livrée par `profile-service` (PR #197, déployée) — le nom du
champ est `teacherUserIds`, cohérent avec `financeOwnerUserIds` déjà utilisé pour la route
équivalente des parents financeurs (documentée plus haut dans ce fichier, section
`profile-service`). Corrigé le 2026-09-01 : une première implémentation avait construit le client
sur l'hypothèse non confirmée `{teacherIds: string[]}`, provoquant un `502 "Réponse de relations
malformée (profile-service)"` systématique sur `POST /evaluation-attempts/:id/request-correction`.
Un `404` amont est traité comme une liste vide (pas une erreur) plutôt que propagé, pour ne pas
bloquer une demande de correction d'un élève sans aucun professeur lié.

### Événements émis (outbox + Redis XADD, stream `visiomath:events`)

Même transport que `teacher-request-service` (`docs/architecture.md`, « Systeme de notifications
transversal »). Table `domain_events` propre à `learning-activity-service` (outbox), publiée
par `XADD` puis republiée par un cycle de rattrapage (toutes les 15s) pour les événements non
publiés — `at-least-once`, `dashboard-notification-service` doit dédupliquer par `eventId`.

| Type | Émis quand | Payload | Destinataires prévus (à résoudre par `dashboard-notification-service`) |
|---|---|---|---|
| `EvaluationCorrectionRequested` | Création d'une demande, au moins un professeur lié | `{correctionRequestId, attemptId, evaluationId, studentId, teacherIds}` | chaque `teacherIds[]` (individuel) + rôle RP |
| `EvaluationCorrectionAccepted` | Un professeur ou le RP accepte | `{correctionRequestId, attemptId, evaluationId, studentId, teacherId}` | rôle RP |
| `EvaluationCorrectionDeclined` | Un professeur refuse | `{correctionRequestId, attemptId, evaluationId, studentId, teacherId}` | rôle RP |
| `EvaluationCorrectionAllDeclined` | Tous les professeurs liés ont refusé, ou aucun professeur lié à la création | `{correctionRequestId, attemptId, evaluationId, studentId, reason: "all_linked_teachers_declined"\|"no_linked_teacher"}` | rôle RP (état actionnable, doit apparaître dans `GET /evaluation-corrections/pending`) |
| `EvaluationCorrected` | Le correcteur soumet score/commentaire | `{correctionRequestId, attemptId, evaluationId, studentId, teacherId, score, comment}` | l'élève (`studentId`) |

Aucun de ces types n'est aujourd'hui consommé par `dashboard-notification-service` — délégation
distincte à venir, voir `.claude/reports/learning-activity-service-evaluations-2026-09-01.md`.
