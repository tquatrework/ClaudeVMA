import {
  DOMAIN_EVENTS_STREAM_KEY,
  EventPublisherService,
} from '../../../src/events/event-publisher.service';

/**
 * Construit directement (pas via TestingModule) pour accéder à l'état privé
 * (`redis`, `flush()`) sans exposer d'API publique juste pour les tests —
 * même compromis que d'autres suites de ce service face à des dépendances
 * externes (Redis) qui n'existent pas en environnement de test.
 */
describe('EventPublisherService', () => {
  let config: any;
  let outboxRepo: any;
  let service: EventPublisherService;

  beforeEach(() => {
    config = { get: jest.fn().mockReturnValue(undefined) };
    outboxRepo = { find: jest.fn().mockResolvedValue([]), save: jest.fn().mockResolvedValue(undefined) };
    service = new EventPublisherService(config, outboxRepo);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  /**
   * Bug réel corrigé le 2026-09-04 côté `communication-service` (rapport de
   * session) : une indisponibilité Redis bloquait indéfiniment le démarrage.
   * Ici, l'ABSENCE de REDIS_URL — cas des environnements de test — ne doit
   * jamais empêcher le service de démarrer.
   */
  it("ne se connecte pas à Redis si REDIS_URL est absent, et ne bloque jamais le démarrage", () => {
    expect(() => service.onModuleInit()).not.toThrow();
    expect((service as any).redis).toBeNull();
  });

  it('publie chaque ligne non publiée par XADD puis marque publishedAt', async () => {
    const fakeRedis = { xadd: jest.fn().mockResolvedValue('1-0'), quit: jest.fn().mockResolvedValue(undefined) };
    (service as any).redis = fakeRedis;
    const row = {
      id: 'evt-1',
      type: 'TeacherLinkedToStudent',
      payload: { teacherId: 't1', studentId: 's1' },
      occurredAt: new Date('2026-09-04T00:00:00.000Z'),
      publishedAt: null as Date | null,
    };
    outboxRepo.find.mockResolvedValue([row]);

    await (service as any).flush();

    expect(fakeRedis.xadd).toHaveBeenCalledWith(
      DOMAIN_EVENTS_STREAM_KEY,
      '*',
      'eventId',
      'evt-1',
      'type',
      'TeacherLinkedToStudent',
      'occurredAt',
      '2026-09-04T00:00:00.000Z',
      'payload',
      JSON.stringify(row.payload),
    );
    expect(row.publishedAt).toBeInstanceOf(Date);
    expect(outboxRepo.save).toHaveBeenCalledWith(row);
  });

  /**
   * S'arrête au premier échec du cycle (voir le commentaire de `flush()`) :
   * un XADD en échec signale généralement Redis indisponible, pas un
   * problème propre à cette ligne — elle reste non publiée pour le prochain
   * balayage plutôt que d'être marquée à tort.
   */
  it('arrête le balayage au premier échec XADD, sans marquer la ligne publiée', async () => {
    const fakeRedis = {
      xadd: jest.fn().mockRejectedValue(new Error('redis down')),
      quit: jest.fn().mockResolvedValue(undefined),
    };
    (service as any).redis = fakeRedis;
    const row = {
      id: 'evt-1',
      type: 'TeacherLinkedToStudent',
      payload: {},
      occurredAt: new Date(),
      publishedAt: null as Date | null,
    };
    outboxRepo.find.mockResolvedValue([row]);

    await (service as any).flush();

    expect(row.publishedAt).toBeNull();
    expect(outboxRepo.save).not.toHaveBeenCalled();
  });

  it('onModuleDestroy ferme la connexion Redis quand une connexion existe', async () => {
    const fakeRedis = { quit: jest.fn().mockResolvedValue(undefined) };
    (service as any).redis = fakeRedis;

    await service.onModuleDestroy();

    expect(fakeRedis.quit).toHaveBeenCalled();
  });
});
