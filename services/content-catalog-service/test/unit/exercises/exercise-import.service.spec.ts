/**
 * Unit tests — ExerciseImportService
 *
 * Couvre :
 *   - rôles autorisés (mêmes que la création manuelle)
 *   - absence de fichier / fichier vide / format non reconnu
 *   - réutilisation de ExercisesService.create() par bloc, agrégation des
 *     résultats (créé / erreur), un bloc en erreur au service n'empêche pas
 *     la création des autres blocs valides
 *   - getConstraints() expose le plafond configuré
 */

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ExerciseImportService } from '../../../src/exercises/exercise-import.service';
import { EXERCISE_IMPORT_MAX_FILE_SIZE_BYTES } from '../../../src/exercises/exercise-import.constants';

function buildMockExercisesService() {
  return { create: jest.fn() };
}

function csvFile(content: string): Express.Multer.File {
  return { buffer: Buffer.from(content, 'utf-8') } as Express.Multer.File;
}

const VALID_TWO_BLOCK_CSV = [
  'exercice;Exercice A;;;;;',
  'enonce;;;;;;;E',
  'question;;;;;;;Q',
  'solution;;;;;;;S',
  '',
  'exercice;Exercice B;;;;;',
  'enonce;;;;;;;E',
  'question;;;;;;;Q',
  'solution;;;;;;;S',
].join('\n');

describe('ExerciseImportService', () => {
  let exercisesService: ReturnType<typeof buildMockExercisesService>;
  let service: ExerciseImportService;

  beforeEach(() => {
    exercisesService = buildMockExercisesService();
    service = new ExerciseImportService(exercisesService as any);
  });

  describe('rôles autorisés', () => {
    it('refuse un rôle non créateur (ex. élève)', async () => {
      await expect(service.importFile(csvFile(VALID_TWO_BLOCK_CSV), 'user-1', 'eleve')).rejects.toThrow(
        ForbiddenException,
      );
      expect(exercisesService.create).not.toHaveBeenCalled();
    });

    it.each(['formateur', 'animateur_pedagogique', 'responsable_pedagogique'])(
      'autorise le rôle créateur %s',
      async (role) => {
        exercisesService.create.mockResolvedValue({ id: 'exercise-1', status: 'validated' });
        const results = await service.importFile(csvFile(VALID_TWO_BLOCK_CSV), 'user-1', role);
        expect(results).toHaveLength(2);
        expect(exercisesService.create).toHaveBeenCalledTimes(2);
      },
    );
  });

  describe('validation du fichier', () => {
    it('refuse explicitement une requête sans fichier', async () => {
      await expect(service.importFile(undefined, 'user-1', 'formateur')).rejects.toThrow(BadRequestException);
      expect(exercisesService.create).not.toHaveBeenCalled();
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
    it('crée un exercice par bloc valide, avec le statut de validation renvoyé par ExercisesService', async () => {
      exercisesService.create
        .mockResolvedValueOnce({ id: 'ex-a', status: 'pending_validation' })
        .mockResolvedValueOnce({ id: 'ex-b', status: 'validated' });

      const results = await service.importFile(csvFile(VALID_TWO_BLOCK_CSV), 'author-1', 'formateur');

      expect(exercisesService.create).toHaveBeenCalledTimes(2);
      expect(exercisesService.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ title: 'Exercice A' }),
        'author-1',
        'formateur',
      );
      expect(results).toEqual([
        { blockIndex: 0, status: 'created', exerciseId: 'ex-a', validationStatus: 'pending_validation' },
        { blockIndex: 1, status: 'created', exerciseId: 'ex-b', validationStatus: 'validated' },
      ]);
    });

    it('un bloc invalide au parsing est renvoyé en erreur SANS jamais appeler ExercisesService.create pour ce bloc', async () => {
      exercisesService.create.mockResolvedValue({ id: 'ex-ok', status: 'validated' });
      const fileWithOneBadBlock = [
        'exercice;Cassé;;;;;',
        'enonce;;;;;;;E',
        'question;;;;;;;Q sans solution',
        '',
        'exercice;Correct;;;;;',
        'enonce;;;;;;;E',
        'question;;;;;;;Q',
        'solution;;;;;;;S',
      ].join('\n');

      const results = await service.importFile(csvFile(fileWithOneBadBlock), 'author-1', 'formateur');

      expect(exercisesService.create).toHaveBeenCalledTimes(1);
      expect(results[0].status).toBe('error');
      expect(results[0].errors?.[0].message).toMatch(/doit être immédiatement suivie/);
      expect(results[1]).toEqual({ blockIndex: 1, status: 'created', exerciseId: 'ex-ok', validationStatus: 'validated' });
    });

    it('un rejet de ExercisesService.create (règle métier) sur un bloc n\'empêche pas la création des autres blocs', async () => {
      exercisesService.create
        .mockRejectedValueOnce(new BadRequestException('Un exercice doit comporter au moins un bloc énoncé'))
        .mockResolvedValueOnce({ id: 'ex-b', status: 'validated' });

      const results = await service.importFile(csvFile(VALID_TWO_BLOCK_CSV), 'author-1', 'formateur');

      expect(exercisesService.create).toHaveBeenCalledTimes(2);
      expect(results[0]).toEqual({
        blockIndex: 0,
        status: 'error',
        errors: [{ row: 1, message: 'Un exercice doit comporter au moins un bloc énoncé' }],
      });
      expect(results[1]).toEqual({ blockIndex: 1, status: 'created', exerciseId: 'ex-b', validationStatus: 'validated' });
    });
  });

  describe('getConstraints', () => {
    it('expose le plafond de taille configuré', () => {
      expect(service.getConstraints()).toEqual({ maxFileSizeBytes: EXERCISE_IMPORT_MAX_FILE_SIZE_BYTES });
    });
  });
});
