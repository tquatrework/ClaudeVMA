/**
 * Tests pour ExerciseDetailPage — bandeau de confirmation affiché après une navigation depuis
 * `ExerciseEditPage` (correctif du 2026-09-01, « retour à l'écran précédent avec confirmation »).
 *
 * Fichier dédié plutôt qu'ajout à `ExerciseDetailPage.test.tsx` : ce dernier teste un modèle
 * d'Exercice antérieur à la refonte du 2026-08-29 (mocks `api/contentCatalog`, page
 * `"Détail de l'exercice"` qui n'existe plus) — voir dette technique déjà signalée dans les
 * rapports de session `content-catalog-service`/`front-developper`.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/exercises')

import { useAuth } from '../../../src/hooks/useAuth'
import { fetchExercise } from '../../../src/api/exercises'
import ExerciseDetailPage from '../../../src/pages/ExerciseDetailPage'
import type { PublicExerciseDetail } from '../../../src/types/exercise'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchExercise = vi.mocked(fetchExercise)

const EXERCISE: PublicExerciseDetail = {
  id: 'ex-1',
  title: 'Un exercice',
  tags: [],
  status: 'validated',
  authorId: 'author-1',
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
  parts: [
    {
      id: 'part-statement',
      partNumber: 1,
      category: 'statement',
      items: [{ id: 'i1', type: 'text', order: 0, content: 'Énoncé' }],
      hasSolution: false,
    },
    {
      id: 'part-question',
      partNumber: 2,
      category: 'question',
      items: [{ id: 'i2', type: 'text', order: 0, content: 'Question' }],
      hasSolution: true,
    },
  ],
}

function buildAuthMock() {
  return {
    user: { id: 'author-1', email: 'formateur@test.com', role: 'formateur' as const, validationStatus: 'active' as const },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn(() => true),
    isInternalRole: vi.fn(() => false),
  }
}

function renderPage(locationState?: unknown) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: '/content/exercises/ex-1', state: locationState }]}
    >
      <Routes>
        <Route path="/content/exercises/:exerciseId" element={<ExerciseDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchExercise.mockResolvedValue(EXERCISE)
})

describe('ExerciseDetailPage — bandeau de confirmation post-édition', () => {
  it('affiche le message de confirmation reçu via location.state après une édition', async () => {
    renderPage({ message: 'Modifications enregistrées.' })

    await waitFor(() => {
      expect(screen.getByText('Modifications enregistrées.')).toBeDefined()
    })
  })

  it("n'affiche aucun bandeau de confirmation en l'absence de location.state", async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Un exercice')).toBeDefined()
    })

    expect(screen.queryByText('Modifications enregistrées.')).toBeNull()
  })
})
