import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: DropNameAndPhoneColumns
 *
 * Décision d'architecture du 2026-08-05 : firstName/lastName/phone quittent
 * identity-access-service. profile-service devient l'unique propriétaire de
 * ces données, alimenté directement par l'appel sortant
 * POST /internal/create-administrative-profile au moment de la création de
 * compte (voir AccountsService.persistAdministrativeProfile) — il ne s'agit
 * plus d'une synchronisation d'une copie locale (approche "best-effort"
 * abandonnée), ces colonnes n'ont donc plus lieu d'exister ici.
 *
 * IF EXISTS / colonnes recréées nullable en down() : ces colonnes ont été
 * introduites via `synchronize` en développement (cf. openItem
 * TD-baseline-migration, aucune migration ne les a créées formellement), leur
 * présence réelle en base de production n'est donc pas garantie.
 */
export class DropNameAndPhoneColumns1754400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "first_name"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "last_name"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "phone"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_name" VARCHAR(100)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_name" VARCHAR(100)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(30)`);
  }
}
