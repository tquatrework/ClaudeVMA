# profile-service — 2026-08-11 — la relation ouvre le droit sur les statistiques

Branche `feat/acces-stats-archives-relations`, commits `172f45f`, `ab424c3`, `31926f4` (poussés).
Conteneur `visiomath_profile` reconstruit et recréé ; migration jouée contre la base réelle.

## 1. Ce que faisait `GET /profiles/:userId/statistics` avant

Il appelait `assertReadAccess`, écrite pour la lecture d'un **profil**. Mesuré contre la pile
réelle, via le gateway, avec des jetons issus de `POST /auth/login` :

| Appel | Avant |
|---|---|
| élève → statistiques de SON formateur | `403 "An élève may only view their own profile"` |
| parent → formateur de son élève | `403 "A parent may only view profiles of students…"` |
| formateur → élève non relié | `403` |
| AP sans aucun lien → n'importe qui | **autorisé** (aucune clause ne le concernait) |
| titulaire, parent → son élève, formateur → son élève, RP | `200` |

Deux défauts : l'AP passait par défaut alors qu'il n'est pas administrateur, et un refus (`403`)
se distinguait d'une absence de données (`404`) — donc révélait l'existence de la ressource.

## 2. Ce qu'il fait maintenant

Le contrôle porte sur la **relation** (`RelationsService.resolveRelations` +
`resolveStatisticsViewerPosition`), jamais sur une liste de rôles — sauf pour reconnaître un
administrateur. Décorateur `@OwnerAccess()` repris à l'identique de `finance-credit-service`.

| Lecteur | Cible | Résultat | Filtrage champ par champ |
|---|---|---|---|
| titulaire | lui-même | 200 | non |
| RP, AF, TI | tout le monde | 200 | non |
| parent financeur | ses élèves | 200 | non |
| parent financeur | formateurs de ses élèves (indirect) | 200 | **oui** |
| élève | ses formateurs | 200 | oui |
| formateur | ses élèves | 200 | oui |
| AP | formateurs qu'il anime | 200 | non |
| toute autre paire | — | **404**, message identique à « pas de statistiques » | — |

Le refus est prononcé **avant** toute lecture en base (test dédié). L'AP n'est **pas** un
administrateur : sans lien d'animation, il ne voit les statistiques de personne.

## 3. Contrat de la route interne

`GET /internal/relations/:viewerId/:targetId?viewerRole=<rôle>` — en-tête
`X-Internal-Secret`, `x-correlation-id` propagé, hors Swagger public.

`viewerRole` obligatoire : `400` explicite listant les valeurs acceptées.

```json
{ "viewerId": "…", "targetId": "…", "isSelf": false, "isAdministrator": false,
  "relations": [ { "kind": "teacher_of_student", "isPrincipalTeacher": true } ] }
```

`kind` (orienté lecteur → cible) : `finance_owner_of_student`, `student_of_finance_owner`,
`teacher_of_student`, `student_of_teacher`, `animator_of_teacher`, `teacher_of_animator`,
`coordinator_of_student`, `student_of_coordinator`, `finance_owner_of_student_of_teacher`,
`teacher_of_student_of_finance_owner`. Les deux derniers portent `throughUserIds` (l'élève commun).

La route renvoie des **faits**, pas un verdict : `archive-document-service` décide lui-même, et
peut distinguer « élève de ce formateur » (statistiques oui, archives non) de « formateur de cet
élève » (les deux).

## 4. `/my-students`

Le `403` du formateur **n'est pas dans ce service**. `MyStudentsPage` appelle
`fetchLinkedStudents(user.id)` → `GET /relations/finance-owner-student/:id`, qui répond **`200 []`**
à un formateur sur son propre identifiant (vérifié en direct et via le gateway, avec un jeton de
connexion réel). La page interroge la table des liens **financeur↔élève** ; les élèves d'un
formateur vivent dans `teacher_student_links`. Le formateur voit donc une liste **vide**.

`GET /relations/my-contacts` fournit la liste correcte pour tous les rôles, en un appel, avec
prénom et nom. Correctif front à faire (également sur `PedagogicalArchivePage`, qui affiche
`ELV-{uuid}` en repli — un UUID à l'écran).

## 5. Fichiers back modifiés

Créés : `src/relations/relation-kind.ts`, `src/relations/pedagogical-access.policy.ts`,
`src/relations/entities/animator-teacher-link.entity.ts`,
`src/relations/dto/create-animator-teacher-link.dto.ts`,
`src/migrations/1754960000000-CreateAnimatorTeacherLinks.ts`,
`src/internal/dto/resolve-relation.query.dto.ts`,
`src/common/decorators/owner-access.decorator.ts`,
`test/e2e/pedagogical-access.e2e-spec.ts`,
`test/unit/relations/pedagogical-access.policy.spec.ts`.

Modifiés : `src/relations/relations.service.ts`, `relations.controller.ts`, `relations.module.ts`,
`src/profiles/profiles.service.ts`, `profiles.controller.ts`, `src/internal/internal.service.ts`,
`internal.controller.ts`, `src/common/guards/roles.guard.ts`, `src/events/events.service.ts`,
`test/unit/relations/relations.service.spec.ts`, `test/unit/profiles/profiles.service.spec.ts`,
`test/unit/common/roles.guard.spec.ts`, `docs/routes.md`, `docs/services/profile-service.md`.

## 6. Tests

Unitaires 515/515. E2E 233/234 — seul échec `[PROF-BR-010]`, laissé rouge à dessein depuis le
2026-08-04, sans lien. Build OK.

## 7. Points en suspens

1. **Front** : `/my-students` et `/archives` doivent passer par `GET /relations/my-contacts`.
2. **`GET /profiles/:userId` non aligné** : il exempte encore l'AP par son rôle et refuse à l'élève
   le profil de son formateur. Les statistiques y sont désormais plus strictes que le profil qui
   sert les mêmes champs.
3. **Aucun lien AP↔formateur en base** hors le jeu de vérification : la table naît vide et aucun
   écran ne permet d'en créer (route RP `POST /relations/animator-teacher`).
4. **Distinction RP/AF/TI** non codée, comme demandé — une constante et une fonction à décliner.
