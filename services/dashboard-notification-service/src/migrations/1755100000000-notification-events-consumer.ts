import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * First migration of dashboard-notification-service (arbitrage du
 * 2026-08-14, "Systeme de notifications transversal", point 11) — the
 * schema so far came entirely from `synchronize`, reserved to
 * `NODE_ENV=test` since the earlier `refactor/apply-conventions` session.
 * Applies to an existing database, hence `IF EXISTS`/`IF NOT EXISTS`
 * rather than a full `CREATE TABLE`.
 *
 * 1. `notifications.type` moves from a Postgres native enum to `varchar`.
 *    Decision documented on `NotificationType` (src/notification/entities/
 *    notification.entity.ts): `ALTER TYPE ... ADD VALUE` cannot run
 *    inside a transaction and cannot remove a value, and this stream is
 *    expected to keep growing as more services adopt the same outbox +
 *    XADD pattern.
 * 2. `notifications.title`/`message` become nullable — the Redis event
 *    consumer stores structured `metadata` only, never an invented French
 *    sentence server-side (2026-08-09 language rule).
 * 3. `processed_events` is the idempotency ledger for the Redis stream
 *    consumer (`EventProcessorService`) — publication on the producer
 *    side is not transactional, a crash can republish the same `eventId`.
 */
export class NotificationEventsConsumer1755100000000 implements MigrationInterface {
  name = 'NotificationEventsConsumer1755100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── notifications.type: enum -> varchar ─────────────────────────────
    await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" TYPE varchar(64) USING "type"::text`);
    await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" SET DEFAULT 'system'`);
    // The native enum type is now unused (only this column referenced it) — safe to drop.
    await queryRunner.query(`DROP TYPE IF EXISTS "notifications_type_enum"`);

    // ── notifications.title / notifications.message: nullable ──────────
    await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "title" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "message" DROP NOT NULL`);

    // ── processed_events: idempotency ledger for the Redis consumer ────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "processed_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" character varying NOT NULL,
        "event_name" character varying NOT NULL,
        "processed_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_processed_events" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_processed_events_event_id" UNIQUE ("event_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "processed_events"`);
    await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "message" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "title" SET NOT NULL`);
    // Not reverted: recreating the native enum with the exact original
    // value set is unsafe if new event types have already been persisted.
  }
}
