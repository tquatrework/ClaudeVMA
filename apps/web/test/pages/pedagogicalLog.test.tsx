/**
 * Tests — Phase 6 : Cahier de texte, mémo élève et carnet personnel
 *
 * Couvre :
 * 1. Élève peut lister et créer des chapitres de mémo (GET /memos, POST /memos/chapters)
 * 2. Formateur voit le mémo en readonly (pas de bouton d'ajout, message informatif)
 * 3. Parent reçoit un message d'accès refusé sur le carnet personnel
 * 4. Formateur peut créer une page de cahier de texte (POST /pedagogical-logs)
 * 5. Le drawer mémo s'ouvre depuis la page vidéo
 * 6. PedagogicalLogPage — liste des pages du cahier de texte (GET /pedagogical-logs)
 * 7. SpecialLogPageVisibilityDialog — RP uniquement
 * 8. NotebookPage — CRUD complet pour l'élève
 * 9. Nouveaux tests : alignement mémo/cahier de texte post-correction backend
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
import PedagogicalLogPage from '../../src/pages/PedagogicalLogPage'
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

function renderPedagogicalLogPage() {
  return render(
    <MemoryRouter initialEntries={['/pedagogical-log']}>
      <Routes>
        <Route path="/pedagogical-log" element={<PedagogicalLogPage />} />
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

// ─── 1. Élève peut lister et créer des chapitres de mémo ─────────────────────

describe('MemosPage — élève liste et crée des chapitres', () => {
  it('affiche la liste des chapitres après chargement', async () => {
    const chapters = [
      {
        id: 'ch-1',
        title: 'Trigonométrie',
        items: [],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ch-2',
        title: 'Algèbre linéaire',
        items: [
          { id: 'item-1', chapterId: 'ch-2', itemType: 'text', content: 'Vecteurs', createdAt: new Date().toISOString() },
        ],
        createdAt: new Date().toISOString(),
      },
    ]

    mockApiClient.get = vi.fn().mockResolvedValue({ data: chapters })

    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText('Trigonométrie')).toBeDefined()
      expect(screen.getByText('Algèbre linéaire')).toBeDefined()
    })

    expect(mockApiClient.get).toHaveBeenCalledWith('/memos')
  })

  it('affiche un message quand le mémo est vide', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText(/aucun chapitre/i)).toBeDefined()
    })
  })

  it('permet à l\'élève de créer un chapitre via le bouton + Chapitre', async () => {
    const newChapter = {
      id: 'ch-new',
      title: 'Probabilités',
      items: [],
      createdAt: new Date().toISOString(),
    }

    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })
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

  it('permet à l\'élève d\'ajouter un item texte dans un chapitre', async () => {
    const chapters = [
      { id: 'ch-1', title: 'Trigonométrie', items: [], createdAt: new Date().toISOString() },
    ]
    const newItem = {
      id: 'item-new',
      chapterId: 'ch-1',
      itemType: 'text',
      content: 'sin²θ + cos²θ = 1',
      createdAt: new Date().toISOString(),
    }

    mockApiClient.get = vi.fn().mockResolvedValue({ data: chapters })
    mockApiClient.post = vi.fn().mockResolvedValue({ data: newItem })

    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText('Trigonométrie')).toBeDefined()
    })

    // Expand the chapter
    await userEvent.click(screen.getByText('Trigonométrie'))

    await waitFor(() => {
      expect(screen.getByText('+ Ajouter un item')).toBeDefined()
    })

    await userEvent.click(screen.getByText('+ Ajouter un item'))

    const contentTextarea = screen.getByPlaceholderText(/contenu textuel/i)
    await userEvent.type(contentTextarea, 'sin²θ + cos²θ = 1')

    await userEvent.click(screen.getByRole('button', { name: /ajouter$/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/memos/chapters/ch-1/items',
        expect.objectContaining({ itemType: 'text', content: 'sin²θ + cos²θ = 1' }),
      )
    })
  })
})

// ─── 2. Formateur voit le mémo en readonly ────────────────────────────────────

describe('MemosPage — formateur voit en readonly', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
  })

  it('n\'affiche pas le bouton + Chapitre pour un formateur', async () => {
    renderMemosPage()

    await waitFor(() => {
      // Page must be rendered
      expect(screen.getByText('Mémo')).toBeDefined()
    })

    expect(screen.queryByText('+ Chapitre')).toBeNull()
  })

  it('affiche un message informatif pour le formateur (pas de liste globale)', async () => {
    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText(/consultation individuelle uniquement/i)).toBeDefined()
    })
  })

  it('ne call pas GET /memos pour un formateur', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderMemosPage()

    // Wait for the page to fully render — the informational message should appear
    await waitFor(() => {
      expect(screen.getByText(/consultation individuelle uniquement/i)).toBeDefined()
    })

    // After the page is fully rendered, GET /memos must NOT have been called
    expect(mockApiClient.get).not.toHaveBeenCalledWith('/memos')
  })
})

// ─── 3. Parent — accès refusé au carnet personnel ────────────────────────────

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

// ─── 4. Formateur peut créer une page de cahier de texte ─────────────────────

describe('PedagogicalLogPage — formateur crée une page', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
  })

  it('affiche le formulaire de création pour un formateur', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderPedagogicalLogPage()

    await waitFor(() => {
      expect(screen.getByText('Nouvelle entrée')).toBeDefined()
    })
  })

  it('formateur peut créer une nouvelle entrée de cahier de texte', async () => {
    const newLogPage = {
      id: 'log-1',
      studentId: 'student-42',
      authorId: 'teacher-10',
      authorRole: 'formateur',
      content: 'Cours sur les dérivées partielles',
      visibility: 'eleve_parent_formateur',
      isSpecialPage: false,
      hiddenFromStudent: false,
      createdAt: new Date().toISOString(),
    }

    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })
    mockApiClient.post = vi.fn().mockResolvedValue({ data: newLogPage })

    renderPedagogicalLogPage()

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/décrivez la séance/i)).toBeDefined()
    })

    const textarea = screen.getByPlaceholderText(/décrivez la séance/i)
    await userEvent.type(textarea, 'Cours sur les dérivées partielles')

    await userEvent.click(screen.getByRole('button', { name: /ajouter une entrée/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/pedagogical-logs',
        expect.objectContaining({ content: 'Cours sur les dérivées partielles' }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Cours sur les dérivées partielles')).toBeDefined()
    })
  })

  it('affiche les pages du cahier de texte en appelant GET /pedagogical-logs', async () => {
    const logPages = [
      {
        id: 'log-1',
        studentId: 'student-42',
        authorId: 'teacher-10',
        authorRole: 'formateur',
        content: 'Révision des limites',
        visibility: 'eleve_parent_formateur',
        isSpecialPage: false,
        hiddenFromStudent: false,
        createdAt: new Date().toISOString(),
      },
    ]

    mockApiClient.get = vi.fn().mockResolvedValue({ data: logPages })

    renderPedagogicalLogPage()

    await waitFor(() => {
      expect(screen.getByText('Révision des limites')).toBeDefined()
    })

    expect(mockApiClient.get).toHaveBeenCalledWith('/pedagogical-logs')
  })

  it('n\'affiche pas le bouton "Page spéciale" pour un formateur', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderPedagogicalLogPage()

    await waitFor(() => {
      expect(screen.getByText('Nouvelle entrée')).toBeDefined()
    })

    expect(screen.queryByText(/page spéciale/i)).toBeNull()
  })
})

// ─── RP peut créer une page spéciale ─────────────────────────────────────────

describe('PedagogicalLogPage — RP peut créer une page spéciale', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
  })

  it('affiche le bouton de création de page spéciale pour le RP', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderPedagogicalLogPage()

    await waitFor(() => {
      expect(screen.getByText(/créer une page spéciale/i)).toBeDefined()
    })
  })

  it('ouvre le dialog de création de page spéciale', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderPedagogicalLogPage()

    await waitFor(() => {
      expect(screen.getByText(/créer une page spéciale \(RP\)/i)).toBeDefined()
    })

    await userEvent.click(screen.getByText(/créer une page spéciale \(RP\)/i))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /créer une page spéciale/i })).toBeDefined()
    })
  })
})

// ─── 5. Drawer mémo s'ouvre depuis la page vidéo ─────────────────────────────

describe('VideoPage — le drawer mémo s\'ouvre', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
  })

  /**
   * Helper qui configure les mocks API pour la VideoPage.
   * La page charge :
   *   - /video/rooms/:id         → RoomInfo
   *   - /video/rooms/:id/recordings → Recording[] (RecordingListPanel)
   *   - /memos                   → MemoChapter[] (InVideoMemoDrawer lorsqu'il est ouvert)
   * CourseSummaryView ne fait aucun GET (room status active → formulaire non affiché).
   */
  function setupVideoPageMocks(roomInfo: { id: string; status: string; participants: string[] }) {
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/recordings')) return Promise.resolve({ data: [] })
      if (url === '/memos') return Promise.resolve({ data: [] })
      // Room info (and any other GET)
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

// ─── 6. NotebookPage — CRUD pour l'élève ─────────────────────────────────────

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

    // Mock window.confirm to return true
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

// ─── 7. MemoSearch — recherche dans le mémo ──────────────────────────────────

describe('MemosPage — recherche dans le mémo', () => {
  it('affiche les résultats de recherche quand l\'élève cherche un terme', async () => {
    const searchResults = [
      {
        id: 'item-found',
        chapterId: 'ch-1',
        itemType: 'text',
        content: 'cos(π) = -1',
        createdAt: new Date().toISOString(),
      },
    ]

    mockApiClient.get = vi.fn()
      .mockResolvedValueOnce({ data: [] }) // initial chapters fetch
      .mockResolvedValue({ data: searchResults }) // search

    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText('Rechercher')).toBeDefined()
    })

    await userEvent.click(screen.getByText('Rechercher'))

    const searchInput = screen.getByPlaceholderText(/rechercher dans mes notes/i)
    await userEvent.type(searchInput, 'cos')

    // "Chercher" (submit) vs "Rechercher" (open panel button) — pick the submit button
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

// ─── 8. Nouveaux tests — alignement mémo/cahier de texte ─────────────────────
// Couvre les 5 scénarios obligatoires spécifiés dans la tâche

describe('Alignement mémo — élève accède sans 403', () => {
  it('élève — GET /memos est appelé et la page charge sans erreur', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText('Mémo')).toBeDefined()
      // Aucun message d'erreur 403 ne doit s'afficher
      expect(screen.queryByText(/accès refusé/i)).toBeNull()
    })

    expect(mockApiClient.get).toHaveBeenCalledWith('/memos')
  })

  it('élève — peut créer un chapitre (bouton + Chapitre visible)', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText('+ Chapitre')).toBeDefined()
    })
  })

  it('élève — peut modifier un mémo via PUT /memos/:id', async () => {
    // La fonction updateMemo appelle PUT /memos/:id — test d'intégration API
    // On vérifie que l'API client est correctement exposée
    const { updateMemo } = await import('../../src/api/pedagogicalLog')
    mockApiClient.put = vi.fn().mockResolvedValue({ data: { id: 'memo-1', title: 'Modifié' } })

    await updateMemo('memo-1', 'nouveau contenu')

    expect(mockApiClient.put).toHaveBeenCalledWith('/memos/memo-1', { content: 'nouveau contenu' })
  })

  it('élève — peut supprimer un mémo via DELETE /memos/:id', async () => {
    const { deleteMemo } = await import('../../src/api/pedagogicalLog')
    mockApiClient.delete = vi.fn().mockResolvedValue({})

    await deleteMemo('memo-1')

    expect(mockApiClient.delete).toHaveBeenCalledWith('/memos/memo-1')
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

  it('formateur — voit le sous-titre "lecture seule"', async () => {
    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText(/lecture seule/i)).toBeDefined()
    })
  })

  it('formateur — voit le message informatif sur la consultation individuelle', async () => {
    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText(/consultation individuelle uniquement/i)).toBeDefined()
    })
  })
})

describe('Élève — cahier de texte charge en lecture seule (GET /pedagogical-logs)', () => {
  it('élève — voit le cahier de texte sans formulaire d\'ajout', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderPedagogicalLogPage()

    await waitFor(() => {
      expect(screen.getByText('Cahier de texte')).toBeDefined()
    })

    // L'élève ne peut pas écrire
    expect(screen.queryByText('Nouvelle entrée')).toBeNull()
    // Message lecture seule présent dans le sous-titre
    expect(screen.getByText(/consultation uniquement/i)).toBeDefined()
  })

  it('élève — GET /pedagogical-logs est appelé', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderPedagogicalLogPage()

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith('/pedagogical-logs')
    })
  })
})

describe('Formateur — cahier de texte affiche le bouton "Nouvelle entrée"', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
  })

  it('formateur — voit le formulaire "Nouvelle entrée"', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderPedagogicalLogPage()

    await waitFor(() => {
      expect(screen.getByText('Nouvelle entrée')).toBeDefined()
    })
  })

  it('formateur — peut soumettre une nouvelle entrée via POST /pedagogical-logs', async () => {
    const createdPage = {
      id: 'log-new',
      studentId: 'student-42',
      authorId: 'teacher-10',
      authorRole: 'formateur',
      content: 'Séance du jour : algèbre',
      visibility: 'eleve_parent_formateur',
      isSpecialPage: false,
      hiddenFromStudent: false,
      createdAt: new Date().toISOString(),
    }

    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })
    mockApiClient.post = vi.fn().mockResolvedValue({ data: createdPage })

    renderPedagogicalLogPage()

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/décrivez la séance/i)).toBeDefined()
    })

    await userEvent.type(screen.getByPlaceholderText(/décrivez la séance/i), 'Séance du jour : algèbre')
    await userEvent.click(screen.getByRole('button', { name: /ajouter une entrée/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/pedagogical-logs',
        expect.objectContaining({ content: 'Séance du jour : algèbre' }),
      )
    })
  })

  it('formateur — ne voit pas le bouton "Page spéciale (RP)"', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderPedagogicalLogPage()

    await waitFor(() => {
      expect(screen.getByText('Nouvelle entrée')).toBeDefined()
    })

    expect(screen.queryByText(/page spéciale \(RP\)/i)).toBeNull()
  })
})

describe('Parent — cahier de texte en lecture seule', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(buildAuthMock(PARENT_USER))
  })

  it('parent — voit le cahier de texte sans formulaire d\'ajout', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderPedagogicalLogPage()

    await waitFor(() => {
      expect(screen.getByText('Cahier de texte')).toBeDefined()
    })

    expect(screen.queryByText('Nouvelle entrée')).toBeNull()
  })

  it('parent — voit le bandeau lecture seule', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderPedagogicalLogPage()

    await waitFor(() => {
      expect(screen.getByText(/consultez le cahier de texte en lecture seule/i)).toBeDefined()
    })
  })
})
