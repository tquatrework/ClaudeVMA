/**
 * Tests — Carnet personnel (NotebookPage)
 *
 * Couvre :
 * 1. Parent reçoit un message d'accès refusé sur le carnet personnel
 * 2. NotebookPage — CRUD complet pour l'élève
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

const PARENT_USER = {
  id: 'parent-5',
  email: 'parent@test.com',
  role: 'parent_financeur' as const,
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

// ─── Helper renderers ─────────────────────────────────────────────────────────

function renderNotebookPage(studentId = 'student-42') {
  return render(
    <MemoryRouter initialEntries={[`/notebook/${studentId}`]}>
      <Routes>
        <Route path="/notebook/:studentId" element={<NotebookPage />} />
        <Route path="/forbidden" element={<div>Accès interdit</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

// ─── Parent — accès refusé au carnet personnel ────────────────────────────

describe('NotebookPage — parent accès refusé', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(buildAuthMock(PARENT_USER))
  })

  it('redirige le parent vers /forbidden', async () => {
    renderNotebookPage('student-42')

    await waitFor(() => {
      expect(screen.getByText('Accès interdit')).toBeDefined()
    })
  })
})

// ─── NotebookPage — CRUD pour l'élève ─────────────────────────────────────

describe('NotebookPage — CRUD élève propriétaire', () => {
  it('charge et affiche les notes du carnet', async () => {
    const entries = [
      {
        id: 'note-1',
        studentId: 'student-42',
        content: 'Mon objectif : 18/20 en maths',
        createdAt: new Date().toISOString(),
      },
    ]

    mockApiClient.get = vi.fn().mockResolvedValue({ data: entries })

    renderNotebookPage('student-42')

    await waitFor(() => {
      expect(screen.getByText('Mon objectif : 18/20 en maths')).toBeDefined()
    })

    expect(mockApiClient.get).toHaveBeenCalledWith('/students/student-42/notebook')
  })

  it('permet à l\'élève d\'ajouter une note', async () => {
    const newEntry = {
      id: 'note-new',
      studentId: 'student-42',
      content: 'Revoir les intégrales',
      createdAt: new Date().toISOString(),
    }

    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })
    mockApiClient.post = vi.fn().mockResolvedValue({ data: newEntry })

    renderNotebookPage('student-42')

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/écrire une note personnelle/i)).toBeDefined()
    })

    const textarea = screen.getByPlaceholderText(/écrire une note personnelle/i)
    await userEvent.type(textarea, 'Revoir les intégrales')

    await userEvent.click(screen.getByRole('button', { name: /ajouter une note/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/students/student-42/notebook',
        { content: 'Revoir les intégrales' },
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Revoir les intégrales')).toBeDefined()
    })
  })

  it('permet à l\'élève de supprimer une note', async () => {
    const entries = [
      {
        id: 'note-del',
        studentId: 'student-42',
        content: 'Note à supprimer',
        createdAt: new Date().toISOString(),
      },
    ]

    mockApiClient.get = vi.fn().mockResolvedValue({ data: entries })
    mockApiClient.delete = vi.fn().mockResolvedValue({})

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderNotebookPage('student-42')

    await waitFor(() => {
      expect(screen.getByText('Note à supprimer')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /supprimer/i }))

    await waitFor(() => {
      expect(mockApiClient.delete).toHaveBeenCalledWith('/students/student-42/notebook/note-del')
    })

    await waitFor(() => {
      expect(screen.queryByText('Note à supprimer')).toBeNull()
    })
  })
})
