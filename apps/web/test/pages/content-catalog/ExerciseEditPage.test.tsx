/**
 * Tests pour ExerciseEditPage — correctif du 2026-09-01 (« après l'enregistrement d'une
 * modification d'Exercice, retour à l'écran précédent avec confirmation »).
 *
 * Couvre : un enregistrement réussi navigue vers la fiche de l'exercice avec un message de
 * confirmation porté par `location.state`, sur le même mécanisme déjà en place pour l'inscription
 * (`LoginPage`).
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../../src/api/exercises')
vi.mock('../../../src/hooks/useAuth')

import {
  fetchExerciseForEdit,
  fetchExerciseImageConstraints,
  updateExercise,
} from '../../../src/api/exercises'
import { useAuth } from '../../../src/hooks/useAuth'
import ExerciseEditPage from '../../../src/pages/ExerciseEditPage'
import type { AuthorExerciseDetail, PublicExerciseDetail } from '../../../src/types/exercise'

const mockFetchExerciseForEdit = vi.mocked(fetchExerciseForEdit)
const mockFetchExerciseImageConstraints = vi.mocked(fetchExerciseImageConstraints)
const mockUpdateExercise = vi.mocked(updateExercise)
const mockUseAuth = vi.mocked(useAuth)

const EXERCISE: AuthorExerciseDetail = {
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
      solution: { items: [{ id: 's1', type: 'text', order: 0, content: 'Solution' }] },
    },
  ],
}

const SAVED_EXERCISE: PublicExerciseDetail = {
  ...EXERCISE,
  parts: EXERCISE.parts.map(({ id, partNumber, category, items, hasSolution }) => ({
    id,
    partNumber,
    category,
    items,
    hasSolution,
  })),
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/content/exercises/ex-1/edit']}>
      <Routes>
        <Route path="/content/exercises/:exerciseId/edit" element={<ExerciseEditPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({
    user: { id: 'author-1', email: 'formateur@test.com', role: 'formateur', validationStatus: 'active' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn(() => true),
    isInternalRole: vi.fn(() => false),
  } as unknown as ReturnType<typeof useAuth>)
  mockFetchExerciseForEdit.mockResolvedValue({ exercise: EXERCISE, solutionsPrefilled: true })
  mockFetchExerciseImageConstraints.mockResolvedValue({
    maxImageInputBytes: 600000,
    maxImageOutputBytes: 500000,
    maxRequestBodyBytes: 900000,
  })
  mockUpdateExercise.mockResolvedValue(SAVED_EXERCISE)
})

describe('ExerciseEditPage', () => {
  it("navigue vers la fiche de l'exercice avec un message de confirmation après un enregistrement réussi", async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByDisplayValue('Un exercice')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /enregistrer les modifications/i }))

    await waitFor(() => {
      expect(mockUpdateExercise).toHaveBeenCalledWith('ex-1', expect.any(Object))
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/content/exercises/ex-1', {
        state: { message: 'Modifications enregistrées.' },
      })
    })
  })
})
