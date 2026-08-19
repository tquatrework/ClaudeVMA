import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chantier calendrier-visio-livekit, point 4 (2026-08-19).
 *
 * This is the FIRST migration this service has ever had — schema was
 * previously pushed entirely by `synchronize` (disabled by default in
 * production, `NODE_ENV=production` in docker-compose.yml). Two things are
 * bundled here because both were missing from production before this change:
 *
 *   1. `video_recordings` / `recording_comments` / `course_summaries` — these
 *      entities and their DTOs/tests already existed in the codebase (VID-AC-001,
 *      VID-AC-002) but were never registered in `AppModule`'s TypeOrmModule nor
 *      wired into the controller/service, so `synchronize` never created them
 *      even in development. Completed as part of this session because the test
 *      suite (already written, already documented in docs/routes.md) could not
 *      pass otherwise.
 *   2. `video_rooms.activity_id` (new), `video_rooms.calendar_session_id`
 *      (now nullable), `activity_projections`, `processed_events` — the actual
 *      LiveKit + ActivityConfirmed subject of this chantier.
 *
 * Run manually (`npm run migration:run` inside the container) — this service
 * has no automated migration step in its Dockerfile, same gap already present
 * on calendar-service and teacher-request-service.
 */
export class AddLiveKitRoomsRecordingsAndActivityEvents1787140000000
  implements MigrationInterface
{
  name = 'AddLiveKitRoomsRecordingsAndActivityEvents1787140000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ─── video_rooms: nullable calendar_session_id, new activity_id ──────────
    await queryRunner.query(
      `ALTER TABLE "video_rooms" ALTER COLUMN "calendar_session_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "video_rooms" ADD COLUMN IF NOT EXISTS "activity_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "video_rooms" ADD CONSTRAINT "UQ_video_rooms_activity_id" UNIQUE ("activity_id")`,
    );

    // ─── video_recordings (VID-AC-001) ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "video_recordings" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "room_id" uuid NOT NULL,
        "declared_by" character varying NOT NULL,
        "download_url" text,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_video_recordings_room" FOREIGN KEY ("room_id")
          REFERENCES "video_rooms"("id") ON DELETE CASCADE
      )
    `);

    // ─── recording_comments (VID-FB-001) ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recording_comments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "recording_id" uuid NOT NULL,
        "user_id" character varying NOT NULL,
        "timestamp_seconds" integer NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_recording_comments_recording" FOREIGN KEY ("recording_id")
          REFERENCES "video_recordings"("id") ON DELETE CASCADE
      )
    `);

    // ─── course_summaries (VID-AC-002) ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_summaries" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "room_id" uuid NOT NULL,
        "author_id" character varying NOT NULL,
        "content" text NOT NULL,
        "is_permanent" boolean NOT NULL DEFAULT true,
        "published_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_course_summaries_room" FOREIGN KEY ("room_id")
          REFERENCES "video_rooms"("id") ON DELETE CASCADE
      )
    `);

    // ─── activity_projections (ActivityScheduled read-model) ─────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "activity_projections" (
        "activity_id" uuid PRIMARY KEY,
        "type" character varying NOT NULL,
        "creator_id" uuid NOT NULL,
        "participant_ids" jsonb NOT NULL,
        "start_time" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // ─── processed_events (Redis stream consumer dedup ledger) ───────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "processed_events" (
        "event_id" character varying PRIMARY KEY,
        "event_name" character varying NOT NULL,
        "processed_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "processed_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_projections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "course_summaries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "recording_comments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "video_recordings"`);
    await queryRunner.query(
      `ALTER TABLE "video_rooms" DROP CONSTRAINT IF EXISTS "UQ_video_rooms_activity_id"`,
    );
    await queryRunner.query(`ALTER TABLE "video_rooms" DROP COLUMN IF EXISTS "activity_id"`);
    await queryRunner.query(
      `ALTER TABLE "video_rooms" ALTER COLUMN "calendar_session_id" SET NOT NULL`,
    );
  }
}
