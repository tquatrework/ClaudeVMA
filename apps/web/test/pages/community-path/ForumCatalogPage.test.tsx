/**
 * Tests pour ForumCatalogPage (Phase 14)
 *
 * Couvre :
 * - Affichage de l'état de chargement
 * - Liste vide et liste avec forums
 * - L'AP voit le bouton "Créer un forum" et peut l'utiliser
 * - Le RP voit le bouton "Créer un forum"
 * - Un élève ne voit pas le bouton "Créer un forum"
 * - AP crée un forum et le voit dans la liste
 * - Gestion d'erreur de chargement
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/communityPath')

import { useAuth } from '../../../src/hooks/useAuth'
import { fetchForums, createForum } from '../../../src/api/communityPath'
import ForumCatalogPage from '../../../src/pages/ForumCatalogPage'
import type { Forum } from '../../../src/api/communityPath'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchForums = vi.mocked(fetchForums)
const mockCreateForum = vi.mocked(createForum)

// ─── Fixtures utilisateurs ────────────────────────────────────────────────────

const AP_USER = {
  id: 'ap-1',
  email: 'ap@test.com',
  role: 'animateur_pedagogique' as const,
  validationStatus: 'active' as const,
}

const RP_USER = {
  id: 'rp-1',
  email: 'rp@test.com',
  role: 'responsable_pedagogique' as const,
  validationStatus: 'active' as const,
}

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock(userObj = AP_USER) {
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

// ─── Fixtures forums ──────────────────────────────────────────────────────────

const PUBLISHED_FORUM: Forum = {
  id: 'forum-1',
  title: 'Forum Trigonométrie',
  description: 'Discussion autour des fonctions trigonométriques.',
  authorId: 'ap-1',
  status: 'published',
  createdAt: '2026-06-17T09:00:00Z',
  commentCount: 5,
}

const CREATED_FORUM: Forum = {
  id: 'forum-new',
  title: 'Forum Algèbre',
  description: 'Espace de discussion sur l\'algèbre.',
  authorId: 'ap-1',
  status: 'pending_validation',
  createdAt: '2026-06-18T10:00:00Z',
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ForumCatalogPage />
    </MemoryRouter>,
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchForums.mockResolvedValue([])
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ForumCatalogPage', () => {
  it('affiche l\'état de chargement initialement', () => {
    mockFetchForums.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Chargement des forums…')).toBeDefined()
  })

  it('affiche "Aucun forum disponible" quand la liste est vide', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Aucun forum disponible/)).toBeDefined()
    })
  })

  it('affiche les forums disponibles', async () => {
    mockFetchForums.mockResolvedValue([PUBLISHED_FORUM])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Forum Trigonométrie')).toBeDefined()
    })
    expect(screen.getByText(/Discussion autour des fonctions/)).toBeDefined()
  })

  it("l'AP voit le bouton 'Créer un forum'", async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /créer un forum/i })).toBeDefined()
    })
  })

  it("le RP voit le bouton 'Créer un forum'", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /créer un forum/i })).toBeDefined()
    })
  })

  it("l'élève ne voit pas le bouton 'Créer un forum'", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    renderPage()

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /créer un forum/i })).toBeNull()
    })
  })

  it("l'AP peut ouvrir le formulaire de création", async () => {
    renderPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /créer un forum/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /créer un forum/i }))

    expect(screen.getAllByText('Créer un forum').length).toBeGreaterThanOrEqual(1)
    expect(
      screen.getByText(/Le forum sera soumis à validation par un responsable pédagogique/),
    ).toBeDefined()
  })

  it("l'AP crée un forum et le voit dans la liste", async () => {
    mockCreateForum.mockResolvedValue(CREATED_FORUM)
    renderPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /créer un forum/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /créer un forum/i }))

    await userEvent.type(screen.getByLabelText(/titre/i), 'Forum Algèbre')
    await userEvent.type(
      screen.getByLabelText(/description/i),
      "Espace de discussion sur l'algèbre.",
    )

    await userEvent.click(screen.getByRole('button', { name: /créer le forum/i }))

    await waitFor(() => {
      expect(screen.getByText('Forum Algèbre')).toBeDefined()
    })
  })

  it('affiche une erreur si le chargement échoue', async () => {
    mockFetchForums.mockRejectedValue(new Error('Server error'))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger les forums/)).toBeDefined()
    })
  })
})
