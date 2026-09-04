import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Outbox transactionnel des événements de domaine (voir
 * `DomainEventOutbox` pour le contexte complet). `EventsService.publish()`
 * écrivait jusqu'ici seulement un `logger.log()` — cette table lui donne un
 * support persistant, balayé par `EventPublisherService` pour un `XADD` sur
 * le stream Redis `visiomath:events`.
 *
 * Besoin déclencheur : `communication-service` (chantier Contacts,
 * 2026-09-04) a constaté que `TeacherLinkedToStudent`,
 * `StudentLinkedToFinanceOwner` et `AnimatorLinkedToTeacher` ne figurent
 * jamais sur le stream réel — `profile-service` ne les publiait pas.
 */
export class CreateDomainEventsOutbox1794300000000 implements MigrationInterface {
  name = 'CreateDomainEventsOutbox1794300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "domain_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "type" character varying(100) NOT NULL,
        "payload" jsonb NOT NULL,
        "occurred_at" TIMESTAMPTZ NOT NULL,
        "published_at" TIMESTAMPTZ,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_domain_events" PRIMARY KEY ("id")
      )
    `);

    // Index partiel : le balayage périodique ne lit que les lignes non
    // publiées (`WHERE published_at IS NULL`). Bon marché en permanence,
    // même quand la table grossit une fois la grande majorité des lignes
    // publiées — même discipline que les autres index partiels de ce
    // service (ex. la contrainte d'unicité active sur les liens de relation).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_domain_events_unpublished"
      ON "domain_events" ("created_at")
      WHERE "published_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_domain_events_unpublished"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "domain_events"`);
  }
}
