/**
 * Unit tests — EventStreamReclaimService
 * Passe périodique XAUTOCLAIM (méthode publique exercée directement, pas via
 * @Interval réel).
 */

import { ConfigService } from '@nestjs/config';
import { EventStreamReclaimService } from '../../../src/events/event-stream-reclaim.service';
import { EventProcessorService } from '../../../src/events/event-processor.service';

const mockRedisInstance = {
  xautoclaim: jest.fn(),
  xack: jest.fn().mockResolvedValue(1),
  quit: jest.fn().mockResolvedValue('OK'),
};

jest.mock('ioredis', () => {
  const mock = jest.fn().mockImplementation(() => mockRedisInstance);
  return { __esModule: true, default: mock };
});

describe('EventStreamReclaimService', () => {
  let processor: { process: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(() => {
    processor = { process: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn() };
    jest.clearAllMocks();
  });

  it('sans REDIS_URL, reclaimStuckEntries() ne fait rien (pas de crash)', async () => {
    config.get.mockReturnValue(undefined);
    const service = new EventStreamReclaimService(
      config as unknown as ConfigService,
      processor as unknown as EventProcessorService,
    );
    service.onModuleInit();

    await expect(service.reclaimStuckEntries()).resolves.toBeUndefined();
    expect(mockRedisInstance.xautoclaim).not.toHaveBeenCalled();
  });

  it('réclame les entrées non acquittées et les rejoue via processor.process()', async () => {
    config.get.mockReturnValue('redis://localhost:6379');
    const fields = ['eventId', 'evt-reclaimed', 'eventName', 'ActivityConfirmed', 'payload', '{}'];
    mockRedisInstance.xautoclaim.mockResolvedValue(['0-0', [['3-0', fields]], []]);

    const service = new EventStreamReclaimService(
      config as unknown as ConfigService,
      processor as unknown as EventProcessorService,
    );
    service.onModuleInit();

    await service.reclaimStuckEntries();

    expect(processor.process).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt-reclaimed', eventName: 'ActivityConfirmed' }),
    );
    expect(mockRedisInstance.xack).toHaveBeenCalled();
  });

  it('[CRITIQUE] échec de retraitement → pas de crash, entrée laissée pour un prochain passage', async () => {
    config.get.mockReturnValue('redis://localhost:6379');
    const fields = ['eventId', 'evt-fail', 'eventName', 'ActivityConfirmed', 'payload', '{}'];
    mockRedisInstance.xautoclaim.mockResolvedValue(['0-0', [['4-0', fields]], []]);
    processor.process.mockRejectedValue(new Error('boom'));

    const service = new EventStreamReclaimService(
      config as unknown as ConfigService,
      processor as unknown as EventProcessorService,
    );
    service.onModuleInit();

    await expect(service.reclaimStuckEntries()).resolves.toBeUndefined();
    expect(mockRedisInstance.xack).not.toHaveBeenCalled();
  });
});
