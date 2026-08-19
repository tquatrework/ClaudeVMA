import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chantier « calendrier de disponibilités », point 3 (gap réel) : jusqu'ici
 * `EventsService.publish()` écrivait UNE LIGNE DE LOG et rien d'autre —
 * aucun bus, aucun abonné, aucun moyen pour `dashboard-notification-service`
 * de notifier une proposition de créneau de cours. Même constat, même
 * remède que pour `teacher-request-service` le 2026-08-12 : un evenement
 * qui n'est qu'un `logger.log` n'est pas un evenement.
 *
 * Cette migration crée la table `domain_events`, schéma identique à celui
 * de `teacher-request-service` (voir
 * `teacher-request-service/src/migrations/1754960000000-flow-demande-professeur.ts`) —
 * un seul mécanisme d'outbox dans toute la plateforme, publié sur le même
 * flux Redis `visiomath:events` (voir `EventPublisher`).
 *
 * `IF NOT EXISTS` partout : rejouable, et sûr même si la table existait déjà
 * par un autre moyen.
 */
export class AddDomainEventsOutbox1787070000000 implements MigrationInterface {
  name = 'AddDomainEventsOutbox1787070000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "domain_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_name" character varying NOT NULL,
        "aggregate_type" character varying NOT NULL,
        "aggregate_id" character varying NOT NULL,
        "payload" jsonb NOT NULL,
        "correlation_id" character varying,
        "occurred_at" TIMESTAMP NOT NULL DEFAULT now(),
        "published_at" TIMESTAMP,
        "publish_attempts" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_domain_events" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_domain_events_published_at" ON "domain_events" ("published_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_domain_events_event_name" ON "domain_events" ("event_name")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_domain_events_aggregate_id" ON "domain_events" ("aggregate_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "domain_events"`);
  }
}
