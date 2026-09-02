# dashboard-notification-service — Notifications de correction d'Évaluation

Date : 2026-09-02
Branche : `feat/dashboard-notifications-evaluations`
PR : https://github.com/tquatrework/ClaudeVMA/pull/200 (ouverte, non mergée)

## Contexte

Dernier maillon du chantier "Refonte des Évaluations" (`docs/architecture.md`, arbitrage du
2026-09-01). `content-catalog-service`, `learning-activity-service`, `profile-service` et
`api-gateway` ont déjà livré le backend fonctionnel du flow (PR #195-199, mergées, déployées).
`learning-activity-service` publie 5 événements réels sur `visiomath:events`
(`docs/routes.md` > learning-activity-service > « Événements émis ») depuis ce chantier ; aucun
n'était consommé par `dashboard-notification-service` avant cette session.

Source de vérité utilisée : `docs/routes.md` (contrat exact des payloads, section
learning-activity-service) et `.claude/reports/learning-activity-service-evaluations-2026-09-01.md`.

## Ce qui a été livré

### 5 nouveaux `NotificationType`

`src/notification/entities/notification.entity.ts` :

- `EVALUATION_CORRECTION_REQUESTED = 'evaluation_correction_requested'`
- `EVALUATION_CORRECTION_ACCEPTED = 'evaluation_correction_accepted'`
- `EVALUATION_CORRECTION_DECLINED = 'evaluation_correction_declined'`
- `EVALUATION_CORRECTION_ALL_DECLINED = 'evaluation_correction_all_declined'`
- `EVALUATION_CORRECTED = 'evaluation_corrected'`

Aucune migration nécessaire : `notifications.type` est déjà un `varchar(64)` depuis la migration
`NotificationEventsConsumer1755100000000` (2026-08-14) — une nouvelle valeur technique ne requiert
aucune altération de schéma.

### 5 nouveaux handlers dans `EventProcessorService` (`src/events/event-processor.service.ts`)

Même discipline que tous les handlers existants du service : un échec de résolution de nom
(`profile-service` injoignable, `userId` non résolu) fait **échouer** `process()` — l'entrée Redis
reste non acquittée et sera rejouée par `XAUTOCLAIM`, jamais de notification créée avec un nom
manquant.

#### 1. `EvaluationCorrectionRequested`

- **Payload consommé** : `{correctionRequestId, attemptId, evaluationId, studentId, teacherIds}`
- **Destinataires** : chaque `teacherIds[]` individuellement + fan-out réel du rôle
  `responsable_pedagogique` (résolu via `IdentityAccessServiceClient.listUserIdsByRole`, un
  `userId` réel par compte RP).
- **`type`** : `evaluation_correction_requested`
- **`metadata`** :
  ```json
  {
    "correctionRequestId": "<uuid>",
    "attemptId": "<uuid>",
    "evaluationId": "<uuid>",
    "studentId": "<uuid>",
    "studentName": "Prénom Nom"
  }
  ```
- Le contrat documenté garantit `teacherIds.length >= 1` (un élève sans professeur lié bascule
  directement en `EvaluationCorrectionAllDeclined`, reason `no_linked_teacher`, côté
  `learning-activity-service`) — traité défensivement (`teacherIds ?? []`) mais ce cas vide n'est
  pas exercé par un test dédié, hors contrat.

#### 2/3. `EvaluationCorrectionAccepted` / `EvaluationCorrectionDeclined`

- **Payload consommé** : `{correctionRequestId, attemptId, evaluationId, studentId, teacherId}`
- **Destinataires** : rôle `responsable_pedagogique` uniquement (fan-out réel) — **le professeur
  qui vient d'agir n'est pas notifié de sa propre décision**, cohérent avec les autres flows du
  service (ex. le formateur qui accepte une proposition dans le flow demande de professeur n'est
  pas notifié de sa propre acceptation).
- **`type`** : `evaluation_correction_accepted` / `evaluation_correction_declined`
- **`metadata`** (identique pour les deux) :
  ```json
  {
    "correctionRequestId": "<uuid>",
    "attemptId": "<uuid>",
    "evaluationId": "<uuid>",
    "studentId": "<uuid>",
    "studentName": "Prénom Nom",
    "teacherId": "<uuid>",
    "teacherName": "Prénom Nom"
  }
  ```

#### 4. `EvaluationCorrectionAllDeclined`

- **Payload consommé** : `{correctionRequestId, attemptId, evaluationId, studentId, reason:
  "all_linked_teachers_declined" | "no_linked_teacher"}`
- **Destinataires** : rôle `responsable_pedagogique` uniquement (fan-out réel) — état actionnable,
  le RP doit gérer manuellement (corriger lui-même ou réassigner).
- **`type`** : `evaluation_correction_all_declined`
- **`metadata`** :
  ```json
  {
    "correctionRequestId": "<uuid>",
    "attemptId": "<uuid>",
    "evaluationId": "<uuid>",
    "studentId": "<uuid>",
    "studentName": "Prénom Nom",
    "reason": "all_linked_teachers_declined"
  }
  ```

#### 5. `EvaluationCorrected`

- **Payload consommé** : `{correctionRequestId, attemptId, evaluationId, studentId, teacherId,
  score, comment}`
- **Destinataires** : l'élève (`studentId`) uniquement.
- **`type`** : `evaluation_corrected`
- **`metadata`** :
  ```json
  {
    "correctionRequestId": "<uuid>",
    "attemptId": "<uuid>",
    "evaluationId": "<uuid>",
    "teacherId": "<uuid>",
    "teacherName": "Prénom Nom",
    "score": 15,
    "comment": "Bon travail, attention aux signes."
  }
  ```
  (`studentName` volontairement absent : le destinataire est l'élève lui-même, il n'a pas besoin
  de son propre nom.)

## Pour `front-developper` (à faire ensuite, non traité ici)

Ajouter les 5 nouveaux `type` à `notificationLabels.ts`. Propositions de libellés français
(à valider/ajuster) :

- `evaluation_correction_requested` :
  - Vue professeur/RP : « {studentName} demande une correction »
  - (le champ `evaluationId`/`attemptId` peut alimenter un lien profond vers
    `GET /evaluation-corrections/:id` une fois l'écran construit)
- `evaluation_correction_accepted` : « {teacherName} a pris en charge la correction de
  {studentName} »
- `evaluation_correction_declined` : « {teacherName} a refusé la correction de {studentName} »
- `evaluation_correction_all_declined` :
  - `reason: "no_linked_teacher"` : « Aucun professeur lié pour corriger {studentName} — à
    traiter manuellement »
  - `reason: "all_linked_teachers_declined"` : « Tous les professeurs liés ont refusé la
    correction de {studentName} — à traiter manuellement »
- `evaluation_corrected` : « Votre évaluation a été corrigée par {teacherName} — note :
  {score} »  (avec accès au `comment` si présent)

Aucun UUID (`correctionRequestId`, `attemptId`, `evaluationId`, `studentId`, `teacherId`) ne doit
être affiché directement — ils restent en `metadata` pour un usage de lien profond futur.

## Vérification contre la pile réelle (2026-09-02)

1. Service reconstruit et redéployé : `docker compose --env-file <repo>/.env -p claudevma build
   dashboard-notification-service` puis `up -d dashboard-notification-service` depuis la branche
   de travail (worktree agent). Conteneur reparti `healthy`.
2. Utilisateurs réels identifiés en base (`identity-access-service`, table `users`) : un élève
   (`e2e.verify.student2`), deux formateurs (`prof.lycee`, `prof.superieur`), 10 comptes RP.
3. Les 5 événements publiés directement sur le flux Redis réel (`XADD visiomath:events eventId ...
   eventName ... payload ...`) avec ces `userId` réels :
   - `EvaluationCorrectionRequested` (`teacherIds: [prof.lycee]`) → **1 notification pour le
     professeur ciblé + 10 notifications RP** (fan-out réel confirmé), `studentName` résolu
     "Camille Verify" dans les 11 lignes.
   - `EvaluationCorrectionAccepted` → **10 notifications RP**, `studentName`/`teacherName`
     résolus ("prof lycee").
   - `EvaluationCorrectionDeclined` (avec `prof.superieur`) → **10 notifications RP**,
     `teacherName` résolu ("prof superieur").
   - `EvaluationCorrectionAllDeclined` (`reason: no_linked_teacher`) → **10 notifications RP**,
     `reason` présent en metadata.
   - `EvaluationCorrected` (`score: 15, comment: "Bien joue"`) → **1 notification pour l'élève**,
     `teacherName` résolu, `score`/`comment` présents en metadata.
4. Idempotence vérifiée : republication du même `eventId` (`EvaluationCorrected`) sur le flux
   Redis → toujours **une seule** ligne `notifications` et **une seule** ligne `processed_events`
   pour cet `eventId` (vérifié par `SELECT count(*)` direct en base).
5. Toutes les vérifications faites par requête SQL directe (`docker exec visiomath_postgres
   psql ... SELECT ...`) sur la base réelle `visiomath_dashboard_notification`. Données de test
   nettoyées après coup (`DELETE FROM notifications`/`processed_events` sur les
   `correctionRequestId`/`eventId` de test — aucune donnée réelle affectée).

## Tests

`event-processor.service.spec.ts` : 5 nouveaux `describe` (12 nouveaux cas — fan-out
teacher+RP, fan-out RP seul pour Accepted/Declined via `it.each`, fan-out RP pour les deux
variantes de `reason` d'AllDeclined, notification élève pour Corrected, plus les cas d'échec de
résolution de nom pour chaque type déclenchant). Suite complète du service : **111 tests, tous
verts** (`npx jest`), et `npm run build` (nest build) sans erreur.

## Blocages / points ouverts

Aucun blocage. Contrairement à l'hypothèse initiale du chantier `learning-activity-service`
(point 2 de son rapport, "Aucune lecture de solution d'Exercice dans ce flux" déjà confirmé côté
métier), aucune route interservice supplémentaire n'était nécessaire côté
`dashboard-notification-service` : les 5 payloads portent déjà `studentId`/`teacherId(s)`
directement, la résolution de nom et le fan-out par rôle réutilisent l'infrastructure existante
sans modification.

Seul point resté hors périmètre, explicitement délégué à `front-developper` dans ce rapport :
les libellés français dans `notificationLabels.ts` pour les 5 nouveaux `type`.
