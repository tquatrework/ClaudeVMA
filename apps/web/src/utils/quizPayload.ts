/**
 * buildQuizCreatePayload — traduit l'état d'édition de `QuizCreateForm` en payload d'API
 * (`CreateQuizPayload`), ou lève une erreur avec un message français directement affichable.
 *
 * Extrait de `QuizCreateForm.tsx` (> 300 lignes) pour rester lisible et testable isolément.
 */

import type { CreateQuizPayload } from '../types/quiz'
import type { EditableQuizQuestion } from '../components/content-catalog/QuizQuestionEditor'

export function buildQuizCreatePayload(
  title: string,
  description: string,
  tagsInput: string,
  defaultPoints: string,
  penaltyEnabled: boolean,
  penaltyPoints: string,
  questions: EditableQuizQuestion[],
): CreateQuizPayload {
  if (!title.trim()) {
    throw new Error('Le titre est obligatoire.')
  }
  if (questions.length === 0) {
    throw new Error('Ajoutez au moins une question.')
  }

  const builtQuestions = questions.map((question, index) => {
    if (!question.prompt.trim()) {
      throw new Error(`L'énoncé de la question ${index + 1} est vide.`)
    }

    if (question.category === 'single_choice') {
      const correctCount = question.options.filter((o) => o.isCorrect).length
      if (correctCount !== 1) {
        throw new Error(
          `La question ${index + 1} (choix unique) doit avoir exactement une bonne réponse.`,
        )
      }
    }

    if (question.category === 'multiple_choice') {
      const correctCount = question.options.filter((o) => o.isCorrect).length
      if (correctCount === 0) {
        throw new Error(
          `La question ${index + 1} (choix multiples) doit avoir au moins une bonne réponse.`,
        )
      }
    }

    const keywords = question.keywordsInput
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0)

    if (question.category === 'short_text' && keywords.length === 0) {
      throw new Error(`La question ${index + 1} (texte court) doit avoir au moins un mot-clé.`)
    }

    return {
      category: question.category,
      prompt: question.prompt.trim(),
      ...(question.category !== 'short_text'
        ? {
            options: question.options
              .filter((o) => o.text.trim().length > 0)
              .map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })),
          }
        : {}),
      ...(question.category === 'multiple_choice'
        ? { multipleChoiceScoringMode: question.multipleChoiceScoringMode }
        : {}),
      ...(question.category === 'short_text'
        ? { keywords, shortTextScoringMode: question.shortTextScoringMode }
        : {}),
      ...(question.hasOverride && question.pointsOverrideInput.trim() !== ''
        ? { pointsOverride: Number(question.pointsOverrideInput) }
        : {}),
      ...(question.hasOverride
        ? { penaltyEnabledOverride: question.penaltyEnabledOverride }
        : {}),
      ...(question.hasOverride &&
      question.penaltyEnabledOverride &&
      question.penaltyPointsOverrideInput.trim() !== ''
        ? { penaltyPointsOverride: Number(question.penaltyPointsOverrideInput) }
        : {}),
    }
  })

  const tags = tagsInput
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

  return {
    title: title.trim(),
    ...(description.trim() ? { description: description.trim() } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(defaultPoints.trim() !== '' ? { defaultPoints: Number(defaultPoints) } : {}),
    penaltyEnabled,
    ...(penaltyEnabled && penaltyPoints.trim() !== '' ? { penaltyPoints: Number(penaltyPoints) } : {}),
    questions: builtQuestions,
  }
}
