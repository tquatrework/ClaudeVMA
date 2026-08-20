import { EventsService } from '../../../src/events/events.service';

/**
 * `EventsService.publish()` garde une signature synchrone (`void`) — les
 * treize points d'appel existants n'ont pas à changer — mais écrit
 * désormais en base de façon asynchrone, en tâche de fond (voir la doc du
 * service). `flushMicrotasks` laisse cette écriture se terminer avant que
 * le test ne fasse ses assertions.
 */
const flushMicrotasks = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

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
    service.publish('ActivityScheduled', { activityId: 'act-1' }, 'corr-1');
    await flushMicrotasks();

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'ActivityScheduled',
        aggregateType: 'ScheduledActivity',
        aggregateId: 'act-1',
        payload: { activityId: 'act-1' },
        correlationId: 'corr-1',
        publishedAt: null,
        publishAttempts: 0,
      }),
    );
  });

  it('sans correlation fournie, la colonne reste nulle plutot que vide', async () => {
    service.publish('AvailabilityUpdated', { ownerId: 'owner-1' });
    await flushMicrotasks();

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: null }),
    );
  });

  it('la publication est demandee des que l\'evenement est ecrit', async () => {
    service.publish('ActivityScheduled', { activityId: 'act-1' });
    await flushMicrotasks();

    expect(publisher.scheduleFlush).toHaveBeenCalled();
  });

  it("n'appelle pas la publication si l'ecriture echoue", async () => {
    repository.save.mockRejectedValueOnce(new Error('DB down'));

    service.publish('ActivityScheduled', { activityId: 'act-1' });
    await flushMicrotasks();

    expect(publisher.scheduleFlush).not.toHaveBeenCalled();
  });

  it("l'echec d'ecriture ne fait pas exploser l'appelant (publish reste void, fire-and-forget)", () => {
    repository.save.mockRejectedValueOnce(new Error('DB down'));

    expect(() => service.publish('ActivityScheduled', { activityId: 'act-1' })).not.toThrow();
  });

  it.each([
    ['AvailabilityUpdated', { ownerId: 'owner-1' }, 'Calendar', 'owner-1'],
    ['ActivityScheduled', { activityId: 'act-1' }, 'ScheduledActivity', 'act-1'],
    ['ActivityUpdated', { activityId: 'act-1' }, 'ScheduledActivity', 'act-1'],
    ['ActivityDeleted', { activityId: 'act-1' }, 'ScheduledActivity', 'act-1'],
    ['ActivityConfirmed', { activityId: 'act-1' }, 'ScheduledActivity', 'act-1'],
    ['ActivityDeclined', { activityId: 'act-1' }, 'ScheduledActivity', 'act-1'],
    ['ReminderCreated', { reminderId: 'rem-1', ownerId: 'owner-1' }, 'Reminder', 'rem-1'],
    ['CalendarEventCreated', { eventId: 'evt-1', ownerId: 'owner-1' }, 'CalendarEvent', 'evt-1'],
    ['CalendarEventDeleted', { eventId: 'evt-1', ownerId: 'owner-1' }, 'CalendarEvent', 'evt-1'],
    ['InvitationAccepted', { eventId: 'evt-1', userId: 'user-1' }, 'CalendarEvent', 'evt-1'],
    ['InvitationDeclined', { eventId: 'evt-1', userId: 'user-1' }, 'CalendarEvent', 'evt-1'],
    ['CancellationRequested', { eventId: 'evt-1', requesterId: 'user-1' }, 'CalendarEvent', 'evt-1'],
  ] as const)(
    '%s -> aggregateType=%s, aggregateId derive du payload (%s)',
    async (eventName, payload, expectedAggregateType, expectedAggregateId) => {
      service.publish(eventName, payload);
      await flushMicrotasks();

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName,
          aggregateType: expectedAggregateType,
          aggregateId: expectedAggregateId,
        }),
      );
    },
  );

  it("retombe sur 'unknown' quand aucun identifiant connu n'est present dans le payload", async () => {
    service.publish('InvitationAccepted', { somethingElse: 'x' } as never);
    await flushMicrotasks();

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ aggregateId: 'unknown' }),
    );
  });
});
