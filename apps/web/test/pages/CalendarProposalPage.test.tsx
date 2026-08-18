/**
 * CalendarProposalPage — vue asymétrique proposeur/destinataire (chantier calendrier de
 * disponibilités, point 3). Couvre :
 * - le destinataire voit Accepter/Refuser et la réponse serveur remplace l'affichage ;
 * - le proposeur voit un statut en lecture seule, jamais de bouton d'action ;
 * - erreur de chargement affichée proprement (générique, sans UUID).
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/calendar')

import { useAuth } from '../../src/hooks/useAuth'
import { acceptActivity, declineActivity, fetchScheduledActivity } from '../../src/api/calendar'
import CalendarProposalPage from '../../src/pages/CalendarProposalPage'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchScheduledActivity = vi.mocked(fetchScheduledActivity)
const mockAcceptActivity = vi.mocked(acceptActivity)
const mockDeclineActivity = vi.mocked(declineActivity)

const ACTIVITY = {
  id: 'activity-1',
  title: 'Cours de géométrie',
  type: 'cours' as const,
  creatorId: 'teacher-1',
  creatorRole: 'formateur',
  participantIds: ['student-1'],
  startTime: '2026-09-10T14:00:00.000Z',
  endTime: '2026-09-10T15:00:00.000Z',
  status: 'proposed' as const,
  description: 'Révision du chapitre 3',
  correlationId: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

function buildAuthMock(userId: string) {
  return {
    user: { id: userId, email: 'user@test.com', role: 'eleve' as const, validationStatus: 'active' as const },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn(() => true),
    isInternalRole: vi.fn(() => false),
  }
}

function renderPage(activityId = 'activity-1') {
  return render(
    <MemoryRouter initialEntries={[`/calendar/proposals/${activityId}`]}>
      <Routes>
        <Route path="/calendar/proposals/:activityId" element={<CalendarProposalPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CalendarProposalPage — destinataire', () => {
  it('affiche Accepter/Refuser et met à jour le statut avec la réponse serveur', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock('student-1'))
    mockFetchScheduledActivity.mockResolvedValue(ACTIVITY)
    mockAcceptActivity.mockResolvedValue({ ...ACTIVITY, status: 'confirmed' })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Cours de géométrie')).toBeDefined()
    })
    expect(screen.getByRole('button', { name: /accepter/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /refuser/i })).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: /accepter/i }))

    await waitFor(() => {
      expect(mockAcceptActivity).toHaveBeenCalledWith('activity-1')
      expect(screen.getByText('Accepté')).toBeDefined()
    })
    // Les actions disparaissent une fois la proposition traitée.
    expect(screen.queryByRole('button', { name: /accepter/i })).toBeNull()
  })

  it('refuser appelle declineActivity', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock('student-1'))
    mockFetchScheduledActivity.mockResolvedValue(ACTIVITY)
    mockDeclineActivity.mockResolvedValue({ ...ACTIVITY, status: 'cancelled' })

    renderPage()

    await waitFor(() => screen.getByRole('button', { name: /refuser/i }))
    await userEvent.click(screen.getByRole('button', { name: /refuser/i }))

    await waitFor(() => {
      expect(mockDeclineActivity).toHaveBeenCalledWith('activity-1')
      expect(screen.getByText('Refusé')).toBeDefined()
    })
  })
})

describe('CalendarProposalPage — proposeur', () => {
  it('affiche le statut en lecture seule, sans bouton Accepter/Refuser', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock('teacher-1'))
    mockFetchScheduledActivity.mockResolvedValue(ACTIVITY)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Cours de géométrie')).toBeDefined()
    })
    expect(screen.queryByRole('button', { name: /accepter/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /refuser/i })).toBeNull()
    expect(screen.getByText('En attente de réponse')).toBeDefined()
  })
})

describe('CalendarProposalPage — erreurs', () => {
  it('un tiers sans lien reçoit un message générique, jamais un UUID', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock('someone-else'))
    mockFetchScheduledActivity.mockRejectedValue({ response: { status: 403 } })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Vous n'êtes pas autorisé à effectuer cette action.")).toBeDefined()
    })
  })
})
