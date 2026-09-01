# content-catalog-service — Cycle de vie Evaluation aligné sur Quizz/Exercice (2026-09-01)

## Statut : ✅ code livré, buildé, testé — preuve HTTP contre la pile réelle non faite (déploiement délégué à l'orchestrateur)

Branche : `feat/content-catalog-evaluation-lifecycle`
PR : https://github.com/tquatrework/ClaudeVMA/pull/195 (ouverte, non mergée)

## Périmètre traité

Strictement les 4 points demandés, tous côté `content-catalog-service` :

1. **Cycle de validation aligné sur Quizz/Exercice.** `EvaluationsService.create()` fixe
   désormais explicitement `pending_validation` pour un formateur, `validated` immédiat pour
   AP/RP — remplace le `DRAFT` systématique. `ValidationsService.validateContent()` étend le
   scoping AP par relation `animator_of_teacher` (déjà construit pour Quizz/Exercice) à
   `ContentType.EVALUATION` — révise explicitement une note du 2026-08-28 qui limitait
   volontairement ce scoping au Quizz.
2. **Gap de recherche par tag/keyword corrigé.** `SearchEvaluationDto` exposait déjà `tag`/
   `keyword`, jamais appliqués. `EvaluationsService.search()` passe de `findAndCount(where)` à
   `createQueryBuilder()` pour supporter `ANY(evaluation.tags)` et `title ILIKE`. Ceci a
   nécessité de convertir la colonne `evaluations.tags` de `simple-array` (texte scalaire CSV)
   vers `text[]` postgres natif (même choix que Quiz/Exercise) — sans cette conversion,
   `ANY()` aurait échoué en SQL dès qu'un `tag` est fourni. Migration dédiée
   (`ConvertEvaluationTagsToNativeArray1797000000000`).
3. **`durationSeconds` obligatoire.** DTO : `@IsOptional()`/`@Min(0)` remplacés par
   `@IsNumber()`/`@Min(1)` sans `@IsOptional`. Service : vérification explicite en défense en
   profondeur avec message français (`BadRequestException`). Colonne rendue `NOT NULL` par
   migration (`MakeEvaluationDurationRequired1798000000000`), avec backfill défensif (3600s)
   sur d'éventuelles lignes `NULL` — vérifié en base réelle avant écriture : **0 ligne** dans
   `evaluations` au moment du chantier, donc pas de perte de donnée ni de backfill réel
   nécessaire sur cette pile.
4. **Retrait complet de `evaluation_attempts`.** Entité, DTO, route
   `POST /evaluations/:id/attempts`, référence dans `EvaluationsModule` et `AppModule` —
   supprimés. Migration `DropEvaluationAttempts1796000000000` (`DROP TABLE` + `DROP TYPE`, sous
   garde `to_regclass`, idempotente). Vérifié en base réelle avant écriture : **0 ligne** dans
   `evaluation_attempts`, aucune perte de donnée réelle — le code n'avait jamais écrit
   `score`/`answers` depuis sa création en juin 2026.

Aucune route de lecture de solution supplémentaire n'a été construite (arbitrage explicite,
point 6 du 2026-09-01 : "une correction n'a rien à voir avec une solution... la correction
consiste à revoir la tentative/la réponse d'un utilisateur").

## Contrat exact de l'entité `Evaluation` finale

```ts
@Entity('evaluations')
class Evaluation {
  id: string;                              // uuid, PK
  title: string;                           // requis (inchangé)
  description: string | null;
  exerciseItems: EvaluationExerciseItem[]; // jsonb — [{exerciseId, titleOverride?, order}]
  level: string | null;
  difficulty: string | null;
  theme: string | null;
  competencies: string[] | null;           // simple-array (inchangé)
  tags: string[] | null;                   // text[] postgres natif (CHANGÉ — était simple-array)
  durationSeconds: number;                 // NOT NULL (CHANGÉ — était nullable)
  blockBackNavigation: boolean;
  authorId: string;
  authorRole: string;
  status: ContentStatus;                   // draft|pending_validation|validated|rejected|removed
                                            // fixé à la création : pending_validation (formateur)
                                            // ou validated (AP/RP) — plus jamais draft en pratique
  shareableLink: string | null;
  createdAt: Date;
  updatedAt: Date;
  // `attempts: EvaluationAttempt[]` RETIRÉ — plus de relation, l'entité n'existe plus
}
```

Routes publiques inchangées dans leur forme : `GET /evaluations` (filtres `level`/`difficulty`/
`theme`/`tag`/`keyword`/`page`/`limit`), `POST /evaluations`, `GET /evaluations/:id`,
`DELETE /evaluations/:id`. Route retirée : `POST /evaluations/:id/attempts` (404 désormais,
plus de handler). Validation générique inchangée dans sa forme :
`POST /validations/evaluation/:id/decision` et `.../request`, désormais avec le scoping AP.

## Ce que `learning-activity-service` doit savoir

- Aucun contrat interne (`/internal/*`) n'a été posé dans cette session pour l'Évaluation,
  contrairement au Quizz (`POST /internal/quizzes/:quizId/grade`, figé le même jour). C'est un
  point ouvert explicite : à définir conjointement une fois les deux chantiers stabilisés.
- `learning-activity-service` peut lire la structure d'une évaluation via
  `GET /evaluations/:id` (public, authentifié) — même limite pré-existante non corrigée :
  cette route ne filtre **pas** par statut/auteur (écart avec Quizz/Exercice, signalé en point
  ouvert, hors périmètre explicite de ce chantier).
- Les Exercices référencés par `exerciseItems` restent accessibles via les routes déjà en
  place côté Exercice (`GET /exercises/:id/solutions`, route interne dédiée) — inchangées par
  ce chantier.

## Vérifications faites

- `npm run build` : 0 erreur.
- `npm test` : **348/348 tests verts**, 32 suites (dont 3 nouvelles suites de migration et 1
  nouvelle suite `validations.service.evaluation-scoping.spec.ts`, miroir de la suite
  Exercice).
- `docker build` de l'image du service depuis le Dockerfile réel : succès (build propre avec
  `npm ci`, pas seulement le `node_modules` du worktree).
- Vérification directe en base réelle (`docker exec visiomath_postgres psql`) avant rédaction
  de chacune des 3 migrations : `\d evaluations`, `\d evaluation_attempts`, `count(*)` — 0
  ligne dans les deux tables, confirmant qu'aucun backfill réel n'était nécessaire.

## Non fait (hors périmètre explicite de la tâche)

- Pas de `PUT /evaluations/:id` (édition) ni de `GET /evaluations/pending-validation` — non
  demandées, contrairement à Quizz/Exercice qui les ont.
- Visibilité de recherche non alignée sur Quizz/Exercice : un formateur voit toujours toutes
  les évaluations sans filtre par auteur (seuls parent/élève sont restreints à `validated`) —
  écart assumé, à arbitrer séparément si souhaité.
- `findOne()` (`GET /evaluations/:id`) ne filtre toujours pas par statut/auteur — écart
  pré-existant avec Quizz/Exercice, non corrigé (déjà signalé dans une session antérieure sur
  les Exercices).
- Aucune preuve HTTP contre la pile réelle après déploiement — délégué à l'orchestrateur,
  conformément à la règle du projet sur les scénarios visuels/HTTP à ne pas lancer sans
  consultation préalable pour ce type de vérification (mais un `curl` simple reste possible
  après déploiement, comme demandé dans le mandat).

## Branches non fusionnées (rappel obligatoire à chaque interaction git)

En plus de `feat/content-catalog-evaluation-lifecycle` (celle-ci, PR #195 ouverte), plusieurs
autres branches distantes ne sont pas fusionnées dans `master` :
`feat/content-catalog-exercise-image-block`, `feat/content-catalog-title-disambiguation-step1`,
`feat/content-catalog-title-uniqueness-step2`, `feat/exercises-front`,
`feat/front-reprise-candidature-formateur`, `feat/reprise-candidature-formateur`,
`fix/api-gateway-exercise-attempts-proxy`, `fix/content-catalog-exercise-image-storage`,
`fix/content-catalog-exercise-title-and-solutions`, `fix/exercise-edit-solution-image-and-navigation`,
`fix/front-exercises-post-test-feedback`. Ce simple rappel n'implique pas qu'elles soient
liées à cette tâche.
