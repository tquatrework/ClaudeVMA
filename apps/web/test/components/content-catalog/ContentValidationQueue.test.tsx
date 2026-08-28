/**
 * Tests pour ContentValidationQueue (Phase 12 + Quizz 2026-08-28)
 *
 * Couvre :
 * - Affiche "Aucun contenu" quand les quatre listes sont vides
 * - Affiche les exercices en attente dans l'onglet Exercices
 * - Les boutons Valider/Rejeter déclenchent le callback onValidateContent
 * - La navigation entre onglets fonctionne
 * - Le compteur total des contenus en attente est correct
 * - L'onglet Quizz affiche les quizz en attente et appelle onDecideQuiz
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ContentValidationQueue from '../../../src/components/content-catalog/ContentValidationQueue'
import type { Exercise, Evaluation, Tutorial } from '../../../src/api/contentCatalog'
import type { QuizSummary } from '../../../src/types/quiz'

const PENDING_EXERCISE: Exercise = {
  id: 'ex-1',
  title: 'Limites et continuité',
  description: 'Étude des limites en terminale',
  subject: 'Mathématiques',
  level: 'Terminale',
  difficultyLevel: 'moyen',
  status: 'pending_validation',
  authorId: 'teacher-1',
  hasSolution: true,
  createdAt: '2026-06-15T08:00:00Z',
}

const PENDING_EVALUATION: Evaluation = {
  id: 'eval-1',
  title: 'DS Dérivées',
  description: 'Évaluation sur les dérivées',
  subject: 'Mathématiques',
  level: 'Première',
  difficultyLevel: 'difficile',
  status: 'pending_validation',
  authorId: 'teacher-1',
  hasSolution: true,
  durationMinutes: 60,
  createdAt: '2026-06-15T09:00:00Z',
}

const PENDING_TUTORIAL: Tutorial = {
  id: 'tuto-1',
  title: 'Introduction aux intégrales',
  description: 'Tutoriel vidéo sur les intégrales',
  subject: 'Mathématiques',
  level: 'Terminale',
  status: 'pending_validation',
  authorId: 'teacher-1',
  createdAt: '2026-06-15T10:00:00Z',
}

const PENDING_QUIZ: QuizSummary = {
  id: 'quiz-1',
  title: 'Quiz fractions',
  description: 'Un quiz sur les fractions',
  tags: ['fractions'],
  status: 'pending_validation',
  authorId: 'teacher-1',
  authorRole: 'formateur',
  defaultPoints: 1,
  penaltyEnabled: false,
  penaltyPoints: 0,
  createdAt: '2026-06-15T11:00:00Z',
  updatedAt: '2026-06-15T11:00:00Z',
}

interface RenderQueueOverrides {
  pendingExercises?: Exercise[]
  pendingEvaluations?: Evaluation[]
  pendingTutorials?: Tutorial[]
  pendingQuizzes?: QuizSummary[]
  onValidateContent?: ReturnType<typeof vi.fn>
  onDecideQuiz?: ReturnType<typeof vi.fn>
}

function renderQueue(overrides: RenderQueueOverrides = {}) {
  const onValidateContent = overrides.onValidateContent ?? vi.fn()
  const onDecideQuiz = overrides.onDecideQuiz ?? vi.fn().mockResolvedValue(undefined)

  render(
    <ContentValidationQueue
      pendingExercises={overrides.pendingExercises ?? []}
      pendingEvaluations={overrides.pendingEvaluations ?? []}
      pendingTutorials={overrides.pendingTutorials ?? []}
      pendingQuizzes={overrides.pendingQuizzes ?? []}
      onValidateContent={onValidateContent}
      onDecideQuiz={onDecideQuiz}
    />,
  )

  return { onValidateContent, onDecideQuiz }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ContentValidationQueue', () => {
  it('affiche "Aucun contenu en attente" quand tout est vide', () => {
    renderQueue()

    expect(screen.getByText(/Aucun contenu en attente de validation/)).toBeDefined()
  })

  it('affiche les exercices en attente dans l\'onglet Exercices', () => {
    renderQueue({ pendingExercises: [PENDING_EXERCISE] })

    expect(screen.getByText('Limites et continuité')).toBeDefined()
    expect(screen.getByText('Étude des limites en terminale')).toBeDefined()
  })

  it('affiche le compteur total correct, quizz compris', () => {
    renderQueue({
      pendingExercises: [PENDING_EXERCISE],
      pendingEvaluations: [PENDING_EVALUATION],
      pendingTutorials: [PENDING_TUTORIAL],
      pendingQuizzes: [PENDING_QUIZ],
    })

    expect(screen.getByText('4 contenus en attente')).toBeDefined()
  })

  it('le bouton Valider déclenche onValidateContent avec decision=approve', async () => {
    const { onValidateContent } = renderQueue({ pendingExercises: [PENDING_EXERCISE] })

    await userEvent.click(screen.getByRole('button', { name: /valider/i }))

    expect(onValidateContent).toHaveBeenCalledWith('exercise', 'ex-1', 'approve')
  })

  it('le bouton Rejeter déclenche onValidateContent avec decision=reject', async () => {
    const { onValidateContent } = renderQueue({ pendingExercises: [PENDING_EXERCISE] })

    await userEvent.click(screen.getByRole('button', { name: /rejeter/i }))

    expect(onValidateContent).toHaveBeenCalledWith('exercise', 'ex-1', 'reject')
  })

  it('navigue vers l\'onglet Évaluations et affiche les évaluations en attente', async () => {
    renderQueue({ pendingEvaluations: [PENDING_EVALUATION] })

    await userEvent.click(screen.getByRole('button', { name: /évaluations/i }))

    expect(screen.getByText('DS Dérivées')).toBeDefined()
  })

  it('navigue vers l\'onglet Tutoriels et affiche les tutoriels en attente', async () => {
    renderQueue({ pendingTutorials: [PENDING_TUTORIAL] })

    await userEvent.click(screen.getByRole('button', { name: /tutoriels/i }))

    expect(screen.getByText('Introduction aux intégrales')).toBeDefined()
  })

  it('affiche "Aucun exercice en attente" dans l\'onglet Exercices quand la liste est vide', async () => {
    renderQueue({ pendingEvaluations: [PENDING_EVALUATION] })

    // L'onglet Exercices est actif par défaut
    expect(screen.getByText(/Aucun exercice en attente/)).toBeDefined()
  })

  it('navigue vers l\'onglet Quizz et affiche les quizz en attente', async () => {
    renderQueue({ pendingQuizzes: [PENDING_QUIZ] })

    await userEvent.click(screen.getByRole('button', { name: /quizz/i }))

    expect(screen.getByText('Quiz fractions')).toBeDefined()
  })

  it('le bouton Valider du Quizz appelle onDecideQuiz avec "validated"', async () => {
    const { onDecideQuiz } = renderQueue({ pendingQuizzes: [PENDING_QUIZ] })

    await userEvent.click(screen.getByRole('button', { name: /quizz/i }))
    await userEvent.click(screen.getByRole('button', { name: /valider/i }))

    await waitFor(() => expect(onDecideQuiz).toHaveBeenCalledWith('quiz-1', 'validated'))
  })

  it('le rejet d\'un Quizz exige un commentaire avant confirmation', async () => {
    const { onDecideQuiz } = renderQueue({ pendingQuizzes: [PENDING_QUIZ] })

    await userEvent.click(screen.getByRole('button', { name: /quizz/i }))
    await userEvent.click(screen.getByRole('button', { name: /rejeter/i }))

    const confirmButton = screen.getByRole('button', { name: /confirmer le rejet/i })
    expect(confirmButton).toBeDisabled()

    await userEvent.type(screen.getByPlaceholderText(/Expliquez la raison du rejet/), 'Trop simple')
    expect(confirmButton).toBeEnabled()

    await userEvent.click(confirmButton)

    await waitFor(() =>
      expect(onDecideQuiz).toHaveBeenCalledWith('quiz-1', 'rejected', 'Trop simple'),
    )
  })
})
