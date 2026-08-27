/**
 * Tests — Carnet personnel (NotebookPage)
 *
 * Chantier de généralisation (pedagogical-log-service, PR #140, 2026-08-27) :
 * la page est désormais générique par titulaire, montée sur la route unique
 * `/notebook/mine` (plus de `:studentId` dans l'URL, le titulaire est déduit
 * du JWT côté serveur). Le contrôle de rôle (parent refusé, etc.) est
 * désormais entièrement porté par `ProtectedRoute` (App.tsx), pas par
 * `NotebookPage` elle-même — cette suite ne teste donc plus qu'un rôle
 * autorisé (élève) et vérifie le contrat contre `/pedagogical-logs/notebook`
 * (champ `ownerId`).
 *
 * Spécification révisée le 2026-08-27, après retour utilisateur sur les
 * captures d'écran (docs/architecture.md, « Specification fonctionnelle
 * reelle du carnet personnel — notes rapides immuables ») : ce sont des
 * pensées instantanées, IMMUABLES une fois écrites (suppression possible,
 * AUCUNE édition), retrouvées par recherche (date ou mot). Cette suite
 * couvre donc : ajout, suppression, recherche — et vérifie explicitement
 * l'ABSENCE de tout mécanisme d'édition.
 *
 * PedagogicalLogPage (cahier de texte) a sa propre suite dédiée depuis la
 * refonte du 2026-08-20 : test/pages/PedagogicalLogPage.test.tsx.
 *
 * Les tests du Mémo élève ont été déplacés dans test/pages/MemosPage.test.tsx
 * le 2026-08-27 (chantier `feat/memo-formules`) : l'ancien contrat testé ici
 * (`POST/GET/PUT/DELETE /memos/:id`, modèle plat) n'a jamais existé côté
 * serveur — voir `docs/routes.md` § « Mémo élève — assaini le 2026-08-27 ».
 * Le test du bouton « Mémo » de VideoPage vit désormais dans
 * test/pages/VideoPage.test.tsx, à côté du reste de cette page.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'

import NotebookPage from '../../src/pages/NotebookPage'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)

// ─── User fixtures ────────────────────────────────────────────────────────────

const STUDENT_USER = {
  id: 'student-42',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock(userObj = STUDENT_USER) {
  return {
    user: userObj,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(userObj.role)),
    isInternalRole: vi.fn(() =>
      ['responsable_pedagogique', 'animateur_pedagogique', 'technicien_informatique', 'administrateur_financier'].includes(userObj.role),
    ),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
})

// ─── Helper renderer ──────────────────────────────────────────────────────────

function renderNotebookPage() {
  return render(
    <MemoryRouter initialEntries={['/notebook/mine']}>
      <Routes>
        <Route path="/notebook/mine" element={<NotebookPage />} />
        <Route path="/forbidden" element={<div>Accès interdit</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

// ─── NotebookPage — pensées instantanées, route /pedagogical-logs/notebook ──

describe('NotebookPage — pensées instantanées', () => {
  it('charge et affiche les notes du carnet (sans filtre au montage)', async () => {
    const entries = [
      {
        id: 'note-1',
        ownerId: 'student-42',
        content: 'Mon objectif : 18/20 en maths',
        createdAt: new Date().toISOString(),
      },
    ]

    mockApiClient.get = vi.fn().mockResolvedValue({ data: entries })

    renderNotebookPage()

    await waitFor(() => {
      expect(screen.getByText('Mon objectif : 18/20 en maths')).toBeDefined()
    })

    expect(mockApiClient.get).toHaveBeenCalledWith('/pedagogical-logs/notebook', {
      params: undefined,
    })
  })

  it('permet au titulaire de noter une pensée', async () => {
    const newEntry = {
      id: 'note-new',
      ownerId: 'student-42',
      content: 'Revoir les intégrales',
      createdAt: new Date().toISOString(),
    }

    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })
    mockApiClient.post = vi.fn().mockResolvedValue({ data: newEntry })

    renderNotebookPage()

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/noter une pensée/i)).toBeDefined()
    })

    const textarea = screen.getByPlaceholderText(/noter une pensée/i)
    await userEvent.type(textarea, 'Revoir les intégrales')

    await userEvent.click(screen.getByRole('button', { name: /^noter$/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/pedagogical-logs/notebook',
        { content: 'Revoir les intégrales' },
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Revoir les intégrales')).toBeDefined()
    })
  })

  it('permet au titulaire de supprimer une note', async () => {
    const entries = [
      {
        id: 'note-del',
        ownerId: 'student-42',
        content: 'Note à supprimer',
        createdAt: new Date().toISOString(),
      },
    ]

    mockApiClient.get = vi.fn().mockResolvedValue({ data: entries })
    mockApiClient.delete = vi.fn().mockResolvedValue({})

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderNotebookPage()

    await waitFor(() => {
      expect(screen.getByText('Note à supprimer')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /supprimer/i }))

    await waitFor(() => {
      expect(mockApiClient.delete).toHaveBeenCalledWith('/pedagogical-logs/notebook/note-del')
    })

    await waitFor(() => {
      expect(screen.queryByText('Note à supprimer')).toBeNull()
    })
  })

  it("n'affiche aucun mécanisme d'édition (immuable une fois écrite)", async () => {
    const entries = [
      {
        id: 'note-1',
        ownerId: 'student-42',
        content: 'Une pensée déjà notée',
        createdAt: new Date().toISOString(),
      },
    ]

    mockApiClient.get = vi.fn().mockResolvedValue({ data: entries })

    renderNotebookPage()

    await waitFor(() => {
      expect(screen.getByText('Une pensée déjà notée')).toBeDefined()
    })

    expect(screen.queryByRole('button', { name: /modifier/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /enregistrer/i })).toBeNull()
    expect(mockApiClient.patch).not.toHaveBeenCalled()
  })

  it('recherche par mot et transmet le paramètre `q`', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderNotebookPage()

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith('/pedagogical-logs/notebook', {
        params: undefined,
      })
    })

    const wordInput = screen.getByLabelText(/rechercher un mot/i)
    await userEvent.type(wordInput, 'intégrales')
    await userEvent.click(screen.getByRole('button', { name: /^rechercher$/i }))

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith('/pedagogical-logs/notebook', {
        params: { q: 'intégrales', date: undefined },
      })
    })
  })

  it('recherche par date et transmet le paramètre `date`', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderNotebookPage()

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith('/pedagogical-logs/notebook', {
        params: undefined,
      })
    })

    const dateInput = screen.getByLabelText(/rechercher une date/i)
    await userEvent.type(dateInput, '2026-08-20')
    await userEvent.click(screen.getByRole('button', { name: /^rechercher$/i }))

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith('/pedagogical-logs/notebook', {
        params: { q: undefined, date: '2026-08-20' },
      })
    })
  })
})
