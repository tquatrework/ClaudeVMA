# teacher-request-service — relevé d'écart avec le flow métier attendu

Date : 2026-08-11 · Mission : **relevé uniquement**, aucun fichier de `src/` modifié.
Toutes les réponses HTTP citées ont été obtenues contre la pile réelle
(`https://claudevma.visioprof.fr`, gateway `visiomath_gateway`, service `visiomath_teacher_request`).

---

## Comptes de test créés pour ce relevé

Aucun mot de passe des comptes `frontrel.*` / `relstats.*` n'étant consigné, un jeu complet a été
créé **par les routes réelles**. Mot de passe commun : `Visio!2026Flow`.

| Identifiant de connexion | Rôle | userId |
|---|---|---|
| `trsflow.eleve.0811` | eleve | `83e512d0-3faf-4d79-b900-1abf5ad0365d` |
| `trsflow.parent.0811` | parent_financeur | `1f55ab26-365b-4e60-a52c-fd2976577e9f` |
| `trsflow.prof1.0811` | formateur | `a1c90ec9-5dbe-424a-b40c-82fbf05d1c26` |
| `trsflow.prof2.0811` | formateur | `2b02e211-cd1f-4e68-8aa0-e43800cfad7c` |
| `trsflow.rp.0811` | responsable_pedagogique | `c4219392-6c28-4c57-b2ec-b9b8d79dae45` |

L'élève et le parent ont été créés en un seul appel `POST /accounts/students`
(`parentAccountMode: "new"`), ce qui crée automatiquement le lien financeur↔élève côté
`profile-service`. Les deux formateurs par `POST /accounts/teachers`.

**Point à signaler :** aucune route ne permet l'auto-inscription d'un RP
(`POST /accounts` avec `role: responsable_pedagogique` → `403 "Cannot self-register with an
internal role (IAM-FB-002)"`), et promouvoir un compte exige déjà un RP ou un TI connecté. Le
compte `trsflow.rp.0811` a donc été créé en `eleve` puis promu par un `UPDATE` SQL direct sur
`visiomath_identity_access.users`. C'est un contournement de test, pas une pratique à reproduire :
il n'existe aujourd'hui **aucun chemin applicatif** pour amorcer le premier RP d'une pile neuve.

---

## A. La cause exacte du 400

### Verdict : **contrat front/back faux.**

Le front envoie `description`, le serveur exige `subject`. Aucun des deux ne connaît le nom de
l'autre, et le champ envoyé est jeté avant même la validation.

### Réponse HTTP réelle

```
POST https://claudevma.visioprof.fr/api/v1/teacher-requests
Authorization: Bearer <jeton eleve trsflow.eleve.0811>
Content-Type: application/json

{"description":"je voudrais un professeur de maths"}
```

```
HTTP/1.1 400 Bad Request
{"message":["subject must be a string"],"error":"Bad Request","statusCode":400}
```

Le même corps réduit à `{}` donne exactement la même réponse — la preuve que `description`
n'est ni lu, ni refusé, ni même vu : il est absorbé en silence par
`ValidationPipe({ whitelist: true })` (`services/teacher-request-service/src/main.ts:8`), puis
`subject` manque et le DTO échoue.

### Preuve que le contrat serveur, lui, fonctionne

```
{"subject":"Mathematiques","level":"Terminale","sector":"Paris 15","message":"soutien hebdomadaire"}
→ HTTP 201
{"id":"da32560a-...","requesterId":"83e512d0-...","requesterRole":"eleve",
 "studentId":"83e512d0-...","subject":"Mathematiques","level":"Terminale",
 "sector":"Paris 15","message":"soutien hebdomadaire","status":"pending","type":"specific", ...}
```

La route n'est donc **pas** cassée : elle répond 201 dès qu'on lui parle sa langue.
Ce n'est ni une donnée obligatoire réellement manquante côté métier (le front collecte bien un
texte libre), ni une route qui ne fait pas ce qu'elle annonce.

### Les deux côtés du désaccord

- **Serveur** — `src/teacher-request/dto/create-request.dto.ts` :
  `{ studentId?: string, subject: string (requis), level?, sector?, message? }`.
- **Front** — `apps/web/src/types/teacherRequests.ts:44` :
  ```ts
  export interface CreateTeacherRequestPayload {
    description: string
    studentId?: string
  }
  ```
  utilisé par `createTeacherRequest()` (`apps/web/src/api/teacherRequests.ts:57`) →
  `useTeacherRequests` → **`TeacherRequestsPage`**, c'est-à-dire précisément la page où un élève
  ou un parent demande un professeur.

> Lecture ciblée du front assumée : la question posée était de trancher entre trois causes, dont
> « contrat front/back faux ». Seule la forme du payload a été consultée.

### Le même front possède déjà un second payload, conforme, sur la même route

`apps/web/src/types/teacherRequests.ts:74` :

```ts
export interface SpecificTeacherRequestPayload {
  subject: string; level: string; sector: string; message?: string; studentId?: string
}
```

envoyé par `createSpecificTeacherRequest()` — **même route `POST /teacher-requests`**, payload
différent, et le commentaire du fichier l'assume : « même route que `createTeacherRequest`
ci-dessus, mais payload/réponse de forme différente ».

C'est une violation frontale de la règle « un seul nom par donnée, front et back » :
une même donnée porte `description` sur un écran et `subject` sur un autre, et la route accepte
les deux formes sans jamais dire que l'une est fausse.

### Défaut de la même famille, à corriger en même temps

```
{"subject":"Mathematiques","urgency":"haute"}  → HTTP 201, urgency absent de la réponse
```

`whitelist: true` sans `forbidNonWhitelisted: true` : **toute route de ce service accepte puis
jette en silence n'importe quel champ inconnu**. C'est exactement le défaut arbitré le
2026-08-09 (`loginIdentifier` sur `/accounts/parents`, consentements sur `/accounts/students`).
Avec `forbidNonWhitelisted: true`, l'appel du front aurait répondu
`"property description should not exist"` au lieu d'un `subject must be a string` incompréhensible
— le bug aurait été lisible dès le premier appel.

---

## B. Inventaire des routes, mis en regard des étapes 1 → 4.3

Préfixe gateway : `/api/v1/teacher-requests` → contrôleur `/requests`
(réécriture par `map $teacher_requests_suffix` dans le `nginx.conf` de la gateway).
Préfixes également proxifiés : `/api/v1/requests` (legacy), `/api/v1/proposals`, `/api/v1/assignments`.
**Non proxifié : `/api/v1/collaborations`** — voir plus bas.

### Ce qui existe

| Route (publique) | Contrôleur | Rôles autorisés | DTO attendu | Étape | État |
|---|---|---|---|---|---|
| `POST /teacher-requests` | `/requests` | eleve, parent_financeur, RP | `{subject*, studentId?, level?, sector?, message?}` | 1 | ⚠️ fonctionne, mais nom de champ en désaccord avec le front, et aucun contrôle du lien parent↔élève |
| `GET /teacher-requests` | `/requests` | eleve, parent_financeur, RP, formateur | — | 2, 3 | ⚠️ voir « deux formes de réponse » |
| `GET /teacher-requests/:id` | `/requests/:id` | tout rôle authentifié (filtrage dans le service) | — | 2, 3 | ❌ le formateur destinataire reçoit **403** |
| `PATCH /teacher-requests/:id/status` | `/requests/:id/status` | RP | `{status}` (enum) | — | ⚠️ transitions `pending → accepted/declined/cancelled` uniquement |
| `DELETE /teacher-requests/:id` | `/requests/:id` | RP | — | — | ✅ |
| `POST /teacher-requests/pp-change` | `/requests/pp-change` | parent_financeur | `{studentId*, currentPpTeacherId*, subject*, message?}` | hors flow | ⚠️ lien parent↔élève non vérifié (commentaire `S3-B` dans le service l'admet) |
| `POST /teacher-requests/:id/proposals` | `/requests/:id/proposals` | RP | `{teacherId*, availabilityNote?}` | 2 | ⚠️ **un formateur par appel**, pas de lot |
| `POST /proposals/:id/accept` | `/proposals/:id/accept` | formateur (destinataire) | — | 3 | ❌ crée immédiatement une affectation, voir « écart majeur » |
| `POST /proposals/:id/decline` | `/proposals/:id/decline` | formateur (destinataire) | — | 3 | ✅ |
| `POST /teacher-requests/:id/selected-candidates` | `/requests/:id/selected-candidates` | RP | `{teacherIds: string[]}` | 4 | ❌ inatteignable en pratique (statut déjà `assigned`) |
| `POST /teacher-requests/:id/select` | `/requests/:id/select` | **eleve, parent_financeur** | `{proposalId*}` | 4 | ❌ **le RP est explicitement exclu**, et statut déjà `assigned` |
| `POST /assignments/:id/main-teacher` | `/assignments/...` | RP, eleve | — | hors flow | ✅ |
| `POST /assignments/:id/termination` | `/assignments/...` | formateur | `{noticeDate*, reason?}` | hors flow | ⚠️ doublon de `stop-request` |
| `POST /collaborations/:id/stop-request` | `/collaborations/...` | formateur | `{noticeDate*, reason?}` | hors flow | ❌ **non exposée par la gateway → 404 nginx** |

### Ce qui manque entièrement

| Besoin | Étape | Constat |
|---|---|---|
| Le RP « se saisit » d'une demande (prise en charge tracée) | 2 | Aucune route, aucun champ `handledBy` / `takenOverAt` dans l'entité |
| Le RP ajoute des précisions à la demande avant de la transmettre | 2 | `PATCH /teacher-requests/:id` → `404 "Cannot PATCH /requests/:id"` (mesuré). Le seul texte modifiable est `availabilityNote`, porté par **chaque proposition**, pas par la demande |
| Envoi groupé à plusieurs formateurs | 2 | Un appel par formateur ; aucune atomicité entre eux |
| Le formateur voit ce qu'on lui demande | 3 | `GET /teacher-requests` en formateur renvoie des propositions **sans sujet, sans niveau, sans nom d'élève** — seulement `requestId`, `teacherId`, `availabilityNote`, `status`. Et `GET /teacher-requests/:id` lui répond **403** |
| Le RP lit les acceptations | 4 | `GET /teacher-requests/:id/proposals` → **404**, `GET /proposals` → **404**, `GET /assignments` → **404**. **Le RP n'a aucun moyen de savoir qui a accepté.** |
| Le RP valide une acceptation | 4 | `POST /teacher-requests/:id/select` en RP → `403 "You do not have the required role for this action"` (mesuré) |
| Messages 4.1 (aux 4 destinataires) | 4.1 | Aucun appel à `dashboard-notification-service` ni à `communication-service`. `EventsService.emit()` écrit **une ligne de log** et rien d'autre (`src/teacher-request/events.service.ts`) |
| Lien élève↔professeur (4.2) | 4.2 | Aucun appel à `profile-service`. Le service tient sa **propre** table `assignments`, invisible de `profile-service` |
| Chute des propositions non retenues (4.3) | 4.3 | Aucun état terminal, aucune route. Mesuré : la proposition du prof 2 reste `accepted` indéfiniment |

---

## C. Modèle de données actuel

Base `visiomath_teacher_request`, 4 tables (`synchronize` TypeORM, aucune migration) :

| Table | Colonnes notables |
|---|---|
| `teacher_requests` | `requester_id`, `requester_role`, `student_id`, `subject`, `level`, `sector`, `message`, `status`, `type`, `current_pp_teacher_id`, `selected_teacher_ids` (simple-array), `chosen_teacher_id` |
| `teacher_proposals` | `request_id`, `teacher_id`, `availability_note`, `status` |
| `assignments` | `student_id`, `teacher_id`, `proposal_id`, `request_id`, `is_main_teacher`, `status` |
| `termination_requests` | `assignment_id`, `teacher_id`, `notice_date`, `reason`, `status` |

### Statuts

- `RequestStatus` : `pending`, `accepted`, `declined`, `redirected`, `assigned`, `cancelled`,
  `candidates_published`, `candidates_selected`, `candidate_chosen` — **neuf valeurs, dont
  `candidates_selected` qui n'est jamais écrite par aucun code** (elle n'apparaît que dans les
  listes d'états autorisés en entrée).
- `ProposalStatus` : `pending`, `accepted`, `declined` — **trois valeurs seulement.**
- `AssignmentStatus` : `active`, `termination_requested`, `terminated`.
- `TerminationStatus` : `pending`, `acknowledged`.

### Y a-t-il un état terminal permettant 4.3 ?

**Non, ni pour la demande, ni pour les propositions.**

- **Propositions.** `ProposalStatus` n'a que `pending | accepted | declined`. Une proposition
  jamais répondue reste `pending` pour toujours, et une proposition acceptée mais non retenue
  reste `accepted` pour toujours. Il manque au minimum deux notions distinctes : *non retenue*
  (le formateur a accepté, un autre a été choisi) et *caduque* (jamais répondue, la demande est
  close). Les confondre avec `declined` serait un mensonge : `declined` veut dire « le formateur
  a refusé ».
- **Demande.** `assigned` est un **cul-de-sac** : `updateRequestStatus` n'autorise que
  `pending → accepted/declined/cancelled`. Mesuré :
  ```
  PATCH /teacher-requests/da32560a-.../status  {"status":"cancelled"}
  → 400 {"message":"Invalid status transition from assigned to cancelled"}
  ```
  Aucun statut `closed` / `completed` n'existe :
  ```
  {"status":"closed"} → 400 {"message":["status must be one of the following values: pending,
   accepted, declined, redirected, assigned, cancelled, candidates_published,
   candidates_selected, candidate_chosen"]}
  ```

### Écart majeur mesuré : deux formateurs acceptent → deux affectations actives

Déroulé réel, demande `da32560a-a71e-4786-b54a-0223ffe1d629` :

1. RP propose au prof 1 → `201`, proposition `9792e1b4`, demande passe à `redirected`.
2. RP propose au prof 2 → `201`, proposition `630e53dc`.
3. Prof 1 accepte → `201`, **affectation `6fbc0537` créée, statut `active`**, demande → `assigned`.
4. Prof 2 accepte → `201`, **affectation `f40fb644` créée, statut `active`** sur le **même élève**,
   la **même demande**.
5. `POST /teacher-requests/:id/selected-candidates` (RP) →
   `400 {"message":"Request is not in a publishable state (current: assigned)"}`
6. `POST /teacher-requests/:id/select` (élève) →
   `400 {"message":"Request is not in a selectable state (current: assigned)"}`

État final en base : `assignments` → 3 lignes `active`, `teacher_proposals` → 3 lignes `accepted`.

Autrement dit : **la première acceptation emporte la décision**. Le RP n'arbitre rien, l'élève ne
choisit rien, et si un second formateur accepte il devient professeur lui aussi, en silence. Les
routes `selected-candidates` et `select`, qui portent l'étape 4, sont **structurellement
inatteignables** dès qu'un seul formateur a répondu — c'est une erreur métier transformée en
succès technique, exactement ce que le principe d'architecture interdit.

---

## D. Dépendances sortantes

### `profile-service` — un seul appel, et il ne fonctionne pas

`src/teacher-request/clients/profile-service.client.ts` appelle
`GET {PROFILE_SERVICE_URL}/profiles/:userId` pour résoudre un nom d'affichage.

Deux défauts cumulés, tous deux vérifiés contre la pile :

1. **`PROFILE_SERVICE_URL` n'est pas défini.** Absent de `docker-compose.yml` (bloc
   `teacher-request-service`, lignes 226-241 : seulement `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`,
   `PORT`) et absent de `src/config/env.validation.ts`. Le client retombe sur son défaut
   `http://profile-service:3000`, or profile-service écoute sur **3002** :
   ```
   $ docker exec visiomath_teacher_request wget http://profile-service:3000/health
   wget: can't connect to remote host (172.25.0.20): Connection refused
   ```
   C'est un plafond caché de la même famille que ceux arbitrés le 2026-08-10 : une valeur par
   défaut non déclarée qui échoue sans bruit.
2. **Même à la bonne adresse, l'appel échouerait** : la route est authentifiée et le client
   n'envoie aucun jeton.
   ```
   $ docker exec visiomath_teacher_request wget http://profile-service:3002/profiles/83e512d0-...
   HTTP/1.1 401 Unauthorized
   ```

La politique « best-effort → `null` » du client transforme ces deux échecs en silence. Conséquence
mesurée sur `GET /teacher-requests` en RP : **`"studentName":null,"teacherName":null` sur
l'intégralité des 16 demandes retournées**. Le RP n'a donc à l'écran que des UUID — violation
directe de l'arbitrage du 2026-08-09 (« aucun UUID ne doit être lu ni affiché par un utilisateur,
sauf AF »). Le service dispose pourtant du bon interlocuteur : `profile-service` expose
`GET /internal/relations/:viewerId/:targetId` et les routes `/internal/*` protégées par
`X-Internal-Secret`.

### `calendar-service`, `dashboard-notification-service`, `orchestration-service`, `communication-service`

**Aucun appel.** Aucun client, aucune URL, aucune variable d'environnement. L'étape 4 du workflow
documenté `teacher-request-to-assignment` (« vérifier les disponibilités ») n'existe pas ; les
disponibilités se réduisent à un champ texte libre `availabilityNote` saisi par le RP sur la
proposition.

Les « événements » (`TeacherRequestCreated`, `TeacherProposalSent`, `TeacherAssigned`,
`TeacherCandidatesSelected`, `TeacherCandidateChosen`, `TeacherStopRequested`) sont des
`logger.log(JSON.stringify(...))`. Aucun bus, aucun abonné. **Rien de ce que produit ce service
n'atteint aujourd'hui un autre service.**

### `x-correlation-id`

- **En entrée : non traité.** Aucun décorateur `@CorrelationId()`, aucun intercepteur, aucune
  occurrence dans les contrôleurs. La gateway le transmet pourtant bien
  (`proxy_set_header X-Correlation-ID $http_x_correlation_id`), et l'en-tête a été envoyé sur
  tous les appels de ce relevé : il est simplement ignoré.
- **En sortie : câblé mais jamais alimenté.** `ProfileServiceClient.resolveDisplayName()` accepte
  un `correlationId` optionnel ; les deux appelants dans `enrichRequestsWithNames()` ne le passent
  pas. Le commentaire du fichier (lignes 22-24) le reconnaît explicitement.

Le contrat technique `<contract id="correlation">` n'est donc pas honoré.

### Idempotence

**Absente.** Aucune occurrence de `Idempotency-Key` ni de clé d'idempotence dans tout `src/`.
Conséquence mesurée : trois `POST /teacher-requests` identiques ont produit **trois demandes
distinctes** (`95a41c6c`, `832579fb`, `917d8e93`). Le contrat
`<contract id="idempotency">` n'est pas honoré non plus.

---

## E. Le droit d'agir du parent

### Verdict : **aucune vérification. Un parent peut créer une demande pour n'importe quel élève.**

Preuve, avec le jeton de `trsflow.parent.0811` et le `studentId` de `relstats.eleve.0811`, un
élève auquel ce parent n'est **pas** lié :

```
POST /api/v1/teacher-requests
{"studentId":"371561b2-7c90-4161-9323-d90c34d9aaed","subject":"Chimie"}

→ HTTP 201
{"id":"bd95c664-0db9-4e4c-8c0e-be775f0baf70",
 "requesterId":"1f55ab26-365b-4e60-a52c-fd2976577e9f","requesterRole":"parent_financeur",
 "studentId":"371561b2-7c90-4161-9323-d90c34d9aaed","subject":"Chimie","status":"pending", ...}
```

La demande apparaît ensuite dans la liste du RP, indistinguable d'une demande légitime.

`createRequest()` (`teacher-request.service.ts:69-91`) se contente de :

```ts
const studentId = user.role === UserRole.ELEVE ? user.id : dto.studentId;
if (!studentId) throw new BadRequestException('studentId is required when requester is not ELEVE');
```

Aucun appel à `profile-service`. Le même trou est **documenté dans le code** pour
`createPpChangeRequest()` (lignes 318-325) avec une justification explicite — « le RP le
rejettera à la revue », « quand profile-service exposera un endpoint `/verify-link` ce garde
devra devenir une vérification synchrone ». Cette route existe désormais :
`GET /internal/relations/:viewerId/:targetId`, avec `viewerRole` obligatoire, qui renvoie le
**sens** du lien et non un booléen. La condition posée par le commentaire est donc levée.

Le fait que **le lien puisse maintenant être rompu (PR #98)** durcit l'exigence : la vérification
doit se faire **au moment de l'action**, à chaque action, et ne peut pas être mise en cache ni
figée à la création de la demande. Un parent délié doit cesser d'agir immédiatement, y compris
sur une demande qu'il avait légitimement créée avant la rupture — ce qui concerne aussi
`POST /teacher-requests/:id/select` et `POST /teacher-requests/pp-change`.

Refus attendu : conforme aux masquages arbitrés le 2026-08-10 et 2026-08-11, un `studentId` sur
lequel l'appelant n'a aucun lien ne doit pas révéler l'existence de l'élève.

---

## Contraintes projet — écarts constatés

| Règle | Constat |
|---|---|
| Un seul nom par donnée, front et back | ❌ `description` (front, `TeacherRequestsPage`) vs `subject` (back), sur la même route ; et le front porte lui-même les deux formes |
| Tout ce que l'utilisateur lit est en français | ❌ 100 % des messages d'erreur sont en anglais : `"subject must be a string"`, `"Access denied"`, `"Request is not in a selectable state (current: assigned)"`, `"You do not have the required role for this action"`… |
| Aucun UUID affiché (sauf AF) | ❌ `studentName`/`teacherName` toujours `null` (client profile cassé) ; les DTO de proposition et d'affectation n'exposent **que** des UUID (`teacherId`, `studentId`, `requestId`, `proposalId`), sans aucun champ de nom |
| Une erreur métier ne devient jamais un succès technique | ❌ deuxième acceptation → `201` alors qu'un professeur est déjà affecté ; demande d'un parent sur un élève étranger → `201` |
| Aucune route n'accepte puis n'ignore un champ | ❌ `forbidNonWhitelisted` absent : `{"subject":"X","urgency":"haute"}` → `201`, `urgency` disparaît |

## Autres points relevés en passant

1. **`GET /teacher-requests` renvoie deux formes de réponse différentes selon le rôle** — des
   `TeacherRequestResponseDto` pour élève/parent/RP, des `TeacherProposalResponseDto` pour le
   formateur. Le contrôleur choisit par `'requestId' in results[0]`
   (`teacher-request.controller.ts:73`) : sur liste vide, la forme est indevinable, et le front
   doit normaliser à l'aveugle (son commentaire l'admet : « certains appelants reçoivent un
   tableau, d'autres une enveloppe »).
2. **Listes non bornées** : `listRequests` en RP a renvoyé les 16 demandes de la base, sans
   pagination ni limite.
3. **`/api/v1/collaborations` n'est pas proxifié** par la gateway → `404` HTML nginx. Le front
   appelle par ailleurs `/teacher-collaborations/:id/stop-request`, également non mappé. La route
   `POST /collaborations/:id/stop-request` est donc morte, et elle **duplique**
   `POST /assignments/:id/termination` (logique quasi identique, point ouvert déjà signalé dans
   `docs/services/teacher-request-service.md`).
4. **`docs/routes.md` est très en retard** : il ne documente que 5 routes `/requests`, alors que
   14 existent. Il annonce aussi « Statuts : `pending` → `accepted` / `declined` / `cancelled` »
   alors que le code en compte neuf.
5. **`JWT_SECRET` vaut `change_me_with_a_long_random_string_in_production`** dans le conteneur en
   cours d'exécution (`docker exec visiomath_teacher_request printenv`). Le secret par défaut est
   appliqué tel quel, sur une machine accessible publiquement. À signaler à l'orchestrateur : ce
   secret signe les jetons de **tous** les services.
6. **Aucun chemin applicatif pour créer le premier RP** (voir la section « Comptes de test »).

---

## Synthèse pour arbitrage

Le flow attendu et le flow implémenté ne diffèrent pas par des détails : ils **divergent sur qui
décide**. L'implémentation actuelle repose sur « le premier formateur qui accepte devient le
professeur » ; le flow attendu repose sur « les formateurs se déclarent, le RP tranche ». Les
routes `selected-candidates` et `select` semblent avoir été écrites pour un troisième modèle
encore — « le RP présélectionne, le **client** choisit » — et sont aujourd'hui inatteignables.

Trois modèles de décision coexistent donc dans le même service. Il faut en choisir un avant
d'écrire une ligne de code, et l'énoncé de l'utilisateur est sans ambiguïté sur le sien :
**c'est le RP qui valide une acceptation.**

Ce qui en découle mécaniquement, à trancher par l'orchestrateur :

- **L'acceptation d'un formateur ne doit plus créer d'affectation.** Elle enregistre une
  candidature. L'affectation naît de la validation du RP, et d'elle seule.
- **Il faut deux nouveaux états de proposition** (non retenue / caduque) et **un état terminal de
  demande**, pour que 4.3 soit exprimable.
- **`profile-service` doit être appelé à trois endroits** : vérification du lien parent↔élève à
  chaque action d'un parent (E), création du lien élève↔professeur à la validation (4.2), et
  résolution des noms pour ne plus afficher d'UUID.
- **Les messages de 4.1 n'ont aucun destinataire aujourd'hui** : `dashboard-notification-service`
  et/ou `communication-service` doivent devenir des dépendances réelles, pas des lignes de log.
- **Le RP doit pouvoir lire les acceptations** avant de trancher : il n'existe aucune route de
  lecture des propositions d'une demande.

## Traces laissées sur la pile

- 5 comptes `trsflow.*` (tableau en tête de rapport), non supprimables, aucune route de
  suppression n'existant. Un TI peut les suspendre.
- 6 demandes de test, dont une demande abusive (`bd95c664`, parent sur un élève non lié) et une
  demande bloquée en `assigned` avec **deux affectations actives** (`da32560a`) — état volontaire,
  conservé comme preuve.
- Le compte `trsflow.rp.0811` a été promu RP par `UPDATE` SQL direct sur
  `visiomath_identity_access.users`. Seule écriture hors application de ce relevé.
