/**
 * Tests pour ForumCharterEditorPage — écran d'édition du texte de la charte de bonne conduite,
 * dernier gap connu du chantier Forums (`docs/architecture/identite-profils-acces.md` >
 * « Développement réel des Forums »).
 *
 * Couvre :
 * - Accès réservé au RP et au TI (masqué pour les autres rôles)
 * - Chargement, erreur de chargement
 * - Formulaire pré-rempli avec le texte courant de la charte, aperçu Markdown à jour
 * - Enregistrement réussi (PATCH /forums/charter), confirmation affichée
 * - Erreur d'enregistrement affichée
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/forums')

import { useAuth } from '../../../src/hooks/useAuth'
import { fetchForumCharter, updateForumCharter } from '../../../src/api/forums'
import ForumCharterEditorPage from '../../../src/pages/ForumCharterEditorPage'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchForumCharter = vi.mocked(fetchForumCharter)
const mockUpdateForumCharter = vi.mocked(updateForumCharter)

function buildAuthMock(role: string) {
  return {
    user: { id: 'user-1', email: 'u@test.com', role: role as never, validationStatus: 'active' as const },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(role)),
    isInternalRole: vi.fn(() => false),
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/community/forums/charter']}>
      <ForumCharterEditorPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ForumCharterEditorPage — accès', () => {
  it("masque l'écran à un rôle non autorisé (élève)", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock('eleve') as ReturnType<typeof useAuth>)

    renderPage()

    expect(
      screen.getByText(/Accès réservé aux responsables pédagogiques et aux techniciens informatiques/i),
    ).toBeDefined()
    expect(mockFetchForumCharter).not.toHaveBeenCalled()
  })

  it('autorise le RP', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock('responsable_pedagogique') as ReturnType<typeof useAuth>)
    mockFetchForumCharter.mockResolvedValue({ content: 'Texte existant', updatedAt: '2026-09-04T10:00:00Z' })

    renderPage()

    await waitFor(() => expect(mockFetchForumCharter).toHaveBeenCalled())
  })

  it('autorise le TI', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock('technicien_informatique') as ReturnType<typeof useAuth>)
    mockFetchForumCharter.mockResolvedValue({ content: '', updatedAt: '2026-09-04T10:00:00Z' })

    renderPage()

    await waitFor(() => expect(mockFetchForumCharter).toHaveBeenCalled())
  })
})

describe('ForumCharterEditorPage — chargement', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(buildAuthMock('responsable_pedagogique') as ReturnType<typeof useAuth>)
  })

  it('affiche un état de chargement puis le formulaire pré-rempli', async () => {
    mockFetchForumCharter.mockResolvedValue({
      content: '# Charte\n\nTexte existant.',
      updatedAt: '2026-09-04T10:00:00Z',
    })

    renderPage()

    expect(screen.getByText(/Chargement de la charte/i)).toBeDefined()

    const textarea = await screen.findByLabelText<HTMLTextAreaElement>(/Texte de la charte/i)
    expect(textarea.value).toBe('# Charte\n\nTexte existant.')

    // L'aperçu Markdown rend le titre comme un vrai <h1>, pas des '#' visibles.
    expect(screen.getByRole('heading', { level: 1, name: 'Charte' })).toBeDefined()
  })

  it("affiche une erreur si le chargement échoue", async () => {
    mockFetchForumCharter.mockRejectedValue(new Error('boom'))

    renderPage()

    await waitFor(() =>
      expect(screen.getByText(/Impossible de lire la charte de bonne conduite/i)).toBeDefined(),
    )
    expect(screen.queryByLabelText(/Texte de la charte/i)).toBeNull()
  })

  it("affiche un placeholder explicite quand la charte n'a pas encore de texte", async () => {
    mockFetchForumCharter.mockResolvedValue({ content: '', updatedAt: '2026-09-04T10:00:00Z' })

    renderPage()

    await screen.findByLabelText(/Texte de la charte/i)
    expect(
      screen.getByText(/n'a pas encore été rédigée par un responsable pédagogique/i),
    ).toBeDefined()
  })
})

describe('ForumCharterEditorPage — enregistrement', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(buildAuthMock('responsable_pedagogique') as ReturnType<typeof useAuth>)
    mockFetchForumCharter.mockResolvedValue({ content: 'Ancien texte', updatedAt: '2026-09-04T10:00:00Z' })
  })

  it('enregistre le nouveau texte via PATCH /forums/charter et affiche une confirmation', async () => {
    const user = userEvent.setup()
    mockUpdateForumCharter.mockResolvedValue({
      content: 'Ancien texte modifié',
      updatedAt: '2026-09-04T11:00:00Z',
    })

    renderPage()

    const textarea = await screen.findByLabelText<HTMLTextAreaElement>(/Texte de la charte/i)
    await user.type(textarea, ' modifié')

    const saveButton = screen.getByRole('button', { name: /Enregistrer/i })
    await user.click(saveButton)

    await waitFor(() =>
      expect(mockUpdateForumCharter).toHaveBeenCalledWith('Ancien texte modifié'),
    )
    expect(await screen.findByText(/Charte enregistrée avec succès/i)).toBeDefined()
  })

  it("affiche une erreur si l'enregistrement échoue, sans faire disparaître le texte saisi", async () => {
    const user = userEvent.setup()
    mockUpdateForumCharter.mockRejectedValue(new Error('network down'))

    renderPage()

    const textarea = await screen.findByLabelText<HTMLTextAreaElement>(/Texte de la charte/i)
    await user.clear(textarea)
    await user.type(textarea, 'Nouveau texte qui échoue')

    await user.click(screen.getByRole('button', { name: /Enregistrer/i }))

    await waitFor(() => expect(screen.getByText(/Impossible d.enregistrer la charte/i)).toBeDefined())
    expect(textarea.value).toBe('Nouveau texte qui échoue')
  })
})
