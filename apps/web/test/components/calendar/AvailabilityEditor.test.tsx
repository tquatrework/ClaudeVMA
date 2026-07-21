import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/api/calendar')
import { fetchAvailability } from '../../../src/api/calendar'

import AvailabilityEditor from '../../../src/components/calendar/AvailabilityEditor'

const mockFetchAvailability = vi.mocked(fetchAvailability)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AvailabilityEditor', () => {
  it('charge et affiche les créneaux de disponibilité depuis GET /calendars/:ownerId/availability', async () => {
    const availabilitySlots = [
      {
        id: 'slot-1',
        dayOfWeek: 'lundi',
        startTime: '09:00',
        endTime: '12:00',
      },
      {
        id: 'slot-2',
        label: 'Samedi matin uniquement',
      },
    ]

    mockFetchAvailability.mockResolvedValue(availabilitySlots)

    render(<AvailabilityEditor ownerId="owner-33" />)

    expect(screen.getByText('Chargement des disponibilités…')).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText('lundi')).toBeDefined()
      expect(screen.getByText('09:00 – 12:00')).toBeDefined()
      expect(screen.getByText('Samedi matin uniquement')).toBeDefined()
    })

    expect(mockFetchAvailability).toHaveBeenCalledWith('owner-33')
  })

  it('affiche l\'état vide si aucun créneau de disponibilité n\'est retourné', async () => {
    mockFetchAvailability.mockResolvedValue([])

    render(<AvailabilityEditor ownerId="owner-empty" />)

    await waitFor(() => {
      expect(screen.getByText('Aucun créneau de disponibilité renseigné')).toBeDefined()
    })
  })

  it('affiche un message d\'erreur si le chargement échoue', async () => {
    mockFetchAvailability.mockRejectedValue(new Error('network down'))

    render(<AvailabilityEditor ownerId="owner-fail" />)

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger les disponibilités')).toBeDefined()
    })
  })
})
