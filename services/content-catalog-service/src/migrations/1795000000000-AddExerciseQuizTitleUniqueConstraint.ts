import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Arbitrage du 2026-09-01 (`docs/architecture.md`, "Titre des Exercices et
 * des Quizz : disambiguation automatique plutôt que refus"), point 3 :
 * ferme définitivement la fenêtre de compétition (TOCTOU) entre le `SELECT`
 * de vérification (`resolveUniqueTitle`) et l'`INSERT`/`UPDATE` qui suit —
 * deux requêtes concurrentes (double-clic, deux onglets, retry réseau)
 * pouvaient jusqu'ici toutes deux passer la vérification applicative et
 * produire un doublon silencieux malgré la disambiguation.
 *
 * Deux index UNIQUE composites `(authorId, title)` :
 *   - `exercises` : index PARTIEL (`WHERE status != 'removed'`), cohérent
 *     avec `ExercisesService.titleTakenByAuthor`/`resolveUniqueTitle` qui
 *     excluent déjà ce statut — un exercice retiré ne bloque pas la
 *     réutilisation de son titre.
 *   - `quizzes` : index simple, sans filtre — le Quizz n'a pas de statut
 *     `REMOVED` dans son cycle de vie actuel (pas de route de retrait).
 *
 * Noms d'index explicites (`IDX_exercise_author_title_unique`,
 * `IDX_quiz_author_title_unique`), réutilisés :
 *   - par le décorateur `@Index(...)` posé dans le même commit sur
 *     `Exercise`/`Quiz` (voir plus bas pourquoi ce couplage migration +
 *     décorateur, dans le même déploiement, est sûr ici) ;
 *   - par `isPostgresUniqueViolation(err, constraintName)`
 *     (`src/common/utils/postgres-errors.ts`), pour ne détecter QUE cette
 *     violation précise côté retry applicatif (`ExercisesService`/
 *     `QuizzesService`), jamais une autre contrainte UNIQUE sans rapport.
 *
 * ─── Pourquoi migration + décorateur d'entité dans le MÊME déploiement,
 * contrairement au séquencement en deux déploiements du plan initial ───
 *
 * Le plan de ce chantier (`.claude/plans/le-titre-d-un-quizz-curried-lampson.md`,
 * section 3) supposait `synchronize` actif AVANT `migrationsRun` à chaque
 * boot (`NODE_ENV=development` sur la pile réelle) — hypothèse reprise du
 * commentaire de `1791000000000-MakeExerciseTitleRequired.ts` sur les deux
 * incidents déjà documentés dans ce service, et retranscrite telle quelle
 * dans la délégation qui a produit cette migration.
 *
 * Vérification directe faite pendant cette session, contre le code
 * `node_modules/typeorm/data-source/DataSource.js` réellement installé
 * (`initialize()`, lignes ~150-157) : `runMigrations()` s'exécute AVANT
 * `synchronize()`, jamais l'inverse — confirmant en réalité le commentaire
 * de `CleanupPreRefonteExerciseData1790000000000.ts` ("Ordre d'exécution
 * garanti AVANT synchronize... jamais l'inverse"), et infirmant la
 * formulation du plan et de la délégation de cette étape 2 sur ce point
 * précis. C'est cet ordre réel (migrations toujours en premier) qui explique
 * pourquoi `MakeExerciseTitleRequired1791000000000` a pu, dans le MÊME
 * commit, backfiller les titres NULL ET poser `title: string` (NOT NULL par
 * défaut TypeORM) sur `Exercise` sans crash-loop en production : au premier
 * boot suivant ce déploiement, la migration s'exécute et pose déjà la
 * contrainte NOT NULL ; `synchronize`, évalué ensuite, constate que le
 * schéma correspond déjà à l'entité et n'a rien à altérer.
 *
 * Le même raisonnement s'applique ici : cette migration crée l'index UNIQUE
 * AVANT que `synchronize` n'évalue le décorateur `@Index` des entités au
 * même boot — aucune fenêtre où `synchronize` pourrait tenter de créer
 * l'index en amont de données non nettoyées. Le nettoyage préalable des
 * doublons Quizz (`DeduplicateQuizTitles1794000000000`, déploiement 1,
 * confirmé en production) reste malgré tout la condition de sûreté
 * déterminante : c'est elle qui garantit qu'aucune ligne ne viole la
 * contrainte au moment où CETTE migration s'exécute, pas l'ordre
 * migrations/synchronize (qui était déjà favorable).
 *
 * Idempotente : `to_regclass` vérifie l'existence de chaque table avant d'y
 * toucher (base neuve où `synchronize` n'a pas encore tourné), et
 * `CREATE UNIQUE INDEX IF NOT EXISTS` est nativement sûr à rejouer.
 */
export class AddExerciseQuizTitleUniqueConstraint1795000000000 implements MigrationInterface {
  name = 'AddExerciseQuizTitleUniqueConstraint1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.exercises') IS NOT NULL THEN
          CREATE UNIQUE INDEX IF NOT EXISTS "IDX_exercise_author_title_unique"
            ON "exercises" ("authorId", "title")
            WHERE status != 'removed';
        END IF;

        IF to_regclass('public.quizzes') IS NOT NULL THEN
          CREATE UNIQUE INDEX IF NOT EXISTS "IDX_quiz_author_title_unique"
            ON "quizzes" ("authorId", "title");
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_exercise_author_title_unique"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quiz_author_title_unique"`);
  }
}
