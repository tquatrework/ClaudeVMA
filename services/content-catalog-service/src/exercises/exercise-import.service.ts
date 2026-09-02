import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ExercisesService, EXERCISE_CREATOR_ROLES } from './exercises.service';
import { parseExerciseImportFile } from './exercise-import.parser';
import { EXERCISE_IMPORT_MAX_FILE_SIZE_BYTES } from './exercise-import.constants';
import { UserRole } from '../common/enums/user-role.enum';

export interface ExerciseImportBlockResult {
  blockIndex: number;
  status: 'created' | 'error';
  exerciseId?: string;
  validationStatus?: string;
  errors?: { row: number; message: string }[];
}

/**
 * Import de plusieurs Exercices depuis un fichier tableur (CSV/Excel) —
 * arbitrage docs/architecture.md, 2026-09-02, "Import d'Exercice depuis un
 * tableur (CSV/Excel), et modèle de type identique pour l'import de Quizz".
 *
 * Réutilise ExercisesService.create() bloc par bloc, exactement sur le
 * modèle de QuizImportService (2026-08-29, point 1 de cet arbitrage) : un
 * exercice importé par un formateur passe par pending_validation exactement
 * comme à la création manuelle, aucune règle de validation, de composition
 * minimale (au moins un bloc énoncé + un bloc question non vide) ni de titre
 * (obligatoire, unique par auteur, disambiguation automatique) n'est
 * dupliquée ni contournée par l'import.
 */
@Injectable()
export class ExerciseImportService {
  constructor(private readonly exercisesService: ExercisesService) {}

  getConstraints(): { maxFileSizeBytes: number } {
    return { maxFileSizeBytes: EXERCISE_IMPORT_MAX_FILE_SIZE_BYTES };
  }

  async importFile(
    file: Express.Multer.File | undefined,
    authorId: string,
    authorRole: string,
  ): Promise<ExerciseImportBlockResult[]> {
    if (!EXERCISE_CREATOR_ROLES.includes(authorRole as UserRole)) {
      throw new ForbiddenException('Seuls les formateurs, AP et RP peuvent importer des exercices');
    }

    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Aucun fichier reçu (champ "file" attendu, multipart)');
    }

    const { blocks } = await parseExerciseImportFile(file.buffer);

    const results: ExerciseImportBlockResult[] = [];
    for (const block of blocks) {
      if (block.errors.length > 0 || !block.dto) {
        results.push({ blockIndex: block.blockIndex, status: 'error', errors: block.errors });
        continue;
      }

      try {
        // Réutilisation intégrale du service de création existant : statut
        // de validation, composition minimale, titre unique par auteur —
        // rien n'est dupliqué ni contourné pour le chemin d'import.
        const created = await this.exercisesService.create(block.dto, authorId, authorRole);
        results.push({
          blockIndex: block.blockIndex,
          status: 'created',
          exerciseId: created.id,
          validationStatus: created.status,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue lors de la création de l\'exercice';
        results.push({
          blockIndex: block.blockIndex,
          status: 'error',
          errors: [{ row: block.exerciseRowNumber, message }],
        });
      }
    }

    return results;
  }
}
