import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventStreamConsumerService } from '../../src/events/event-stream-consumer.service';
import { EventProcessorService } from '../../src/events/event-processor.service';
import { EVENT_STREAM_CONSUMER_GROUP, EVENT_STREAM_KEY } from '../../src/events/redis-stream.constants';

const mockRedisInstance = {
  xgroup: jest.fn(),
  xreadgroup: jest.fn(),
  xack: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
};

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockRedisInstance),
}));

const mockConfigService = () => ({
  getOrThrow: jest.fn((key: string) => {
    if (key === 'REDIS_URL') return 'redis://localhost:6379';
    throw new Error(`Unexpected config key requested in test: ${key}`);
  }),
});

const mockEventProcessorService = () => ({ process: jest.fn() });

describe('EventStreamConsumerService', () => {
  let service: EventStreamConsumerService;
  let processor: ReturnType<typeof mockEventProcessorService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EventStreamConsumerService,
        { provide: ConfigService, useFactory: mockConfigService },
        { provide: EventProcessorService, useFactory: mockEventProcessorService },
      ],
    }).compile();

    service = moduleRef.get<EventStreamConsumerService>(EventStreamConsumerService);
    processor = moduleRef.get(EventProcessorService);
  });

  describe('ensureConsumerGroup (private, exercised via onModuleInit)', () => {
    it('creates the consumer group with MKSTREAM, starting from the beginning of the stream', async () => {
      mockRedisInstance.xgroup.mockResolvedValue('OK');
      mockRedisInstance.xreadgroup.mockResolvedValue(null); // keep the loop idle

      await service.onModuleInit();

      expect(mockRedisInstance.xgroup).toHaveBeenCalledWith('CREATE', EVENT_STREAM_KEY, EVENT_STREAM_CONSUMER_GROUP, '0', 'MKSTREAM');

      await service.onModuleDestroy();
    });

    it('treats BUSYGROUP as an idempotent no-op instead of failing startup', async () => {
      mockRedisInstance.xgroup.mockRejectedValue(new Error('BUSYGROUP Consumer Group name already exists'));
      mockRedisInstance.xreadgroup.mockResolvedValue(null);

      await expect(service.onModuleInit()).resolves.toBeUndefined();

      await service.onModuleDestroy();
    });

    it('propagates any other error from group creation', async () => {
      const privateService = service as unknown as { ensureConsumerGroup(): Promise<void> };
      mockRedisInstance.xgroup.mockRejectedValue(new Error('NOAUTH Authentication required'));
      // Set the fields onModuleInit would have set, without starting the loop.
      (service as any).client = mockRedisInstance;

      await expect(privateService.ensureConsumerGroup()).rejects.toThrow('NOAUTH');
    });
  });

  describe('handleEntries (private)', () => {
    beforeEach(() => {
      (service as any).client = mockRedisInstance;
    });

    it('processes each entry then acknowledges it', async () => {
      processor.process.mockResolvedValue(undefined);
      const response = [
        [
          EVENT_STREAM_KEY,
          [['1234-0', ['eventId', 'evt-1', 'eventName', 'TeacherRequestCreated', 'payload', '{}']]],
        ],
      ];

      await (service as any).handleEntries(response);

      expect(processor.process).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'evt-1', eventName: 'TeacherRequestCreated', payload: '{}' }),
      );
      expect(mockRedisInstance.xack).toHaveBeenCalledWith(EVENT_STREAM_KEY, EVENT_STREAM_CONSUMER_GROUP, '1234-0');
    });

    it('leaves the entry unacknowledged when processing fails', async () => {
      processor.process.mockRejectedValue(new Error('profile-service unreachable'));
      const response = [
        [EVENT_STREAM_KEY, [['1234-1', ['eventId', 'evt-2', 'eventName', 'TeacherAssigned', 'payload', '{}']]]],
      ];

      await (service as any).handleEntries(response);

      expect(mockRedisInstance.xack).not.toHaveBeenCalled();
    });

    it('keeps processing remaining entries after one fails', async () => {
      processor.process.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined);
      const response = [
        [
          EVENT_STREAM_KEY,
          [
            ['1234-2', ['eventId', 'evt-3', 'eventName', 'A', 'payload', '{}']],
            ['1234-3', ['eventId', 'evt-4', 'eventName', 'B', 'payload', '{}']],
          ],
        ],
      ];

      await (service as any).handleEntries(response);

      expect(processor.process).toHaveBeenCalledTimes(2);
      expect(mockRedisInstance.xack).toHaveBeenCalledTimes(1);
      expect(mockRedisInstance.xack).toHaveBeenCalledWith(EVENT_STREAM_KEY, EVENT_STREAM_CONSUMER_GROUP, '1234-3');
    });
  });

  describe('onModuleDestroy', () => {
    it('disconnects the client to unblock a pending BLOCK read', async () => {
      mockRedisInstance.xgroup.mockResolvedValue('OK');
      mockRedisInstance.xreadgroup.mockResolvedValue(null);
      await service.onModuleInit();

      await service.onModuleDestroy();

      expect(mockRedisInstance.disconnect).toHaveBeenCalled();
    });
  });
});
