import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { EventProcessorService } from '../../src/events/event-processor.service';
import { ProfileServiceClient } from '../../src/events/profile-service.client';
import { IdentityAccessServiceClient } from '../../src/common/clients/identity-access-service.client';
import { Notification, NotificationType } from '../../src/notification/entities/notification.entity';
import { ProcessedEvent } from '../../src/events/entities/processed-event.entity';

const mockProfileServiceClient = () => ({
  resolveDisplayNames: jest.fn(),
  getFinanceOwners: jest.fn(),
});

const mockIdentityAccessServiceClient = () => ({
  listUserIdsByRole: jest.fn(),
});

describe('EventProcessorService', () => {
  let processor: EventProcessorService;
  let processedEventRepository: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };
  let profileServiceClient: ReturnType<typeof mockProfileServiceClient>;
  let identityAccessServiceClient: ReturnType<typeof mockIdentityAccessServiceClient>;
  let dataSource: { transaction: jest.Mock };
  let txNotificationRepository: { create: jest.Mock; save: jest.Mock };
  let txProcessedEventRepository: { create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    processedEventRepository = { findOne: jest.fn(), save: jest.fn(async (x) => x), create: jest.fn((x) => x) };

    txNotificationRepository = { create: jest.fn((x) => x), save: jest.fn(async (x) => x) };
    txProcessedEventRepository = { create: jest.fn((x) => x), save: jest.fn(async (x) => x) };

    dataSource = {
      transaction: jest.fn(async (callback: (manager: any) => Promise<void>) => {
        const manager = {
          getRepository: (entity: any) => (entity === Notification ? txNotificationRepository : txProcessedEventRepository),
        };
        return callback(manager);
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EventProcessorService,
        { provide: getRepositoryToken(Notification), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(ProcessedEvent), useValue: processedEventRepository },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: ProfileServiceClient, useFactory: mockProfileServiceClient },
        { provide: IdentityAccessServiceClient, useFactory: mockIdentityAccessServiceClient },
      ],
    }).compile();

    processor = moduleRef.get<EventProcessorService>(EventProcessorService);
    profileServiceClient = moduleRef.get(ProfileServiceClient);
    identityAccessServiceClient = moduleRef.get(IdentityAccessServiceClient);

    processedEventRepository.findOne.mockResolvedValue(null);
    // Default: a single RP account, matching the shape of a real fan-out.
    // Individual tests override this when they need several RPs or none.
    identityAccessServiceClient.listUserIdsByRole.mockResolvedValue(['rp-1']);
    // Default: no finance owner, so describes that don't care about finance
    // owners (TeacherProposalSent, malformed entries, idempotency…) don't
    // have to stub it themselves. Overridden locally where relevant.
    profileServiceClient.getFinanceOwners.mockResolvedValue([]);
  });

  const displayNames = (entries: Record<string, { firstName: string | null; lastName: string | null }>) => {
    const map = new Map(Object.entries(entries));
    profileServiceClient.resolveDisplayNames.mockResolvedValue(map);
    return map;
  };

  describe('malformed entries', () => {
    it('drops an entry missing eventId without touching the database', async () => {
      await processor.process({ eventName: 'TeacherRequestCreated', payload: '{}' });

      expect(processedEventRepository.findOne).not.toHaveBeenCalled();
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('drops an entry missing eventName without touching the database', async () => {
      await processor.process({ eventId: 'evt-1', payload: '{}' });

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('marks an unparsable payload as processed without creating a notification', async () => {
      await processor.process({ eventId: 'evt-1', eventName: 'TeacherRequestCreated', payload: 'not-json' });

      expect(processedEventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'evt-1', eventName: 'TeacherRequestCreated' }),
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('idempotency', () => {
    it('skips an event already recorded as processed', async () => {
      processedEventRepository.findOne.mockResolvedValue({ id: 'row-1', eventId: 'evt-1' });

      await processor.process({ eventId: 'evt-1', eventName: 'TeacherRequestCreated', payload: '{}' });

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(profileServiceClient.resolveDisplayNames).not.toHaveBeenCalled();
    });

    it('swallows a concurrent duplicate insert instead of throwing', async () => {
      displayNames({ 'student-1': { firstName: 'Camille', lastName: 'Durand' } });
      dataSource.transaction.mockRejectedValue({ code: '23505' });

      await expect(
        processor.process({
          eventId: 'evt-1',
          eventName: 'TeacherRequestCreated',
          payload: JSON.stringify({ requestId: 'req-1', studentId: 'student-1', requesterId: 'u-1', requesterRole: 'eleve', type: 'standard' }),
        }),
      ).resolves.toBeUndefined();
    });

    it('propagates a non-duplicate database error', async () => {
      displayNames({ 'student-1': { firstName: 'Camille', lastName: 'Durand' } });
      dataSource.transaction.mockRejectedValue(new Error('connection lost'));

      await expect(
        processor.process({
          eventId: 'evt-1',
          eventName: 'TeacherRequestCreated',
          payload: JSON.stringify({ requestId: 'req-1', studentId: 'student-1', requesterId: 'u-1', requesterRole: 'eleve', type: 'standard' }),
        }),
      ).rejects.toThrow('connection lost');
    });
  });

  describe('TeacherRequestCreated', () => {
    it('notifies every real RP userId (real fan-out) with the resolved student name', async () => {
      displayNames({ 'student-1': { firstName: 'Camille', lastName: 'Durand' } });
      identityAccessServiceClient.listUserIdsByRole.mockResolvedValue(['rp-1', 'rp-2']);

      await processor.process({
        eventId: 'evt-1',
        eventName: 'TeacherRequestCreated',
        payload: JSON.stringify({ requestId: 'req-1', studentId: 'student-1', requesterId: 'u-1', requesterRole: 'eleve', type: 'standard' }),
      });

      expect(identityAccessServiceClient.listUserIdsByRole).toHaveBeenCalledWith('responsable_pedagogique');
      const recipients = txNotificationRepository.save.mock.calls.map(([n]: any) => n.userId);
      expect(recipients).toEqual(['rp-1', 'rp-2']);
      expect(txNotificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'rp-1',
          type: NotificationType.TEACHER_REQUEST_CREATED,
          title: null,
          message: null,
          metadata: expect.objectContaining({ requestId: 'req-1', studentId: 'student-1', studentName: 'Camille Durand' }),
        }),
      );
      expect(txProcessedEventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'evt-1', eventName: 'TeacherRequestCreated' }),
      );
    });

    it('also notifies every finance owner of the student, in addition to the RP role (2026-08-18)', async () => {
      displayNames({ 'student-1': { firstName: 'Camille', lastName: 'Durand' } });
      identityAccessServiceClient.listUserIdsByRole.mockResolvedValue(['rp-1']);
      profileServiceClient.getFinanceOwners.mockResolvedValue(['parent-1', 'parent-2']);

      await processor.process({
        eventId: 'evt-1',
        eventName: 'TeacherRequestCreated',
        payload: JSON.stringify({ requestId: 'req-1', studentId: 'student-1', requesterId: 'u-1', requesterRole: 'eleve', type: 'standard' }),
      });

      expect(profileServiceClient.getFinanceOwners).toHaveBeenCalledWith('student-1');
      const recipients = txNotificationRepository.save.mock.calls.map(([n]: any) => n.userId);
      expect(recipients).toEqual(['rp-1', 'parent-1', 'parent-2']);
      expect(txNotificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'parent-1',
          type: NotificationType.TEACHER_REQUEST_CREATED,
          metadata: expect.objectContaining({ requestId: 'req-1', studentId: 'student-1', studentName: 'Camille Durand' }),
        }),
      );
    });

    it('marks the event as processed without creating any notification when there is no RP and no finance owner', async () => {
      displayNames({ 'student-1': { firstName: 'Camille', lastName: 'Durand' } });
      identityAccessServiceClient.listUserIdsByRole.mockResolvedValue([]);

      await processor.process({
        eventId: 'evt-1',
        eventName: 'TeacherRequestCreated',
        payload: JSON.stringify({ requestId: 'req-1', studentId: 'student-1', requesterId: 'u-1', requesterRole: 'eleve', type: 'standard' }),
      });

      expect(txNotificationRepository.save).not.toHaveBeenCalled();
      expect(txProcessedEventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'evt-1', eventName: 'TeacherRequestCreated' }),
      );
    });

    it('does not acknowledge (throws) when the student name cannot be resolved', async () => {
      profileServiceClient.resolveDisplayNames.mockResolvedValue(new Map());

      await expect(
        processor.process({
          eventId: 'evt-1',
          eventName: 'TeacherRequestCreated',
          payload: JSON.stringify({ requestId: 'req-1', studentId: 'student-1', requesterId: 'u-1', requesterRole: 'eleve', type: 'standard' }),
        }),
      ).rejects.toThrow(/Unresolved display name/);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('does not acknowledge (throws) when RP userIds cannot be resolved', async () => {
      displayNames({ 'student-1': { firstName: 'Camille', lastName: 'Durand' } });
      identityAccessServiceClient.listUserIdsByRole.mockRejectedValue(new Error('identity-access-service unreachable'));

      await expect(
        processor.process({
          eventId: 'evt-1',
          eventName: 'TeacherRequestCreated',
          payload: JSON.stringify({ requestId: 'req-1', studentId: 'student-1', requesterId: 'u-1', requesterRole: 'eleve', type: 'standard' }),
        }),
      ).rejects.toThrow('identity-access-service unreachable');

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('does not acknowledge (throws) when finance owners cannot be resolved', async () => {
      displayNames({ 'student-1': { firstName: 'Camille', lastName: 'Durand' } });
      identityAccessServiceClient.listUserIdsByRole.mockResolvedValue(['rp-1']);
      profileServiceClient.getFinanceOwners.mockRejectedValue(new Error('profile-service unreachable'));

      await expect(
        processor.process({
          eventId: 'evt-1',
          eventName: 'TeacherRequestCreated',
          payload: JSON.stringify({ requestId: 'req-1', studentId: 'student-1', requesterId: 'u-1', requesterRole: 'eleve', type: 'standard' }),
        }),
      ).rejects.toThrow('profile-service unreachable');

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('TeacherProposalSent', () => {
    it('notifies the teacher', async () => {
      displayNames({ 'student-1': { firstName: 'Camille', lastName: 'Durand' } });

      await processor.process({
        eventId: 'evt-2',
        eventName: 'TeacherProposalSent',
        payload: JSON.stringify({
          proposalId: 'prop-1',
          requestId: 'req-1',
          teacherId: 'teacher-1',
          studentId: 'student-1',
          sentBy: 'rp-1',
          responseDeadline: '2026-09-01',
        }),
      });

      expect(txNotificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'teacher-1',
          type: NotificationType.TEACHER_PROPOSAL_SENT,
          metadata: expect.objectContaining({ proposalId: 'prop-1', studentName: 'Camille Durand', responseDeadline: '2026-09-01' }),
        }),
      );
    });
  });

  describe('TeacherProposalAccepted / TeacherProposalDeclined', () => {
    it.each([
      ['TeacherProposalAccepted', NotificationType.TEACHER_PROPOSAL_ACCEPTED],
      ['TeacherProposalDeclined', NotificationType.TEACHER_PROPOSAL_DECLINED],
    ])('notifies every real RP userId (real fan-out) with both names for %s', async (eventName, expectedType) => {
      displayNames({
        'student-1': { firstName: 'Camille', lastName: 'Durand' },
        'teacher-1': { firstName: 'Alex', lastName: 'Martin' },
      });
      identityAccessServiceClient.listUserIdsByRole.mockResolvedValue(['rp-1']);

      await processor.process({
        eventId: 'evt-3',
        eventName,
        payload: JSON.stringify({ proposalId: 'prop-1', requestId: 'req-1', teacherId: 'teacher-1', studentId: 'student-1' }),
      });

      expect(identityAccessServiceClient.listUserIdsByRole).toHaveBeenCalledWith('responsable_pedagogique');
      expect(txNotificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'rp-1',
          type: expectedType,
          metadata: expect.objectContaining({ studentName: 'Camille Durand', teacherName: 'Alex Martin' }),
        }),
      );
    });
  });

  describe('TeacherProposalNotSelected / TeacherProposalExpired', () => {
    it.each([
      ['TeacherProposalNotSelected', NotificationType.TEACHER_PROPOSAL_NOT_SELECTED],
      ['TeacherProposalExpired', NotificationType.TEACHER_PROPOSAL_EXPIRED],
    ])('notifies the teacher for %s', async (eventName, expectedType) => {
      displayNames({ 'student-1': { firstName: 'Camille', lastName: 'Durand' } });

      await processor.process({
        eventId: 'evt-4',
        eventName,
        payload: JSON.stringify({ proposalId: 'prop-1', requestId: 'req-1', teacherId: 'teacher-1', studentId: 'student-1' }),
      });

      expect(txNotificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'teacher-1', type: expectedType }),
      );
    });
  });

  describe('TeacherAssigned', () => {
    it('notifies the teacher, the student and every finance owner', async () => {
      displayNames({
        'student-1': { firstName: 'Camille', lastName: 'Durand' },
        'teacher-1': { firstName: 'Alex', lastName: 'Martin' },
      });
      profileServiceClient.getFinanceOwners.mockResolvedValue(['parent-1', 'parent-2']);

      await processor.process({
        eventId: 'evt-5',
        eventName: 'TeacherAssigned',
        payload: JSON.stringify({
          requestId: 'req-1',
          proposalId: 'prop-1',
          studentId: 'student-1',
          teacherId: 'teacher-1',
          isPrincipalTeacher: true,
          validatedBy: 'rp-1',
        }),
      });

      const recipients = txNotificationRepository.save.mock.calls.map(([n]: any) => n.userId);
      expect(recipients).toEqual(['teacher-1', 'student-1', 'parent-1', 'parent-2']);
      expect(txNotificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ type: NotificationType.TEACHER_ASSIGNED, metadata: expect.objectContaining({ isPrincipalTeacher: true }) }),
      );
    });

    it('does not acknowledge when finance owners cannot be resolved', async () => {
      displayNames({
        'student-1': { firstName: 'Camille', lastName: 'Durand' },
        'teacher-1': { firstName: 'Alex', lastName: 'Martin' },
      });
      profileServiceClient.getFinanceOwners.mockRejectedValue(new Error('profile-service unreachable'));

      await expect(
        processor.process({
          eventId: 'evt-5',
          eventName: 'TeacherAssigned',
          payload: JSON.stringify({
            requestId: 'req-1',
            proposalId: 'prop-1',
            studentId: 'student-1',
            teacherId: 'teacher-1',
            validatedBy: 'rp-1',
          }),
        }),
      ).rejects.toThrow('profile-service unreachable');

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('MainTeacherAssigned (legacy)', () => {
    it('notifies the teacher, the student and every finance owner with assignmentId in metadata', async () => {
      displayNames({
        'student-1': { firstName: 'Camille', lastName: 'Durand' },
        'teacher-1': { firstName: 'Alex', lastName: 'Martin' },
      });
      profileServiceClient.getFinanceOwners.mockResolvedValue(['parent-1']);

      await processor.process({
        eventId: 'evt-6',
        eventName: 'MainTeacherAssigned',
        payload: JSON.stringify({ assignmentId: 'assign-1', studentId: 'student-1', teacherId: 'teacher-1' }),
      });

      expect(txNotificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'teacher-1',
          type: NotificationType.TEACHER_ASSIGNED,
          metadata: expect.objectContaining({ assignmentId: 'assign-1' }),
        }),
      );
      const recipients = txNotificationRepository.save.mock.calls.map(([n]: any) => n.userId);
      expect(recipients).toEqual(['teacher-1', 'student-1', 'parent-1']);
    });
  });

  describe('TeacherRequestStatusUpdated', () => {
    it('notifies the student and every finance owner', async () => {
      displayNames({ 'student-1': { firstName: 'Camille', lastName: 'Durand' } });
      profileServiceClient.getFinanceOwners.mockResolvedValue(['parent-1']);

      await processor.process({
        eventId: 'evt-7',
        eventName: 'TeacherRequestStatusUpdated',
        payload: JSON.stringify({ requestId: 'req-1', status: 'declined', updatedBy: 'rp-1', studentId: 'student-1' }),
      });

      const recipients = txNotificationRepository.save.mock.calls.map(([n]: any) => n.userId);
      expect(recipients).toEqual(['student-1', 'parent-1']);
      expect(txNotificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ type: NotificationType.TEACHER_REQUEST_STATUS_UPDATED, metadata: expect.objectContaining({ status: 'declined' }) }),
      );
    });
  });

  describe('ActivityScheduled', () => {
    it('notifies the single recipient with the resolved proposer name (2026-08-19)', async () => {
      displayNames({ 'teacher-1': { firstName: 'Alex', lastName: 'Martin' } });

      await processor.process({
        eventId: 'evt-10',
        eventName: 'ActivityScheduled',
        payload: JSON.stringify({
          activityId: 'activity-1',
          type: 'cours',
          creatorId: 'teacher-1',
          recipientId: 'student-1',
          participantIds: ['student-1'],
          startTime: '2026-09-10T14:00:00.000Z',
        }),
      });

      expect(txNotificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'student-1',
          type: NotificationType.COURSE_SLOT_PROPOSED,
          title: null,
          message: null,
          metadata: expect.objectContaining({
            proposerName: 'Alex Martin',
            activityId: 'activity-1',
            activityType: 'cours',
            startTime: '2026-09-10T14:00:00.000Z',
          }),
        }),
      );
      expect(txProcessedEventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'evt-10', eventName: 'ActivityScheduled' }),
      );
    });

    it('marks the event as processed without creating a notification when recipientId is null (multi-participant activity)', async () => {
      await processor.process({
        eventId: 'evt-11',
        eventName: 'ActivityScheduled',
        payload: JSON.stringify({
          activityId: 'activity-2',
          type: 'reunion_pedagogique',
          creatorId: 'rp-1',
          recipientId: null,
          participantIds: ['teacher-1', 'teacher-2'],
          startTime: '2026-09-10T14:00:00.000Z',
        }),
      });

      expect(txNotificationRepository.save).not.toHaveBeenCalled();
      expect(processedEventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'evt-11', eventName: 'ActivityScheduled' }),
      );
      expect(profileServiceClient.resolveDisplayNames).not.toHaveBeenCalled();
    });

    it('does not acknowledge (throws) when the proposer name cannot be resolved', async () => {
      profileServiceClient.resolveDisplayNames.mockResolvedValue(new Map());

      await expect(
        processor.process({
          eventId: 'evt-12',
          eventName: 'ActivityScheduled',
          payload: JSON.stringify({
            activityId: 'activity-3',
            type: 'cours',
            creatorId: 'teacher-1',
            recipientId: 'student-1',
            participantIds: ['student-1'],
            startTime: '2026-09-10T14:00:00.000Z',
          }),
        }),
      ).rejects.toThrow(/Unresolved display name/);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('CalendarEventCreated', () => {
    it('notifies every invitee with the resolved creator name and the event title (2026-08-20)', async () => {
      displayNames({ 'creator-1': { firstName: 'Camille', lastName: 'Durand' } });

      await processor.process({
        eventId: 'evt-13',
        eventName: 'CalendarEventCreated',
        payload: JSON.stringify({
          eventId: 'calendar-event-1',
          ownerId: 'creator-1',
          creatorId: 'creator-1',
          eventType: 'cours',
          title: 'Cours de géométrie',
          startTime: '2026-09-10T14:00:00.000Z',
          inviteeIds: ['invitee-1', 'invitee-2'],
        }),
      });

      const recipients = txNotificationRepository.save.mock.calls.map(([n]: any) => n.userId);
      expect(recipients).toEqual(['invitee-1', 'invitee-2']);
      expect(txNotificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'invitee-1',
          type: NotificationType.EVENT_INVITATION_RECEIVED,
          title: null,
          message: null,
          metadata: expect.objectContaining({
            creatorName: 'Camille Durand',
            eventId: 'calendar-event-1',
            eventType: 'cours',
            title: 'Cours de géométrie',
            startAt: '2026-09-10T14:00:00.000Z',
          }),
        }),
      );
      expect(txProcessedEventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'evt-13', eventName: 'CalendarEventCreated' }),
      );
    });

    it('stores a null title, without inventing a default, when the event has no title', async () => {
      displayNames({ 'creator-1': { firstName: 'Camille', lastName: 'Durand' } });

      await processor.process({
        eventId: 'evt-14',
        eventName: 'CalendarEventCreated',
        payload: JSON.stringify({
          eventId: 'calendar-event-2',
          ownerId: 'creator-1',
          creatorId: 'creator-1',
          eventType: 'rappel',
          startTime: '2026-09-10T14:00:00.000Z',
          inviteeIds: ['invitee-1'],
        }),
      });

      expect(txNotificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: expect.objectContaining({ title: null }) }),
      );
    });

    it('marks the event as processed without creating a notification when inviteeIds is empty', async () => {
      await processor.process({
        eventId: 'evt-15',
        eventName: 'CalendarEventCreated',
        payload: JSON.stringify({
          eventId: 'calendar-event-3',
          ownerId: 'creator-1',
          creatorId: 'creator-1',
          eventType: 'cours',
          startTime: '2026-09-10T14:00:00.000Z',
          inviteeIds: [],
        }),
      });

      expect(txNotificationRepository.save).not.toHaveBeenCalled();
      expect(processedEventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'evt-15', eventName: 'CalendarEventCreated' }),
      );
      expect(profileServiceClient.resolveDisplayNames).not.toHaveBeenCalled();
    });

    it('does not acknowledge (throws) when the creator name cannot be resolved', async () => {
      profileServiceClient.resolveDisplayNames.mockResolvedValue(new Map());

      await expect(
        processor.process({
          eventId: 'evt-16',
          eventName: 'CalendarEventCreated',
          payload: JSON.stringify({
            eventId: 'calendar-event-4',
            ownerId: 'creator-1',
            creatorId: 'creator-1',
            eventType: 'cours',
            startTime: '2026-09-10T14:00:00.000Z',
            inviteeIds: ['invitee-1'],
          }),
        }),
      ).rejects.toThrow(/Unresolved display name/);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('EvaluationCorrectionRequested', () => {
    it('notifies every linked teacher individually and the RP role, with the resolved student name', async () => {
      displayNames({ 'student-1': { firstName: 'Camille', lastName: 'Durand' } });
      identityAccessServiceClient.listUserIdsByRole.mockResolvedValue(['rp-1', 'rp-2']);

      await processor.process({
        eventId: 'evt-20',
        eventName: 'EvaluationCorrectionRequested',
        payload: JSON.stringify({
          correctionRequestId: 'correction-1',
          attemptId: 'attempt-1',
          evaluationId: 'evaluation-1',
          studentId: 'student-1',
          teacherIds: ['teacher-1', 'teacher-2'],
        }),
      });

      const recipients = txNotificationRepository.save.mock.calls.map(([n]: any) => n.userId);
      expect(recipients).toEqual(['teacher-1', 'teacher-2', 'rp-1', 'rp-2']);
      expect(txNotificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'teacher-1',
          type: NotificationType.EVALUATION_CORRECTION_REQUESTED,
          title: null,
          message: null,
          metadata: expect.objectContaining({
            correctionRequestId: 'correction-1',
            attemptId: 'attempt-1',
            evaluationId: 'evaluation-1',
            studentId: 'student-1',
            studentName: 'Camille Durand',
          }),
        }),
      );
      expect(txProcessedEventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'evt-20', eventName: 'EvaluationCorrectionRequested' }),
      );
    });

    it('does not acknowledge (throws) when the student name cannot be resolved', async () => {
      profileServiceClient.resolveDisplayNames.mockResolvedValue(new Map());

      await expect(
        processor.process({
          eventId: 'evt-21',
          eventName: 'EvaluationCorrectionRequested',
          payload: JSON.stringify({
            correctionRequestId: 'correction-1',
            attemptId: 'attempt-1',
            evaluationId: 'evaluation-1',
            studentId: 'student-1',
            teacherIds: ['teacher-1'],
          }),
        }),
      ).rejects.toThrow(/Unresolved display name/);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('EvaluationCorrectionAccepted / EvaluationCorrectionDeclined', () => {
    it.each([
      ['EvaluationCorrectionAccepted', NotificationType.EVALUATION_CORRECTION_ACCEPTED],
      ['EvaluationCorrectionDeclined', NotificationType.EVALUATION_CORRECTION_DECLINED],
    ])('notifies the RP role with the resolved student and teacher names for %s', async (eventName, type) => {
      displayNames({
        'student-1': { firstName: 'Camille', lastName: 'Durand' },
        'teacher-1': { firstName: 'Alex', lastName: 'Martin' },
      });
      identityAccessServiceClient.listUserIdsByRole.mockResolvedValue(['rp-1']);

      await processor.process({
        eventId: 'evt-22',
        eventName,
        payload: JSON.stringify({
          correctionRequestId: 'correction-1',
          attemptId: 'attempt-1',
          evaluationId: 'evaluation-1',
          studentId: 'student-1',
          teacherId: 'teacher-1',
        }),
      });

      expect(txNotificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'rp-1',
          type,
          metadata: expect.objectContaining({
            correctionRequestId: 'correction-1',
            studentId: 'student-1',
            studentName: 'Camille Durand',
            teacherId: 'teacher-1',
            teacherName: 'Alex Martin',
          }),
        }),
      );
    });
  });

  describe('EvaluationCorrectionAllDeclined', () => {
    it('notifies the RP role with the reason and the resolved student name', async () => {
      displayNames({ 'student-1': { firstName: 'Camille', lastName: 'Durand' } });
      identityAccessServiceClient.listUserIdsByRole.mockResolvedValue(['rp-1']);

      await processor.process({
        eventId: 'evt-23',
        eventName: 'EvaluationCorrectionAllDeclined',
        payload: JSON.stringify({
          correctionRequestId: 'correction-1',
          attemptId: 'attempt-1',
          evaluationId: 'evaluation-1',
          studentId: 'student-1',
          reason: 'all_linked_teachers_declined',
        }),
      });

      expect(txNotificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'rp-1',
          type: NotificationType.EVALUATION_CORRECTION_ALL_DECLINED,
          metadata: expect.objectContaining({
            studentId: 'student-1',
            studentName: 'Camille Durand',
            reason: 'all_linked_teachers_declined',
          }),
        }),
      );
    });

    it('notifies the RP role with reason no_linked_teacher when the student had no linked teacher', async () => {
      displayNames({ 'student-1': { firstName: 'Camille', lastName: 'Durand' } });
      identityAccessServiceClient.listUserIdsByRole.mockResolvedValue(['rp-1']);

      await processor.process({
        eventId: 'evt-24',
        eventName: 'EvaluationCorrectionAllDeclined',
        payload: JSON.stringify({
          correctionRequestId: 'correction-1',
          attemptId: 'attempt-1',
          evaluationId: 'evaluation-1',
          studentId: 'student-1',
          reason: 'no_linked_teacher',
        }),
      });

      expect(txNotificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: expect.objectContaining({ reason: 'no_linked_teacher' }) }),
      );
    });
  });

  describe('EvaluationCorrected', () => {
    it('notifies the student with the resolved teacher name, score and comment', async () => {
      displayNames({ 'teacher-1': { firstName: 'Alex', lastName: 'Martin' } });

      await processor.process({
        eventId: 'evt-25',
        eventName: 'EvaluationCorrected',
        payload: JSON.stringify({
          correctionRequestId: 'correction-1',
          attemptId: 'attempt-1',
          evaluationId: 'evaluation-1',
          studentId: 'student-1',
          teacherId: 'teacher-1',
          score: 14,
          comment: 'Bon travail, attention aux signes.',
        }),
      });

      expect(txNotificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'student-1',
          type: NotificationType.EVALUATION_CORRECTED,
          metadata: expect.objectContaining({
            correctionRequestId: 'correction-1',
            teacherId: 'teacher-1',
            teacherName: 'Alex Martin',
            score: 14,
            comment: 'Bon travail, attention aux signes.',
          }),
        }),
      );
    });

    it('does not acknowledge (throws) when the teacher name cannot be resolved', async () => {
      profileServiceClient.resolveDisplayNames.mockResolvedValue(new Map());

      await expect(
        processor.process({
          eventId: 'evt-26',
          eventName: 'EvaluationCorrected',
          payload: JSON.stringify({
            correctionRequestId: 'correction-1',
            attemptId: 'attempt-1',
            evaluationId: 'evaluation-1',
            studentId: 'student-1',
            teacherId: 'teacher-1',
            score: 10,
            comment: null,
          }),
        }),
      ).rejects.toThrow(/Unresolved display name/);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('ContactRequestCreated', () => {
    it('notifies the target (never the requester) with both resolved names', async () => {
      displayNames({
        'requester-1': { firstName: 'Camille', lastName: 'Durand' },
        'target-1': { firstName: 'Alex', lastName: 'Martin' },
      });

      await processor.process({
        eventId: 'evt-30',
        eventName: 'ContactRequestCreated',
        payload: JSON.stringify({ requestId: 'request-1', requesterId: 'requester-1', targetId: 'target-1' }),
      });

      expect(txNotificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'target-1',
          type: NotificationType.CONTACT_REQUEST_RECEIVED,
          metadata: expect.objectContaining({
            requestId: 'request-1',
            requesterId: 'requester-1',
            requesterName: 'Camille Durand',
            targetId: 'target-1',
            targetName: 'Alex Martin',
          }),
        }),
      );
    });

    it('does not acknowledge (throws) when a name cannot be resolved', async () => {
      profileServiceClient.resolveDisplayNames.mockResolvedValue(new Map());

      await expect(
        processor.process({
          eventId: 'evt-31',
          eventName: 'ContactRequestCreated',
          payload: JSON.stringify({ requestId: 'request-1', requesterId: 'requester-1', targetId: 'target-1' }),
        }),
      ).rejects.toThrow(/Unresolved display name/);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('ContactRequestAccepted / ContactRequestDeclined', () => {
    it.each([
      ['ContactRequestAccepted', NotificationType.CONTACT_REQUEST_ACCEPTED],
      ['ContactRequestDeclined', NotificationType.CONTACT_REQUEST_DECLINED],
    ])('notifies the original requester (never the target) for %s', async (eventName, type) => {
      displayNames({
        'requester-1': { firstName: 'Camille', lastName: 'Durand' },
        'target-1': { firstName: 'Alex', lastName: 'Martin' },
      });

      await processor.process({
        eventId: 'evt-32',
        eventName,
        payload: JSON.stringify({ requestId: 'request-1', requesterId: 'requester-1', targetId: 'target-1' }),
      });

      expect(txNotificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'requester-1',
          type,
          metadata: expect.objectContaining({
            requestId: 'request-1',
            requesterId: 'requester-1',
            requesterName: 'Camille Durand',
            targetId: 'target-1',
            targetName: 'Alex Martin',
          }),
        }),
      );
    });
  });

  describe('events with no notification', () => {
    it.each(['TeacherRequestClosed', 'TeacherRequestDeleted'])('marks %s as processed without creating a notification', async (eventName) => {
      await processor.process({ eventId: 'evt-8', eventName, payload: '{}' });

      expect(processedEventRepository.save).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'evt-8', eventName }));
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('unrecognized event names', () => {
    it('marks the event as processed without creating a notification', async () => {
      await processor.process({ eventId: 'evt-9', eventName: 'SomeFutureEvent', payload: '{}' });

      expect(processedEventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'evt-9', eventName: 'SomeFutureEvent' }),
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });
});
