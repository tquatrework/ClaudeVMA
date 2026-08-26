import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Retrait de `resource_links` sur pedagogical_logs — arbitrage du 2026-08-26,
 * docs/architecture.md "Syntaxe legere unifiee pour le texte enrichi (liens,
 * puis notation mathematique)".
 *
 * Le champ structuré `resourceLinks` (`[{label, url}]`), ajouté par la
 * migration LiensEtPiecesJointesCahierDeTexte1788700000000 le même jour,
 * s'est révélé déconnecté de l'usage réel après test utilisateur : le lien
 * doit être inséré directement dans le texte de `sessionSummary`/`homework`
 * via une syntaxe légère `[label](url)`, rendue côté front — pas dans une
 * liste séparée. Deux mécanismes concurrents pour la même donnée auraient
 * violé la règle du projet "un seul nom, un seul mécanisme par donnée".
 *
 * Cette migration est une migration `down` symétrique de la précédente,
 * nécessaire car LiensEtPiecesJointesCahierDeTexte1788700000000 avait déjà
 * été appliquée sur la base réelle au moment du constat — pas de donnée à
 * préserver, la fonctionnalité n'a jamais été utilisée en réel.
 *
 * up() : supprime la colonne `resource_links`.
 * down() : la recrée (vide), pour rester réversible.
 */
export class RetraitResourceLinksCahierDeTexte1788800000000 implements MigrationInterface {
  name = 'RetraitResourceLinksCahierDeTexte1788800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pedagogical_logs" DROP COLUMN IF EXISTS "resource_links"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pedagogical_logs"
        ADD COLUMN IF NOT EXISTS "resource_links" text NULL
    `);
  }
}
