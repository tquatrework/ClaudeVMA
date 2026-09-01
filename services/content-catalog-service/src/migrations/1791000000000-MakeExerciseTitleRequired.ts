import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Arbitrage du 2026-09-01 (`docs/architecture.md`, "Titre des Exercices et
 * des Quizz : obligatoire, unique, avec une valeur par défaut proposée par
 * le serveur") : le titre d'un Exercice n'est plus optionnel, à l'image du
 * Quizz (`quizzes.title` était déjà `NOT NULL` depuis sa création le
 * 2026-08-28).
 *
 * `synchronize` est actif sur la pile réelle (`NODE_ENV=development` malgré
 * un défaut `production` en docker-compose — voir le point ouvert dans
 * `docs/architecture.md`) et échoue immédiatement en tentant d'ajouter une
 * contrainte NOT NULL sur une colonne contenant déjà des NULL — même
 * incident que celui documenté dans
 * `1790000000000-CleanupPreRefonteExerciseData.ts`. Vérifié en HTTP/psql
 * direct le 2026-09-01 : 1 exercice sur 13 porte un titre NULL (créé avant
 * que le formulaire ne rende le champ obligatoire). Cette migration
 * backfill cette ligne avant de poser la contrainte, plutôt que de
 * découvrir un crash-loop au déploiement.
 *
 * Idempotente : `to_regclass` vérifie l'existence de la table avant d'y
 * toucher (base neuve où `synchronize` n'a pas encore créé la table).
 */
export class MakeExerciseTitleRequired1791000000000 implements MigrationInterface {
  name = 'MakeExerciseTitleRequired1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.exercises') IS NOT NULL THEN
          UPDATE "exercises"
          SET title = 'Exercice (sans titre) ' || substr(id::text, 1, 8)
          WHERE title IS NULL OR title = '';

          ALTER TABLE "exercises" ALTER COLUMN "title" SET NOT NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.query(`SELECT to_regclass('public.exercises') AS reg`);
    if (table?.[0]?.reg) {
      await queryRunner.query(`ALTER TABLE "exercises" ALTER COLUMN "title" DROP NOT NULL`);
    }
  }
}
