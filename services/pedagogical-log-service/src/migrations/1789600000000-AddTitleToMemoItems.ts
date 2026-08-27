import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Correctif d'une régression — chantier feat/memo-formules, 2026-08-27.
 *
 * Constat remonté par l'utilisateur en testant en direct : « la possibilité
 * de donner un titre à chaque mémo semble avoir disparu ». L'ancien modèle
 * plat `Memo` (avant l'assainissement livré le même jour par
 * `CreateMemoTables1789500000000`) portait un `title` optionnel, mais cette
 * migration ne l'a jamais repris sur `memo_items` — oubli dans la
 * spécification du plan de chantier, pas une erreur d'exécution. Un `title`
 * envoyé à la création était donc silencieusement absorbé sans effet
 * (`ValidationPipe({whitelist:true})` sans `forbidNonWhitelisted`, et le DTO
 * ne portait aucune propriété `title`).
 *
 * Colonne nullable, sans valeur par défaut : un item existant n'a jamais eu
 * de titre, `NULL` est l'état correct pour lui — pas une chaîne vide, qui
 * laisserait croire qu'un titre vide a été saisi.
 *
 * up() : ajoute `title` (varchar, nullable) sur `memo_items`.
 * down() : retire la colonne.
 */
export class AddTitleToMemoItems1789600000000 implements MigrationInterface {
  name = 'AddTitleToMemoItems1789600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "memo_items"
        ADD COLUMN IF NOT EXISTS "title" varchar NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "memo_items" DROP COLUMN IF EXISTS "title"
    `);
  }
}
