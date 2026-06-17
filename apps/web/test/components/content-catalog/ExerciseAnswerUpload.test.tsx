/**
 * Tests pour ExerciseAnswerUpload (Phase 12)
 *
 * Couvre :
 * - L'élève voit le formulaire de soumission de réponse
 * - La soumission réussie affiche le message de confirmation
 * - La soumission d'une réponse vide affiche une erreur de validation locale
 * - Une erreur 403 affiche un message d'accès refusé
 * - Une erreur réseau affiche un message générique
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ExerciseAnswerUpload from '../../../src/components/content-catalog/ExerciseAnswerUpload'

vi.mock('../../../src/api/contentCatalog')

import { submitExerciseAnswer } from '../../../src/api/contentCatalog'

const mockSubmitExerciseAnswer = vi.mocked(submitExerciseAnswer)

const MOCK_ANSWER = {
  id: 'answer-1',
  exerciseId: 'exercise-1',
  studentId: 'student-1',
  content: 'Ma réponse détaillée',
  submittedAt: '2026-06-17T10:00:00Z',
}

function renderComponent(onAnswerSubmitted = vi.fn()) {
  return render(
    <ExerciseAnswerUpload
      exerciseId="exercise-1"
      onAnswerSubmitted={onAnswerSubmitted}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ExerciseAnswerUpload', () => {
  it('affiche le formulaire de soumission de réponse', () => {
    mockSubmitExerciseAnswer.mockResolvedValue(MOCK_ANSWER)
    renderComponent()

    expect(screen.getByText('Soumettre votre réponse')).toBeDefined()
    expect(screen.getByRole('button', { name: /soumettre la réponse/i })).toBeDefined()
  })

  it('le bouton de soumission est désactivé si la réponse est vide', () => {
    mockSubmitExerciseAnswer.mockResolvedValue(MOCK_ANSWER)
    renderComponent()

    const submitButton = screen.getByRole('button', { name: /soumettre la réponse/i })
    expect((submitButton as HTMLButtonElement).disabled).toBe(true)
  })

  it('active le bouton de soumission quand la réponse est renseignée', async () => {
    mockSubmitExerciseAnswer.mockResolvedValue(MOCK_ANSWER)
    renderComponent()

    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'Ma réponse')

    const submitButton = screen.getByRole('button', { name: /soumettre la réponse/i })
    expect((submitButton as HTMLButtonElement).disabled).toBe(false)
  })

  it('soumet la réponse et affiche le message de succès', async () => {
    const onAnswerSubmitted = vi.fn()
    mockSubmitExerciseAnswer.mockResolvedValue(MOCK_ANSWER)
    renderComponent(onAnswerSubmitted)

    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'Ma réponse détaillée')
    await userEvent.click(screen.getByRole('button', { name: /soumettre la réponse/i }))

    await waitFor(() => {
      expect(screen.getByText(/Réponse soumise avec succès/)).toBeDefined()
    })
    expect(onAnswerSubmitted).toHaveBeenCalledWith(MOCK_ANSWER)
  })

  it("affiche le bouton de demande de correction après soumission réussie", async () => {
    mockSubmitExerciseAnswer.mockResolvedValue(MOCK_ANSWER)
    renderComponent()

    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'Ma réponse')
    await userEvent.click(screen.getByRole('button', { name: /soumettre la réponse/i }))

    await waitFor(() => {
      expect(screen.getByText(/Vous pouvez désormais demander une correction/)).toBeDefined()
    })
  })

  it('affiche une erreur 403 quand le serveur refuse', async () => {
    mockSubmitExerciseAnswer.mockRejectedValue({ response: { status: 403 } })
    renderComponent()

    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'Ma réponse')
    await userEvent.click(screen.getByRole('button', { name: /soumettre la réponse/i }))

    await waitFor(() => {
      expect(screen.getByText(/Vous n'êtes pas autorisé/)).toBeDefined()
    })
  })

  it('affiche une erreur générique en cas de panne réseau', async () => {
    mockSubmitExerciseAnswer.mockRejectedValue(new Error('Network error'))
    renderComponent()

    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'Ma réponse')
    await userEvent.click(screen.getByRole('button', { name: /soumettre la réponse/i }))

    await waitFor(() => {
      expect(screen.getByText(/Impossible de soumettre la réponse/)).toBeDefined()
    })
  })
})
