/**
 * Unit tests — EventsService
 *
 * Couvre :
 *   - emit() écrit toujours l'outbox avant de publier
 *   - emit() marque publishedAt en cas de succès de publication immédiate
 *   - emit() ne lève jamais si la publication immédiate échoue (laissée au
 *     cycle de rattrapage) — l'action métier appelante ne doit pas échouer
 *   - le cycle de rattrapage republie les événements non publiés et
 *     s'arrête au premier échec du lot
 */

import { EventsService } from '../../../src/evaluation-attempts/events/events.service';
import { DomainEvent } from '../../../src/evaluation-attempts/entities/domain-event.entity';

function buildMockRepo() {
  return {
    create: jest.fn((data) => data),
    save: jest.fn(),
    find: jest.fn(),
  };
}

describe('EventsService', () => {
  let repo: ReturnType<typeof buildMockRepo>;
  let publisher: { publish: jest.Mock };
  let service: EventsService;

  beforeEach(() => {
    repo = buildMockRepo();
    publisher = { publish: jest.fn() };
    service = new EventsService(repo as unknown as never, publisher as unknown as never);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe('emit', () => {
    it('écrit l\'outbox puis publie et marque publishedAt en cas de succès', async () => {
      const saved = { id: 'evt-1', eventType: 'Test', payload: { a: 1 }, correlationId: 'corr-1', publishedAt: null };
      repo.save.mockResolvedValueOnce(saved).mockImplementationOnce(async (e) => e);
      publisher.publish.mockResolvedValue(undefined);

      await service.emit('Test', { a: 1 }, 'corr-1');

      expect(repo.create).toHaveBeenCalledWith({
        eventType: 'Test',
        payload: { a: 1 },
        correlationId: 'corr-1',
        publishedAt: null,
      });
      expect(publisher.publish).toHaveBeenCalledWith({
        id: 'evt-1',
        eventType: 'Test',
        payload: { a: 1 },
        correlationId: 'corr-1',
      });
      // Second save() call marks publishedAt
      const secondSaveArg = repo.save.mock.calls[1][0];
      expect(secondSaveArg.publishedAt).toBeInstanceOf(Date);
    });

    it('n\'échoue jamais si la publication immédiate échoue', async () => {
      const saved = { id: 'evt-2', eventType: 'Test', payload: {}, correlationId: null, publishedAt: null };
      repo.save.mockResolvedValueOnce(saved);
      publisher.publish.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.emit('Test', {})).resolves.toBeUndefined();
      // Only the initial outbox write happened, no second save (publishedAt not marked)
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('correlationId absent est stocké comme null', async () => {
      repo.save.mockResolvedValueOnce({ id: 'evt-3', eventType: 'Test', payload: {}, correlationId: null, publishedAt: null });
      publisher.publish.mockResolvedValue(undefined);

      await service.emit('Test', {});

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: null }),
      );
    });
  });

  describe('cycle de rattrapage (publishUnpublished, via onModuleInit)', () => {
    it('republie les événements non publiés et marque publishedAt', async () => {
      jest.useFakeTimers();
      const unpublished: Partial<DomainEvent>[] = [
        { id: 'evt-a', eventType: 'A', payload: {}, correlationId: null, publishedAt: null },
        { id: 'evt-b', eventType: 'B', payload: {}, correlationId: null, publishedAt: null },
      ];
      repo.find.mockResolvedValue(unpublished);
      repo.save.mockImplementation(async (e) => e);
      publisher.publish.mockResolvedValue(undefined);

      service.onModuleInit();
      await jest.advanceTimersByTimeAsync(15_000);

      expect(repo.find).toHaveBeenCalled();
      expect(publisher.publish).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });

    it('s\'arrête au premier échec du lot sans lever', async () => {
      jest.useFakeTimers();
      const unpublished: Partial<DomainEvent>[] = [
        { id: 'evt-a', eventType: 'A', payload: {}, correlationId: null, publishedAt: null },
        { id: 'evt-b', eventType: 'B', payload: {}, correlationId: null, publishedAt: null },
      ];
      repo.find.mockResolvedValue(unpublished);
      publisher.publish.mockRejectedValue(new Error('ECONNREFUSED'));

      service.onModuleInit();
      await jest.advanceTimersByTimeAsync(15_000);

      expect(publisher.publish).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });
  });
});
