/**
 * Tests pour CorrectionRequestDialog (Phase 12)
 *
 * Couvre :
 * - Le dialog est masqué quand isOpen=false
 * - Le dialog est visible quand isOpen=true
 * - La soumission réussie déclenche onCorrectionRequested et onClose
 * - Une erreur 409 affiche "déjà en cours"
 * - Le bouton annuler ferme le dialog sans soumettre
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CorrectionRequestDialog from '../../../src/components/content-catalog/CorrectionRequestDialog'

vi.mock('../../../src/api/contentCatalog')

import { requestExerciseCorrection } from '../../../src/api/contentCatalog'

const mockRequestExerciseCorrection = vi.mocked(requestExerciseCorrection)

const MOCK_CORRECTION_REQUEST = {
  id: 'correction-1',
  exerciseAnswerId: 'answer-1',
  studentId: 'student-1',
  requestedAt: '2026-06-17T10:00:00Z',
  correctionStatus: 'pending' as const,
}

function renderDialog({
  isOpen = true,
  onClose = vi.fn(),
  onCorrectionRequested = vi.fn(),
} = {}) {
  return render(
    <CorrectionRequestDialog
      answerId="answer-1"
      isOpen={isOpen}
      onClose={onClose}
      onCorrectionRequested={onCorrectionRequested}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CorrectionRequestDialog', () => {
  it('ne rend rien quand isOpen=false', () => {
    renderDialog({ isOpen: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('affiche le dialog quand isOpen=true', () => {
    renderDialog()
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByText('Demander une correction')).toBeDefined()
  })

  it('soumet la demande et déclenche les callbacks', async () => {
    const onClose = vi.fn()
    const onCorrectionRequested = vi.fn()
    mockRequestExerciseCorrection.mockResolvedValue(MOCK_CORRECTION_REQUEST)

    renderDialog({ onClose, onCorrectionRequested })

    await userEvent.click(screen.getByRole('button', { name: /demander la correction/i }))

    await waitFor(() => {
      expect(onCorrectionRequested).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('soumet avec un message optionnel', async () => {
    mockRequestExerciseCorrection.mockResolvedValue(MOCK_CORRECTION_REQUEST)

    renderDialog()

    const messageInput = screen.getByRole('textbox')
    await userEvent.type(messageInput, 'J\'ai du mal avec la partie 2')
    await userEvent.click(screen.getByRole('button', { name: /demander la correction/i }))

    await waitFor(() => {
      expect(mockRequestExerciseCorrection).toHaveBeenCalledWith('answer-1', {
        message: 'J\'ai du mal avec la partie 2',
      })
    })
  })

  it('affiche une erreur 409 si une correction est déjà en cours', async () => {
    mockRequestExerciseCorrection.mockRejectedValue({ response: { status: 409 } })

    renderDialog()

    await userEvent.click(screen.getByRole('button', { name: /demander la correction/i }))

    await waitFor(() => {
      expect(screen.getByText(/déjà en cours/)).toBeDefined()
    })
  })

  it('affiche une erreur générique en cas de problème réseau', async () => {
    mockRequestExerciseCorrection.mockRejectedValue(new Error('Network error'))

    renderDialog()

    await userEvent.click(screen.getByRole('button', { name: /demander la correction/i }))

    await waitFor(() => {
      expect(screen.getByText(/Impossible de soumettre la demande/)).toBeDefined()
    })
  })

  it('le bouton Annuler ferme le dialog sans appeler la correction', async () => {
    const onClose = vi.fn()
    const onCorrectionRequested = vi.fn()

    renderDialog({ onClose, onCorrectionRequested })

    await userEvent.click(screen.getByRole('button', { name: /annuler/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onCorrectionRequested).not.toHaveBeenCalled()
    expect(mockRequestExerciseCorrection).not.toHaveBeenCalled()
  })
})
