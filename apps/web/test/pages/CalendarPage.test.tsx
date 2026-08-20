/**
 * Tests pour CalendarPage — chantier calendrier vue unifiée (2026-08-19).
 *
 * CalendarPage n'est plus qu'un conteneur mince : titre de page, montage de
 * `CalendarUnifiedView` (grille fusionnée, testée en détail dans
 * `test/components/calendar/CalendarUnifiedView.test.tsx`) et panneau replié « Propositions de
 * cours » (`CourseProposalsPanel`, testé dans son propre fichier si présent — ici on vérifie
 * seulement qu'il est bien monté, replié par défaut, en marge de la grille).
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CalendarPage from '../../src/pages/CalendarPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/calendar')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchAvailability, fetchOwnerCalendarActivities, fetchOwnerEvents } from '../../src/api/calendar'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchAvailability = vi.mocked(fetchAvailability)
const mockFetchOwnerCalendarActivities = vi.mocked(fetchOwnerCalendarActivities)
const mockFetchOwnerEvents = vi.mocked(fetchOwnerEvents)

const TEACHER_USER = {
  id: 'teacher-1',
  email: 'prof@test.com',
  role: 'formateur' as const,
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
    isInternalRole: vi.fn(() => false),
  }
}

function renderCalendar() {
  return render(
    <MemoryRouter>
      <CalendarPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchAvailability.mockResolvedValue([])
  mockFetchOwnerCalendarActivities.mockResolvedValue([])
  mockFetchOwnerEvents.mockResolvedValue([])
})

describe('CalendarPage — vue unifiée', () => {
  it('affiche le titre de page et une grille unique, sans onglet', async () => {
    renderCalendar()

    expect(screen.getByRole('heading', { name: 'Mon calendrier' })).toBeDefined()

    await waitFor(() => {
      expect(mockFetchAvailability).toHaveBeenCalledWith('teacher-1')
    })

    expect(screen.queryByRole('tab', { name: /mes événements/i })).toBeNull()
    expect(screen.queryByRole('tab', { name: /mes disponibilités/i })).toBeNull()
    // Le sélecteur de mode est bien présent, lui, "en marge" de la grille — « Consultation »
    // n'est plus un choix affiché depuis la correction du 2026-08-20 (point A), seulement l'état
    // par défaut implicite. Les deux boutons restants restent visibles.
    expect(screen.getByRole('tab', { name: 'Indiquer une disponibilité' })).toBeDefined()
    expect(screen.getByRole('tab', { name: 'Créer un événement' })).toBeDefined()
    expect(screen.queryByRole('tab', { name: 'Consultation' })).toBeNull()
  })

  it('monte les trois sources (disponibilités, activités, événements) au chargement', async () => {
    renderCalendar()

    await waitFor(() => {
      expect(mockFetchAvailability).toHaveBeenCalledWith('teacher-1')
      expect(mockFetchOwnerCalendarActivities).toHaveBeenCalledWith('teacher-1')
      expect(mockFetchOwnerEvents).toHaveBeenCalledWith('teacher-1', expect.any(Object))
    })
  })

  it('affiche le panneau "Propositions de cours" replié par défaut, en marge de la grille', async () => {
    renderCalendar()

    await waitFor(() => {
      expect(mockFetchAvailability).toHaveBeenCalled()
    })

    const summary = screen.getByText('Propositions de cours')
    const details = summary.closest('details')
    expect(details).not.toBeNull()
    expect(details?.hasAttribute('open')).toBe(false)

    await userEvent.click(summary)

    await waitFor(() => {
      expect(screen.getByText('Mes propositions envoyées')).toBeDefined()
    })
    expect(screen.getByRole('button', { name: /proposer un créneau/i })).toBeDefined()
  })
})
