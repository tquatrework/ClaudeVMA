import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from '../../src/dashboard/dashboard.service';
import { DashboardPreference } from '../../src/dashboard/entities/dashboard-preference.entity';
import { DashboardWidgetState } from '../../src/dashboard/entities/dashboard-widget-state.entity';
import { NotificationSubscription } from '../../src/dashboard/entities/notification-subscription.entity';
import { NotificationService } from '../../src/notification/notification.service';
import { Actor } from '../../src/common/types/actor';

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

const buildActor = (overrides: Partial<Actor> = {}): Actor => ({
  id: 'user-uuid-001',
  role: 'eleve',
  ...overrides,
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
      const actor = buildActor();
      preferenceRepository.findOne.mockResolvedValue(null);
      notificationService.findRecentByUser.mockResolvedValue([]);

      const result = await dashboardService.getMyDashboard(actor);

      expect(result.userId).toBe(actor.id);
      expect(result.role).toBe(actor.role);
      expect(Array.isArray(result.widgets)).toBe(true);
      expect(Array.isArray(result.notifications)).toBe(true);
      expect(result.generatedAt).toBeDefined();
    });

    it('includes calendar widget for eleve role by default', async () => {
      const actor = buildActor();
      preferenceRepository.findOne.mockResolvedValue(null);
      notificationService.findRecentByUser.mockResolvedValue([]);

      const result = await dashboardService.getMyDashboard(actor);

      const widgetTypes = result.widgets.map((widget) => widget.type);
      expect(widgetTypes).toContain('calendar');
    });

    it('includes payment_alerts widget for responsable_pedagogique role', async () => {
      const actor = buildActor({ id: 'rp-uuid-001', role: 'responsable_pedagogique' });
      preferenceRepository.findOne.mockResolvedValue(null);
      notificationService.findRecentByUser.mockResolvedValue([]);

      const result = await dashboardService.getMyDashboard(actor);

      const widgetTypes = result.widgets.map((widget) => widget.type);
      expect(widgetTypes).toContain('payment_alerts');
      expect(widgetTypes).toContain('pending_teacher_requests');
    });

    it('does not expose personal_notebook widget for parent_financeur role', async () => {
      const actor = buildActor({ id: 'parent-uuid-001', role: 'parent_financeur' });
      preferenceRepository.findOne.mockResolvedValue(null);
      notificationService.findRecentByUser.mockResolvedValue([]);

      const result = await dashboardService.getMyDashboard(actor);

      const widgetTypes = result.widgets.map((widget) => widget.type);
      expect(widgetTypes).not.toContain('personal_notebook');
    });

    it('uses saved preference widget config when it exists', async () => {
      const actor = buildActor();
      const savedPreference = {
        userId: actor.id,
        role: actor.role,
        widgetConfig: { showCalendar: false, showNotifications: true },
      };
      preferenceRepository.findOne.mockResolvedValue(savedPreference);
      notificationService.findRecentByUser.mockResolvedValue([]);

      const result = await dashboardService.getMyDashboard(actor);

      const widgetTypes = result.widgets.map((widget) => widget.type);
      expect(widgetTypes).not.toContain('calendar');
    });

    it('includes linked_students widget with excludes_personal_notebook note for parent_financeur', async () => {
      const actor = buildActor({ id: 'parent-uuid-001', role: 'parent_financeur' });
      preferenceRepository.findOne.mockResolvedValue(null);
      notificationService.findRecentByUser.mockResolvedValue([]);

      const result = await dashboardService.getMyDashboard(actor);

      const linkedStudentsWidget = result.widgets.find((widget) => widget.type === 'linked_students');
      expect(linkedStudentsWidget).toBeDefined();
      expect(linkedStudentsWidget?.note).toBe('excludes_personal_notebook');
    });

    it('includes incident and system alert widgets for technicien_informatique', async () => {
      const actor = buildActor({ id: 'ti-uuid-001', role: 'technicien_informatique' });
      preferenceRepository.findOne.mockResolvedValue(null);
      notificationService.findRecentByUser.mockResolvedValue([]);

      const result = await dashboardService.getMyDashboard(actor);

      const widgetTypes = result.widgets.map((widget) => widget.type);
      expect(widgetTypes).toContain('incidents');
      expect(widgetTypes).toContain('system_alerts');
    });

    it('includes financial and legal alert widgets for administrateur_financier', async () => {
      const actor = buildActor({ id: 'af-uuid-001', role: 'administrateur_financier' });
      preferenceRepository.findOne.mockResolvedValue(null);
      notificationService.findRecentByUser.mockResolvedValue([]);

      const result = await dashboardService.getMyDashboard(actor);

      const widgetTypes = result.widgets.map((widget) => widget.type);
      expect(widgetTypes).toContain('financial_alerts');
      expect(widgetTypes).toContain('legal_alerts');
    });

    it('calls findRecentByUser with the actor and a limit of 10', async () => {
      const actor = buildActor();
      preferenceRepository.findOne.mockResolvedValue(null);
      notificationService.findRecentByUser.mockResolvedValue([]);

      await dashboardService.getMyDashboard(actor);

      expect(notificationService.findRecentByUser).toHaveBeenCalledWith(actor, 10);
    });
  });

  describe('updatePreferences', () => {
    it('creates new preference when none exists', async () => {
      const actor = buildActor();
      const dto = { widgetConfig: { showCalendar: false } };
      const createdPreference = { userId: actor.id, role: actor.role, widgetConfig: dto.widgetConfig };

      preferenceRepository.findOne.mockResolvedValue(null);
      preferenceRepository.create.mockReturnValue(createdPreference);
      preferenceRepository.save.mockResolvedValue({ id: 'pref-001', ...createdPreference });

      const result = await dashboardService.updatePreferences(actor, dto);

      expect(preferenceRepository.create).toHaveBeenCalledWith({
        userId: actor.id,
        role: actor.role,
        widgetConfig: dto.widgetConfig,
      });
      expect(preferenceRepository.save).toHaveBeenCalledWith(createdPreference);
      expect(result.userId).toBe(actor.id);
    });

    it('updates existing preference widget config', async () => {
      const actor = buildActor();
      const existingPreference = { id: 'pref-001', userId: actor.id, role: actor.role, widgetConfig: { showCalendar: true } };
      const dto = { widgetConfig: { showCalendar: false, compactView: true } };

      preferenceRepository.findOne.mockResolvedValue(existingPreference);
      preferenceRepository.save.mockResolvedValue({ ...existingPreference, widgetConfig: dto.widgetConfig });

      const result = await dashboardService.updatePreferences(actor, dto);

      expect(preferenceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ widgetConfig: dto.widgetConfig }),
      );
      expect(result.widgetConfig).toEqual(dto.widgetConfig);
    });
  });

  describe('initializeDashboard', () => {
    it('creates dashboard preference for a new user', async () => {
      const targetUser = buildActor({ id: 'user-uuid-new', role: 'eleve' });
      const createdPreference = { id: 'pref-001', userId: targetUser.id, role: targetUser.role, widgetConfig: {} };

      preferenceRepository.findOne.mockResolvedValue(null);
      preferenceRepository.create.mockReturnValue(createdPreference);
      preferenceRepository.save.mockResolvedValue(createdPreference);

      const result = await dashboardService.initializeDashboard(targetUser);

      expect(preferenceRepository.findOne).toHaveBeenCalledWith({ where: { userId: targetUser.id } });
      expect(preferenceRepository.create).toHaveBeenCalled();
      expect(preferenceRepository.save).toHaveBeenCalled();
      expect(result).toEqual(createdPreference);
    });

    it('is idempotent — returns existing preference without creating a new one', async () => {
      const targetUser = buildActor({ id: 'user-uuid-existing', role: 'eleve' });
      const existingPreference = { id: 'pref-existing', userId: targetUser.id, role: targetUser.role, widgetConfig: {} };

      preferenceRepository.findOne.mockResolvedValue(existingPreference);

      const result = await dashboardService.initializeDashboard(targetUser);

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
