/**
 * Tests pour RecordingListPanel — Phase 5 (video-session-service)
 *
 * Couvre :
 * 3. Parent ne peut pas accéder à la vue enregistrements
 * 4. Liste vide → message approprié
 * 5. Enregistrements expirés → badge "Expiré" affiché, lien absent
 */

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RecordingListPanel from '../../../src/components/video/RecordingListPanel'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/client')

import apiClient from '../../../src/api/client'

const mockApiClient = vi.mocked(apiClient)

function renderPanel(roomId: string, userRole: string) {
  return render(
    <MemoryRouter>
      <RecordingListPanel roomId={roomId} userRole={userRole} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Test 3 — Parent ne peut pas accéder à la vue enregistrements
// ---------------------------------------------------------------------------
describe('RecordingListPanel — accès parent refusé', () => {
  it("affiche le message d'accès refusé pour parent_financeur sans appel API", () => {
    mockApiClient.get = vi.fn()

    renderPanel('room-abc', 'parent_financeur')

    expect(screen.getByText('Accès non autorisé aux enregistrements')).toBeDefined()
    expect(mockApiClient.get).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Test 4 — Liste vide
// ---------------------------------------------------------------------------
describe('RecordingListPanel — état vide', () => {
  it('affiche le message "Aucun enregistrement disponible" quand la liste est vide', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderPanel('room-abc', 'formateur')

    await waitFor(() => {
      expect(screen.getByText('Aucun enregistrement disponible')).toBeDefined()
    })

    expect(mockApiClient.get).toHaveBeenCalledWith('/video/rooms/room-abc/recordings')
  })
})

// ---------------------------------------------------------------------------
// Test 5 — Enregistrements expirés
// ---------------------------------------------------------------------------
describe('RecordingListPanel — enregistrements expirés', () => {
  it('affiche le badge "Expiré" et pas de lien de téléchargement pour un enregistrement expiré', async () => {
    const expiredRecordings = [
      {
        id: 'rec-expired-1',
        downloadUrl: 'https://storage.example.com/rec-expired-1.mp4',
        expiresAt: '2024-01-01T00:00:00.000Z',
        isExpired: true,
      },
    ]

    mockApiClient.get = vi.fn().mockResolvedValue({ data: expiredRecordings })

    renderPanel('room-abc', 'formateur')

    await waitFor(() => {
      expect(screen.getByText('Expiré')).toBeDefined()
    })

    expect(screen.queryByText('Télécharger')).toBeNull()
  })

  it('affiche le lien de téléchargement pour un enregistrement non expiré', async () => {
    const activeRecordings = [
      {
        id: 'rec-active-1',
        downloadUrl: 'https://storage.example.com/rec-active-1.mp4',
        expiresAt: '2030-12-31T00:00:00.000Z',
        isExpired: false,
      },
    ]

    mockApiClient.get = vi.fn().mockResolvedValue({ data: activeRecordings })

    renderPanel('room-abc', 'eleve')

    await waitFor(() => {
      expect(screen.getByText('Télécharger')).toBeDefined()
    })

    expect(screen.queryByText('Expiré')).toBeNull()
  })

  it('affiche le badge "Expiré" et pas de lien même si downloadUrl présente', async () => {
    const mixedRecordings = [
      {
        id: 'rec-1',
        downloadUrl: 'https://storage.example.com/rec-1.mp4',
        expiresAt: '2024-01-01T00:00:00.000Z',
        isExpired: true,
      },
      {
        id: 'rec-2',
        downloadUrl: 'https://storage.example.com/rec-2.mp4',
        expiresAt: '2030-12-31T00:00:00.000Z',
        isExpired: false,
      },
    ]

    mockApiClient.get = vi.fn().mockResolvedValue({ data: mixedRecordings })

    renderPanel('room-abc', 'responsable_pedagogique')

    await waitFor(() => {
      expect(screen.getByText('Expiré')).toBeDefined()
      expect(screen.getByText('Télécharger')).toBeDefined()
    })
  })
})
