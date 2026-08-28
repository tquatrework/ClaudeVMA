# content-catalog-service — 2026-08-28 (session 3)

## Objectif

Trois manques réels signalés par l'utilisateur après vérification en production (PR #152/#160
mergées) :
1. Aucune route d'édition d'un Quizz.
2. Aucun point d'entrée pour retrouver ses propres Quizz (filtre "mes Quizz").
3. Validation AP d'un Quizz non restreinte par la relation `animator_of_teacher`.

Plus une vérification annexe : compatibilité des champs Quizz avec la syntaxe LaTeX (`$`, `\`).

Conforme à l'arbitrage `docs/architecture.md`, section "Edition d'un Quizz par son auteur, filtre
mes Quizz, et validation AP scopée par relation" (2026-08-28).

## Livré

### 1. `PUT /quizzes/:id` — édition réservée à l'auteur

- Body de même forme que `POST /quizzes` (nouveau `UpdateQuizDto extends CreateQuizDto`).
- `404` si le quizz n'existe pas, `403` si l'appelant n'est pas `authorId`, `400` si une question
  est mal formée (réutilise `validateQuestionDto`).
- Effet sur le statut : auteur `formateur` → repasse toujours en `pending_validation` (quel que
  soit le statut précédent — `validated`, `pending_validation` ou `rejected`) ; auteur AP/RP sur
  son propre quizz → statut inchangé.
- Remplacement intégral des questions (delete + recréation), même approche que la création.

### 2. Filtre `GET /quizzes?mine=true`

- Ajouté à `SearchQuizDto`. Quand vrai, ignore le filtre de visibilité par défaut et ne renvoie
  que `quiz.authorId = callerId`, tous statuts confondus (y compris `rejected`) — y compris pour
  un appelant administratif (RP/AP/TI voient alors uniquement leurs propres créations, pas tout).
- `@Transform` explicite (`value === true || value === 'true'`) plutôt que `@Type(() => Boolean)`,
  qui aurait accepté `?mine=false` comme vrai (`Boolean('false') === true` en JS).

### 3. Validation AP scopée par relation `animator_of_teacher`

- Nouveau client `ProfileRelationsClient` (`src/common/clients/`), fetch natif Node 20 (aucune
  dépendance axios ajoutée), appelle `GET /internal/relations/:viewerId/:targetId?viewerRole=
  animateur_pedagogique` sur `profile-service`, header `X-Internal-Secret`.
  - 404 (cible inconnue de profile-service) → traité comme "pas de relation", pas une panne.
  - Toute autre erreur (réseau, 5xx) → `ServiceUnavailableException` (503), échec fermé.
- `GET /quizzes/pending-validation` : pour un AP, charge tous les quizz en attente, filtre par
  relation (un appel par auteur unique), puis pagine en mémoire. RP inchangé (comportement
  historique, pagination SQL).
- `POST /validations/quiz/:id/decision` : pour un AP, vérifie la relation avec l'auteur du quizz
  avant de permettre la décision (403 sinon). RP inchangé, aucun appel à `profile-service`.
  Restriction strictement limitée à `ContentType.QUIZ` — exercice/évaluation/tutoriel non touchés.
- `docker-compose.yml` : ajout de `PROFILE_SERVICE_URL: http://profile-service:3002` au bloc
  `content-catalog-service` (absent jusqu'ici, ce service n'appelait aucun autre service).

### 4. Compatibilité LaTeX

Aucune règle `@Matches` ou équivalent trouvée sur `prompt`/`options[].text`/`keywords` — déjà
conforme. Confirmé par un test dédié (`class-validator` sur un DTO contenant `$`, `\(`, `\)`,
`$$`, `\int`, `\frac`) et par un appel HTTP réel (création d'un quizz avec ces caractères,
round-trip vérifié dans la réponse). Aucune modification nécessaire.

## Bug réel trouvé et corrigé pendant la vérification HTTP

`update()` provoquait un **500 réel** dès la première édition testée contre le conteneur
redéployé : `QueryFailedError: null value in column "quizId" ... violates not-null constraint`.

Cause : le `findOne()` initial chargeait `relations: ['questions']`. L'entité `quiz.questions`
portait donc les anciennes lignes `QuizQuestion`, qui étaient ensuite supprimées par
`quizQuestionRepository.delete({quizId})`. Au `quizRepository.save(quiz)` final, TypeORM tentait
de persister ce tableau désormais périmé, provoquant une tentative d'`UPDATE` sur des lignes qui
n'existaient plus.

Corrigé en retirant `relations: ['questions']` du `findOne()` de `update()` : les questions
existantes n'ont jamais besoin d'être lues puisqu'elles sont remplacées intégralement. **Ce bug
était invisible aux tests unitaires** (repository mocké, aucun comportement TypeORM réel) — seule
la vérification HTTP directe contre le conteneur réel l'a révélé, conformément à la règle du
projet sur la définition de "terminé".

## Preuves

### Tests

- `npm run build` : 0 erreur.
- `npm test` : **205/205 tests verts, 17 suites** (182 précédents + 23 nouveaux).
  - `profile-relations.client.spec.ts` : relation présente/absente, 404 traité comme non-panne,
    `ServiceUnavailableException` sur erreur réseau/5xx.
  - `latex-compatibility.spec.ts`.
  - Extension de `quizzes.service.spec.ts` (`update()`, `mine=true`, scoping AP avec/sans
    relation, propagation 503) et `validations.service.quiz.spec.ts` (scoping AP sur la décision).

### HTTP direct contre le conteneur réel redéployé

Image reconstruite depuis le worktree corrigé (`docker build`), retaguée
`claudevma-content-catalog-service:latest`, conteneur recréé en place avec les mêmes variables
d'environnement + `PROFILE_SERVICE_URL=http://profile-service:3002` (réseau `claudevma_visiomath_
network`, alias `content-catalog-service`/`visiomath_content_catalog`, `restart: unless-stopped`).

| Vérification | Résultat |
|---|---|
| `PUT /quizzes/:id` par un tiers non-auteur | `403 Forbidden` |
| `PUT /quizzes/:id` par l'auteur formateur sur un quizz `validated` | `200`, statut repasse à `pending_validation`, questions remplacées |
| `PUT /quizzes/:id` sur un id inexistant | `404` |
| `GET /quizzes?mine=true` (auteur) | ne renvoie que ses propres quizz, y compris `pending_validation` |
| `GET /quizzes?keyword=...` (autre formateur) | le quizz `pending_validation` d'un tiers reste invisible |
| Relation `animator_of_teacher` créée réellement via `profile-service` (`POST /relations/animator-teacher` par un RP) | `201` |
| `GET /quizzes/pending-validation` par l'AP lié | ne voit que le quizz du formateur animé (1/2 quizz en attente) |
| `GET /quizzes/pending-validation` par un AP non lié | liste vide |
| `POST /validations/quiz/:id/decision` par l'AP lié | `201`, validation réussie |
| `POST /validations/quiz/:id/decision` par un AP non lié | `403 "Vous ne pouvez valider que les quizz des formateurs que vous animez"` |
| `POST /validations/quiz/:id/decision` par le RP | `201`, sans jamais interroger la relation |
| Création d'un quizz avec `$`, `\int`, `\frac` dans `prompt`/`keywords` | `201`, caractères conservés tels quels dans la réponse |

Le 503 (profile-service injoignable) n'a été vérifié qu'en tests unitaires (mocks) — arrêter
`profile-service` sur la pile partagée aurait risqué de perturber d'autres travaux en cours sur
la même machine, jugé disproportionné pour ce seul cas.

## Points ouverts

- **Routage `api-gateway`** pour `PUT /quizzes/:id` et le paramètre `mine` non vérifié : le
  conteneur `visiomath_gateway` observé sur cette pile est un nginx (pas le NestJS documenté
  comme api-gateway dans l'architecture), et aucun préfixe testé (`/api/quizzes`, `/quizzes`,
  `/api/content-catalog/quizzes`) n'a atteint `content-catalog-service` au travers de lui — sujet
  hors périmètre de ce service, à vérifier par le propriétaire d'api-gateway si le front en a
  besoin.
- 503 non prouvé en conditions réelles (voir ci-dessus), uniquement en tests unitaires.

## Branches non fusionnées (rappel, hors périmètre de cette tâche)

- `feat/quiz-edit-mine-ap-scoping` (celle-ci, PR #164 ouverte, non mergée).
- `feat/front-reprise-candidature-formateur` (non liée à ce chantier).
- `feat/reprise-candidature-formateur` (non liée à ce chantier).

## Fichiers modifiés/créés

- `services/content-catalog-service/src/common/clients/profile-relations.client.ts` (nouveau)
- `services/content-catalog-service/src/common/clients/profile-client.module.ts` (nouveau)
- `services/content-catalog-service/src/quizzes/dto/update-quiz.dto.ts` (nouveau)
- `services/content-catalog-service/src/quizzes/dto/search-quiz.dto.ts` (modifié — `mine`)
- `services/content-catalog-service/src/quizzes/quizzes.service.ts` (modifié — `update()`,
  `search()`, `getPendingValidation()`)
- `services/content-catalog-service/src/quizzes/quizzes.controller.ts` (modifié — route `PUT`)
- `services/content-catalog-service/src/quizzes/quizzes.module.ts` (modifié)
- `services/content-catalog-service/src/validations/validations.service.ts` (modifié — scoping AP)
- `services/content-catalog-service/src/validations/validations.module.ts` (modifié)
- `docker-compose.yml` (modifié — `PROFILE_SERVICE_URL` pour `content-catalog-service`)
- `docs/services/content-catalog-service.md` (mis à jour)
- Tests : `test/unit/common/clients/profile-relations.client.spec.ts` (nouveau),
  `test/unit/quizzes/latex-compatibility.spec.ts` (nouveau),
  `test/unit/quizzes/quizzes.service.spec.ts` (étendu),
  `test/unit/validations/validations.service.quiz.spec.ts` (étendu),
  `test/unit/validations/validations.service.rules.spec.ts` (provider ajouté),
  `test/unit/validations/validations.service.spec.ts` (provider ajouté)

## PR

https://github.com/tquatrework/ClaudeVMA/pull/164 (ouverte, non mergée — pas de merge sans
validation, conformément aux règles du projet)
