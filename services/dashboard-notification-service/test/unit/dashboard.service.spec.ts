import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from '../../src/dashboard/dashboard.service';
import { DashboardPreference } from '../../src/dashboard/entities/dashboard-preference.entity';
import { DashboardWidgetState } from '../../src/dashboard/entities/dashboard-widget-state.entity';
import { NotificationSubscription } from '../../src/dashboard/entities/notification-subscription.entity';
import { NotificationService } from '../../src/notification/notification.service';

const mockPreferenceRepository = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
});

const mockWidgetStateRepository = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockSubscriptionRepository = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockNotificationService = () => ({
  findRecentByUser: jest.fn(),
  create: jest.fn(),
});

describe('DashboardService', () => {
  let dashboardService: DashboardService;
  let preferenceRepository: ReturnType<typeof mockPreferenceRepository>;
  let notificationService: ReturnType<typeof mockNotificationService>;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(DashboardPreference), useFactory: mockPreferenceRepository },
        { provide: getRepositoryToken(DashboardWidgetState), useFactory: mockWidgetStateRepository },
        { provide: getRepositoryToken(NotificationSubscription), useFactory: mockSubscriptionRepository },
        { provide: NotificationService, useFactory: mockNotificationService },
      ],
    }).compile();

    dashboardService = moduleRef.get<DashboardService>(DashboardService);
    preferenceRepository = moduleRef.get(getRepositoryToken(DashboardPreference));
    notificationService = moduleRef.get(NotificationService);
  });

  describe('getMyDashboard', () => {
    it('returns dashboard with default eleve widgets when no preference exists', async () => {
      preferenceRepository.findOne.mockResolvedValue(null);
      notificationService.findRecentByUser.mockResolvedValue([]);

      const result = await dashboardService.getMyDashboard('user-uuid-001', 'eleve');

      expect(result.userId).toBe('user-uuid-001');
      expect(result.role).toBe('eleve');
      expect(Array.isArray(result.widgets)).toBe(true);
      expect(Array.isArray(result.notifications)).toBe(true);
      expect(result.generatedAt).toBeDefined();
    });

    it('includes calendar widget for eleve role by default', async () => {
      preferenceRepository.findOne.mockResolvedValue(null);
      notificationService.findRecentByUser.mockResolvedValue([]);

      const result = await dashboardService.getMyDashboard('user-uuid-001', 'eleve');

      const widgetTypes = result.widgets.map((widget: Record<string, unknown>) => widget.type);
      expect(widgetTypes).toContain('calendar');
    });

    it('includes payment_alerts widget for responsable_pedagogique role', async () => {
      preferenceRepository.findOne.mockResolvedValue(null);
      notificationService.findRecentByUser.mockResolvedValue([]);

      const result = await dashboardService.getMyDashboard('rp-uuid-001', 'responsable_pedagogique');

      const widgetTypes = result.widgets.map((widget: Record<string, unknown>) => widget.type);
      expect(widgetTypes).toContain('payment_alerts');
      expect(widgetTypes).toContain('pending_teacher_requests');
    });

    it('does not expose personal_notebook widget for parent_financeur role', async () => {
      preferenceRepository.findOne.mockResolvedValue(null);
      notificationService.findRecentByUser.mockResolvedValue([]);

      const result = await dashboardService.getMyDashboard('parent-uuid-001', 'parent_financeur');

      const widgetTypes = result.widgets.map((widget: Record<string, unknown>) => widget.type);
      expect(widgetTypes).not.toContain('personal_notebook');
    });

    it('uses saved preference widget config when it exists', async () => {
      const savedPreference = {
        userId: 'user-uuid-001',
        role: 'eleve',
        widgetConfig: { showCalendar: false, showNotifications: true },
      };
      preferenceRepository.findOne.mockResolvedValue(savedPreference);
      notificationService.findRecentByUser.mockResolvedValue([]);

      const result = await dashboardService.getMyDashboard('user-uuid-001', 'eleve');

      const widgetTypes = result.widgets.map((widget: Record<string, unknown>) => widget.type);
      expect(widgetTypes).not.toContain('calendar');
    });

    it('includes linked_students widget with excludes_personal_notebook note for parent_financeur', async () => {
      preferenceRepository.findOne.mockResolvedValue(null);
      notificationService.findRecentByUser.mockResolvedValue([]);

      const result = await dashboardService.getMyDashboard('parent-uuid-001', 'parent_financeur');

      const linkedStudentsWidget = result.widgets.find(
        (widget: Record<string, unknown>) => widget.type === 'linked_students',
      );
      expect(linkedStudentsWidget).toBeDefined();
      expect(linkedStudentsWidget?.note).toBe('excludes_personal_notebook');
    });

    it('includes incident and system alert widgets for technicien_informatique', async () => {
      preferenceRepository.findOne.mockResolvedValue(null);
      notificationService.findRecentByUser.mockResolvedValue([]);

      const result = await dashboardService.getMyDashboard('ti-uuid-001', 'technicien_informatique');

      const widgetTypes = result.widgets.map((widget: Record<string, unknown>) => widget.type);
      expect(widgetTypes).toContain('incidents');
      expect(widgetTypes).toContain('system_alerts');
    });

    it('includes financial and legal alert widgets for administrateur_financier', async () => {
      preferenceRepository.findOne.mockResolvedValue(null);
      notificationService.findRecentByUser.mockResolvedValue([]);

      const result = await dashboardService.getMyDashboard('af-uuid-001', 'administrateur_financier');

      const widgetTypes = result.widgets.map((widget: Record<string, unknown>) => widget.type);
      expect(widgetTypes).toContain('financial_alerts');
      expect(widgetTypes).toContain('legal_alerts');
    });

    it('calls findRecentByUser with limit of 10', async () => {
      preferenceRepository.findOne.mockResolvedValue(null);
      notificationService.findRecentByUser.mockResolvedValue([]);

      await dashboardService.getMyDashboard('user-uuid-001', 'eleve');

      expect(notificationService.findRecentByUser).toHaveBeenCalledWith('user-uuid-001', 10);
    });
  });

  describe('updatePreferences', () => {
    it('creates new preference when none exists', async () => {
      const userId = 'user-uuid-001';
      const role = 'eleve';
      const dto = { widgetConfig: { showCalendar: false } };
      const createdPreference = { userId, role, widgetConfig: dto.widgetConfig };

      preferenceRepository.findOne.mockResolvedValue(null);
      preferenceRepository.create.mockReturnValue(createdPreference);
      preferenceRepository.save.mockResolvedValue({ id: 'pref-001', ...createdPreference });

      const result = await dashboardService.updatePreferences(userId, role, dto);

      expect(preferenceRepository.create).toHaveBeenCalledWith({ userId, role, widgetConfig: dto.widgetConfig });
      expect(preferenceRepository.save).toHaveBeenCalledWith(createdPreference);
      expect(result.userId).toBe(userId);
    });

    it('updates existing preference widget config', async () => {
      const userId = 'user-uuid-001';
      const existingPreference = { id: 'pref-001', userId, role: 'eleve', widgetConfig: { showCalendar: true } };
      const dto = { widgetConfig: { showCalendar: false, compactView: true } };

      preferenceRepository.findOne.mockResolvedValue(existingPreference);
      preferenceRepository.save.mockResolvedValue({ ...existingPreference, widgetConfig: dto.widgetConfig });

      const result = await dashboardService.updatePreferences(userId, 'eleve', dto);

      expect(preferenceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ widgetConfig: dto.widgetConfig }),
      );
    });
  });

  describe('initializeDashboard', () => {
    it('creates dashboard preference for a new user', async () => {
      const userId = 'user-uuid-new';
      const role = 'eleve';
      const createdPreference = { id: 'pref-001', userId, role, widgetConfig: {} };

      preferenceRepository.findOne.mockResolvedValue(null);
      preferenceRepository.create.mockReturnValue(createdPreference);
      preferenceRepository.save.mockResolvedValue(createdPreference);

      const result = await dashboardService.initializeDashboard(userId, role);

      expect(preferenceRepository.findOne).toHaveBeenCalledWith({ where: { userId } });
      expect(preferenceRepository.create).toHaveBeenCalled();
      expect(preferenceRepository.save).toHaveBeenCalled();
      expect(result).toEqual(createdPreference);
    });

    it('is idempotent — returns existing preference without creating a new one', async () => {
      const userId = 'user-uuid-existing';
      const existingPreference = { id: 'pref-existing', userId, role: 'eleve', widgetConfig: {} };

      preferenceRepository.findOne.mockResolvedValue(existingPreference);

      const result = await dashboardService.initializeDashboard(userId, 'eleve');

      expect(preferenceRepository.create).not.toHaveBeenCalled();
      expect(preferenceRepository.save).not.toHaveBeenCalled();
      expect(result).toEqual(existingPreference);
    });
  });

  describe('getPreference', () => {
    it('returns preference when found', async () => {
      const userId = 'user-uuid-001';
      const preference = { id: 'pref-001', userId, role: 'eleve', widgetConfig: {} };
      preferenceRepository.findOne.mockResolvedValue(preference);

      const result = await dashboardService.getPreference(userId);

      expect(preferenceRepository.findOne).toHaveBeenCalledWith({ where: { userId } });
      expect(result).toEqual(preference);
    });

    it('returns null when preference does not exist', async () => {
      preferenceRepository.findOne.mockResolvedValue(null);

      const result = await dashboardService.getPreference('nonexistent-user');

      expect(result).toBeNull();
    });
  });
});
