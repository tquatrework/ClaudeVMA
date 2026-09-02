import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ajoute `evaluations.scoring` (jsonb, nullable) — barème informatif de
 * l'Évaluation (arbitrage du 2026-09-02, docs/architecture.md, "Barème
 * informatif pour l'Évaluation"). Jamais utilisé pour un calcul automatique,
 * jamais requis : `NULL` tant que le créateur n'en a pas défini un.
 *
 * `synchronize` reste actif sur la pile réelle (`NODE_ENV=development`
 * malgré un défaut `production` en docker-compose — voir le point ouvert
 * dans docs/architecture.md) et les migrations s'exécutent toujours avant
 * `synchronize` (vérifié le 2026-09-01, `MakeEvaluationDurationRequired`) :
 * une colonne nullable simplement ajoutée ne présente aucun risque de
 * crash-loop, contrairement aux migrations qui posent une contrainte
 * NOT NULL/UNIQUE.
 *
 * Idempotente : `to_regclass` vérifie l'existence de la table, et
 * `IF NOT EXISTS` évite toute erreur si `synchronize` avait déjà posé la
 * colonne sur une base neuve.
 */
export class AddEvaluationScoring1799000000000 implements MigrationInterface {
  name = 'AddEvaluationScoring1799000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.evaluations') IS NOT NULL THEN
          ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "scoring" jsonb;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.query(`SELECT to_regclass('public.evaluations') AS reg`);
    if (table?.[0]?.reg) {
      await queryRunner.query(`ALTER TABLE "evaluations" DROP COLUMN IF EXISTS "scoring"`);
    }
  }
}
