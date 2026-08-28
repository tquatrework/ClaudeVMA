/**
 * Vérification de compatibilité LaTeX — arbitrage du 2026-08-28
 * ("Edition d'un Quizz par son auteur...", point 4 du retour utilisateur).
 *
 * Aucun DTO de Quizz ne doit rejeter les caractères `$` et `\` (backslash),
 * nécessaires à la syntaxe légère `$...$`/`$$...$$` du futur rendu KaTeX
 * (arbitrage du 2026-08-26, "Syntaxe légère unifiée pour le texte enrichi").
 * Ce test constate l'état actuel (aucune règle @Matches trouvée dans le
 * code) plutôt que d'introduire un changement — voir le rapport de session.
 */

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateQuizDto } from '../../../src/quizzes/dto/create-quiz.dto';
import { QuizQuestionCategory } from '../../../src/quizzes/enums/quiz-question-category.enum';

describe('Compatibilité LaTeX des DTO de Quizz', () => {
  it('accepte $ et \\ dans le prompt, les options et les mots-clés', async () => {
    const dto = plainToInstance(CreateQuizDto, {
      title: 'Quizz LaTeX',
      questions: [
        {
          category: QuizQuestionCategory.SINGLE_CHOICE,
          prompt: 'Résoudre $x^2 = 4$, avec \\(x \\in \\mathbb{R}\\)',
          options: [
            { text: 'Aucune solution', isCorrect: false },
            { text: '$x = \\pm 2$', isCorrect: true },
          ],
        },
        {
          category: QuizQuestionCategory.SHORT_TEXT,
          prompt: 'Donner la formule $$\\int_0^1 x\\,dx$$',
          keywords: ['\\frac{1}{2}', '$0.5$'],
        },
      ],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
