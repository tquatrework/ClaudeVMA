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
 * Depuis le lot calendar (composants métier), les composants enfants (EventCreateDialog,
 * InvitationBanner, CancellationRequestDialog, ReminderSettingsPanel) sont eux aussi passés à
 * `src/api/calendar.ts` — `apiClient` n'est plus mocké ici, seules les fonctions typées le sont.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CalendarPage from '../../src/pages/CalendarPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/calendar')

import { useAuth } from '../../src/hooks/useAuth'
import {
  fetchOwnerEvents,
  acceptEventInvitation,
  declineEventInvitation,
  createOwnerEvent,
  setEventReminder,
  requestEventCancellation,
  fetchAvailability,
  fetchOwnerCalendarActivities,
} from '../../src/api/calendar'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchOwnerEvents = vi.mocked(fetchOwnerEvents)
const mockAcceptEventInvitation = vi.mocked(acceptEventInvitation)
const mockDeclineEventInvitation = vi.mocked(declineEventInvitation)
const mockCreateOwnerEvent = vi.mocked(createOwnerEvent)
const mockSetEventReminder = vi.mocked(setEventReminder)
const mockRequestEventCancellation = vi.mocked(requestEventCancellation)
const mockFetchAvailability = vi.mocked(fetchAvailability)
const mockFetchOwnerCalendarActivities = vi.mocked(fetchOwnerCalendarActivities)

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
  mockFetchAvailability.mockResolvedValue([])
  mockFetchOwnerCalendarActivities.mockResolvedValue([])
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
    mockAcceptEventInvitation.mockResolvedValue(undefined)

    renderCalendar()

    await waitFor(() => {
      expect(screen.getByText('Réunion pédagogique')).toBeDefined()
    })

    expect(screen.getByRole('button', { name: /accepter/i })).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: /accepter/i }))

    await waitFor(() => {
      expect(mockAcceptEventInvitation).toHaveBeenCalledWith('inv-evt-1', 'teacher-1')
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
    mockDeclineEventInvitation.mockResolvedValue(undefined)

    renderCalendar()

    await waitFor(() => {
      expect(screen.getByText('Cours optionnel')).toBeDefined()
    })

    expect(screen.getByRole('button', { name: /refuser/i })).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: /refuser/i }))

    await waitFor(() => {
      expect(mockDeclineEventInvitation).toHaveBeenCalledWith('inv-evt-2', 'teacher-1')
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
    mockCreateOwnerEvent.mockResolvedValue(futureRappel)

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
      expect(mockCreateOwnerEvent).toHaveBeenCalledWith(
        'student-1',
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
    mockSetEventReminder.mockResolvedValue(undefined)

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
      expect(mockSetEventReminder).toHaveBeenCalledWith('evt-student-1', expect.any(String))
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
    mockRequestEventCancellation.mockResolvedValue({})

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
      expect(mockRequestEventCancellation).toHaveBeenCalledWith(
        'evt-cancel-1',
        expect.any(Object),
      )
    })
  })
})

// ---------------------------------------------------------------------------
// Onglets — "Mes événements" / "Mes disponibilités" (règle du 2026-08-10 :
// une navigation interne ne doit rien faire perdre)
// ---------------------------------------------------------------------------
describe('CalendarPage — onglets', () => {
  it('affiche "Mes événements" comme onglet actif par défaut', async () => {
    mockFetchOwnerEvents.mockResolvedValue([])

    renderCalendar()

    await waitFor(() => {
      const eventsTab = screen.getByRole('tab', { name: 'Mes événements' })
      expect(eventsTab.getAttribute('aria-selected')).toBe('true')
    })
  })

  it('bascule vers "Mes disponibilités" et charge la grille', async () => {
    mockFetchOwnerEvents.mockResolvedValue([])

    renderCalendar()

    await waitFor(() => {
      screen.getByRole('tab', { name: 'Mes disponibilités' })
    })

    await userEvent.click(screen.getByRole('tab', { name: 'Mes disponibilités' }))

    await waitFor(() => {
      expect(mockFetchAvailability).toHaveBeenCalledWith('teacher-1')
    })
  })

  it('conserve les événements affichés en revenant sur "Mes événements" après avoir visité "Mes disponibilités"', async () => {
    const fetchedEvents = [
      {
        id: 'evt-persist-1',
        title: 'Cours persistant',
        startAt: FUTURE_ISO_1,
        endAt: FUTURE_ISO_2,
        eventType: 'cours' as const,
      },
    ]
    mockFetchOwnerEvents.mockResolvedValue(fetchedEvents)

    renderCalendar()

    await waitFor(() => {
      expect(screen.getByText('Cours persistant')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('tab', { name: 'Mes disponibilités' }))
    await waitFor(() => {
      expect(mockFetchAvailability).toHaveBeenCalled()
    })

    await userEvent.click(screen.getByRole('tab', { name: 'Mes événements' }))

    // Un seul appel : revenir sur l'onglet ne recharge pas ses données (montage
    // paresseux puis maintien, TabPanel).
    expect(mockFetchOwnerEvents).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Cours persistant')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Onglet "Propositions de cours" (chantier calendrier, point 3) — point de montage de
// CourseProposalsPanel, jusqu'ici jamais intégré à la page.
// ---------------------------------------------------------------------------
describe('CalendarPage — onglet "Propositions de cours"', () => {
  it('bascule vers l’onglet et affiche le bouton "Proposer un créneau" pour un formateur', async () => {
    mockFetchOwnerEvents.mockResolvedValue([])

    renderCalendar()

    await waitFor(() => {
      screen.getByRole('tab', { name: 'Propositions de cours' })
    })

    await userEvent.click(screen.getByRole('tab', { name: 'Propositions de cours' }))

    await waitFor(() => {
      expect(screen.getByText('Mes propositions envoyées')).toBeDefined()
    })
    expect(screen.getByRole('button', { name: /proposer un créneau/i })).toBeDefined()
  })

  it('conserve les onglets "Mes événements"/"Mes disponibilités" en revenant dessus après "Propositions de cours"', async () => {
    mockFetchOwnerEvents.mockResolvedValue([])

    renderCalendar()

    await waitFor(() => screen.getByRole('tab', { name: 'Propositions de cours' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Propositions de cours' }))
    await waitFor(() => screen.getByText('Mes propositions envoyées'))

    await userEvent.click(screen.getByRole('tab', { name: 'Mes événements' }))

    expect(mockFetchOwnerEvents).toHaveBeenCalledTimes(1)
  })
})
