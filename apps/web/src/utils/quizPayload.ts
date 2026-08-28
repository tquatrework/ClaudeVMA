/**
 * buildQuizCreatePayload — traduit l'état d'édition de `QuizForm` en payload d'API
 * (`CreateQuizPayload`), ou lève une erreur avec un message français directement affichable.
 *
 * Extrait de `QuizForm.tsx` (anciennement `QuizCreateForm.tsx`, > 300 lignes) pour rester
 * lisible et testable isolément.
 */

import type { CreateQuizPayload, PublicQuizDetail } from '../types/quiz'
import {
  createEditableOption,
  type EditableQuizOption,
  type EditableQuizQuestion,
} from '../components/content-catalog/QuizQuestionEditor'

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

// ─── Pré-remplissage du formulaire d'édition (2026-08-28) ─────────────────────

export interface EditableQuizFormState {
  title: string
  description: string
  tagsInput: string
  defaultPoints: string
  penaltyEnabled: boolean
  penaltyPoints: string
  questions: EditableQuizQuestion[]
}

let editQuestionCounter = 0
let editOptionCounter = 0

/**
 * Convertit le détail **public** d'un quizz (`PublicQuizDetail` — `fetchQuiz`, la même route que
 * la lecture normale) en état d'édition pour `QuizForm`.
 *
 * **Vérifié en HTTP direct le 2026-08-28** : aucune route de content-catalog-service ne renvoie
 * la solution à l'auteur (ni `GET /quizzes/:id/edit`, absente, ni un paramètre sur la route
 * publique). En conséquence :
 * - les options de choix (unique/multiple) sont pré-remplies avec leur **texte**, mais
 *   `isCorrect: false` pour toutes — l'auteur doit re-cocher la ou les bonnes réponses ;
 * - les mots-clés d'une question à texte court ne peuvent pas être pré-remplis du tout
 *   (`keywordsInput` reste vide) — l'auteur doit les ressaisir.
 *
 * `hasOverride` reste reconstruit par heuristique à partir du barème/de la pénalité *effectifs*
 * de chaque question (seule donnée non secrète disponible) : un override est supposé dès que la
 * valeur effective diverge du réglage global du quizz.
 */
export function buildEditableStateForEdit(quiz: PublicQuizDetail): EditableQuizFormState {
  const globalDefaultPoints = quiz.defaultPoints ?? 1
  const globalPenaltyEnabled = quiz.penaltyEnabled
  const globalPenaltyPoints = quiz.penaltyPoints ?? 0

  const questions: EditableQuizQuestion[] = quiz.questions.map((question) => {
    editQuestionCounter += 1
    const options: EditableQuizOption[] = (question.options ?? []).map((option) => {
      editOptionCounter += 1
      return {
        localId: `edit-opt-${editOptionCounter}`,
        text: option.text,
        // La solution n'est jamais renvoyée par le serveur, y compris à l'auteur — voir l'en-tête
        // de cette fonction. L'auteur doit re-cocher la ou les bonnes réponses avant d'enregistrer.
        isCorrect: false,
      }
    })

    const hasOverride =
      question.points !== globalDefaultPoints ||
      question.penaltyEnabled !== globalPenaltyEnabled ||
      (question.penaltyEnabled && question.penaltyPoints !== globalPenaltyPoints)

    return {
      localId: `edit-q-${editQuestionCounter}`,
      category: question.category,
      prompt: question.prompt,
      options: options.length > 0 ? options : [createEditableOption(), createEditableOption()],
      // Les mots-clés d'une question à texte court ne sont jamais renvoyés par le serveur —
      // l'auteur doit les ressaisir entièrement.
      keywordsInput: '',
      multipleChoiceScoringMode: question.multipleChoiceScoringMode ?? 'all_or_nothing',
      shortTextScoringMode: question.shortTextScoringMode ?? 'all_or_nothing',
      hasOverride,
      pointsOverrideInput: hasOverride ? String(question.points) : '',
      penaltyEnabledOverride: hasOverride ? question.penaltyEnabled : false,
      penaltyPointsOverrideInput: hasOverride && question.penaltyEnabled ? String(question.penaltyPoints) : '',
    }
  })

  return {
    title: quiz.title,
    description: quiz.description ?? '',
    tagsInput: quiz.tags.join(', '),
    defaultPoints: String(globalDefaultPoints),
    penaltyEnabled: globalPenaltyEnabled,
    penaltyPoints: globalPenaltyEnabled ? String(globalPenaltyPoints) : '',
    questions,
  }
}
