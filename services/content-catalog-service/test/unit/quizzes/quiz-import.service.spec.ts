/**
 * Unit tests — QuizImportService
 *
 * Couvre :
 *   - rôles autorisés (mêmes que la création manuelle)
 *   - absence de fichier
 *   - réutilisation de QuizzesService.create() par bloc, agrégation des
 *     résultats (créé / erreur), un bloc en erreur au service n'empêche pas
 *     la création des autres blocs valides
 *   - constraints() expose le plafond configuré
 */

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { QuizImportService } from '../../../src/quizzes/quiz-import.service';
import { QUIZ_IMPORT_MAX_FILE_SIZE_BYTES } from '../../../src/quizzes/quiz-import.constants';

function buildMockQuizzesService() {
  return { create: jest.fn() };
}

function csvFile(content: string): Express.Multer.File {
  return { buffer: Buffer.from(content, 'utf-8') } as Express.Multer.File;
}

const VALID_TWO_BLOCK_CSV = [
  'type=quizz;Quizz A;;;',
  'type=question;choix_unique;"Q ?";"a;b";a;unique;;',
  'type=quizz;Quizz B;;;',
  'type=question;choix_unique;"Q ?";"a;b";a;unique;;',
].join('\n');

describe('QuizImportService', () => {
  let quizzesService: ReturnType<typeof buildMockQuizzesService>;
  let service: QuizImportService;

  beforeEach(() => {
    quizzesService = buildMockQuizzesService();
    service = new QuizImportService(quizzesService as any);
  });

  describe('rôles autorisés', () => {
    it('refuse un rôle non créateur (ex. élève)', async () => {
      await expect(service.importFile(csvFile(VALID_TWO_BLOCK_CSV), 'user-1', 'eleve')).rejects.toThrow(
        ForbiddenException,
      );
      expect(quizzesService.create).not.toHaveBeenCalled();
    });

    it.each(['formateur', 'animateur_pedagogique', 'responsable_pedagogique'])(
      'autorise le rôle créateur %s',
      async (role) => {
        quizzesService.create.mockResolvedValue({ id: 'quiz-1', status: 'validated' });
        const results = await service.importFile(csvFile(VALID_TWO_BLOCK_CSV), 'user-1', role);
        expect(results).toHaveLength(2);
        expect(quizzesService.create).toHaveBeenCalledTimes(2);
      },
    );
  });

  describe('validation du fichier', () => {
    it('refuse explicitement une requête sans fichier', async () => {
      await expect(service.importFile(undefined, 'user-1', 'formateur')).rejects.toThrow(BadRequestException);
      expect(quizzesService.create).not.toHaveBeenCalled();
    });

    it('refuse explicitement un fichier vide', async () => {
      const emptyFile = { buffer: Buffer.alloc(0) } as Express.Multer.File;
      await expect(service.importFile(emptyFile, 'user-1', 'formateur')).rejects.toThrow(BadRequestException);
    });

    it('propage le rejet du parseur pour un format non reconnu', async () => {
      const binaryFile = { buffer: Buffer.from([0x00, 0x01, 0x02]) } as Express.Multer.File;
      await expect(service.importFile(binaryFile, 'user-1', 'formateur')).rejects.toThrow(
        /Format de fichier non reconnu/,
      );
    });
  });

  describe('création par bloc', () => {
    it('crée un quizz par bloc valide, avec le statut de validation renvoyé par QuizzesService', async () => {
      quizzesService.create
        .mockResolvedValueOnce({ id: 'quiz-a', status: 'pending_validation' })
        .mockResolvedValueOnce({ id: 'quiz-b', status: 'validated' });

      const results = await service.importFile(csvFile(VALID_TWO_BLOCK_CSV), 'author-1', 'formateur');

      expect(quizzesService.create).toHaveBeenCalledTimes(2);
      expect(quizzesService.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ title: 'Quizz A' }),
        'author-1',
        'formateur',
      );
      expect(results).toEqual([
        { blockIndex: 0, status: 'created', quizId: 'quiz-a', validationStatus: 'pending_validation' },
        { blockIndex: 1, status: 'created', quizId: 'quiz-b', validationStatus: 'validated' },
      ]);
    });

    it('un bloc invalide au parsing est renvoyé en erreur SANS jamais appeler QuizzesService.create pour ce bloc', async () => {
      quizzesService.create.mockResolvedValue({ id: 'quiz-ok', status: 'validated' });
      const fileWithOneBadBlock = [
        'type=quizz;Quizz cassé;;;',
        'type=question;qcm;"Q ?";"a;b";a;unique;;', // catégorie inconnue
        'type=quizz;Quizz correct;;;',
        'type=question;choix_unique;"Q ?";"a;b";a;unique;;',
      ].join('\n');

      const results = await service.importFile(csvFile(fileWithOneBadBlock), 'author-1', 'formateur');

      expect(quizzesService.create).toHaveBeenCalledTimes(1);
      expect(results[0].status).toBe('error');
      expect(results[0].errors?.[0].message).toMatch(/Catégorie de question inconnue/);
      expect(results[1]).toEqual({ blockIndex: 1, status: 'created', quizId: 'quiz-ok', validationStatus: 'validated' });
    });

    it('un rejet de QuizzesService.create (règle métier) sur un bloc n\'empêche pas la création des autres blocs', async () => {
      quizzesService.create
        .mockRejectedValueOnce(new BadRequestException('Question 1 : une question à choix unique doit avoir exactement une bonne réponse'))
        .mockResolvedValueOnce({ id: 'quiz-b', status: 'validated' });

      const results = await service.importFile(csvFile(VALID_TWO_BLOCK_CSV), 'author-1', 'formateur');

      expect(quizzesService.create).toHaveBeenCalledTimes(2);
      expect(results[0]).toEqual({
        blockIndex: 0,
        status: 'error',
        errors: [{ row: 1, message: 'Question 1 : une question à choix unique doit avoir exactement une bonne réponse' }],
      });
      expect(results[1]).toEqual({ blockIndex: 1, status: 'created', quizId: 'quiz-b', validationStatus: 'validated' });
    });
  });

  describe('getConstraints', () => {
    it('expose le plafond de taille configuré', () => {
      expect(service.getConstraints()).toEqual({ maxFileSizeBytes: QUIZ_IMPORT_MAX_FILE_SIZE_BYTES });
    });
  });
});
