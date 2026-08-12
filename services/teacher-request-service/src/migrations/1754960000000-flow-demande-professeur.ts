import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aligne le schema sur l'arbitrage du 2026-08-12 (« Flow de la demande de
 * professeur »).
 *
 * Le service n'avait jusqu'ici AUCUNE migration : les tables venaient d'un
 * `synchronize` desormais reserve aux tests. Cette migration est donc la
 * premiere, et elle doit s'appliquer a une base existante — d'ou les
 * `IF NOT EXISTS` et le `DROP NOT NULL` plutot qu'un `CREATE TABLE` complet.
 *
 * Aucune colonne n'est supprimee : `subject`, `level` et `sector` sortent du
 * flow mais portent encore des donnees (arbitrage, point 2).
 */
export class FlowDemandeProfesseur1754960000000 implements MigrationInterface {
  name = 'FlowDemandeProfesseur1754960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Demande : `description` devient le seul champ de saisie ──────────────
    await queryRunner.query(`ALTER TABLE "teacher_requests" ADD COLUMN IF NOT EXISTS "description" text`);
    await queryRunner.query(`ALTER TABLE "teacher_requests" ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMP`);
    // `subject` etait NOT NULL : il ne l'est plus, aucun ecran ne le demande.
    await queryRunner.query(`ALTER TABLE "teacher_requests" ALTER COLUMN "subject" DROP NOT NULL`);
    // Les demandes existantes n'ont pas de description : on reprend leur texte
    // libre plutot que de laisser un ecran vide au RP.
    await queryRunner.query(`
      UPDATE "teacher_requests"
      SET "description" = COALESCE(NULLIF("message", ''), "subject")
      WHERE "description" IS NULL
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_teacher_requests_status" ON "teacher_requests" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_teacher_requests_student_id" ON "teacher_requests" ("student_id")`,
    );

    // ── Proposition : texte du RP + trois champs indicatifs optionnels ───────
    await queryRunner.query(`ALTER TABLE "teacher_proposals" ADD COLUMN IF NOT EXISTS "message" text`);
    await queryRunner.query(`ALTER TABLE "teacher_proposals" ADD COLUMN IF NOT EXISTS "compensation_note" text`);
    await queryRunner.query(`ALTER TABLE "teacher_proposals" ADD COLUMN IF NOT EXISTS "response_deadline" date`);
    await queryRunner.query(`ALTER TABLE "teacher_proposals" ADD COLUMN IF NOT EXISTS "responded_at" TIMESTAMP`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_teacher_proposals_request_id" ON "teacher_proposals" ("request_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_teacher_proposals_teacher_id" ON "teacher_proposals" ("teacher_id")`,
    );

    // ── Outbox des evenements metier ────────────────────────────────────────
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

    // ── Idempotence des commandes ───────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "idempotency_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "idempotency_key" character varying NOT NULL,
        "endpoint" character varying NOT NULL,
        "user_id" character varying NOT NULL,
        "response_body" jsonb NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_idempotency_records" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_idempotency_key_endpoint_user" UNIQUE ("idempotency_key", "endpoint", "user_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "idempotency_records"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "domain_events"`);
    await queryRunner.query(`ALTER TABLE "teacher_proposals" DROP COLUMN IF EXISTS "responded_at"`);
    await queryRunner.query(`ALTER TABLE "teacher_proposals" DROP COLUMN IF EXISTS "response_deadline"`);
    await queryRunner.query(`ALTER TABLE "teacher_proposals" DROP COLUMN IF EXISTS "compensation_note"`);
    await queryRunner.query(`ALTER TABLE "teacher_proposals" DROP COLUMN IF EXISTS "message"`);
    await queryRunner.query(`ALTER TABLE "teacher_requests" DROP COLUMN IF EXISTS "closed_at"`);
    await queryRunner.query(`ALTER TABLE "teacher_requests" DROP COLUMN IF EXISTS "description"`);
  }
}
