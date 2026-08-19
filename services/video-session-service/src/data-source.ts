import 'dotenv/config';
import { DataSource } from 'typeorm';
import { VideoRoom } from './video-session/entities/video-room.entity';
import { VideoAccessToken } from './video-session/entities/video-access-token.entity';
import { AttendanceRecord } from './video-session/entities/attendance-record.entity';
import { VideoRecording } from './video-session/entities/video-recording.entity';
import { RecordingComment } from './video-session/entities/recording-comment.entity';
import { CourseSummary } from './video-session/entities/course-summary.entity';
import { ActivityProjection } from './events/entities/activity-projection.entity';
import { ProcessedEvent } from './events/entities/processed-event.entity';

/**
 * Standalone DataSource for the TypeORM CLI (`npm run migration:*`).
 * Mirrors the pattern already used by calendar-service and teacher-request-service.
 *
 * This service previously had no migration infrastructure at all — schema was
 * pushed by `synchronize` (disabled in production, `NODE_ENV=production` by
 * default in docker-compose.yml). Introduced here because the LiveKit chantier
 * (2026-08-19) adds real production columns/tables (nullable `calendarSessionId`,
 * new `activityId`, `activity_projections`, `processed_events`) that must exist
 * without relying on synchronize. See the session report: migrations still need
 * to be run manually (`npm run migration:run` inside the container), matching
 * the existing gap already present on calendar-service/teacher-request-service
 * (no Dockerfile step runs migrations automatically either) — not introduced by
 * this session, but now shared by this service too.
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    VideoRoom,
    VideoAccessToken,
    AttendanceRecord,
    VideoRecording,
    RecordingComment,
    CourseSummary,
    ActivityProjection,
    ProcessedEvent,
  ],
  migrations: ['dist/src/migrations/*.js'],
  synchronize: false,
});
