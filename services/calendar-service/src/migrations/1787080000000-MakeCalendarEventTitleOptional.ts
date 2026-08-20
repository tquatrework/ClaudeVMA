import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bug signalé par l'utilisateur le 2026-08-20 : le formulaire de création
 * d'événement (`POST /calendars/:ownerId/events`) annonce `title` comme
 * optionnel côté front, mais le serveur le refusait faute de
 * `@IsOptional()` sur `CreateCalendarEventDto` — corrigé dans le même
 * chantier. La colonne `title` de `calendar_events` était `NOT NULL` en
 * base, ce qui aurait de toute façon fait échouer un `INSERT` sans titre
 * même une fois le DTO corrigé. Cette migration lève la contrainte.
 *
 * Aucun titre par défaut n'est fabriqué : un événement sans titre est
 * stocké avec `title = NULL`, jamais une chaîne de repli — l'affichage
 * d'un texte de substitution reste un sujet front (docs/architecture.md,
 * règle générale sur le chargement/affichage des données).
 *
 * `up` est idempotent en pratique (`DROP NOT NULL` sur une colonne déjà
 * nullable ne lève pas d'erreur PostgreSQL). `down` restaure la contrainte
 * NOT NULL : les lignes déjà passées à NULL entre-temps sont d'abord
 * ramenées à une valeur non nulle pour que l'ALTER TABLE ne casse pas —
 * seule façon sûre de revenir en arrière sans perdre de lignes.
 */
export class MakeCalendarEventTitleOptional1787080000000
  implements MigrationInterface
{
  name = 'MakeCalendarEventTitleOptional1787080000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "calendar_events"
        ALTER COLUMN "title" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "calendar_events" SET "title" = '' WHERE "title" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "calendar_events"
        ALTER COLUMN "title" SET NOT NULL
    `);
  }
}
