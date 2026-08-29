import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Correctif d'incident de production — 2026-08-29.
 *
 * La refonte des Exercices (docs/architecture.md, "Refonte des Exercices")
 * a ajouté des colonnes NOT NULL (`exercise_parts.category`,
 * `exercise_solutions.partId`, unique) sur des tables qui pouvaient encore
 * contenir des lignes du modèle Exercise pré-refonte (chantier de juin 2026,
 * jamais éprouvé en HTTP réel). Ce service tournait alors entièrement en
 * `synchronize` (aucune migration n'existait), et `synchronize` échoue
 * immédiatement dès qu'il tente d'ajouter une colonne NOT NULL sur une table
 * non vide — `QueryFailedError: column "partId" of relation
 * "exercise_solutions" contains null values` — bloquant le démarrage du
 * service en boucle (crash-loop).
 *
 * L'arbitrage est explicite : cette refonte est "une reconstruction, pas une
 * migration de données" — les anciennes données Exercise/ExercisePart/
 * ExerciseSolution/ExerciseAnswer/ExerciseCorrection n'ont aucune valeur à
 * préserver. Cette migration vide donc ces tables plutôt que de tenter de
 * les transformer vers le nouveau schéma.
 *
 * Ordre d'exécution garanti AVANT `synchronize` : `DataSource.initialize()`
 * (node_modules/typeorm/data-source/DataSource.js) exécute `runMigrations()`
 * puis `synchronize()` — jamais l'inverse — donc ce nettoyage a bien lieu
 * avant toute tentative d'ALTER incompatible, sur N'IMPORTE QUEL
 * environnement (nouveau déploiement, restauration d'un dump antérieur à la
 * refonte), pas seulement la production actuelle (débloquée manuellement le
 * 2026-08-29 par l'orchestrateur, en attendant ce correctif, par un DELETE
 * direct sur les mêmes tables).
 *
 * Idempotente et sûre sur une base neuve : `to_regclass` vérifie l'existence
 * de chaque table avant d'y toucher (les tables peuvent ne pas encore
 * exister sur une base fraîche, puisque `synchronize` — qui les crée — passe
 * APRÈS cette migration), et `DROP TABLE IF EXISTS` est nativement sûr.
 */
export class CleanupPreRefonteExerciseData1790000000000 implements MigrationInterface {
  name = 'CleanupPreRefonteExerciseData1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ExerciseAnswer/ExerciseCorrection : plus aucune entité ne les mappe
    // depuis la refonte (elles migrent vers learning-activity-service) —
    // synchronize ne les touchera plus jamais, on les retire explicitement
    // pour ne pas laisser de tables orphelines derrière la refonte.
    await queryRunner.query(`DROP TABLE IF EXISTS "exercise_answers" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "exercise_corrections" CASCADE`);

    // Tables toujours mappées par une entité, mais dont le schéma change de
    // façon incompatible avec d'éventuelles lignes pré-refonte (colonnes NOT
    // NULL ajoutées, types de colonnes changés) : vidées entièrement, dans
    // l'ordre enfant → parent, pour que le prochain synchronize() les
    // altère/recrée sur des tables vides, sans jamais violer de contrainte.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.exercise_solutions') IS NOT NULL THEN
          DELETE FROM "exercise_solutions";
        END IF;
        IF to_regclass('public.exercise_parts') IS NOT NULL THEN
          DELETE FROM "exercise_parts";
        END IF;
        IF to_regclass('public.exercises') IS NOT NULL THEN
          DELETE FROM "exercises";
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Irréversible par nature : suppression de données pré-refonte sans
    // valeur à restaurer (arbitrage explicite, voir commentaire ci-dessus).
    // Aucune action.
  }
}
