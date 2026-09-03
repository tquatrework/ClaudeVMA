/**
 * Tests pour TutorialCatalogPage — refonte du 2026-09-03 (`docs/architecture.md` > « Refonte des
 * Tutos/Vidéos »).
 *
 * Couvre :
 * - États chargement / vide / erreur du catalogue
 * - Visibilité du bouton de création selon le rôle (élève vs formateur/RP)
 * - Affichage d'un tutoriel dans le catalogue, avec badge de statut si non validé
 * - Création d'un tutoriel au format « post » (bloc texte) avec succès
 * - Le format « vidéo » exige une URL
 * - Visibilité et usage de l'onglet « Validation » (RP)
 * - Visibilité de l'onglet « Mes Tutoriels » (formateur)
 */

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/tutorials')

import { useAuth } from '../../../src/hooks/useAuth'
import {
  searchTutorials,
  fetchPendingTutorials,
  createTutorial,
  fetchTutorialDefaultTitle,
  fetchTutorialImageConstraints,
  decideTutorialValidation,
} from '../../../src/api/tutorials'
import TutorialCatalogPage from '../../../src/pages/TutorialCatalogPage'
import type { PublicTutorialDetail, TutorialSummary } from '../../../src/types/tutorial'

const mockUseAuth = vi.mocked(useAuth)
const mockSearchTutorials = vi.mocked(searchTutorials)
const mockFetchPendingTutorials = vi.mocked(fetchPendingTutorials)
const mockCreateTutorial = vi.mocked(createTutorial)
const mockFetchTutorialDefaultTitle = vi.mocked(fetchTutorialDefaultTitle)
const mockFetchTutorialImageConstraints = vi.mocked(fetchTutorialImageConstraints)
const mockDecideTutorialValidation = vi.mocked(decideTutorialValidation)

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

function buildAuthMock(userObj: typeof STUDENT_USER | typeof TEACHER_USER | typeof RP_USER = STUDENT_USER) {
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

// ─── Fixtures tutoriels ───────────────────────────────────────────────────────

const PUBLISHED_TUTORIAL: TutorialSummary = {
  id: 'tuto-1',
  title: 'Introduction aux intégrales',
  description: 'Comprendre les bases',
  tags: ['analyse'],
  format: 'video',
  status: 'validated',
  authorId: 'teacher-1',
  createdAt: '2026-06-15T08:00:00Z',
  updatedAt: '2026-06-15T08:00:00Z',
}

const PENDING_TUTORIAL: TutorialSummary = {
  ...PUBLISHED_TUTORIAL,
  id: 'tuto-pending',
  status: 'pending_validation',
}

const CREATED_TUTORIAL: PublicTutorialDetail = {
  id: 'tuto-new',
  title: 'Nouveau tutoriel',
  tags: [],
  format: 'post',
  status: 'pending_validation',
  authorId: 'teacher-1',
  createdAt: '2026-06-17T10:00:00Z',
  updatedAt: '2026-06-17T10:00:00Z',
  blocks: [{ id: 'b1', blockNumber: 1, category: 'text', content: 'Un contenu de tutoriel.' }],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TutorialCatalogPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockSearchTutorials.mockResolvedValue({ items: [], total: 0 })
  mockFetchPendingTutorials.mockResolvedValue({ items: [], total: 0 })
  mockFetchTutorialDefaultTitle.mockResolvedValue({ title: 'Tutoriel (1)' })
  mockFetchTutorialImageConstraints.mockResolvedValue({
    maxImageInputBytes: 600_000,
    maxImageOutputBytes: 500_000,
    maxRequestBodyBytes: 900_000,
  })
})

describe('TutorialCatalogPage — chargement et états', () => {
  it('affiche l’état de chargement initialement', () => {
    mockSearchTutorials.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText(/Chargement des tutoriels/)).toBeDefined()
  })

  it('affiche "Aucun tutoriel" quand la liste est vide', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Aucun tutoriel ne correspond à cette recherche/)).toBeDefined()
    })
  })

  it('affiche une erreur si le chargement échoue', async () => {
    mockSearchTutorials.mockRejectedValue(new Error('Server error'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger les tutoriels/)).toBeDefined()
    })
  })
})

describe('TutorialCatalogPage — catalogue', () => {
  it('affiche un tutoriel du catalogue', async () => {
    mockSearchTutorials.mockResolvedValue({ items: [PUBLISHED_TUTORIAL], total: 1 })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Introduction aux intégrales')).toBeDefined()
    })
  })

  it('affiche un badge de statut pour un tutoriel non validé', async () => {
    mockSearchTutorials.mockResolvedValue({ items: [PENDING_TUTORIAL], total: 1 })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('En attente de validation')).toBeDefined()
    })
  })
})

describe('TutorialCatalogPage — droits de création par rôle', () => {
  it('un élève ne voit pas le bouton de création', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Aucun tutoriel/)).toBeDefined()
    })
    expect(screen.queryByRole('button', { name: /créer un nouveau tutoriel/i })).toBeNull()
  })

  it('un formateur voit le bouton de création', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /créer un nouveau tutoriel/i })).toBeDefined()
    })
  })

  it('un RP voit le bouton de création et l’onglet Validation', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /créer un nouveau tutoriel/i })).toBeDefined()
    })
    expect(screen.getByRole('tab', { name: /validation/i })).toBeDefined()
  })

  it('un élève ne voit ni l’onglet Mes Tutoriels ni l’onglet Validation', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Aucun tutoriel/)).toBeDefined()
    })
    expect(screen.queryByRole('tab', { name: /mes tutoriels/i })).toBeNull()
    expect(screen.queryByRole('tab', { name: /validation/i })).toBeNull()
  })
})

describe('TutorialCatalogPage — création d’un tutoriel', () => {
  it('crée un tutoriel au format post avec un bloc texte', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    mockCreateTutorial.mockResolvedValue(CREATED_TUTORIAL)
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /créer un nouveau tutoriel/i }))

    const titleField = await screen.findByLabelText(/^titre/i)
    await userEvent.clear(titleField)
    await userEvent.type(titleField, 'Nouveau tutoriel')

    // Format post par défaut : un bloc « titre » est déjà présent, on le remplit.
    const blockField = screen.getByPlaceholderText('Titre de section')
    await userEvent.type(blockField, 'Un contenu de tutoriel.')

    await userEvent.click(screen.getByRole('button', { name: /créer le tutoriel/i }))

    await waitFor(() => {
      expect(mockCreateTutorial).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Nouveau tutoriel',
          format: 'post',
          blocks: [{ category: 'title', content: 'Un contenu de tutoriel.' }],
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/créé avec succès/)).toBeDefined()
    })
  })

  it('le format vidéo exige une URL avant soumission', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /créer un nouveau tutoriel/i }))

    const titleField = await screen.findByLabelText(/^titre/i)
    await userEvent.clear(titleField)
    await userEvent.type(titleField, 'Tuto vidéo')

    await userEvent.click(screen.getByRole('radio', { name: /vidéo/i }))

    const videoUrlField = screen.getByLabelText(/adresse de la vidéo/i)
    expect(videoUrlField).toHaveProperty('required', true)

    expect(mockCreateTutorial).not.toHaveBeenCalled()
  })
})

describe('TutorialCatalogPage — validation intégrée (RP)', () => {
  it('affiche un tutoriel en attente dans l’onglet Validation et permet de le valider', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchPendingTutorials.mockResolvedValue({ items: [PENDING_TUTORIAL], total: 1 })
    mockDecideTutorialValidation.mockResolvedValue(undefined)
    renderPage()

    await userEvent.click(await screen.findByRole('tab', { name: /validation/i }))

    const validationPanel = screen.getByRole('tabpanel', { name: /validation/i })
    await waitFor(() => {
      expect(within(validationPanel).getByText('Introduction aux intégrales')).toBeDefined()
    })

    await userEvent.click(within(validationPanel).getByRole('button', { name: /valider/i }))

    await waitFor(() => {
      expect(mockDecideTutorialValidation).toHaveBeenCalledWith('tuto-pending', 'validated', undefined)
    })
  })
})
