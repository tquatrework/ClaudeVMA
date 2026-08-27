/**
 * Tests — Phase 6 : Cahier de texte, mémo élève et carnet personnel
 *
 * Couvre :
 * 1. Élève peut lister et créer des chapitres de mémo (GET /memos/chapters, POST /memos/chapters)
 * 2. Élève peut créer un mémo via POST /memos (avec ou sans chapitre)
 * 3. Dropdown chapitre peuplé par GET /memos/chapters
 * 4. Affichage groupé : mémos sans chapitre dans "Général", autres dans leur chapitre
 * 5. Formateur voit le mémo en readonly (pas de bouton d'ajout, message informatif)
 * 6. Parent reçoit un message d'accès refusé sur le carnet personnel
 * 7. Le drawer mémo s'ouvre depuis la page vidéo
 * 8. NotebookPage — CRUD complet pour l'élève
 * 9. Alignement mémo/cahier de texte post-correction backend
 *
 * PedagogicalLogPage (cahier de texte lui-même) a sa propre suite dédiée depuis
 * la refonte du 2026-08-20 : test/pages/PedagogicalLogPage.test.tsx.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'

import MemosPage from '../../src/pages/MemosPage'
import NotebookPage from '../../src/pages/NotebookPage'
import VideoPage from '../../src/pages/VideoPage'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)

// ─── User fixtures ────────────────────────────────────────────────────────────

const STUDENT_USER = {
  id: 'student-42',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

const TEACHER_USER = {
  id: 'teacher-10',
  email: 'prof@test.com',
  role: 'formateur' as const,
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

function renderMemosPage() {
  return render(
    <MemoryRouter>
      <MemosPage />
    </MemoryRouter>,
  )
}

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

function renderVideoPage(roomId = 'room-1') {
  return render(
    <MemoryRouter initialEntries={[`/video/${roomId}`]}>
      <Routes>
        <Route path="/video/:roomId" element={<VideoPage />} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/**
 * Configure les mocks API pour StudentMemoPanel.
 * Le composant appelle GET /memos ET GET /memos/chapters en parallèle.
 */
function setupMemoPageMocks(
  memos: object[] = [],
  chapters: object[] = [],
) {
  mockApiClient.get = vi.fn().mockImplementation((url: string) => {
    if (url === '/memos/chapters') return Promise.resolve({ data: chapters })
    if (url === '/memos') return Promise.resolve({ data: memos })
    return Promise.resolve({ data: [] })
  })
}

// ─── 1. Élève peut lister et créer des chapitres de mémo ─────────────────────

describe('MemosPage — élève liste les mémos groupés par chapitre', () => {
  it('affiche la section Général pour les mémos sans chapitre', async () => {
    const memos = [
      {
        id: 'memo-1',
        title: 'Formule cosinus',
        content: 'cos²θ + sin²θ = 1',
        chapterId: null,
        createdAt: new Date().toISOString(),
      },
    ]

    setupMemoPageMocks(memos, [])

    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText('Général')).toBeDefined()
      expect(screen.getByText('Formule cosinus')).toBeDefined()
    })
  })

  it('affiche les mémos dans leur chapitre respectif', async () => {
    const chapters = [
      { id: 'ch-1', title: 'Trigonométrie', createdAt: new Date().toISOString() },
    ]
    const memos = [
      {
        id: 'memo-1',
        title: 'Formule cosinus',
        content: 'cos²θ + sin²θ = 1',
        chapterId: 'ch-1',
        createdAt: new Date().toISOString(),
      },
    ]

    setupMemoPageMocks(memos, chapters)

    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText('Trigonométrie')).toBeDefined()
      expect(screen.getByText('Formule cosinus')).toBeDefined()
    })
  })

  it('appelle GET /memos et GET /memos/chapters au chargement', async () => {
    setupMemoPageMocks([], [])

    renderMemosPage()

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith('/memos')
      expect(mockApiClient.get).toHaveBeenCalledWith('/memos/chapters')
    })
  })

  it('affiche un message quand le mémo est vide', async () => {
    setupMemoPageMocks([], [])

    renderMemosPage()

    await waitFor(() => {
      expect(screen.getAllByText(/aucune note/i).length).toBeGreaterThan(0)
    })
  })

  it('permet à l\'élève de créer un chapitre via le bouton + Chapitre', async () => {
    const newChapter = {
      id: 'ch-new',
      title: 'Probabilités',
      createdAt: new Date().toISOString(),
    }

    setupMemoPageMocks([], [])
    mockApiClient.post = vi.fn().mockResolvedValue({ data: newChapter })

    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText('+ Chapitre')).toBeDefined()
    })

    await userEvent.click(screen.getByText('+ Chapitre'))

    const titleInput = screen.getByPlaceholderText(/titre du chapitre/i)
    await userEvent.type(titleInput, 'Probabilités')

    await userEvent.click(screen.getByRole('button', { name: /créer$/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/memos/chapters', { title: 'Probabilités' })
    })

    await waitFor(() => {
      expect(screen.getByText('Probabilités')).toBeDefined()
    })
  })
})

// ─── 2. Élève crée un mémo via POST /memos ────────────────────────────────────

describe('MemosPage — élève crée un mémo', () => {
  it('crée un mémo sans chapitre — appel POST /memos avec chapterId null', async () => {
    const newMemo = {
      id: 'memo-new',
      title: 'Identité remarquable',
      content: '(a+b)² = a² + 2ab + b²',
      chapterId: null,
      createdAt: new Date().toISOString(),
    }

    setupMemoPageMocks([], [])
    mockApiClient.post = vi.fn().mockResolvedValue({ data: newMemo })

    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText('+ Mémo')).toBeDefined()
    })

    await userEvent.click(screen.getByText('+ Mémo'))

    const titleInput = screen.getByPlaceholderText(/titre du mémo/i)
    await userEvent.type(titleInput, 'Identité remarquable')

    const contentTextarea = screen.getByPlaceholderText(/contenu du mémo/i)
    await userEvent.type(contentTextarea, '(a+b)² = a² + 2ab + b²')

    // Le sélecteur est sur "Général" par défaut — on ne change pas le chapitre
    await userEvent.click(screen.getByRole('button', { name: /ajouter$/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/memos',
        expect.objectContaining({ title: 'Identité remarquable', content: '(a+b)² = a² + 2ab + b²', chapterId: null }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Identité remarquable')).toBeDefined()
    })
  })

  it('crée un mémo avec chapitre — appel POST /memos avec chapterId renseigné', async () => {
    const chapters = [
      { id: 'ch-1', title: 'Algèbre', createdAt: new Date().toISOString() },
    ]
    const newMemo = {
      id: 'memo-new',
      title: 'Déterminant',
      content: 'det(A) = ...',
      chapterId: 'ch-1',
      createdAt: new Date().toISOString(),
    }

    setupMemoPageMocks([], chapters)
    mockApiClient.post = vi.fn().mockResolvedValue({ data: newMemo })

    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText('+ Mémo')).toBeDefined()
    })

    await userEvent.click(screen.getByText('+ Mémo'))

    const titleInput = screen.getByPlaceholderText(/titre du mémo/i)
    await userEvent.type(titleInput, 'Déterminant')

    const contentTextarea = screen.getByPlaceholderText(/contenu du mémo/i)
    await userEvent.type(contentTextarea, 'det(A) = ...')

    // Sélectionner le chapitre "Algèbre"
    const chapterSelect = screen.getByLabelText(/chapitre/i)
    await userEvent.selectOptions(chapterSelect, 'ch-1')

    await userEvent.click(screen.getByRole('button', { name: /ajouter$/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/memos',
        expect.objectContaining({ title: 'Déterminant', content: 'det(A) = ...', chapterId: 'ch-1' }),
      )
    })
  })

  it('dropdown chapitre peuplé par GET /memos/chapters', async () => {
    const chapters = [
      { id: 'ch-1', title: 'Trigonométrie', createdAt: new Date().toISOString() },
      { id: 'ch-2', title: 'Algèbre', createdAt: new Date().toISOString() },
    ]

    setupMemoPageMocks([], chapters)

    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText('+ Mémo')).toBeDefined()
    })

    await userEvent.click(screen.getByText('+ Mémo'))

    await waitFor(() => {
      // Option "Général" toujours présente
      expect(screen.getByRole('option', { name: 'Général' })).toBeDefined()
      // Options des chapitres
      expect(screen.getByRole('option', { name: 'Trigonométrie' })).toBeDefined()
      expect(screen.getByRole('option', { name: 'Algèbre' })).toBeDefined()
    })

    // Vérifier que GET /memos/chapters a bien été appelé
    expect(mockApiClient.get).toHaveBeenCalledWith('/memos/chapters')
  })
})

// ─── 3. Affichage groupé ─────────────────────────────────────────────────────

describe('MemosPage — affichage groupé par chapitre', () => {
  it('mémos sans chapitre apparaissent dans la section Général', async () => {
    const memos = [
      {
        id: 'memo-1',
        title: 'Note générale',
        content: 'Contenu général',
        chapterId: null,
        createdAt: new Date().toISOString(),
      },
    ]

    setupMemoPageMocks(memos, [])

    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText('Général')).toBeDefined()
      expect(screen.getByText('Note générale')).toBeDefined()
    })
  })

  it('mémos avec chapitre apparaissent sous le titre du chapitre', async () => {
    const chapters = [
      { id: 'ch-1', title: 'Géométrie', createdAt: new Date().toISOString() },
    ]
    const memos = [
      {
        id: 'memo-1',
        title: 'Théorème de Pythagore',
        content: 'a² + b² = c²',
        chapterId: 'ch-1',
        createdAt: new Date().toISOString(),
      },
    ]

    setupMemoPageMocks(memos, chapters)

    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText('Géométrie')).toBeDefined()
      expect(screen.getByText('Théorème de Pythagore')).toBeDefined()
    })
  })

  it('mémos des deux types affichés correctement dans leur section respective', async () => {
    const chapters = [
      { id: 'ch-trig', title: 'Trigonométrie', createdAt: new Date().toISOString() },
    ]
    const memos = [
      {
        id: 'memo-gen',
        title: 'Note générale',
        content: 'Contenu sans chapitre',
        chapterId: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'memo-trig',
        title: 'Cosinus',
        content: 'cos(0) = 1',
        chapterId: 'ch-trig',
        createdAt: new Date().toISOString(),
      },
    ]

    setupMemoPageMocks(memos, chapters)

    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText('Général')).toBeDefined()
      expect(screen.getByText('Note générale')).toBeDefined()
      expect(screen.getByText('Trigonométrie')).toBeDefined()
      expect(screen.getByText('Cosinus')).toBeDefined()
    })
  })
})

// ─── 4. Formateur voit le mémo en readonly ────────────────────────────────────

describe('MemosPage — formateur voit en readonly', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
  })

  it('n\'affiche pas le bouton + Chapitre pour un formateur', async () => {
    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText('Mémo')).toBeDefined()
    })

    expect(screen.queryByText('+ Chapitre')).toBeNull()
  })

  it('n\'affiche pas le bouton + Mémo pour un formateur', async () => {
    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText('Mémo')).toBeDefined()
    })

    expect(screen.queryByText('+ Mémo')).toBeNull()
  })

  it('affiche un message informatif pour le formateur (pas de liste globale)', async () => {
    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText(/réservé à l'élève/i)).toBeDefined()
    })
  })

  it('ne call pas GET /memos pour un formateur', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderMemosPage()

    // Wait for the page to fully render — the informational message should appear
    await waitFor(() => {
      expect(screen.getByText(/réservé à l'élève/i)).toBeDefined()
    })

    expect(mockApiClient.get).not.toHaveBeenCalledWith('/memos')
    expect(mockApiClient.get).not.toHaveBeenCalledWith('/memos/chapters')
  })
})

// ─── 5. Parent — accès refusé au carnet personnel ────────────────────────────

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

// ─── 7. Drawer mémo s'ouvre depuis la page vidéo ─────────────────────────────

describe('VideoPage — le drawer mémo s\'ouvre', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
  })

  /**
   * Helper qui configure les mocks API pour la VideoPage.
   * La page charge :
   *   - /video/rooms/:id           → RoomInfo
   *   - /video/rooms/:id/recordings → Recording[] (RecordingListPanel)
   *   - /memos                     → Memo[] (InVideoMemoDrawer lorsqu'il est ouvert)
   *   - /memos/chapters            → MemoChapter[] (InVideoMemoDrawer lorsqu'il est ouvert)
   */
  function setupVideoPageMocks(roomInfo: { id: string; status: string; participants: string[] }) {
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/recordings')) return Promise.resolve({ data: [] })
      if (url === '/memos') return Promise.resolve({ data: [] })
      if (url === '/memos/chapters') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: roomInfo })
    })
  }

  it('affiche le bouton "Mémo" dans la page vidéo pour un élève', async () => {
    const roomInfo = { id: 'room-1', status: 'active', participants: [] }
    setupVideoPageMocks(roomInfo)

    renderVideoPage('room-1')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ouvrir le mémo/i })).toBeDefined()
    })
  })

  it('ouvre le drawer mémo en cliquant sur le bouton', async () => {
    const roomInfo = { id: 'room-1', status: 'active', participants: [] }
    setupVideoPageMocks(roomInfo)

    renderVideoPage('room-1')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ouvrir le mémo/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /ouvrir le mémo/i }))

    await waitFor(() => {
      expect(screen.getByRole('complementary', { name: /mémo élève/i })).toBeDefined()
    })
  })

  it('ferme le drawer mémo en cliquant sur le bouton de fermeture', async () => {
    const roomInfo = { id: 'room-1', status: 'active', participants: [] }
    setupVideoPageMocks(roomInfo)

    renderVideoPage('room-1')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ouvrir le mémo/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /ouvrir le mémo/i }))

    await waitFor(() => {
      expect(screen.getByRole('complementary', { name: /mémo élève/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /fermer le mémo/i }))

    await waitFor(() => {
      expect(screen.queryByRole('complementary', { name: /mémo élève/i })).toBeNull()
    })
  })

  it('affiche le bouton mémo pour un formateur aussi', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))

    const roomInfo = { id: 'room-1', status: 'active', participants: [] }
    setupVideoPageMocks(roomInfo)

    renderVideoPage('room-1')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ouvrir le mémo/i })).toBeDefined()
    })
  })
})

// ─── 8. NotebookPage — CRUD pour l'élève ─────────────────────────────────────

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

// ─── 9. MemoSearch — recherche dans le mémo ──────────────────────────────────

describe('MemosPage — recherche dans le mémo', () => {
  it('affiche les résultats de recherche quand l\'élève cherche un terme', async () => {
    const searchResults = [
      {
        id: 'memo-found',
        title: 'Cosinus',
        content: 'cos(π) = -1',
        chapterId: null,
        createdAt: new Date().toISOString(),
      },
    ]

    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/memos/search') return Promise.resolve({ data: searchResults })
      return Promise.resolve({ data: [] })
    })

    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText('Rechercher')).toBeDefined()
    })

    await userEvent.click(screen.getByText('Rechercher'))

    const searchInput = screen.getByPlaceholderText(/rechercher dans mes notes/i)
    await userEvent.type(searchInput, 'cos')

    const searchButtons = screen.getAllByRole('button', { name: /chercher/i })
    const submitButton = searchButtons.find((btn) => btn.getAttribute('type') === 'submit')!
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/memos/search',
        expect.objectContaining({ params: { q: 'cos' } }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText('cos(π) = -1')).toBeDefined()
    })
  })
})

// ─── 10. Tests d'intégration API mémo ────────────────────────────────────────

describe('Alignement mémo — élève accède sans 403', () => {
  it('élève — GET /memos et GET /memos/chapters sont appelés et la page charge sans erreur', async () => {
    setupMemoPageMocks([], [])

    renderMemosPage()

    await waitFor(() => {
      // Le titre <h1> de la page doit exister (getAllByText car le rail contient aussi "Mémo")
      const memoHeadings = screen.getAllByText('Mémo')
      expect(memoHeadings.length).toBeGreaterThanOrEqual(1)
      expect(screen.queryByText(/accès refusé/i)).toBeNull()
    })

    expect(mockApiClient.get).toHaveBeenCalledWith('/memos')
    expect(mockApiClient.get).toHaveBeenCalledWith('/memos/chapters')
  })

  it('élève — peut créer un mémo (boutons + Mémo et + Chapitre visibles)', async () => {
    setupMemoPageMocks([], [])

    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText('+ Mémo')).toBeDefined()
      expect(screen.getByText('+ Chapitre')).toBeDefined()
    })
  })

  it('élève — peut modifier un mémo via PUT /memos/:id', async () => {
    const { updateMemo } = await import('../../src/api/pedagogicalLogMemos')
    mockApiClient.put = vi.fn().mockResolvedValue({ data: { id: 'memo-1', title: 'Modifié', content: 'nouveau contenu', chapterId: null } })

    await updateMemo('memo-1', { content: 'nouveau contenu' })

    expect(mockApiClient.put).toHaveBeenCalledWith('/memos/memo-1', { content: 'nouveau contenu' })
  })

  it('élève — peut supprimer un mémo via DELETE /memos/:id', async () => {
    const { deleteMemo } = await import('../../src/api/pedagogicalLogMemos')
    mockApiClient.delete = vi.fn().mockResolvedValue({})

    await deleteMemo('memo-1')

    expect(mockApiClient.delete).toHaveBeenCalledWith('/memos/memo-1')
  })

  it('élève — createMemo appelle POST /memos avec le bon payload', async () => {
    const { createMemo } = await import('../../src/api/pedagogicalLogMemos')
    mockApiClient.post = vi.fn().mockResolvedValue({
      data: { id: 'memo-new', title: 'Test', content: 'Contenu', chapterId: null },
    })

    await createMemo({ title: 'Test', content: 'Contenu', chapterId: null })

    expect(mockApiClient.post).toHaveBeenCalledWith('/memos', {
      title: 'Test',
      content: 'Contenu',
      chapterId: null,
    })
  })

  it('élève — createMemo avec chapitre appelle POST /memos avec chapterId renseigné', async () => {
    const { createMemo } = await import('../../src/api/pedagogicalLogMemos')
    mockApiClient.post = vi.fn().mockResolvedValue({
      data: { id: 'memo-new', title: 'Test', content: 'Contenu', chapterId: 'ch-42' },
    })

    await createMemo({ title: 'Test', content: 'Contenu', chapterId: 'ch-42' })

    expect(mockApiClient.post).toHaveBeenCalledWith('/memos', {
      title: 'Test',
      content: 'Contenu',
      chapterId: 'ch-42',
    })
  })
})

describe('Formateur — écran mémo en lecture seule (pas de boutons d\'édition)', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
  })

  it('formateur — ne voit pas le bouton + Chapitre', async () => {
    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText('Mémo')).toBeDefined()
    })

    expect(screen.queryByText('+ Chapitre')).toBeNull()
  })

  it('formateur — ne voit pas le bouton + Mémo', async () => {
    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText('Mémo')).toBeDefined()
    })

    expect(screen.queryByText('+ Mémo')).toBeNull()
  })

  it('formateur — voit le sous-titre "lecture seule"', async () => {
    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText(/lecture seule/i)).toBeDefined()
    })
  })

  it('formateur — voit le message informatif sur l\'accès réservé à l\'élève', async () => {
    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText(/réservé à l'élève/i)).toBeDefined()
    })
  })
})

// PedagogicalLogPage a sa propre suite dédiée : test/pages/PedagogicalLogPage.test.tsx
// (refonte du 2026-08-20 — sélecteur d'élève, formulaire à 3 champs, écriture
// réservée au formateur, GET /students/:studentId/pedagogical-log).
