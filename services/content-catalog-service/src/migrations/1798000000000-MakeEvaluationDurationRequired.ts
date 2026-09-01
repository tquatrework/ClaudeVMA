import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `evaluations.durationSeconds` devient obligatoire (arbitrage du
 * 2026-09-01, `docs/architecture.md`, "Refonte des Evaluations", point 7 :
 * "oui rend obligatoire" — réponse explicite de l'utilisateur, pas
 * d'évaluation sans limite de temps). Même mécanique que
 * `MakeExerciseTitleRequired1791000000000` : `synchronize` reste actif sur
 * la pile réelle (`NODE_ENV=development` malgré un défaut `production` en
 * docker-compose — voir le point ouvert dans `docs/architecture.md`) et
 * échouerait immédiatement en tentant de poser une contrainte NOT NULL sur
 * une colonne contenant déjà des NULL.
 *
 * Vérifié en base le 2026-09-01 avant d'écrire cette migration : 0 ligne
 * dans `evaluations` sur la pile réelle, donc 0 ligne avec `durationSeconds`
 * NULL — aucun backfill de rattrapage n'est nécessaire pour la pile réelle.
 * Le backfill ci-dessous (valeur de repli 3600s = 1h) reste posé
 * explicitement pour couvrir tout environnement (test, autre déploiement)
 * où des lignes existeraient déjà sans durée, plutôt que de supposer la
 * table vide partout et risquer un crash-loop ailleurs.
 *
 * Idempotente : `to_regclass` vérifie l'existence de la table avant d'y
 * toucher.
 */
export class MakeEvaluationDurationRequired1798000000000 implements MigrationInterface {
  name = 'MakeEvaluationDurationRequired1798000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.evaluations') IS NOT NULL THEN
          UPDATE "evaluations"
          SET "durationSeconds" = 3600
          WHERE "durationSeconds" IS NULL;

          ALTER TABLE "evaluations" ALTER COLUMN "durationSeconds" SET NOT NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.query(`SELECT to_regclass('public.evaluations') AS reg`);
    if (table?.[0]?.reg) {
      await queryRunner.query(`ALTER TABLE "evaluations" ALTER COLUMN "durationSeconds" DROP NOT NULL`);
    }
  }
}
