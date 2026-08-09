import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chantier « profils complets » — section déclarative et section prescription
 * des profils pédagogiques (docs/proposition-profils.md, §4, §5 et §6).
 *
 * Élève (student_pedagogical_profiles) :
 *   déclaratif   → difficulties, context
 *   prescription → general_assessment, recommended_pace,
 *                  recommended_teacher_profile, recommended_path,
 *                  recommended_activities, filled_by, filled_at
 *
 * Formateur (teacher_pedagogical_profiles) :
 *   déclaratif   → diplomas, specialties, particularities, cv_document_id
 *   prescription → max_validated_level, audience_type, test_comments,
 *                  filled_by, filled_at
 *
 * `resultats_tests` (testResults) n'est PAS déplacé physiquement : il passe de
 * la section déclarative à la section prescription, mais les deux sections
 * vivent dans la même table — c'est un seul profil pédagogique par rôle. Le
 * changement porte uniquement sur qui a le droit d'écrire ce champ (route
 * dédiée RP au lieu de PUT /profiles/:userId/pedagogical). Aucune donnée
 * existante n'est donc touchée, ni copiée, ni supprimée.
 *
 * Rejouabilité : toutes les commandes utilisent IF NOT EXISTS / IF EXISTS, la
 * migration peut être rejouée sur un schéma déjà partiellement à jour (le
 * schéma de dev a été créé historiquement par `synchronize`, pas par des
 * migrations, donc son état exact n'est pas garanti).
 *
 * Convention de nommage des colonnes : les colonnes existantes sont en
 * français (héritage documenté dans administrative-profile.entity.ts, décision
 * C9) et ne sont PAS renommées ici — un renommage n'est pas demandé par le
 * chantier et ferait porter un risque inutile à des profils réels. Les
 * NOUVELLES colonnes sont en anglais snake_case, conformément à la règle de
 * langue du 2026-08-09. La cohabitation est assumée et documentée ; un
 * alignement complet est possible plus tard, maintenant qu'un outil de
 * migration existe.
 */
export class AddPedagogicalProfileSections1754730000000 implements MigrationInterface {
  name = 'AddPedagogicalProfileSections1754730000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Élève : section déclarative ----------------------------------------
    await queryRunner.query(`
      ALTER TABLE "student_pedagogical_profiles"
        ADD COLUMN IF NOT EXISTS "difficulties" text,
        ADD COLUMN IF NOT EXISTS "context" text
    `);

    // --- Élève : section prescription (écrite par le RP seul) ---------------
    await queryRunner.query(`
      ALTER TABLE "student_pedagogical_profiles"
        ADD COLUMN IF NOT EXISTS "general_assessment" text,
        ADD COLUMN IF NOT EXISTS "recommended_pace" text,
        ADD COLUMN IF NOT EXISTS "recommended_teacher_profile" text,
        ADD COLUMN IF NOT EXISTS "recommended_path" text,
        ADD COLUMN IF NOT EXISTS "recommended_activities" text,
        ADD COLUMN IF NOT EXISTS "filled_by" uuid,
        ADD COLUMN IF NOT EXISTS "filled_at" TIMESTAMP
    `);

    // --- Formateur : section déclarative ------------------------------------
    await queryRunner.query(`
      ALTER TABLE "teacher_pedagogical_profiles"
        ADD COLUMN IF NOT EXISTS "diplomas" text,
        ADD COLUMN IF NOT EXISTS "specialties" text,
        ADD COLUMN IF NOT EXISTS "particularities" text,
        ADD COLUMN IF NOT EXISTS "cv_document_id" character varying(255)
    `);

    // --- Formateur : section prescription (écrite par le RP seul) -----------
    await queryRunner.query(`
      ALTER TABLE "teacher_pedagogical_profiles"
        ADD COLUMN IF NOT EXISTS "max_validated_level" character varying(100),
        ADD COLUMN IF NOT EXISTS "audience_type" text,
        ADD COLUMN IF NOT EXISTS "test_comments" text,
        ADD COLUMN IF NOT EXISTS "filled_by" uuid,
        ADD COLUMN IF NOT EXISTS "filled_at" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teacher_pedagogical_profiles"
        DROP COLUMN IF EXISTS "filled_at",
        DROP COLUMN IF EXISTS "filled_by",
        DROP COLUMN IF EXISTS "test_comments",
        DROP COLUMN IF EXISTS "audience_type",
        DROP COLUMN IF EXISTS "max_validated_level",
        DROP COLUMN IF EXISTS "cv_document_id",
        DROP COLUMN IF EXISTS "particularities",
        DROP COLUMN IF EXISTS "specialties",
        DROP COLUMN IF EXISTS "diplomas"
    `);

    await queryRunner.query(`
      ALTER TABLE "student_pedagogical_profiles"
        DROP COLUMN IF EXISTS "filled_at",
        DROP COLUMN IF EXISTS "filled_by",
        DROP COLUMN IF EXISTS "recommended_activities",
        DROP COLUMN IF EXISTS "recommended_path",
        DROP COLUMN IF EXISTS "recommended_teacher_profile",
        DROP COLUMN IF EXISTS "recommended_pace",
        DROP COLUMN IF EXISTS "general_assessment",
        DROP COLUMN IF EXISTS "context",
        DROP COLUMN IF EXISTS "difficulties"
    `);
  }
}
