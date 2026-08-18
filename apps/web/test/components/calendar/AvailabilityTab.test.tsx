import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AvailabilityTab from '../../../src/components/calendar/AvailabilityTab'

vi.mock('../../../src/api/calendar')

import {
  createAvailabilitySlot,
  deleteAvailabilitySlot,
  fetchAvailability,
} from '../../../src/api/calendar'

const mockFetchAvailability = vi.mocked(fetchAvailability)
const mockCreateAvailabilitySlot = vi.mocked(createAvailabilitySlot)
const mockDeleteAvailabilitySlot = vi.mocked(deleteAvailabilitySlot)

const OWNER_ID = 'owner-1'

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

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AvailabilityTab — états', () => {
  it('affiche le chargement puis la grille', async () => {
    mockFetchAvailability.mockResolvedValue([EXISTING_SLOT])

    render(<AvailabilityTab ownerId={OWNER_ID} />)

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

    render(<AvailabilityTab ownerId={OWNER_ID} />)

    await waitFor(() => {
      expect(screen.getByText('Aucun créneau de disponibilité renseigné')).toBeDefined()
    })
  })

  it("affiche une erreur de chargement", async () => {
    mockFetchAvailability.mockRejectedValue({ response: { status: 500 } })

    render(<AvailabilityTab ownerId={OWNER_ID} />)

    await waitFor(() => {
      expect(screen.getByText('Le serveur rencontre un problème. Veuillez réessayer plus tard.')).toBeDefined()
    })
  })
})

describe('AvailabilityTab — création', () => {
  it('ouvre le formulaire pré-rempli au clic sur une cellule vide, puis crée le créneau', async () => {
    mockFetchAvailability.mockResolvedValue([])
    mockCreateAvailabilitySlot.mockResolvedValue(EXISTING_SLOT)

    render(<AvailabilityTab ownerId={OWNER_ID} />)

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

    render(<AvailabilityTab ownerId={OWNER_ID} />)

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
