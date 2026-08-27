import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Généralisation du carnet personnel à tout rôle — 2026-08-27 (branche
 * feat/carnet-personnel-tous-roles).
 *
 * Contexte (docs/architecture.md, "Generalisation du carnet personnel a
 * d'autres roles que l'eleve") : ce n'est PAS une extension du carnet élève
 * à d'autres rôles, c'est le MÊME mécanisme répliqué par titulaire. Tout
 * utilisateur authentifié — élève, formateur, animateur pédagogique, et tout
 * rôle futur — possède désormais son propre carnet, strictement privé.
 * Aucune relation métier ni aucun rôle administratif n'y ouvre de droit,
 * pas même l'ancien accès TI "incident" (retiré par cette même session).
 *
 * `notebook_entries` n'a jamais eu de migration dédiée — comme
 * `memo_chapters`/`memo_items` avant `CreateMemoTables1789500000000`, la
 * table a jusqu'ici existé uniquement via `synchronize` (NODE_ENV != production
 * sur la pile réelle, voir docs/architecture.md "Points ouverts a arbitrer").
 * Même prudence que cette migration précédente : `CREATE TABLE IF NOT EXISTS`
 * pour couvrir aussi bien un environnement neuf (CI) qu'un environnement où la
 * table existe déjà par accident.
 *
 * up() :
 * 1. Crée `notebook_entries` si absente (nouvel environnement), déjà avec
 *    `owner_id` (nouveau nom).
 * 2. Renomme la colonne `student_id` -> `owner_id` si la table existait déjà
 *    sous son ancienne forme (héritée de `synchronize` avec l'ancienne
 *    entité `studentId`).
 * 3. Index sur `owner_id`, absent de la forme héritée de `synchronize`.
 *
 * down() : renomme `owner_id` -> `student_id` (best-effort, symétrique —
 * aucune donnée n'est perdue, seul le nom de colonne change dans les deux
 * sens).
 */
export class GeneralisationCarnetPersonnel1789700000000 implements MigrationInterface {
  name = 'GeneralisationCarnetPersonnel1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notebook_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "owner_id" varchar NOT NULL,
        "content" text NOT NULL,
        "title" varchar NULL,
        "entry_date" date NULL,
        "calendar_event_id" varchar NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notebook_entries" PRIMARY KEY ("id")
      )
    `);

    // Si la table existait déjà (héritée de `synchronize` avec l'ancienne
    // entité `studentId`), renomme la colonne — no-op si `student_id`
    // n'existe pas (table fraîchement créée ci-dessus, ou déjà migrée).
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'notebook_entries' AND column_name = 'student_id'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'notebook_entries' AND column_name = 'owner_id'
        ) THEN
          ALTER TABLE "notebook_entries" RENAME COLUMN "student_id" TO "owner_id";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notebook_entries_owner_id"
        ON "notebook_entries" ("owner_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notebook_entries_owner_id"`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'notebook_entries' AND column_name = 'owner_id'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'notebook_entries' AND column_name = 'student_id'
        ) THEN
          ALTER TABLE "notebook_entries" RENAME COLUMN "owner_id" TO "student_id";
        END IF;
      END $$;
    `);
  }
}
