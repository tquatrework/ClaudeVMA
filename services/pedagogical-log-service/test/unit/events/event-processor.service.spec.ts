/**
 * Unit tests — EventProcessorService (point 5)
 *
 * ActivityScheduled → projection locale (activity_projections).
 * ActivityConfirmed → si l'activité projetée est de type "cours", crée une
 * entrée de cahier de texte automatique et vide (seule date renseignée).
 * Idempotence par eventId (processed_events) et, en défense supplémentaire,
 * par (activityId, autoCreated=true).
 */

import { EventProcessorService } from '../../../src/events/event-processor.service';

function buildManager(overrides: Partial<Record<string, any>> = {}) {
  const repos: Record<string, any> = {
    ActivityProjection: { save: jest.fn() },
    ProcessedEvent: { save: jest.fn() },
    PedagogicalLog: { findOne: jest.fn().mockResolvedValue(null), create: jest.fn((x) => x), save: jest.fn() },
    ...overrides,
  };
  return {
    getRepository: (entity: any) => repos[entity.name] ?? repos[entity],
    _repos: repos,
  };
}

describe('EventProcessorService', () => {
  let processedEvents: { findOne: jest.Mock; save: jest.Mock };
  let projections: { findOne: jest.Mock; save: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let processor: EventProcessorService;
  let lastManager: any;

  beforeEach(() => {
    processedEvents = { findOne: jest.fn().mockResolvedValue(null), save: jest.fn() };
    projections = { findOne: jest.fn().mockResolvedValue(null), save: jest.fn() };

    dataSource = {
      transaction: jest.fn(async (cb: (manager: any) => Promise<void>) => {
        lastManager = buildManager();
        await cb(lastManager);
      }),
    };

    processor = new EventProcessorService(
      dataSource as any,
      projections as any,
      processedEvents as any,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('événement déjà traité (eventId connu) → aucun effet', async () => {
    processedEvents.findOne.mockResolvedValue({ eventId: 'evt-1' });

    await processor.process({ eventId: 'evt-1', eventName: 'ActivityScheduled', payload: '{}' });

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('eventId ou eventName manquant → journalisé, aucun effet', async () => {
    await processor.process({ payload: '{}' } as any);
    expect(processedEvents.findOne).not.toHaveBeenCalled();
  });

  it('eventName non reconnu → marqué traité sans effet, jamais bloquant', async () => {
    await processor.process({ eventId: 'evt-x', eventName: 'SomethingUnknown', payload: '{}' });

    expect(processedEvents.save).toHaveBeenCalledWith({ eventId: 'evt-x', eventType: 'SomethingUnknown' });
  });

  it('payload JSON malformé → journalisé, non traité', async () => {
    await processor.process({ eventId: 'evt-bad', eventName: 'ActivityScheduled', payload: '{not json' });
    expect(processedEvents.save).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  describe('ActivityScheduled', () => {
    it('projette l\'activité localement et marque l\'événement traité', async () => {
      const payload = {
        activityId: 'activity-1',
        type: 'cours',
        creatorId: 'teacher-1',
        recipientId: 'student-1',
        participantIds: ['student-1'],
        startTime: '2026-09-10T14:00:00.000Z',
      };

      await processor.process({ eventId: 'evt-1', eventName: 'ActivityScheduled', payload: JSON.stringify(payload) });

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(lastManager._repos.ActivityProjection.save).toHaveBeenCalledWith(
        expect.objectContaining({ activityId: 'activity-1', type: 'cours', recipientId: 'student-1' }),
      );
      expect(lastManager._repos.ProcessedEvent.save).toHaveBeenCalledWith({
        eventId: 'evt-1',
        eventType: 'ActivityScheduled',
      });
    });
  });

  describe('ActivityConfirmed', () => {
    it('[CRITIQUE] type=cours avec projection connue → crée une entrée de cahier de texte automatique', async () => {
      projections.findOne.mockResolvedValue({
        activityId: 'activity-1',
        type: 'cours',
        creatorId: 'teacher-1',
        recipientId: 'student-1',
        startTime: new Date('2026-09-10T14:00:00.000Z'),
      });

      await processor.process({
        eventId: 'evt-2',
        eventName: 'ActivityConfirmed',
        payload: JSON.stringify({ activityId: 'activity-1', confirmedBy: 'student-1' }),
      });

      expect(lastManager._repos.PedagogicalLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 'student-1',
          authorId: 'teacher-1',
          authorRole: 'formateur',
          activityId: 'activity-1',
          date: '2026-09-10',
          autoCreated: true,
          visibility: 'eleve_parent_formateur',
        }),
      );
      expect(lastManager._repos.PedagogicalLog.save).toHaveBeenCalled();
      expect(lastManager._repos.ProcessedEvent.save).toHaveBeenCalledWith({
        eventId: 'evt-2',
        eventType: 'ActivityConfirmed',
      });
    });

    it('idempotent par activityId : une entrée déjà créée n\'est jamais dupliquée', async () => {
      projections.findOne.mockResolvedValue({
        activityId: 'activity-1',
        type: 'cours',
        creatorId: 'teacher-1',
        recipientId: 'student-1',
        startTime: new Date('2026-09-10T14:00:00.000Z'),
      });

      dataSource.transaction.mockImplementation(async (cb: (manager: any) => Promise<void>) => {
        lastManager = buildManager({
          PedagogicalLog: {
            findOne: jest.fn().mockResolvedValue({ id: 'existing' }),
            create: jest.fn(),
            save: jest.fn(),
          },
        });
        await cb(lastManager);
      });

      await processor.process({
        eventId: 'evt-3',
        eventName: 'ActivityConfirmed',
        payload: JSON.stringify({ activityId: 'activity-1', confirmedBy: 'student-1' }),
      });

      expect(lastManager._repos.PedagogicalLog.create).not.toHaveBeenCalled();
    });

    it('type !== cours → aucune entrée créée, événement marqué traité', async () => {
      projections.findOne.mockResolvedValue({
        activityId: 'activity-2',
        type: 'reunion_pedagogique',
        creatorId: 'rp-1',
        recipientId: 'teacher-2',
        startTime: new Date(),
      });

      await processor.process({
        eventId: 'evt-4',
        eventName: 'ActivityConfirmed',
        payload: JSON.stringify({ activityId: 'activity-2', confirmedBy: 'teacher-2' }),
      });

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(processedEvents.save).toHaveBeenCalledWith({ eventId: 'evt-4', eventType: 'ActivityConfirmed' });
    });

    it('[CRITIQUE] projection introuvable (jamais observée) → aucune entrée créée, avertissement journalisé', async () => {
      projections.findOne.mockResolvedValue(null);

      await processor.process({
        eventId: 'evt-5',
        eventName: 'ActivityConfirmed',
        payload: JSON.stringify({ activityId: 'unknown-activity', confirmedBy: 'x' }),
      });

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(processedEvents.save).toHaveBeenCalledWith({ eventId: 'evt-5', eventType: 'ActivityConfirmed' });
    });

    it('cours sans recipientId → aucune entrée créée (défensif)', async () => {
      projections.findOne.mockResolvedValue({
        activityId: 'activity-3',
        type: 'cours',
        creatorId: 'teacher-1',
        recipientId: null,
        startTime: new Date(),
      });

      await processor.process({
        eventId: 'evt-6',
        eventName: 'ActivityConfirmed',
        payload: JSON.stringify({ activityId: 'activity-3', confirmedBy: 'x' }),
      });

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(processedEvents.save).toHaveBeenCalledWith({ eventId: 'evt-6', eventType: 'ActivityConfirmed' });
    });
  });
});
