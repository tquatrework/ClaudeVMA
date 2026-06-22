/**
 * Tests pour OpenActivityDetailPage (Phase 13)
 *
 * Couvre :
 * - Le formateur voit le détail d'une activité ouverte
 * - Le formateur peut accepter l'activité via la dialog de confirmation
 * - Une fois le quota atteint, le statut passe à "filled" et le bouton disparaît
 * - Un 409 affiche "Cette activité est déjà pourvue"
 * - Le RP voit les boutons de modification
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/learningActivity')

import { useAuth } from '../../../src/hooks/useAuth'
import {
  fetchOpenActivity,
  acceptOpenActivity,
  updateOpenActivity,
} from '../../../src/api/learningActivity'
import OpenActivityDetailPage from '../../../src/pages/OpenActivityDetailPage'
import type { OpenActivity } from '../../../src/api/learningActivity'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchOpenActivity = vi.mocked(fetchOpenActivity)
const mockAcceptOpenActivity = vi.mocked(acceptOpenActivity)
const mockUpdateOpenActivity = vi.mocked(updateOpenActivity)

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
  requiredSlots: 1,
  filledSlots: 0,
  status: 'open',
  publishedBy: 'rp-1',
  publishedAt: '2026-06-17T09:00:00Z',
}

const ACCEPT_RESPONSE = {
  id: 'acceptance-1',
  openActivityId: 'oa-1',
  teacherId: 'teacher-1',
  acceptedAt: '2026-06-17T10:00:00Z',
  calendarEventId: 'cal-event-1',
}

function renderPage(activityId = 'oa-1') {
  return render(
    <MemoryRouter initialEntries={[`/open-activities/${activityId}`]}>
      <Routes>
        <Route path="/open-activities/:activityId" element={<OpenActivityDetailPage />} />
        <Route path="/open-activities" element={<div>Liste des activités</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchOpenActivity.mockResolvedValue(OPEN_ACTIVITY)
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OpenActivityDetailPage', () => {
  it('affiche l\'état de chargement initialement', () => {
    mockFetchOpenActivity.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Chargement de l\'activité…')).toBeDefined()
  })

  it('affiche le détail d\'une activité ouverte', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Cours de trigonométrie')).toBeDefined()
    })
    expect(screen.getByText('Mathématiques')).toBeDefined()
    expect(screen.getByText('Terminale')).toBeDefined()
    expect(screen.getByText(/0 \/ 1 pourvus/)).toBeDefined()
  })

  it('le formateur voit le bouton "Prendre cette activité"', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /prendre cette activité/i })).toBeDefined()
    })
  })

  it('le formateur ouvre la dialog d\'acceptation', async () => {
    renderPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /prendre cette activité/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /prendre cette activité/i }))

    expect(screen.getByText('Confirmer la prise d\'activité')).toBeDefined()
    expect(screen.getAllByText(/Cours de trigonométrie/).length).toBeGreaterThanOrEqual(1)
  })

  it('le formateur accepte l\'activité et voit un message de succès', async () => {
    mockAcceptOpenActivity.mockResolvedValue(ACCEPT_RESPONSE)
    renderPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /prendre cette activité/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /prendre cette activité/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirmer/i }))

    await waitFor(() => {
      expect(screen.getByText(/Activité acceptée avec succès/)).toBeDefined()
    })
  })

  it('l\'activité disparaît (statut filled) une fois le quota atteint', async () => {
    mockAcceptOpenActivity.mockResolvedValue(ACCEPT_RESPONSE)
    renderPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /prendre cette activité/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /prendre cette activité/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirmer/i }))

    await waitFor(() => {
      // Le bouton "Prendre cette activité" ne doit plus être visible
      expect(screen.queryByRole('button', { name: /prendre cette activité/i })).toBeNull()
    })
  })

  it('un 409 affiche "Cette activité est déjà pourvue"', async () => {
    mockAcceptOpenActivity.mockRejectedValue({ response: { status: 409 } })
    renderPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /prendre cette activité/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /prendre cette activité/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirmer/i }))

    await waitFor(() => {
      expect(screen.getByText('Cette activité est déjà pourvue.')).toBeDefined()
    })
  })

  it('le RP voit le bouton "Modifier"', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /modifier/i })).toBeDefined()
    })
  })

  it('affiche une erreur 404 si l\'activité est introuvable', async () => {
    mockFetchOpenActivity.mockRejectedValue({ response: { status: 404 } })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Activité introuvable.')).toBeDefined()
    })
  })
})
