/**
 * Tests pour OpenActivitiesPage (Phase 13)
 *
 * Couvre :
 * - Le formateur voit la liste des activités non pourvues
 * - Le formateur ne voit PAS le bouton "Publier une annonce"
 * - Le RP voit le bouton "Publier une annonce"
 * - Le RP peut publier une nouvelle activité et la voir dans la liste
 * - État vide et état d'erreur de chargement
 * - Un utilisateur sans rôle autorisé voit un message d'accès refusé
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/learningActivity')

import { useAuth } from '../../../src/hooks/useAuth'
import { fetchOpenActivities, createOpenActivity } from '../../../src/api/learningActivity'
import OpenActivitiesPage from '../../../src/pages/OpenActivitiesPage'
import type { OpenActivity } from '../../../src/api/learningActivity'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchOpenActivities = vi.mocked(fetchOpenActivities)
const mockCreateOpenActivity = vi.mocked(createOpenActivity)

// ─── Fixtures utilisateurs ────────────────────────────────────────────────────

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

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock(userObj = TEACHER_USER) {
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

// ─── Fixtures activités ───────────────────────────────────────────────────────

const OPEN_ACTIVITY: OpenActivity = {
  id: 'oa-1',
  title: 'Cours de trigonométrie',
  description: 'Besoin d\'un formateur pour des cours de trigo en Terminale.',
  subject: 'Mathématiques',
  level: 'Terminale',
  requiredSlots: 2,
  filledSlots: 0,
  status: 'open',
  publishedBy: 'rp-1',
  publishedAt: '2026-06-17T09:00:00Z',
}

const CREATED_ACTIVITY: OpenActivity = {
  id: 'oa-new',
  title: 'Cours d\'algèbre',
  description: 'Formateur disponible pour l\'algèbre en 3ème.',
  subject: 'Mathématiques',
  level: '3ème',
  requiredSlots: 1,
  filledSlots: 0,
  status: 'open',
  publishedBy: 'rp-1',
  publishedAt: '2026-06-17T10:00:00Z',
}

function renderPage() {
  return render(
    <MemoryRouter>
      <OpenActivitiesPage />
    </MemoryRouter>,
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchOpenActivities.mockResolvedValue([])
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OpenActivitiesPage', () => {
  it('affiche l\'état de chargement initialement', () => {
    mockFetchOpenActivities.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Chargement des activités non pourvues…')).toBeDefined()
  })

  it('affiche "Aucune activité non pourvue" quand la liste est vide', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Aucune activité non pourvue/)).toBeDefined()
    })
  })

  it('le formateur voit les activités ouvertes', async () => {
    mockFetchOpenActivities.mockResolvedValue([OPEN_ACTIVITY])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Cours de trigonométrie')).toBeDefined()
    })
  })

  it("le formateur ne voit pas le bouton 'Publier une annonce'", async () => {
    mockFetchOpenActivities.mockResolvedValue([OPEN_ACTIVITY])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Cours de trigonométrie')).toBeDefined()
    })

    expect(screen.queryByRole('button', { name: /publier une annonce/i })).toBeNull()
  })

  it('le RP voit le bouton "Publier une annonce"', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchOpenActivities.mockResolvedValue([])
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /publier une annonce/i })).toBeDefined()
    })
  })

  it('le RP peut ouvrir le formulaire de publication', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchOpenActivities.mockResolvedValue([])
    renderPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /publier une annonce/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /publier une annonce/i }))

    expect(screen.getByText('Publier une activité non pourvue')).toBeDefined()
    expect(screen.getByText(/Cette annonce sera visible par tous les formateurs/)).toBeDefined()
  })

  it('le RP publie une activité et la voit dans la liste', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchOpenActivities.mockResolvedValue([])
    mockCreateOpenActivity.mockResolvedValue(CREATED_ACTIVITY)
    renderPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /publier une annonce/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /publier une annonce/i }))

    await userEvent.type(screen.getByLabelText(/titre/i), 'Cours d\'algèbre')
    await userEvent.type(screen.getByLabelText(/matière/i), 'Mathématiques')
    await userEvent.type(screen.getByLabelText(/niveau/i), '3ème')
    await userEvent.type(screen.getByLabelText(/description/i), 'Formateur disponible pour l\'algèbre en 3ème.')

    await userEvent.click(screen.getByRole('button', { name: /publier l'annonce/i }))

    await waitFor(() => {
      expect(screen.getByText('Cours d\'algèbre')).toBeDefined()
    })
  })

  it('affiche un message d\'accès refusé pour un élève', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Accès réservé aux formateurs/)).toBeDefined()
    })
  })

  it('affiche une erreur si le chargement échoue', async () => {
    mockFetchOpenActivities.mockRejectedValue(new Error('Server error'))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger les activités non pourvues/)).toBeDefined()
    })
  })
})
