import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Relation ANIMATEUR PÉDAGOGIQUE → FORMATEUR (arbitrage du 2026-08-11 sur le
 * droit d'accès aux statistiques et aux archives).
 *
 * Elle n'existait dans aucune table : `pedagogical_coordinator_links` lie un
 * coordinateur à un ÉLÈVE, pas à un formateur. Tant qu'elle manquait, « l'AP
 * voit les statistiques des formateurs qu'il anime » ne pouvait être appliqué
 * qu'en ouvrant tout à son rôle — ce que l'arbitrage refuse.
 *
 * Table vide à la création : aucune donnée existante ne peut être reprise, il
 * n'y avait rien à reprendre. Conséquence assumée et à signaler : tant qu'aucun
 * lien n'est créé (`POST /relations/animator-teacher`, RP), un AP n'a accès aux
 * statistiques d'AUCUN formateur. C'est l'état correct au regard de la règle,
 * pas une régression silencieuse.
 *
 * Rejouabilité : IF NOT EXISTS partout, comme les migrations précédentes.
 */
export class CreateAnimatorTeacherLinks1754960000000 implements MigrationInterface {
  name = 'CreateAnimatorTeacherLinks1754960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "animator_teacher_links" (
        "id"          uuid NOT NULL DEFAULT gen_random_uuid(),
        "animator_id" uuid NOT NULL,
        "teacher_id"  uuid NOT NULL,
        "created_at"  TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_animator_teacher_links" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_animator_teacher_links_pair" UNIQUE ("animator_id", "teacher_id")
      )
    `);

    // Les deux sens sont interrogés (relations d'un AP, animateurs d'un
    // formateur) : un index par colonne, pas seulement la contrainte d'unicité
    // qui ne sert que le préfixe (animator_id).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_animator_teacher_links_animator"
        ON "animator_teacher_links" ("animator_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_animator_teacher_links_teacher"
        ON "animator_teacher_links" ("teacher_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "animator_teacher_links"`);
  }
}
