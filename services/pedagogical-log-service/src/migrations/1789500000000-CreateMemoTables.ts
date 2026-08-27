import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Assainissement backend du Mémo — chantier feat/memo-formules, 2026-08-27.
 *
 * Constat de départ (investigation en lecture directe contre la base réelle,
 * avant toute ligne de code) : **aucune migration ne créait
 * `memo_chapters`/`memo_items`** — les seules migrations réelles du service
 * jusqu'ici ne touchaient que le cahier de texte
 * (`CahierDeTexteRefonte1787280000000`,
 * `LiensEtPiecesJointesCahierDeTexte1788700000000`,
 * `RetraitResourceLinksCahierDeTexte1788800000000`). Le service tourne en
 * production avec `synchronize: false` : ces tables auraient dû être
 * absentes. Or elles existent bel et bien sur `visiomath_pedagogical_log` —
 * vestige d'un déploiement antérieur où `synchronize: true` s'est appliqué
 * (probablement un `NODE_ENV` non "production" au premier démarrage), avec
 * une forme identique à celle attendue par les entités `MemoChapter`/
 * `MemoItem` (colonnes `student_id`/`title`/`order` etc., FK CASCADE déjà en
 * place). C'est pour cette raison que `CREATE TABLE` est en `IF NOT EXISTS` :
 * cette migration doit fonctionner aussi bien sur une base qui n'a jamais vu
 * ces tables (CI, nouvel environnement) que sur celle-ci, où elles existent
 * déjà par accident et doivent seulement recevoir les colonnes manquantes.
 *
 * Les tables `chapters`/`memos` (modèle concurrent abandonné, entités
 * `Chapter`/`Memo` retirées par ce même chantier — jamais enregistrées dans
 * `TypeOrmModule.forRootAsync`, donc jamais fonctionnelles en production :
 * `ChapterController` y répondait 500 systématique) sont supprimées ici.
 * Une seule ligne de données réelles existait dans `chapters` (un chapitre
 * "Produit scalaire" créé le 2026-06-19, jamais accompagné d'aucun mémo) —
 * perdue par ce nettoyage, ce qui est assumé : c'est un résidu du modèle
 * cassé, jamais lu par personne (`ChapterController.findOne` aurait de toute
 * façon toujours renvoyé 500 avant qu'un utilisateur ne puisse la consulter).
 *
 * up() :
 * 1. Crée `memo_chapters`/`memo_items` si absentes (nouvel environnement).
 * 2. Ajoute les colonnes image (`image_original_filename`,
 *    `image_stored_filename`, `image_mime_type`, `image_size_bytes`) sur
 *    `memo_items` — les images ne sont plus transportées en base64 dans
 *    `content` (B4 du chantier), stockées sur le volume dédié
 *    `pedagogical_log_memo_images` via `MemoImageStorageService`.
 * 3. Rend `content` nullable sur `memo_items` (vide/légende pour un item
 *    `image`, toujours requis pour `text`/`formula` — validé en DTO).
 * 4. Retire `size_kb` (taille déclarée par le client, jamais vérifiée),
 *    remplacée par `image_size_bytes` (taille réelle, mesurée serveur).
 * 5. Index sur les clés étrangères (`student_id`, `chapter_id`), absents de
 *    la forme héritée de synchronize.
 * 6. Supprime `chapters`/`memos` (modèle abandonné).
 *
 * down() : reproduit un schéma symétrique pour `memo_chapters`/`memo_items`
 * (retire les colonnes image, retire les index, ne force pas `content` en
 * NOT NULL — cette contrainte était une limite du modèle d'origine, pas une
 * propriété à restaurer) et recrée `chapters`/`memos` vides (schéma
 * uniquement, sans la ligne perdue — même limite assumée que
 * `RetraitResourceLinksCahierDeTexte1788800000000`, qui ne restaure pas non
 * plus les données qu'elle avait retirées).
 */
export class CreateMemoTables1789500000000 implements MigrationInterface {
  name = 'CreateMemoTables1789500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "memo_chapters" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "student_id" varchar NOT NULL,
        "title" varchar NOT NULL,
        "order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_memo_chapters" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "memo_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "chapter_id" uuid NOT NULL,
        "type" varchar NOT NULL,
        "content" text NULL,
        "order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_memo_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_memo_items_chapter" FOREIGN KEY ("chapter_id")
          REFERENCES "memo_chapters" ("id") ON DELETE CASCADE
      )
    `);

    // Colonnes image — absentes de la forme héritée de synchronize.
    await queryRunner.query(`
      ALTER TABLE "memo_items"
        ADD COLUMN IF NOT EXISTS "image_original_filename" varchar NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "memo_items"
        ADD COLUMN IF NOT EXISTS "image_stored_filename" varchar NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "memo_items"
        ADD COLUMN IF NOT EXISTS "image_mime_type" varchar NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "memo_items"
        ADD COLUMN IF NOT EXISTS "image_size_bytes" integer NULL
    `);

    // `content` devient nullable (item image sans légende) — no-op si déjà
    // nullable (cas d'une table fraîchement créée ci-dessus).
    await queryRunner.query(`
      ALTER TABLE "memo_items" ALTER COLUMN "content" DROP NOT NULL
    `);

    // `size_kb` retiré — remplacé par `image_size_bytes`.
    await queryRunner.query(`
      ALTER TABLE "memo_items" DROP COLUMN IF EXISTS "size_kb"
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_memo_chapters_student_id"
        ON "memo_chapters" ("student_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_memo_items_chapter_id"
        ON "memo_items" ("chapter_id")
    `);

    // Modèle abandonné (Chapter/Memo, jamais enregistré dans TypeORM en
    // production, ChapterController retiré par ce même chantier).
    await queryRunner.query(`DROP TABLE IF EXISTS "memos" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chapters" CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chapters" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chapters" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "memos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "student_id" varchar NOT NULL,
        "activity_id" varchar NULL,
        "content" text NOT NULL,
        "title" varchar NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "chapter_id" uuid NULL,
        CONSTRAINT "PK_memos" PRIMARY KEY ("id"),
        CONSTRAINT "FK_memos_chapter" FOREIGN KEY ("chapter_id")
          REFERENCES "chapters" ("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_memo_items_chapter_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_memo_chapters_student_id"`);

    // Le schéma complet de memo_items (colonnes image comprises) est
    // supprimé avec la table elle-même ci-dessous — pas besoin de défaire
    // colonne par colonne avant.
    await queryRunner.query(`DROP TABLE IF EXISTS "memo_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "memo_chapters" CASCADE`);
  }
}
