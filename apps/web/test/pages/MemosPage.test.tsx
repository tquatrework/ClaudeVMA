/**
 * Tests — MemosPage (Mémo élève), réécrits le 2026-08-27 (chantier
 * `feat/memo-formules`) sur le contrat réel de `docs/routes.md`
 * § « Mémo élève — assaini le 2026-08-27 » : un chapitre porte directement
 * ses items (`GET /memos` renvoie `[MemoChapter avec items]`), il n'y a plus
 * de section « Général » ni de mémo sans chapitre.
 *
 * Couvre :
 * 1. Chargement / erreur / vide / succès
 * 2. Élève crée un chapitre puis y ajoute une note (texte, formule, image)
 * 3. Élève renomme et supprime un chapitre
 * 4. Élève supprime un item
 * 5. Recherche dans le mémo
 * 6. Formateur voit un message de lecture seule, sans appeler GET /memos
 *
 * `MemoFormulaInput` est mocké : son propre comportement (repli si MathLive
 * échoue à charger) est couvert par
 * test/components/pedagogical-log/MemoFormulaInput.test.tsx.
 */

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')
vi.mock('../../src/components/pedagogical-log/MemoFormulaInput', () => ({
  MemoFormulaInput: (props: { id: string; value: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="formula-input-stub"
      id={props.id}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
    />
  ),
}))

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'
import MemosPage from '../../src/pages/MemosPage'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)

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

function buildAuthMock(userObj = STUDENT_USER) {
  return {
    user: userObj,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(userObj.role)),
    isInternalRole: vi.fn(() => false),
  }
}

function renderMemosPage() {
  return render(
    <MemoryRouter>
      <MemosPage />
    </MemoryRouter>,
  )
}

const NOW = new Date().toISOString()

function makeChapter(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ch-1',
    studentId: 'student-42',
    title: 'Trigonométrie',
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
    items: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
})

// ─── 1. Chargement / erreur / vide / succès ────────────────────────────────

describe('MemosPage — chargement', () => {
  it('affiche un état de chargement puis les chapitres', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({
      data: [makeChapter({ items: [{ id: 'it-1', chapterId: 'ch-1', type: 'text', content: 'cos²θ + sin²θ = 1', order: 0, createdAt: NOW, updatedAt: NOW }] })],
    })

    renderMemosPage()

    expect(screen.getByText(/chargement du mémo/i)).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText('Trigonométrie')).toBeDefined()
      expect(screen.getByText('cos²θ + sin²θ = 1')).toBeDefined()
    })

    expect(mockApiClient.get).toHaveBeenCalledWith('/memos')
  })

  it('affiche un message d\'erreur générique sur un échec 5xx', async () => {
    mockApiClient.get = vi.fn().mockRejectedValue({ response: { status: 503 } })

    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText(/serveur rencontre un problème/i)).toBeDefined()
    })
  })

  it("affiche le repli propre au mémo sur une erreur sans réponse serveur", async () => {
    mockApiClient.get = vi.fn().mockRejectedValue({})

    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText(/mémo n'a pas pu être chargé/i)).toBeDefined()
    })
  })

  it('affiche un état vide quand l\'élève n\'a aucun chapitre', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText('Aucune note dans le mémo')).toBeDefined()
    })
    expect(screen.getByText(/créez d'abord un chapitre/i)).toBeDefined()
  })
})

// ─── 2. Créer un chapitre puis y ajouter des notes ─────────────────────────

describe('MemosPage — élève crée un chapitre et y ajoute des notes', () => {
  it('crée un chapitre via + Chapitre — POST /memos/chapters', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })
    mockApiClient.post = vi.fn().mockResolvedValue({ data: makeChapter({ title: 'Probabilités' }) })

    renderMemosPage()

    await waitFor(() => expect(screen.getByText('+ Chapitre')).toBeDefined())
    await userEvent.click(screen.getByText('+ Chapitre'))

    await userEvent.type(screen.getByPlaceholderText(/titre du chapitre/i), 'Probabilités')
    await userEvent.click(screen.getByRole('button', { name: /créer$/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/memos/chapters', { title: 'Probabilités' })
    })
    await waitFor(() => expect(screen.getByText('Probabilités')).toBeDefined())
  })

  it('ajoute une note texte dans un chapitre existant', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [makeChapter()] })
    mockApiClient.post = vi.fn().mockResolvedValue({
      data: { id: 'it-new', chapterId: 'ch-1', type: 'text', content: 'Retenir la formule', order: 0, createdAt: NOW, updatedAt: NOW },
    })

    renderMemosPage()

    await waitFor(() => expect(screen.getByText('Trigonométrie')).toBeDefined())
    await userEvent.click(screen.getByText('+ Ajouter une note'))

    // Le type "Texte" est sélectionné par défaut.
    const textField = screen.getByPlaceholderText(/texte libre/i)
    await userEvent.type(textField, 'Retenir la formule')
    await userEvent.click(screen.getByRole('button', { name: /ajouter$/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/memos/chapters/ch-1/items', {
        type: 'text',
        content: 'Retenir la formule',
      })
    })
    await waitFor(() => expect(screen.getByText('Retenir la formule')).toBeDefined())
  })

  it('ajoute une note formule (type sélectionné, MemoFormulaInput mocké)', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [makeChapter()] })
    mockApiClient.post = vi.fn().mockResolvedValue({
      data: { id: 'it-formula', chapterId: 'ch-1', type: 'formula', content: 'x^2+y^2=z^2', order: 0, createdAt: NOW, updatedAt: NOW },
    })

    renderMemosPage()

    await waitFor(() => expect(screen.getByText('Trigonométrie')).toBeDefined())
    await userEvent.click(screen.getByText('+ Ajouter une note'))
    await userEvent.click(screen.getByRole('radio', { name: 'Formule' }))

    const formulaField = screen.getByTestId('formula-input-stub')
    await userEvent.type(formulaField, 'x^2+y^2=z^2')
    await userEvent.click(screen.getByRole('button', { name: /ajouter$/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/memos/chapters/ch-1/items', {
        type: 'formula',
        content: 'x^2+y^2=z^2',
      })
    })
  })

  it('ajoute une note image — multipart, champ file', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [makeChapter()] })
    mockApiClient.post = vi.fn().mockResolvedValue({
      data: {
        id: 'it-image',
        chapterId: 'ch-1',
        type: 'image',
        content: null,
        imageOriginalFilename: 'schema.png',
        imageStoredFilename: 'uuid.png',
        imageMimeType: 'image/png',
        imageSizeBytes: 1000,
        order: 0,
        createdAt: NOW,
        updatedAt: NOW,
      },
    })

    renderMemosPage()

    await waitFor(() => expect(screen.getByText('Trigonométrie')).toBeDefined())
    await userEvent.click(screen.getByText('+ Ajouter une note'))
    await userEvent.click(screen.getByRole('radio', { name: 'Image' }))

    const file = new File([new Uint8Array([1, 2, 3])], 'schema.png', { type: 'image/png' })
    const fileInput = screen.getByLabelText(/^image$/i) as HTMLInputElement
    await userEvent.upload(fileInput, file)

    await userEvent.click(screen.getByRole('button', { name: /ajouter$/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/memos/chapters/ch-1/items/image',
        expect.any(FormData),
        { headers: { 'Content-Type': undefined } },
      )
    })
  })
})

// ─── 3. Renommer / supprimer un chapitre ───────────────────────────────────

describe('MemosPage — renommer et supprimer un chapitre', () => {
  it('renomme un chapitre — PUT /memos/chapters/:id', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [makeChapter()] })
    mockApiClient.put = vi.fn().mockResolvedValue({ data: makeChapter({ title: 'Géométrie' }) })

    renderMemosPage()

    await waitFor(() => expect(screen.getByText('Trigonométrie')).toBeDefined())
    await userEvent.click(screen.getByRole('button', { name: 'Renommer' }))

    const titleInput = screen.getByDisplayValue('Trigonométrie')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'Géométrie')
    await userEvent.click(screen.getByRole('button', { name: 'Renommer' }))

    await waitFor(() => {
      expect(mockApiClient.put).toHaveBeenCalledWith('/memos/chapters/ch-1', { title: 'Géométrie' })
    })
    await waitFor(() => expect(screen.getByText('Géométrie')).toBeDefined())
  })

  it('supprime un chapitre après confirmation — DELETE /memos/chapters/:id', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [makeChapter()] })
    mockApiClient.delete = vi.fn().mockResolvedValue({ status: 204 })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderMemosPage()

    await waitFor(() => expect(screen.getByText('Trigonométrie')).toBeDefined())
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => {
      expect(mockApiClient.delete).toHaveBeenCalledWith('/memos/chapters/ch-1')
    })
    await waitFor(() => expect(screen.queryByText('Trigonométrie')).toBeNull())
  })

  it('n\'appelle pas DELETE si la confirmation est refusée', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [makeChapter()] })
    mockApiClient.delete = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderMemosPage()

    await waitFor(() => expect(screen.getByText('Trigonométrie')).toBeDefined())
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

    expect(mockApiClient.delete).not.toHaveBeenCalled()
    expect(screen.getByText('Trigonométrie')).toBeDefined()
  })
})

// ─── 4. Supprimer un item ───────────────────────────────────────────────────

describe('MemosPage — supprimer un item', () => {
  it('supprime une note après confirmation — DELETE /memos/chapters/:id/items/:id', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({
      data: [
        makeChapter({
          items: [{ id: 'it-1', chapterId: 'ch-1', type: 'text', content: 'À retirer', order: 0, createdAt: NOW, updatedAt: NOW }],
        }),
      ],
    })
    mockApiClient.delete = vi.fn().mockResolvedValue({ status: 204 })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderMemosPage()

    await waitFor(() => expect(screen.getByText('À retirer')).toBeDefined())
    const itemRow = screen.getByText('À retirer').closest('li')!
    await userEvent.click(within(itemRow).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => {
      expect(mockApiClient.delete).toHaveBeenCalledWith('/memos/chapters/ch-1/items/it-1')
    })
    await waitFor(() => expect(screen.queryByText('À retirer')).toBeNull())
  })
})

// ─── 5. Recherche ────────────────────────────────────────────────────────────

describe('MemosPage — recherche dans le mémo', () => {
  it('affiche les résultats de recherche', async () => {
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/memos/search') {
        return Promise.resolve({
          data: [{ id: 'it-found', chapterId: 'ch-1', type: 'text', content: 'cos(π) = -1', order: 0, createdAt: NOW, updatedAt: NOW }],
        })
      }
      return Promise.resolve({ data: [] })
    })

    renderMemosPage()

    await waitFor(() => expect(screen.getByText('Rechercher')).toBeDefined())
    await userEvent.click(screen.getByText('Rechercher'))

    await userEvent.type(screen.getByPlaceholderText(/rechercher dans mes notes/i), 'cos')
    const submitButtons = screen.getAllByRole('button', { name: /chercher/i })
    await userEvent.click(submitButtons.find((btn) => btn.getAttribute('type') === 'submit')!)

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/memos/search',
        expect.objectContaining({ params: { q: 'cos' } }),
      )
    })
    await waitFor(() => expect(screen.getByText('cos(π) = -1')).toBeDefined())
  })
})

// ─── 7. Détacher (F5) — vue de lecture déplaçable sur son propre mémo ──────

describe('MemosPage — détacher la vue de lecture (F5)', () => {
  function makeTwoChaptersWithItems() {
    return [
      makeChapter({
        id: 'ch-1',
        title: 'Trigonométrie',
        items: [{ id: 'it-1', chapterId: 'ch-1', type: 'text', content: 'cos²θ + sin²θ = 1', order: 0, createdAt: NOW, updatedAt: NOW }],
      }),
      makeChapter({
        id: 'ch-2',
        title: 'Probabilités',
        items: [{ id: 'it-2', chapterId: 'ch-2', type: 'text', content: 'P(A) + P(non A) = 1', order: 0, createdAt: NOW, updatedAt: NOW }],
      }),
    ]
  }

  it('ouvre la modale sur tout le mémo depuis le bouton « Détacher » global', async () => {
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/memos/students/student-42') {
        return Promise.resolve({ data: makeTwoChaptersWithItems() })
      }
      return Promise.resolve({ data: makeTwoChaptersWithItems() })
    })

    renderMemosPage()

    await waitFor(() => expect(screen.getByText('Trigonométrie')).toBeDefined())

    // Bouton global (en-tête) puis un lien par chapitre — le premier élément
    // trouvé est le bouton global, placé avant la liste des chapitres dans le DOM.
    const detachButtons = screen.getAllByRole('button', { name: 'Détacher' })
    await userEvent.click(detachButtons[0])

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith('/memos/students/student-42')
    })
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Mémo' })).toBeDefined()
    })
    // Les deux chapitres apparaissent dans la modale (aucun filtre présélectionné).
    expect(
      within(screen.getByRole('dialog')).getByRole('combobox', { name: /filtrer par chapitre/i }),
    ).toHaveValue('all')
  })

  it('ouvre la modale préfiltrée sur un seul chapitre depuis son lien dédié', async () => {
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/memos/students/student-42') {
        return Promise.resolve({ data: makeTwoChaptersWithItems() })
      }
      return Promise.resolve({ data: makeTwoChaptersWithItems() })
    })

    renderMemosPage()

    await waitFor(() => expect(screen.getByText('Probabilités')).toBeDefined())

    const probabilitesSection = screen.getByRole('heading', { name: 'Probabilités' }).closest('section')!
    await userEvent.click(within(probabilitesSection).getByRole('button', { name: 'Détacher' }))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Mémo' })).toBeDefined()
    })
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByRole('combobox', { name: /filtrer par chapitre/i }),
    ).toHaveValue('ch-2')
    expect(within(dialog).queryByRole('heading', { name: 'Trigonométrie' })).toBeNull()
    expect(within(dialog).getByRole('heading', { name: 'Probabilités' })).toBeDefined()
  })

  it('ferme la modale détachée', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [makeChapter()] })

    renderMemosPage()

    await waitFor(() => expect(screen.getByText('Trigonométrie')).toBeDefined())
    const detachButtons = screen.getAllByRole('button', { name: 'Détacher' })
    await userEvent.click(detachButtons[0])

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Mémo' })).toBeDefined()
    })

    await userEvent.click(screen.getByLabelText('Fermer'))

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

// ─── 6. Formateur — lecture seule ───────────────────────────────────────────

describe('MemosPage — formateur voit un message de lecture seule', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
  })

  it('affiche le message readonly sans bouton d\'édition ni appel GET /memos', async () => {
    mockApiClient.get = vi.fn()

    renderMemosPage()

    await waitFor(() => {
      expect(screen.getByText(/réservé à l'élève/i)).toBeDefined()
    })

    expect(screen.queryByText('+ Chapitre')).toBeNull()
    expect(mockApiClient.get).not.toHaveBeenCalledWith('/memos')
  })
})
