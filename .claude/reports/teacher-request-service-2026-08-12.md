# teacher-request-service — refonte du flow de la demande de professeur

Date : 2026-08-12 · Branche : `feat/flow-demande-professeur` · Commits `52ba997`, `03c9985`, plus le
présent commit de documentation.

Applique l'arbitrage du 2026-08-12 (`docs/architecture.md` > « Flow de la demande de professeur »,
7 points), sur la base du relevé du 2026-08-11
(`.claude/reports/teacher-request-service-flow-2026-08-11.md`).

---

## Ce qui a changé, dans l'ordre du flow

### 1. La demande — le serveur s'aligne sur le front

`POST /requests` prend désormais `{description, studentId?}`. `description` est **le seul champ de
saisie**, requis, texte long (≤ 5000 caractères).

`subject`, `level` et `sector` sortent du flow : ils ne sont plus exigés, **plus acceptés** (un `400`
explicite depuis l'activation de `forbidNonWhitelisted`) et plus exposés en réponse. Les colonnes
restent en base — elles portent des données — et la migration **reprend** `message` puis `subject`
dans `description` pour les 16 lignes existantes, afin qu'aucune demande n'arrive vide à l'écran du
RP.

Le `400` d'origine est donc fermé par les deux bouts : le champ attendu est celui que le front
envoie, et un champ inconnu est désormais **refusé nommément** au lieu d'être absorbé en silence.

### 2. Le modèle de décision est renversé

C'était le défaut central. `POST /proposals/:id/accept` créait immédiatement une affectation ;
deux formateurs acceptant produisaient deux affectations `active` sur le même élève, et le RP
n'arbitrait rien.

Désormais : **l'acceptation enregistre une candidature** (`status: accepted`, `respondedAt`), la
demande reste `redirected`, et **aucune** affectation n'est créée.

`POST /requests/:id/validate` (RP uniquement) devient le point de décision unique. Il :

1. vérifie que la proposition appartient à la demande et qu'elle a été **acceptée** ;
2. demande à `profile-service` de créer le lien élève↔formateur ;
3. clôture la demande (`closed`, `chosenTeacherId`, `closedAt`) ;
4. passe les autres candidats en `not_selected` et les propositions sans réponse en `expired`.

**L'ordre est délibéré** : le lien est demandé *avant* la clôture. Si `profile-service` refuse, rien
n'est clôturé et le RP peut recommencer. Si la clôture échouait après coup, le rejeu retomberait sur
un `409` traité comme un succès. Clôturer d'abord aurait produit une demande « traitée » sans aucun
lien — exactement l'erreur métier transformée en succès technique que le principe d'architecture
interdit.

`POST /requests/:id/select` et `POST /requests/:id/selected-candidates` sont **supprimées**.

### 3. Les états manquants

**Proposition** : `not_selected` (« avait accepté, un autre a été choisi ») et `expired`
(« n'a jamais répondu, la demande est close »). Ils ne sont pas confondus avec `declined`, qui
continue de signifier « le formateur a refusé » — l'inverse aurait été un mensonge affiché au
formateur.

**Demande** : `closed`, état terminal. `assigned` reste déclaré (des lignes le portent) et gagne une
transition sortante vers `closed`, pour débloquer les demandes figées par l'ancien modèle. L'étape 8
devient exprimable : `GET /requests` renvoie par défaut les demandes **en cours**, avec
`?scope=closed` ou `?scope=all` pour l'historique — disparaître d'un écran n'est pas être effacée.

### 4. Les lectures qui manquaient

- `GET /requests/:requestId/proposals` (RP) : qui a accepté, qui a refusé, qui n'a pas répondu.
  Sans elle, l'étape 5 était intenable.
- `GET /requests` en RP renvoie en plus `acceptedProposalCount` et `pendingProposalCount`, pour ne
  pas avoir à ouvrir chaque demande.
- Le **formateur** reçoit la description de la demande et le nom de l'élève, et `GET /requests/:id`
  ne lui répond plus `403`.
- La forme de `GET /requests` dépend du **rôle**, plus du contenu : `'requestId' in results[0]`
  rendait la forme indevinable sur liste vide.

### 5. Le lien appartient à `profile-service`

La table `assignments` n'est **plus écrite**. Le lien élève↔formateur est créé par
`POST /internal/create-teacher-student-relation`, et le professeur principal se déclare par
`isPrincipalTeacher` de la validation.

### 6. Le droit d'agir du parent

Vérifié **à chaque action** via `GET /internal/relations/:viewerId/:targetId?viewerRole=`, jamais en
cache. Cela ferme le trou mesuré le 2026-08-11 (un parent créait une demande pour n'importe quel
élève, en `201`) et le `TODO S3-B` laissé dans `createPpChangeRequest`.

Un `studentId` sans lien renvoie **404**, avec le même message qu'un élève inexistant. Même
traitement pour une proposition adressée à un autre formateur. Un parent délié cesse aussi de
**voir** les demandes concernées, y compris celles qu'il avait créées.

Politique d'échec assumée : si `profile-service` est injoignable, l'action est **refusée** (`503`).
Laisser passer donnerait l'illusion du contrôle.

### 7. Dette technique

| Point | État |
|---|---|
| `PROFILE_SERVICE_URL` | Déclaré dans `docker-compose.yml` **et exigé** par `env.validation.ts` |
| `INTERNAL_SECRET` | Idem — le service n'en avait aucun |
| Lecture du profil | Le client lisait `firstName` à la racine alors que `GET /profiles/:userId` renvoie une **enveloppe** `{administrative, …}` : troisième cause des noms nuls |
| `forbidNonWhitelisted` | Activé |
| `x-correlation-id` | Accepté, généré si absent, **renvoyé** en réponse, propagé aux appels sortants |
| `Idempotency-Key` | Sur les commandes ; trois `POST` identiques ne créent plus trois demandes |
| Messages d'erreur | Tous en français |

### 8. Les événements sont réels

`EventsService.emit()` écrivait une ligne de log. Désormais chaque événement est écrit dans la table
**`domain_events`**, **dans la même transaction** que le changement d'état qui le produit — un
événement ne peut donc pas annoncer un fait qu'un rollback annulerait — puis remis au flux Redis
**`visiomath:events`** (`XADD`).

Un **flux** et non un `PUBLISH` : `dashboard-notification-service` n'étant pas encore branché, un
`PUBLISH` serait perdu faute d'abonné. Sans `REDIS_URL`, les événements restent en attente et **ne
sont jamais perdus**.

Douze événements : `TeacherRequestCreated`, `TeacherRequestStatusUpdated`, `TeacherRequestDeleted`,
`TeacherRequestClosed`, `TeacherProposalSent`, `TeacherProposalAccepted`, `TeacherProposalDeclined`,
`TeacherProposalNotSelected`, `TeacherProposalExpired`, `TeacherAssigned`, `MainTeacherAssigned`,
`TeacherStopRequested`.

---

## Vérifications jouées

### Tests

```
Unitaires : 9 suites, 133 tests — verts
E2E       : 2 suites, 18 tests — verts (PostgreSQL réel, base teacher_request_test)
```

L'e2e prouve le défaut central corrigé, contre une vraie base :

- trois formateurs sollicités, **deux acceptent** → `profile-service` n'est appelé **aucune fois**,
  la demande reste `redirected`, `acceptedProposalCount: 2`, `pendingProposalCount: 1` ;
- le RP valide → **un seul** lien créé, `{teacherId, studentId, isPrincipalTeacher: true}` ;
- état final des propositions lu en SQL :
  `teacher1 → accepted`, `teacher2 → not_selected`, `teacher3 → expired` ;
- la demande disparaît de `GET /requests` et reparaît en `?scope=closed` ;
- si `profile-service` refuse le lien, la demande **reste** `redirected` ;
- deux `POST` avec la même `Idempotency-Key` → `COUNT(*) = 1` en base ;
- `x-correlation-id: corr-e2e` envoyé → renvoyé en réponse **et** retrouvé dans `domain_events`.

### Migration, contre une copie de la base de production

Copie de `visiomath_teacher_request` (16 demandes, 3 propositions, 3 affectations), puis démarrage de
l'application compilée en `NODE_ENV=production` :

```
 name
------------------------------------
 FlowDemandeProfesseur1754960000000
```

- `subject` : `not null` → **nullable** ;
- `description` ajoutée **et remplie** (`soutien hebdomadaire`, `Chimie`, `Physique`… repris de
  `message`/`subject`) ;
- `teacher_proposals` : `message`, `compensation_note`, `response_deadline`, `responded_at` ;
- tables `domain_events` et `idempotency_records` créées ;
- index sur `status`, `student_id`, `request_id`, `teacher_id` ;
- **second démarrage** : aucune erreur, migration non rejouée.

C'était la première migration du service : les tables venaient d'un `synchronize` désormais réservé
aux tests, donc aucune colonne ajoutée n'aurait jamais existé en production.

### Refus de démarrage sans configuration

```
Invalid environment configuration: An instance of EnvironmentVariables has failed the validation:
 - property PROFILE_SERVICE_URL has failed the following constraints: isNotEmpty, isString
 - property INTERNAL_SECRET has failed the following constraints: isNotEmpty, isString
```

Plus de défaut silencieux pointant un port où personne n'écoute.

---

## Ce dont j'ai besoin de `profile-service`

### 1. À créer — `GET /internal/profiles/:userId/display-name`

**Bloquant partiel.** Sans elle, un formateur destinataire d'une proposition ne peut pas lire le nom
de l'élève : aucune relation ne les lie encore, la route publique lui répondrait `403`, et la
réponse porte `studentName: null`.

```
GET /internal/profiles/:userId/display-name
Headers : X-Internal-Secret: <INTERNAL_SECRET>, x-correlation-id (optionnel)

200 {userId, firstName, lastName}   // valeurs string | null
404 userId inconnu de identity-access-service
401 secret absent ou invalide
```

Ne demande pas de lecteur et n'applique pas le filtrage champ par champ : prénom et nom font partie
du socle partagé, et c'est le service appelant qui décide à qui il montre un nom dans son propre
contexte métier.

Le client la tente **en premier**, puis retombe sur `GET /profiles/:userId` avec le jeton de
l'appelant — ce qui suffit déjà au RP et à l'élève, mais pas au formateur.

**Bonus utile, non bloquant** : une variante par lot (`POST /internal/profiles/display-names` avec
`{userIds: string[]}`) éviterait N appels HTTP sur une liste RP.

### 2. À confirmer — `POST /internal/create-teacher-student-relation`

La route existe et `docs/routes.md` en documente la réponse (`201 {teacherId, studentId,
isPrincipalTeacher}`, `409` sur doublon), **mais pas le corps d'entrée**. Le client envoie :

```
POST /internal/create-teacher-student-relation
Headers : X-Internal-Secret, x-correlation-id, content-type: application/json
Body    : {teacherId, studentId, isPrincipalTeacher}
```

Il traite le `409` comme un succès (le lien demandé existe), ce qui rend la validation du RP
rejouable. Merci de confirmer les noms de champs et que `isPrincipalTeacher` est bien accepté à la
création.

---

## Points en suspens

1. **La table `assignments` n'est plus alimentée.** Les routes `/assignments/:id/main-teacher`,
   `/assignments/:id/termination` et `/collaborations/:id/stop-request` ne servent donc que les
   affectations de l'ancien modèle. **Une collaboration née du nouveau flow ne peut pas être arrêtée
   par ces routes** : l'arrêt doit être reconstruit sur les relations de `profile-service`. C'est le
   principal manque fonctionnel laissé derrière — hors périmètre de l'énoncé, mais à traiter.
2. **`/api/v1/collaborations` n'est toujours pas proxifié** par la gateway. Le doublon de code est
   supprimé (l'alias délègue), mais la route reste inatteignable depuis le front.
3. **Le front est à réaligner** — il appelle `POST /teacher-requests/:id/select` (supprimée), envoie
   `{teacherId}` au lieu de `{teacherIds}` sur les propositions, et poste
   `{currentTeacherId, requestedTeacherId, reason}` sur `pp-change` là où le serveur attend
   `{studentId, currentPpTeacherId?, description}`. Les composants `TeacherCandidatesView` et
   `SpecificTeacherRequestForm` relèvent du modèle abandonné.
4. **Résolution des noms** : un appel HTTP par identifiant distinct (voir le bonus par lot ci-dessus).
5. **Listes non bornées** : toujours aucune pagination.
6. **Rappel du relevé du 2026-08-11, non traité ici** : `JWT_SECRET` vaut encore le secret par défaut
   dans le conteneur en cours d'exécution, et **aucun chemin applicatif ne permet de créer le premier
   RP** d'une pile neuve.

---

## Déploiement — reste à faire

Le code est poussé sur `origin/feat/flow-demande-professeur`. La preuve contre **la pile réelle**
(`https://claudevma.visioprof.fr`) suppose deux gestes qui sortent de mon périmètre :

1. mettre à jour le checkout principal (`git pull`) — le projet Docker `claudevma` construit depuis
   `/home/debian/Documents/claudeVMA`, où la branche n'est pas à jour ;
2. `docker compose up -d --build teacher-request-service`.

Le compose modifié apporte `PROFILE_SERVICE_URL`, `INTERNAL_SECRET` et `REDIS_URL` : sans lui, le
service **refuse de démarrer**, volontairement. La migration s'exécute au démarrage et a été validée
contre une copie de la base de production.
