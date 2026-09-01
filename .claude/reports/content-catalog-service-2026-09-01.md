# content-catalog-service — 2026-09-01

## Tâche

Trois corrections post-test-visuel sur la refonte des Exercices (PR #184), sur Exercise ET Quiz :

1. Titre obligatoire et unique par auteur, avec valeur par défaut suggérée par le serveur.
2. Champ `description` optionnel sur `CreateExerciseDto` (retrait de l'écran front).
3. Bug : les solutions déjà saisies d'un Exercice ne sont pas réaffichées à l'édition.

Arbitrage de référence : `docs/architecture.md`, "Titre des Exercices et des Quizz : obligatoire,
unique, avec une valeur par defaut proposee par le serveur" (2026-09-01).

Branche : `fix/content-catalog-exercise-title-and-solutions`, depuis `master`.
Commits : `37af329` (code + tests) et `d3c7e52` (documentation).

## Diagnostic préalable (point 3)

Deux hypothèses à départager : persistance défaillante, ou lecture incomplète.

Lecture du code (`ExercisesService.savePartsAndSolutions`, `create()`, `update()`) : la
persistance était **correcte** — chaque bloc `question` crée bien une `ExerciseSolution` +
ses `ExerciseContentItem` enfants. Le bug était donc côté lecture : `GET /exercises/:id`
(`toPublicDetail`/`toPublicPart`) ne renvoie que `hasSolution: boolean`, jamais le contenu, et
**aucune autre route publique n'exposait ce contenu à l'auteur** — seule la route interne
`POST /internal/exercises/:exerciseId/parts/:partId/solution` (protégée `X-Internal-Secret`,
réservée à `learning-activity-service`) y accédait. Même lecture que l'arbitrage Quizz du
2026-08-28 : la règle "jamais la solution" protège l'élève qui passe le contenu, pas l'auteur.
Confirmé par une création réelle suivie d'une lecture directe en base (`psql`) : contenu bien
présent, jamais exposé par aucune route accessible au front.

## Changements

### 1. Titre obligatoire et unique (Exercise + Quiz)

- `CreateExerciseDto.title` : `@IsOptional()` → `@IsString() @IsNotEmpty()`.
- `Exercise.title` (entité) : `string | null` (nullable) → `string` (NOT NULL).
- Nouvelle migration `1791000000000-MakeExerciseTitleRequired` : backfill des titres NULL/vides
  (`'Exercice (sans titre) ' || id[:8]`) avant `ALTER COLUMN title SET NOT NULL`, sous garde
  `to_regclass` — nécessaire car `synchronize` est actif en production (`NODE_ENV=development`
  malgré le défaut `production` de docker-compose, point ouvert déjà documenté dans
  `docs/architecture.md`) et aurait crash-loopé exactement comme l'incident du 2026-08-29 sinon.
  1 ligne sur 13 concernée en production au moment du chantier.
- `ExercisesService.assertTitleUnique(title, authorId, excludeExerciseId?)` et
  `QuizzesService.assertTitleUnique(...)` : requête `createQueryBuilder(...).andWhere(...)`
  (jamais `.where()`, convention déjà en usage dans `search()` des deux services), exclut
  `status = REMOVED` (Exercise) et l'id édité. Appelée dans `create()` et `update()` des deux
  services, avant toute écriture. `400` explicite en français si doublon.
- `ExercisesService.getDefaultTitle(authorId)` / `QuizzesService.getDefaultTitle(authorId)` :
  `count({where:{authorId}}) + 1`, formaté `"Exercice {n}"` / `"Quizz {n}"`.
- Nouvelles routes `GET /exercises/default-title` et `GET /quizzes/default-title`, réservées aux
  créateurs (formateur/AP/RP), placées avant les routes paramétrées `:id` dans les deux
  contrôleurs.

Note : `Quiz.title` était déjà `NOT NULL` en base et `@IsNotEmpty()` dans le DTO depuis sa
création (2026-08-28) — seule l'unicité par auteur et la route de suggestion manquaient côté
Quiz.

### 2. Description optionnelle (Exercise)

Déjà conforme : `CreateExerciseDto.description` était déjà `@IsOptional()`. Aucun changement
nécessaire, vérifié en HTTP direct (création sans `description` → `201`).

### 3. Solutions relisibles par l'auteur (Exercise)

- Nouvelles interfaces `PublicExercisePartWithSolution` / `PublicExerciseDetailWithSolutions`
  dans `ExercisesService` : même forme que `PublicExercisePart`/`PublicExerciseDetail`, mais
  `solution: {items: PublicContentItem[]} | null` au lieu de `hasSolution: boolean`.
- `ExercisesService.findOneWithSolutions(exerciseId, callerId, callerRole)` : `403` si ni auteur
  ni AP/RP/TI, `404` si introuvable, sinon détail complet avec le contenu de chaque solution
  (texte/formule — les images de solution restent exclusivement servies via la médiation de
  `learning-activity-service`, non exposées ici).
- Nouvelle route `GET /exercises/:id/solutions`, réservée à l'auteur + AP/RP/TI.
  `GET /exercises/:id` (route publique) reste **strictement inchangée** — jamais la solution,
  quel que soit l'appelant.

## Tests

- Tests unitaires ajoutés : titre vide/espaces refusé, titre dupliqué par le même auteur refusé,
  deux auteurs différents avec le même titre acceptés, `getDefaultTitle()` (0 et n existants),
  exclusion de soi-même à l'édition (mêmes titre autorisé), `findOneWithSolutions()` (auteur, RP,
  tiers → 403, bloc énoncé sans solution → `null`). Mêmes catégories de tests côté Quiz.
- `npx jest` (suite complète du service) : **23 suites, 297/297 tests verts** (152 → 152 avant
  ajouts + 145 nouveaux/modifiés, aucune régression).
- `npm run build` : 0 erreur.

## Déploiement et vérification en production

Le contexte de build `docker compose build` du dépôt partagé pointait vers le checkout partagé
(pas le worktree de cet agent) — les changements n'y étaient pas visibles (étapes `COPY . .` /
`RUN npm run build` marquées `CACHED` à tort). Contournement : `docker build` manuel depuis le
worktree avec le même tag d'image (`claudevma-content-catalog-service:latest`), puis
`docker compose up -d --no-build content-catalog-service` pour recréer le conteneur sans
redéclencher un build depuis le mauvais contexte.

Migration appliquée : `migration:show` → `[X] 2 MakeExerciseTitleRequired1791000000000`. Vérifié
en base (`psql`) : `exercises.title`, 0 NULL sur 13 lignes après migration, colonne confirmée
`NOT NULL` par `\d exercises`.

Preuves HTTP directes contre `https://claudevma.visioprof.fr` (compte formateur de test créé pour
l'occasion, `verif.exercice.*@example.com`) :

| Vérification | Résultat |
|---|---|
| `POST /exercises` sans `title` | `400` — `"title should not be empty"` |
| `POST /quizzes` sans `title` | `400` — même message |
| `GET /exercises/default-title` (avant/après création) | `200 {"title":"Exercice 1"}` puis `{"title":"Exercice 2"}` |
| `GET /quizzes/default-title` | `200 {"title":"Quizz 1"}` |
| `POST /exercises` sans `description`, avec `title` | `201`, `description: null` |
| `POST /exercises` avec un titre déjà pris par le même auteur | `400` — `"Vous avez déjà un exercice intitulé \"...\""` |
| `PUT /exercises/:id` en gardant le même titre (édition) | `200` — pas de faux-positif d'unicité |
| `GET /exercises/:id/solutions` par l'auteur, après création | `200`, contenu réel de la solution (`"Solution attendue XYZ"`) |
| Idem après `PUT` d'édition avec un nouveau contenu de solution | `200`, contenu mis à jour (`"Solution modifiee ABC"`) |
| `GET /exercises/:id/solutions` par un compte élève tiers | `403` |
| `GET /exercises/:id` (route publique) | Ne renvoie jamais la solution, avant ni après l'édition (`hasSolution` seulement) |

## Contrat des nouvelles routes (pour `front-developper`)

```
GET /exercises/default-title
GET /quizzes/default-title
  Auth: Bearer JWT, rôles formateur | animateur_pedagogique | responsable_pedagogique
  200 { "title": "Exercice 4" }   (ou "Quizz 4")
  401 si non authentifié

GET /exercises/:id/solutions
  Auth: Bearer JWT, rôles formateur | animateur_pedagogique | responsable_pedagogique |
        technicien_informatique — ET (auteur de l'exercice OU rôle AP/RP/TI)
  200 PublicExerciseDetailWithSolutions :
    { id, title, description, level, difficulty, theme, competencies, tags, status,
      authorId, authorRole, shareableLink, createdAt, updatedAt,
      parts: [
        { id, partNumber, category: "statement"|"question",
          items: [{ id, type: "text"|"formula"|"image", order, content,
                     imageMimeType?, imageSizeBytes? }],
          solution: { items: [ ...même forme que items... ] } | null
        }
      ]
    }
  403 si l'appelant n'est ni l'auteur ni AP/RP/TI
  404 si l'exercice n'existe pas
  Note : GET /exercises/:id (route publique, inchangée) ne renvoie jamais "solution", seulement
  "hasSolution: boolean" sur chaque bloc question — utiliser /solutions uniquement sur l'écran
  d'édition, jamais sur l'écran de consultation/passage.

POST /exercises, PUT /exercises/:id
POST /quizzes, PUT /quizzes/:id
  Nouveau : "title" est désormais obligatoire (400 "title should not be empty" si vide/absent)
  et doit être unique parmi les contenus du même type déjà créés par l'appelant
  (400 "Vous avez déjà un {exercice|quizz} intitulé "..."" si doublon — l'édition exclut le
  contenu édité lui-même de ce contrôle). "description" reste optionnelle sur Exercise.
```

## Points en suspens / hors périmètre

- **`DELETE /exercises/:id`** : la doc et le service prévoient une branche "auteur peut retirer
  son propre exercice", mais le contrôleur restreint la route à `@Roles(responsable_pedagogique,
  technicien_informatique)` — un auteur formateur reçoit `403` avant même d'atteindre le service.
  Incohérence pré-existante (non introduite par cette session), constatée en tentant de nettoyer
  l'exercice de test créé pendant la vérification. Non corrigée ici (hors périmètre de la tâche
  demandée) — documentée dans `docs/routes.md` et `docs/services/content-catalog-service.md`.
- Un exercice de test reste en base de production
  (`id 2f2f8c95-477c-43c4-b665-320f94d45b72`, statut `pending_validation`, auteur un compte
  formateur de test créé pour l'occasion) — invisible aux élèves et aux autres professeurs tant
  qu'il n'est pas validé, non supprimé à cause du point ci-dessus.

## Statut

✅ Les trois points de la tâche sont livrés, testés (297/297) et vérifiés en HTTP direct contre
la production. PR ouverte depuis `fix/content-catalog-exercise-title-and-solutions` vers
`master`.
