import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * docs/architecture/contacts-messagerie.md (2026-09-04).
 *
 * Drops the superseded ContactPolicy model (verified empty in production — 0 rows, see the
 * session report) and creates the new Contact / ContactRequest aggregates, plus the
 * transactional-outbox infrastructure (DomainEvent / ProcessedEvent) shared with the Redis
 * event pipeline.
 */
export class ContactsAndMessagingRefonte1793900000000 implements MigrationInterface {
  name = 'ContactsAndMessagingRefonte1793900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // --- Superseded model -------------------------------------------------------------
    await queryRunner.query(`DROP TABLE IF EXISTS "contact_policies"`);

    // --- Contact ------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "contacts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_a_id" character varying NOT NULL,
        "user_b_id" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'active',
        "origin" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "broken_at" TIMESTAMPTZ,
        "broken_by" character varying,
        CONSTRAINT "PK_contacts_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_contacts_active_pair" ON "contacts" ("user_a_id", "user_b_id")
      WHERE status = 'active'
    `);
    await queryRunner.query(`CREATE INDEX "IDX_contacts_user_a_id" ON "contacts" ("user_a_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_contacts_user_b_id" ON "contacts" ("user_b_id")`);

    // --- ContactRequest -------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "contact_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "requester_id" character varying NOT NULL,
        "target_id" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "responded_at" TIMESTAMPTZ,
        CONSTRAINT "PK_contact_requests_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_contact_requests_pending_pair" ON "contact_requests" ("requester_id", "target_id")
      WHERE status = 'pending'
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_contact_requests_pair" ON "contact_requests" ("requester_id", "target_id")`,
    );

    // --- DomainEvent (transactional outbox) ------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "domain_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_name" character varying NOT NULL,
        "aggregate_type" character varying NOT NULL,
        "aggregate_id" character varying NOT NULL,
        "correlation_id" character varying,
        "payload" jsonb NOT NULL,
        "occurred_at" TIMESTAMP NOT NULL DEFAULT now(),
        "published_at" TIMESTAMPTZ,
        CONSTRAINT "PK_domain_events_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_domain_events_published_at" ON "domain_events" ("published_at")`);

    // --- ProcessedEvent (consumer dedup) ----------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "processed_events" (
        "event_id" character varying NOT NULL,
        "processed_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_processed_events_event_id" PRIMARY KEY ("event_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "processed_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "domain_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "contact_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "contacts"`);
  }
}
