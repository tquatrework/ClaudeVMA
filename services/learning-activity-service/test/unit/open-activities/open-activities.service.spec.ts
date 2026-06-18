/**
 * Unit tests — OpenActivitiesService
 *
 * Couvre :
 *   - create()         → seuls RP/AP/TI/AF peuvent publier
 *   - findAll()        → formateurs/AP ne voient que les activités OPEN
 *   - findOne()        → accès selon rôle, 404 si absent
 *   - accept()         → seuls formateurs/AP, quota et double-acceptation
 *   - update()         → seuls RP/TI/AF, 404 si absent
 *   - findAllActivities() → réservé RP/TI/AF
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { OpenActivitiesService } from '../../../src/open-activities/open-activities.service';
import { OpenActivity } from '../../../src/open-activities/entities/open-activity.entity';
import { ActivityAcceptance } from '../../../src/open-activities/entities/activity-acceptance.entity';
import { ActivityStatus } from '../../../src/common/enums/activity-status.enum';
import { ActivitySource } from '../../../src/common/enums/activity-source.enum';
import { RewardType } from '../../../src/common/enums/reward-type.enum';

const RP_ID        = 'rp-0000-4000-a000-aaaaaaaaaaaa';
const FORMATEUR_ID = 'fo-0000-4000-b000-bbbbbbbbbbbb';
const ELEVE_ID     = 'el-0000-4000-c000-cccccccccccc';
const AP_ID        = 'ap-0000-4000-d000-dddddddddddd';
const TI_ID        = 'ti-0000-4000-e000-eeeeeeeeeeee';
const AF_ID        = 'af-0000-4000-f000-ffffffffffff';
const ACTIVITY_ID  = 'ac-0000-4000-0000-000000000000';

function buildMockRepo() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
  };
}

function buildSampleActivity(overrides: Partial<OpenActivity> = {}): OpenActivity {
  return {
    id: ACTIVITY_ID,
    title: 'Corriger exercice algèbre',
    description: 'Exercice niveau seconde',
    source: ActivitySource.RP_PRODUCTION,
    sourceReferenceId: null,
    publishedById: RP_ID,
    publishedByRole: 'responsable_pedagogique',
    status: ActivityStatus.OPEN,
    rewardType: RewardType.PEDAGOGICAL_POINTS,
    rewardAmount: 10,
    maxAcceptances: 1,
    currentAcceptances: 0,
    deadline: null,
    acceptances: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('OpenActivitiesService', () => {
  let openActivitiesService: OpenActivitiesService;
  let activityRepo: ReturnType<typeof buildMockRepo>;
  let acceptanceRepo: ReturnType<typeof buildMockRepo>;

  beforeEach(async () => {
    activityRepo = buildMockRepo();
    acceptanceRepo = buildMockRepo();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        OpenActivitiesService,
        { provide: getRepositoryToken(OpenActivity), useValue: activityRepo },
        { provide: getRepositoryToken(ActivityAcceptance), useValue: acceptanceRepo },
      ],
    }).compile();

    openActivitiesService = moduleRef.get<OpenActivitiesService>(OpenActivitiesService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────────────────────────────────
  // create()
  // ─────────────────────────────────────────────────────────────────────────

  describe('create()', () => {
    const validDto = {
      title: 'Corriger exercice algèbre',
      description: 'Exercice niveau seconde',
    };

    it('le RP peut publier une activité', async () => {
      const savedActivity = buildSampleActivity();
      activityRepo.create.mockReturnValue(savedActivity);
      activityRepo.save.mockResolvedValue(savedActivity);

      const result = await openActivitiesService.create(validDto, RP_ID, 'responsable_pedagogique');

      expect(activityRepo.create).toHaveBeenCalled();
      expect(activityRepo.save).toHaveBeenCalled();
      expect(result.publishedById).toBe(RP_ID);
    });

    it('l\'AP peut publier une activité', async () => {
      const savedActivity = buildSampleActivity({ publishedById: AP_ID, publishedByRole: 'animateur_pedagogique' });
      activityRepo.create.mockReturnValue(savedActivity);
      activityRepo.save.mockResolvedValue(savedActivity);

      const result = await openActivitiesService.create(validDto, AP_ID, 'animateur_pedagogique');
      expect(result).toBeDefined();
    });

    it('le TI peut publier une activité', async () => {
      const savedActivity = buildSampleActivity({ publishedById: TI_ID, publishedByRole: 'technicien_informatique' });
      activityRepo.create.mockReturnValue(savedActivity);
      activityRepo.save.mockResolvedValue(savedActivity);

      const result = await openActivitiesService.create(validDto, TI_ID, 'technicien_informatique');
      expect(result).toBeDefined();
    });

    it('l\'AF peut publier une activité', async () => {
      const savedActivity = buildSampleActivity({ publishedById: AF_ID, publishedByRole: 'administrateur_financier' });
      activityRepo.create.mockReturnValue(savedActivity);
      activityRepo.save.mockResolvedValue(savedActivity);

      const result = await openActivitiesService.create(validDto, AF_ID, 'administrateur_financier');
      expect(result).toBeDefined();
    });

    it('lève ForbiddenException si un formateur tente de publier', async () => {
      await expect(
        openActivitiesService.create(validDto, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève ForbiddenException si un élève tente de publier', async () => {
      await expect(
        openActivitiesService.create(validDto, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('définit maxAcceptances à 1 par défaut', async () => {
      const savedActivity = buildSampleActivity({ maxAcceptances: 1 });
      activityRepo.create.mockReturnValue(savedActivity);
      activityRepo.save.mockResolvedValue(savedActivity);

      await openActivitiesService.create(validDto, RP_ID, 'responsable_pedagogique');

      expect(activityRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ maxAcceptances: 1 }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findAll()
  // ─────────────────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('un formateur ne voit que les activités OPEN', async () => {
      activityRepo.findAndCount.mockResolvedValue([[], 0]);

      await openActivitiesService.findAll({}, 'formateur');

      expect(activityRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: ActivityStatus.OPEN }),
        }),
      );
    });

    it('un AP ne voit que les activités OPEN', async () => {
      activityRepo.findAndCount.mockResolvedValue([[], 0]);

      await openActivitiesService.findAll({}, 'animateur_pedagogique');

      expect(activityRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: ActivityStatus.OPEN }),
        }),
      );
    });

    it('un RP peut voir toutes les activités sans filtre de statut', async () => {
      activityRepo.findAndCount.mockResolvedValue([[buildSampleActivity()], 1]);

      const result = await openActivitiesService.findAll({}, 'responsable_pedagogique');

      const callArg = activityRepo.findAndCount.mock.calls[0][0];
      expect(callArg.where.status).toBeUndefined();
      expect(result.total).toBe(1);
    });

    it('lève ForbiddenException si un élève accède à la liste', async () => {
      await expect(
        openActivitiesService.findAll({}, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('retourne les données paginées', async () => {
      const activities = [buildSampleActivity(), buildSampleActivity({ id: 'ac-other' })];
      activityRepo.findAndCount.mockResolvedValue([activities, 2]);

      const result = await openActivitiesService.findAll({ page: 1, limit: 20 }, 'responsable_pedagogique');

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findOne()
  // ─────────────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('retourne l\'activité si elle existe', async () => {
      activityRepo.findOne.mockResolvedValue(buildSampleActivity());

      const result = await openActivitiesService.findOne(ACTIVITY_ID, 'formateur');

      expect(result.id).toBe(ACTIVITY_ID);
    });

    it('lève NotFoundException si l\'activité est introuvable', async () => {
      activityRepo.findOne.mockResolvedValue(null);

      await expect(
        openActivitiesService.findOne(ACTIVITY_ID, 'formateur'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lève ForbiddenException si un élève accède au détail', async () => {
      await expect(
        openActivitiesService.findOne(ACTIVITY_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // accept()
  // ─────────────────────────────────────────────────────────────────────────

  describe('accept()', () => {
    it('un formateur peut accepter une activité OPEN', async () => {
      const activity = buildSampleActivity({ currentAcceptances: 0, maxAcceptances: 2 });
      activityRepo.findOne.mockResolvedValue(activity);
      acceptanceRepo.findOne.mockResolvedValue(null);
      const savedAcceptance = {
        id: 'acc-0000',
        openActivityId: ACTIVITY_ID,
        teacherId: FORMATEUR_ID,
        calendarEventId: null,
        acceptedAt: new Date(),
      };
      acceptanceRepo.create.mockReturnValue(savedAcceptance);
      acceptanceRepo.save.mockResolvedValue(savedAcceptance);
      activityRepo.save.mockResolvedValue(activity);

      const result = await openActivitiesService.accept(ACTIVITY_ID, {}, FORMATEUR_ID, 'formateur');

      expect(result.teacherId).toBe(FORMATEUR_ID);
    });

    it('un AP peut accepter une activité OPEN', async () => {
      const activity = buildSampleActivity({ currentAcceptances: 0, maxAcceptances: 2 });
      activityRepo.findOne.mockResolvedValue(activity);
      acceptanceRepo.findOne.mockResolvedValue(null);
      const savedAcceptance = { id: 'acc-ap', openActivityId: ACTIVITY_ID, teacherId: AP_ID, calendarEventId: null, acceptedAt: new Date() };
      acceptanceRepo.create.mockReturnValue(savedAcceptance);
      acceptanceRepo.save.mockResolvedValue(savedAcceptance);
      activityRepo.save.mockResolvedValue(activity);

      const result = await openActivitiesService.accept(ACTIVITY_ID, {}, AP_ID, 'animateur_pedagogique');
      expect(result).toBeDefined();
    });

    it('ferme l\'activité quand le quota est atteint', async () => {
      const activity = buildSampleActivity({ currentAcceptances: 0, maxAcceptances: 1 });
      activityRepo.findOne.mockResolvedValue(activity);
      acceptanceRepo.findOne.mockResolvedValue(null);
      const savedAcceptance = { id: 'acc-0000', openActivityId: ACTIVITY_ID, teacherId: FORMATEUR_ID, calendarEventId: null, acceptedAt: new Date() };
      acceptanceRepo.create.mockReturnValue(savedAcceptance);
      acceptanceRepo.save.mockResolvedValue(savedAcceptance);
      activityRepo.save.mockResolvedValue({ ...activity, status: ActivityStatus.CLOSED });

      await openActivitiesService.accept(ACTIVITY_ID, {}, FORMATEUR_ID, 'formateur');

      expect(activityRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ActivityStatus.CLOSED }),
      );
    });

    it('lève BadRequestException si l\'activité est déjà fermée', async () => {
      activityRepo.findOne.mockResolvedValue(buildSampleActivity({ status: ActivityStatus.CLOSED }));

      await expect(
        openActivitiesService.accept(ACTIVITY_ID, {}, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si le formateur a déjà accepté cette activité', async () => {
      activityRepo.findOne.mockResolvedValue(buildSampleActivity());
      acceptanceRepo.findOne.mockResolvedValue({ id: 'acc-existing', teacherId: FORMATEUR_ID });

      await expect(
        openActivitiesService.accept(ACTIVITY_ID, {}, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève ForbiddenException si un RP tente d\'accepter', async () => {
      await expect(
        openActivitiesService.accept(ACTIVITY_ID, {}, RP_ID, 'responsable_pedagogique'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève ForbiddenException si un élève tente d\'accepter', async () => {
      await expect(
        openActivitiesService.accept(ACTIVITY_ID, {}, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si l\'activité est introuvable', async () => {
      activityRepo.findOne.mockResolvedValue(null);

      await expect(
        openActivitiesService.accept(ACTIVITY_ID, {}, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // update()
  // ─────────────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('le RP peut modifier le statut d\'une activité', async () => {
      const activity = buildSampleActivity();
      activityRepo.findOne.mockResolvedValue(activity);
      activityRepo.save.mockResolvedValue({ ...activity, status: ActivityStatus.CANCELLED });

      const result = await openActivitiesService.update(
        ACTIVITY_ID,
        { status: ActivityStatus.CANCELLED },
        RP_ID,
        'responsable_pedagogique',
      );

      expect(activityRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ActivityStatus.CANCELLED }),
      );
    });

    it('le TI peut modifier la date limite', async () => {
      const activity = buildSampleActivity();
      activityRepo.findOne.mockResolvedValue(activity);
      const newDeadline = '2026-12-31T23:59:59Z';
      activityRepo.save.mockResolvedValue({ ...activity, deadline: new Date(newDeadline) });

      const result = await openActivitiesService.update(
        ACTIVITY_ID,
        { deadline: newDeadline },
        TI_ID,
        'technicien_informatique',
      );

      expect(activityRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ deadline: new Date(newDeadline) }),
      );
    });

    it('l\'AF peut modifier le quota', async () => {
      const activity = buildSampleActivity();
      activityRepo.findOne.mockResolvedValue(activity);
      activityRepo.save.mockResolvedValue({ ...activity, maxAcceptances: 5 });

      await openActivitiesService.update(
        ACTIVITY_ID,
        { maxAcceptances: 5 },
        AF_ID,
        'administrateur_financier',
      );

      expect(activityRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ maxAcceptances: 5 }),
      );
    });

    it('lève ForbiddenException si un formateur tente de modifier', async () => {
      await expect(
        openActivitiesService.update(ACTIVITY_ID, {}, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si l\'activité est introuvable', async () => {
      activityRepo.findOne.mockResolvedValue(null);

      await expect(
        openActivitiesService.update(ACTIVITY_ID, {}, RP_ID, 'responsable_pedagogique'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findAllActivities()
  // ─────────────────────────────────────────────────────────────────────────

  describe('findAllActivities()', () => {
    it('le RP peut voir la liste globale', async () => {
      activityRepo.findAndCount.mockResolvedValue([[buildSampleActivity()], 1]);

      const result = await openActivitiesService.findAllActivities({}, 'responsable_pedagogique');

      expect(result.total).toBe(1);
    });

    it('le TI peut voir la liste globale', async () => {
      activityRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await openActivitiesService.findAllActivities({}, 'technicien_informatique');

      expect(result).toBeDefined();
    });

    it('l\'AF peut voir la liste globale', async () => {
      activityRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await openActivitiesService.findAllActivities({}, 'administrateur_financier');

      expect(result).toBeDefined();
    });

    it('lève ForbiddenException si un formateur accède à la liste globale', async () => {
      await expect(
        openActivitiesService.findAllActivities({}, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève ForbiddenException si un élève accède à la liste globale', async () => {
      await expect(
        openActivitiesService.findAllActivities({}, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
