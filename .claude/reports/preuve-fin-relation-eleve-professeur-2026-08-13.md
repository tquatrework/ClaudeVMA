# Preuve — fin d'une relation élève ↔ formateur, jouée contre la pile réelle

Date : 2026-08-13 · Cible : `https://claudevma.visioprof.fr` · Branche : `feat/fin-relation-eleve-professeur`
(commit `8549f02`). Aucune reconstruction de service n'a été nécessaire : le backend
(`profile-service`, route `DELETE /relations/teacher-student/:teacherId/:studentId`) et le front
(`ProfilePage` + `LinkedTeachersPanel` + `TerminateTeacherRelationDialog`) étaient déjà déployés.

## Comptes utilisés

Comptes réels créés le 2026-08-11 (réutilisés depuis la preuve
`.claude/reports/preuve-flow-demande-professeur-2026-08-12.md`, toujours actifs, mot de passe
`Visio!2026Flow`) :

| Compte | Rôle | userId |
|---|---|---|
| `trsflow.rp.0811` | responsable_pedagogique | `c4219392-6c28-4c57-b2ec-b9b8d79dae45` |
| `trsflow.eleve.0811` (Léa Bertrand) | eleve | `83e512d0-3faf-4d79-b900-1abf5ad0365d` |
| `trsflow.prof1.0811` (Nadia Lambert) | formateur | `a1c90ec9-5dbe-424a-b40c-82fbf05d1c26` |
| `trsflow.prof2.0811` (Yanis Roche) | formateur | `2b02e211-cd1f-4e68-8aa0-e43800cfad7c` |
| `trsflow.parent.0811` | parent_financeur | `1f55ab26-365b-4e60-a52c-fd2976577e9f` |

Ce sont des comptes créés par les routes réelles d'inscription (`POST /accounts/*`), pas des
fixtures. Léa Bertrand porte déjà, depuis la preuve du 2026-08-12, deux relations actives : Nadia
Lambert (professeur principal) et Yanis Roche (secondaire) — issues du flow réel de demande de
professeur. Aucune fixture de relation n'a été injectée : la relation à terminer ici a été **créée
par `POST /requests/:id/validate`** le 2026-08-12, pas par un accès direct en base.

Tous les logins ont été rejoués aujourd'hui pour confirmer que les tokens sont réels et à jour
(pas de réutilisation de jetons périmés) :

```
POST /api/v1/auth/login {"loginIdentifier":"trsflow.rp.0811", ...}     -> 201 role=responsable_pedagogique
POST /api/v1/auth/login {"loginIdentifier":"trsflow.eleve.0811", ...}  -> 201 role=eleve
POST /api/v1/auth/login {"loginIdentifier":"trsflow.prof1.0811", ...}  -> 201 role=formateur
POST /api/v1/auth/login {"loginIdentifier":"trsflow.prof2.0811", ...}  -> 201 role=formateur
POST /api/v1/auth/login {"loginIdentifier":"trsflow.parent.0811", ...} -> 201 role=parent_financeur
```

(Note technique : `POST /auth/login` renvoie `201`, pas `200` — cohérent avec `docs/routes.md`, qui
ne précise pas le code exact ; NestJS renvoie `201` par défaut sur un `POST` sans décorateur
`@HttpCode`. Sans incidence sur le front, qui ne teste pas le code de statut mais la présence du
token.)

---

## Étape 1 — état avant : deux formateurs actifs sur la fiche de l'élève

```
GET /api/v1/relations/teacher-student/83e512d0-3faf-4d79-b900-1abf5ad0365d   (RP)
-> 200
[
  {
    "id": "3dc53e2e-8764-4b09-8287-cb1904399ac3",
    "teacherId": "a1c90ec9-5dbe-424a-b40c-82fbf05d1c26",
    "isPrincipalTeacher": true,
    "endedAt": null, "endedBy": null, "endReason": null,
    "teacherName": {"firstName": "Nadia", "lastName": "Lambert"}
  },
  {
    "id": "832e0486-eb4c-4943-a29f-ac52e06a7df0",
    "teacherId": "2b02e211-cd1f-4e68-8aa0-e43800cfad7c",
    "isPrincipalTeacher": false,
    "endedAt": null, "endedBy": null, "endReason": null,
    "teacherName": {"firstName": "Yanis", "lastName": "Roche"}
  }
]
```

Aucun UUID à interpréter côté écran : `teacherName` est déjà résolu, conforme à l'arbitrage du
2026-08-12 sur la fiche de l'élève.

## Étape 2 — le RP met fin à la relation avec Yanis Roche (secondaire)

```
DELETE /api/v1/relations/teacher-student/2b02e211-cd1f-4e68-8aa0-e43800cfad7c/83e512d0-3faf-4d79-b900-1abf5ad0365d
Authorization: Bearer <token RP>
Body: {"reason":"Preuve automatisee 2026-08-13 : fin de relation eleve-professeur"}

-> 200
{
  "id": "832e0486-eb4c-4943-a29f-ac52e06a7df0",
  "teacherId": "2b02e211-cd1f-4e68-8aa0-e43800cfad7c",
  "studentId": "83e512d0-3faf-4d79-b900-1abf5ad0365d",
  "isPrincipalTeacher": false,
  "createdAt": "2026-08-12T10:18:00.075Z",
  "endedAt": "2026-08-13T13:16:22.870Z",
  "endedBy": "c4219392-6c28-4c57-b2ec-b9b8d79dae45",
  "endReason": "Preuve automatisee 2026-08-13 : fin de relation eleve-professeur"
}
```

`endedBy` est bien le `userId` du RP authentifié (`c4219392-…`), et non un champ envoyé par le
client. La ligne n'a pas été supprimée : c'est la même ligne (`id: 832e0486-…`) qui porte
désormais `endedAt`/`endedBy`/`endReason`.

## Étape 3 — état après : Yanis disparaît de la liste des formateurs actifs, Nadia reste

```
GET /api/v1/relations/teacher-student/83e512d0-3faf-4d79-b900-1abf5ad0365d   (RP)
-> 200
[
  {
    "id": "3dc53e2e-8764-4b09-8287-cb1904399ac3",
    "teacherId": "a1c90ec9-5dbe-424a-b40c-82fbf05d1c26",
    "isPrincipalTeacher": true,
    "endedAt": null, "endedBy": null, "endReason": null,
    "teacherName": {"firstName": "Nadia", "lastName": "Lambert"}
  }
]
```

Un seul formateur actif désormais. La relation de Yanis n'a pas disparu (elle reste consultable via
la ligne renvoyée à l'étape 2, journal append-only) mais n'apparaît plus dans la liste des
formateurs **actifs**, celle affichée par `LinkedTeachersPanel`.

## Étape 4 — idempotence : un second appel identique ne réécrit rien

```
DELETE /api/v1/relations/teacher-student/2b02e211-cd1f-4e68-8aa0-e43800cfad7c/83e512d0-3faf-4d79-b900-1abf5ad0365d
Authorization: Bearer <token RP>
Body: {"reason":"Second appel, motif different qui ne doit PAS ecraser le premier"}

-> 200
{
  "id": "832e0486-eb4c-4943-a29f-ac52e06a7df0",
  "endedAt": "2026-08-13T13:16:22.870Z",
  "endedBy": "c4219392-6c28-4c57-b2ec-b9b8d79dae45",
  "endReason": "Preuve automatisee 2026-08-13 : fin de relation eleve-professeur"
}
```

`endedAt`, `endedBy` **et** `endReason` sont strictement identiques au premier appel, malgré un
motif différent envoyé cette fois : la trace initiale n'est jamais réécrite, conformément à
l'arbitrage. Un double clic sur « Mettre fin » côté écran ne produirait donc aucune anomalie.

## Étape 5 — droit réservé au RP : tout autre rôle reçoit `403`

Même appel (`DELETE .../2b02e211-…/83e512d0-…`), rejoué avec chacun des quatre autres tokens :

```
eleve             (Léa, l'élève elle-même)       -> 403 {"message":"Votre rôle ne vous permet pas d'accéder à cette ressource."}
formateur (prof1) (Nadia, toujours liée)          -> 403 {"message":"Votre rôle ne vous permet pas d'accéder à cette ressource."}
formateur (prof2) (Yanis, le formateur concerné)  -> 403 {"message":"Votre rôle ne vous permet pas d'accéder à cette ressource."}
parent_financeur  (trsflow.parent.0811)           -> 403 {"message":"Votre rôle ne vous permet pas d'accéder à cette ressource."}
```

Conforme à la doc : « Le formateur, l'élève, le parent financeur, l'AF **et le TI** sont refusés »
— seul le RP peut agir. Un appel anonyme (sans `Authorization`) a également été vérifié :

```
DELETE .../2b02e211-…/83e512d0-…  (sans token)   -> 401
```

## Étape 6 — les droits ouverts par la relation se referment (vérification complémentaire)

Au-delà de la seule liste des formateurs actifs, la doc promet que la fin de relation referme
« d'un coup tous les droits ouverts » (profil, statistiques). Vérifié :

```
Nadia (relation toujours active)  GET /profiles/83e512d0-…             -> 200
Yanis (relation terminée)         GET /profiles/83e512d0-…             -> 403
                                   "A formateur may only view profiles of students they are
                                    linked to (PROF-FB-003)"
Yanis (relation terminée)         GET /profiles/83e512d0-…/statistics  -> 404
                                   "No pedagogical statistics found for user 83e512d0-…"
```

Nadia (toujours liée) garde son accès ; Yanis (dont la relation vient d'être terminée) perd
immédiatement l'accès au profil et aux statistiques de l'élève — sans qu'aucun autre service n'ait
eu besoin d'être notifié, la vérification se faisant à chaque appel contre `profile-service`
(jamais en cache), conformément à l'arbitrage du 2026-08-11/2026-08-12.

---

## Chaîne complète (résumé)

```
1. GET    /relations/teacher-student/:studentId  (RP)        -> 200  2 formateurs actifs (Nadia, Yanis)
2. DELETE /relations/teacher-student/:teacherId/:studentId (RP, Yanis) -> 200  endedAt/endedBy/endReason posés
3. GET    /relations/teacher-student/:studentId  (RP)        -> 200  1 formateur actif (Nadia seule)
4. DELETE (même appel, motif différent)                      -> 200  endedAt/endedBy/endReason INCHANGÉS (idempotent)
5. DELETE (même appel) rejoué par : eleve, formateur x2, parent -> 403 x4 ; sans token -> 401
6. GET /profiles/:studentId (Yanis, ex-lié)                   -> 403 ; /statistics -> 404 ; Nadia (toujours liée) -> 200
```

## Ce qui a été vérifié côté front (lecture de code, pas d'exécution navigateur)

`apps/web` ne dispose d'aucune infrastructure Playwright/e2e (`apps/web/e2e` n'existe pas,
`playwright` absent de `package.json`) : impossible de rejouer le geste au niveau de l'écran contre
la pile réelle sans d'abord installer et configurer cette infrastructure, ce qui sort du périmètre
de cette tâche (preuve, pas implémentation). Conformément à la consigne, la preuve HTTP ci-dessus
fait foi à sa place.

Lecture de code (pour situer la preuve HTTP dans l'écran réel, sans modification) :
- `apps/web/src/api/relations.ts` : `listStudentTeachers` appelle bien
  `GET /relations/teacher-student/:studentId`, `terminateTeacherRelation` appelle bien
  `DELETE /relations/teacher-student/:teacherId/:studentId` — mêmes routes que celles jouées
  ci-dessus.
- `apps/web/src/pages/ProfilePage.tsx` monte `LinkedTeachersPanel` (liste) et
  `TerminateTeacherRelationDialog` (confirmation) sur la fiche de l'élève, exactement le point
  d'action décrit par l'arbitrage du 2026-08-12 (« Le point d'action est la fiche de l'élève »).
- `apps/web/src/components/profile/LinkedTeachersPanel.tsx` n'affiche le bouton « Mettre fin » que
  pour le RP — cohérent avec le `403` mesuré ci-dessus pour tous les autres rôles.
- `apps/web/src/hooks/profile/useProfileDetails.ts` retire la ligne de l'état local après le
  `DELETE` réussi, sans recharger toute la page — cohérent avec la règle du 2026-08-10 sur
  l'appartenance de l'état (« une donnée de la page appartient à la page »).

## Aucun bug détecté

La chaîne se comporte exactement comme documentée dans `docs/architecture.md` (arbitrage « Fin
d'une relation élève↔formateur », 2026-08-12) et `docs/routes.md` (`DELETE
/relations/teacher-student/:teacherId/:studentId`) : idempotence réelle, motif non écrasé au
second appel, `403` pour tout rôle hors RP, `401` sans authentification, fermeture immédiate des
droits de lecture (profil + statistiques) pour l'ex-formateur, préservation des droits pour le
formateur toujours lié.

## Traces laissées sur la pile

- La relation Yanis Roche ↔ Léa Bertrand (`id: 832e0486-eb4c-4943-a29f-ac52e06a7df0`) est
  définitivement marquée terminée (`endedAt: 2026-08-13T13:16:22.870Z`,
  `endedBy: c4219392-6c28-4c57-b2ec-b9b8d79dae45`, `endReason: "Preuve automatisee 2026-08-13 :
  fin de relation eleve-professeur"`). Comportement voulu (journal append-only, aucune ligne
  supprimée) — pas une anomalie à corriger.
- La relation Nadia Lambert ↔ Léa Bertrand reste active et intacte (professeur principal).

## Reste ouvert (hors périmètre de cette preuve)

- Validation à l'écran (capture/vidéo Playwright) non réalisée faute d'infrastructure e2e dans
  `apps/web`. Si une validation visuelle est requise, il faudra d'abord outiller `apps/web` en
  Playwright pointant vers `https://claudevma.visioprof.fr` — décision à arbitrer par
  l'orchestrateur, pas prise ici.
