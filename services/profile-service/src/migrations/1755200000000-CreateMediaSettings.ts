import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chantier « paramètres système » (arbitrage du 2026-08-26, point 8) — le
 * plafond d'envoi de la photo de profil devient réglable par le TI à
 * l'exécution, sans redéploiement.
 *
 * Table SINGLETON : une seule ligne, d'identifiant fixe (`avatar-upload`),
 * créée PARESSEUSEMENT à la première lecture (voir `MediaSettingsService`),
 * jamais par cette migration — la valeur d'amorçage dépend de
 * `MEDIA_MAX_UPLOAD_BYTES`, lue à l'exécution par `MediaConfig`, pas au
 * moment de la migration.
 */
export class CreateMediaSettings1755200000000 implements MigrationInterface {
  name = 'CreateMediaSettings1755200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "media_settings" (
        "id" character varying(40) NOT NULL,
        "max_avatar_upload_bytes" integer NOT NULL,
        "updated_by" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_media_settings" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "media_settings"`);
  }
}
