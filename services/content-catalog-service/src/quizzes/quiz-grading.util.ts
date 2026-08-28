import { Quiz } from './entities/quiz.entity';
import { QuizQuestion } from './entities/quiz-question.entity';
import { GradeQuizAnswerDto } from './dto/grade-quiz.dto';
import {
  MultipleChoiceScoringMode,
  QuizQuestionCategory,
  ShortTextScoringMode,
} from './enums/quiz-question-category.enum';

export interface QuizQuestionGradeDetail {
  questionId: string;
  isCorrect: boolean;
  pointsEarned: number;
  pointsPossible: number;
}

export interface QuizGradeResult {
  score: number;
  maxScore: number;
  details: QuizQuestionGradeDetail[];
}

/**
 * Barème effectif d'une question : le barème/pénalité individuel de la
 * question prévaut sur le réglage global du quizz (arbitrage du 2026-08-28).
 */
export function resolveEffectiveScoring(
  quiz: Pick<Quiz, 'defaultPoints' | 'penaltyEnabled' | 'penaltyPoints'>,
  question: Pick<QuizQuestion, 'pointsOverride' | 'penaltyEnabledOverride' | 'penaltyPointsOverride'>,
): { points: number; penaltyEnabled: boolean; penaltyPoints: number } {
  const points = question.pointsOverride ?? quiz.defaultPoints ?? 1;
  const penaltyEnabled = question.penaltyEnabledOverride ?? quiz.penaltyEnabled ?? false;
  const penaltyPoints = question.penaltyPointsOverride ?? quiz.penaltyPoints ?? points;
  return { points, penaltyEnabled, penaltyPoints };
}

/**
 * Calcule la fraction de réussite (0 à 1) d'une question, indépendamment du
 * barème, et si la question a reçu une réponse.
 */
function computeAchievement(
  question: QuizQuestion,
  answer: GradeQuizAnswerDto | undefined,
): { fraction: number; answered: boolean } {
  switch (question.category) {
    case QuizQuestionCategory.SINGLE_CHOICE: {
      const selected = answer?.selectedOptionIds ?? [];
      const answered = selected.length > 0;
      const correctId = (question.correctOptionIds ?? [])[0];
      const isCorrect = selected.length === 1 && selected[0] === correctId;
      return { fraction: isCorrect ? 1 : 0, answered };
    }

    case QuizQuestionCategory.MULTIPLE_CHOICE: {
      const selectedSet = new Set(answer?.selectedOptionIds ?? []);
      const correctSet = new Set(question.correctOptionIds ?? []);
      const answered = selectedSet.size > 0;
      const mode = question.multipleChoiceScoringMode ?? MultipleChoiceScoringMode.ALL_OR_NOTHING;

      if (mode === MultipleChoiceScoringMode.ALL_OR_NOTHING) {
        const isCorrect =
          selectedSet.size === correctSet.size &&
          [...correctSet].every((id) => selectedSet.has(id));
        return { fraction: isCorrect ? 1 : 0, answered };
      }

      // PER_OPTION : chaque case est jugée indépendamment (case correctement
      // cochée OU correctement laissée décochée compte comme réussie).
      const options = question.options ?? [];
      if (options.length === 0) return { fraction: 0, answered };
      let matches = 0;
      for (const option of options) {
        const isCorrectOption = correctSet.has(option.id);
        const isSelected = selectedSet.has(option.id);
        if (isCorrectOption === isSelected) matches += 1;
      }
      return { fraction: matches / options.length, answered };
    }

    case QuizQuestionCategory.SHORT_TEXT: {
      const rawText = answer?.text ?? '';
      const answered = rawText.trim().length > 0;
      const text = rawText.toLowerCase();
      const keywords = question.keywords ?? [];
      if (keywords.length === 0) return { fraction: 0, answered };

      const foundCount = keywords.filter((keyword) => text.includes(keyword.toLowerCase())).length;
      const mode = question.shortTextScoringMode ?? ShortTextScoringMode.ALL_OR_NOTHING;

      if (mode === ShortTextScoringMode.ALL_OR_NOTHING) {
        return { fraction: foundCount === keywords.length ? 1 : 0, answered };
      }
      return { fraction: foundCount / keywords.length, answered };
    }

    default:
      return { fraction: 0, answered: false };
  }
}

/**
 * Note une question : la pénalité ne s'applique que si la question a reçu
 * une réponse et que celle-ci n'a rapporté aucun point (réponse entièrement
 * fausse) — une réponse partiellement correcte ou une absence de réponse
 * n'est jamais pénalisée en plus de son propre manque à gagner.
 */
export function gradeQuestion(
  quiz: Pick<Quiz, 'defaultPoints' | 'penaltyEnabled' | 'penaltyPoints'>,
  question: QuizQuestion,
  answer: GradeQuizAnswerDto | undefined,
): QuizQuestionGradeDetail {
  const { points, penaltyEnabled, penaltyPoints } = resolveEffectiveScoring(quiz, question);
  const { fraction, answered } = computeAchievement(question, answer);

  const rawPoints = fraction * points;
  const isCorrect = fraction === 1;
  const pointsEarned = answered && fraction === 0 && penaltyEnabled ? -penaltyPoints : rawPoints;

  return {
    questionId: question.id,
    isCorrect,
    pointsEarned,
    pointsPossible: points,
  };
}

export function gradeQuiz(
  quiz: Quiz,
  answers: GradeQuizAnswerDto[],
): QuizGradeResult {
  const answersByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer]));
  const orderedQuestions = [...(quiz.questions ?? [])].sort((a, b) => a.order - b.order);

  const details = orderedQuestions.map((question) =>
    gradeQuestion(quiz, question, answersByQuestionId.get(question.id)),
  );

  const score = details.reduce((total, detail) => total + detail.pointsEarned, 0);
  const maxScore = details.reduce((total, detail) => total + detail.pointsPossible, 0);

  return { score, maxScore, details };
}
