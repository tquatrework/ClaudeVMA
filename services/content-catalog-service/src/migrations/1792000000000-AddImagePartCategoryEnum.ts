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
 * CORRECTIF DU 2026-09-01, vérifié contre la pile réelle : scinder l'ajout
 * de l'enum et son utilisation dans deux FICHIERS de migration distincts ne
 * suffit PAS à les isoler dans deux transactions Postgres séparées — le
 * `migrationsTransactionMode` par défaut de TypeORM (`"all"`, pas `"each"`)
 * exécute TOUTES les migrations en attente dans UNE SEULE transaction. Le
 * premier déploiement de ce correctif a échoué en HTTP réel avec
 * `QueryFailedError: unsafe use of new value "image" of enum type
 * exercise_parts_category_enum`, exactement la restriction Postgres que ce
 * découpage en deux fichiers visait (à tort) à éviter.
 *
 * Cette migration force donc explicitement une frontière de transaction :
 * `commitTransaction()` juste après l'ALTER TYPE, puis `startTransaction()`
 * pour rouvrir une transaction avant de rendre la main à l'exécuteur de
 * migrations TypeORM (qui commit lui-même à la fin du lot) — la migration
 * suivante (`MigrateExerciseImageItemsToImageBlocks1793000000000`, qui
 * utilise la valeur `'image'`) s'exécute alors dans une transaction où cette
 * valeur est déjà validée, quel que soit le mode de transaction configuré.
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

    // Force la validation de la nouvelle valeur AVANT que la migration
    // suivante ne l'utilise, quel que soit `migrationsTransactionMode` (voir
    // commentaire ci-dessus). `startTransaction()` rouvre immédiatement une
    // transaction pour que le COMMIT final de l'exécuteur de migrations
    // TypeORM reste valide.
    await queryRunner.commitTransaction();
    await queryRunner.startTransaction();
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres ne permet pas de retirer une valeur d'un type enum — même
    // limite déjà documentée ailleurs dans ce projet pour des cas
    // similaires (migrations irréversibles par nature). Aucune action.
    void queryRunner;
  }
}
