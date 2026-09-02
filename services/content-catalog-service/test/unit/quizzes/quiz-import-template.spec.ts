/**
 * Unit test — QUIZ_IMPORT_TEMPLATE_CSV
 *
 * Ajouté rétroactivement (2026-09-02) : garantit que le fichier modèle
 * téléchargeable (GET /quizzes/import/template) reste toujours importable
 * par le vrai parseur, sur le même principe que
 * exercise-import-template.spec.ts.
 */

import { parseQuizImportFile } from '../../../src/quizzes/quiz-import.parser';
import { QUIZ_IMPORT_TEMPLATE_CSV } from '../../../src/quizzes/quiz-import-template';
import { QuizQuestionCategory } from '../../../src/quizzes/enums/quiz-question-category.enum';

describe('QUIZ_IMPORT_TEMPLATE_CSV', () => {
  it('est un fichier CSV valide, importable sans erreur, avec 1 quizz couvrant les 3 catégories de question', async () => {
    const result = await parseQuizImportFile(Buffer.from(QUIZ_IMPORT_TEMPLATE_CSV, 'utf-8'));

    expect(result.kind).toBe('csv');
    expect(result.blocks).toHaveLength(1);

    const [block] = result.blocks;
    expect(block.errors).toEqual([]);
    expect(block.dto).toBeDefined();
    expect(block.dto?.title?.length).toBeGreaterThan(0);
    expect(block.dto?.questions).toHaveLength(3);

    const categories = block.dto?.questions.map((question) => question.category);
    expect(categories).toEqual(
      expect.arrayContaining([
        QuizQuestionCategory.SINGLE_CHOICE,
        QuizQuestionCategory.MULTIPLE_CHOICE,
        QuizQuestionCategory.SHORT_TEXT,
      ]),
    );
  });
});
