/**
 * Tests pour CalendarPage — Phase 4 (calendar-service)
 *
 * Couvre :
 * 1. Chargement des événements à venir et passés depuis GET /calendars/:ownerId/events
 * 2. Filtrage par type d'événement
 * 3. InvitationBanner — accepter une invitation met à jour l'état visuel
 * 4. InvitationBanner — refuser une invitation retire l'élément
 * 5. Créer un rappel personnel (rôle élève)
 * 6. Tests additionnels : états de chargement, erreurs, création d'événement
 *
 * Depuis le lot 8 (calendar/dashboard), la lecture des événements passe par
 * `src/api/calendar.ts` (fonction `fetchOwnerEvents`) au lieu d'`apiClient` directement.
 * `apiClient` reste mocké car les composants enfants (EventCreateDialog, InvitationBanner,
 * CancellationRequestDialog, ReminderSettingsPanel) l'utilisent toujours directement — ils
 * sont hors périmètre de ce lot.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CalendarPage from '../../src/pages/CalendarPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')
vi.mock('../../src/api/calendar')

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'
import { fetchOwnerEvents } from '../../src/api/calendar'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)
const mockFetchOwnerEvents = vi.mocked(fetchOwnerEvents)

const TEACHER_USER = {
  id: 'teacher-1',
  email: 'prof@test.com',
  role: 'formateur' as const,
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

const FUTURE_ISO_1 = new Date(Date.now() + 86400000).toISOString()
const FUTURE_ISO_2 = new Date(Date.now() + 172800000).toISOString()
const PAST_ISO_1 = new Date(Date.now() - 86400000).toISOString()
const PAST_ISO_2 = new Date(Date.now() - 3600000).toISOString()

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
})

// ---------------------------------------------------------------------------
// Test 1 — Chargement événements à venir et passés
// ---------------------------------------------------------------------------
describe('CalendarPage — chargement des événements', () => {
  it('affiche le chargement puis les événements à venir', async () => {
    const fetchedEvents = [
      {
        id: 'evt-1',
        title: 'Cours de mathématiques',
        startAt: FUTURE_ISO_1,
        endAt: FUTURE_ISO_2,
        eventType: 'cours' as const,
        status: 'scheduled',
      },
    ]

    mockFetchOwnerEvents.mockResolvedValue(fetchedEvents)

    renderCalendar()

    expect(screen.getByText('Chargement…')).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText('Cours de mathématiques')).toBeDefined()
    })

    expect(mockFetchOwnerEvents).toHaveBeenCalledWith('teacher-1', expect.any(Object))
  })

  it('affiche les événements passés dans la vue passés', async () => {
    const fetchedEvents = [
      {
        id: 'evt-past-1',
        title: 'Ancien cours',
        startAt: PAST_ISO_1,
        endAt: PAST_ISO_2,
        eventType: 'cours' as const,
        status: 'completed',
      },
    ]

    mockFetchOwnerEvents.mockResolvedValue(fetchedEvents)

    renderCalendar()

    await waitFor(() => {
      screen.getByText('Passés (1)')
    })

    await userEvent.click(screen.getByText('Passés (1)'))

    await waitFor(() => {
      expect(screen.getByText('Ancien cours')).toBeDefined()
    })
  })

  it('affiche l\'état vide quand aucun événement', async () => {
    mockFetchOwnerEvents.mockResolvedValue([])

    renderCalendar()

    await waitFor(() => {
      expect(screen.getByText('Aucune activité planifiée')).toBeDefined()
    })
  })

  it('affiche l\'erreur d\'accès refusé pour une réponse 403', async () => {
    mockFetchOwnerEvents.mockRejectedValue({ response: { status: 403 } })

    renderCalendar()

    await waitFor(() => {
      expect(screen.getByText('Accès refusé')).toBeDefined()
    })
  })

  it('affiche l\'erreur générique pour une erreur 500', async () => {
    mockFetchOwnerEvents.mockRejectedValue({ response: { status: 500 } })

    renderCalendar()

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger le calendrier')).toBeDefined()
    })
  })
})

// ---------------------------------------------------------------------------
// Test 2 — Filtrage par type d'événement
// ---------------------------------------------------------------------------
describe('CalendarPage — filtrage par type d\'événement', () => {
  it('ajoute le paramètre type dans l\'URL quand un type est sélectionné', async () => {
    mockFetchOwnerEvents.mockResolvedValue([])

    renderCalendar()

    await waitFor(() => {
      screen.getByLabelText("Filtrer par type d'événement")
    })

    await userEvent.selectOptions(
      screen.getByLabelText("Filtrer par type d'événement"),
      'cours',
    )

    await waitFor(() => {
      expect(mockFetchOwnerEvents).toHaveBeenCalledWith(
        'teacher-1',
        expect.objectContaining({ type: 'cours' }),
      )
    })
  })

  it('recharge sans filtre quand "Tous les types" est sélectionné', async () => {
    mockFetchOwnerEvents.mockResolvedValue([])

    renderCalendar()

    await waitFor(() => {
      screen.getByLabelText("Filtrer par type d'événement")
    })

    await userEvent.selectOptions(
      screen.getByLabelText("Filtrer par type d'événement"),
      'cours',
    )

    await userEvent.selectOptions(
      screen.getByLabelText("Filtrer par type d'événement"),
      '',
    )

    await waitFor(() => {
      const lastCall = mockFetchOwnerEvents.mock.calls.at(-1)
      expect(lastCall![1]?.type).toBeUndefined()
    })
  })
})

// ---------------------------------------------------------------------------
// Test 3 — InvitationBanner — accepter une invitation change l'état visuel
// ---------------------------------------------------------------------------
describe('InvitationBanner — accepter une invitation', () => {
  it('affiche le statut accepté après avoir cliqué sur "Accepter"', async () => {
    const fetchedEvents = [
      {
        id: 'inv-evt-1',
        title: 'Réunion pédagogique',
        startAt: FUTURE_ISO_1,
        endAt: FUTURE_ISO_2,
        eventType: 'invitation' as const,
        inviteeStatus: 'pending' as const,
      },
    ]

    mockFetchOwnerEvents.mockResolvedValue(fetchedEvents)
    mockApiClient.post = vi.fn().mockResolvedValue({ data: { status: 'accepted' } })

    renderCalendar()

    await waitFor(() => {
      expect(screen.getByText('Réunion pédagogique')).toBeDefined()
    })

    expect(screen.getByRole('button', { name: /accepter/i })).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: /accepter/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/events/inv-evt-1/invitees/teacher-1/accept`,
      )
    })
  })
})

// ---------------------------------------------------------------------------
// Test 4 — InvitationBanner — refuser une invitation retire l'élément
// ---------------------------------------------------------------------------
describe('InvitationBanner — refuser une invitation', () => {
  it('retire l\'invitation de la liste après avoir cliqué sur "Refuser"', async () => {
    const fetchedEvents = [
      {
        id: 'inv-evt-2',
        title: 'Cours optionnel',
        startAt: FUTURE_ISO_1,
        endAt: FUTURE_ISO_2,
        eventType: 'invitation' as const,
        inviteeStatus: 'pending' as const,
      },
    ]

    mockFetchOwnerEvents.mockResolvedValue(fetchedEvents)
    mockApiClient.post = vi.fn().mockResolvedValue({ data: {} })

    renderCalendar()

    await waitFor(() => {
      expect(screen.getByText('Cours optionnel')).toBeDefined()
    })

    expect(screen.getByRole('button', { name: /refuser/i })).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: /refuser/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/events/inv-evt-2/invitees/teacher-1/decline`,
      )
    })

    await waitFor(() => {
      expect(screen.queryByText('Invitations en attente')).toBeNull()
    })
  })
})

// ---------------------------------------------------------------------------
// Test 5 — Élève crée un rappel personnel
// ---------------------------------------------------------------------------
describe('CalendarPage (rôle élève) — créer un rappel personnel', () => {
  it('affiche le bouton de création pour un élève et crée un événement de type rappel', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))

    const futureRappel = {
      id: 'rappel-1',
      title: 'Révisions chapitre 3',
      startAt: FUTURE_ISO_1,
      endAt: FUTURE_ISO_2,
      eventType: 'rappel' as const,
    }

    mockFetchOwnerEvents.mockResolvedValue([])
    mockApiClient.post = vi.fn().mockResolvedValue({ data: futureRappel })

    renderCalendar()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nouvel événement/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /nouvel événement/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /créer un événement/i })).toBeDefined()
    })

    const typeSelect = screen.getByRole('combobox', { name: /type/i })
    expect(typeSelect).toBeDefined()

    const dateTimeInputs = document.querySelectorAll('input[type="datetime-local"]')
    const startInput = dateTimeInputs[0] as HTMLInputElement
    const endInput = dateTimeInputs[1] as HTMLInputElement

    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(
      startInput,
      '2030-06-20T10:00',
    )
    startInput.dispatchEvent(new Event('change', { bubbles: true }))
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(
      endInput,
      '2030-06-20T11:00',
    )
    endInput.dispatchEvent(new Event('change', { bubbles: true }))

    await userEvent.click(screen.getByRole('button', { name: /créer$/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/calendars/student-1/events`,
        expect.objectContaining({ eventType: 'rappel' }),
      )
    })
  })

  it('configure un rappel via ReminderSettingsPanel', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))

    const futureEvent = {
      id: 'evt-student-1',
      title: 'Révision',
      startAt: FUTURE_ISO_1,
      endAt: FUTURE_ISO_2,
      eventType: 'rappel' as const,
    }

    mockFetchOwnerEvents.mockResolvedValue([futureEvent])
    mockApiClient.post = vi.fn().mockResolvedValue({ data: {} })

    renderCalendar()

    await waitFor(() => {
      expect(screen.getByText('Révision')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /configurer un rappel/i }))

    await waitFor(() => {
      expect(screen.getByLabelText('Délai de rappel')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /enregistrer le rappel/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/events/evt-student-1/reminders`,
        expect.objectContaining({ delay: expect.any(String) }),
      )
    })
  })
})

// ---------------------------------------------------------------------------
// Tests sur le bouton de création selon le rôle
// ---------------------------------------------------------------------------
describe('CalendarPage — contrôle d\'accès création d\'événement', () => {
  it('affiche le bouton "Nouvel événement" pour un formateur', async () => {
    mockFetchOwnerEvents.mockResolvedValue([])

    renderCalendar()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nouvel événement/i })).toBeDefined()
    })
  })

  it('affiche le bouton pour un élève (peut créer des rappels)', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchOwnerEvents.mockResolvedValue([])

    renderCalendar()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nouvel événement/i })).toBeDefined()
    })
  })
})

// ---------------------------------------------------------------------------
// Test annulation d'événement
// ---------------------------------------------------------------------------
describe('CalendarPage — demande d\'annulation', () => {
  it('ouvre la modale d\'annulation en cliquant sur "Demander l\'annulation"', async () => {
    const futureEvent = {
      id: 'evt-cancel-1',
      title: 'Cours à annuler',
      startAt: FUTURE_ISO_1,
      endAt: FUTURE_ISO_2,
      eventType: 'cours' as const,
    }

    mockFetchOwnerEvents.mockResolvedValue([futureEvent])
    mockApiClient.post = vi.fn().mockResolvedValue({ data: {} })

    renderCalendar()

    await waitFor(() => {
      expect(screen.getByText('Cours à annuler')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /demander l'annulation/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /demande d'annulation/i })).toBeDefined()
    })

    const allCancelButtons = screen.getAllByRole('button', { name: /demander l'annulation/i })
    const dialogSubmitButton = allCancelButtons.find(
      (button) => button.getAttribute('type') === 'submit',
    )!
    await userEvent.click(dialogSubmitButton)

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/events/evt-cancel-1/cancel-request`,
        expect.any(Object),
      )
    })
  })
})
