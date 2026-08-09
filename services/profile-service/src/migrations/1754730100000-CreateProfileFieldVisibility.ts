import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chantier « profils complets » — visibilité champ par champ
 * (docs/proposition-profils.md, §8).
 *
 * Remplace `profile_visibility_preferences` (deux booléens nommés en dur, donc
 * une colonne de plus à chaque nouveau champ masquable) par
 * `profile_field_visibility` : (userId, fieldName, audience), avec
 * audience ∈ self | linked | all. Un champ absent de la table prend la
 * visibilité par défaut de son bloc, portée par le code
 * (FIELD_VISIBILITY_CATALOG).
 *
 * REPRISE SANS PERTE des deux booléens existants. Les deux valeurs sont
 * reprises, y compris `false` : avec le nouveau socle, « tout ce qui n'est pas
 * firstName/lastName/avatarUrl/level/subjects est masqué par défaut ». Ne
 * migrer que les `true` transformerait donc silencieusement un « visible des
 * contacts » explicite en « masqué ». Chaque ligne existante produit deux
 * lignes explicites :
 *
 *   hide_difficulties_from_contacts        → fieldName 'difficulties'
 *   restrict_comments_to_principal_teacher → fieldName 'comments'
 *   valeur true  → audience 'self'   (masqué des contacts)
 *   valeur false → audience 'linked' (visible des personnes liées)
 *
 * `difficulties` et `comments` sont tous deux des champs du profil pédagogique
 * élève au sens du CdC (functionality 002 : « classe, difficultes,
 * commentaires, objectifs… »). `difficulties` est créé par ce chantier ;
 * `comments` n'est porté par aucune colonne à ce jour — son réglage de
 * visibilité est néanmoins conservé, exactement comme
 * hide_difficulties_from_contacts avait survécu à l'absence de `difficulties`.
 *
 * `down()` reconstruit la table d'origine et y réinjecte les deux booléens à
 * partir des lignes migrées : le retour arrière est lui aussi sans perte.
 */
export class CreateProfileFieldVisibility1754730100000 implements MigrationInterface {
  name = 'CreateProfileFieldVisibility1754730100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "profile_field_visibility" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "field_name" character varying(100) NOT NULL,
        "audience" character varying(16) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_profile_field_visibility" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_profile_field_visibility_user_field" UNIQUE ("userId", "field_name"),
        CONSTRAINT "CHK_profile_field_visibility_audience"
          CHECK ("audience" IN ('self', 'linked', 'all'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_profile_field_visibility_user"
        ON "profile_field_visibility" ("userId")
    `);

    // Reprise des deux booléens, seulement si la table héritée existe encore
    // (rejouabilité : la migration peut tourner sur une base neuve).
    const legacyTable: unknown[] = await queryRunner.query(`
      SELECT to_regclass('public.profile_visibility_preferences') AS table_ref
    `);
    const legacyExists = (legacyTable as { table_ref: string | null }[])[0]?.table_ref != null;

    if (legacyExists) {
      await queryRunner.query(`
        INSERT INTO "profile_field_visibility" ("userId", "field_name", "audience")
        SELECT "userId",
               'difficulties',
               CASE WHEN "hide_difficulties_from_contacts" THEN 'self' ELSE 'linked' END
        FROM "profile_visibility_preferences"
        ON CONFLICT ("userId", "field_name") DO NOTHING
      `);

      await queryRunner.query(`
        INSERT INTO "profile_field_visibility" ("userId", "field_name", "audience")
        SELECT "userId",
               'comments',
               CASE WHEN "restrict_comments_to_principal_teacher" THEN 'self' ELSE 'linked' END
        FROM "profile_visibility_preferences"
        ON CONFLICT ("userId", "field_name") DO NOTHING
      `);

      await queryRunner.query(`DROP TABLE "profile_visibility_preferences"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "profile_visibility_preferences" (
        "userId" uuid NOT NULL,
        "hide_difficulties_from_contacts" boolean NOT NULL DEFAULT false,
        "restrict_comments_to_principal_teacher" boolean NOT NULL DEFAULT false,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_profile_visibility_preferences" PRIMARY KEY ("userId")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "profile_visibility_preferences" (
        "userId",
        "hide_difficulties_from_contacts",
        "restrict_comments_to_principal_teacher"
      )
      SELECT "userId",
             bool_or("field_name" = 'difficulties' AND "audience" = 'self'),
             bool_or("field_name" = 'comments' AND "audience" = 'self')
      FROM "profile_field_visibility"
      WHERE "field_name" IN ('difficulties', 'comments')
      GROUP BY "userId"
      ON CONFLICT ("userId") DO NOTHING
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "profile_field_visibility"`);
  }
}
