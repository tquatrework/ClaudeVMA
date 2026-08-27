/**
 * Tests — deux défauts remontés par test utilisateur sur le formulaire de
 * nouvelle entrée du cahier de texte (2026-08-27).
 *
 * Séparé de `pedagogicalLogResourceLinksAttachments.test.tsx` (déjà volumineux,
 * > 300 lignes) : même harnais de mocks, dédié à ces deux correctifs.
 *
 * 1. Rendu du lien pendant la saisie (mineur) : dès la validation du lien dans
 *    sa petite saisie, le texte doit déjà apparaître avec le lien mis en
 *    valeur (calque de coloration syntaxique, `LightMarkupTextarea`) —
 *    au lieu du motif brut `[label](url)` non distingué du reste du texte.
 * 2. Pièce jointe choisie pendant la saisie (majeur) : le bouton « Joindre un
 *    fichier » doit être disponible **avant** que l'entrée existe, le fichier
 *    envoyé juste après la création, dans le même geste de soumission.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PedagogicalLogPage from '../../src/pages/PedagogicalLogPage'
import { makeUseAuthReturn } from '../../src/test-helpers'
import type { MyContact } from '../../src/types/relations'
import type { PedagogicalLogPage as LogPage } from '../../src/api/pedagogicalLog'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/relations')
vi.mock('../../src/api/pedagogicalLog')
vi.mock('../../src/api/pedagogicalLogAttachments')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchMyContacts } from '../../src/api/relations'
import { fetchStudentPedagogicalLog, createStudentLogEntry } from '../../src/api/pedagogicalLog'
import {
  fetchAttachmentSettings,
  fetchLogAttachments,
  uploadLogAttachment,
} from '../../src/api/pedagogicalLogAttachments'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchMyContacts = vi.mocked(fetchMyContacts)
const mockFetchStudentPedagogicalLog = vi.mocked(fetchStudentPedagogicalLog)
const mockCreateStudentLogEntry = vi.mocked(createStudentLogEntry)
const mockFetchAttachmentSettings = vi.mocked(fetchAttachmentSettings)
const mockFetchLogAttachments = vi.mocked(fetchLogAttachments)
const mockUploadLogAttachment = vi.mocked(uploadLogAttachment)

const STUDENT_ID = 'fd0fe655-cd28-4f75-b225-846e8aad7e62'
const TEACHER_ID = '89968837-c4bb-455e-b4e4-5a8c86c23a79'

const TEACHER_CONTACTS: MyContact[] = [
  {
    userId: STUDENT_ID,
    firstName: 'Lina',
    lastName: 'Archivet',
    relations: [{ kind: 'teacher_of_student', isPrincipalTeacher: true }],
  },
]

function makeEntry(overrides: Partial<LogPage> = {}): LogPage {
  return {
    id: 'log-1',
    studentId: STUDENT_ID,
    authorId: TEACHER_ID,
    authorRole: 'formateur',
    date: '2026-08-18',
    sessionSummary: 'Révision des limites',
    homework: 'Exercices 4 et 5',
    visibility: 'eleve_parent_formateur',
    isSpecialPage: false,
    hiddenFromStudent: false,
    autoCreated: false,
    createdAt: '2026-08-18T10:00:00.000Z',
    ...overrides,
  }
}

const DEFAULT_ATTACHMENT_SETTINGS = {
  id: 'settings-1',
  attachmentsEnabled: true,
  maxFileBytes: 100_000,
  maxTotalBytesPerEntry: 5_000_000,
  updatedAt: '2026-08-27T00:00:00.000Z',
}

function asTeacher() {
  mockUseAuth.mockReturnValue(makeUseAuthReturn({ id: TEACHER_ID, role: 'formateur' }))
}

function renderPage(initialEntry = `/pedagogical-log?studentId=${STUDENT_ID}`) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/pedagogical-log" element={<PedagogicalLogPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function openNewEntryForm() {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Nouvelle entrée' })).toBeDefined()
  })
  await userEvent.click(screen.getByRole('button', { name: 'Nouvelle entrée' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  asTeacher()
  mockFetchMyContacts.mockResolvedValue(TEACHER_CONTACTS)
  mockFetchStudentPedagogicalLog.mockResolvedValue([])
  mockFetchAttachmentSettings.mockResolvedValue(DEFAULT_ATTACHMENT_SETTINGS)
  mockFetchLogAttachments.mockResolvedValue([])
})

// ─── 1. Rendu du lien pendant la saisie ────────────────────────────────────

describe('PedagogicalLogPage — rendu du lien dès sa validation, avant la soumission', () => {
  it('met en valeur le lien inséré (calque coloré), sans changer la valeur brute du champ', async () => {
    renderPage()
    await openNewEntryForm()

    await userEvent.click(
      screen.getByRole('button', { name: 'Insérer un lien dans « Déroulement de la séance »' }),
    )
    await userEvent.type(screen.getByLabelText('Texte affiché du lien'), 'Fiche de cours')
    await userEvent.type(screen.getByLabelText('Adresse (URL) du lien'), 'https://example.com/fiche.pdf')
    await userEvent.click(screen.getByRole('button', { name: 'Insérer' }))

    // La source de vérité (le <textarea> réel) porte toujours le texte brut.
    await waitFor(() => {
      expect(screen.getByLabelText('Déroulement de la séance')).toHaveValue(
        '[Fiche de cours](https://example.com/fiche.pdf)',
      )
    })

    // Le calque de coloration (un <span>, distinct du <textarea> source de
    // vérité) affiche déjà ce segment mis en valeur — pas un texte neutre
    // indiscernable du reste, avant même de soumettre l'entrée.
    const renderedSegment = document.querySelector('span.text-indigo-600')
    expect(renderedSegment).not.toBeNull()
    expect(renderedSegment?.textContent).toBe('[Fiche de cours](https://example.com/fiche.pdf)')

    // Aucune écriture serveur déclenchée par la seule insertion du lien.
    expect(mockCreateStudentLogEntry).not.toHaveBeenCalled()
  })

  it("un texte sans lien ne produit aucun segment mis en valeur", async () => {
    renderPage()
    await openNewEntryForm()

    await userEvent.type(screen.getByLabelText('Déroulement de la séance'), 'Texte simple sans lien')

    await waitFor(() => {
      expect(screen.getByLabelText('Déroulement de la séance')).toHaveValue('Texte simple sans lien')
    })
    expect(document.querySelector('span.text-indigo-600')).toBeNull()
  })
})

// ─── 2. Pièce jointe choisie pendant la saisie ─────────────────────────────

describe('PedagogicalLogPage — pièce jointe choisie pendant la saisie de la nouvelle entrée', () => {
  it('affiche « Joindre un fichier » avant même que l\'entrée existe', async () => {
    renderPage()
    await openNewEntryForm()

    expect(screen.getByText(/joindre un fichier/i)).toBeDefined()
    expect(mockCreateStudentLogEntry).not.toHaveBeenCalled()
    expect(mockUploadLogAttachment).not.toHaveBeenCalled()
  })

  it("n'affiche pas le bouton quand les pièces jointes sont désactivées", async () => {
    mockFetchAttachmentSettings.mockResolvedValue({
      ...DEFAULT_ATTACHMENT_SETTINGS,
      attachmentsEnabled: false,
    })

    renderPage()
    await openNewEntryForm()

    await waitFor(() => {
      expect(screen.getByLabelText('Déroulement de la séance')).toBeDefined()
    })
    expect(screen.queryByText(/joindre un fichier/i)).toBeNull()
  })

  it('choisit un fichier, affiche son nom, puis l\'envoie juste après la création — un seul clic de soumission', async () => {
    mockCreateStudentLogEntry.mockResolvedValue(makeEntry({ id: 'log-new' }))
    mockUploadLogAttachment.mockResolvedValue({
      id: 'attachment-1',
      logEntryId: 'log-new',
      originalFilename: 'fiche.pdf',
      storedFilename: 'a1b2c3.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12,
      uploadedBy: TEACHER_ID,
      createdAt: '2026-08-27T10:05:00.000Z',
    })

    renderPage()
    await openNewEntryForm()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['contenu'], 'fiche.pdf', { type: 'application/pdf' })
    await userEvent.upload(fileInput, file)

    // Le fichier est gardé en local, rien n'est envoyé tant que l'entrée
    // n'existe pas encore.
    await waitFor(() => {
      expect(screen.getByText('fiche.pdf')).toBeDefined()
    })
    expect(mockUploadLogAttachment).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /ajouter une entrée/i }))

    await waitFor(() => {
      expect(mockCreateStudentLogEntry).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(mockUploadLogAttachment).toHaveBeenCalledWith('log-new', file)
    })
    // Le fichier n'est envoyé qu'une fois l'entrée créée : ordre respecté.
    const createOrder = mockCreateStudentLogEntry.mock.invocationCallOrder[0]
    const uploadOrder = mockUploadLogAttachment.mock.invocationCallOrder[0]
    expect(uploadOrder).toBeGreaterThan(createOrder)

    // Le formulaire se referme, l'entrée créée reste visible — un seul geste
    // pour l'utilisateur.
    await waitFor(() => {
      expect(screen.queryByLabelText('Déroulement de la séance')).toBeNull()
    })
  })

  it('refuse localement un fichier trop lourd avant de créer l\'entrée', async () => {
    mockFetchAttachmentSettings.mockResolvedValue({ ...DEFAULT_ATTACHMENT_SETTINGS, maxFileBytes: 5 })

    renderPage()
    await openNewEntryForm()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['un contenu bien trop long'], 'gros.pdf', { type: 'application/pdf' })
    await userEvent.upload(fileInput, file)

    await waitFor(() => {
      expect(screen.getByText(/pèse/i)).toBeDefined()
    })
    expect(screen.queryByText('gros.pdf')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: /ajouter une entrée/i }))

    // Rien n'a jamais été envoyé — le refus local a empêché toute écriture.
    expect(mockUploadLogAttachment).not.toHaveBeenCalled()
  })

  it('permet de retirer le fichier choisi avant de soumettre', async () => {
    mockCreateStudentLogEntry.mockResolvedValue(makeEntry({ id: 'log-new' }))

    renderPage()
    await openNewEntryForm()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['contenu'], 'fiche.pdf', { type: 'application/pdf' })
    await userEvent.upload(fileInput, file)

    await waitFor(() => {
      expect(screen.getByText('fiche.pdf')).toBeDefined()
    })
    await userEvent.click(screen.getByRole('button', { name: 'Retirer' }))
    expect(screen.queryByText('fiche.pdf')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: /ajouter une entrée/i }))

    await waitFor(() => {
      expect(mockCreateStudentLogEntry).toHaveBeenCalledTimes(1)
    })
    expect(mockUploadLogAttachment).not.toHaveBeenCalled()
  })

  it("l'entrée n'est jamais recréée si l'envoi du fichier échoue après une création réussie", async () => {
    mockCreateStudentLogEntry.mockResolvedValue(makeEntry({ id: 'log-new' }))
    mockUploadLogAttachment.mockRejectedValue({
      response: { status: 500, data: { message: 'boom' } },
    })

    renderPage()
    await openNewEntryForm()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['contenu'], 'fiche.pdf', { type: 'application/pdf' })
    await userEvent.upload(fileInput, file)
    await waitFor(() => {
      expect(screen.getByText('fiche.pdf')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /ajouter une entrée/i }))

    await waitFor(() => {
      expect(mockUploadLogAttachment).toHaveBeenCalledTimes(1)
    })
    // Message d'erreur clair affiché, formulaire refermé, entrée déjà créée.
    await waitFor(() => {
      expect(screen.getByText(/n'a pas pu être enregistrée|réessayez/i)).toBeDefined()
    })
    expect(mockCreateStudentLogEntry).toHaveBeenCalledTimes(1)
  })
})
