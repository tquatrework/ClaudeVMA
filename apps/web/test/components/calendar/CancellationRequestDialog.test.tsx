import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/api/calendar')
import { requestEventCancellation } from '../../../src/api/calendar'

import CancellationRequestDialog from '../../../src/components/calendar/CancellationRequestDialog'

const mockRequestEventCancellation = vi.mocked(requestEventCancellation)

function renderDialog(
  overrides: Partial<{
    eventId: string
    eventTitle: string
    onCancelled: () => void
    onClose: () => void
  }> = {},
) {
  return render(
    <CancellationRequestDialog
      eventId={overrides.eventId ?? 'evt-cancel-1'}
      eventTitle={overrides.eventTitle ?? 'Cours de mathématiques'}
      onCancelled={overrides.onCancelled ?? vi.fn()}
      onClose={overrides.onClose ?? vi.fn()}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CancellationRequestDialog', () => {
  it('rend la modale avec le titre et la textarea de raison', () => {
    renderDialog()

    expect(screen.getByRole('dialog', { name: /demande d'annulation/i })).toBeDefined()
    expect(screen.getByRole('heading', { name: "Demander l'annulation" })).toBeDefined()
    expect(screen.getByText('Cours de mathématiques')).toBeDefined()
    expect(screen.getByPlaceholderText(/expliquez la raison/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /demander l'annulation/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /annuler/i })).toBeDefined()
  })

  it('appelle POST /events/:id/cancel-request à la soumission du formulaire', async () => {
    mockRequestEventCancellation.mockResolvedValue({})

    renderDialog({ eventId: 'evt-test-99' })

    const reasonTextarea = screen.getByPlaceholderText(/expliquez la raison/i)
    await userEvent.type(reasonTextarea, 'Indisponibilité imprévue')

    const submitButton = screen.getByRole('button', { name: /demander l'annulation/i })
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(mockRequestEventCancellation).toHaveBeenCalledWith(
        'evt-test-99',
        expect.objectContaining({ reason: 'Indisponibilité imprévue' }),
      )
    })
  })

  it('appelle onCancelled après une réponse API sans pending_approval', async () => {
    const handleCancelled = vi.fn()
    mockRequestEventCancellation.mockResolvedValue({ status: 'cancelled' })

    renderDialog({ onCancelled: handleCancelled })

    await userEvent.click(screen.getByRole('button', { name: /demander l'annulation/i }))

    await waitFor(() => {
      expect(handleCancelled).toHaveBeenCalledTimes(1)
    })
  })

  it('affiche le message d\'attente d\'approbation si le status est pending_approval', async () => {
    mockRequestEventCancellation.mockResolvedValue({ status: 'pending_approval' })

    renderDialog()

    await userEvent.click(screen.getByRole('button', { name: /demander l'annulation/i }))

    await waitFor(() => {
      expect(screen.getByText("Demande en attente d'approbation")).toBeDefined()
    })
  })
})
