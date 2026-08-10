import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chantier « photo de profil » — l'avatar devient une donnée gérée par
 * l'application, et non plus une URL externe saisie à la main.
 *
 * Trois colonnes remplacent `avatar_url` :
 *   avatar_object_key    clé d'objet dans le stockage des médias
 *   avatar_content_type  type MIME des octets stockés (image/webp)
 *   avatar_updated_at    horodatage du dernier envoi, jeton de version de l'URL
 *
 * SUPPRESSION DE `avatar_url` — GARDE-FOU.
 * La colonne est retirée parce que plus rien ne l'écrit : l'API expose
 * désormais un `avatarUrl` CONSTRUIT à partir de la clé d'objet, et le champ
 * est refusé en écriture. Laisser derrière soi une colonne qui porte le nom
 * d'une donnée qu'elle ne contient plus est précisément le genre de double
 * nommage que `docs/architecture.md` proscrit.
 *
 * Mais une suppression de colonne est irréversible pour les données qu'elle
 * contient. La migration REFUSE donc de s'exécuter si la moindre ligne porte
 * un `avatar_url` non nul : mieux vaut un démarrage bloqué et un message
 * explicite qu'une URL effacée en silence. Vérifié le 2026-08-10 sur la base
 * réelle : 20 profils administratifs, 0 `avatar_url` renseigné — la migration
 * passe sans rien détruire.
 *
 * `down()` recrée la colonne (vide, puisqu'elle l'était).
 */
export class AddProfileAvatarStorage1754820000000 implements MigrationInterface {
  name = 'AddProfileAvatarStorage1754820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "administrative_profiles"
        ADD COLUMN IF NOT EXISTS "avatar_object_key" character varying(200),
        ADD COLUMN IF NOT EXISTS "avatar_content_type" character varying(100),
        ADD COLUMN IF NOT EXISTS "avatar_updated_at" TIMESTAMP
    `);

    const legacyColumn: unknown[] = await queryRunner.query(`
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'administrative_profiles'
        AND column_name = 'avatar_url'
    `);

    if (legacyColumn.length === 0) return; // déjà supprimée : migration rejouable

    const remaining: unknown[] = await queryRunner.query(`
      SELECT count(*)::int AS remaining
      FROM "administrative_profiles"
      WHERE "avatar_url" IS NOT NULL
    `);
    const remainingCount = (remaining as { remaining: number }[])[0]?.remaining ?? 0;

    if (remainingCount > 0) {
      throw new Error(
        `Migration AddProfileAvatarStorage interrompue : ${remainingCount} profil(s) ` +
          "administratif(s) portent encore une valeur dans `avatar_url`. Supprimer la colonne " +
          'les effacerait. Reprendre ces valeurs à la main (télécharger les images et les ' +
          'renvoyer via POST /profiles/:userId/avatar), puis vider la colonne avant de rejouer ' +
          'cette migration.',
      );
    }

    await queryRunner.query(`ALTER TABLE "administrative_profiles" DROP COLUMN "avatar_url"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "administrative_profiles"
        ADD COLUMN IF NOT EXISTS "avatar_url" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "administrative_profiles"
        DROP COLUMN IF EXISTS "avatar_updated_at",
        DROP COLUMN IF EXISTS "avatar_content_type",
        DROP COLUMN IF EXISTS "avatar_object_key"
    `);
  }
}
