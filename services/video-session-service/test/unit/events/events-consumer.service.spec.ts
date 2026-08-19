import { ConfigService } from '@nestjs/config';
import { EventsConsumerService } from '../../../src/events/events-consumer.service';
import { VideoSessionService } from '../../../src/video-session/video-session.service';

/**
 * Unit tests for the `visiomath:events` Redis stream consumer (chantier
 * calendrier-visio-livekit, point 4, 2026-08-19). No test here opens a real
 * Redis connection — the wire-level `xreadgroup`/`xack`/`xgroup` calls are
 * exercised via a hand-built mock client injected directly into the private
 * `redis` field, exactly as the real client would be used, without depending
 * on ioredis actually connecting anywhere.
 */

function buildConfigService(values: Record<string, string> = {}): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

function buildProjectionRepo() {
  return {
    findOne: jest.fn(),
    create: jest.fn((data: Record<string, unknown>) => ({ ...data })),
    save: jest.fn(async (entity: Record<string, unknown>) => entity),
  };
}

function buildProcessedRepo() {
  return {
    insert: jest.fn(),
  };
}

function buildVideoSessionService() {
  return {
    createForActivity: jest.fn(),
  } as unknown as VideoSessionService;
}

/** Encodes a domain event envelope exactly as observed on the real Redis stream. */
function encodeFields(
  eventId: string,
  eventName: string,
  payload: Record<string, unknown>,
): string[] {
  return [
    'eventId', eventId,
    'eventName', eventName,
    'aggregateType', 'ScheduledActivity',
    'aggregateId', (payload.activityId as string) ?? '',
    'correlationId', '',
    'occurredAt', new Date().toISOString(),
    'payload', JSON.stringify(payload),
  ];
}

describe('EventsConsumerService', () => {
  let projectionRepo: ReturnType<typeof buildProjectionRepo>;
  let processedRepo: ReturnType<typeof buildProcessedRepo>;
  let videoSessionService: ReturnType<typeof buildVideoSessionService>;
  let service: EventsConsumerService;

  beforeEach(() => {
    projectionRepo = buildProjectionRepo();
    processedRepo = buildProcessedRepo();
    videoSessionService = buildVideoSessionService();

    service = new EventsConsumerService(
      buildConfigService({ REDIS_URL: 'redis://localhost:6379' }),
      projectionRepo as any,
      processedRepo as any,
      videoSessionService,
    );
  });

  // ── onModuleInit — REDIS_URL not configured ─────────────────────────────────

  describe('onModuleInit() — REDIS_URL not configured', () => {
    it('does not create a Redis client nor start the consumer loop', async () => {
      const unconfigured = new EventsConsumerService(
        buildConfigService({}),
        projectionRepo as any,
        processedRepo as any,
        videoSessionService,
      );

      await unconfigured.onModuleInit();

      expect((unconfigured as any).redis).toBeNull();
      expect((unconfigured as any).loopPromise).toBeNull();

      // Cleanup should be a no-op, not throw.
      await expect(unconfigured.onModuleDestroy()).resolves.toBeUndefined();
    });
  });

  // ── ActivityScheduled → projection ──────────────────────────────────────────

  describe('ActivityScheduled handling', () => {
    it('stores a new projection with type, creatorId, participantIds and startTime', async () => {
      projectionRepo.findOne.mockResolvedValue(null);

      const fields = encodeFields('event-1', 'ActivityScheduled', {
        type: 'cours',
        creatorId: 'teacher-1',
        startTime: '2026-09-10T14:00:00.000Z',
        activityId: 'activity-1',
        recipientId: 'student-1',
        participantIds: ['student-1'],
      });

      await (service as any).processEntry('1-0', fields);

      expect(processedRepo.insert).toHaveBeenCalledWith({
        eventId: 'event-1',
        eventName: 'ActivityScheduled',
      });
      expect(projectionRepo.save).toHaveBeenCalledTimes(1);
      const saved = projectionRepo.save.mock.calls[0][0];
      expect(saved.activityId).toBe('activity-1');
      expect(saved.type).toBe('cours');
      expect(saved.participantIds).toEqual(['student-1']);
    });

    it('ignores a duplicate delivery (eventId already processed)', async () => {
      processedRepo.insert.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));

      const fields = encodeFields('event-1', 'ActivityScheduled', {
        type: 'cours',
        creatorId: 'teacher-1',
        startTime: '2026-09-10T14:00:00.000Z',
        activityId: 'activity-1',
        participantIds: ['student-1'],
      });

      await (service as any).processEntry('1-0', fields);

      expect(projectionRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── ActivityConfirmed → automatic room creation (only for "cours") ─────────

  describe('ActivityConfirmed handling', () => {
    it('creates a room when the projected activity type is "cours"', async () => {
      projectionRepo.findOne.mockResolvedValue({
        activityId: 'activity-1',
        type: 'cours',
        creatorId: 'teacher-1',
        participantIds: ['student-1'],
        startTime: new Date(),
      });

      const fields = encodeFields('event-2', 'ActivityConfirmed', {
        activityId: 'activity-1',
        confirmedBy: 'student-1',
      });

      await (service as any).processEntry('2-0', fields);

      expect(videoSessionService.createForActivity).toHaveBeenCalledWith('activity-1');
    });

    it('does NOT create a room when the projected activity type is not "cours"', async () => {
      projectionRepo.findOne.mockResolvedValue({
        activityId: 'activity-2',
        type: 'reunion_pedagogique',
        creatorId: 'ap-1',
        participantIds: ['teacher-1'],
        startTime: new Date(),
      });

      const fields = encodeFields('event-3', 'ActivityConfirmed', {
        activityId: 'activity-2',
        confirmedBy: 'teacher-1',
      });

      await (service as any).processEntry('3-0', fields);

      expect(videoSessionService.createForActivity).not.toHaveBeenCalled();
    });

    it('does NOT create a room when no ActivityScheduled projection was ever observed', async () => {
      projectionRepo.findOne.mockResolvedValue(null);

      const fields = encodeFields('event-4', 'ActivityConfirmed', {
        activityId: 'activity-unknown',
        confirmedBy: 'student-1',
      });

      await (service as any).processEntry('4-0', fields);

      expect(videoSessionService.createForActivity).not.toHaveBeenCalled();
    });

    it('is idempotent: a duplicate ActivityConfirmed delivery does not create a second room', async () => {
      processedRepo.insert.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));

      const fields = encodeFields('event-2', 'ActivityConfirmed', {
        activityId: 'activity-1',
        confirmedBy: 'student-1',
      });

      await (service as any).processEntry('2-1', fields);

      expect(videoSessionService.createForActivity).not.toHaveBeenCalled();
    });
  });

  // ── Unrelated / unparseable events ──────────────────────────────────────────

  describe('other stream entries', () => {
    it('acknowledges and ignores event types this service does not react to', async () => {
      const fields = encodeFields('event-5', 'TeacherRequestCreated', { requestId: 'r-1' });

      await expect((service as any).processEntry('5-0', fields)).resolves.toBeUndefined();
      expect(videoSessionService.createForActivity).not.toHaveBeenCalled();
      expect(projectionRepo.save).not.toHaveBeenCalled();
    });

    it('acknowledges and skips an unparseable entry without throwing', async () => {
      const malformedFields = ['eventId', 'event-6', 'eventName', 'ActivityScheduled', 'payload', '{not-json'];

      await expect(
        (service as any).processEntry('6-0', malformedFields),
      ).resolves.toBeUndefined();
    });
  });

  // ── readAndProcessBatch — wire-level xreadgroup/xack ────────────────────────

  describe('readAndProcessBatch() — wire-level Redis interaction', () => {
    it('reads a batch via xreadgroup and acknowledges each entry via xack', async () => {
      const fields = encodeFields('event-7', 'ActivityConfirmed', {
        activityId: 'activity-7',
        confirmedBy: 'student-7',
      });
      projectionRepo.findOne.mockResolvedValue({
        activityId: 'activity-7',
        type: 'cours',
        creatorId: 'teacher-7',
        participantIds: ['student-7'],
        startTime: new Date(),
      });

      const mockRedis = {
        xreadgroup: jest.fn().mockResolvedValue([['visiomath:events', [['7-0', fields]]]]),
        xack: jest.fn().mockResolvedValue(1),
      };
      (service as any).redis = mockRedis;

      await (service as any).readAndProcessBatch();

      expect(mockRedis.xreadgroup).toHaveBeenCalledWith(
        'GROUP',
        'video-session-service',
        expect.any(String),
        'COUNT',
        10,
        'BLOCK',
        5000,
        'STREAMS',
        'visiomath:events',
        '>',
      );
      expect(mockRedis.xack).toHaveBeenCalledWith('visiomath:events', 'video-session-service', '7-0');
      expect(videoSessionService.createForActivity).toHaveBeenCalledWith('activity-7');
    });

    it('does nothing when xreadgroup returns null (BLOCK timeout)', async () => {
      const mockRedis = {
        xreadgroup: jest.fn().mockResolvedValue(null),
        xack: jest.fn(),
      };
      (service as any).redis = mockRedis;

      await (service as any).readAndProcessBatch();

      expect(mockRedis.xack).not.toHaveBeenCalled();
    });
  });
});
