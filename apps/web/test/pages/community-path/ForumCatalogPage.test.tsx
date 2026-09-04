/**
 * Tests pour ForumCatalogPage — community-path-service, refonte du 2026-09-04
 *
 * Couvre :
 * - Affichage de l'état de chargement
 * - Liste vide et liste avec forums
 * - Le RP voit le bouton "Créer un forum"
 * - Un AP ne voit pas le bouton "Créer un forum" (droit retiré le 2026-09-04)
 * - Un élève ne voit pas le bouton "Créer un forum"
 * - Le RP crée un forum et le voit apparaître dans la bannière de confirmation
 * - Gestion d'erreur de chargement
 * - Un forum restreint affiche les rôles autorisés, un forum ouvert affiche "ouvert à tous"
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/forums')

import { useAuth } from '../../../src/hooks/useAuth'
import { fetchForums, createForum, fetchForumImageConstraints } from '../../../src/api/forums'
import ForumCatalogPage from '../../../src/pages/ForumCatalogPage'
import type { Forum } from '../../../src/types/forum'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchForums = vi.mocked(fetchForums)
const mockCreateForum = vi.mocked(createForum)
const mockFetchForumImageConstraints = vi.mocked(fetchForumImageConstraints)

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

// ─── Fixtures forums ──────────────────────────────────────────────────────────

const OPEN_FORUM: Forum = {
  id: 'forum-1',
  title: 'Forum Trigonométrie',
  description: 'Discussion autour des fonctions trigonométriques.',
  tags: null,
  allowedRoles: null,
  createdById: 'rp-1',
  createdByRole: 'responsable_pedagogique',
  imageFilename: null,
  imageMimeType: null,
  isHidden: false,
  hiddenAt: null,
  hiddenByUserId: null,
  createdAt: '2026-06-17T09:00:00Z',
  updatedAt: '2026-06-17T09:00:00Z',
}

const RESTRICTED_FORUM: Forum = {
  ...OPEN_FORUM,
  id: 'forum-2',
  title: 'Forum réservé aux élèves',
  allowedRoles: ['eleve'],
}

const CREATED_FORUM: Forum = {
  ...OPEN_FORUM,
  id: 'forum-new',
  title: 'Forum Algèbre',
  description: "Espace de discussion sur l'algèbre.",
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
  mockFetchForumImageConstraints.mockResolvedValue({
    maxSizeBytes: 1_000_000,
    allowedMimeTypes: ['image/jpeg', 'image/png'],
  })
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ForumCatalogPage', () => {
  it("affiche l'état de chargement initialement", () => {
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
    mockFetchForums.mockResolvedValue([OPEN_FORUM])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Forum Trigonométrie')).toBeDefined()
    })
    expect(screen.getByText(/Discussion autour des fonctions/)).toBeDefined()
  })

  it('affiche "ouvert à tous" pour un forum sans restriction de rôle', async () => {
    mockFetchForums.mockResolvedValue([OPEN_FORUM])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Ouvert à tous les comptes connectés/)).toBeDefined()
    })
  })

  it('affiche les rôles autorisés pour un forum restreint', async () => {
    mockFetchForums.mockResolvedValue([RESTRICTED_FORUM])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Élève')).toBeDefined()
    })
  })

  it("le RP voit le bouton 'Créer un forum'", async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /créer un forum/i })).toBeDefined()
    })
  })

  it("l'AP ne voit pas le bouton 'Créer un forum' (droit retiré le 2026-09-04)", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(AP_USER))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Aucun forum disponible/)).toBeDefined()
    })
    expect(screen.queryByRole('button', { name: /créer un forum/i })).toBeNull()
  })

  it("l'élève ne voit pas le bouton 'Créer un forum'", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Aucun forum disponible/)).toBeDefined()
    })
    expect(screen.queryByRole('button', { name: /créer un forum/i })).toBeNull()
  })

  it('le RP peut ouvrir le formulaire de création', async () => {
    renderPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /créer un forum/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /créer un forum/i }))

    expect(screen.getAllByText('Créer un forum').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/visible immédiatement, sans étape de validation/)).toBeDefined()
  })

  it('le RP crée un forum et voit la bannière de confirmation', async () => {
    mockCreateForum.mockResolvedValue(CREATED_FORUM)
    renderPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /créer un forum/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /créer un forum/i }))
    await userEvent.type(screen.getByLabelText(/titre/i), 'Forum Algèbre')
    await userEvent.click(screen.getByRole('button', { name: /créer le forum/i }))

    await waitFor(() => {
      expect(screen.getByText(/créé avec succès/)).toBeDefined()
    })
    expect(mockCreateForum).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Forum Algèbre' }),
    )
  })

  it('affiche une erreur si le chargement échoue', async () => {
    mockFetchForums.mockRejectedValue(new Error('Server error'))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger les forums/)).toBeDefined()
    })
  })

  it("le RP voit l'onglet 'Mes forums' et bascule le chargement en mine=true", async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /mes forums/i })).toBeDefined()
    })
    expect(mockFetchForums).toHaveBeenCalledWith({ tags: undefined, mine: undefined })

    await userEvent.click(screen.getByRole('button', { name: /mes forums/i }))

    await waitFor(() => {
      expect(mockFetchForums).toHaveBeenCalledWith({ tags: undefined, mine: true })
    })
  })

  it("un élève ne voit pas l'onglet 'Mes forums'", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Aucun forum disponible/)).toBeDefined()
    })
    expect(screen.queryByRole('button', { name: /mes forums/i })).toBeNull()
  })

  it("l'onglet 'Mes forums' affiche le badge 'Caché' pour un forum masqué", async () => {
    const HIDDEN_FORUM: Forum = { ...OPEN_FORUM, id: 'forum-hidden', isHidden: true }
    mockFetchForums.mockImplementation(async ({ mine } = {}) =>
      mine ? [HIDDEN_FORUM] : [OPEN_FORUM],
    )
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /mes forums/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /mes forums/i }))

    await waitFor(() => {
      expect(screen.getByText('Caché')).toBeDefined()
    })
  })
})
