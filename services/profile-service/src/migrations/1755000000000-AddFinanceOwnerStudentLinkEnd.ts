import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rupture d'un lien parent financeur ↔ élève (besoin du 2026-08-11 : bouton
 * « Délier », des deux côtés).
 *
 * Trois décisions matérialisées ici :
 *
 * 1. DÉLIER N'EFFACE PAS. On ajoute `ended_at`/`ended_by` ; aucune ligne n'est
 *    supprimée, jamais. La table devient un journal, comme `consent_records`
 *    l'est devenu pour les consentements (arbitrage du 2026-08-09).
 *
 * 2. LE LIEN DOIT POUVOIR ÊTRE RECRÉÉ. La contrainte d'unicité existante
 *    (`UQ_..._3ca67aa06a64b58a671075b63b5` sur la paire) l'interdirait : la
 *    ligne rompue resterait en base et bloquerait toute réinsertion. Elle est
 *    donc remplacée par un index unique PARTIEL sur les seuls liens ACTIFS.
 *    Autant de ruptures qu'on veut, jamais deux liens actifs pour une paire.
 *
 * 3. AUCUNE PERTE. Les lignes existantes reçoivent `ended_at = NULL`, donc
 *    restent actives : le comportement observé avant la migration est
 *    strictement conservé.
 *
 * La contrainte d'unicité est cherchée par son RÔLE (colonnes + type) et non
 * par le nom généré par TypeORM, qui diffère d'une base à l'autre — la base de
 * production porte `UQ_3ca67aa06a64b58a671075b63b5`, une base recréée par
 * `synchronize` en porterait un autre.
 *
 * Rejouabilité : IF NOT EXISTS / IF EXISTS partout.
 */
export class AddFinanceOwnerStudentLinkEnd1755000000000 implements MigrationInterface {
  name = 'AddFinanceOwnerStudentLinkEnd1755000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "finance_owner_student_links"
        ADD COLUMN IF NOT EXISTS "ended_at" TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS "ended_by" uuid NULL
    `);

    // Supprime la contrainte d'unicité pleine sur (finance_owner_id, student_id),
    // quel que soit son nom généré.
    await queryRunner.query(`
      DO $$
      DECLARE constraint_name text;
      BEGIN
        SELECT con.conname INTO constraint_name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'finance_owner_student_links'
          AND con.contype = 'u'
          AND con.conkey @> ARRAY[
            (SELECT attnum FROM pg_attribute
              WHERE attrelid = rel.oid AND attname = 'finance_owner_id'),
            (SELECT attnum FROM pg_attribute
              WHERE attrelid = rel.oid AND attname = 'student_id')
          ]::smallint[]
        LIMIT 1;

        IF constraint_name IS NOT NULL THEN
          EXECUTE format(
            'ALTER TABLE "finance_owner_student_links" DROP CONSTRAINT %I',
            constraint_name
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_finance_owner_student_links_active"
        ON "finance_owner_student_links" ("finance_owner_id", "student_id")
        WHERE "ended_at" IS NULL
    `);
  }

  /**
   * Retour arrière : on ne peut restaurer l'unicité pleine que si aucune paire
   * n'a été rompue puis recréée. Le cas échéant, l'échec est net et volontaire —
   * mieux vaut refuser le retour arrière que supprimer des lignes d'historique
   * pour le rendre possible.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_finance_owner_student_links_active"
    `);
    await queryRunner.query(`
      ALTER TABLE "finance_owner_student_links"
        ADD CONSTRAINT "UQ_finance_owner_student_links_pair"
        UNIQUE ("finance_owner_id", "student_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "finance_owner_student_links"
        DROP COLUMN IF EXISTS "ended_by",
        DROP COLUMN IF EXISTS "ended_at"
    `);
  }
}
