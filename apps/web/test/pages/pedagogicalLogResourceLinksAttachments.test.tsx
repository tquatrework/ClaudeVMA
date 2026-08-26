/**
 * Tests — Liens et pièces jointes du cahier de texte (chantier 2026-08-26).
 *
 * Séparé de `PedagogicalLogPage.test.tsx` (déjà volumineux) : même harnais de
 * mocks, mais dédié aux deux ajouts de ce chantier.
 *
 * Couvre :
 * 1. `resourceLinks` dans le formulaire de création : ajout/retrait de liens,
 *    validation front (label requis, URL absolue), soumission.
 * 2. Affichage des liens comme de vrais liens cliquables sur une entrée.
 * 3. Pièces jointes : bouton masqué si désactivées côté serveur, affichage
 *    du plafond, envoi, téléchargement, suppression, cas d'erreur (413).
 */

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PedagogicalLogPage from '../../src/pages/PedagogicalLogPage'
import { makeApiError, makeUseAuthReturn } from '../../src/test-helpers'
import type { MyContact } from '../../src/types/relations'
import type { PedagogicalLogPage as LogPage } from '../../src/api/pedagogicalLog'
import type { PedagogicalLogAttachment } from '../../src/api/pedagogicalLogAttachments'

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
  deleteLogAttachment,
  fetchLogAttachmentBlob,
} from '../../src/api/pedagogicalLogAttachments'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchMyContacts = vi.mocked(fetchMyContacts)
const mockFetchStudentPedagogicalLog = vi.mocked(fetchStudentPedagogicalLog)
const mockCreateStudentLogEntry = vi.mocked(createStudentLogEntry)
const mockFetchAttachmentSettings = vi.mocked(fetchAttachmentSettings)
const mockFetchLogAttachments = vi.mocked(fetchLogAttachments)
const mockUploadLogAttachment = vi.mocked(uploadLogAttachment)
const mockDeleteLogAttachment = vi.mocked(deleteLogAttachment)
const mockFetchLogAttachmentBlob = vi.mocked(fetchLogAttachmentBlob)

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

function makeAttachment(overrides: Partial<PedagogicalLogAttachment> = {}): PedagogicalLogAttachment {
  return {
    id: 'attachment-1',
    logEntryId: 'log-1',
    originalFilename: 'fiche.pdf',
    storedFilename: 'a1b2c3.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 50_000,
    uploadedBy: TEACHER_ID,
    createdAt: '2026-08-18T10:05:00.000Z',
    ...overrides,
  }
}

function asTeacher() {
  mockUseAuth.mockReturnValue(makeUseAuthReturn({ id: TEACHER_ID, role: 'formateur' }))
}

function asStudent() {
  mockUseAuth.mockReturnValue(makeUseAuthReturn({ id: STUDENT_ID, role: 'eleve' }))
}

function renderPage(initialEntry = '/pedagogical-log') {
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

const DEFAULT_ATTACHMENT_SETTINGS = {
  id: 'settings-1',
  attachmentsEnabled: true,
  maxFileBytes: 100_000,
  maxTotalBytesPerEntry: 5_000_000,
  updatedAt: '2026-08-26T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  asTeacher()
  mockFetchMyContacts.mockResolvedValue(TEACHER_CONTACTS)
  mockFetchStudentPedagogicalLog.mockResolvedValue([])
  mockFetchAttachmentSettings.mockResolvedValue(DEFAULT_ATTACHMENT_SETTINGS)
  mockFetchLogAttachments.mockResolvedValue([])
})

// ─── 1. resourceLinks dans le formulaire de création ──────────────────────

describe('PedagogicalLogPage — liens vers une ressource (formulaire de création)', () => {
  it('permet d\'ajouter un lien et le soumet avec label + url', async () => {
    mockCreateStudentLogEntry.mockResolvedValue(
      makeEntry({
        id: 'log-with-link',
        resourceLinks: [{ label: 'Fiche de cours', url: 'https://example.com/fiche.pdf' }],
      }),
    )

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)
    await openNewEntryForm()

    await userEvent.click(screen.getByRole('button', { name: /ajouter un lien/i }))
    await userEvent.type(screen.getByLabelText('Texte affiché du lien'), 'Fiche de cours')
    await userEvent.type(screen.getByLabelText('Adresse (URL) du lien'), 'https://example.com/fiche.pdf')
    await userEvent.click(screen.getByRole('button', { name: /ajouter une entrée/i }))

    await waitFor(() => {
      expect(mockCreateStudentLogEntry).toHaveBeenCalledWith(
        STUDENT_ID,
        expect.objectContaining({
          resourceLinks: [{ label: 'Fiche de cours', url: 'https://example.com/fiche.pdf' }],
        }),
      )
    })
  })

  it('refuse localement une URL non http(s), sans appeler le serveur', async () => {
    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)
    await openNewEntryForm()

    await userEvent.click(screen.getByRole('button', { name: /ajouter un lien/i }))
    await userEvent.type(screen.getByLabelText('Texte affiché du lien'), 'Lien suspect')
    await userEvent.type(screen.getByLabelText('Adresse (URL) du lien'), 'javascript:alert(1)')
    await userEvent.click(screen.getByRole('button', { name: /ajouter une entrée/i }))

    await waitFor(() => {
      expect(screen.getByText(/doit commencer par http:\/\/ ou https:\/\//i)).toBeDefined()
    })
    expect(mockCreateStudentLogEntry).not.toHaveBeenCalled()
  })

  it('refuse localement un lien sans texte affiché', async () => {
    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)
    await openNewEntryForm()

    await userEvent.click(screen.getByRole('button', { name: /ajouter un lien/i }))
    await userEvent.type(screen.getByLabelText('Adresse (URL) du lien'), 'https://example.com')
    await userEvent.click(screen.getByRole('button', { name: /ajouter une entrée/i }))

    await waitFor(() => {
      expect(screen.getByText(/texte affiché/i)).toBeDefined()
    })
    expect(mockCreateStudentLogEntry).not.toHaveBeenCalled()
  })

  it('permet de retirer un lien ajouté', async () => {
    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)
    await openNewEntryForm()

    await userEvent.click(screen.getByRole('button', { name: /ajouter un lien/i }))
    expect(screen.getByLabelText('Texte affiché du lien')).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: /retirer/i }))
    expect(screen.queryByLabelText('Texte affiché du lien')).toBeNull()
  })
})

// ─── 2. Affichage des liens sur une entrée existante ──────────────────────

describe('PedagogicalLogPage — affichage des liens sur une entrée', () => {
  it('affiche chaque lien comme une ancre cliquable, ouverte dans un nouvel onglet', async () => {
    asStudent()
    mockFetchStudentPedagogicalLog.mockResolvedValue([
      makeEntry({
        resourceLinks: [{ label: 'Fiche de cours', url: 'https://example.com/fiche.pdf' }],
      }),
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Fiche de cours' })).toBeDefined()
    })

    const link = screen.getByRole('link', { name: 'Fiche de cours' }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('https://example.com/fiche.pdf')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })
})

// ─── 3. Pièces jointes ─────────────────────────────────────────────────────

describe('PedagogicalLogPage — pièces jointes', () => {
  it("n'affiche pas le bouton « Joindre un fichier » quand les pièces jointes sont désactivées", async () => {
    mockFetchAttachmentSettings.mockResolvedValue({
      ...DEFAULT_ATTACHMENT_SETTINGS,
      attachmentsEnabled: false,
    })
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)

    await waitFor(() => {
      expect(screen.getByText('Révision des limites')).toBeDefined()
    })
    await userEvent.click(screen.getByText(/afficher les pièces jointes/i))

    expect(screen.queryByText(/joindre un fichier/i)).toBeNull()
  })

  it('affiche le plafond par fichier et permet d\'envoyer une pièce jointe', async () => {
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])
    mockUploadLogAttachment.mockResolvedValue(makeAttachment())

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)

    await waitFor(() => {
      expect(screen.getByText('Révision des limites')).toBeDefined()
    })
    await userEvent.click(screen.getByText(/afficher les pièces jointes/i))

    await waitFor(() => {
      expect(screen.getByText(/taille maximale par fichier/i)).toBeDefined()
    })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['contenu'], 'fiche.pdf', { type: 'application/pdf' })
    await userEvent.upload(fileInput, file)

    await waitFor(() => {
      expect(mockUploadLogAttachment).toHaveBeenCalledWith('log-1', file)
    })
    await waitFor(() => {
      expect(screen.getByText('fiche.pdf')).toBeDefined()
    })
  })

  it('refuse localement un fichier trop lourd, sans appeler le serveur', async () => {
    mockFetchAttachmentSettings.mockResolvedValue({ ...DEFAULT_ATTACHMENT_SETTINGS, maxFileBytes: 10 })
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)

    await waitFor(() => {
      expect(screen.getByText('Révision des limites')).toBeDefined()
    })
    await userEvent.click(screen.getByText(/afficher les pièces jointes/i))

    await waitFor(() => {
      expect(screen.getByText(/taille maximale par fichier/i)).toBeDefined()
    })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['un contenu bien trop long pour la limite'], 'gros.pdf', {
      type: 'application/pdf',
    })
    await userEvent.upload(fileInput, file)

    await waitFor(() => {
      expect(screen.getByText(/pèse/i)).toBeDefined()
    })
    expect(mockUploadLogAttachment).not.toHaveBeenCalled()
  })

  it('gère le 413 structuré du serveur avec un message citant la taille reçue et la limite', async () => {
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])
    mockUploadLogAttachment.mockRejectedValue({
      response: {
        status: 413,
        data: {
          statusCode: 413,
          code: 'UPLOAD_FILE_TOO_LARGE',
          maxUploadBytes: 100_000,
          receivedBytes: 145_000,
          requestBodyBytes: null,
        },
      },
    })

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)

    await waitFor(() => {
      expect(screen.getByText('Révision des limites')).toBeDefined()
    })
    await userEvent.click(screen.getByText(/afficher les pièces jointes/i))

    await waitFor(() => {
      expect(screen.getByText(/taille maximale par fichier/i)).toBeDefined()
    })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'moyen.pdf', { type: 'application/pdf' })
    await userEvent.upload(fileInput, file)

    await waitFor(() => {
      expect(mockUploadLogAttachment).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.getByText(/145 Ko/)).toBeDefined()
    })
  })

  it('liste les pièces jointes existantes avec nom et taille lisible, jamais storedFilename', async () => {
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])
    mockFetchLogAttachments.mockResolvedValue([makeAttachment()])

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)

    await waitFor(() => {
      expect(screen.getByText('Révision des limites')).toBeDefined()
    })
    await userEvent.click(screen.getByText(/afficher les pièces jointes/i))

    await waitFor(() => {
      expect(screen.getByText('fiche.pdf')).toBeDefined()
    })
    expect(screen.getByText('50 Ko')).toBeDefined()
    expect(screen.queryByText('a1b2c3.pdf')).toBeNull()
  })

  it('télécharge une pièce jointe via fetch + blob (pas un <a href> direct)', async () => {
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])
    mockFetchLogAttachments.mockResolvedValue([makeAttachment()])
    mockFetchLogAttachmentBlob.mockResolvedValue(new Blob(['octets']))

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)

    await waitFor(() => {
      expect(screen.getByText('Révision des limites')).toBeDefined()
    })
    await userEvent.click(screen.getByText(/afficher les pièces jointes/i))

    await waitFor(() => {
      expect(screen.getByText('fiche.pdf')).toBeDefined()
    })
    await userEvent.click(screen.getByRole('button', { name: /télécharger/i }))

    await waitFor(() => {
      expect(mockFetchLogAttachmentBlob).toHaveBeenCalledWith('log-1', 'attachment-1')
    })
  })

  it('supprime une pièce jointe, visible seulement pour le formateur auteur', async () => {
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])
    mockFetchLogAttachments.mockResolvedValue([makeAttachment()])
    mockDeleteLogAttachment.mockResolvedValue(undefined)

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)

    await waitFor(() => {
      expect(screen.getByText('Révision des limites')).toBeDefined()
    })
    await userEvent.click(screen.getByText(/afficher les pièces jointes/i))

    await waitFor(() => {
      expect(screen.getByText('fiche.pdf')).toBeDefined()
    })
    const attachmentRow = screen.getByText('fiche.pdf').closest('li') as HTMLElement
    await userEvent.click(within(attachmentRow).getByRole('button', { name: /^supprimer$/i }))

    await waitFor(() => {
      expect(mockDeleteLogAttachment).toHaveBeenCalledWith('log-1', 'attachment-1')
    })
  })

  it("l'élève, lecteur seul, ne voit pas de bouton de suppression sur une pièce jointe", async () => {
    asStudent()
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])
    mockFetchLogAttachments.mockResolvedValue([makeAttachment()])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Révision des limites')).toBeDefined()
    })
    await userEvent.click(screen.getByText(/afficher les pièces jointes/i))

    await waitFor(() => {
      expect(screen.getByText('fiche.pdf')).toBeDefined()
    })
    expect(screen.queryByRole('button', { name: /^supprimer$/i })).toBeNull()
    expect(screen.getByRole('button', { name: /télécharger/i })).toBeDefined()
  })

  it('403 à la liste des pièces jointes — message affiché, pas de plantage', async () => {
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])
    mockFetchLogAttachments.mockRejectedValue(makeApiError(403))

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)

    await waitFor(() => {
      expect(screen.getByText('Révision des limites')).toBeDefined()
    })
    await userEvent.click(screen.getByText(/afficher les pièces jointes/i))

    await waitFor(() => {
      expect(screen.getByText(/n'avez pas accès aux pièces jointes/i)).toBeDefined()
    })
  })

  it('liste vide — message explicite', async () => {
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])
    mockFetchLogAttachments.mockResolvedValue([])

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)

    await waitFor(() => {
      expect(screen.getByText('Révision des limites')).toBeDefined()
    })
    await userEvent.click(screen.getByText(/afficher les pièces jointes/i))

    await waitFor(() => {
      expect(screen.getByText('Aucune pièce jointe.')).toBeDefined()
    })
  })
})
