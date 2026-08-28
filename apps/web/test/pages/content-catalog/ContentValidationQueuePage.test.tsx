/**
 * Tests pour ContentValidationQueuePage (Phase 12)
 *
 * Couvre :
 * - Le RP voit la file de validation avec les contenus en attente
 * - Un élève voit le message de restriction d'accès
 * - La validation d'un contenu retire l'item de la liste
 * - Le rejet d'un contenu retire l'item de la liste
 * - L'état de chargement est affiché initialement
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/contentCatalog')
vi.mock('../../../src/api/quizzes')

import { useAuth } from '../../../src/hooks/useAuth'
import {
  fetchExercises,
  fetchEvaluations,
  fetchTutorials,
} from '../../../src/api/contentCatalog'
import { fetchPendingQuizzes, decideQuizValidation } from '../../../src/api/quizzes'
import ContentValidationQueuePage from '../../../src/pages/ContentValidationQueuePage'
import type { Exercise } from '../../../src/api/contentCatalog'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchExercises = vi.mocked(fetchExercises)
const mockFetchEvaluations = vi.mocked(fetchEvaluations)
const mockFetchTutorials = vi.mocked(fetchTutorials)
const mockFetchPendingQuizzes = vi.mocked(fetchPendingQuizzes)
const mockDecideQuizValidation = vi.mocked(decideQuizValidation)

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

const RP_USER = {
  id: 'rp-1',
  email: 'rp@test.com',
  role: 'responsable_pedagogique' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock(userObj = RP_USER) {
  return {
    user: userObj,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(userObj.role)),
    isInternalRole: vi.fn(() =>
      (
        [
          'responsable_pedagogique',
          'animateur_pedagogique',
          'technicien_informatique',
          'administrateur_financier',
        ] as string[]
      ).includes(userObj.role),
    ),
  }
}

const PENDING_EXERCISE: Exercise = {
  id: 'ex-pending-1',
  title: 'Exercice en attente de validation',
  description: 'Description de l\'exercice',
  subject: 'Mathématiques',
  level: 'Terminale',
  difficultyLevel: 'moyen',
  status: 'pending_validation',
  authorId: 'teacher-1',
  hasSolution: true,
  createdAt: '2026-06-15T08:00:00Z',
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ContentValidationQueuePage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchExercises.mockResolvedValue([])
  mockFetchEvaluations.mockResolvedValue([])
  mockFetchTutorials.mockResolvedValue([])
  mockFetchPendingQuizzes.mockResolvedValue({ items: [], total: 0 })
  mockDecideQuizValidation.mockResolvedValue(undefined)
})

describe('ContentValidationQueuePage', () => {
  it("affiche l'état de chargement initialement pour le RP", () => {
    mockFetchExercises.mockReturnValue(new Promise(() => {}))
    mockFetchEvaluations.mockReturnValue(new Promise(() => {}))
    mockFetchTutorials.mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByText(/Chargement des contenus en attente/)).toBeDefined()
  })

  it('le RP voit la page de validation', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Validation des contenus')).toBeDefined()
    })
  })

  it('un élève voit le message de restriction', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Accès réservé aux Responsables Pédagogiques/)).toBeDefined()
    })
  })

  it('le RP voit les exercices en attente de validation', async () => {
    mockFetchExercises.mockResolvedValue([PENDING_EXERCISE])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Exercice en attente de validation')).toBeDefined()
    })
  })

  it('valider un exercice l\'efface de la liste et affiche un feedback', async () => {
    mockFetchExercises.mockResolvedValue([PENDING_EXERCISE])
    renderPage()

    await waitFor(() => {
      screen.getByText('Exercice en attente de validation')
    })

    await userEvent.click(screen.getByRole('button', { name: /valider/i }))

    await waitFor(() => {
      expect(screen.queryByText('Exercice en attente de validation')).toBeNull()
      expect(screen.getByText(/Contenu validé avec succès/)).toBeDefined()
    })
  })

  it('rejeter un exercice l\'efface de la liste et affiche un feedback', async () => {
    mockFetchExercises.mockResolvedValue([PENDING_EXERCISE])
    renderPage()

    await waitFor(() => {
      screen.getByText('Exercice en attente de validation')
    })

    await userEvent.click(screen.getByRole('button', { name: /rejeter/i }))

    await waitFor(() => {
      expect(screen.queryByText('Exercice en attente de validation')).toBeNull()
      expect(screen.getByText(/Contenu rejeté avec succès/)).toBeDefined()
    })
  })

  it('affiche une erreur si le chargement échoue', async () => {
    mockFetchExercises.mockRejectedValue(new Error('Server error'))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger les contenus en attente/)).toBeDefined()
    })
  })

  it("l'échec du chargement des quizz n'empêche pas d'afficher les autres contenus", async () => {
    mockFetchExercises.mockResolvedValue([PENDING_EXERCISE])
    mockFetchPendingQuizzes.mockRejectedValue(new Error('Server error'))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Exercice en attente de validation')).toBeDefined()
      expect(screen.getByText(/Impossible de charger les quizz en attente/)).toBeDefined()
    })
  })

  it('valider un quizz appelle decideQuizValidation et affiche un feedback', async () => {
    mockFetchPendingQuizzes.mockResolvedValue({
      items: [
        {
          id: 'quiz-1',
          title: 'Quiz en attente',
          description: 'Un quiz',
          tags: [],
          status: 'pending_validation',
          authorId: 'teacher-1',
          authorRole: 'formateur',
          defaultPoints: 1,
          penaltyEnabled: false,
          penaltyPoints: 0,
          createdAt: '2026-06-15T08:00:00Z',
          updatedAt: '2026-06-15T08:00:00Z',
        },
      ],
      total: 1,
    })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Quizz \(1\)/)).toBeDefined()
    })
    await userEvent.click(screen.getByRole('button', { name: /Quizz \(1\)/ }))
    await userEvent.click(screen.getByRole('button', { name: /valider/i }))

    await waitFor(() => {
      expect(mockDecideQuizValidation).toHaveBeenCalledWith('quiz-1', 'approve', undefined)
      expect(screen.getByText(/Quizz validé avec succès/)).toBeDefined()
    })
  })
})
