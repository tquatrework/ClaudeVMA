import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Journalisation append-only des validations de formateur (arbitrage du
 * 2026-08-13, « Reprise de candidature après un refus formateur », point 5) :
 * une candidature refusée doit pouvoir être relancée sans perdre la preuve du
 * refus précédent. `teacher_validations` portait jusqu'ici UNE ligne par
 * formateur, réécrite à chaque transition (`PATCH /profiles/:teacherId/validation`)
 * — le refus disparaissait dès la ligne suivante.
 *
 * Même mécanique que `consent_records` (identity-access-service) et que les
 * tables de relation de ce service (`finance_owner_student_links`,
 * `teacher_student_links`) : on n'écrase JAMAIS une ligne, on en ajoute une.
 * Le statut courant se lit comme la ligne la plus RÉCENTE (`created_at DESC`,
 * `id` en départage).
 *
 * La contrainte d'unicité sur `teacher_id` interdirait exactement la nouvelle
 * ligne `pending` d'une reprise de candidature : elle est donc supprimée, et
 * remplacée par un index (`teacher_id`, `created_at`) qui sert les deux
 * lectures désormais nécessaires : « la dernière ligne d'un formateur donné »
 * (lecture individuelle, PATCH, reprise) et « la dernière ligne de chaque
 * formateur » (annuaire des formateurs validés / file de validation du RP).
 *
 * Rejouable : IF EXISTS / IF NOT EXISTS partout. La contrainte est cherchée
 * par son RÔLE (colonne + type), pas par son nom généré — qui diffère d'un
 * environnement à l'autre — même motif que `AddFinanceOwnerStudentLinkEnd` et
 * `AddTeacherStudentLinkEnd`.
 */
export class MakeTeacherValidationsAppendOnly1755200000000 implements MigrationInterface {
  name = 'MakeTeacherValidationsAppendOnly1755200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE constraint_name text;
      BEGIN
        SELECT con.conname INTO constraint_name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'teacher_validations'
          AND con.contype = 'u'
          AND con.conkey = ARRAY[
            (SELECT attnum FROM pg_attribute
              WHERE attrelid = rel.oid AND attname = 'teacher_id')
          ]::smallint[]
        LIMIT 1;

        IF constraint_name IS NOT NULL THEN
          EXECUTE format(
            'ALTER TABLE "teacher_validations" DROP CONSTRAINT %I',
            constraint_name
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_teacher_validations_teacher_id_created_at"
        ON "teacher_validations" ("teacher_id", "created_at")
    `);
  }

  /**
   * Retour arrière : ne restaure l'unicité que si aucun formateur ne porte
   * encore plusieurs lignes (refus suivi d'une reprise de candidature,
   * plusieurs transitions déjà journalisées). Comme dans les migrations
   * sœurs, un échec net est préférable à une suppression de lignes
   * d'historique pour rendre le retour arrière possible.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_teacher_validations_teacher_id_created_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "teacher_validations"
        ADD CONSTRAINT "UQ_teacher_validations_teacher_id"
        UNIQUE ("teacher_id")
    `);
  }
}
