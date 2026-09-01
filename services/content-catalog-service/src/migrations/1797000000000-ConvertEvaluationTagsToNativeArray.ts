import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `evaluations.tags` passe de `simple-array` (stockage CSV dans une colonne
 * `text` scalaire) à `text[]` postgres natif — même choix que `Quiz`
 * (2026-08-28) et `Exercise` (2026-08-29), nécessaire pour la recherche
 * exacte par tag `:tag = ANY(tags)` corrigée dans ce même chantier
 * (arbitrage du 2026-09-01, "Refonte des Evaluations", point 1 : même
 * correctif que celui déjà fait pour l'Exercice). Un `simple-array` ne
 * permettrait qu'un `LIKE` fragile, avec de faux positifs de sous-chaîne
 * (ex. le tag "math" matchant "mathematiques").
 *
 * Vérifié en base le 2026-09-01 avant d'écrire cette migration : 0 ligne
 * dans `evaluations` sur la pile réelle — aucune valeur `tags` réelle à
 * convertir. La conversion `USING string_to_array(tags, ',')` reste posée
 * explicitement pour couvrir tout environnement (test, autre déploiement)
 * où des lignes existeraient déjà, plutôt que de supposer la table vide
 * partout.
 *
 * Idempotente : `to_regclass` vérifie l'existence de la table, et la
 * conversion de type ne s'applique que si la colonne n'est pas déjà
 * `text[]` (rejeu sans effet si `synchronize` a déjà recréé la colonne au
 * bon type sur une base neuve).
 */
export class ConvertEvaluationTagsToNativeArray1797000000000 implements MigrationInterface {
  name = 'ConvertEvaluationTagsToNativeArray1797000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.evaluations') IS NOT NULL THEN
          IF (
            SELECT data_type FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'evaluations' AND column_name = 'tags'
          ) = 'text' THEN
            ALTER TABLE "evaluations"
              ALTER COLUMN "tags" TYPE text[] USING string_to_array(tags, ',');
          END IF;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.evaluations') IS NOT NULL THEN
          IF (
            SELECT data_type FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'evaluations' AND column_name = 'tags'
          ) = 'ARRAY' THEN
            ALTER TABLE "evaluations"
              ALTER COLUMN "tags" TYPE text USING array_to_string(tags, ',');
          END IF;
        END IF;
      END $$;
    `);
  }
}
