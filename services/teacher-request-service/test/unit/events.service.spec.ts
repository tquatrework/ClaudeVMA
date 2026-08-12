import { EventsService, TeacherRequestEvent } from '../../src/events/events.service';
import { DomainEvent } from '../../src/events/entities/domain-event.entity';

describe('EventsService', () => {
  let repository: { create: jest.Mock; save: jest.Mock };
  let publisher: { scheduleFlush: jest.Mock };
  let service: EventsService;

  beforeEach(() => {
    repository = {
      create: jest.fn((entity) => entity),
      save: jest.fn((entity) => Promise.resolve({ id: 'event-1', ...entity })),
    };
    publisher = { scheduleFlush: jest.fn() };
    service = new EventsService(repository as never, publisher as never);
  });

  it('un evenement est ECRIT EN BASE, pas seulement journalise', async () => {
    const recorded = await service.record({
      eventName: TeacherRequestEvent.REQUEST_CREATED,
      aggregateType: 'TeacherRequest',
      aggregateId: 'request-1',
      payload: { requestId: 'request-1' },
      correlationId: 'corr-1',
    });

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'TeacherRequestCreated',
        aggregateType: 'TeacherRequest',
        aggregateId: 'request-1',
        correlationId: 'corr-1',
        publishedAt: null,
      }),
    );
    expect(recorded).toMatchObject({ id: 'event-1' });
  });

  it('un evenement naissant sort en attente de publication', async () => {
    await service.record({
      eventName: TeacherRequestEvent.PROPOSAL_SENT,
      aggregateType: 'TeacherProposal',
      aggregateId: 'proposal-1',
      payload: {},
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ publishedAt: null, publishAttempts: 0 }),
    );
  });

  it('sans correlation fournie, la colonne reste nulle plutot que vide', async () => {
    await service.record({
      eventName: TeacherRequestEvent.REQUEST_DELETED,
      aggregateType: 'TeacherRequest',
      aggregateId: 'request-1',
      payload: {},
    });

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ correlationId: null }));
  });

  it('ecrit dans la transaction fournie, pour ne jamais annoncer un fait annule', async () => {
    const transactionalRepository = {
      create: jest.fn((entity) => entity),
      save: jest.fn((entity) => Promise.resolve({ id: 'event-2', ...entity })),
    };
    const manager = { getRepository: jest.fn().mockReturnValue(transactionalRepository) };

    await service.record(
      {
        eventName: TeacherRequestEvent.TEACHER_ASSIGNED,
        aggregateType: 'TeacherRequest',
        aggregateId: 'request-1',
        payload: {},
      },
      manager as never,
    );

    expect(manager.getRepository).toHaveBeenCalledWith(DomainEvent);
    expect(transactionalRepository.save).toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('la publication est demandee separement, apres validation de la transaction', () => {
    service.requestPublication();

    expect(publisher.scheduleFlush).toHaveBeenCalled();
  });
});
