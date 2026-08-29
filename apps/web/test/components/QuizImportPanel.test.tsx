/**
 * Tests de `QuizImportPanel` — import de plusieurs Quizz depuis un fichier
 * (`docs/architecture.md` > « Import de Quizz depuis un tableur »).
 *
 * Comportements gardés :
 * 1. la limite de taille est lue au serveur et affichée avant tout choix de fichier ;
 * 2. une extension non acceptée est refusée localement, sans appel réseau ;
 * 3. un fichier trop lourd est refusé localement, sans appel réseau ;
 * 4. après un envoi réussi, le compte-rendu est affiché **par bloc**, jamais un
 *    état succès/échec global — un bloc en erreur n'empêche pas d'afficher les
 *    autres blocs créés ;
 * 5. le titre affiché pour un bloc créé est relu via `GET /quizzes/:id`
 *    (`fetchQuiz`), le contrat serveur de l'import ne portant pas le titre.
 */

import { render, screen, waitFor, within } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QuizImportPanel } from '../../src/components/content-catalog/QuizImportPanel'

vi.mock('../../src/api/quizImport')
vi.mock('../../src/api/quizzes')

import { fetchQuizImportConstraints, importQuizzes } from '../../src/api/quizImport'
import { fetchQuiz } from '../../src/api/quizzes'

const mockFetchQuizImportConstraints = vi.mocked(fetchQuizImportConstraints)
const mockImportQuizzes = vi.mocked(importQuizzes)
const mockFetchQuiz = vi.mocked(fetchQuiz)

const SERVER_CONSTRAINTS = { maxFileSizeBytes: 900_000 }

function renderPanel(onImported = vi.fn(), onCancel = vi.fn()) {
  return render(
    <MemoryRouter>
      <QuizImportPanel onImported={onImported} onCancel={onCancel} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchQuizImportConstraints.mockResolvedValue(SERVER_CONSTRAINTS)
})

describe('QuizImportPanel — limite de taille annoncée', () => {
  it('affiche la limite lue au serveur avant tout choix de fichier', async () => {
    renderPanel()
    await waitFor(() => expect(mockFetchQuizImportConstraints).toHaveBeenCalled())
    expect(await screen.findByText(/900 Ko/)).toBeInTheDocument()
  })
})

describe('QuizImportPanel — refus locaux, sans appel réseau', () => {
  it("refuse une extension non acceptée sans appeler l'API", async () => {
    renderPanel()
    await waitFor(() => expect(mockFetchQuizImportConstraints).toHaveBeenCalled())

    const fileInput = screen.getByLabelText(/Fichier à importer/i) as HTMLInputElement
    const wrongFile = new File(['contenu'], 'quizzes.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [wrongFile] } })

    expect(await screen.findByText(/n'est pas un fichier \.csv ou \.xlsx/)).toBeInTheDocument()
    expect(mockImportQuizzes).not.toHaveBeenCalled()
  })

  it('refuse un fichier trop lourd sans appeler l’API', async () => {
    renderPanel()
    await waitFor(() => expect(mockFetchQuizImportConstraints).toHaveBeenCalled())

    const fileInput = screen.getByLabelText(/Fichier à importer/i) as HTMLInputElement
    const bigFile = new File([new Uint8Array(2_000_000)], 'quizzes.csv', { type: 'text/csv' })
    fireEvent.change(fileInput, { target: { files: [bigFile] } })

    expect(await screen.findByText(/Ce fichier pèse 2 Mo/)).toBeInTheDocument()
    expect(mockImportQuizzes).not.toHaveBeenCalled()
  })
})

describe('QuizImportPanel — compte-rendu par bloc', () => {
  it('affiche un bloc créé et un bloc en erreur, jamais un état global unique', async () => {
    mockImportQuizzes.mockResolvedValue([
      { blockIndex: 0, status: 'created', quizId: 'quiz-1', validationStatus: 'validated' },
      {
        blockIndex: 1,
        status: 'error',
        errors: [{ row: 8, message: 'catégorie de question inconnue' }],
      },
    ])
    mockFetchQuiz.mockResolvedValue({
      id: 'quiz-1',
      title: 'Fractions niveau 1',
      description: '',
      tags: [],
      status: 'validated',
      authorId: 'author-1',
      authorRole: 'formateur',
      defaultPoints: 1,
      penaltyEnabled: false,
      penaltyPoints: 0,
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z',
      questions: [],
    })

    const onImported = vi.fn()
    renderPanel(onImported)
    await waitFor(() => expect(mockFetchQuizImportConstraints).toHaveBeenCalled())

    const fileInput = screen.getByLabelText(/Fichier à importer/i) as HTMLInputElement
    const file = new File(['contenu'], 'quizzes.csv', { type: 'text/csv' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    fireEvent.click(screen.getByRole('button', { name: /^Importer$/ }))

    // Le bloc créé affiche le titre relu, pas un repli « Quizz n°1 du fichier ».
    expect(await screen.findByText('Fractions niveau 1')).toBeInTheDocument()
    // Le bloc en erreur affiche le détail de la ligne fautive.
    expect(screen.getByText(/Ligne 8/)).toBeInTheDocument()
    expect(screen.getByText(/catégorie de question inconnue/)).toBeInTheDocument()

    // Résumé chiffré : 1 créé, 1 en erreur — jamais un seul état global.
    expect(screen.getByText(/1 quizz créé/)).toBeInTheDocument()
    expect(screen.getByText(/1 en erreur/)).toBeInTheDocument()

    await waitFor(() => expect(onImported).toHaveBeenCalled())
  })

  it("propose un lien vers la fiche d'un bloc créé", async () => {
    mockImportQuizzes.mockResolvedValue([
      { blockIndex: 0, status: 'created', quizId: 'quiz-42', validationStatus: 'pending_validation' },
    ])
    mockFetchQuiz.mockResolvedValue({
      id: 'quiz-42',
      title: 'Géométrie',
      description: '',
      tags: [],
      status: 'pending_validation',
      authorId: 'author-1',
      authorRole: 'formateur',
      defaultPoints: 1,
      penaltyEnabled: false,
      penaltyPoints: 0,
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z',
      questions: [],
    })

    renderPanel()
    await waitFor(() => expect(mockFetchQuizImportConstraints).toHaveBeenCalled())

    const fileInput = screen.getByLabelText(/Fichier à importer/i) as HTMLInputElement
    fireEvent.change(fileInput, {
      target: { files: [new File(['contenu'], 'quizzes.csv', { type: 'text/csv' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: /^Importer$/ }))

    const createdBlock = (await screen.findByText('Géométrie')).closest('li') as HTMLElement
    expect(within(createdBlock).getByRole('button', { name: /Voir la fiche/ })).toBeInTheDocument()
  })
})

describe('QuizImportPanel — échec serveur', () => {
  it("affiche un message d'erreur sans jamais créer de résultat vide affiché comme un succès", async () => {
    mockImportQuizzes.mockRejectedValue({ response: { status: 403 } })

    renderPanel()
    await waitFor(() => expect(mockFetchQuizImportConstraints).toHaveBeenCalled())

    const fileInput = screen.getByLabelText(/Fichier à importer/i) as HTMLInputElement
    fireEvent.change(fileInput, {
      target: { files: [new File(['contenu'], 'quizzes.csv', { type: 'text/csv' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: /^Importer$/ }))

    expect(await screen.findByText(/n'êtes pas autorisé/)).toBeInTheDocument()
    expect(screen.queryByText(/Résultat de l'import/)).not.toBeInTheDocument()
  })
})
