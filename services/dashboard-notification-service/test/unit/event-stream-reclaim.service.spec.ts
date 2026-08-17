import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventStreamReclaimService } from '../../src/events/event-stream-reclaim.service';
import { EventProcessorService } from '../../src/events/event-processor.service';
import { EVENT_STREAM_CONSUMER_GROUP, EVENT_STREAM_KEY } from '../../src/events/redis-stream.constants';

const mockRedisInstance = {
  xautoclaim: jest.fn(),
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

describe('EventStreamReclaimService', () => {
  let service: EventStreamReclaimService;
  let processor: ReturnType<typeof mockEventProcessorService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EventStreamReclaimService,
        { provide: ConfigService, useFactory: mockConfigService },
        { provide: EventProcessorService, useFactory: mockEventProcessorService },
      ],
    }).compile();

    service = moduleRef.get<EventStreamReclaimService>(EventStreamReclaimService);
    processor = moduleRef.get(EventProcessorService);

    service.onModuleInit();
  });

  it('does nothing before the client is initialized', async () => {
    (service as any).client = undefined;

    await service.reclaimStuckEntries();

    expect(mockRedisInstance.xautoclaim).not.toHaveBeenCalled();
  });

  it('claims stuck entries, processes them and acknowledges each one', async () => {
    mockRedisInstance.xautoclaim.mockResolvedValue([
      '0-0',
      [['1234-0', ['eventId', 'evt-1', 'eventName', 'TeacherAssigned', 'payload', '{}']]],
    ]);
    processor.process.mockResolvedValue(undefined);

    await service.reclaimStuckEntries();

    expect(mockRedisInstance.xautoclaim).toHaveBeenCalledWith(
      EVENT_STREAM_KEY,
      EVENT_STREAM_CONSUMER_GROUP,
      expect.stringContaining(`${EVENT_STREAM_CONSUMER_GROUP}-reclaim-`),
      60_000,
      '0-0',
      'COUNT',
      10,
    );
    expect(processor.process).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'evt-1', eventName: 'TeacherAssigned' }));
    expect(mockRedisInstance.xack).toHaveBeenCalledWith(EVENT_STREAM_KEY, EVENT_STREAM_CONSUMER_GROUP, '1234-0');
  });

  it('skips tombstoned entries (deleted from the stream since being claimed)', async () => {
    mockRedisInstance.xautoclaim.mockResolvedValue(['0-0', [['1234-1', []]]]);

    await service.reclaimStuckEntries();

    expect(processor.process).not.toHaveBeenCalled();
    expect(mockRedisInstance.xack).not.toHaveBeenCalled();
  });

  it('leaves an entry unacknowledged when reprocessing still fails, without throwing', async () => {
    mockRedisInstance.xautoclaim.mockResolvedValue([
      '0-0',
      [['1234-2', ['eventId', 'evt-2', 'eventName', 'TeacherAssigned', 'payload', '{}']]],
    ]);
    processor.process.mockRejectedValue(new Error('still unreachable'));

    await expect(service.reclaimStuckEntries()).resolves.toBeUndefined();
    expect(mockRedisInstance.xack).not.toHaveBeenCalled();
  });

  it('does not start a second pass while one is already running', async () => {
    (service as any).running = true;

    await service.reclaimStuckEntries();

    expect(mockRedisInstance.xautoclaim).not.toHaveBeenCalled();
  });

  it('disconnects the client on module destroy', async () => {
    await service.onModuleDestroy();

    expect(mockRedisInstance.disconnect).toHaveBeenCalled();
  });
});
