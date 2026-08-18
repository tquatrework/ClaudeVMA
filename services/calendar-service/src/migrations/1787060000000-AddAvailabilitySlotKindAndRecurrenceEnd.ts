import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chantier « calendrier de disponibilités », point 1 : créneaux de
 * dispo/indispo éditables par élèves et formateurs, avec récurrence
 * hebdomadaire jusqu'à une date de fin (arbitrage du 2026-08-18).
 *
 * Deux colonnes ajoutées à `availability_slots` :
 *
 * 1. `recurrence_end_date` (nullable) : borne de fin pour une récurrence
 *    WEEKLY/BIWEEKLY. Absente aujourd'hui — un créneau récurrent était
 *    jusqu'ici illimité dans le temps. `NULL` reste un état valide
 *    (comportement actuel préservé) : c'est le cas d'une récurrence sans
 *    date de fin.
 *
 * 2. `kind` (NOT NULL, défaut 'available') : distingue désormais
 *    explicitement une disponibilité d'une indisponibilité. Toutes les
 *    lignes existantes représentaient déjà une disponibilité — le défaut
 *    'available' est donc une migration de données exacte, pas une
 *    reconstitution approximative.
 *
 * Écrite en ALTER TABLE incrémental, en supposant que `availability_slots`
 * existe déjà en base réelle (comme pour profile-service le 2026-08-06 :
 * ce service n'a jamais eu de mécanisme de migration, son schéma a donc été
 * posé par un autre moyen que cette migration ne cherche pas à reconstituer).
 * Si cette hypothèse est fausse, `migration:run` échoue net
 * (« relation "availability_slots" does not exist ») — échec bruyant et
 * sûr, jamais une corruption silencieuse, mais à vérifier contre la base
 * réelle avant mise en production.
 *
 * Rejouabilité : IF NOT EXISTS / IF EXISTS partout.
 */
export class AddAvailabilitySlotKindAndRecurrenceEnd1787060000000
  implements MigrationInterface
{
  name = 'AddAvailabilitySlotKindAndRecurrenceEnd1787060000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "availability_slots"
        ADD COLUMN IF NOT EXISTS "recurrence_end_date" TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS "kind" varchar NOT NULL DEFAULT 'available'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "availability_slots"
        DROP COLUMN IF EXISTS "kind",
        DROP COLUMN IF EXISTS "recurrence_end_date"
    `);
  }
}
