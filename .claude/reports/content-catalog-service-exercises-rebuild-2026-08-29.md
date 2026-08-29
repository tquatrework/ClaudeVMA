# content-catalog-service — Refonte des Exercices (2026-08-29)

## Contexte

Remplacement du modèle `Exercise`/`ExercisePart`/`ExerciseSolution`/`ExerciseAnswer`/
`ExerciseCorrection` (chantier de juin 2026) par le modèle posé dans `docs/architecture.md`,
section « Refonte des Exercices », rédigée après un précédent état des lieux de ce même service.
Chantier mené en parallèle de `learning-activity-service` (autre agent), sur un contrat interne
figé à l'avance.

Branche : `feat/exercises-rebuild-content-catalog`
PR : https://github.com/tquatrework/ClaudeVMA/pull/184 (ouverte, non mergée)

## Ce qui a été livré

### 1. Structure en blocs ordonnés

- `Exercise` : titre désormais optionnel, `tags` migré en `text[]` postgres natif (comme `Quiz`,
  pour une recherche exacte `ANY(tags)`), `statement`/`correctionCost` retirés.
- `ExercisePart` : gagne `category: 'statement'|'question'`, plusieurs blocs `statement` possibles,
  librement entrelacés avec des blocs `question`. `content`/`expectedAnswer` retirés.
- Nouvelle entité `ExerciseContentItem` : item texte/formule/image, rattaché à **exactement un**
  parent (`partId` OU `solutionId`, jamais les deux) — une seule table plutôt que deux tables
  dupliquées, puisque bloc et solution partagent la même forme de contenu.
- `ExerciseSolution` : devient 1-à-1 avec un bloc `question` (`partId` unique, FK obligatoire) ;
  `cost`/`isOfficial`/`isValidated` et les solutions concurrentes retirés.

### 2. Images — premier stockage binaire propre à ce service

- `ExerciseImageTranscoder` (sharp) : détection sur les octets réels, ré-encodage systématique en
  WebP (1600px max, ratio préservé), SVG refusé, métadonnées EXIF supprimées — port direct du
  patron déjà éprouvé pour l'avatar (`profile-service`, 2026-08-10).
- `ExerciseImageStorageService` : volume Docker nommé dédié `content_catalog_exercise_images`,
  nom de fichier généré côté serveur.
- Route publique `GET /exercises/:id/images/:itemId` : sert uniquement les images de **bloc**
  (jamais de solution, 404 explicite), revérifie la visibilité de l'exercice à chaque appel.
- Upload : `POST /exercises/:id/parts/:partId/images` et
  `POST /exercises/:id/parts/:partId/solution/images` (multipart, auteur uniquement, fait repasser
  l'exercice en `pending_validation` si l'auteur est formateur).

### 3. Droits et validation alignés sur le Quizz

- Statut fixé au rôle à la création (`pending_validation` formateur, `validated` AP/RP).
- Édition (`PUT /exercises/:id`) réservée à l'auteur, remplacement intégral, mêmes règles de
  transition de statut que `Quiz.update()`.
- Validation RP illimitée / AP scopé par la relation `animator_of_teacher` — **le scoping AP, déjà
  construit pour le Quizz (PR #164), est désormais étendu à `ContentType.EXERCISE`** dans
  `ValidationsService.validateContent()`. Evaluation/Tutorial restent explicitement inchangés
  (vérifié par un test dédié qui confirme qu'aucune relation n'est consultée pour ces deux types).

### 4. Tags enfin appliqués en recherche

`GET /exercises` filtre désormais réellement par `tag` (`ANY(tags)`) — gap confirmé et corrigé,
comme demandé sans délai.

### 5. Retrait d'`ExerciseAnswer`/`ExerciseCorrection`

Entités, contrôleur (`ExerciseAnswersController`) et routes (`POST /exercises/:id/answers`,
`POST /exercise-answers/:id/correction-requests`, `POST /exercises/:id/solutions`,
`GET /exercises/:id/solutions/official`) supprimés. Ce cycle de vie (réponse de l'élève, tentative,
historique) relève désormais de `learning-activity-service`.

### 6. Contrat interne avec `learning-activity-service`

- `GET /exercises/:id` (publique) renvoie la structure complète des blocs, jamais le contenu d'une
  solution — seulement `hasSolution: boolean` sur un bloc `question`.
- `POST /internal/exercises/:exerciseId/parts/:partId/solution` (interne, `X-Internal-Secret`) :
  renvoie le contenu complet de la solution, même forme que le contenu des blocs. Pour un item
  image, l'`id` de l'item sert directement de référence.
- `GET /internal/exercises/images/:itemId` (interne) : octets de n'importe quelle image (bloc ou
  solution), sans vérification de visibilité — cette responsabilité appartient à
  `learning-activity-service`, en amont de l'appel.

Les deux routes internes sont exclues de Swagger et ne sont jamais exposées par `api-gateway`.

## Limites connues, assumées et documentées

1. **`PUT /exercises/:id` supprime les images déjà envoyées** (remplacement intégral des blocs,
   même patron que `Quiz.update()`, aucune identité stable côté client pour un diff fin). Les
   fichiers orphelins sont supprimés du volume pour ne rien laisser traîner ; les images doivent
   être renvoyées après une édition. Documenté dans le code, `docs/routes.md` et le rapport détaillé
   (`docs/services/content-catalog-service.md`).
2. **Pas de route `.../images/constraints`** exposant le plafond de taille (500 000 octets) au
   front, contrairement à l'avatar ou à l'import Quizz — non explicitement redemandé par
   l'arbitrage pour ce chantier, documentation seule pour l'instant.
3. **Aucune preuve HTTP contre la pile réelle** : pas de conteneur reconstruit, pas de requête
   multipart réelle exécutée. `learning-activity-service` étant développé en parallèle sur le même
   contrat par un autre agent, une preuve bout-en-bout des deux services ensemble n'était de toute
   façon pas réalisable dans cette session isolée — à faire une fois les deux PR mergées.

## Vérifications effectuées

- `npm install` (ajout de `sharp` ^0.34.5) : ok, 806 paquets.
- `npm run build` : 0 erreur.
- `npm test` : **272/272 tests verts, 22 suites** — inclut les nouveaux fichiers de test
  (`exercises.service.spec.ts` réécrit, `exercises.service.images.spec.ts`,
  `exercise-image-transcoder.spec.ts`, `validations.service.exercise-scoping.spec.ts`) et toutes
  les suites préexistantes (Quizz, Évaluations, Tutoriels, Contents, Validations), corrigées pour
  le nouveau schéma `Exercise` et le nouveau comportement de scoping AP.
- `docker-compose.yml` reste un YAML valide après l'ajout du volume et de la variable
  d'environnement (`python3 -c "import yaml; yaml.safe_load(...)"`).

Conformément à la règle du projet sur la définition de « terminé », ces vérifications sont des
tests unitaires et une compilation — **pas une preuve contre la pile réelle**. Ce point est signalé
explicitement ci-dessus, pas présenté comme une validation.

## Fichiers modifiés/ajoutés (principaux)

- `services/content-catalog-service/src/exercises/` — entités, DTO, service, contrôleurs, module
  (voir liste complète dans `docs/services/content-catalog-service.md`, session du 2026-08-29).
- `services/content-catalog-service/src/validations/validations.service.ts` — scoping AP étendu.
- `services/content-catalog-service/src/app.module.ts` — entités mises à jour.
- `docker-compose.yml` — nouveau volume `content_catalog_exercise_images`.
- `docs/routes.md` — nouvelle section « Exercices — refonte du 2026-08-29 ».
- `docs/services/content-catalog-service.md` — session complète journalisée.

## Branches non fusionnées constatées (hors périmètre de ce chantier, signalées par convention)

À `master`, au moment de ce rapport, ne sont pas fusionnées :
`docs/exercises-goal-update`, `docs/exercises-rebuild-arbitrage` (PR #181, contient l'arbitrage
qui fait autorité pour ce chantier — sa fusion est un prérequis naturel avant celle de cette PR),
`feat/exercises-rebuild-learning-activity` (le service développé en parallèle sur ce même contrat),
`feat/front-reprise-candidature-formateur`, `feat/reprise-candidature-formateur`,
`docs/quiz-import-spreadsheet-arbitrage`, `docs/quiz-validation-tab-goal`,
`docs/quizz-validation-nav-close`. Aucune de ces branches n'a été touchée par ce chantier.

## Suite recommandée

1. Merger `docs/exercises-rebuild-arbitrage` (PR #181) en premier, puisque cette PR #184 s'appuie
   sur son contenu.
2. Merger cette PR (#184) et `feat/exercises-rebuild-learning-activity` de façon rapprochée,
   puisqu'elles portent le même contrat interne.
3. Une fois les deux services redéployés, produire une preuve HTTP réelle du flux complet (création
   d'exercice, ajout d'image, appel interne de notation/solution depuis learning-activity-service).
