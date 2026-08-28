/**
 * Unit tests — quiz-grading.util
 *
 * Couvre la notation pure des 3 catégories de question, indépendamment de
 * toute base de données :
 *   - single_choice
 *   - multiple_choice (all_or_nothing et per_option)
 *   - short_text (all_or_nothing et per_keyword)
 *   - barème global vs individuel
 *   - pénalité globale vs individuelle, et non-cumul avec un score partiel
 */

import { gradeQuestion, gradeQuiz, resolveEffectiveScoring } from '../../../src/quizzes/quiz-grading.util';
import { Quiz } from '../../../src/quizzes/entities/quiz.entity';
import { QuizQuestion } from '../../../src/quizzes/entities/quiz-question.entity';
import {
  MultipleChoiceScoringMode,
  QuizQuestionCategory,
  ShortTextScoringMode,
} from '../../../src/quizzes/enums/quiz-question-category.enum';

function buildQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: 'quiz-0001',
    title: 'Quizz test',
    description: null,
    tags: [],
    authorId: 'author-0001',
    authorRole: 'formateur',
    status: 'validated' as any,
    defaultPoints: 1,
    penaltyEnabled: false,
    penaltyPoints: null,
    shareableLink: null,
    questions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Quiz;
}

function buildQuestion(overrides: Partial<QuizQuestion> = {}): QuizQuestion {
  return {
    id: 'question-0001',
    quizId: 'quiz-0001',
    order: 1,
    category: QuizQuestionCategory.SINGLE_CHOICE,
    prompt: 'Combien font 2+2 ?',
    options: null,
    correctOptionIds: null,
    keywords: null,
    multipleChoiceScoringMode: null,
    shortTextScoringMode: null,
    pointsOverride: null,
    penaltyEnabledOverride: null,
    penaltyPointsOverride: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as QuizQuestion;
}

describe('resolveEffectiveScoring()', () => {
  it('utilise le barème global du quizz par défaut', () => {
    const quiz = buildQuiz({ defaultPoints: 3, penaltyEnabled: true, penaltyPoints: 2 });
    const question = buildQuestion();

    expect(resolveEffectiveScoring(quiz, question)).toEqual({
      points: 3,
      penaltyEnabled: true,
      penaltyPoints: 2,
    });
  });

  it('le barème individuel de la question prévaut sur le barème global', () => {
    const quiz = buildQuiz({ defaultPoints: 3, penaltyEnabled: false, penaltyPoints: null });
    const question = buildQuestion({ pointsOverride: 10, penaltyEnabledOverride: true, penaltyPointsOverride: 4 });

    expect(resolveEffectiveScoring(quiz, question)).toEqual({
      points: 10,
      penaltyEnabled: true,
      penaltyPoints: 4,
    });
  });

  it('la pénalité vaut le barème effectif si activée sans montant précisé', () => {
    const quiz = buildQuiz({ defaultPoints: 5, penaltyEnabled: true, penaltyPoints: null });
    const question = buildQuestion();

    expect(resolveEffectiveScoring(quiz, question).penaltyPoints).toBe(5);
  });
});

describe('gradeQuestion() — single_choice', () => {
  const quiz = buildQuiz({ defaultPoints: 1 });
  const question = buildQuestion({
    category: QuizQuestionCategory.SINGLE_CHOICE,
    options: [
      { id: 'a', text: 'Trois' },
      { id: 'b', text: 'Quatre' },
    ],
    correctOptionIds: ['b'],
  });

  it('note juste quand la bonne option est sélectionnée', () => {
    const result = gradeQuestion(quiz, question, { questionId: question.id, selectedOptionIds: ['b'] });
    expect(result).toEqual({ questionId: question.id, isCorrect: true, pointsEarned: 1, pointsPossible: 1 });
  });

  it('note faux quand la mauvaise option est sélectionnée', () => {
    const result = gradeQuestion(quiz, question, { questionId: question.id, selectedOptionIds: ['a'] });
    expect(result.isCorrect).toBe(false);
    expect(result.pointsEarned).toBe(0);
  });

  it('ne pénalise pas une question sans réponse', () => {
    const penalizedQuiz = buildQuiz({ defaultPoints: 1, penaltyEnabled: true, penaltyPoints: 1 });
    const result = gradeQuestion(penalizedQuiz, question, { questionId: question.id, selectedOptionIds: [] });
    expect(result.pointsEarned).toBe(0);
  });

  it('applique la pénalité en cas de réponse fausse quand elle est activée', () => {
    const penalizedQuiz = buildQuiz({ defaultPoints: 1, penaltyEnabled: true, penaltyPoints: 1 });
    const result = gradeQuestion(penalizedQuiz, question, { questionId: question.id, selectedOptionIds: ['a'] });
    expect(result.pointsEarned).toBe(-1);
  });

  it('utilise le barème individuel de la question, distinct du barème global', () => {
    const quizWithGlobalPoints = buildQuiz({ defaultPoints: 1 });
    const questionWithOverride = buildQuestion({
      ...question,
      pointsOverride: 5,
    });
    const result = gradeQuestion(quizWithGlobalPoints, questionWithOverride, {
      questionId: question.id,
      selectedOptionIds: ['b'],
    });
    expect(result.pointsEarned).toBe(5);
    expect(result.pointsPossible).toBe(5);
  });
});

describe('gradeQuestion() — multiple_choice', () => {
  const options = [
    { id: 'a', text: 'A' },
    { id: 'b', text: 'B' },
    { id: 'c', text: 'C' },
  ];

  it('all_or_nothing : juste seulement si toutes les bonnes cases et aucune autre sont cochées', () => {
    const quiz = buildQuiz({ defaultPoints: 4 });
    const question = buildQuestion({
      category: QuizQuestionCategory.MULTIPLE_CHOICE,
      options,
      correctOptionIds: ['a', 'b'],
      multipleChoiceScoringMode: MultipleChoiceScoringMode.ALL_OR_NOTHING,
    });

    const exact = gradeQuestion(quiz, question, { questionId: question.id, selectedOptionIds: ['a', 'b'] });
    expect(exact).toEqual({ questionId: question.id, isCorrect: true, pointsEarned: 4, pointsPossible: 4 });

    const partial = gradeQuestion(quiz, question, { questionId: question.id, selectedOptionIds: ['a'] });
    expect(partial.isCorrect).toBe(false);
    expect(partial.pointsEarned).toBe(0);

    const withExtra = gradeQuestion(quiz, question, { questionId: question.id, selectedOptionIds: ['a', 'b', 'c'] });
    expect(withExtra.isCorrect).toBe(false);
    expect(withExtra.pointsEarned).toBe(0);
  });

  it('per_option : le barème se répartit à parts égales entre les items attendus (les bonnes options), pas entre toutes les options', () => {
    const quiz = buildQuiz({ defaultPoints: 3 });
    const question = buildQuestion({
      category: QuizQuestionCategory.MULTIPLE_CHOICE,
      options,
      correctOptionIds: ['a', 'b'],
      multipleChoiceScoringMode: MultipleChoiceScoringMode.PER_OPTION,
    });

    // 2 items attendus (a, b) => 3/2 = 1.5 point par item.
    // a coché (correct) : 1 item sur 2 => 1.5 point, c (non attendu) non coché : sans effet.
    const result = gradeQuestion(quiz, question, { questionId: question.id, selectedOptionIds: ['a'] });
    expect(result.isCorrect).toBe(false);
    expect(result.pointsEarned).toBeCloseTo(1.5);

    const fullyCorrect = gradeQuestion(quiz, question, { questionId: question.id, selectedOptionIds: ['a', 'b'] });
    expect(fullyCorrect.isCorrect).toBe(true);
    expect(fullyCorrect.pointsEarned).toBe(3);
  });

  it('ne pénalise pas une case attendue restée non cochée (manque à gagner, pas une pénalité)', () => {
    const quiz = buildQuiz({ defaultPoints: 3, penaltyEnabled: true, penaltyPoints: 3 });
    const question = buildQuestion({
      category: QuizQuestionCategory.MULTIPLE_CHOICE,
      options,
      correctOptionIds: ['a', 'b'],
      multipleChoiceScoringMode: MultipleChoiceScoringMode.PER_OPTION,
    });

    // b n'est pas coché (item attendu manquant) mais aucune case incorrecte
    // n'est cochée : pas de pénalité, seulement l'absence du gain sur b.
    const result = gradeQuestion(quiz, question, { questionId: question.id, selectedOptionIds: ['a'] });
    expect(result.pointsEarned).toBeCloseTo(1.5);
  });

  it('per_option : pénalise chaque case incorrecte cochée, au même niveau que le barème (par item)', () => {
    const quiz = buildQuiz({ defaultPoints: 3, penaltyEnabled: true, penaltyPoints: 3 });
    const question = buildQuestion({
      category: QuizQuestionCategory.MULTIPLE_CHOICE,
      options,
      correctOptionIds: ['a', 'b'],
      multipleChoiceScoringMode: MultipleChoiceScoringMode.PER_OPTION,
    });

    // a (correct, 1.5) coché + c (incorrect, cochée à tort) => pénalité de 3/2 = 1.5
    // pointsEarned = 1.5 - 1.5 = 0
    const result = gradeQuestion(quiz, question, {
      questionId: question.id,
      selectedOptionIds: ['a', 'c'],
    });
    expect(result.isCorrect).toBe(false);
    expect(result.pointsEarned).toBeCloseTo(0);
  });

  it('per_option : le score de la question peut devenir négatif si les pénalités dépassent les points gagnés', () => {
    const quiz = buildQuiz({ defaultPoints: 2, penaltyEnabled: true, penaltyPoints: 2 });
    const question = buildQuestion({
      category: QuizQuestionCategory.MULTIPLE_CHOICE,
      options,
      correctOptionIds: ['a'],
      multipleChoiceScoringMode: MultipleChoiceScoringMode.PER_OPTION,
    });

    // Un seul item attendu (a), non coché : 0 point. b et c cochées à tort :
    // 2 pénalités de 2/1 = 2 chacune => pointsEarned = 0 - 4 = -4, aucun plancher à zéro.
    const result = gradeQuestion(quiz, question, {
      questionId: question.id,
      selectedOptionIds: ['b', 'c'],
    });
    expect(result.isCorrect).toBe(false);
    expect(result.pointsEarned).toBe(-4);
  });

  it('ne cumule jamais une pénalité par item avec une pénalité globale de la question', () => {
    // Non-cumul : en notation per_option, seule la pénalité par item
    // s'applique ; il n'existe pas de second niveau de pénalité "question
    // entière" appliqué en plus (arbitrage du 2026-08-28).
    const quiz = buildQuiz({ defaultPoints: 3, penaltyEnabled: true, penaltyPoints: 3 });
    const question = buildQuestion({
      category: QuizQuestionCategory.MULTIPLE_CHOICE,
      options,
      correctOptionIds: ['a', 'b'],
      multipleChoiceScoringMode: MultipleChoiceScoringMode.PER_OPTION,
    });

    // Une seule case incorrecte cochée (c), aucune correcte : une seule
    // pénalité de 1.5 est appliquée, pas une pénalité de question entière de 3
    // en plus.
    const result = gradeQuestion(quiz, question, { questionId: question.id, selectedOptionIds: ['c'] });
    expect(result.pointsEarned).toBeCloseTo(-1.5);
  });
});

describe('gradeQuestion() — short_text', () => {
  it('all_or_nothing : juste seulement si tous les mots-clés sont présents, insensible à la casse', () => {
    const quiz = buildQuiz({ defaultPoints: 2 });
    const question = buildQuestion({
      category: QuizQuestionCategory.SHORT_TEXT,
      keywords: ['Pythagore', 'hypoténuse'],
      shortTextScoringMode: ShortTextScoringMode.ALL_OR_NOTHING,
    });

    const correct = gradeQuestion(quiz, question, {
      questionId: question.id,
      text: 'Le théorème de PYTHAGORE relie les côtés à l\'HYPOTÉNUSE... enfin presque',
    });
    expect(correct.isCorrect).toBe(true);
    expect(correct.pointsEarned).toBe(2);
    expect(correct.pointsPossible).toBe(2);

    const missingOne = gradeQuestion(quiz, question, {
      questionId: question.id,
      text: 'Le théorème de pythagore',
    });
    expect(missingOne.isCorrect).toBe(false);
    expect(missingOne.pointsEarned).toBe(0);
  });

  it('per_keyword : chaque mot-clé présent rapporte sa part de points', () => {
    const quiz = buildQuiz({ defaultPoints: 4 });
    const question = buildQuestion({
      category: QuizQuestionCategory.SHORT_TEXT,
      keywords: ['un', 'deux', 'trois', 'quatre'],
      shortTextScoringMode: ShortTextScoringMode.PER_KEYWORD,
    });

    const result = gradeQuestion(quiz, question, { questionId: question.id, text: 'un et trois seulement' });
    expect(result.pointsEarned).toBe(2);
    expect(result.isCorrect).toBe(false);
  });

  it('applique la pénalité en cas de réponse totalement fausse', () => {
    const quiz = buildQuiz({ defaultPoints: 2, penaltyEnabled: true, penaltyPoints: 1 });
    const question = buildQuestion({
      category: QuizQuestionCategory.SHORT_TEXT,
      keywords: ['pythagore'],
      shortTextScoringMode: ShortTextScoringMode.ALL_OR_NOTHING,
    });

    const result = gradeQuestion(quiz, question, { questionId: question.id, text: 'une réponse hors sujet' });
    expect(result.pointsEarned).toBe(-1);
  });

  it('ne pénalise pas une réponse vide', () => {
    const quiz = buildQuiz({ defaultPoints: 2, penaltyEnabled: true, penaltyPoints: 1 });
    const question = buildQuestion({
      category: QuizQuestionCategory.SHORT_TEXT,
      keywords: ['pythagore'],
    });

    const result = gradeQuestion(quiz, question, { questionId: question.id, text: '   ' });
    expect(result.pointsEarned).toBe(0);
  });

  it('per_keyword : aucun mot-clé absent ne pénalise, même avec la pénalité activée — le texte n\'a pas de notion d\'item incorrect', () => {
    const quiz = buildQuiz({ defaultPoints: 4, penaltyEnabled: true, penaltyPoints: 4 });
    const question = buildQuestion({
      category: QuizQuestionCategory.SHORT_TEXT,
      keywords: ['pomme', 'banane', 'cerise', 'orange'],
      shortTextScoringMode: ShortTextScoringMode.PER_KEYWORD,
    });

    const result = gradeQuestion(quiz, question, { questionId: question.id, text: 'aucun mot-clé pertinent ici' });
    expect(result.isCorrect).toBe(false);
    expect(result.pointsEarned).toBe(0);
  });
});

describe('gradeQuiz()', () => {
  it('additionne les points obtenus et le score maximum sur toutes les questions', () => {
    const q1 = buildQuestion({
      id: 'q1',
      order: 1,
      category: QuizQuestionCategory.SINGLE_CHOICE,
      options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
      correctOptionIds: ['a'],
      pointsOverride: 2,
    });
    const q2 = buildQuestion({
      id: 'q2',
      order: 2,
      category: QuizQuestionCategory.SHORT_TEXT,
      keywords: ['clef'],
    });

    const quiz = buildQuiz({ defaultPoints: 1, questions: [q2, q1] });

    const result = gradeQuiz(quiz, [
      { questionId: 'q1', selectedOptionIds: ['a'] },
      { questionId: 'q2', text: 'la clef est ici' },
    ]);

    expect(result.maxScore).toBe(3); // 2 (override) + 1 (défaut)
    expect(result.score).toBe(3);
    expect(result.details).toHaveLength(2);
    expect(result.details.map((d) => d.questionId)).toEqual(['q1', 'q2']); // trié par order
  });

  it('n\'échoue pas si une question n\'a reçu aucune réponse', () => {
    const q1 = buildQuestion({
      id: 'q1',
      category: QuizQuestionCategory.SINGLE_CHOICE,
      options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
      correctOptionIds: ['a'],
    });
    const quiz = buildQuiz({ defaultPoints: 1, questions: [q1] });

    const result = gradeQuiz(quiz, []);

    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(1);
    expect(result.details[0].isCorrect).toBe(false);
  });

  it('le score total du quizz peut être négatif, aucun plancher à zéro n\'est appliqué', () => {
    const q1 = buildQuestion({
      id: 'q1',
      order: 1,
      category: QuizQuestionCategory.SINGLE_CHOICE,
      options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
      correctOptionIds: ['a'],
      pointsOverride: 1,
      penaltyEnabledOverride: true,
      penaltyPointsOverride: 5,
    });

    const quiz = buildQuiz({ defaultPoints: 1, questions: [q1] });

    const result = gradeQuiz(quiz, [{ questionId: 'q1', selectedOptionIds: ['b'] }]);

    expect(result.score).toBe(-5);
    expect(result.maxScore).toBe(1);
  });
});
