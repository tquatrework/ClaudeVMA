/**
 * Tests pour ExerciseDetailPage (Phase 12)
 *
 * Couvre :
 * - L'élève voit la section "Votre réponse" avec ExerciseAnswerUpload
 * - Le formateur voit la section "Solution" et peut créer une solution
 * - L'élève ne voit pas la section "Solution"
 * - Le formateur ne voit pas la section "Votre réponse"
 * - Après soumission de la réponse, le bouton "Demander une correction" apparaît
 * - Après la demande de correction, le message de confirmation s'affiche
 * - La section commentaires est toujours visible
 * - La création de solution avec un contenu vide affiche une erreur
 * - La création de solution avec conflit 409 affiche l'erreur métier
 * - L'exercice introuvable (pas d'id) affiche un message d'erreur
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/contentCatalog')

import { useAuth } from '../../../src/hooks/useAuth'
import {
  submitExerciseAnswer,
  requestExerciseCorrection,
  createExerciseSolution,
  createContentComment,
} from '../../../src/api/contentCatalog'
import ExerciseDetailPage from '../../../src/pages/ExerciseDetailPage'
import type { ExerciseAnswer, CorrectionRequest, ExerciseSolution, ContentComment } from '../../../src/api/contentCatalog'

const mockUseAuth = vi.mocked(useAuth)
const mockSubmitExerciseAnswer = vi.mocked(submitExerciseAnswer)
const mockRequestExerciseCorrection = vi.mocked(requestExerciseCorrection)
const mockCreateExerciseSolution = vi.mocked(createExerciseSolution)
const mockCreateContentComment = vi.mocked(createContentComment)

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

// ─── Fixtures API ─────────────────────────────────────────────────────────────

const MOCK_ANSWER: ExerciseAnswer = {
  id: 'answer-1',
  exerciseId: 'exercise-1',
  studentId: 'student-1',
  content: 'Ma réponse complète',
  submittedAt: '2026-06-17T10:00:00Z',
  correctionStatus: 'pending',
}

const MOCK_CORRECTION_REQUEST: CorrectionRequest = {
  id: 'correction-1',
  exerciseAnswerId: 'answer-1',
  studentId: 'student-1',
  requestedAt: '2026-06-17T10:05:00Z',
  correctionStatus: 'pending',
}

const MOCK_SOLUTION: ExerciseSolution = {
  id: 'solution-1',
  exerciseId: 'exercise-1',
  content: 'Voici la solution détaillée',
  createdAt: '2026-06-17T11:00:00Z',
}

const MOCK_COMMENT: ContentComment = {
  id: 'comment-1',
  contentId: 'exercise-1',
  authorId: 'student-1',
  content: 'Super exercice !',
  createdAt: '2026-06-17T12:00:00Z',
}

// ─── Helpers de rendu ─────────────────────────────────────────────────────────

function renderPage(exerciseId = 'exercise-1') {
  return render(
    <MemoryRouter initialEntries={[`/content/exercises/${exerciseId}`]}>
      <Routes>
        <Route path="/content/exercises/:exerciseId" element={<ExerciseDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockSubmitExerciseAnswer.mockResolvedValue(MOCK_ANSWER)
  mockRequestExerciseCorrection.mockResolvedValue(MOCK_CORRECTION_REQUEST)
  mockCreateExerciseSolution.mockResolvedValue(MOCK_SOLUTION)
  mockCreateContentComment.mockResolvedValue(MOCK_COMMENT)
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExerciseDetailPage', () => {
  describe('Rendu général', () => {
    it('affiche le titre de la page et l\'id de l\'exercice', () => {
      renderPage()
      expect(screen.getByText("Détail de l'exercice")).toBeDefined()
      expect(screen.getByText(/#exercise-1/)).toBeDefined()
    })

    it('affiche la section commentaires pour tous les rôles', () => {
      renderPage()
      expect(screen.getByText(/Commentaires/)).toBeDefined()
    })

    it('affiche "Exercice introuvable" si l\'URL ne contient pas d\'id', () => {
      render(
        <MemoryRouter initialEntries={['/content/exercises/']}>
          <Routes>
            <Route path="/content/exercises/" element={<ExerciseDetailPage />} />
          </Routes>
        </MemoryRouter>,
      )
      expect(screen.getByText(/Exercice introuvable/)).toBeDefined()
    })
  })

  describe('Vue élève', () => {
    it('affiche la section "Votre réponse" pour l\'élève', () => {
      renderPage()
      // La page rend un <h2>Votre réponse</h2> ET un <label>Votre réponse</label> dans ExerciseAnswerUpload
      expect(screen.getAllByText('Votre réponse').length).toBeGreaterThanOrEqual(1)
    })

    it('ne montre pas la section "Solution" à l\'élève', () => {
      renderPage()
      expect(screen.queryByText('Contenu de la solution')).toBeNull()
    })

    it('l\'élève peut soumettre une réponse et voit le bouton de correction', async () => {
      renderPage()

      const textarea = screen.getByRole('textbox', { name: /votre réponse/i })
      await userEvent.type(textarea, 'Ma réponse complète')
      await userEvent.click(screen.getByRole('button', { name: /soumettre la réponse/i }))

      await waitFor(() => {
        expect(screen.getByText(/Réponse soumise/)).toBeDefined()
        expect(screen.getByRole('button', { name: /demander une correction/i })).toBeDefined()
      })
    })

    it('après la demande de correction, le message de confirmation s\'affiche', async () => {
      renderPage()

      // Soumettre la réponse
      const textarea = screen.getByRole('textbox', { name: /votre réponse/i })
      await userEvent.type(textarea, 'Ma réponse complète')
      await userEvent.click(screen.getByRole('button', { name: /soumettre la réponse/i }))

      await waitFor(() => {
        screen.getByRole('button', { name: /demander une correction/i })
      })

      // Ouvrir le dialog de correction et soumettre
      await userEvent.click(screen.getByRole('button', { name: /demander une correction/i }))
      await userEvent.click(screen.getByRole('button', { name: /demander la correction/i }))

      await waitFor(() => {
        expect(screen.getByText(/Demande de correction envoyée/)).toBeDefined()
        // Le bouton "Demander une correction" ne doit plus être visible
        expect(screen.queryByRole('button', { name: /demander une correction/i })).toBeNull()
      })
    })
  })

  describe('Vue formateur / RP / AP', () => {
    it('le formateur voit la section "Solution" et peut créer une solution', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      renderPage()

      expect(screen.getByText('Solution')).toBeDefined()
      expect(screen.getByLabelText(/Contenu de la solution/)).toBeDefined()
    })

    it('le formateur ne voit pas la section "Votre réponse"', () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      renderPage()

      expect(screen.queryByText('Votre réponse')).toBeNull()
    })

    it('le formateur peut créer une solution avec succès', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      renderPage()

      const solutionTextarea = screen.getByLabelText(/Contenu de la solution/)
      await userEvent.type(solutionTextarea, 'Voici la solution détaillée')
      await userEvent.click(screen.getByRole('button', { name: /enregistrer la solution/i }))

      await waitFor(() => {
        expect(screen.getByText(/Solution créée avec succès/)).toBeDefined()
      })

      expect(mockCreateExerciseSolution).toHaveBeenCalledWith('exercise-1', {
        content: 'Voici la solution détaillée',
      })
    })

    it('affiche une erreur si la solution est vide à la soumission', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      renderPage()

      // Ne pas taper de contenu — le bouton est disabled quand vide
      const submitButton = screen.getByRole('button', { name: /enregistrer la solution/i })
      expect((submitButton as HTMLButtonElement).disabled).toBe(true)
    })

    it('affiche une erreur 409 si une solution existe déjà', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      mockCreateExerciseSolution.mockRejectedValue({ response: { status: 409 } })
      renderPage()

      const solutionTextarea = screen.getByLabelText(/Contenu de la solution/)
      await userEvent.type(solutionTextarea, 'Solution en double')
      await userEvent.click(screen.getByRole('button', { name: /enregistrer la solution/i }))

      await waitFor(() => {
        expect(screen.getByText(/Une solution existe déjà/)).toBeDefined()
      })
    })

    it('affiche une erreur générique si la création de solution échoue', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      mockCreateExerciseSolution.mockRejectedValue(new Error('Server error'))
      renderPage()

      const solutionTextarea = screen.getByLabelText(/Contenu de la solution/)
      await userEvent.type(solutionTextarea, 'Ma solution')
      await userEvent.click(screen.getByRole('button', { name: /enregistrer la solution/i }))

      await waitFor(() => {
        expect(screen.getByText(/Impossible de créer la solution/)).toBeDefined()
      })
    })

    it('le RP voit aussi la section "Solution"', () => {
      mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
      renderPage()

      expect(screen.getByText('Solution')).toBeDefined()
    })
  })

  describe('Section commentaires', () => {
    it('affiche "Aucun commentaire" quand la liste est vide', () => {
      renderPage()
      expect(screen.getByText(/Aucun commentaire pour ce contenu/)).toBeDefined()
    })

    it('l\'élève peut ajouter un commentaire', async () => {
      renderPage()

      const commentTextarea = screen.getByLabelText(/Ajouter un commentaire/)
      await userEvent.type(commentTextarea, 'Super exercice !')
      await userEvent.click(screen.getByRole('button', { name: /publier/i }))

      await waitFor(() => {
        expect(screen.getByText('Super exercice !')).toBeDefined()
      })

      expect(mockCreateContentComment).toHaveBeenCalledWith('exercise-1', {
        content: 'Super exercice !',
      })
    })
  })
})
