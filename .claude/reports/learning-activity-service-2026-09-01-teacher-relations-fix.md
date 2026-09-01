# Correctif — champ `teacherUserIds` sur le client de relations profile-service

Date : 2026-09-01
Branche : `fix/learning-activity-teacher-relations-field-name`
PR : https://github.com/tquatrework/ClaudeVMA/pull/199

## Contexte

Le module `evaluation-attempts/` (chantier "Refonte des Evaluations") avait construit son client
vers `profile-service` sur une hypothèse non confirmée, documentée comme telle : `GET
/internal/relations/teachers/:studentId` → `{teacherIds: string[]}`.

`profile-service` a livré la route réelle (PR #197, déployée) : elle renvoie en fait
`{studentId, teacherUserIds: string[]}` — cohérent avec le nom déjà utilisé pour la route
équivalente des parents financeurs (`financeOwnerUserIds`).

Bug confirmé en HTTP direct par l'orchestrateur : `POST
/evaluation-attempts/:id/request-correction` échouait systématiquement avec `502 "Réponse de
relations malformée (profile-service)"` car le client rejetait la réponse réelle du serveur en
attendant le mauvais nom de champ.

## Changements

1. **`services/learning-activity-service/src/evaluation-attempts/profile-relations-client.service.ts`**
   - Interface `LinkedTeachers` : `teacherIds` → `teacherUserIds`.
   - `isValidLinkedTeachers` : valide désormais `candidate.teacherUserIds`.
   - `getLinkedTeacherIds` : renvoie `body.teacherUserIds`.
   - Commentaire de tête réécrit : ce n'est plus une hypothèse non confirmée mais un contrat
     confirmé contre la PR #197 réellement déployée.

2. **`services/learning-activity-service/test/unit/evaluation-attempts/profile-relations-client.spec.ts`**
   - Les mocks de réponse HTTP envoient désormais `{studentId, teacherUserIds: [...]}`.
   - Le test de réponse malformée vérifie l'absence de `teacherUserIds` (au lieu de `teacherIds`).
   - Commentaire de tête mis à jour.

3. **`docs/routes.md`** (section "Contrats interservices" de `learning-activity-service`) — la
   note "HYPOTHÈSE non confirmée" est remplacée par "Contrat confirmé", avec référence à la PR
   #197 et à ce correctif.

4. **`docs/services/learning-activity-service.md`** — description du fichier
   `profile-relations-client.service.ts` mise à jour, et l'item de `pendingPoints` correspondant
   marqué "RÉSOLU le 2026-09-01".

## Ce qui n'a PAS été touché (hors périmètre)

Le champ `teacherIds` présent dans :
- `evaluation-attempts.service.ts` ligne 245 (payload de l'événement de domaine
  `EvaluationCorrectionRequested`) ;
- `evaluation-event-types.ts` (commentaire décrivant le même événement) ;
- `evaluation-attempts.service.spec.ts` ligne 293 (test de ce même événement).

Ce `teacherIds` est le nom de champ propre à l'événement de domaine émis par ce service
(`EvaluationCorrectionRequested`), indépendant du contrat `profile-service` corrigé ici. Il n'a
aucun rapport avec la réponse de `GET /internal/relations/teachers/:studentId` — laissé
strictement inchangé, conformément à la consigne "Ne touche à rien d'autre".

## Tests

`npm ci` puis `npm test` sur `services/learning-activity-service` (node_modules absents au
démarrage de la tâche, réinstallés) :

```
Test Suites: 13 passed, 13 total
Tests:       199 passed, 199 total
```

Inclut `profile-relations-client.spec.ts` et `evaluation-attempts.service.spec.ts`, tous deux
verts avec le nouveau contrat.

## Preuve HTTP directe

Non exécutée par cet agent — consigne explicite de la tâche ("je m'occupe moi-même du
build/déploiement"). À faire par l'orchestrateur après déploiement de la PR #199 :

```
POST /evaluation-attempts/:id/request-correction
```

sur une tentative déjà close, attendu : `201` (plus de `502`), avec au moins un professeur lié
dans `linkedTeacherIds`.

## Git

- Branche dédiée créée depuis `master` (aligné sur `a30e5da` au moment de la création).
- Commit unique, poussé sur `origin`.
- PR #199 ouverte, non mergée (attente de validation utilisateur + preuve HTTP post-déploiement).
- Branches non fusionnées dans `master` autres que celle de cette tâche, à rappeler à
  l'utilisateur : `feat/front-reprise-candidature-formateur`, `feat/reprise-candidature-formateur`
  (préexistantes, non liées à ce chantier).
