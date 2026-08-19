import { ConfigService } from '@nestjs/config';

import { EventPublisher, EVENT_STREAM_KEY } from '../../../src/events/event-publisher.service';

const pendingEvent = {
  id: 'event-1',
  eventName: 'ActivityScheduled',
  aggregateType: 'ScheduledActivity',
  aggregateId: 'act-1',
  payload: { activityId: 'act-1' },
  correlationId: 'corr-1',
  occurredAt: new Date('2026-08-18T09:00:00.000Z'),
  publishedAt: null,
  publishAttempts: 0,
};

describe('EventPublisher', () => {
  let repository: { find: jest.Mock; update: jest.Mock };

  const buildPublisher = (redisUrl?: string): EventPublisher =>
    new EventPublisher(repository as never, { get: () => redisUrl } as unknown as ConfigService);

  beforeEach(() => {
    repository = {
      find: jest.fn().mockResolvedValue([pendingEvent]),
      update: jest.fn().mockResolvedValue(undefined),
    };
  });

  it("sans bus configure, rien n'est publie et rien n'est perdu", async () => {
    const publisher = buildPublisher(undefined);
    publisher.onModuleInit();

    await expect(publisher.flushPendingEvents()).resolves.toBe(0);
    expect(repository.find).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("publie sur le meme flux Redis 'visiomath:events' que teacher-request-service", async () => {
    const publisher = buildPublisher('redis://localhost:6379');
    const xaddMock = jest.fn().mockResolvedValue('1-0');
    (publisher as unknown as { redisClient: unknown }).redisClient = { xadd: xaddMock };

    const publishedCount = await publisher.flushPendingEvents();

    expect(publishedCount).toBe(1);
    expect(xaddMock).toHaveBeenCalledWith(
      EVENT_STREAM_KEY,
      '*',
      'eventId',
      'event-1',
      'eventName',
      'ActivityScheduled',
      'aggregateType',
      'ScheduledActivity',
      'aggregateId',
      'act-1',
      'correlationId',
      'corr-1',
      'occurredAt',
      '2026-08-18T09:00:00.000Z',
      'payload',
      JSON.stringify({ activityId: 'act-1' }),
    );
    expect(repository.update).toHaveBeenCalledWith('event-1', { publishedAt: expect.any(Date) });
  });

  it("un echec de publication laisse l'evenement en attente et compte la tentative", async () => {
    const publisher = buildPublisher('redis://localhost:6379');
    (publisher as unknown as { redisClient: unknown }).redisClient = {
      xadd: jest.fn().mockRejectedValue(new Error('bus indisponible')),
    };

    await expect(publisher.flushPendingEvents()).resolves.toBe(0);
    expect(repository.update).toHaveBeenCalledWith('event-1', { publishAttempts: 1 });
  });

  it('ne lit que les evenements non publies, dans l\'ordre chronologique', async () => {
    const publisher = buildPublisher('redis://localhost:6379');
    (publisher as unknown as { redisClient: unknown }).redisClient = {
      xadd: jest.fn().mockResolvedValue('1-0'),
    };

    await publisher.flushPendingEvents();

    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({ order: { occurredAt: 'ASC' } }),
    );
  });

  it('deux remises simultanees ne se chevauchent pas', async () => {
    const publisher = buildPublisher('redis://localhost:6379');
    (publisher as unknown as { redisClient: unknown }).redisClient = {
      xadd: jest.fn().mockResolvedValue('1-0'),
    };
    (publisher as unknown as { isFlushing: boolean }).isFlushing = true;

    await expect(publisher.flushPendingEvents()).resolves.toBe(0);
    expect(repository.find).not.toHaveBeenCalled();
  });
});
