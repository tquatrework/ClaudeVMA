/**
 * Tests pour TutorialDetailPage — refonte du 2026-09-03.
 *
 * Couvre :
 * - Chargement / erreur
 * - Rendu du format vidéo (lien « Regarder la vidéo »)
 * - Rendu du format post (blocs titre/texte)
 * - Bouton « Modifier le tutoriel » visible seulement pour l'auteur
 * - Bandeau + bouton « Passer le quizz » quand un quizz est lié
 */

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/tutorials')

import { useAuth } from '../../../src/hooks/useAuth'
import { fetchTutorial } from '../../../src/api/tutorials'
import TutorialDetailPage from '../../../src/pages/TutorialDetailPage'
import type { PublicTutorialDetail } from '../../../src/types/tutorial'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchTutorial = vi.mocked(fetchTutorial)

const TEACHER_USER = {
  id: 'teacher-1',
  email: 'formateur@test.com',
  role: 'formateur' as const,
  validationStatus: 'active' as const,
}

const OTHER_USER = { ...TEACHER_USER, id: 'someone-else' }

function buildAuthMock(userObj = TEACHER_USER) {
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

const VIDEO_TUTORIAL: PublicTutorialDetail = {
  id: 'tuto-1',
  title: 'Tuto vidéo',
  tags: [],
  format: 'video',
  status: 'validated',
  authorId: 'teacher-1',
  createdAt: '2026-09-03T00:00:00Z',
  updatedAt: '2026-09-03T00:00:00Z',
  videoUrl: 'https://video.example.com/x',
  blocks: [],
}

const POST_TUTORIAL: PublicTutorialDetail = {
  id: 'tuto-2',
  title: 'Tuto article',
  tags: [],
  format: 'post',
  status: 'validated',
  authorId: 'teacher-1',
  createdAt: '2026-09-03T00:00:00Z',
  updatedAt: '2026-09-03T00:00:00Z',
  blocks: [
    { id: 'b1', blockNumber: 1, category: 'text', content: 'Introduction' },
    { id: 'b2', blockNumber: 2, category: 'text', content: 'Un texte explicatif.' },
  ],
  linkedQuizId: 'quiz-1',
}

function renderPage(tutorialId = 'tuto-1') {
  return render(
    <MemoryRouter initialEntries={[`/content/tutorials/${tutorialId}`]}>
      <Routes>
        <Route path="/content/tutorials/:tutorialId" element={<TutorialDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
})

describe('TutorialDetailPage', () => {
  it('affiche le chargement puis une erreur si le tutoriel est introuvable', async () => {
    mockFetchTutorial.mockRejectedValue(new Error('not found'))
    renderPage()
    expect(screen.getByText(/Chargement du tutoriel/)).toBeDefined()
    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger ce tutoriel/)).toBeDefined()
    })
  })

  it('affiche le lien « Regarder la vidéo » pour un tutoriel au format vidéo', async () => {
    mockFetchTutorial.mockResolvedValue(VIDEO_TUTORIAL)
    renderPage('tuto-1')

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /regarder la vidéo/i })
      expect((link as HTMLAnchorElement).href).toContain('https://video.example.com/x')
    })
  })

  it('affiche les blocs pour un tutoriel au format post, et le bandeau quizz lié', async () => {
    mockFetchTutorial.mockResolvedValue(POST_TUTORIAL)
    renderPage('tuto-2')

    await waitFor(() => {
      expect(screen.getByText('Introduction')).toBeDefined()
      expect(screen.getByText('Un texte explicatif.')).toBeDefined()
    })

    expect(screen.getByRole('button', { name: /passer le quizz/i })).toBeDefined()
  })

  it("affiche le bouton « Modifier le tutoriel » pour l'auteur", async () => {
    mockFetchTutorial.mockResolvedValue(VIDEO_TUTORIAL)
    renderPage('tuto-1')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /modifier le tutoriel/i })).toBeDefined()
    })
  })

  it("n'affiche pas le bouton « Modifier le tutoriel » pour un tiers", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(OTHER_USER))
    mockFetchTutorial.mockResolvedValue(VIDEO_TUTORIAL)
    renderPage('tuto-1')

    await waitFor(() => {
      expect(screen.getByText('Tuto vidéo')).toBeDefined()
    })
    expect(screen.queryByRole('button', { name: /modifier le tutoriel/i })).toBeNull()
  })
})
