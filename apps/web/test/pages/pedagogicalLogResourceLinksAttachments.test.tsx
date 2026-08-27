/**
 * Tests — Liens dans le texte et pièces jointes du cahier de texte
 * (chantier 2026-08-26, révisé le même jour après retour utilisateur réel).
 *
 * Séparé de `PedagogicalLogPage.test.tsx` (déjà volumineux) : même harnais de
 * mocks, mais dédié à ces deux ajouts.
 *
 * Couvre :
 * 1. Insertion d'un lien `[texte](url)` dans le texte (`sessionSummary`/
 *    `homework`) via `InsertLinkButton`, dans le formulaire de création —
 *    remplace l'ancien champ structuré `resourceLinks`, retiré.
 * 2. Affichage d'un lien inséré dans le texte comme un vrai lien cliquable
 *    sur une entrée existante (`LightMarkupText`).
 * 3. Pièces jointes sur une entrée déjà créée : liste et téléchargement
 *    directement visibles pour tout lecteur, sans dépliage préalable ; ajout
 *    et suppression réservés au mode édition (correctifs du 2026-08-27, voir
 *    `LogEntryAttachments`) — plus les cas d'erreur (403, 413).
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

// ─── 1. Insertion d'un lien dans le texte (formulaire de création) ────────

describe('PedagogicalLogPage — insertion d\'un lien dans le texte (formulaire de création)', () => {
  it('insère [texte](url) dans « Déroulement de la séance » et le soumet dans sessionSummary', async () => {
    mockCreateStudentLogEntry.mockResolvedValue(
      makeEntry({
        id: 'log-with-link',
        sessionSummary: '[Fiche de cours](https://example.com/fiche.pdf)',
      }),
    )

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)
    await openNewEntryForm()

    await userEvent.click(
      screen.getByRole('button', { name: 'Insérer un lien dans « Déroulement de la séance »' }),
    )
    await userEvent.type(screen.getByLabelText('Texte affiché du lien'), 'Fiche de cours')
    await userEvent.type(screen.getByLabelText('Adresse (URL) du lien'), 'https://example.com/fiche.pdf')
    await userEvent.click(screen.getByRole('button', { name: 'Insérer' }))

    // Le lien s'affiche comme un jeton portant seulement son libellé — ni
    // crochets, ni URL visibles dès l'insertion (défaut du 2026-08-27).
    await waitFor(() => {
      expect(screen.getByLabelText('Déroulement de la séance')).toHaveTextContent('Fiche de cours')
    })
    expect(screen.getByLabelText('Déroulement de la séance')).not.toHaveTextContent(
      '[Fiche de cours](https://example.com/fiche.pdf)',
    )
    expect(screen.getByLabelText('Déroulement de la séance').textContent).not.toContain('https://')

    await userEvent.click(screen.getByRole('button', { name: /ajouter une entrée/i }))

    await waitFor(() => {
      expect(mockCreateStudentLogEntry).toHaveBeenCalledWith(
        STUDENT_ID,
        expect.objectContaining({
          sessionSummary: '[Fiche de cours](https://example.com/fiche.pdf)',
        }),
      )
    })
    // Plus de champ structuré : la donnée n'est portée que par le texte.
    const submittedPayload = mockCreateStudentLogEntry.mock.calls[0][1]
    expect(submittedPayload).not.toHaveProperty('resourceLinks')
  })

  it('insère aussi un lien dans « À faire »', async () => {
    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)
    await openNewEntryForm()

    await userEvent.click(screen.getByRole('button', { name: 'Insérer un lien dans « À faire »' }))
    await userEvent.type(screen.getByLabelText('Texte affiché du lien'), 'Exercices en ligne')
    await userEvent.type(screen.getByLabelText('Adresse (URL) du lien'), 'https://example.com/exos')
    await userEvent.click(screen.getByRole('button', { name: 'Insérer' }))

    await waitFor(() => {
      expect(screen.getByLabelText('À faire')).toHaveTextContent('Exercices en ligne')
    })
    expect(screen.getByLabelText('À faire').textContent).not.toContain('https://')
  })

  it('insère le lien à la position du curseur, pas systématiquement en fin de texte', async () => {
    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)
    await openNewEntryForm()

    const summaryField = screen.getByLabelText('Déroulement de la séance')
    await userEvent.type(summaryField, 'Suite{Home}')

    await userEvent.click(
      screen.getByRole('button', { name: 'Insérer un lien dans « Déroulement de la séance »' }),
    )
    await userEvent.type(screen.getByLabelText('Texte affiché du lien'), 'Fiche')
    await userEvent.type(screen.getByLabelText('Adresse (URL) du lien'), 'https://example.com/fiche')
    await userEvent.click(screen.getByRole('button', { name: 'Insérer' }))

    // Le jeton « Fiche » doit apparaître AVANT « Suite » dans le texte, pas
    // systématiquement à la fin — même si seul le libellé est visible.
    await waitFor(() => {
      expect(summaryField.textContent).toBe('FicheSuite')
    })
  })

  it('refuse localement une URL non http(s), sans appeler le serveur ni insérer le lien', async () => {
    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)
    await openNewEntryForm()

    await userEvent.click(
      screen.getByRole('button', { name: 'Insérer un lien dans « Déroulement de la séance »' }),
    )
    await userEvent.type(screen.getByLabelText('Texte affiché du lien'), 'Lien suspect')
    await userEvent.type(screen.getByLabelText('Adresse (URL) du lien'), 'javascript:alert(1)')
    await userEvent.click(screen.getByRole('button', { name: 'Insérer' }))

    await waitFor(() => {
      expect(screen.getByText(/doit commencer par http:\/\/ ou https:\/\//i)).toBeDefined()
    })
    expect(screen.getByLabelText('Déroulement de la séance')).toHaveTextContent('')
    expect(mockCreateStudentLogEntry).not.toHaveBeenCalled()
  })

  it('refuse localement un lien sans texte affiché', async () => {
    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)
    await openNewEntryForm()

    await userEvent.click(
      screen.getByRole('button', { name: 'Insérer un lien dans « Déroulement de la séance »' }),
    )
    await userEvent.type(screen.getByLabelText('Adresse (URL) du lien'), 'https://example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Insérer' }))

    await waitFor(() => {
      expect(screen.getByText(/texte affiché est requis/i)).toBeDefined()
    })
    expect(mockCreateStudentLogEntry).not.toHaveBeenCalled()
  })

  it('permet d\'annuler la saisie du lien sans rien insérer', async () => {
    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)
    await openNewEntryForm()

    await userEvent.click(
      screen.getByRole('button', { name: 'Insérer un lien dans « Déroulement de la séance »' }),
    )
    expect(screen.getByLabelText('Texte affiché du lien')).toBeDefined()

    // Deux boutons « Annuler » coexistent ici : celui de la popover de lien
    // (ouverte) et celui du formulaire entier — la popover est ajoutée en
    // premier dans le DOM.
    const [cancelLinkPopover] = screen.getAllByRole('button', { name: 'Annuler' })
    await userEvent.click(cancelLinkPopover)
    expect(screen.queryByLabelText('Texte affiché du lien')).toBeNull()
    expect(screen.getByLabelText('Déroulement de la séance')).toHaveTextContent('')
  })
})

// ─── 2. Affichage d'un lien inséré dans le texte sur une entrée existante ──

describe('PedagogicalLogPage — affichage d\'un lien inséré dans le texte', () => {
  it('affiche le lien comme une ancre cliquable, ouverte dans un nouvel onglet, texte alentour préservé', async () => {
    asStudent()
    mockFetchStudentPedagogicalLog.mockResolvedValue([
      makeEntry({
        sessionSummary: 'Voir [Fiche de cours](https://example.com/fiche.pdf) pour réviser.',
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
    expect(screen.getByText(/voir/i)).toBeDefined()
    expect(screen.getByText(/pour réviser/i)).toBeDefined()
  })

  it("un texte sans lien reste affiché tel quel", async () => {
    asStudent()
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry({ sessionSummary: 'Pas de lien ici.' })])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Pas de lien ici.')).toBeDefined()
    })
    // Scopé à l'entrée : la page porte par ailleurs de vrais liens de
    // navigation (rail gauche, topbar) qui ne sont pas concernés ici.
    const entryItem = screen.getByText('Pas de lien ici.').closest('li') as HTMLElement
    expect(within(entryItem).queryByRole('link')).toBeNull()
  })
})

// ─── 3. Pièces jointes sur une entrée déjà créée ───────────────────────────
//
// Deux défauts corrigés le 2026-08-27 (second correctif du jour, remontés
// par test utilisateur réel) :
//   1. L'ajout (et la suppression, par cohérence) redeviennent possibles sur
//      une entrée déjà créée, mais UNIQUEMENT en mode édition — jamais en
//      simple affichage, y compris pour le formateur auteur.
//   2. Plus de dépliage préalable : tout lecteur voit directement les noms
//      des pièces jointes et le bouton de téléchargement, chargés au montage.

describe('PedagogicalLogPage — pièces jointes hors édition (lecture seule pour tous)', () => {
  it("le formateur auteur ne voit pas de bouton « Joindre un fichier » ni de bouton « Supprimer » en simple affichage", async () => {
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])
    mockFetchLogAttachments.mockResolvedValue([makeAttachment()])

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)

    await waitFor(() => {
      expect(screen.getByText('Révision des limites')).toBeDefined()
    })
    await waitFor(() => {
      expect(screen.getByText('fiche.pdf')).toBeDefined()
    })

    expect(screen.queryByText(/joindre un fichier/i)).toBeNull()
    expect(document.querySelector('input[type="file"]')).toBeNull()
    // Scopé à la ligne de la pièce jointe : « Supprimer » existe par ailleurs
    // sur l'entrée elle-même (bouton de suppression de l'entrée entière).
    const attachmentRow = screen.getByText('fiche.pdf').closest('li') as HTMLElement
    expect(within(attachmentRow).queryByRole('button', { name: /^supprimer$/i })).toBeNull()
    expect(mockUploadLogAttachment).not.toHaveBeenCalled()
  })

  it("n'affiche pas de bouton d'ajout hors édition même quand les pièces jointes sont activées au niveau système", async () => {
    mockFetchAttachmentSettings.mockResolvedValue({ ...DEFAULT_ATTACHMENT_SETTINGS, attachmentsEnabled: true })
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)

    await waitFor(() => {
      expect(screen.getByText('Révision des limites')).toBeDefined()
    })
    await waitFor(() => {
      expect(screen.getByText('Pièces jointes')).toBeDefined()
    })

    expect(screen.queryByText(/joindre un fichier/i)).toBeNull()
  })

  it("l'élève, simple lecteur, voit directement les pièces jointes et le bouton de téléchargement, sans clic préalable", async () => {
    asStudent()
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])
    mockFetchLogAttachments.mockResolvedValue([makeAttachment()])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Révision des limites')).toBeDefined()
    })

    // Chargé automatiquement, sans dépliage : ni bouton toggle, ni clic requis.
    expect(screen.queryByText(/afficher les pièces jointes/i)).toBeNull()
    await waitFor(() => {
      expect(screen.getByText('fiche.pdf')).toBeDefined()
    })
    expect(screen.getByRole('button', { name: /télécharger/i })).toBeDefined()
    expect(screen.queryByText(/joindre un fichier/i)).toBeNull()
    expect(mockFetchLogAttachments).toHaveBeenCalledWith('log-1')
  })

  it('liste les pièces jointes existantes avec nom et taille lisible, jamais storedFilename', async () => {
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])
    mockFetchLogAttachments.mockResolvedValue([makeAttachment()])

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)

    await waitFor(() => {
      expect(screen.getByText('Révision des limites')).toBeDefined()
    })

    await waitFor(() => {
      expect(screen.getByText('fiche.pdf')).toBeDefined()
    })
    expect(screen.getByText('50 Ko')).toBeDefined()
    expect(screen.queryByText('a1b2c3.pdf')).toBeNull()
    // Chargé une seule fois, automatiquement (pas de clic requis, aucun rôle particulier).
    expect(mockFetchLogAttachments).toHaveBeenCalledTimes(1)
  })

  it('télécharge une pièce jointe via fetch + blob (pas un <a href> direct)', async () => {
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])
    mockFetchLogAttachments.mockResolvedValue([makeAttachment()])
    mockFetchLogAttachmentBlob.mockResolvedValue(new Blob(['octets']))

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)

    await waitFor(() => {
      expect(screen.getByText('fiche.pdf')).toBeDefined()
    })
    await userEvent.click(screen.getByRole('button', { name: /télécharger/i }))

    await waitFor(() => {
      expect(mockFetchLogAttachmentBlob).toHaveBeenCalledWith('log-1', 'attachment-1')
    })
  })

  it('403 à la liste des pièces jointes — message affiché, pas de plantage', async () => {
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])
    mockFetchLogAttachments.mockRejectedValue(makeApiError(403))

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)

    await waitFor(() => {
      expect(screen.getByText(/n'avez pas accès aux pièces jointes/i)).toBeDefined()
    })
  })

  it('liste vide — message explicite', async () => {
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])
    mockFetchLogAttachments.mockResolvedValue([])

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)

    await waitFor(() => {
      expect(screen.getByText('Aucune pièce jointe.')).toBeDefined()
    })
  })
})

// ─── 3bis. Pièces jointes en mode édition (le formateur auteur uniquement) ─

async function enterEditMode() {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeDefined()
  })
  await userEvent.click(screen.getByRole('button', { name: 'Modifier' }))
}

describe('PedagogicalLogPage — pièces jointes en mode édition (ajout et suppression)', () => {
  it('affiche le bouton « Joindre un fichier » dès l\'entrée en édition, pour le formateur auteur', async () => {
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])
    mockFetchLogAttachments.mockResolvedValue([])

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)
    await waitFor(() => {
      expect(screen.getByText('Révision des limites')).toBeDefined()
    })

    // Pas de bouton d'ajout tant qu'on n'édite pas.
    expect(screen.queryByText('+ Joindre un fichier')).toBeNull()

    await enterEditMode()

    await waitFor(() => {
      expect(screen.getByText('+ Joindre un fichier')).toBeDefined()
    })
  })

  it('ajoute une pièce jointe en mode édition — envoi immédiat, l\'entrée existe déjà', async () => {
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])
    mockFetchLogAttachments.mockResolvedValue([])
    mockUploadLogAttachment.mockResolvedValue(makeAttachment())

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)
    await waitFor(() => {
      expect(screen.getByText('Révision des limites')).toBeDefined()
    })
    await enterEditMode()

    await waitFor(() => {
      expect(screen.getByText('+ Joindre un fichier')).toBeDefined()
    })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['contenu'], 'fiche.pdf', { type: 'application/pdf' })
    await userEvent.upload(fileInput, file)

    // Envoi immédiat, sans attendre la validation du formulaire d'édition.
    await waitFor(() => {
      expect(mockUploadLogAttachment).toHaveBeenCalledWith('log-1', file)
    })
    await waitFor(() => {
      expect(screen.getByText('fiche.pdf')).toBeDefined()
    })
  })

  it('refuse localement un fichier trop lourd en mode édition, sans appeler le serveur', async () => {
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])
    mockFetchLogAttachments.mockResolvedValue([])
    mockFetchAttachmentSettings.mockResolvedValue({ ...DEFAULT_ATTACHMENT_SETTINGS, maxFileBytes: 5 })

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)
    await waitFor(() => {
      expect(screen.getByText('Révision des limites')).toBeDefined()
    })
    await enterEditMode()

    await waitFor(() => {
      expect(screen.getByText('+ Joindre un fichier')).toBeDefined()
    })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['un contenu bien trop long'], 'gros.pdf', { type: 'application/pdf' })
    await userEvent.upload(fileInput, file)

    await waitFor(() => {
      expect(screen.getByText(/pèse/i)).toBeDefined()
    })
    expect(mockUploadLogAttachment).not.toHaveBeenCalled()
  })

  it('supprime une pièce jointe existante en mode édition', async () => {
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])
    mockFetchLogAttachments.mockResolvedValue([makeAttachment()])
    mockDeleteLogAttachment.mockResolvedValue(undefined)

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)
    await waitFor(() => {
      expect(screen.getByText('fiche.pdf')).toBeDefined()
    })
    // Hors édition : pas de bouton de suppression sur la pièce jointe (le
    // bouton « Supprimer » de l'entrée elle-même reste visible par ailleurs).
    const attachmentRowBeforeEdit = screen.getByText('fiche.pdf').closest('li') as HTMLElement
    expect(within(attachmentRowBeforeEdit).queryByRole('button', { name: /^supprimer$/i })).toBeNull()

    await enterEditMode()

    await waitFor(() => {
      expect(screen.getByText('fiche.pdf')).toBeDefined()
    })
    const attachmentRow = screen.getByText('fiche.pdf').closest('li') as HTMLElement
    await userEvent.click(within(attachmentRow).getByRole('button', { name: /^supprimer$/i }))

    await waitFor(() => {
      expect(mockDeleteLogAttachment).toHaveBeenCalledWith('log-1', 'attachment-1')
    })
  })

  it("l'élève, simple lecteur, ne voit jamais de bouton d'ajout ou de suppression (pas de mode édition pour lui)", async () => {
    asStudent()
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])
    mockFetchLogAttachments.mockResolvedValue([makeAttachment()])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('fiche.pdf')).toBeDefined()
    })
    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull()
    expect(screen.queryByText(/joindre un fichier/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /^supprimer$/i })).toBeNull()
  })
})
