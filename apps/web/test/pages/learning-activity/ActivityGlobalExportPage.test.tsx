/**
 * Tests pour ActivityGlobalExportPage (Phase 13)
 *
 * Couvre :
 * - Un rôle interne (RP) voit la liste des activités
 * - Un rôle non autorisé voit un message d'accès refusé
 * - Les filtres de statut et date sont présents
 * - Le bouton "Exporter CSV" apparaît quand des activités sont chargées
 */

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/learningActivity')

import { useAuth } from '../../../src/hooks/useAuth'
import { fetchActivities } from '../../../src/api/learningActivity'
import ActivityGlobalExportPage from '../../../src/pages/ActivityGlobalExportPage'
import type { Activity } from '../../../src/api/learningActivity'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchActivities = vi.mocked(fetchActivities)

// ─── Fixtures utilisateurs ────────────────────────────────────────────────────

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

// ─── Fixtures activités ───────────────────────────────────────────────────────

const ACTIVITY: Activity = {
  id: 'act-1',
  title: 'Cours de dérivées',
  subject: 'Mathématiques',
  level: 'Terminale',
  startAt: '2026-06-17T10:00:00Z',
  endAt: '2026-06-17T11:00:00Z',
  status: 'completed',
  teacherId: 'teacher-1',
  studentId: 'student-2',
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ActivityGlobalExportPage />
    </MemoryRouter>,
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchActivities.mockResolvedValue([])
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ActivityGlobalExportPage', () => {
  it('affiche l\'état de chargement initialement', () => {
    mockFetchActivities.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Chargement des activités…')).toBeDefined()
  })

  it('affiche "Aucune activité" quand la liste est vide', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Aucune activité ne correspond aux filtres/)).toBeDefined()
    })
  })

  it('le RP voit les activités chargées', async () => {
    mockFetchActivities.mockResolvedValue([ACTIVITY])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Cours de dérivées')).toBeDefined()
    })
  })

  it('affiche le bouton "Exporter CSV" quand des activités sont présentes', async () => {
    mockFetchActivities.mockResolvedValue([ACTIVITY])
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /exporter csv/i })).toBeDefined()
    })
  })

  it('les filtres de statut et date sont présents', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByLabelText(/statut/i)).toBeDefined()
      expect(screen.getByLabelText(/du/i)).toBeDefined()
      expect(screen.getByLabelText(/au/i)).toBeDefined()
    })
  })

  it('affiche un message d\'accès refusé pour un élève', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    renderPage()

    expect(
      screen.getByText(/Accès réservé aux responsables pédagogiques/),
    ).toBeDefined()
  })

  it('affiche une erreur si le chargement échoue', async () => {
    mockFetchActivities.mockRejectedValue(new Error('Server error'))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger les activités/)).toBeDefined()
    })
  })
})
