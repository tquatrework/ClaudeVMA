/**
 * E2E — EventPublisherService, boucle de publication de l'outbox transactionnel.
 *
 * Régression du 2026-09-05 : `where: { publishedAt: null as unknown as Date }` était
 * silencieusement ignoré par TypeORM (0.3.30) au moment de construire le WHERE — vérifié
 * empiriquement contre la pile réelle déployée (`pg_stat_activity` montrait
 * `SELECT ... FROM domain_events ORDER BY occurred_at ASC LIMIT 20`, sans aucune clause WHERE).
 * Conséquence : chaque tick de la boucle (toutes les 2s) republiait TOUTES les lignes de la
 * table, publiées ou non, indéfiniment — ~650+ republications observées sur les mêmes 8
 * eventIds en production (voir docs/services/communication-service.md). Corrigé en utilisant
 * l'opérateur `IsNull()` que TypeORM traduit réellement en `published_at IS NULL`.
 *
 * Le client Redis partagé est stubbé (overrideProvider) : ce harnais e2e ne fait tourner aucun
 * Redis réel (déjà noté dans docs/services/communication-service.md pour d'autres suites) — ce
 * test isole donc la requête outbox elle-même (le vrai bug) de la disponibilité de Redis.
 *
 * La boucle automatique (`setInterval`, démarrée par `onModuleInit`) est arrêtée juste après le
 * démarrage de l'app pour piloter la publication nous-mêmes (`publishPending()` appelée
 * directement) — sinon un tick réel du timer pourrait interférer avec les assertions.
 */

import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createTestApp } from './helpers/app.helper';
import { DomainEvent } from '../../src/events/entities/domain-event.entity';
import { EventPublisherService } from '../../src/events/event-publisher.service';
import { REDIS_CLIENT } from '../../src/events/redis-client.provider';

function makeFakeRedis() {
  return {
    xadd: jest.fn().mockResolvedValue('1-1'),
    // RelationEventConsumerService runs `while (this.running) { await xreadgroup(...) }` with no
    // delay when a response comes back immediately (real Redis blocks for BLOCK_MS instead) — a
    // mock that resolves right away spins that loop as fast as the CPU allows and blows the
    // Jest heap in seconds (`mock.calls` growing unbounded). A promise that never resolves during
    // the test's lifetime faithfully simulates "blocked, no new message" without that runaway loop.
    xreadgroup: jest.fn().mockImplementation(() => new Promise(() => {})),
    xgroup: jest.fn().mockResolvedValue('OK'),
    xack: jest.fn().mockResolvedValue(1),
    xautoclaim: jest.fn().mockResolvedValue(['0-0', [], []]),
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
  };
}

describe('[E2E] EventPublisherService — outbox transactionnel', () => {
  let app: INestApplication;
  let domainEventRepo: Repository<DomainEvent>;
  let publisher: EventPublisherService;
  let fakeRedis: ReturnType<typeof makeFakeRedis>;

  beforeAll(async () => {
    fakeRedis = makeFakeRedis();
    app = await createTestApp([{ provide: REDIS_CLIENT, useValue: fakeRedis }]);

    const dataSource = app.get<DataSource>(getDataSourceToken());
    domainEventRepo = dataSource.getRepository(DomainEvent);
    publisher = app.get(EventPublisherService);

    // Stop the real 2s timer — we drive publication explicitly in each test.
    // (also disconnects the fake Redis client, a harmless no-op mock).
    (publisher as unknown as { onModuleDestroy: () => void }).onModuleDestroy();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await domainEventRepo.clear();
    fakeRedis.xadd.mockClear();
  });

  async function runPublishTick(): Promise<void> {
    await (publisher as unknown as { publishPending: () => Promise<void> }).publishPending();
  }

  function eventIdsSentToRedis(): unknown[] {
    // ioredis xadd signature: (stream, id, field1, value1, field2, value2, ...) —
    // 'eventId' is always the first field/value pair (args[2]/args[3]).
    return fakeRedis.xadd.mock.calls.map((call) => call[3]);
  }

  it('publie un événement en attente (publishedAt null) et horodate publishedAt', async () => {
    const saved = await domainEventRepo.save(
      domainEventRepo.create({
        eventName: 'ProbeCreated',
        aggregateType: 'Probe',
        aggregateId: 'probe-1',
        payload: { ok: true },
      }),
    );
    expect(saved.publishedAt).toBeNull();

    await runPublishTick();

    const reloaded = await domainEventRepo.findOneByOrFail({ id: saved.id });
    expect(reloaded.publishedAt).not.toBeNull();
    expect(eventIdsSentToRedis()).toContain(saved.id);
  });

  it('ne republie jamais un événement déjà marqué publié (régression du 2026-09-05)', async () => {
    const alreadyPublishedAt = new Date('2026-01-01T00:00:00.000Z');
    const saved = await domainEventRepo.save(
      domainEventRepo.create({
        eventName: 'ProbeAlreadyPublished',
        aggregateType: 'Probe',
        aggregateId: 'probe-2',
        payload: { ok: true },
        publishedAt: alreadyPublishedAt,
      }),
    );

    // Plusieurs ticks, comme les centaines observées en production avant le correctif.
    await runPublishTick();
    await runPublishTick();
    await runPublishTick();

    const reloaded = await domainEventRepo.findOneByOrFail({ id: saved.id });
    expect(reloaded.publishedAt?.toISOString()).toBe(alreadyPublishedAt.toISOString());
    expect(eventIdsSentToRedis()).not.toContain(saved.id);
  });

  it('sur un lot mixte, ne publie que les lignes réellement en attente', async () => {
    const alreadyPublished = await domainEventRepo.save(
      domainEventRepo.create({
        eventName: 'AlreadyDone',
        aggregateType: 'Probe',
        aggregateId: 'probe-3',
        payload: {},
        publishedAt: new Date('2026-02-02T00:00:00.000Z'),
      }),
    );
    const stillPending = await domainEventRepo.save(
      domainEventRepo.create({
        eventName: 'StillPending',
        aggregateType: 'Probe',
        aggregateId: 'probe-4',
        payload: {},
      }),
    );

    await runPublishTick();

    const publishedIds = eventIdsSentToRedis();
    expect(publishedIds).toContain(stillPending.id);
    expect(publishedIds).not.toContain(alreadyPublished.id);

    const reloadedPending = await domainEventRepo.findOneByOrFail({ id: stillPending.id });
    expect(reloadedPending.publishedAt).not.toBeNull();
  });
});
