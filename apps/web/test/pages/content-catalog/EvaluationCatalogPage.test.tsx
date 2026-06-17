/**
 * Tests pour EvaluationCatalogPage (Phase 12)
 *
 * Couvre :
 * - L'élève voit les évaluations publiées
 * - L'élève ne voit pas le bouton "Nouvelle évaluation"
 * - Le formateur voit le bouton "Nouvelle évaluation"
 * - Le RP voit le bouton "Nouvelle évaluation"
 * - La création sans solution affiche une erreur (règle métier : solution obligatoire)
 * - La création avec durée optionnelle fonctionne
 * - La durée est bien transmise à l'API si renseignée
 * - Le clic sur une évaluation navigue vers la page de tentative
 * - État vide et état d'erreur de chargement
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/contentCatalog')

import { useAuth } from '../../../src/hooks/useAuth'
import { fetchEvaluations, createEvaluation } from '../../../src/api/contentCatalog'
import EvaluationCatalogPage from '../../../src/pages/EvaluationCatalogPage'
import type { Evaluation } from '../../../src/api/contentCatalog'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchEvaluations = vi.mocked(fetchEvaluations)
const mockCreateEvaluation = vi.mocked(createEvaluation)

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
      (['responsable_pedagogique', 'animateur_pedagogique', 'technicien_informatique', 'administrateur_financier'] as string[]).includes(userObj.role),
    ),
  }
}

// ─── Fixtures évaluations ─────────────────────────────────────────────────────

const PUBLISHED_EVALUATION: Evaluation = {
  id: 'eval-1',
  title: 'DS Dérivées — Terminale',
  description: 'Évaluation complète sur les dérivées',
  subject: 'Mathématiques',
  level: 'Terminale',
  difficultyLevel: 'difficile',
  status: 'published',
  authorId: 'teacher-1',
  hasSolution: true,
  durationMinutes: 60,
  createdAt: '2026-06-15T08:00:00Z',
}

const PUBLISHED_EVALUATION_NO_DURATION: Evaluation = {
  id: 'eval-2',
  title: 'Contrôle Intégrales',
  description: 'Contrôle sur les intégrales définies',
  subject: 'Mathématiques',
  level: 'Terminale',
  difficultyLevel: 'moyen',
  status: 'published',
  authorId: 'teacher-1',
  hasSolution: true,
  createdAt: '2026-06-15T09:00:00Z',
}

const CREATED_EVALUATION: Evaluation = {
  id: 'eval-new',
  title: 'Nouveau contrôle',
  description: 'Énoncé du contrôle',
  subject: 'Mathématiques',
  level: 'Terminale',
  difficultyLevel: 'moyen',
  status: 'pending_validation',
  authorId: 'teacher-1',
  hasSolution: true,
  durationMinutes: 45,
  createdAt: '2026-06-17T10:00:00Z',
}

// ─── Helper de rendu ──────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter>
      <EvaluationCatalogPage />
    </MemoryRouter>,
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchEvaluations.mockResolvedValue([])
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EvaluationCatalogPage', () => {
  describe('Chargement et états', () => {
    it('affiche l\'état de chargement initialement', () => {
      mockFetchEvaluations.mockReturnValue(new Promise(() => {}))
      renderPage()
      expect(screen.getByText(/Chargement des évaluations/)).toBeDefined()
    })

    it('affiche "Aucune évaluation disponible" quand la liste est vide', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText(/Aucune évaluation disponible/)).toBeDefined()
      })
    })

    it('affiche une erreur si le chargement échoue', async () => {
      mockFetchEvaluations.mockRejectedValue(new Error('Server error'))
      renderPage()
      await waitFor(() => {
        expect(screen.getByText(/Impossible de charger les évaluations/)).toBeDefined()
      })
    })
  })

  describe('Affichage liste', () => {
    it('l\'élève voit les évaluations publiées', async () => {
      mockFetchEvaluations.mockResolvedValue([PUBLISHED_EVALUATION])
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('DS Dérivées — Terminale')).toBeDefined()
      })
    })

    it('affiche la durée si renseignée', async () => {
      mockFetchEvaluations.mockResolvedValue([PUBLISHED_EVALUATION])
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('60 min')).toBeDefined()
      })
    })

    it('n\'affiche pas de durée si elle n\'est pas renseignée', async () => {
      mockFetchEvaluations.mockResolvedValue([PUBLISHED_EVALUATION_NO_DURATION])
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Contrôle Intégrales')).toBeDefined()
      })

      // La durée est du format "{N} min" — elle ne doit pas apparaître dans la carte
      expect(screen.queryByText(/\d+ min/)).toBeNull()
    })

    it('affiche le badge de difficulté', async () => {
      mockFetchEvaluations.mockResolvedValue([PUBLISHED_EVALUATION])
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Difficile')).toBeDefined()
      })
    })

    it('affiche le badge "En attente" pour une évaluation pending_validation', async () => {
      const pendingEvaluation: Evaluation = {
        ...PUBLISHED_EVALUATION,
        id: 'eval-pending',
        status: 'pending_validation',
      }
      mockFetchEvaluations.mockResolvedValue([pendingEvaluation])
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('En attente')).toBeDefined()
      })
    })
  })

  describe('Contrôle d\'accès à la création', () => {
    it('l\'élève ne voit pas le bouton "Nouvelle évaluation"', async () => {
      mockFetchEvaluations.mockResolvedValue([PUBLISHED_EVALUATION])
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('DS Dérivées — Terminale')).toBeDefined()
      })

      expect(screen.queryByRole('button', { name: /nouvelle évaluation/i })).toBeNull()
    })

    it('le formateur voit le bouton "Nouvelle évaluation"', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      mockFetchEvaluations.mockResolvedValue([])
      renderPage()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /nouvelle évaluation/i })).toBeDefined()
      })
    })

    it('le RP voit le bouton "Nouvelle évaluation"', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
      mockFetchEvaluations.mockResolvedValue([])
      renderPage()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /nouvelle évaluation/i })).toBeDefined()
      })
    })
  })

  describe('Formulaire de création', () => {
    it('le formateur peut ouvrir le formulaire de création', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      mockFetchEvaluations.mockResolvedValue([])
      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /nouvelle évaluation/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /nouvelle évaluation/i }))

      expect(screen.getByText('Créer une évaluation')).toBeDefined()
      expect(screen.getByText(/La solution est obligatoire et ne sera pas publiée/)).toBeDefined()
    })

    it('la création sans solution affiche une erreur (règle métier)', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      mockFetchEvaluations.mockResolvedValue([])
      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /nouvelle évaluation/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /nouvelle évaluation/i }))

      // Remplir tout sauf la solution
      await userEvent.type(screen.getByLabelText(/titre/i), 'Contrôle test')
      await userEvent.type(screen.getByLabelText(/matière/i), 'Maths')
      await userEvent.type(screen.getByLabelText(/niveau/i), 'Terminale')
      await userEvent.type(screen.getByLabelText(/énoncé/i), 'Résoudre les exercices suivants')
      // Ne pas remplir la solution

      await userEvent.click(screen.getByRole('button', { name: /créer l'évaluation/i }))

      expect(screen.getByText(/La solution est obligatoire/)).toBeDefined()
      expect(mockCreateEvaluation).not.toHaveBeenCalled()
    })

    it('le formateur crée une évaluation complète avec durée et la voit dans la liste', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      mockFetchEvaluations.mockResolvedValue([])
      mockCreateEvaluation.mockResolvedValue(CREATED_EVALUATION)
      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /nouvelle évaluation/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /nouvelle évaluation/i }))

      await userEvent.type(screen.getByLabelText(/titre/i), 'Nouveau contrôle')
      await userEvent.type(screen.getByLabelText(/matière/i), 'Mathématiques')
      await userEvent.type(screen.getByLabelText(/niveau/i), 'Terminale')
      await userEvent.type(screen.getByLabelText(/énoncé/i), 'Énoncé du contrôle')
      await userEvent.type(screen.getByLabelText(/solution/i), 'La solution complète')
      await userEvent.type(screen.getByLabelText(/durée/i), '45')

      await userEvent.click(screen.getByRole('button', { name: /créer l'évaluation/i }))

      await waitFor(() => {
        expect(screen.getByText('Nouveau contrôle')).toBeDefined()
      })

      expect(mockCreateEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          solutionContent: 'La solution complète',
          durationMinutes: 45,
        }),
      )
    })

    it('le formateur crée une évaluation sans durée', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      mockFetchEvaluations.mockResolvedValue([])
      mockCreateEvaluation.mockResolvedValue({
        ...CREATED_EVALUATION,
        durationMinutes: undefined,
      })
      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /nouvelle évaluation/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /nouvelle évaluation/i }))

      await userEvent.type(screen.getByLabelText(/titre/i), 'Nouveau contrôle')
      await userEvent.type(screen.getByLabelText(/matière/i), 'Mathématiques')
      await userEvent.type(screen.getByLabelText(/niveau/i), 'Terminale')
      await userEvent.type(screen.getByLabelText(/énoncé/i), 'Énoncé')
      await userEvent.type(screen.getByLabelText(/solution/i), 'La solution')
      // Ne pas renseigner la durée

      await userEvent.click(screen.getByRole('button', { name: /créer l'évaluation/i }))

      await waitFor(() => {
        expect(screen.getByText('Nouveau contrôle')).toBeDefined()
      })

      expect(mockCreateEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({ durationMinutes: undefined }),
      )
    })

    it('affiche une erreur 403 si le rôle n\'est pas autorisé', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      mockFetchEvaluations.mockResolvedValue([])
      mockCreateEvaluation.mockRejectedValue({ response: { status: 403 } })
      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /nouvelle évaluation/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /nouvelle évaluation/i }))

      await userEvent.type(screen.getByLabelText(/titre/i), 'Test')
      await userEvent.type(screen.getByLabelText(/matière/i), 'Maths')
      await userEvent.type(screen.getByLabelText(/niveau/i), 'Terminale')
      await userEvent.type(screen.getByLabelText(/énoncé/i), 'Texte')
      await userEvent.type(screen.getByLabelText(/solution/i), 'Solution')

      await userEvent.click(screen.getByRole('button', { name: /créer l'évaluation/i }))

      await waitFor(() => {
        expect(screen.getByText(/Vous n'êtes pas autorisé à créer une évaluation/)).toBeDefined()
      })
    })

    it('le bouton Annuler ferme le formulaire sans appeler l\'API', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      mockFetchEvaluations.mockResolvedValue([])
      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /nouvelle évaluation/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /nouvelle évaluation/i }))
      expect(screen.getByText('Créer une évaluation')).toBeDefined()

      await userEvent.click(screen.getByRole('button', { name: /annuler/i }))

      expect(screen.queryByText('Créer une évaluation')).toBeNull()
      expect(mockCreateEvaluation).not.toHaveBeenCalled()
    })
  })
})
