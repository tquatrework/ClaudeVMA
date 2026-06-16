/**
 * Tests pour RecordingCommentTimeline — Phase 5 (video-session-service)
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RecordingCommentTimeline from '../../../src/components/video/RecordingCommentTimeline'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/client')

import apiClient from '../../../src/api/client'

const mockApiClient = vi.mocked(apiClient)

function renderTimeline(recordingId: string, userRole: string) {
  const onClose = vi.fn()
  return {
    onClose,
    ...render(
      <MemoryRouter>
        <RecordingCommentTimeline
          recordingId={recordingId}
          userRole={userRole}
          onClose={onClose}
        />
      </MemoryRouter>,
    ),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RecordingCommentTimeline — accès parent refusé', () => {
  it("affiche le message d'accès refusé pour parent_financeur", () => {
    renderTimeline('rec-123', 'parent_financeur')

    expect(screen.getByText('Accès non autorisé aux commentaires')).toBeDefined()
    expect(screen.queryByRole('button', { name: /envoyer/i })).toBeNull()
  })
})

describe('RecordingCommentTimeline — formulaire commentaire', () => {
  it('affiche le formulaire de commentaire pour un formateur', () => {
    renderTimeline('rec-123', 'formateur')

    expect(screen.getByLabelText('Position (secondes)')).toBeDefined()
    expect(screen.getByLabelText('Commentaire')).toBeDefined()
    expect(screen.getByRole('button', { name: /envoyer/i })).toBeDefined()
  })

  it('envoie le commentaire et le liste dans la timeline', async () => {
    mockApiClient.post = vi.fn().mockResolvedValue({ data: {} })

    renderTimeline('rec-123', 'formateur')

    await userEvent.type(screen.getByLabelText('Commentaire'), 'Excellent exemple ici')
    await userEvent.click(screen.getByRole('button', { name: /envoyer/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/recordings/rec-123/comments', {
        timestampSeconds: 0,
        content: 'Excellent exemple ici',
      })
    })

    await waitFor(() => {
      expect(screen.getByText('Excellent exemple ici')).toBeDefined()
    })
  })

  it('appelle onClose quand on clique sur "Fermer"', async () => {
    const { onClose } = renderTimeline('rec-123', 'eleve')

    await userEvent.click(screen.getByRole('button', { name: /fermer/i }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
