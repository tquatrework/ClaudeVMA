/**
 * Tests pour PedagogicalArchivePage (Phase 11)
 *
 * Couvre :
 * - L'élève voit la timeline chronologique de ses archives
 * - Le parent financeur ne voit pas les entrées de carnet personnel
 * - Un résumé de cours reste visible après expiration de l'enregistrement
 * - Un élément d'archive ouvre le lien source ou lance un téléchargement
 * - Gestion des erreurs 403 et 404
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PedagogicalArchivePage from '../../src/pages/PedagogicalArchivePage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/archiveDocument')
// Mocker ProfileStatisticsPanel pour éviter les appels apiClient non mockés dans ce contexte
vi.mock('../../src/pages/ProfileStatisticsPanel', () => ({
  default: () => <div data-testid="mock-statistics-panel">Statistiques (mock)</div>,
}))

import { useAuth } from '../../src/hooks/useAuth'
import {
  fetchPedagogicalArchives,
  fetchArchiveTimeline,
  downloadArchiveDocument,
} from '../../src/api/archiveDocument'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchPedagogicalArchives = vi.mocked(fetchPedagogicalArchives)
const mockFetchArchiveTimeline = vi.mocked(fetchArchiveTimeline)
const mockDownloadArchiveDocument = vi.mocked(downloadArchiveDocument)

// ─── Fixtures utilisateurs ────────────────────────────────────────────────────

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

const PARENT_USER = {
  id: 'parent-1',
  email: 'parent@test.com',
  role: 'parent_financeur' as const,
  validationStatus: 'active' as const,
}

const RP_USER = {
  id: 'rp-1',
  email: 'rp@test.com',
  role: 'responsable_pedagogique' as const,
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
      (
        [
          'responsable_pedagogique',
          'animateur_pedagogique',
          'technicien_informatique',
          'administrateur_financier',
        ] as string[]
      ).includes(userObj.role),
    ),
  }
}

// ─── Fixtures archives ────────────────────────────────────────────────────────

const COURSE_SUMMARY_ITEM = {
  id: 'archive-1',
  studentId: 'student-1',
  itemType: 'course_summary' as const,
  title: 'Résumé séance — Algèbre linéaire',
  description: 'Introduction aux matrices carrées.',
  sourceUrl: 'https://example.com/summary/1',
  downloadUrl: undefined,
  occurredAt: '2026-03-15T10:00:00.000Z',
  createdAt: '2026-03-15T11:00:00.000Z',
  isAccessibleToFinanceOwner: true,
}

const PEDAGOGICAL_LOG_ITEM = {
  id: 'archive-2',
  studentId: 'student-1',
  itemType: 'pedagogical_log' as const,
  title: 'Cahier — Exercice 12',
  description: 'Travail sur les dérivées.',
  sourceUrl: undefined,
  downloadUrl: 'https://example.com/download/2',
  occurredAt: '2026-03-16T14:00:00.000Z',
  createdAt: '2026-03-16T15:00:00.000Z',
  isAccessibleToFinanceOwner: true,
}

const NOTEBOOK_ENTRY_ITEM = {
  id: 'archive-3',
  studentId: 'student-1',
  itemType: 'notebook_entry' as const,
  title: 'Note personnelle',
  description: 'Idée de révision.',
  sourceUrl: undefined,
  downloadUrl: undefined,
  occurredAt: '2026-03-17T09:00:00.000Z',
  createdAt: '2026-03-17T09:05:00.000Z',
  isAccessibleToFinanceOwner: false,
}

const TIMELINE_ENTRIES = [
  {
    id: 'archive-1',
    studentId: 'student-1',
    itemType: 'course_summary' as const,
    title: 'Résumé séance — Algèbre linéaire',
    description: 'Introduction aux matrices carrées.',
    occurredAt: '2026-03-15T10:00:00.000Z',
    sourceUrl: 'https://example.com/summary/1',
    isAccessibleToFinanceOwner: true,
  },
  {
    id: 'archive-2',
    studentId: 'student-1',
    itemType: 'pedagogical_log' as const,
    title: 'Cahier — Exercice 12',
    description: 'Travail sur les dérivées.',
    occurredAt: '2026-03-16T14:00:00.000Z',
    sourceUrl: undefined,
    isAccessibleToFinanceOwner: true,
  },
  {
    id: 'archive-3',
    studentId: 'student-1',
    itemType: 'notebook_entry' as const,
    title: 'Note personnelle',
    description: 'Idée de révision.',
    occurredAt: '2026-03-17T09:00:00.000Z',
    sourceUrl: undefined,
    isAccessibleToFinanceOwner: false,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderArchivePage(studentId = 'student-1') {
  return render(
    <MemoryRouter initialEntries={[`/archives/${studentId}`]}>
      <Routes>
        <Route path="/archives/:studentId" element={<PedagogicalArchivePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchPedagogicalArchives.mockResolvedValue([])
  mockFetchArchiveTimeline.mockResolvedValue([])
  mockDownloadArchiveDocument.mockResolvedValue(new Blob(['data'], { type: 'application/pdf' }))
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PedagogicalArchivePage', () => {
  it('affiche un état de chargement initialement', () => {
    mockFetchPedagogicalArchives.mockReturnValue(new Promise(() => {}))
    mockFetchArchiveTimeline.mockReturnValue(new Promise(() => {}))

    renderArchivePage()

    expect(screen.getByText('Chargement des archives…')).toBeDefined()
  })

  it('affiche "Aucune archive disponible" quand la timeline est vide', async () => {
    mockFetchPedagogicalArchives.mockResolvedValue([])
    mockFetchArchiveTimeline.mockResolvedValue([])

    renderArchivePage()

    // L'onglet par défaut est "Statistiques" — naviguer vers "Archives" pour voir la timeline
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Archives' })).toBeDefined()
    })
    await userEvent.click(screen.getByRole('button', { name: 'Archives' }))

    await waitFor(() => {
      expect(screen.getByText(/Aucune archive disponible/)).toBeDefined()
    })
  })

  it("l'élève voit la timeline chronologique avec les archives", async () => {
    mockFetchPedagogicalArchives.mockResolvedValue([
      COURSE_SUMMARY_ITEM,
      PEDAGOGICAL_LOG_ITEM,
      NOTEBOOK_ENTRY_ITEM,
    ])
    mockFetchArchiveTimeline.mockResolvedValue(TIMELINE_ENTRIES)

    renderArchivePage()

    // Naviguer vers l'onglet "Archives" (l'onglet par défaut est "Statistiques")
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Archives' })).toBeDefined()
    })
    await userEvent.click(screen.getByRole('button', { name: 'Archives' }))

    await waitFor(() => {
      expect(screen.getByText('Résumé séance — Algèbre linéaire')).toBeDefined()
      expect(screen.getByText('Cahier — Exercice 12')).toBeDefined()
      expect(screen.getByText('Note personnelle')).toBeDefined()
    })
  })

  it('sélectionner un élément de la timeline affiche son détail', async () => {
    mockFetchPedagogicalArchives.mockResolvedValue([COURSE_SUMMARY_ITEM])
    mockFetchArchiveTimeline.mockResolvedValue([TIMELINE_ENTRIES[0]])

    renderArchivePage()

    // Naviguer vers l'onglet "Archives"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Archives' })).toBeDefined()
    })
    await userEvent.click(screen.getByRole('button', { name: 'Archives' }))

    await waitFor(() => {
      expect(screen.getByText('Résumé séance — Algèbre linéaire')).toBeDefined()
    })

    // Clique sur l'élément de timeline pour afficher le détail
    await userEvent.click(screen.getByText('Résumé séance — Algèbre linéaire'))

    await waitFor(() => {
      // Le panneau de détail doit apparaître avec le lien source
      expect(screen.getByText('Ouvrir la source')).toBeDefined()
    })
  })

  it('le parent financeur voit le message de restriction pour le carnet personnel', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(PARENT_USER))
    mockFetchPedagogicalArchives.mockResolvedValue([NOTEBOOK_ENTRY_ITEM])
    mockFetchArchiveTimeline.mockResolvedValue([TIMELINE_ENTRIES[2]])

    renderArchivePage()

    // Naviguer vers l'onglet "Archives"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Archives' })).toBeDefined()
    })
    await userEvent.click(screen.getByRole('button', { name: 'Archives' }))

    await waitFor(() => {
      expect(screen.getByText('Note personnelle')).toBeDefined()
    })

    // Clique sur l'entrée de carnet
    await userEvent.click(screen.getByText('Note personnelle'))

    await waitFor(() => {
      expect(
        screen.getByText(/Ce document est réservé à l'élève/),
      ).toBeDefined()
    })
  })

  it("le parent financeur ne voit pas le bouton d'accès au carnet personnel", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(PARENT_USER))
    mockFetchPedagogicalArchives.mockResolvedValue([NOTEBOOK_ENTRY_ITEM])
    mockFetchArchiveTimeline.mockResolvedValue([TIMELINE_ENTRIES[2]])

    renderArchivePage()

    // Naviguer vers l'onglet "Archives"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Archives' })).toBeDefined()
    })
    await userEvent.click(screen.getByRole('button', { name: 'Archives' }))

    await waitFor(() => {
      screen.getByText('Note personnelle')
    })

    await userEvent.click(screen.getByText('Note personnelle'))

    await waitFor(() => {
      expect(screen.queryByText('Ouvrir la source')).toBeNull()
      expect(screen.queryByText('Télécharger')).toBeNull()
    })
  })

  it("l'onglet 'Résumés de cours' affiche un résumé de cours permanent", async () => {
    mockFetchPedagogicalArchives.mockResolvedValue([COURSE_SUMMARY_ITEM])
    mockFetchArchiveTimeline.mockResolvedValue([TIMELINE_ENTRIES[0]])

    renderArchivePage()

    await waitFor(() => {
      expect(screen.getByText('Résumés de cours')).toBeDefined()
    })

    await userEvent.click(screen.getByText('Résumés de cours'))

    await waitFor(() => {
      expect(screen.getByText('Conservation permanente')).toBeDefined()
      expect(screen.getByText('Résumé séance — Algèbre linéaire')).toBeDefined()
    })
  })

  it("l'onglet 'Résumés de cours' affiche un message vide si aucun résumé", async () => {
    // Uniquement un cahier de texte — pas de résumé
    mockFetchPedagogicalArchives.mockResolvedValue([PEDAGOGICAL_LOG_ITEM])
    mockFetchArchiveTimeline.mockResolvedValue([TIMELINE_ENTRIES[1]])

    renderArchivePage()

    await waitFor(() => {
      screen.getByText('Résumés de cours')
    })

    await userEvent.click(screen.getByText('Résumés de cours'))

    await waitFor(() => {
      expect(screen.getByText('Aucun résumé de cours archivé.')).toBeDefined()
    })
  })

  it("le résumé de cours affiche le lien vers la séance source", async () => {
    mockFetchPedagogicalArchives.mockResolvedValue([COURSE_SUMMARY_ITEM])
    mockFetchArchiveTimeline.mockResolvedValue([TIMELINE_ENTRIES[0]])

    renderArchivePage()

    await waitFor(() => {
      screen.getByText('Résumés de cours')
    })

    await userEvent.click(screen.getByText('Résumés de cours'))

    await waitFor(() => {
      const sourceLink = screen.getByText('Voir le détail de la séance')
      expect(sourceLink).toBeDefined()
    })
  })

  it('affiche une erreur 403 lors du chargement des archives', async () => {
    mockFetchPedagogicalArchives.mockRejectedValue({ response: { status: 403 } })
    mockFetchArchiveTimeline.mockRejectedValue({ response: { status: 403 } })

    renderArchivePage()

    await waitFor(() => {
      expect(screen.getByText(/Accès refusé/)).toBeDefined()
    })
  })

  it('affiche une erreur 404 si l\'élève est introuvable', async () => {
    mockFetchPedagogicalArchives.mockRejectedValue({ response: { status: 404 } })
    mockFetchArchiveTimeline.mockRejectedValue({ response: { status: 404 } })

    renderArchivePage()

    await waitFor(() => {
      expect(screen.getByText('Élève introuvable.')).toBeDefined()
    })
  })

  it('le RP voit les archives complètes y compris le carnet personnel', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchPedagogicalArchives.mockResolvedValue([
      COURSE_SUMMARY_ITEM,
      NOTEBOOK_ENTRY_ITEM,
    ])
    mockFetchArchiveTimeline.mockResolvedValue([
      TIMELINE_ENTRIES[0],
      TIMELINE_ENTRIES[2],
    ])

    renderArchivePage()

    // Naviguer vers l'onglet "Archives"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Archives' })).toBeDefined()
    })
    await userEvent.click(screen.getByRole('button', { name: 'Archives' }))

    await waitFor(() => {
      expect(screen.getByText('Résumé séance — Algèbre linéaire')).toBeDefined()
      expect(screen.getByText('Note personnelle')).toBeDefined()
    })

    // Clique sur l'entrée de carnet — le RP peut y accéder
    await userEvent.click(screen.getByText('Note personnelle'))

    await waitFor(() => {
      // Pas de message de restriction pour le RP
      expect(screen.queryByText(/Ce document est réservé à l'élève/)).toBeNull()
    })
  })

  it("l'élément avec un lien de téléchargement propose le bouton Télécharger", async () => {
    mockFetchPedagogicalArchives.mockResolvedValue([PEDAGOGICAL_LOG_ITEM])
    mockFetchArchiveTimeline.mockResolvedValue([TIMELINE_ENTRIES[1]])

    renderArchivePage()

    // Naviguer vers l'onglet "Archives"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Archives' })).toBeDefined()
    })
    await userEvent.click(screen.getByRole('button', { name: 'Archives' }))

    await waitFor(() => {
      screen.getByText('Cahier — Exercice 12')
    })

    await userEvent.click(screen.getByText('Cahier — Exercice 12'))

    await waitFor(() => {
      expect(screen.getByText('Télécharger')).toBeDefined()
    })
  })
})
