import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { QuizzesService, CREATOR_ROLES } from './quizzes.service';
import { parseQuizImportFile } from './quiz-import.parser';
import { QUIZ_IMPORT_MAX_FILE_SIZE_BYTES } from './quiz-import.constants';
import { UserRole } from '../common/enums/user-role.enum';

export interface QuizImportBlockResult {
  blockIndex: number;
  status: 'created' | 'error';
  quizId?: string;
  validationStatus?: string;
  errors?: { row: number; message: string }[];
}

/**
 * Import de plusieurs Quizz depuis un fichier tableur (CSV/Excel) —
 * arbitrage docs/architecture.md, 2026-08-29, "Import de Quizz depuis un
 * tableur (CSV/Excel)".
 *
 * Réutilise QuizzesService.create() bloc par bloc (point 1 de l'arbitrage) :
 * un quizz importé par un formateur passe par pending_validation exactement
 * comme à la création manuelle, aucune règle de validation n'est contournée
 * par l'import.
 */
@Injectable()
export class QuizImportService {
  constructor(private readonly quizzesService: QuizzesService) {}

  getConstraints(): { maxFileSizeBytes: number } {
    return { maxFileSizeBytes: QUIZ_IMPORT_MAX_FILE_SIZE_BYTES };
  }

  async importFile(
    file: Express.Multer.File | undefined,
    authorId: string,
    authorRole: string,
  ): Promise<QuizImportBlockResult[]> {
    if (!CREATOR_ROLES.includes(authorRole as UserRole)) {
      throw new ForbiddenException('Seuls les formateurs, AP et RP peuvent importer des quizz');
    }

    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Aucun fichier reçu (champ "file" attendu, multipart)');
    }

    const { blocks } = await parseQuizImportFile(file.buffer);

    const results: QuizImportBlockResult[] = [];
    for (const block of blocks) {
      if (block.errors.length > 0 || !block.dto) {
        results.push({ blockIndex: block.blockIndex, status: 'error', errors: block.errors });
        continue;
      }

      try {
        // Réutilisation intégrale du service de création existant : statut
        // de validation, règles par catégorie de question, etc. — rien n'est
        // dupliqué ni contourné pour le chemin d'import.
        const created = await this.quizzesService.create(block.dto, authorId, authorRole);
        results.push({
          blockIndex: block.blockIndex,
          status: 'created',
          quizId: created.id,
          validationStatus: created.status,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue lors de la création du quizz';
        results.push({
          blockIndex: block.blockIndex,
          status: 'error',
          errors: [{ row: block.quizRowNumber, message }],
        });
      }
    }

    return results;
  }
}
