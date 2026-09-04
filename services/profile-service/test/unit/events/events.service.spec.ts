import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventsService } from '../../../src/events/events.service';
import { DomainEventOutbox } from '../../../src/events/domain-event-outbox.entity';

/**
 * Depuis le 2026-09-04, `publish()` écrit une ligne dans l'outbox
 * `domain_events` en plus du log — voir `EventPublisherService` pour la
 * publication réelle sur Redis, testée séparément.
 */
describe('EventsService', () => {
  let service: EventsService;
  let outboxRepo: any;

  beforeEach(async () => {
    outboxRepo = {
      create: jest.fn().mockImplementation((row) => row),
      save: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: getRepositoryToken(DomainEventOutbox), useValue: outboxRepo },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  it("écrit une ligne dans l'outbox pour chaque événement publié", async () => {
    await service.publish('TeacherLinkedToStudent', { teacherId: 't1', studentId: 's1' });

    expect(outboxRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'TeacherLinkedToStudent',
        payload: { teacherId: 't1', studentId: 's1' },
        occurredAt: expect.any(Date),
      }),
    );
    expect(outboxRepo.save).toHaveBeenCalled();
  });

  it("ne fait jamais échouer l'appelant si l'écriture de l'outbox échoue", async () => {
    outboxRepo.save.mockRejectedValue(new Error('DB down'));

    await expect(
      service.publish('TeacherLinkedToStudent', { teacherId: 't1', studentId: 's1' }),
    ).resolves.toBeUndefined();
  });
});
