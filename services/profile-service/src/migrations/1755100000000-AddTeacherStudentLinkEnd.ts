import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fin d'une relation élève ↔ formateur (arbitrage du 2026-08-12 : seul le RP y
 * met fin, depuis la fiche de l'élève).
 *
 * Strictement calquée sur `AddFinanceOwnerStudentLinkEnd1755000000000`, parce
 * que les décisions sont les mêmes. Quatre points matérialisés ici :
 *
 * 1. METTRE FIN N'EFFACE PAS. On ajoute `ended_at`/`ended_by`/`end_reason` ;
 *    aucune ligne n'est supprimée, jamais. La table devient un journal.
 *
 * 2. LA RELATION DOIT POUVOIR ÊTRE RECRÉÉE. La contrainte d'unicité existante
 *    sur la paire (`teacher_id`, `student_id`) l'interdirait : la ligne terminée
 *    resterait en base et bloquerait toute réinsertion — un arrêt vaudrait
 *    bannissement, ce que le point 6 de l'arbitrage exclut. Elle est donc
 *    remplacée par un index unique PARTIEL sur les seules relations ACTIVES.
 *
 * 3. LE MOTIF EST FACULTATIF, donc `NULL`-able. Il n'existe que pour les
 *    relations terminées à partir de maintenant ; l'historique déjà en base n'en
 *    porte aucun, ce qui est exact plutôt que reconstitué.
 *
 * 4. AUCUNE PERTE. Les lignes existantes reçoivent `ended_at = NULL`, donc
 *    restent actives : le comportement observé avant la migration est
 *    strictement conservé.
 *
 * La contrainte d'unicité est cherchée par son RÔLE (colonnes + type) et non par
 * le nom généré par TypeORM, qui diffère d'une base à l'autre — celle de
 * production et une base recréée par `synchronize` n'en portent pas le même.
 *
 * Rejouabilité : IF NOT EXISTS / IF EXISTS partout.
 */
export class AddTeacherStudentLinkEnd1755100000000 implements MigrationInterface {
  name = 'AddTeacherStudentLinkEnd1755100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teacher_student_links"
        ADD COLUMN IF NOT EXISTS "ended_at" TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS "ended_by" uuid NULL,
        ADD COLUMN IF NOT EXISTS "end_reason" text NULL
    `);

    // Supprime la contrainte d'unicité pleine sur (teacher_id, student_id),
    // quel que soit son nom généré.
    await queryRunner.query(`
      DO $$
      DECLARE constraint_name text;
      BEGIN
        SELECT con.conname INTO constraint_name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'teacher_student_links'
          AND con.contype = 'u'
          AND con.conkey @> ARRAY[
            (SELECT attnum FROM pg_attribute
              WHERE attrelid = rel.oid AND attname = 'teacher_id'),
            (SELECT attnum FROM pg_attribute
              WHERE attrelid = rel.oid AND attname = 'student_id')
          ]::smallint[]
        LIMIT 1;

        IF constraint_name IS NOT NULL THEN
          EXECUTE format(
            'ALTER TABLE "teacher_student_links" DROP CONSTRAINT %I',
            constraint_name
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_teacher_student_links_active"
        ON "teacher_student_links" ("teacher_id", "student_id")
        WHERE "ended_at" IS NULL
    `);
  }

  /**
   * Retour arrière : on ne peut restaurer l'unicité pleine que si aucune paire
   * n'a été terminée puis recréée. Le cas échéant, l'échec est net et
   * volontaire — mieux vaut refuser le retour arrière que supprimer des lignes
   * d'historique pour le rendre possible.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_teacher_student_links_active"
    `);
    await queryRunner.query(`
      ALTER TABLE "teacher_student_links"
        ADD CONSTRAINT "UQ_teacher_student_links_pair"
        UNIQUE ("teacher_id", "student_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "teacher_student_links"
        DROP COLUMN IF EXISTS "end_reason",
        DROP COLUMN IF EXISTS "ended_by",
        DROP COLUMN IF EXISTS "ended_at"
    `);
  }
}
