/**
 * Unit tests — EventPublisherService
 *
 * Couvre : REDIS_URL absent (no-op déclaré, publish() lève), XADD appelé
 * avec les bons champs quand REDIS_URL est configuré.
 */

import { ConfigService } from '@nestjs/config';

const xaddMock = jest.fn().mockResolvedValue('1-0');
const onMock = jest.fn();
const quitMock = jest.fn().mockResolvedValue(undefined);

jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      xadd: xaddMock,
      on: onMock,
      quit: quitMock,
    })),
  };
});

import { EventPublisherService } from '../../../src/evaluation-attempts/events/event-publisher.service';

function buildConfigService(values: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('EventPublisherService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lève une erreur si REDIS_URL n\'est pas configuré', async () => {
    const service = new EventPublisherService(buildConfigService({}));

    await expect(
      service.publish({ id: 'evt-1', eventType: 'Test', payload: { a: 1 } }),
    ).rejects.toThrow('Redis non configuré');
  });

  it('publie un événement par XADD avec les bons champs', async () => {
    const service = new EventPublisherService(
      buildConfigService({ REDIS_URL: 'redis://:secret@redis:6379' }),
    );

    await service.publish({
      id: 'evt-1',
      eventType: 'EvaluationCorrectionRequested',
      payload: { studentId: 'el-1' },
      correlationId: 'corr-1',
    });

    expect(xaddMock).toHaveBeenCalledWith(
      'visiomath:events',
      '*',
      'eventId',
      'evt-1',
      'eventType',
      'EvaluationCorrectionRequested',
      'payload',
      JSON.stringify({ studentId: 'el-1' }),
      'correlationId',
      'corr-1',
    );
  });

  it('utilise une chaîne vide si correlationId est absent', async () => {
    const service = new EventPublisherService(
      buildConfigService({ REDIS_URL: 'redis://:secret@redis:6379' }),
    );

    await service.publish({ id: 'evt-2', eventType: 'Test', payload: {} });

    expect(xaddMock).toHaveBeenCalledWith(
      'visiomath:events',
      '*',
      'eventId',
      'evt-2',
      'eventType',
      'Test',
      'payload',
      '{}',
      'correlationId',
      '',
    );
  });

  it('ferme la connexion Redis à onModuleDestroy', async () => {
    const service = new EventPublisherService(
      buildConfigService({ REDIS_URL: 'redis://:secret@redis:6379' }),
    );

    await service.onModuleDestroy();

    expect(quitMock).toHaveBeenCalled();
  });

  it('ne fait rien à onModuleDestroy si Redis n\'était pas configuré', async () => {
    const service = new EventPublisherService(buildConfigService({}));

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    expect(quitMock).not.toHaveBeenCalled();
  });
});
