import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Accès administratif et parental au carnet personnel — 2026-08-28
 * (docs/architecture.md, "Acces administratif et parental au carnet
 * personnel — parametrable par le TI, defaut ferme").
 *
 * Crée `notebook_access_settings`, table à une seule ligne (singleton),
 * distincte de `pedagogical_log_settings` (pièces jointes du cahier de
 * texte) : deux domaines de réglages séparés, chacun avec son propre
 * singleton. Valeurs par défaut : `admin_access = 'none'`,
 * `parent_access_to_own_child = false` — le comportement actuel (personne
 * d'autre que le titulaire n'accède au carnet personnel) reste inchangé tant
 * que le TI n'a rien activé.
 *
 * up() : crée la table et seed la ligne singleton.
 * down() : supprime la table (aucune donnée à préserver — nouveau domaine).
 */
export class AccesAdminParentCarnetPersonnel1789800000000 implements MigrationInterface {
  name = 'AccesAdminParentCarnetPersonnel1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notebook_access_settings" (
        "id" uuid NOT NULL,
        "admin_access" varchar(20) NOT NULL DEFAULT 'none',
        "parent_access_to_own_child" boolean NOT NULL DEFAULT false,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notebook_access_settings" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "notebook_access_settings" ("id")
      VALUES ('00000000-0000-0000-0000-000000000002')
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notebook_access_settings"`);
  }
}
