/**
 * Tests pour ExerciseCatalogPage (Phase 12)
 *
 * Couvre :
 * - L'élève voit la liste des exercices publiés
 * - Le formateur voit le bouton "Nouvel exercice"
 * - Un élève ne voit pas le bouton "Nouvel exercice"
 * - Le formateur peut créer un exercice avec une solution (obligatoire)
 * - La création sans solution affiche une erreur de validation
 * - État vide et état d'erreur de chargement
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/contentCatalog')

import { useAuth } from '../../../src/hooks/useAuth'
import { fetchExercises, createExercise } from '../../../src/api/contentCatalog'
import ExerciseCatalogPage from '../../../src/pages/ExerciseCatalogPage'
import type { Exercise } from '../../../src/api/contentCatalog'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchExercises = vi.mocked(fetchExercises)
const mockCreateExercise = vi.mocked(createExercise)

// ─── Fixtures utilisateurs ────────────────────────────────────────────────────

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

const RP_USER = {
  id: 'rp-1',
  email: 'rp@test.com',
  role: 'responsable_pedagogique' as const,
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

// ─── Fixtures exercices ───────────────────────────────────────────────────────

const PUBLISHED_EXERCISE: Exercise = {
  id: 'ex-1',
  title: 'Calcul de dérivées',
  description: 'Exercice sur les dérivées de fonctions polynomiales',
  subject: 'Mathématiques',
  level: 'Terminale',
  difficultyLevel: 'moyen',
  status: 'published',
  authorId: 'teacher-1',
  hasSolution: true,
  createdAt: '2026-06-15T08:00:00Z',
}

const CREATED_EXERCISE: Exercise = {
  id: 'ex-new',
  title: 'Intégrales définies',
  description: 'Calcul d\'intégrales par parties',
  subject: 'Mathématiques',
  level: 'Terminale',
  difficultyLevel: 'difficile',
  status: 'pending_validation',
  authorId: 'teacher-1',
  hasSolution: true,
  createdAt: '2026-06-17T10:00:00Z',
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ExerciseCatalogPage />
    </MemoryRouter>,
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchExercises.mockResolvedValue([])
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExerciseCatalogPage', () => {
  it('affiche l\'état de chargement initialement', () => {
    mockFetchExercises.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Chargement des exercices…')).toBeDefined()
  })

  it('affiche "Aucun exercice disponible" quand la liste est vide', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Aucun exercice disponible/)).toBeDefined()
    })
  })

  it("l'élève voit les exercices publiés", async () => {
    mockFetchExercises.mockResolvedValue([PUBLISHED_EXERCISE])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Calcul de dérivées')).toBeDefined()
    })
  })

  it("l'élève ne voit pas le bouton 'Nouvel exercice'", async () => {
    mockFetchExercises.mockResolvedValue([PUBLISHED_EXERCISE])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Calcul de dérivées')).toBeDefined()
    })

    expect(screen.queryByRole('button', { name: /nouvel exercice/i })).toBeNull()
  })

  it('le formateur voit le bouton "Nouvel exercice"', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    mockFetchExercises.mockResolvedValue([PUBLISHED_EXERCISE])
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nouvel exercice/i })).toBeDefined()
    })
  })

  it('le RP voit le bouton "Nouvel exercice"', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchExercises.mockResolvedValue([])
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nouvel exercice/i })).toBeDefined()
    })
  })

  it('le formateur peut ouvrir le formulaire de création', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    mockFetchExercises.mockResolvedValue([])
    renderPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /nouvel exercice/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /nouvel exercice/i }))

    expect(screen.getByText('Créer un exercice')).toBeDefined()
    expect(screen.getByText(/La solution est obligatoire/)).toBeDefined()
  })

  it('la création sans solution affiche une erreur de validation', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    mockFetchExercises.mockResolvedValue([])
    renderPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /nouvel exercice/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /nouvel exercice/i }))

    // Remplit tout sauf la solution
    await userEvent.type(screen.getByLabelText(/titre/i), 'Mon exercice')
    await userEvent.type(screen.getByLabelText(/matière/i), 'Maths')
    await userEvent.type(screen.getByLabelText(/niveau/i), 'Terminale')
    await userEvent.type(screen.getByLabelText(/énoncé/i), 'Résoudre cette équation')

    await userEvent.click(screen.getByRole('button', { name: /créer l'exercice/i }))

    expect(screen.getByText(/La solution est obligatoire/)).toBeDefined()
    expect(mockCreateExercise).not.toHaveBeenCalled()
  })

  it('le formateur crée un exercice avec solution et voit l\'exercice dans la liste', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    mockFetchExercises.mockResolvedValue([])
    mockCreateExercise.mockResolvedValue(CREATED_EXERCISE)
    renderPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /nouvel exercice/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /nouvel exercice/i }))

    await userEvent.type(screen.getByLabelText(/titre/i), 'Intégrales définies')
    await userEvent.type(screen.getByLabelText(/matière/i), 'Mathématiques')
    await userEvent.type(screen.getByLabelText(/niveau/i), 'Terminale')
    await userEvent.type(screen.getByLabelText(/énoncé/i), 'Calcul d\'intégrales par parties')
    await userEvent.type(screen.getByLabelText(/solution/i), 'La solution détaillée')

    await userEvent.click(screen.getByRole('button', { name: /créer l'exercice/i }))

    await waitFor(() => {
      expect(screen.getByText('Intégrales définies')).toBeDefined()
    })
  })

  it("affiche une erreur si le chargement échoue", async () => {
    mockFetchExercises.mockRejectedValue(new Error('Server error'))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger les exercices/)).toBeDefined()
    })
  })
})
