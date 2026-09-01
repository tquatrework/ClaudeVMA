import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Arbitrage du 2026-09-01 (`docs/architecture.md`, "Bloc 'image' de premier
 * niveau pour l'Exercice") : un exercice devient une séquence de blocs à 3
 * catégories (`statement`/`image`/`question`) au lieu de 2. Cette migration
 * ajoute la valeur `'image'` au type enum Postgres qui porte
 * `exercise_parts.category`, AVANT toute tentative d'y insérer une ligne de
 * cette catégorie (voir la migration suivante,
 * `MigrateExerciseImageItemsToImageBlocks1793000000000`, qui en a besoin).
 *
 * Volontairement scindée dans SA PROPRE migration (donc sa propre
 * transaction — `migrationsTransactionMode` par défaut de TypeORM est une
 * transaction par fichier de migration) : Postgres autorise
 * `ALTER TYPE ... ADD VALUE` à l'intérieur d'une transaction depuis la
 * version 12, mais interdit d'UTILISER cette nouvelle valeur dans la MÊME
 * transaction sur des versions antérieures. En séparant l'ajout (ici) de
 * l'utilisation (migration suivante, transaction distincte), le correctif
 * reste sûr quelle que soit la version de Postgres réellement déployée —
 * cette migration-ci ne fait STRICTEMENT rien d'autre que l'ALTER TYPE.
 *
 * Le nom exact du type enum est résolu dynamiquement
 * (`pg_type`/`pg_attribute`/`pg_class`) plutôt que supposé
 * (`exercise_parts_category_enum`, convention de nommage par défaut de
 * TypeORM), pour rester correct même si cette convention changeait un jour.
 *
 * Idempotente et sûre sur une base neuve : si la colonne n'existe pas encore
 * (`synchronize` n'a pas encore créé la table — l'ordre migrations-avant-
 * synchronize est établi dans `CleanupPreRefonteExerciseData1790000000000`),
 * `synchronize` créera directement l'enum avec `'image'` inclus, cette
 * migration ne fait alors rien. `ADD VALUE IF NOT EXISTS` couvre le cas d'un
 * redéploiement où la valeur a déjà été ajoutée.
 */
export class AddImagePartCategoryEnum1792000000000 implements MigrationInterface {
  name = 'AddImagePartCategoryEnum1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{ typname: string }> = await queryRunner.query(`
      SELECT t.typname
      FROM pg_type t
      JOIN pg_attribute a ON a.atttypid = t.oid
      JOIN pg_class c ON c.oid = a.attrelid
      WHERE c.relname = 'exercise_parts' AND a.attname = 'category' AND a.attnum > 0
    `);
    const enumTypeName = rows[0]?.typname;

    if (!enumTypeName) {
      // Base neuve : la table/colonne n'existe pas encore, synchronize la
      // créera directement avec 'image' inclus dans l'enum.
      return;
    }

    await queryRunner.query(`ALTER TYPE "${enumTypeName}" ADD VALUE IF NOT EXISTS 'image'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres ne permet pas de retirer une valeur d'un type enum — même
    // limite déjà documentée ailleurs dans ce projet pour des cas
    // similaires (migrations irréversibles par nature). Aucune action.
    void queryRunner;
  }
}
