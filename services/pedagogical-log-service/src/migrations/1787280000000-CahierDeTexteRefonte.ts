import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Refonte du cahier de texte — 2026-08-20 (premiere migration reelle de ce
 * service, jusque-la porte par synchronize).
 *
 * up() :
 * 1. Ajoute date / session_summary / homework / auto_created / reminded_at sur
 *    pedagogical_logs.
 * 2. Rend content nullable (reserve desormais aux pages speciales RP, hors
 *    perimetre de cette refonte).
 * 3. Migre les donnees existantes : pour les entrees NON speciales, copie
 *    content -> session_summary puis vide content (les pages speciales
 *    conservent leur content intact).
 * 4. Renomme la valeur de visibilite 'eleve_formateur' -> 'parent_formateur'
 *    (categorie corrigee : exclut l'eleve, inclut le parent).
 * 5. Cree activity_projections et processed_events (consommation du flux Redis
 *    visiomath:events, point 5 de la refonte).
 *
 * down() : best-effort, asymetrique par nature (une migration de donnees n'est
 * pas integralement reversible sans perte). Ne restaure PAS la contrainte
 * NOT NULL sur content : des entrees auto-creees ou normales sans aucun contenu
 * existeront legitimement apres up(), la restaurer casserait le rollback.
 */
export class CahierDeTexteRefonte1787280000000 implements MigrationInterface {
  name = 'CahierDeTexteRefonte1787280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pedagogical_logs"
        ADD COLUMN IF NOT EXISTS "date" date NULL,
        ADD COLUMN IF NOT EXISTS "session_summary" text NULL,
        ADD COLUMN IF NOT EXISTS "homework" text NULL,
        ADD COLUMN IF NOT EXISTS "auto_created" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "reminded_at" timestamptz NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "pedagogical_logs" ALTER COLUMN "content" DROP NOT NULL
    `);

    await queryRunner.query(`
      UPDATE "pedagogical_logs"
      SET "session_summary" = "content"
      WHERE "is_special_page" = false AND "content" IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE "pedagogical_logs"
      SET "content" = NULL
      WHERE "is_special_page" = false
    `);

    await queryRunner.query(`
      UPDATE "pedagogical_logs"
      SET "visibility" = 'parent_formateur'
      WHERE "visibility" = 'eleve_formateur'
    `);

    await queryRunner.query(`
      CREATE TABLE "activity_projections" (
        "activity_id" uuid NOT NULL,
        "type" varchar NOT NULL,
        "creator_id" uuid NOT NULL,
        "recipient_id" uuid NULL,
        "participant_ids" text NULL,
        "start_time" timestamptz NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_activity_projections" PRIMARY KEY ("activity_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "processed_events" (
        "event_id" varchar NOT NULL,
        "event_type" varchar NOT NULL,
        "processed_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_processed_events" PRIMARY KEY ("event_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "processed_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_projections"`);

    await queryRunner.query(`
      UPDATE "pedagogical_logs"
      SET "visibility" = 'eleve_formateur'
      WHERE "visibility" = 'parent_formateur'
    `);

    await queryRunner.query(`
      UPDATE "pedagogical_logs"
      SET "content" = "session_summary"
      WHERE "is_special_page" = false AND "content" IS NULL AND "session_summary" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "pedagogical_logs"
        DROP COLUMN IF EXISTS "date",
        DROP COLUMN IF EXISTS "session_summary",
        DROP COLUMN IF EXISTS "homework",
        DROP COLUMN IF EXISTS "auto_created",
        DROP COLUMN IF EXISTS "reminded_at"
    `);
  }
}
