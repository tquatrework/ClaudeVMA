import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CalendarUnifiedView from '../../../src/components/calendar/CalendarUnifiedView'

vi.mock('../../../src/api/calendar')
vi.mock('../../../src/api/video')

import {
  createAvailabilitySlot,
  deleteAvailabilitySlot,
  fetchAvailability,
  fetchOwnerCalendarActivities,
  acceptActivity,
  declineActivity,
  fetchOwnerEvents,
  createOwnerEvent,
  acceptEventInvitation,
  declineEventInvitation,
  requestEventCancellation,
} from '../../../src/api/calendar'
import { fetchRoomByActivity } from '../../../src/api/video'

const mockFetchAvailability = vi.mocked(fetchAvailability)
const mockCreateAvailabilitySlot = vi.mocked(createAvailabilitySlot)
const mockDeleteAvailabilitySlot = vi.mocked(deleteAvailabilitySlot)
const mockFetchOwnerCalendarActivities = vi.mocked(fetchOwnerCalendarActivities)
const mockAcceptActivity = vi.mocked(acceptActivity)
const mockDeclineActivity = vi.mocked(declineActivity)
const mockFetchOwnerEvents = vi.mocked(fetchOwnerEvents)
const mockCreateOwnerEvent = vi.mocked(createOwnerEvent)
const mockAcceptEventInvitation = vi.mocked(acceptEventInvitation)
const mockDeclineEventInvitation = vi.mocked(declineEventInvitation)
const mockRequestEventCancellation = vi.mocked(requestEventCancellation)
const mockFetchRoomByActivity = vi.mocked(fetchRoomByActivity)

const OWNER_ID = 'owner-1'

function renderView(ownerId = OWNER_ID, userRole = 'formateur') {
  return render(
    <MemoryRouter initialEntries={['/calendar']}>
      <Routes>
        <Route
          path="/calendar"
          element={<CalendarUnifiedView ownerId={ownerId} userRole={userRole} />}
        />
        <Route path="/video-join/:roomId" element={<div>VideoJoinPage</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const EXISTING_SLOT = {
  id: 'slot-1',
  ownerId: OWNER_ID,
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '10:00',
  recurrence: 'WEEKLY' as const,
  recurrenceEndDate: null,
  kind: 'AVAILABLE' as const,
}

const PROPOSED_ACTIVITY = {
  id: 'activity-1',
  type: 'cours' as const,
  status: 'proposed' as const,
  startTime: '2026-09-10T14:00:00.000Z', // jeudi
  endTime: '2026-09-10T15:00:00.000Z',
  creatorId: 'teacher-9',
  creatorName: 'Camille Durand',
  participantIds: [OWNER_ID],
}

const FUTURE_ISO_1 = new Date(Date.now() + 86400000).toISOString()
const FUTURE_ISO_2 = new Date(Date.now() + 172800000).toISOString()

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchOwnerCalendarActivities.mockResolvedValue([])
  mockFetchOwnerEvents.mockResolvedValue([])
})

describe('CalendarUnifiedView — états', () => {
  it('affiche le chargement puis la grille', async () => {
    mockFetchAvailability.mockResolvedValue([EXISTING_SLOT])

    renderView()

    expect(screen.getByText('Chargement du calendrier…')).toBeDefined()

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /modifier le créneau lundi 09:00 – 10:00/i,
        }),
      ).toBeDefined()
    })
  })

  it('affiche un état vide explicite sans aucune donnée', async () => {
    mockFetchAvailability.mockResolvedValue([])

    renderView()

    await waitFor(() => {
      expect(screen.getByText("Aucune donnée dans votre calendrier pour l'instant")).toBeDefined()
    })
  })

  it('affiche une erreur de chargement des disponibilités', async () => {
    mockFetchAvailability.mockRejectedValue({ response: { status: 500 } })

    renderView()

    await waitFor(() => {
      expect(
        screen.getByText('Le serveur rencontre un problème. Veuillez réessayer plus tard.'),
      ).toBeDefined()
    })
  })

  it('affiche les trois sources fusionnées sur la même grille, sans onglet', async () => {
    mockFetchAvailability.mockResolvedValue([EXISTING_SLOT])
    mockFetchOwnerCalendarActivities.mockResolvedValue([PROPOSED_ACTIVITY])
    mockFetchOwnerEvents.mockResolvedValue([
      {
        id: 'evt-1',
        title: 'Réunion parents',
        startAt: FUTURE_ISO_1,
        endAt: FUTURE_ISO_2,
        eventType: 'pedagogique' as const,
      },
    ])

    renderView()

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /modifier le créneau lundi 09:00 – 10:00/i }),
      ).toBeDefined()
    })
    // Aucun onglet plus : tout est visible en une seule fois, sans navigation.
    expect(screen.queryByRole('tab', { name: /mes événements/i })).toBeNull()
    expect(screen.getByText('Camille Durand')).toBeDefined()
    expect(screen.getByText('Réunion parents')).toBeDefined()
  })
})

describe('CalendarUnifiedView — sélecteur de mode', () => {
  it("mode consultation (défaut) : les cases vides n'ouvrent rien", async () => {
    mockFetchAvailability.mockResolvedValue([])

    renderView()

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Consultation' }).getAttribute('aria-selected')).toBe(
        'true',
      )
    })

    const cell = screen.getByRole('button', { name: 'Ajouter un créneau lundi à 09:00' })
    expect(cell).toBeDisabled()
  })

  it('mode « Créer une disponibilité » : ouvre le formulaire pré-rempli au clic sur une cellule vide, puis crée le créneau', async () => {
    mockFetchAvailability.mockResolvedValue([])
    mockCreateAvailabilitySlot.mockResolvedValue(EXISTING_SLOT)

    renderView()

    await waitFor(() => screen.getByRole('tab', { name: 'Créer une disponibilité' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Créer une disponibilité' }))

    await userEvent.click(
      screen.getByRole('button', { name: 'Ajouter un créneau lundi à 09:00' }),
    )

    expect(screen.getByRole('dialog', { name: /nouveau créneau/i })).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: /^créer$/i }))

    await waitFor(() => {
      expect(mockCreateAvailabilitySlot).toHaveBeenCalledWith(
        OWNER_ID,
        expect.objectContaining({ dayOfWeek: 1, startTime: '09:00' }),
      )
    })
  })

  it('mode « Créer un événement » : ouvre la mini-popover au clic sur une cellule vide, sans jamais afficher de champ datetime-local', async () => {
    mockFetchAvailability.mockResolvedValue([])
    mockCreateOwnerEvent.mockResolvedValue({
      id: 'evt-quick-1',
      startAt: '2026-09-14T09:00:00.000Z',
      endAt: '2026-09-14T10:00:00.000Z',
      eventType: 'cours',
    })

    renderView()

    await waitFor(() => screen.getByRole('tab', { name: 'Créer un événement' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Créer un événement' }))

    await userEvent.click(
      screen.getByRole('button', { name: 'Ajouter un créneau lundi à 09:00' }),
    )

    const dialog = screen.getByRole('dialog', { name: /créer un événement/i })
    expect(dialog).toBeDefined()
    expect(document.querySelectorAll('input[type="datetime-local"]').length).toBe(0)

    await userEvent.click(screen.getByRole('button', { name: /^créer$/i }))

    await waitFor(() => {
      expect(mockCreateOwnerEvent).toHaveBeenCalledWith(
        OWNER_ID,
        expect.objectContaining({
          eventType: expect.any(String),
          startAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
          endAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
        }),
      )
    })
  })
})

describe('CalendarUnifiedView — suppression de disponibilité', () => {
  it('ouvre le formulaire en édition au clic sur un bloc et supprime le créneau', async () => {
    mockFetchAvailability.mockResolvedValue([EXISTING_SLOT])
    mockDeleteAvailabilitySlot.mockResolvedValue(undefined)

    renderView()

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /modifier le créneau lundi 09:00 – 10:00/i }),
      ).toBeDefined()
    })

    await userEvent.click(
      screen.getByRole('button', { name: /modifier le créneau lundi 09:00 – 10:00/i }),
    )

    expect(screen.getByRole('dialog', { name: /modifier le créneau/i })).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: /supprimer/i }))

    await waitFor(() => {
      expect(mockDeleteAvailabilitySlot).toHaveBeenCalledWith(OWNER_ID, EXISTING_SLOT.id)
    })
  })
})

describe('CalendarUnifiedView — propositions de créneau, révélées au clic (point 4)', () => {
  it("n'affiche pas Accepter/Refuser avant un premier clic sur le créneau", async () => {
    mockFetchAvailability.mockResolvedValue([])
    mockFetchOwnerCalendarActivities.mockResolvedValue([PROPOSED_ACTIVITY])

    renderView()

    await waitFor(() => {
      expect(screen.getByText('Camille Durand')).toBeDefined()
    })
    expect(screen.queryByRole('button', { name: /accepter la proposition de cours/i })).toBeNull()
    expect(screen.getByText('Cliquer pour répondre')).toBeDefined()
  })

  it('révèle Accepter/Refuser au premier clic, les masque au second clic sur le même bloc', async () => {
    mockFetchAvailability.mockResolvedValue([])
    mockFetchOwnerCalendarActivities.mockResolvedValue([PROPOSED_ACTIVITY])

    renderView()

    await waitFor(() => screen.getByText('Camille Durand'))
    await userEvent.click(screen.getByText('Camille Durand'))

    expect(screen.getByRole('button', { name: /accepter la proposition de cours/i })).toBeDefined()

    await userEvent.click(screen.getByText('Camille Durand'))

    expect(screen.queryByRole('button', { name: /accepter la proposition de cours/i })).toBeNull()
  })

  it('accepte une proposition révélée : le bloc passe en cours confirmé, sans bouton', async () => {
    mockFetchAvailability.mockResolvedValue([])
    mockFetchOwnerCalendarActivities.mockResolvedValue([PROPOSED_ACTIVITY])
    mockAcceptActivity.mockResolvedValue({
      id: 'activity-1',
      type: 'cours',
      creatorId: 'teacher-9',
      creatorRole: 'formateur',
      participantIds: [OWNER_ID],
      startTime: PROPOSED_ACTIVITY.startTime,
      endTime: PROPOSED_ACTIVITY.endTime,
      status: 'confirmed',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    })

    renderView()

    await waitFor(() => screen.getByText('Camille Durand'))
    await userEvent.click(screen.getByText('Camille Durand'))
    await userEvent.click(screen.getByRole('button', { name: /accepter la proposition de cours/i }))

    await waitFor(() => {
      expect(mockAcceptActivity).toHaveBeenCalledWith('activity-1')
    })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /accepter la proposition de cours/i })).toBeNull()
    })
    expect(screen.getByText('Camille Durand')).toBeDefined()
  })

  it('refuse une proposition révélée : le bloc disparaît de la grille', async () => {
    mockFetchAvailability.mockResolvedValue([])
    mockFetchOwnerCalendarActivities.mockResolvedValue([PROPOSED_ACTIVITY])
    mockDeclineActivity.mockResolvedValue({
      id: 'activity-1',
      type: 'cours',
      creatorId: 'teacher-9',
      creatorRole: 'formateur',
      participantIds: [OWNER_ID],
      startTime: PROPOSED_ACTIVITY.startTime,
      endTime: PROPOSED_ACTIVITY.endTime,
      status: 'cancelled',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    })

    renderView()

    await waitFor(() => screen.getByText('Camille Durand'))
    await userEvent.click(screen.getByText('Camille Durand'))
    await userEvent.click(screen.getByRole('button', { name: /refuser la proposition de cours/i }))

    await waitFor(() => {
      expect(mockDeclineActivity).toHaveBeenCalledWith('activity-1')
    })
    await waitFor(() => {
      expect(screen.queryByText('Camille Durand')).toBeNull()
    })
  })
})

describe('CalendarUnifiedView — rejoindre un cours confirmé', () => {
  const CONFIRMED_COURSE_ACTIVITY = {
    id: 'activity-2',
    type: 'cours' as const,
    status: 'confirmed' as const,
    startTime: '2026-09-10T14:00:00.000Z',
    endTime: '2026-09-10T15:00:00.000Z',
    creatorId: 'teacher-9',
    creatorName: 'Camille Durand',
    participantIds: [OWNER_ID],
  }

  it('résout la salle puis navigue vers /video-join/:roomId au clic — toujours visible, sans révélation préalable', async () => {
    mockFetchAvailability.mockResolvedValue([])
    mockFetchOwnerCalendarActivities.mockResolvedValue([CONFIRMED_COURSE_ACTIVITY])
    mockFetchRoomByActivity.mockResolvedValue({ id: 'room-xyz', status: 'active' })

    renderView()

    await waitFor(() => screen.getByRole('button', { name: /rejoindre le cours/i }))
    await userEvent.click(screen.getByRole('button', { name: /rejoindre le cours/i }))

    await waitFor(() => {
      expect(mockFetchRoomByActivity).toHaveBeenCalledWith('activity-2')
    })
    await waitFor(() => {
      expect(screen.getByText('VideoJoinPage')).toBeDefined()
    })
  })
})

describe('CalendarUnifiedView — événements de calendrier fusionnés (point 1)', () => {
  it('ouvre le détail au clic sur un bloc événement', async () => {
    mockFetchAvailability.mockResolvedValue([])
    mockFetchOwnerEvents.mockResolvedValue([
      {
        id: 'evt-detail-1',
        title: 'Cours à annuler',
        startAt: FUTURE_ISO_1,
        endAt: FUTURE_ISO_2,
        eventType: 'cours' as const,
      },
    ])

    renderView()

    await waitFor(() => screen.getByText('Cours à annuler'))
    await userEvent.click(screen.getByText('Cours à annuler'))

    expect(screen.getByRole('dialog', { name: /détail de l'événement/i })).toBeDefined()
  })

  it("demande l'annulation depuis le détail de l'événement", async () => {
    mockFetchAvailability.mockResolvedValue([])
    mockFetchOwnerEvents.mockResolvedValue([
      {
        id: 'evt-cancel-1',
        title: 'Cours à annuler',
        startAt: FUTURE_ISO_1,
        endAt: FUTURE_ISO_2,
        eventType: 'cours' as const,
      },
    ])
    mockRequestEventCancellation.mockResolvedValue({})

    renderView()

    await waitFor(() => screen.getByText('Cours à annuler'))
    await userEvent.click(screen.getByText('Cours à annuler'))
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
      expect(mockRequestEventCancellation).toHaveBeenCalledWith('evt-cancel-1', expect.any(Object))
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /détail de l'événement/i })).toBeNull()
    })
  })
})

describe('CalendarUnifiedView — invitations', () => {
  it('affiche le statut accepté après avoir cliqué sur "Accepter" dans le bandeau d\'invitation', async () => {
    mockFetchAvailability.mockResolvedValue([])
    mockFetchOwnerEvents.mockResolvedValue([
      {
        id: 'inv-evt-1',
        title: 'Réunion pédagogique',
        startAt: FUTURE_ISO_1,
        endAt: FUTURE_ISO_2,
        eventType: 'invitation' as const,
        inviteeStatus: 'pending' as const,
      },
    ])
    mockAcceptEventInvitation.mockResolvedValue(undefined)

    renderView()

    await waitFor(() => {
      expect(screen.getByText('Invitations en attente (1)')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /^accepter$/i }))

    await waitFor(() => {
      expect(mockAcceptEventInvitation).toHaveBeenCalledWith('inv-evt-1', OWNER_ID)
    })
  })

  it('retire l\'invitation refusée du bandeau', async () => {
    mockFetchAvailability.mockResolvedValue([])
    mockFetchOwnerEvents.mockResolvedValue([
      {
        id: 'inv-evt-2',
        title: 'Cours optionnel',
        startAt: FUTURE_ISO_1,
        endAt: FUTURE_ISO_2,
        eventType: 'invitation' as const,
        inviteeStatus: 'pending' as const,
      },
    ])
    mockDeclineEventInvitation.mockResolvedValue(undefined)

    renderView()

    await waitFor(() => screen.getByText('Invitations en attente (1)'))
    await userEvent.click(screen.getByRole('button', { name: /^refuser$/i }))

    await waitFor(() => {
      expect(mockDeclineEventInvitation).toHaveBeenCalledWith('inv-evt-2', OWNER_ID)
    })
    await waitFor(() => {
      expect(screen.queryByText('Invitations en attente')).toBeNull()
    })
  })
})
