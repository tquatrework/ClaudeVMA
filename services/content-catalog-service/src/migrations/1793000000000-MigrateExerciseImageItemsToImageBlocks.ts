import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Arbitrage du 2026-09-01 (`docs/architecture.md`, "Bloc 'image' de premier
 * niveau pour l'Exercice"), point 4 : contrairement à la refonte du
 * 2026-08-29 ("reconstruction, pas une migration de données"), CETTE
 * migration PRÉSERVE les données — les images déjà envoyées via l'ancien
 * mécanisme (un item de type `image` rattaché DIRECTEMENT à un bloc
 * `statement`/`question`, jamais à une solution) sont déplacées vers un
 * NOUVEAU bloc dédié de catégorie `image`, inséré juste après le bloc
 * d'origine dans la séquence — à la position qu'elles occupaient.
 *
 * Ne touche JAMAIS les items image d'une SOLUTION (`solutionId` non nul) :
 * ceux-là restent des items de la solution, inchangés par cet arbitrage —
 * seule la séquence de blocs de PREMIER NIVEAU (statement/image/question)
 * change de forme.
 *
 * Suppose que `AddImagePartCategoryEnum1792000000000` a déjà ajouté la
 * valeur `'image'` à l'enum, dans une transaction déjà validée (voir le
 * commentaire de cette migration pour le détail de cette contrainte
 * Postgres).
 *
 * Très peu de volume réel au moment de ce chantier (le mécanisme précédent
 * venait d'être livré le jour même, 2026-08-29) — traitement procédural
 * (boucle JS) plutôt que déclaratif, acceptable à ce volume.
 *
 * Idempotente : la jointure sur `ep.category != 'image'` exclut les items
 * déjà migrés (leur bloc parent, nouvellement créé, porte la catégorie
 * `image`) — un second passage ne les sélectionne plus. Sûre sur une base
 * neuve (`to_regclass`).
 */
export class MigrateExerciseImageItemsToImageBlocks1793000000000 implements MigrationInterface {
  name = 'MigrateExerciseImageItemsToImageBlocks1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [partsTable] = await queryRunner.query(`SELECT to_regclass('public.exercise_parts') AS reg`);
    const [itemsTable] = await queryRunner.query(`SELECT to_regclass('public.exercise_content_items') AS reg`);
    if (!partsTable?.reg || !itemsTable?.reg) {
      return; // base neuve, rien à migrer
    }

    // Items image rattachés à un bloc dont la catégorie n'est PAS déjà
    // 'image'. Ordre DESC sur `order` au sein d'un même bloc source : traités
    // du dernier au premier pour que l'insertion successive de nouveaux
    // blocs (qui décale toujours "juste après le bloc source") restitue le
    // bon ordre relatif une fois tous les items migrés.
    const legacyImageItems: Array<{ id: string; partId: string }> = await queryRunner.query(`
      SELECT eci.id, eci."partId"
      FROM "exercise_content_items" eci
      JOIN "exercise_parts" ep ON ep.id = eci."partId"
      WHERE eci.type = 'image' AND eci."partId" IS NOT NULL AND ep.category != 'image'
      ORDER BY eci."partId" ASC, eci."order" DESC
    `);

    for (const item of legacyImageItems) {
      const [part] = await queryRunner.query(
        `SELECT "exerciseId", "partNumber" FROM "exercise_parts" WHERE id = $1`,
        [item.partId],
      );
      if (!part) continue; // orphelin improbable, ignoré défensivement

      // Décale les blocs suivants pour insérer le nouveau bloc 'image' juste
      // après le bloc d'origine, à la position qu'il occupait.
      await queryRunner.query(
        `UPDATE "exercise_parts" SET "partNumber" = "partNumber" + 1 WHERE "exerciseId" = $1 AND "partNumber" > $2`,
        [part.exerciseId, part.partNumber],
      );

      const [{ id: newPartId }] = await queryRunner.query(
        `INSERT INTO "exercise_parts" ("id", "exerciseId", "partNumber", "category", "createdAt")
         VALUES (gen_random_uuid(), $1, $2, 'image', now())
         RETURNING id`,
        [part.exerciseId, part.partNumber + 1],
      );

      await queryRunner.query(`UPDATE "exercise_content_items" SET "partId" = $1, "order" = 0 WHERE id = $2`, [
        newPartId,
        item.id,
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Irréversible : reconstituer la position exacte d'origine (l'ordre
    // précis parmi les items du bloc source) n'a pas de valeur pratique et
    // n'est pas trivial à garantir. Aucune action.
    void queryRunner;
  }
}
