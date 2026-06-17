/**
 * Tests pour EvaluationAttemptPage (Phase 12)
 *
 * Couvre :
 * - L'élève voit l'étape "non démarrée" au chargement
 * - Le message de blocage de la solution est affiché avant soumission
 * - L'élève peut démarrer l'évaluation
 * - La solution reste bloquée pendant l'évaluation en cours
 * - La soumission affiche le message de succès
 * - Un non-élève voit le message de restriction
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/contentCatalog')

import { useAuth } from '../../../src/hooks/useAuth'
import { startEvaluationAttempt } from '../../../src/api/contentCatalog'
import EvaluationAttemptPage from '../../../src/pages/EvaluationAttemptPage'
import type { EvaluationAttempt } from '../../../src/api/contentCatalog'

const mockUseAuth = vi.mocked(useAuth)
const mockStartEvaluationAttempt = vi.mocked(startEvaluationAttempt)

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

const TEACHER_USER = {
  id: 'teacher-1',
  email: 'formateur@test.com',
  role: 'formateur' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock(userObj = STUDENT_USER) {
  return {
    user: userObj,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(userObj.role)),
    isInternalRole: vi.fn(() => false),
  }
}

const COMPLETED_ATTEMPT: EvaluationAttempt = {
  id: 'attempt-1',
  evaluationId: 'eval-1',
  studentId: 'student-1',
  answers: 'Mes réponses détaillées',
  startedAt: '2026-06-17T10:00:00Z',
  completedAt: '2026-06-17T11:00:00Z',
  score: undefined,
  isSolutionUnlocked: false,
}

const COMPLETED_ATTEMPT_WITH_SOLUTION: EvaluationAttempt = {
  ...COMPLETED_ATTEMPT,
  isSolutionUnlocked: true,
  score: 85,
}

function renderPage(evaluationId = 'eval-1') {
  return render(
    <MemoryRouter initialEntries={[`/content/evaluations/${evaluationId}/attempt`]}>
      <Routes>
        <Route
          path="/content/evaluations/:evaluationId/attempt"
          element={<EvaluationAttemptPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
})

describe('EvaluationAttemptPage', () => {
  it("l'élève voit l'étape 'non démarrée' avec le bouton de démarrage", () => {
    renderPage()

    expect(screen.getByText(/Commencer l'évaluation/)).toBeDefined()
    expect(screen.getByText(/La solution sera débloquée uniquement après soumission/)).toBeDefined()
  })

  it("l'élève peut démarrer l'évaluation", async () => {
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: /commencer l'évaluation/i }))

    expect(screen.getByText(/Évaluation en cours/)).toBeDefined()
    expect(screen.getByLabelText(/vos réponses/i)).toBeDefined()
  })

  it('la solution reste bloquée pendant l\'évaluation en cours', async () => {
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: /commencer l'évaluation/i }))

    expect(screen.getByText(/Solution bloquée — disponible après soumission/)).toBeDefined()
  })

  it("l'élève soumet l'évaluation et voit le message de succès", async () => {
    mockStartEvaluationAttempt.mockResolvedValue(COMPLETED_ATTEMPT)
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: /commencer l'évaluation/i }))

    const answersTextarea = screen.getByLabelText(/vos réponses/i)
    await userEvent.type(answersTextarea, 'Mes réponses détaillées')

    await userEvent.click(screen.getByRole('button', { name: /soumettre l'évaluation/i }))

    await waitFor(() => {
      expect(screen.getByText(/Évaluation soumise avec succès/)).toBeDefined()
    })
  })

  it('affiche le score après soumission si disponible', async () => {
    mockStartEvaluationAttempt.mockResolvedValue(COMPLETED_ATTEMPT_WITH_SOLUTION)
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: /commencer l'évaluation/i }))
    await userEvent.type(screen.getByLabelText(/vos réponses/i), 'Mes réponses')
    await userEvent.click(screen.getByRole('button', { name: /soumettre l'évaluation/i }))

    await waitFor(() => {
      expect(screen.getByText(/85/)).toBeDefined()
    })
  })

  it('débloque la solution si isSolutionUnlocked=true après soumission', async () => {
    mockStartEvaluationAttempt.mockResolvedValue(COMPLETED_ATTEMPT_WITH_SOLUTION)
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: /commencer l'évaluation/i }))
    await userEvent.type(screen.getByLabelText(/vos réponses/i), 'Mes réponses')
    await userEvent.click(screen.getByRole('button', { name: /soumettre l'évaluation/i }))

    await waitFor(() => {
      expect(screen.getByText('Solution')).toBeDefined()
    })
  })

  it('affiche le message de restriction pour les non-élèves', () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    renderPage()

    expect(screen.getByText(/Seuls les élèves peuvent passer une évaluation/)).toBeDefined()
    expect(screen.queryByRole('button', { name: /commencer l'évaluation/i })).toBeNull()
  })

  it('affiche une erreur 403 lors de la soumission', async () => {
    mockStartEvaluationAttempt.mockRejectedValue({ response: { status: 403 } })
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: /commencer l'évaluation/i }))
    await userEvent.type(screen.getByLabelText(/vos réponses/i), 'Mes réponses')
    await userEvent.click(screen.getByRole('button', { name: /soumettre l'évaluation/i }))

    await waitFor(() => {
      expect(screen.getByText(/Vous n'êtes pas autorisé/)).toBeDefined()
    })
  })
})
