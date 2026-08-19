import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AvailabilityTab from '../../../src/components/calendar/AvailabilityTab'

vi.mock('../../../src/api/calendar')
vi.mock('../../../src/api/video')

import {
  createAvailabilitySlot,
  deleteAvailabilitySlot,
  fetchAvailability,
  fetchOwnerCalendarActivities,
  acceptActivity,
  declineActivity,
} from '../../../src/api/calendar'
import { fetchRoomByActivity } from '../../../src/api/video'

const mockFetchAvailability = vi.mocked(fetchAvailability)
const mockCreateAvailabilitySlot = vi.mocked(createAvailabilitySlot)
const mockDeleteAvailabilitySlot = vi.mocked(deleteAvailabilitySlot)
const mockFetchOwnerCalendarActivities = vi.mocked(fetchOwnerCalendarActivities)
const mockAcceptActivity = vi.mocked(acceptActivity)
const mockDeclineActivity = vi.mocked(declineActivity)
const mockFetchRoomByActivity = vi.mocked(fetchRoomByActivity)

const OWNER_ID = 'owner-1'

function renderTab(ownerId = OWNER_ID) {
  return render(
    <MemoryRouter initialEntries={['/calendar']}>
      <Routes>
        <Route path="/calendar" element={<AvailabilityTab ownerId={ownerId} />} />
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

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchOwnerCalendarActivities.mockResolvedValue([])
})

describe('AvailabilityTab — états', () => {
  it('affiche le chargement puis la grille', async () => {
    mockFetchAvailability.mockResolvedValue([EXISTING_SLOT])

    renderTab()

    expect(screen.getByText('Chargement des disponibilités…')).toBeDefined()

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /modifier le créneau lundi 09:00 – 10:00/i,
        }),
      ).toBeDefined()
    })
  })

  it('affiche un état vide explicite sans créneau', async () => {
    mockFetchAvailability.mockResolvedValue([])

    renderTab()

    await waitFor(() => {
      expect(screen.getByText('Aucun créneau de disponibilité renseigné')).toBeDefined()
    })
  })

  it("affiche une erreur de chargement", async () => {
    mockFetchAvailability.mockRejectedValue({ response: { status: 500 } })

    renderTab()

    await waitFor(() => {
      expect(screen.getByText('Le serveur rencontre un problème. Veuillez réessayer plus tard.')).toBeDefined()
    })
  })
})

describe('AvailabilityTab — création', () => {
  it('ouvre le formulaire pré-rempli au clic sur une cellule vide, puis crée le créneau', async () => {
    mockFetchAvailability.mockResolvedValue([])
    mockCreateAvailabilitySlot.mockResolvedValue(EXISTING_SLOT)

    renderTab()

    await waitFor(() => {
      expect(screen.getByText('Aucun créneau de disponibilité renseigné')).toBeDefined()
    })

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

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })
})

describe('AvailabilityTab — suppression', () => {
  it('ouvre le formulaire en édition au clic sur un bloc et supprime le créneau', async () => {
    mockFetchAvailability.mockResolvedValue([EXISTING_SLOT])
    mockDeleteAvailabilitySlot.mockResolvedValue(undefined)

    renderTab()

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

// ---------------------------------------------------------------------------
// Propositions de créneau de cours — affichage inline (chantier calendrier, point 3)
// ---------------------------------------------------------------------------
describe('AvailabilityTab — propositions de créneau inline', () => {
  it('affiche une proposition reçue avec le nom du proposeur et les boutons Accepter/Refuser', async () => {
    mockFetchAvailability.mockResolvedValue([])
    mockFetchOwnerCalendarActivities.mockResolvedValue([PROPOSED_ACTIVITY])

    renderTab()

    await waitFor(() => {
      expect(screen.getByText('Camille Durand')).toBeDefined()
    })
    expect(screen.getByRole('button', { name: /accepter la proposition de cours/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /refuser la proposition de cours/i })).toBeDefined()
    // Jamais l'UUID du proposeur ou du destinataire à l'écran.
    expect(screen.queryByText(PROPOSED_ACTIVITY.creatorId)).toBeNull()
  })

  it('affiche un texte neutre en français si le serveur ne résout pas le nom du proposeur', async () => {
    mockFetchAvailability.mockResolvedValue([])
    mockFetchOwnerCalendarActivities.mockResolvedValue([
      { ...PROPOSED_ACTIVITY, creatorName: null },
    ])

    renderTab()

    await waitFor(() => {
      expect(screen.getByText('Formateur')).toBeDefined()
    })
  })

  it('accepte une proposition : le bloc passe en cours confirmé, sans bouton', async () => {
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

    renderTab()

    await waitFor(() => screen.getByRole('button', { name: /accepter la proposition de cours/i }))
    await userEvent.click(screen.getByRole('button', { name: /accepter la proposition de cours/i }))

    await waitFor(() => {
      expect(mockAcceptActivity).toHaveBeenCalledWith('activity-1')
    })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /accepter la proposition de cours/i })).toBeNull()
    })
    expect(screen.getByText('Camille Durand')).toBeDefined()
  })

  it('refuse une proposition : le bloc disparaît de la grille', async () => {
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

    renderTab()

    await waitFor(() => screen.getByRole('button', { name: /refuser la proposition de cours/i }))
    await userEvent.click(screen.getByRole('button', { name: /refuser la proposition de cours/i }))

    await waitFor(() => {
      expect(mockDeclineActivity).toHaveBeenCalledWith('activity-1')
    })
    await waitFor(() => {
      expect(screen.queryByText('Camille Durand')).toBeNull()
    })
  })

  it('affiche un message explicite et rafraîchit la liste sur un conflit 409 (déjà traitée)', async () => {
    mockFetchAvailability.mockResolvedValue([])
    mockFetchOwnerCalendarActivities.mockResolvedValue([PROPOSED_ACTIVITY])
    mockAcceptActivity.mockRejectedValue({ response: { status: 409 } })

    renderTab()

    await waitFor(() => screen.getByRole('button', { name: /accepter la proposition de cours/i }))
    await userEvent.click(screen.getByRole('button', { name: /accepter la proposition de cours/i }))

    await waitFor(() => {
      expect(screen.getByText(/déjà été traitée/i)).toBeDefined()
    })
    // Rafraîchissement : un second appel de lecture après le conflit.
    await waitFor(() => {
      expect(mockFetchOwnerCalendarActivities.mock.calls.length).toBeGreaterThan(1)
    })
  })
})

// ---------------------------------------------------------------------------
// Rejoindre le cours depuis un bloc confirmé (chantier calendrier-visio-livekit, point 2)
// ---------------------------------------------------------------------------
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

describe('AvailabilityTab — rejoindre un cours confirmé', () => {
  it('affiche "Rejoindre le cours" sur un bloc cours confirmé, jamais sur une réunion pédagogique', async () => {
    mockFetchAvailability.mockResolvedValue([])
    mockFetchOwnerCalendarActivities.mockResolvedValue([
      CONFIRMED_COURSE_ACTIVITY,
      { ...CONFIRMED_COURSE_ACTIVITY, id: 'activity-3', type: 'reunion_pedagogique' },
    ])

    renderTab()

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /rejoindre le cours/i }).length).toBe(1)
    })
  })

  it('résout la salle puis navigue vers /video-join/:roomId au clic', async () => {
    mockFetchAvailability.mockResolvedValue([])
    mockFetchOwnerCalendarActivities.mockResolvedValue([CONFIRMED_COURSE_ACTIVITY])
    mockFetchRoomByActivity.mockResolvedValue({ id: 'room-xyz', status: 'active' })

    renderTab()

    await waitFor(() => screen.getByRole('button', { name: /rejoindre le cours/i }))
    await userEvent.click(screen.getByRole('button', { name: /rejoindre le cours/i }))

    await waitFor(() => {
      expect(mockFetchRoomByActivity).toHaveBeenCalledWith('activity-2')
    })
    await waitFor(() => {
      expect(screen.getByText('VideoJoinPage')).toBeDefined()
    })
    // Jamais l'activityId ni l'id de salle affichés comme libellé.
    expect(screen.queryByText('activity-2')).toBeNull()
    expect(screen.queryByText('room-xyz')).toBeNull()
  })

  it("affiche un message explicite si la salle n'est pas encore disponible (404)", async () => {
    mockFetchAvailability.mockResolvedValue([])
    mockFetchOwnerCalendarActivities.mockResolvedValue([CONFIRMED_COURSE_ACTIVITY])
    mockFetchRoomByActivity.mockRejectedValue({ response: { status: 404 } })

    renderTab()

    await waitFor(() => screen.getByRole('button', { name: /rejoindre le cours/i }))
    await userEvent.click(screen.getByRole('button', { name: /rejoindre le cours/i }))

    await waitFor(() => {
      expect(
        screen.getByText("La salle de ce cours n'est pas encore disponible. Réessayez un peu plus tard."),
      ).toBeDefined()
    })
  })
})
