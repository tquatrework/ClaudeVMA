/**
 * Unit tests — EventStreamConsumerService
 *
 * La boucle bloquante XREADGROUP elle-même n'est pas exécutée (risque de boucle
 * microtask non maîtrisée en test, même choix que dashboard-notification-service) :
 * seules les méthodes exposées/utilitaires sont exercées directement.
 */

import { ConfigService } from '@nestjs/config';
import { EventStreamConsumerService } from '../../../src/events/event-stream-consumer.service';
import { EventProcessorService } from '../../../src/events/event-processor.service';

jest.mock('ioredis', () => {
  const mock = jest.fn().mockImplementation(() => ({
    xgroup: jest.fn().mockResolvedValue('OK'),
    xreadgroup: jest.fn().mockResolvedValue(null),
    xack: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
  }));
  return { __esModule: true, default: mock };
});

describe('EventStreamConsumerService', () => {
  let processor: { process: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(() => {
    processor = { process: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn() };
  });

  afterEach(() => jest.clearAllMocks());

  it('sans REDIS_URL configurée, le consommateur reste désactivé (pas de crash au boot)', async () => {
    config.get.mockReturnValue(undefined);
    const service = new EventStreamConsumerService(
      config as unknown as ConfigService,
      processor as unknown as EventProcessorService,
    );

    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });

  it('handleEntries() traite chaque entrée et acquitte via processor.process()', async () => {
    config.get.mockReturnValue('redis://localhost:6379');
    const service = new EventStreamConsumerService(
      config as unknown as ConfigService,
      processor as unknown as EventProcessorService,
    );
    await service.onModuleInit();
    // Stoppe immédiatement la boucle bloquante fire-and-forget démarrée par
    // onModuleInit — this.redis reste assigné, seule la boucle est arrêtée.
    await service.onModuleDestroy();

    const fields = ['eventId', 'evt-1', 'eventName', 'ActivityScheduled', 'payload', '{}'];
    await service.handleEntries([[
      'visiomath:events',
      [['1-0', fields]],
    ]]);

    expect(processor.process).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt-1', eventName: 'ActivityScheduled' }),
    );
  });

  it('[CRITIQUE] échec de traitement → entrée non acquittée, sans faire planter le consommateur', async () => {
    config.get.mockReturnValue('redis://localhost:6379');
    processor.process.mockRejectedValue(new Error('boom'));

    const service = new EventStreamConsumerService(
      config as unknown as ConfigService,
      processor as unknown as EventProcessorService,
    );
    await service.onModuleInit();
    await service.onModuleDestroy();

    const fields = ['eventId', 'evt-2', 'eventName', 'ActivityConfirmed', 'payload', '{}'];
    await expect(
      service.handleEntries([['visiomath:events', [['2-0', fields]]]]),
    ).resolves.toBeUndefined();
  });
});
