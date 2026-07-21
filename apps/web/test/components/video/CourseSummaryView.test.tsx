/**
 * Tests pour CourseSummaryView — Phase 5 (video-session-service)
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CourseSummaryView from '../../../src/components/video/CourseSummaryView'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/video')

import { publishCourseSummary } from '../../../src/api/video'

const mockPublishCourseSummary = vi.mocked(publishCourseSummary)

function renderSummaryView(roomId: string, userRole: string, roomStatus: string) {
  return render(
    <MemoryRouter>
      <CourseSummaryView roomId={roomId} userRole={userRole} roomStatus={roomStatus} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CourseSummaryView — accès non autorisé', () => {
  it('affiche "Résumé non disponible" pour un élève même si room ended', () => {
    renderSummaryView('room-abc', 'eleve', 'ended')

    expect(screen.getByText('Résumé non disponible')).toBeDefined()
    expect(screen.queryByRole('button', { name: /publier le résumé/i })).toBeNull()
  })

  it('affiche "Résumé non disponible" pour un formateur si la room n\'est pas encore ended', () => {
    renderSummaryView('room-abc', 'formateur', 'active')

    expect(screen.getByText('Résumé non disponible')).toBeDefined()
    expect(screen.queryByRole('button', { name: /publier le résumé/i })).toBeNull()
  })

  it('affiche "Résumé non disponible" pour parent_financeur', () => {
    renderSummaryView('room-abc', 'parent_financeur', 'ended')

    expect(screen.getByText('Résumé non disponible')).toBeDefined()
  })
})

describe('CourseSummaryView — publication du résumé', () => {
  it('affiche le formulaire de résumé pour un formateur avec room ended', () => {
    renderSummaryView('room-abc', 'formateur', 'ended')

    expect(screen.getByLabelText('Résumé de cours')).toBeDefined()
    expect(screen.getByRole('button', { name: /publier le résumé/i })).toBeDefined()
  })

  it('affiche le formulaire pour un responsable_pedagogique', () => {
    renderSummaryView('room-abc', 'responsable_pedagogique', 'ended')

    expect(screen.getByRole('button', { name: /publier le résumé/i })).toBeDefined()
  })

  it('publie le résumé et affiche la confirmation', async () => {
    mockPublishCourseSummary.mockResolvedValue({
      id: 'summary-1',
      roomId: 'room-abc',
      authorId: 'teacher-1',
      content: 'Nous avons étudié les fractions',
      isPermanent: true,
      publishedAt: '2026-07-21T10:00:00.000Z',
      createdAt: '2026-07-21T10:00:00.000Z',
    })

    renderSummaryView('room-abc', 'formateur', 'ended')

    await userEvent.type(
      screen.getByLabelText('Résumé de cours'),
      'Nous avons étudié les fractions',
    )
    await userEvent.click(screen.getByRole('button', { name: /publier le résumé/i }))

    await waitFor(() => {
      expect(mockPublishCourseSummary).toHaveBeenCalledWith(
        'room-abc',
        'Nous avons étudié les fractions',
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Résumé publié avec succès')).toBeDefined()
    })
  })

  it('affiche une erreur si la publication échoue', async () => {
    mockPublishCourseSummary.mockRejectedValue({ response: { status: 500 } })

    renderSummaryView('room-abc', 'formateur', 'ended')

    await userEvent.type(screen.getByLabelText('Résumé de cours'), 'Contenu')
    await userEvent.click(screen.getByRole('button', { name: /publier le résumé/i }))

    await waitFor(() => {
      expect(screen.getByText('Impossible de publier le résumé')).toBeDefined()
    })
  })

  it('le bouton est désactivé quand le contenu est vide', () => {
    renderSummaryView('room-abc', 'animateur_pedagogique', 'ended')

    const submitButton = screen.getByRole('button', { name: /publier le résumé/i })
    expect(submitButton).toHaveProperty('disabled', true)
  })
})
