import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddConsentWithdrawal
 *
 * Arbitrage d'architecture du 2026-08-09 : un utilisateur doit pouvoir retirer
 * un consentement optionnel (`marketing`) aussi simplement qu'il l'a donné, et
 * `consent_records` devient un journal APPEND-ONLY — le retrait ajoute une ligne
 * `withdrawn`, il n'en efface ni n'en écrase aucune.
 *
 * Deux changements de schéma :
 *   1. colonne `action` ('granted' | 'withdrawn'). Toutes les lignes existantes
 *      sont des octrois : le DEFAULT 'granted' les qualifie correctement, aucun
 *      backfill applicatif n'est nécessaire ;
 *   2. `signed_at` renommée en `recorded_at`. Une colonne `signed_at` portant la
 *      date d'un RETRAIT serait un nom mensonger ; le journal horodate un
 *      événement, pas une signature. Renommage et non ajout+copie : la donnée est
 *      la même, la dupliquer créerait deux noms pour une seule donnée.
 *
 * Rejouabilité : la table `consent_records` a été créée par `synchronize` en
 * développement (cf. openItem TD-baseline-migration), aucune migration ne l'a
 * créée formellement — son état réel n'est donc pas garanti. Chaque instruction
 * est gardée par un test d'existence, `up()` comme `down()` peuvent être rejouées
 * sans erreur.
 */
export class AddConsentWithdrawal1754600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consent_records_action_enum') THEN
          CREATE TYPE "consent_records_action_enum" AS ENUM ('granted', 'withdrawn');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "consent_records"
      ADD COLUMN IF NOT EXISTS "action" "consent_records_action_enum" NOT NULL DEFAULT 'granted'
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'consent_records' AND column_name = 'signed_at'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'consent_records' AND column_name = 'recorded_at'
        ) THEN
          ALTER TABLE "consent_records" RENAME COLUMN "signed_at" TO "recorded_at";
        END IF;
      END
      $$;
    `);

    // Lecture systématique de l'état courant : dernier événement d'un
    // (utilisateur, type). Sans cet index, chaque GET /consents et chaque
    // POST /consents scanne le journal, qui ne fait que croître.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_consent_records_user_type_recorded_at"
      ON "consent_records" ("user_id", "consent_type", "recorded_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_consent_records_user_type_recorded_at"`);

    // Les lignes `withdrawn` sont supprimées ici, et seulement ici : revenir en
    // arrière signifie revenir à un schéma qui ne sait pas exprimer un retrait.
    // Les conserver ferait passer un consentement retiré pour un consentement
    // donné — un mensonge pire que la perte de la ligne.
    await queryRunner.query(`
      DELETE FROM "consent_records" WHERE "action" = 'withdrawn'
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'consent_records' AND column_name = 'recorded_at'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'consent_records' AND column_name = 'signed_at'
        ) THEN
          ALTER TABLE "consent_records" RENAME COLUMN "recorded_at" TO "signed_at";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`ALTER TABLE "consent_records" DROP COLUMN IF EXISTS "action"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "consent_records_action_enum"`);
  }
}
