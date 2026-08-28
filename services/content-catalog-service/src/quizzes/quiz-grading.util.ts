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
 * Notation "unique" (all_or_nothing) : le barème entier est gagné si la
 * réponse est intégralement correcte, sinon la pénalité (si activée et si la
 * question a reçu une réponse) s'applique une seule fois — jamais de second
 * niveau de pénalité par-dessus (arbitrage du 2026-08-28, point "notation par
 * item").
 */
function scoreUnique(
  points: number,
  penaltyEnabled: boolean,
  penaltyPoints: number,
  isCorrect: boolean,
  answered: boolean,
): number {
  if (isCorrect) return points;
  if (answered && penaltyEnabled) return -penaltyPoints;
  return 0;
}

/**
 * Note une question : la pénalité s'applique au même niveau que le barème
 * choisi, jamais aux deux à la fois (arbitrage du 2026-08-28).
 *
 * - Notation "unique" (all_or_nothing) : cf. scoreUnique ci-dessus.
 * - Notation "par item" (per_option / per_keyword) : le barème de la question
 *   se répartit à parts égales entre les items attendus (le nombre de bonnes
 *   réponses à cocher pour un choix multiple, le nombre de mots-clés pour une
 *   réponse texte). Cocher une case correcte, ou retrouver un mot-clé,
 *   rapporte cette part ; une case incorrecte cochée ou un mot-clé absent ne
 *   rapporte rien. En choix multiples, une pénalité active s'applique par
 *   item incorrect (une case cochée à tort), pour le même montant réparti que
 *   le barème (penaltyPoints / nombre d'items attendus) — non applicable au
 *   texte, qui n'a pas de notion d'item "incorrect" saisi par l'utilisateur
 *   au-delà des mots-clés absents, lesquels ne rapportent simplement rien.
 * - Le score d'une question peut devenir négatif si les pénalités dépassent
 *   les points gagnés ; aucun plancher à zéro n'est introduit.
 */
export function gradeQuestion(
  quiz: Pick<Quiz, 'defaultPoints' | 'penaltyEnabled' | 'penaltyPoints'>,
  question: QuizQuestion,
  answer: GradeQuizAnswerDto | undefined,
): QuizQuestionGradeDetail {
  const { points, penaltyEnabled, penaltyPoints } = resolveEffectiveScoring(quiz, question);

  switch (question.category) {
    case QuizQuestionCategory.SINGLE_CHOICE: {
      const selected = answer?.selectedOptionIds ?? [];
      const answered = selected.length > 0;
      const correctId = (question.correctOptionIds ?? [])[0];
      const isCorrect = selected.length === 1 && selected[0] === correctId;
      return {
        questionId: question.id,
        isCorrect,
        pointsEarned: scoreUnique(points, penaltyEnabled, penaltyPoints, isCorrect, answered),
        pointsPossible: points,
      };
    }

    case QuizQuestionCategory.MULTIPLE_CHOICE: {
      const selectedSet = new Set(answer?.selectedOptionIds ?? []);
      const correctSet = new Set(question.correctOptionIds ?? []);
      const answered = selectedSet.size > 0;
      const mode = question.multipleChoiceScoringMode ?? MultipleChoiceScoringMode.ALL_OR_NOTHING;

      const isCorrect =
        selectedSet.size === correctSet.size && [...correctSet].every((id) => selectedSet.has(id));

      if (mode === MultipleChoiceScoringMode.ALL_OR_NOTHING) {
        return {
          questionId: question.id,
          isCorrect,
          pointsEarned: scoreUnique(points, penaltyEnabled, penaltyPoints, isCorrect, answered),
          pointsPossible: points,
        };
      }

      // PER_OPTION : le barème se répartit à parts égales entre les items
      // attendus (les options correctes), pas entre toutes les options.
      const numExpectedItems = correctSet.size;
      if (numExpectedItems === 0) {
        return { questionId: question.id, isCorrect, pointsEarned: 0, pointsPossible: points };
      }
      const correctlySelectedCount = [...selectedSet].filter((id) => correctSet.has(id)).length;
      const incorrectlySelectedCount = selectedSet.size - correctlySelectedCount;
      const pointsPerItem = points / numExpectedItems;
      const penaltyPerItem = penaltyEnabled ? penaltyPoints / numExpectedItems : 0;
      const pointsEarned = correctlySelectedCount * pointsPerItem - incorrectlySelectedCount * penaltyPerItem;

      return { questionId: question.id, isCorrect, pointsEarned, pointsPossible: points };
    }

    case QuizQuestionCategory.SHORT_TEXT: {
      const rawText = answer?.text ?? '';
      const answered = rawText.trim().length > 0;
      const text = rawText.toLowerCase();
      const keywords = question.keywords ?? [];
      if (keywords.length === 0) {
        return { questionId: question.id, isCorrect: false, pointsEarned: 0, pointsPossible: points };
      }

      const foundCount = keywords.filter((keyword) => text.includes(keyword.toLowerCase())).length;
      const isCorrect = foundCount === keywords.length;
      const mode = question.shortTextScoringMode ?? ShortTextScoringMode.ALL_OR_NOTHING;

      if (mode === ShortTextScoringMode.ALL_OR_NOTHING) {
        return {
          questionId: question.id,
          isCorrect,
          pointsEarned: scoreUnique(points, penaltyEnabled, penaltyPoints, isCorrect, answered),
          pointsPossible: points,
        };
      }

      // PER_KEYWORD : chaque mot-clé attendu rapporte sa part de points ; un
      // mot-clé absent ne rapporte simplement rien, jamais de pénalité —
      // le texte libre n'a pas de notion d'item "incorrect" saisi par
      // l'utilisateur (arbitrage du 2026-08-28).
      const pointsEarned = points * (foundCount / keywords.length);
      return { questionId: question.id, isCorrect, pointsEarned, pointsPossible: points };
    }

    default:
      return { questionId: question.id, isCorrect: false, pointsEarned: 0, pointsPossible: 0 };
  }
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
