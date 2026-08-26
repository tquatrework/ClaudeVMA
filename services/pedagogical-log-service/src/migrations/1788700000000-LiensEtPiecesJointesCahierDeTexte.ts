import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Liens et pièces jointes sur une entrée de cahier de texte, et paramètres
 * système associés — arbitrage du 2026-08-26, docs/architecture.md "Liens et
 * pièces jointes sur une entrée de cahier de texte, et paramètres système
 * associés".
 *
 * up() :
 * 1. Ajoute `resource_links` sur pedagogical_logs (liens externes libres,
 *    distinct de `linked_resources`).
 * 2. Crée `pedagogical_log_attachments` (pièces jointes, FK CASCADE vers
 *    pedagogical_logs).
 * 3. Crée `pedagogical_log_settings` (réglages TI, table à une seule ligne)
 *    et seed la ligne singleton avec les valeurs par défaut de l'arbitrage
 *    (attachments_enabled=true, max_file_bytes=100000,
 *    max_total_bytes_per_entry=5000000).
 *
 * down() : supprime les deux nouvelles tables et la colonne ajoutée.
 */
export class LiensEtPiecesJointesCahierDeTexte1788700000000 implements MigrationInterface {
  name = 'LiensEtPiecesJointesCahierDeTexte1788700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pedagogical_logs"
        ADD COLUMN IF NOT EXISTS "resource_links" text NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "pedagogical_log_attachments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "log_entry_id" uuid NOT NULL,
        "original_filename" varchar NOT NULL,
        "stored_filename" varchar NOT NULL,
        "mime_type" varchar NOT NULL,
        "size_bytes" integer NOT NULL,
        "uploaded_by" varchar NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pedagogical_log_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pedagogical_log_attachments_log_entry" FOREIGN KEY ("log_entry_id")
          REFERENCES "pedagogical_logs" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_pedagogical_log_attachments_log_entry_id"
        ON "pedagogical_log_attachments" ("log_entry_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "pedagogical_log_settings" (
        "id" uuid NOT NULL,
        "attachments_enabled" boolean NOT NULL DEFAULT true,
        "max_file_bytes" integer NOT NULL DEFAULT 100000,
        "max_total_bytes_per_entry" integer NOT NULL DEFAULT 5000000,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pedagogical_log_settings" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "pedagogical_log_settings" ("id")
      VALUES ('00000000-0000-0000-0000-000000000001')
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "pedagogical_log_settings"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pedagogical_log_attachments_log_entry_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pedagogical_log_attachments"`);
    await queryRunner.query(`
      ALTER TABLE "pedagogical_logs" DROP COLUMN IF EXISTS "resource_links"
    `);
  }
}
