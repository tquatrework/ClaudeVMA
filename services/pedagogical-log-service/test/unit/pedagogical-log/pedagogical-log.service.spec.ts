/**
 * Unit tests — PedagogicalLogService
 *
 * Refonte du cahier de texte, 2026-08-20 :
 *   - point 1 : visibilité parent_formateur (remplace eleve_formateur)
 *   - point 2 : date / sessionSummary / homework (content réservé aux pages spéciales)
 *   - point 3 : écriture réservée au formateur titulaire de la relation
 *   - point 4 : studentId dérivé du chemin, jamais du corps
 *   - point 6 : tri par date décroissante + filtre from/to
 *
 * Cas critiques obligatoires (XML spec, conservés) :
 *   - Page spéciale hiddenFromStudent=true → invisible pour l'élève dans GET
 *   - Élève lit son cahier → ne voit que les pages autorisées
 *   - RP crée une page spéciale (mécanisme hors périmètre, inchangé)
 *   - Un formateur non-auteur ne peut pas modifier
 *
 * Nouveaux cas critiques (refonte 2026-08-20) :
 *   - Un RP ne peut plus créer/modifier une entrée normale → ForbiddenException
 *   - Un formateur non titulaire de la relation ne peut pas créer/modifier → ForbiddenException
 *   - profile-service injoignable → ServiceUnavailableException (503)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PedagogicalLogService } from '../../../src/pedagogical-log/pedagogical-log.service';
import { PedagogicalLog } from '../../../src/pedagogical-log/entities/pedagogical-log.entity';
import { ProfileRelationsClient } from '../../../src/common/clients/profile-relations.client';

const STUDENT_ID       = 'aaaaaaaa-0000-4000-a000-aaaaaaaaaaaa';
const FORMATEUR_ID     = 'bbbbbbbb-0000-4000-b000-bbbbbbbbbbbb';
const RP_ID            = 'cccccccc-0000-4000-c000-cccccccccccc';
const OTHER_FORMATEUR  = 'ffffffff-0000-4000-f000-ffffffffffff';
const LOG_ID           = 'eeeeeeee-0000-4000-e000-eeeeeeeeeeee';

function buildMockQueryBuilder(results: PedagogicalLog[]) {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(results),
  };
  return qb;
}

function buildMockRepository() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

function buildSampleLog(overrides: Partial<PedagogicalLog> = {}): PedagogicalLog {
  return {
    id: LOG_ID,
    studentId: STUDENT_ID,
    authorId: FORMATEUR_ID,
    authorRole: 'formateur',
    activityId: null,
    sessionId: null,
    content: null,
    date: '2026-08-20',
    sessionSummary: 'Cours sur les dérivées',
    homework: null,
    visibility: 'eleve_parent_formateur',
    isSpecialPage: false,
    hiddenFromStudent: false,
    linkedResources: null,
    skillsWorked: null,
    difficulty: null,
    rating: null,
    autoCreated: false,
    remindedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as PedagogicalLog;
}

describe('PedagogicalLogService', () => {
  let pedagogicalLogService: PedagogicalLogService;
  let mockRepository: ReturnType<typeof buildMockRepository>;
  let mockRelationsClient: { assertTeacherOfStudent: jest.Mock; getRelation: jest.Mock };

  beforeEach(async () => {
    mockRepository = buildMockRepository();
    mockRelationsClient = {
      assertTeacherOfStudent: jest.fn().mockResolvedValue(undefined),
      getRelation: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PedagogicalLogService,
        {
          provide: getRepositoryToken(PedagogicalLog),
          useValue: mockRepository,
        },
        {
          provide: ProfileRelationsClient,
          useValue: mockRelationsClient,
        },
      ],
    }).compile();

    pedagogicalLogService = moduleRef.get<PedagogicalLogService>(PedagogicalLogService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────────────────────────────────
  // create()
  // ─────────────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('un formateur titulaire de la relation peut créer une page → isSpecialPage=false par défaut', async () => {
      const dto = { sessionSummary: 'Cours sur les dérivées' };
      const savedLog = buildSampleLog();

      mockRepository.create.mockReturnValue(savedLog);
      mockRepository.save.mockResolvedValue(savedLog);

      const result = await pedagogicalLogService.create(STUDENT_ID, dto, FORMATEUR_ID, 'formateur');

      expect(mockRelationsClient.assertTeacherOfStudent).toHaveBeenCalledWith(FORMATEUR_ID, STUDENT_ID);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: STUDENT_ID,
          authorId: FORMATEUR_ID,
          authorRole: 'formateur',
          isSpecialPage: false,
          hiddenFromStudent: false,
          visibility: 'eleve_parent_formateur',
        }),
      );
      expect(result.isSpecialPage).toBe(false);
    });

    it('date / sessionSummary / homework sont tous optionnels — un objet vide est accepté', async () => {
      const savedLog = buildSampleLog({ date: null, sessionSummary: null, homework: null });
      mockRepository.create.mockReturnValue(savedLog);
      mockRepository.save.mockResolvedValue(savedLog);

      await pedagogicalLogService.create(STUDENT_ID, {}, FORMATEUR_ID, 'formateur');

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ date: undefined, sessionSummary: undefined, homework: undefined }),
      );
    });

    it('[CRITIQUE] un RP ne peut plus créer une entrée normale → ForbiddenException', async () => {
      await expect(
        pedagogicalLogService.create(STUDENT_ID, {}, RP_ID, 'responsable_pedagogique'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRelationsClient.assertTeacherOfStudent).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('[CRITIQUE] un élève ne peut pas créer une entrée → ForbiddenException', async () => {
      await expect(
        pedagogicalLogService.create(STUDENT_ID, {}, STUDENT_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('[CRITIQUE] un formateur non titulaire de la relation → ForbiddenException (via profile-service)', async () => {
      mockRelationsClient.assertTeacherOfStudent.mockRejectedValue(
        new ForbiddenException('Seul le formateur titulaire de la relation avec cet élève peut écrire dans son cahier de texte'),
      );

      await expect(
        pedagogicalLogService.create(STUDENT_ID, {}, OTHER_FORMATEUR, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('profile-service injoignable → ServiceUnavailableException (échec fermé)', async () => {
      mockRelationsClient.assertTeacherOfStudent.mockRejectedValue(
        new ServiceUnavailableException('profile-service is unreachable'),
      );

      await expect(
        pedagogicalLogService.create(STUDENT_ID, {}, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // createSpecialPage()
  // ─────────────────────────────────────────────────────────────────────────

  describe('createSpecialPage()', () => {
    it('[OK] RP crée une page spéciale avec hiddenFromStudent=true → isSpecialPage=true', async () => {
      const dto = { content: 'Communication parent confidentielle', hiddenFromStudent: true };
      const savedLog = buildSampleLog({
        authorId: RP_ID,
        authorRole: 'responsable_pedagogique',
        visibility: 'special',
        isSpecialPage: true,
        hiddenFromStudent: true,
        content: 'Communication parent confidentielle',
      });

      mockRepository.create.mockReturnValue(savedLog);
      mockRepository.save.mockResolvedValue(savedLog);

      const result = await pedagogicalLogService.createSpecialPage(
        STUDENT_ID,
        dto,
        RP_ID,
        'responsable_pedagogique',
      );

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: STUDENT_ID,
          visibility: 'special',
          isSpecialPage: true,
          hiddenFromStudent: true,
        }),
      );
      expect(result.isSpecialPage).toBe(true);
      expect(result.hiddenFromStudent).toBe(true);
    });

    it('[OK] RP crée une page spéciale visible à l\'élève (hiddenFromStudent=false)', async () => {
      const dto = { content: 'Note spéciale visible', hiddenFromStudent: false };
      const savedLog = buildSampleLog({
        authorId: RP_ID,
        authorRole: 'responsable_pedagogique',
        visibility: 'special',
        isSpecialPage: true,
        hiddenFromStudent: false,
      });

      mockRepository.create.mockReturnValue(savedLog);
      mockRepository.save.mockResolvedValue(savedLog);

      const result = await pedagogicalLogService.createSpecialPage(
        STUDENT_ID,
        dto,
        RP_ID,
        'responsable_pedagogique',
      );

      expect(result.hiddenFromStudent).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findByStudent()
  // ─────────────────────────────────────────────────────────────────────────

  describe('findByStudent()', () => {
    it('[CRITIQUE] page hiddenFromStudent=true → INVISIBLE pour l\'élève', async () => {
      const visibleLog = buildSampleLog({ id: 'log-visible', hiddenFromStudent: false });
      const hiddenLog = buildSampleLog({
        id: 'log-hidden',
        hiddenFromStudent: true,
        visibility: 'eleve_parent_formateur',
      });

      const qb = buildMockQueryBuilder([visibleLog, hiddenLog]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await pedagogicalLogService.findByStudent(STUDENT_ID, 'eleve');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('log-visible');
    });

    it('[CRITIQUE] élève ne voit plus la catégorie parent_formateur (correctif 2026-08-20)', async () => {
      const qb = buildMockQueryBuilder([]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      await pedagogicalLogService.findByStudent(STUDENT_ID, 'eleve');

      expect(qb.andWhere).toHaveBeenCalledWith(
        'entry.visibility IN (:...visibilities)',
        { visibilities: ['eleve_parent_formateur'] },
      );
    });

    it('[CRITIQUE] parent_financeur voit désormais parent_formateur (et non plus eleve_formateur)', async () => {
      const qb = buildMockQueryBuilder([]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      await pedagogicalLogService.findByStudent(STUDENT_ID, 'parent_financeur');

      expect(qb.andWhere).toHaveBeenCalledWith(
        'entry.visibility IN (:...visibilities)',
        { visibilities: ['eleve_parent_formateur', 'parent_formateur', 'special'] },
      );
    });

    it('le RP voit toutes les pages y compris hiddenFromStudent=true', async () => {
      const hiddenLog = buildSampleLog({ hiddenFromStudent: true, visibility: 'special' });
      const qb = buildMockQueryBuilder([hiddenLog]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await pedagogicalLogService.findByStudent(STUDENT_ID, 'responsable_pedagogique');

      expect(result).toHaveLength(1);
    });

    it('trie par date décroissante puis createdAt décroissant (plus récent en premier)', async () => {
      const qb = buildMockQueryBuilder([]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      await pedagogicalLogService.findByStudent(STUDENT_ID, 'formateur');

      expect(qb.orderBy).toHaveBeenCalledWith('entry.date', 'DESC', 'NULLS LAST');
      expect(qb.addOrderBy).toHaveBeenCalledWith('entry.createdAt', 'DESC');
    });

    it('from/to filtrent sur la date de séance quand fournis', async () => {
      const qb = buildMockQueryBuilder([]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      await pedagogicalLogService.findByStudent(STUDENT_ID, 'formateur', { from: '2026-08-01', to: '2026-08-31' });

      expect(qb.andWhere).toHaveBeenCalledWith('entry.date >= :from', { from: '2026-08-01' });
      expect(qb.andWhere).toHaveBeenCalledWith('entry.date <= :to', { to: '2026-08-31' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findOne()
  // ─────────────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('[CRITIQUE] page hiddenFromStudent=true → ForbiddenException si l\'appelant est élève', async () => {
      const hiddenLog = buildSampleLog({
        hiddenFromStudent: true,
        visibility: 'eleve_parent_formateur',
      });
      mockRepository.findOne.mockResolvedValue(hiddenLog);

      await expect(
        pedagogicalLogService.findOne(LOG_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('page visible → retournée à l\'élève', async () => {
      const visibleLog = buildSampleLog({ hiddenFromStudent: false });
      mockRepository.findOne.mockResolvedValue(visibleLog);

      const result = await pedagogicalLogService.findOne(LOG_ID, 'eleve');

      expect(result.id).toBe(LOG_ID);
    });

    it('log introuvable → NotFoundException', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        pedagogicalLogService.findOne(LOG_ID, 'formateur'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // update()
  // ─────────────────────────────────────────────────────────────────────────

  describe('update() — entrée normale (isSpecialPage=false)', () => {
    it('[OK] le formateur auteur, toujours titulaire de la relation, peut modifier', async () => {
      const log = buildSampleLog();
      const updatedLog = buildSampleLog({ sessionSummary: 'Contenu modifié' });

      mockRepository.findOne.mockResolvedValue(log);
      mockRepository.save.mockResolvedValue(updatedLog);

      const result = await pedagogicalLogService.update(
        LOG_ID,
        { sessionSummary: 'Contenu modifié' },
        FORMATEUR_ID,
        'formateur',
      );

      expect(mockRelationsClient.assertTeacherOfStudent).toHaveBeenCalledWith(FORMATEUR_ID, STUDENT_ID);
      expect(result.sessionSummary).toBe('Contenu modifié');
    });

    it('[CRITIQUE] un autre formateur (non auteur) ne peut pas modifier → ForbiddenException', async () => {
      const log = buildSampleLog();
      mockRepository.findOne.mockResolvedValue(log);

      await expect(
        pedagogicalLogService.update(LOG_ID, { sessionSummary: 'hack' }, OTHER_FORMATEUR, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRelationsClient.assertTeacherOfStudent).not.toHaveBeenCalled();
    });

    it('[CRITIQUE] le RP ne peut plus modifier une entrée normale → ForbiddenException (refonte 2026-08-20)', async () => {
      const log = buildSampleLog();
      mockRepository.findOne.mockResolvedValue(log);

      await expect(
        pedagogicalLogService.update(LOG_ID, { sessionSummary: 'Modifié par RP' }, RP_ID, 'responsable_pedagogique'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('[CRITIQUE] un élève ne peut pas modifier une entrée → ForbiddenException', async () => {
      const log = buildSampleLog();
      mockRepository.findOne.mockResolvedValue(log);

      await expect(
        pedagogicalLogService.update(LOG_ID, { sessionSummary: 'x' }, STUDENT_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('formateur auteur mais relation rompue entre-temps → ForbiddenException (vérifié à chaque action)', async () => {
      const log = buildSampleLog();
      mockRepository.findOne.mockResolvedValue(log);
      mockRelationsClient.assertTeacherOfStudent.mockRejectedValue(
        new ForbiddenException('relation rompue'),
      );

      await expect(
        pedagogicalLogService.update(LOG_ID, { sessionSummary: 'x' }, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('update() — page spéciale RP (isSpecialPage=true, mécanisme hors périmètre inchangé)', () => {
    it('[OK] l\'auteur RP peut modifier sa page spéciale, sans vérification de relation', async () => {
      const specialLog = buildSampleLog({
        isSpecialPage: true,
        authorId: RP_ID,
        authorRole: 'responsable_pedagogique',
        visibility: 'special',
      });
      const updatedLog = { ...specialLog, content: 'Modifié' };

      mockRepository.findOne.mockResolvedValue(specialLog);
      mockRepository.save.mockResolvedValue(updatedLog);

      const result = await pedagogicalLogService.update(
        LOG_ID,
        { content: 'Modifié' },
        RP_ID,
        'responsable_pedagogique',
      );

      expect(mockRelationsClient.assertTeacherOfStudent).not.toHaveBeenCalled();
      expect(result.content).toBe('Modifié');
    });

    it('[OK] un TI peut modifier n\'importe quelle page spéciale', async () => {
      const specialLog = buildSampleLog({ isSpecialPage: true, authorId: RP_ID, visibility: 'special' });
      mockRepository.findOne.mockResolvedValue(specialLog);
      mockRepository.save.mockResolvedValue(specialLog);

      await expect(
        pedagogicalLogService.update(LOG_ID, { content: 'x' }, 'ti-id', 'technicien_informatique'),
      ).resolves.toBeDefined();
    });

    it('un formateur non-auteur ne peut pas modifier une page spéciale', async () => {
      const specialLog = buildSampleLog({ isSpecialPage: true, authorId: RP_ID, visibility: 'special' });
      mockRepository.findOne.mockResolvedValue(specialLog);

      await expect(
        pedagogicalLogService.update(LOG_ID, { content: 'x' }, OTHER_FORMATEUR, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // remove()
  //
  // Correctif du 2026-08-20 (relecture du point 3) : DELETE suit désormais
  // exactement le même régime que update() — « les autres rôles lisent
  // uniquement » couvre toute écriture, DELETE inclus. Le RP a perdu le droit
  // de supprimer une entrée normale ; il conserve celui de supprimer une page
  // spéciale (mécanisme hors périmètre, inchangé).
  // ─────────────────────────────────────────────────────────────────────────

  describe('remove() — entrée normale (isSpecialPage=false)', () => {
    it('[OK] le formateur auteur, toujours titulaire de la relation, peut supprimer', async () => {
      const log = buildSampleLog();
      mockRepository.findOne.mockResolvedValue(log);
      mockRepository.remove.mockResolvedValue(log);

      await pedagogicalLogService.remove(LOG_ID, FORMATEUR_ID, 'formateur');

      expect(mockRelationsClient.assertTeacherOfStudent).toHaveBeenCalledWith(FORMATEUR_ID, STUDENT_ID);
      expect(mockRepository.remove).toHaveBeenCalledWith(log);
    });

    it('[CRITIQUE] un autre formateur (non auteur) ne peut pas supprimer → ForbiddenException', async () => {
      const log = buildSampleLog();
      mockRepository.findOne.mockResolvedValue(log);

      await expect(
        pedagogicalLogService.remove(LOG_ID, OTHER_FORMATEUR, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRelationsClient.assertTeacherOfStudent).not.toHaveBeenCalled();
      expect(mockRepository.remove).not.toHaveBeenCalled();
    });

    it('[CRITIQUE] le RP ne peut plus supprimer une entrée normale → ForbiddenException (correctif 2026-08-20)', async () => {
      const log = buildSampleLog();
      mockRepository.findOne.mockResolvedValue(log);

      await expect(
        pedagogicalLogService.remove(LOG_ID, RP_ID, 'responsable_pedagogique'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRepository.remove).not.toHaveBeenCalled();
    });

    it('[CRITIQUE] un élève ne peut pas supprimer une entrée → ForbiddenException', async () => {
      const log = buildSampleLog();
      mockRepository.findOne.mockResolvedValue(log);

      await expect(
        pedagogicalLogService.remove(LOG_ID, STUDENT_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRepository.remove).not.toHaveBeenCalled();
    });

    it('[CRITIQUE] un parent ne peut pas supprimer une entrée → ForbiddenException', async () => {
      const log = buildSampleLog();
      mockRepository.findOne.mockResolvedValue(log);

      await expect(
        pedagogicalLogService.remove(LOG_ID, 'parent-id', 'parent_financeur'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRepository.remove).not.toHaveBeenCalled();
    });

    it('formateur auteur mais relation rompue entre-temps → ForbiddenException (vérifié à chaque action)', async () => {
      const log = buildSampleLog();
      mockRepository.findOne.mockResolvedValue(log);
      mockRelationsClient.assertTeacherOfStudent.mockRejectedValue(
        new ForbiddenException('relation rompue'),
      );

      await expect(
        pedagogicalLogService.remove(LOG_ID, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRepository.remove).not.toHaveBeenCalled();
    });

    it('profile-service injoignable → ServiceUnavailableException (échec fermé)', async () => {
      const log = buildSampleLog();
      mockRepository.findOne.mockResolvedValue(log);
      mockRelationsClient.assertTeacherOfStudent.mockRejectedValue(
        new ServiceUnavailableException('profile-service is unreachable'),
      );

      await expect(
        pedagogicalLogService.remove(LOG_ID, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(mockRepository.remove).not.toHaveBeenCalled();
    });

    it('entrée introuvable → NotFoundException', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        pedagogicalLogService.remove(LOG_ID, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove() — page spéciale RP (isSpecialPage=true, mécanisme hors périmètre inchangé)', () => {
    it('[OK] l\'auteur RP peut supprimer sa page spéciale, sans vérification de relation', async () => {
      const specialLog = buildSampleLog({
        isSpecialPage: true,
        authorId: RP_ID,
        authorRole: 'responsable_pedagogique',
        visibility: 'special',
      });
      mockRepository.findOne.mockResolvedValue(specialLog);
      mockRepository.remove.mockResolvedValue(specialLog);

      await pedagogicalLogService.remove(LOG_ID, RP_ID, 'responsable_pedagogique');

      expect(mockRelationsClient.assertTeacherOfStudent).not.toHaveBeenCalled();
      expect(mockRepository.remove).toHaveBeenCalledWith(specialLog);
    });

    it('un formateur non-auteur ne peut pas supprimer une page spéciale', async () => {
      const specialLog = buildSampleLog({ isSpecialPage: true, authorId: RP_ID, visibility: 'special' });
      mockRepository.findOne.mockResolvedValue(specialLog);

      await expect(
        pedagogicalLogService.remove(LOG_ID, OTHER_FORMATEUR, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRepository.remove).not.toHaveBeenCalled();
    });
  });
});
