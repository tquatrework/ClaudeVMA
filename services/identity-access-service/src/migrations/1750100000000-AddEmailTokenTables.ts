import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddEmailTokenTables
 *
 * Crée les tables pour les tokens d'email :
 * - email_verification_tokens : vérification d'adresse email après inscription
 * - identifier_recovery_tokens : récupération d'identifiant par email
 *
 * La table password_reset_tokens est déjà présente (synchronize TypeORM).
 * Cette migration ajoute également la colonne email_verified sur users.
 */
export class AddEmailTokenTables1750100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Table des tokens de vérification d'email
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
        "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
        "user_id"     UUID NOT NULL,
        "token_hash"  VARCHAR NOT NULL,
        "expires_at"  TIMESTAMPTZ NOT NULL,
        "used_at"     TIMESTAMPTZ,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_email_verification_tokens" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_verification_tokens_user_id"
        ON "email_verification_tokens" ("user_id")
    `);

    // Table des tokens de récupération d'identifiant
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "identifier_recovery_tokens" (
        "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
        "email"       VARCHAR NOT NULL,
        "token_hash"  VARCHAR NOT NULL,
        "expires_at"  TIMESTAMPTZ NOT NULL,
        "used_at"     TIMESTAMPTZ,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_identifier_recovery_tokens" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_identifier_recovery_tokens_email"
        ON "identifier_recovery_tokens" ("email")
    `);

    // Ajouter email_verified sur users (false par défaut pour les comptes existants)
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT FALSE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verified"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "identifier_recovery_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_verification_tokens"`);
  }
}
