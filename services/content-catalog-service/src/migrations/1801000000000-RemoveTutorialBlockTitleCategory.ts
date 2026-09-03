import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Arbitrage du 2026-09-03 ("Éditeur riche (WYSIWYG) pour les blocs texte du
 * Tutoriel 'post'", docs/architecture/contenu-pedagogique-quizz-exercices-
 * evaluations.md, point 2) : la catégorie de bloc `TITLE` est retirée,
 * fusionnée dans `TEXT` — un titre devient un texte affiché en grande
 * taille/gras via l'éditeur riche front, plutôt qu'une catégorie de bloc
 * distincte portant le même besoin par un mécanisme différent.
 *
 * `TutorialBlockCategory` (côté TypeScript) ne porte donc plus que `TEXT` et
 * `IMAGE`. Cette migration migre toute ligne existante `category = 'title'`
 * vers `'text'` AVANT que `synchronize` (actif sur la pile réelle,
 * `NODE_ENV=development` — voir le point ouvert de docs/architecture.md, et
 * l'ordre migrations-avant-synchronize établi le 2026-09-01 par
 * `AddExerciseQuizTitleUniqueConstraint1795000000000`) ne tente de recréer
 * le type enum Postgres `tutorial_blocks_category_enum` sans la valeur
 * `'title'` : Postgres ne permet pas de retirer une valeur d'un type enum
 * (même limite déjà documentée dans `AddImagePartCategoryEnum1792000000000`
 * pour l'ajout), le mécanisme standard de TypeORM pour un changement de jeu
 * de valeurs recrée le type et CASTe la colonne existante vers celui-ci —
 * un cast échouerait si une ligne portait encore une valeur absente du
 * nouveau type. Aucun marquage de mise en forme "grand/gras" n'est ajouté
 * au contenu migré : le chantier Tutos/Vidéos ayant été livré le jour même
 * (PR #215/#217), aucune ligne réelle n'est attendue en pratique, mais l'état
 * réel des données est vérifié plutôt que supposé — voir le test associé.
 *
 * Idempotente et sûre sur une base neuve : `to_regclass` vérifie l'existence
 * de la table avant d'y toucher (base neuve où `synchronize` n'a pas encore
 * créé `tutorial_blocks` — il la créera alors directement avec l'enum
 * `text`/`image`, sans `'title'`). Rejouable sans effet si aucune ligne ne
 * porte plus `'title'`.
 */
export class RemoveTutorialBlockTitleCategory1801000000000 implements MigrationInterface {
  name = 'RemoveTutorialBlockTitleCategory1801000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableRows: Array<{ reg: string | null }> = await queryRunner.query(
      `SELECT to_regclass('"tutorial_blocks"') AS reg`,
    );

    if (!tableRows[0]?.reg) {
      // Base neuve : la table n'existe pas encore, synchronize la créera
      // directement avec l'enum text/image (sans 'title').
      return;
    }

    await queryRunner.query(`UPDATE "tutorial_blocks" SET "category" = 'text' WHERE "category" = 'title'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Irréversible par nature : une fois fusionnées dans 'text', les lignes
    // qui étaient 'title' ne sont plus distinguables des lignes 'text'
    // d'origine — même limite déjà documentée ailleurs dans ce projet pour
    // des migrations de fusion de catégories.
    void queryRunner;
  }
}
