/**
 * Tests pour RecordingCommentTimeline — Phase 5 (video-session-service)
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RecordingCommentTimeline from '../../../src/components/video/RecordingCommentTimeline'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/video')

import { addRecordingComment } from '../../../src/api/video'

const mockAddRecordingComment = vi.mocked(addRecordingComment)

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
    mockAddRecordingComment.mockResolvedValue({
      id: 'comment-1',
      timestampSeconds: 0,
      content: 'Excellent exemple ici',
      createdAt: '2026-07-21T10:00:00.000Z',
    })

    renderTimeline('rec-123', 'formateur')

    await userEvent.type(screen.getByLabelText('Commentaire'), 'Excellent exemple ici')
    await userEvent.click(screen.getByRole('button', { name: /envoyer/i }))

    await waitFor(() => {
      expect(mockAddRecordingComment).toHaveBeenCalledWith('rec-123', {
        timestampSeconds: 0,
        content: 'Excellent exemple ici',
      })
    })

    await waitFor(() => {
      expect(screen.getByText('Excellent exemple ici')).toBeDefined()
    })
  })

  /**
   * Le commentaire listé est celui que le **serveur** a enregistré, pas celui qu'on a envoyé.
   * Jusqu'au 2026-08-10, la timeline reconstruisait localement une ligne à partir de la saisie
   * (identifiant `local-<horodatage>`, horloge du navigateur) et jetait la réponse : ce que
   * l'utilisateur relisait n'était que sa propre frappe. Aucune route de lecture n'existant pour
   * ces commentaires, l'écart n'aurait été corrigé par aucun rechargement.
   */
  it('liste le commentaire tel que le serveur l’a enregistré, pas la saisie', async () => {
    mockAddRecordingComment.mockResolvedValue({
      id: 'comment-7',
      timestampSeconds: 42,
      content: 'Excellent exemple ici (relu et normalisé)',
      createdAt: '2026-08-10T10:00:00.000Z',
    })

    renderTimeline('rec-123', 'formateur')

    await userEvent.type(screen.getByLabelText('Commentaire'), 'excellent exemple ici')
    await userEvent.click(screen.getByRole('button', { name: /envoyer/i }))

    await waitFor(() => {
      expect(screen.getByText('Excellent exemple ici (relu et normalisé)')).toBeDefined()
    })
    expect(screen.queryByText('excellent exemple ici')).toBeNull()
    // La position vient elle aussi de la réponse : elle est affichée en m:ss.
    expect(screen.getByText('0:42')).toBeDefined()
  })

  it('affiche une erreur fixe si l\'envoi échoue', async () => {
    mockAddRecordingComment.mockRejectedValue({ response: { status: 400 } })

    renderTimeline('rec-123', 'eleve')

    await userEvent.type(screen.getByLabelText('Commentaire'), 'Un commentaire')
    await userEvent.click(screen.getByRole('button', { name: /envoyer/i }))

    await waitFor(() => {
      expect(screen.getByText("Impossible d'envoyer le commentaire")).toBeDefined()
    })
  })

  it('appelle onClose quand on clique sur "Fermer"', async () => {
    const { onClose } = renderTimeline('rec-123', 'eleve')

    await userEvent.click(screen.getByRole('button', { name: /fermer/i }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
