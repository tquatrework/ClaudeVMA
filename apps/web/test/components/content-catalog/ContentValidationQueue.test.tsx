/**
 * Tests pour ContentValidationQueue.
 *
 * Réécrits le 2026-09-03 (refonte des Tutos/Vidéos) : le composant a évolué au fil des refontes
 * successives (Exercice 2026-08-29, Évaluation 2026-09-02, Tutoriel 2026-09-03) — chaque type de
 * contenu appelle désormais une vraie route de décision via son propre callback `onDecideXxx`, il
 * n'existe plus de mécanisme générique `onValidateContent`. Ce fichier était resté sur les
 * anciennes formes (`Exercise`/`Tutorial` importés de `api/contentCatalog`, prop
 * `onValidateContent`) — remplacé ici par les types réels (`ExerciseSummary`, `Evaluation`,
 * `TutorialSummary`, `QuizSummary`) et les callbacks réels.
 *
 * Couvre :
 * - Affiche "Aucun contenu" quand les quatre listes sont vides
 * - Affiche les exercices en attente dans l'onglet Exercices, et appelle onDecideExercise
 * - La navigation entre onglets fonctionne (évaluations, tutoriels, quizz)
 * - Le compteur total des contenus en attente est correct
 * - L'onglet Tutoriels affiche les tutoriels en attente et appelle onDecideTutorial
 * - L'onglet Quizz affiche les quizz en attente et appelle onDecideQuiz
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ContentValidationQueue from '../../../src/components/content-catalog/ContentValidationQueue'
import type { Evaluation } from '../../../src/types/evaluation'
import type { ExerciseSummary } from '../../../src/types/exercise'
import type { QuizSummary } from '../../../src/types/quiz'
import type { TutorialSummary } from '../../../src/types/tutorial'

const PENDING_EXERCISE: ExerciseSummary = {
  id: 'ex-1',
  title: 'Limites et continuité',
  description: 'Étude des limites en terminale',
  tags: [],
  status: 'pending_validation',
  authorId: 'teacher-1',
  createdAt: '2026-06-15T08:00:00Z',
  updatedAt: '2026-06-15T08:00:00Z',
}

const PENDING_EVALUATION: Evaluation = {
  id: 'eval-1',
  title: 'DS Dérivées',
  description: 'Évaluation sur les dérivées',
  exerciseItems: [],
  tags: [],
  durationSeconds: 3600,
  blockBackNavigation: false,
  status: 'pending_validation',
  authorId: 'teacher-1',
  createdAt: '2026-06-15T09:00:00Z',
  updatedAt: '2026-06-15T09:00:00Z',
}

const PENDING_TUTORIAL: TutorialSummary = {
  id: 'tuto-1',
  title: 'Introduction aux intégrales',
  description: 'Tutoriel vidéo sur les intégrales',
  tags: [],
  format: 'video',
  status: 'pending_validation',
  authorId: 'teacher-1',
  createdAt: '2026-06-15T10:00:00Z',
  updatedAt: '2026-06-15T10:00:00Z',
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
  pendingExercises?: ExerciseSummary[]
  pendingEvaluations?: Evaluation[]
  pendingTutorials?: TutorialSummary[]
  pendingQuizzes?: QuizSummary[]
}

function renderQueue(overrides: RenderQueueOverrides = {}) {
  const onDecideExercise = vi.fn().mockResolvedValue(undefined)
  const onDecideQuiz = vi.fn().mockResolvedValue(undefined)
  const onDecideEvaluation = vi.fn().mockResolvedValue(undefined)
  const onDecideTutorial = vi.fn().mockResolvedValue(undefined)

  render(
    <ContentValidationQueue
      pendingExercises={overrides.pendingExercises ?? []}
      pendingEvaluations={overrides.pendingEvaluations ?? []}
      pendingTutorials={overrides.pendingTutorials ?? []}
      pendingQuizzes={overrides.pendingQuizzes ?? []}
      onDecideExercise={onDecideExercise}
      onDecideQuiz={onDecideQuiz}
      onDecideEvaluation={onDecideEvaluation}
      onDecideTutorial={onDecideTutorial}
    />,
  )

  return { onDecideExercise, onDecideQuiz, onDecideEvaluation, onDecideTutorial }
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

  it('affiche le compteur total correct, quizz et tutoriels compris', () => {
    renderQueue({
      pendingExercises: [PENDING_EXERCISE],
      pendingEvaluations: [PENDING_EVALUATION],
      pendingTutorials: [PENDING_TUTORIAL],
      pendingQuizzes: [PENDING_QUIZ],
    })

    expect(screen.getByText('4 contenus en attente')).toBeDefined()
  })

  it('le bouton Valider d\'un exercice appelle onDecideExercise avec "validated"', async () => {
    const { onDecideExercise } = renderQueue({ pendingExercises: [PENDING_EXERCISE] })

    await userEvent.click(screen.getByRole('button', { name: /valider/i }))

    await waitFor(() => expect(onDecideExercise).toHaveBeenCalledWith('ex-1', 'validated'))
  })

  it('navigue vers l\'onglet Évaluations et affiche les évaluations en attente', async () => {
    renderQueue({ pendingEvaluations: [PENDING_EVALUATION] })

    await userEvent.click(screen.getByRole('button', { name: /évaluations/i }))

    expect(screen.getByText('DS Dérivées')).toBeDefined()
  })

  it('navigue vers l\'onglet Tutoriels, affiche les tutoriels en attente et appelle onDecideTutorial', async () => {
    const { onDecideTutorial } = renderQueue({ pendingTutorials: [PENDING_TUTORIAL] })

    await userEvent.click(screen.getByRole('button', { name: /tutoriels/i }))
    expect(screen.getByText('Introduction aux intégrales')).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: /valider/i }))
    await waitFor(() => expect(onDecideTutorial).toHaveBeenCalledWith('tuto-1', 'validated'))
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
