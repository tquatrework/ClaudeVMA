/**
 * Unit tests — EmptyEntryReminderService (point 5, complément)
 *
 * Rappel quotidien au formateur pour une entrée auto-créée restée vide plus de
 * 24h après la séance. Garantie : un seul rappel par entrée (remindedAt posé
 * après envoi réussi), échec d'envoi laissé rejouable (remindedAt non posé).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmptyEntryReminderService } from '../../../src/pedagogical-log/empty-entry-reminder.service';
import { PedagogicalLog } from '../../../src/pedagogical-log/entities/pedagogical-log.entity';
import { DashboardNotificationClient } from '../../../src/common/clients/dashboard-notification.client';

describe('EmptyEntryReminderService', () => {
  let service: EmptyEntryReminderService;
  let mockRepository: { find: jest.Mock; save: jest.Mock };
  let mockNotifier: { notifyUser: jest.Mock };

  beforeEach(async () => {
    mockRepository = { find: jest.fn(), save: jest.fn() };
    mockNotifier = { notifyUser: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EmptyEntryReminderService,
        { provide: getRepositoryToken(PedagogicalLog), useValue: mockRepository },
        { provide: DashboardNotificationClient, useValue: mockNotifier },
      ],
    }).compile();

    service = moduleRef.get<EmptyEntryReminderService>(EmptyEntryReminderService);
  });

  afterEach(() => jest.clearAllMocks());

  it('notifie le formateur pour chaque entrée éligible puis marque remindedAt', async () => {
    const entry = {
      id: 'log-1',
      authorId: 'teacher-1',
      studentId: 'student-1',
      activityId: 'activity-1',
      date: '2026-08-10',
      remindedAt: null,
    } as PedagogicalLog;

    mockRepository.find.mockResolvedValue([entry]);
    mockNotifier.notifyUser.mockResolvedValue(undefined);
    mockRepository.save.mockResolvedValue(entry);

    await service.remindUnfilledAutoEntries();

    expect(mockRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ autoCreated: true }),
      }),
    );
    expect(mockNotifier.notifyUser).toHaveBeenCalledWith(
      'teacher-1',
      'pedagogical_log_entry_empty',
      expect.any(String),
      expect.stringContaining('2026-08-10'),
      expect.objectContaining({ pedagogicalLogId: 'log-1', studentId: 'student-1' }),
    );
    expect(mockRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'log-1', remindedAt: expect.any(Date) }),
    );
  });

  it('[CRITIQUE] échec de notification → remindedAt non posé (rejouable au prochain passage)', async () => {
    const entry = {
      id: 'log-2',
      authorId: 'teacher-2',
      studentId: 'student-2',
      activityId: 'activity-2',
      date: '2026-08-10',
      remindedAt: null,
    } as PedagogicalLog;

    mockRepository.find.mockResolvedValue([entry]);
    mockNotifier.notifyUser.mockRejectedValue(new Error('dashboard-notification-service down'));

    await service.remindUnfilledAutoEntries();

    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('aucune entrée éligible → aucun appel de notification', async () => {
    mockRepository.find.mockResolvedValue([]);

    await service.remindUnfilledAutoEntries();

    expect(mockNotifier.notifyUser).not.toHaveBeenCalled();
    expect(mockRepository.save).not.toHaveBeenCalled();
  });
});
