/**
 * Unit tests — PedagogicalLogService
 *
 * Cas critiques obligatoires (XML spec):
 *   - Page spéciale hiddenFromStudent=true → invisible pour l'élève dans GET
 *   - Élève lit son cahier → ne voit que les pages autorisées
 *   - RP crée une page spéciale
 *   - Un formateur non-auteur ne peut pas modifier
 *
 * Couvre :
 *   - create()              → formateur crée une page, défauts corrects
 *   - createSpecialPage()   → RP crée une page spéciale avec hiddenFromStudent
 *   - findByStudent()       → filtrage par rôle + hiddenFromStudent pour l'élève
 *   - findOne()             → visibilité + hiddenFromStudent
 *   - update()              → auteur ou RP/TI peut modifier
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PedagogicalLogService } from '../../../src/pedagogical-log/pedagogical-log.service';
import { PedagogicalLog } from '../../../src/pedagogical-log/entities/pedagogical-log.entity';

const STUDENT_ID       = 'aaaaaaaa-0000-4000-a000-aaaaaaaaaaaa';
const FORMATEUR_ID     = 'bbbbbbbb-0000-4000-b000-bbbbbbbbbbbb';
const RP_ID            = 'cccccccc-0000-4000-c000-cccccccccccc';
const OTHER_FORMATEUR  = 'ffffffff-0000-4000-f000-ffffffffffff';
const LOG_ID           = 'eeeeeeee-0000-4000-e000-eeeeeeeeeeee';

function buildMockRepository() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
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
    content: 'Cours sur les dérivées',
    visibility: 'eleve_parent_formateur',
    isSpecialPage: false,
    hiddenFromStudent: false,
    linkedResources: null,
    skillsWorked: null,
    difficulty: null,
    rating: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('PedagogicalLogService', () => {
  let pedagogicalLogService: PedagogicalLogService;
  let mockRepository: ReturnType<typeof buildMockRepository>;

  beforeEach(async () => {
    mockRepository = buildMockRepository();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PedagogicalLogService,
        {
          provide: getRepositoryToken(PedagogicalLog),
          useValue: mockRepository,
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
    it('un formateur peut créer une page de cahier de texte → isSpecialPage=false par défaut', async () => {
      const dto = { studentId: STUDENT_ID, content: 'Cours sur les dérivées' };
      const savedLog = buildSampleLog();

      mockRepository.create.mockReturnValue(savedLog);
      mockRepository.save.mockResolvedValue(savedLog);

      const result = await pedagogicalLogService.create(dto, FORMATEUR_ID, 'formateur');

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          authorId: FORMATEUR_ID,
          authorRole: 'formateur',
          isSpecialPage: false,
          hiddenFromStudent: false,
          visibility: 'eleve_parent_formateur',
        }),
      );
      expect(result.isSpecialPage).toBe(false);
    });

    it('hiddenFromStudent peut être passé à true', async () => {
      const dto = { studentId: STUDENT_ID, content: 'Note interne', hiddenFromStudent: true };
      const savedLog = buildSampleLog({ hiddenFromStudent: true });

      mockRepository.create.mockReturnValue(savedLog);
      mockRepository.save.mockResolvedValue(savedLog);

      const result = await pedagogicalLogService.create(dto, FORMATEUR_ID, 'formateur');

      expect(result.hiddenFromStudent).toBe(true);
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
    it('[CRITIQUE] page spéciale hiddenFromStudent=true → INVISIBLE pour l\'élève', async () => {
      const visibleLog = buildSampleLog({ id: 'log-visible', hiddenFromStudent: false });
      const hiddenLog = buildSampleLog({
        id: 'log-hidden',
        hiddenFromStudent: true,
        visibility: 'eleve_parent_formateur',
      });

      mockRepository.find.mockResolvedValue([visibleLog, hiddenLog]);

      const result = await pedagogicalLogService.findByStudent(STUDENT_ID, 'eleve');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('log-visible');
    });

    it('[CRITIQUE] élève lit son cahier → ne voit que les pages de visibilité autorisée', async () => {
      const allowedLog = buildSampleLog({ visibility: 'eleve_formateur' });

      mockRepository.find.mockResolvedValue([allowedLog]);

      const result = await pedagogicalLogService.findByStudent(STUDENT_ID, 'eleve');

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            studentId: STUDENT_ID,
          }),
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('le RP voit toutes les pages y compris hiddenFromStudent=true', async () => {
      const hiddenLog = buildSampleLog({ hiddenFromStudent: true, visibility: 'special' });

      mockRepository.find.mockResolvedValue([hiddenLog]);

      const result = await pedagogicalLogService.findByStudent(STUDENT_ID, 'responsable_pedagogique');

      expect(result).toHaveLength(1);
    });

    it('le parent voit les pages eleve_parent_formateur et special (non cachées)', async () => {
      const normalLog = buildSampleLog({ visibility: 'eleve_parent_formateur' });
      mockRepository.find.mockResolvedValue([normalLog]);

      const result = await pedagogicalLogService.findByStudent(STUDENT_ID, 'parent_financeur');

      expect(result).toHaveLength(1);
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

  describe('update()', () => {
    it('[OK] l\'auteur peut modifier sa propre page', async () => {
      const log = buildSampleLog();
      const updatedLog = buildSampleLog({ content: 'Contenu modifié' });

      mockRepository.findOne.mockResolvedValue(log);
      mockRepository.save.mockResolvedValue(updatedLog);

      const result = await pedagogicalLogService.update(
        LOG_ID,
        { content: 'Contenu modifié' },
        FORMATEUR_ID,
        'formateur',
      );

      expect(result.content).toBe('Contenu modifié');
    });

    it('[CRITIQUE] un autre formateur (non auteur) ne peut pas modifier → ForbiddenException', async () => {
      const log = buildSampleLog();
      mockRepository.findOne.mockResolvedValue(log);

      await expect(
        pedagogicalLogService.update(LOG_ID, { content: 'hack' }, OTHER_FORMATEUR, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('[OK] le RP peut modifier n\'importe quelle page', async () => {
      const log = buildSampleLog();
      const updatedLog = buildSampleLog({ content: 'Modifié par RP' });

      mockRepository.findOne.mockResolvedValue(log);
      mockRepository.save.mockResolvedValue(updatedLog);

      const result = await pedagogicalLogService.update(
        LOG_ID,
        { content: 'Modifié par RP' },
        RP_ID,
        'responsable_pedagogique',
      );

      expect(result.content).toBe('Modifié par RP');
    });
  });
});
