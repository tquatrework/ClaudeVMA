import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/api/client')
import apiClient from '../../../src/api/client'

import AvailabilityEditor from '../../../src/components/calendar/AvailabilityEditor'

const mockApiClient = vi.mocked(apiClient)

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

    mockApiClient.get = vi.fn().mockResolvedValue({ data: availabilitySlots })

    render(<AvailabilityEditor ownerId="owner-33" />)

    expect(screen.getByText('Chargement des disponibilités…')).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText('lundi')).toBeDefined()
      expect(screen.getByText('09:00 – 12:00')).toBeDefined()
      expect(screen.getByText('Samedi matin uniquement')).toBeDefined()
    })

    expect(mockApiClient.get).toHaveBeenCalledWith('/calendars/owner-33/availability')
  })

  it('affiche l\'état vide si aucun créneau de disponibilité n\'est retourné', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    render(<AvailabilityEditor ownerId="owner-empty" />)

    await waitFor(() => {
      expect(screen.getByText('Aucun créneau de disponibilité renseigné')).toBeDefined()
    })
  })
})
