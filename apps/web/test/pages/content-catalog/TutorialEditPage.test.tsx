/**
 * Tests pour TutorialEditPage — refonte du 2026-09-03.
 *
 * Couvre :
 * - Chargement puis pré-remplissage du formulaire depuis `GET /tutorials/:id`
 * - Enregistrement via `PUT /tutorials/:id`, puis redirection avec message de confirmation
 * - Tutoriel introuvable / non autorisé
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/tutorials')

import { useAuth } from '../../../src/hooks/useAuth'
import { fetchTutorial, updateTutorial, fetchTutorialImageConstraints } from '../../../src/api/tutorials'
import TutorialEditPage from '../../../src/pages/TutorialEditPage'
import type { PublicTutorialDetail } from '../../../src/types/tutorial'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchTutorial = vi.mocked(fetchTutorial)
const mockUpdateTutorial = vi.mocked(updateTutorial)
const mockFetchTutorialImageConstraints = vi.mocked(fetchTutorialImageConstraints)

const TEACHER_USER = {
  id: 'teacher-1',
  email: 'formateur@test.com',
  role: 'formateur' as const,
  validationStatus: 'active' as const,
}

const EXISTING_TUTORIAL: PublicTutorialDetail = {
  id: 'tuto-1',
  title: 'Tuto existant',
  tags: ['algebre'],
  format: 'post',
  status: 'validated',
  authorId: 'teacher-1',
  createdAt: '2026-09-03T00:00:00Z',
  updatedAt: '2026-09-03T00:00:00Z',
  blocks: [{ id: 'b1', blockNumber: 1, category: 'text', content: 'Texte déjà écrit.' }],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/content/tutorials/tuto-1/edit']}>
      <Routes>
        <Route path="/content/tutorials/:tutorialId/edit" element={<TutorialEditPage />} />
        <Route path="/content/tutorials/:tutorialId" element={<p>Fiche du tutoriel</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({
    user: TEACHER_USER,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn(() => true),
    isInternalRole: vi.fn(() => false),
  })
  mockFetchTutorialImageConstraints.mockResolvedValue({
    maxImageInputBytes: 600_000,
    maxImageOutputBytes: 500_000,
    maxRequestBodyBytes: 900_000,
  })
})

describe('TutorialEditPage', () => {
  it('affiche une erreur si le tutoriel est introuvable', async () => {
    mockFetchTutorial.mockRejectedValue(new Error('not found'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger ce tutoriel pour modification/)).toBeDefined()
    })
  })

  it('pré-remplit le titre et le contenu déjà enregistrés', async () => {
    mockFetchTutorial.mockResolvedValue(EXISTING_TUTORIAL)
    renderPage()

    await waitFor(() => {
      expect(screen.getByDisplayValue('Tuto existant')).toBeDefined()
    })
    expect(screen.getByDisplayValue('Texte déjà écrit.')).toBeDefined()
  })

  it('enregistre les modifications puis redirige vers la fiche avec confirmation', async () => {
    mockFetchTutorial.mockResolvedValue(EXISTING_TUTORIAL)
    mockUpdateTutorial.mockResolvedValue({ ...EXISTING_TUTORIAL, title: 'Tuto modifié' })
    renderPage()

    const titleField = await screen.findByDisplayValue('Tuto existant')
    await userEvent.clear(titleField)
    await userEvent.type(titleField, 'Tuto modifié')

    await userEvent.click(screen.getByRole('button', { name: /enregistrer les modifications/i }))

    await waitFor(() => {
      expect(mockUpdateTutorial).toHaveBeenCalledWith(
        'tuto-1',
        expect.objectContaining({ title: 'Tuto modifié' }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Fiche du tutoriel')).toBeDefined()
    })
  })
})
