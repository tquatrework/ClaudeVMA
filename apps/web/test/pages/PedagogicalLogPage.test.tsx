/**
 * Tests — PedagogicalLogPage, refonte du cahier de texte (2026-08-20).
 *
 * Ce que ces tests verrouillent :
 * 1. Bug corrigé : la page appelle `GET /students/:studentId/pedagogical-log`
 *    (jamais l'ancien `GET /pedagogical-logs`, `404` réel), avec `studentId`
 *    lu en **query param** (`?studentId=`), comme le passent déjà
 *    `MyStudentsPage`/`ParentDashboardPage`.
 * 2. Catégorie de visibilité corrigée : `parent_formateur` proposé (Parent +
 *    Formateur, sans l'élève), plus jamais `eleve_formateur`.
 * 3. Formulaire de création à 3 champs optionnels (date pré-remplie,
 *    déroulement, à faire) — soumissible même vide.
 * 4. Écriture strictement réservée au formateur : élève, parent et RP ne
 *    voient ni formulaire de création, ni bouton modifier/supprimer sur une
 *    entrée normale (RP garde la création de page spéciale, mécanisme
 *    inchangé).
 * 5. Sélecteur d'élève pour les rôles à plusieurs élèves (formateur, parent,
 *    RP), premier élève sélectionné par défaut, pas d'option « Tous ».
 * 6. Recherche par date (`from`/`to`) transmise au serveur.
 * 7. Liste affichée dans l'ordre renvoyé par le serveur (jamais re-triée en
 *    sens inverse).
 * 8. Cas d'erreur : 403 → « Accès refusé », 503 → message serveur générique.
 * 9. Formulaire replié par défaut (2026-08-21) : au chargement, seul le
 *    bouton « Nouvelle entrée » est visible pour le formateur — la liste des
 *    entrées existantes n'est jamais poussée hors écran par le formulaire.
 *    Cliquer sur le bouton ouvre le formulaire ; « Annuler » le referme.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PedagogicalLogPage from '../../src/pages/PedagogicalLogPage'
import { expectNoTechnicalIdentifier, makeApiError, makeUseAuthReturn } from '../../src/test-helpers'
import type { MyContact } from '../../src/types/relations'
import type { PedagogicalLogPage as LogPage } from '../../src/api/pedagogicalLog'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/relations')
vi.mock('../../src/api/pedagogicalLog')
vi.mock('../../src/api/pedagogicalLogAttachments')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchMyContacts } from '../../src/api/relations'
import {
  fetchStudentPedagogicalLog,
  createStudentLogEntry,
  updateLogEntry,
  deleteLogEntry,
} from '../../src/api/pedagogicalLog'
import { fetchAttachmentSettings, fetchLogAttachments } from '../../src/api/pedagogicalLogAttachments'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchMyContacts = vi.mocked(fetchMyContacts)
const mockFetchStudentPedagogicalLog = vi.mocked(fetchStudentPedagogicalLog)
const mockCreateStudentLogEntry = vi.mocked(createStudentLogEntry)
const mockUpdateLogEntry = vi.mocked(updateLogEntry)
const mockDeleteLogEntry = vi.mocked(deleteLogEntry)
// La liste des pièces jointes est chargée automatiquement pour le formateur
// (auteur d'une entrée normale, `canManage`, `LogEntryAttachments` dépliée
// par défaut depuis le 2026-08-26) — ces deux appels doivent être mockés
// même si ce fichier de tests ne porte pas sur les pièces jointes.
const mockFetchAttachmentSettings = vi.mocked(fetchAttachmentSettings)
const mockFetchLogAttachments = vi.mocked(fetchLogAttachments)

const STUDENT_ID = 'fd0fe655-cd28-4f75-b225-846e8aad7e62'
const TEACHER_ID = '89968837-c4bb-455e-b4e4-5a8c86c23a79'
const PARENT_ID = '11cfb3a7-7866-4d72-ab9a-e078097940e5'
const OTHER_STUDENT_ID = '5b1a3f10-6a7b-4a0b-9c1e-0f4d3a2b1c99'

const TEACHER_CONTACTS: MyContact[] = [
  {
    userId: STUDENT_ID,
    firstName: 'Lina',
    lastName: 'Archivet',
    relations: [{ kind: 'teacher_of_student', isPrincipalTeacher: true }],
  },
  {
    userId: OTHER_STUDENT_ID,
    firstName: 'Sacha',
    lastName: 'Second',
    relations: [{ kind: 'teacher_of_student' }],
  },
]

const PARENT_CONTACTS: MyContact[] = [
  {
    userId: STUDENT_ID,
    firstName: 'Lina',
    lastName: 'Archivet',
    relations: [{ kind: 'finance_owner_of_student' }],
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

function asStudent() {
  mockUseAuth.mockReturnValue(makeUseAuthReturn({ id: STUDENT_ID, role: 'eleve' }))
}

function asTeacher() {
  mockUseAuth.mockReturnValue(makeUseAuthReturn({ id: TEACHER_ID, role: 'formateur' }))
}

function asParent() {
  mockUseAuth.mockReturnValue(makeUseAuthReturn({ id: PARENT_ID, role: 'parent_financeur' }))
}

function asResponsablePedagogique() {
  mockUseAuth.mockReturnValue(makeUseAuthReturn({ id: 'rp-1', role: 'responsable_pedagogique' }))
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

/**
 * Le formulaire de nouvelle entrée est replié par défaut (point 5, 2026-08-21) :
 * ouvre-le via le bouton « Nouvelle entrée » avant d'interagir avec ses champs.
 */
async function openNewEntryForm() {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Nouvelle entrée' })).toBeDefined()
  })
  await userEvent.click(screen.getByRole('button', { name: 'Nouvelle entrée' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  asStudent()
  mockFetchMyContacts.mockResolvedValue([])
  mockFetchStudentPedagogicalLog.mockResolvedValue([])
  mockFetchAttachmentSettings.mockResolvedValue({
    id: 'settings-1',
    attachmentsEnabled: true,
    maxFileBytes: 100_000,
    maxTotalBytesPerEntry: 5_000_000,
    updatedAt: '2026-08-26T00:00:00.000Z',
  })
  mockFetchLogAttachments.mockResolvedValue([])
})

// ─── 1. Bug de chargement corrigé ─────────────────────────────────────────

describe('PedagogicalLogPage — chargement (bug corrigé du 2026-08-20)', () => {
  it("élève — appelle GET /students/:studentId/pedagogical-log avec son propre id, sans sélecteur", async () => {
    renderPage()

    await waitFor(() => {
      expect(mockFetchStudentPedagogicalLog).toHaveBeenCalledWith(STUDENT_ID, { from: undefined, to: undefined })
    })

    expect(screen.queryByLabelText('Élève consulté')).toBeNull()
  })

  it("formateur — studentId de l'URL (?studentId=) est bien lu et utilisé", async () => {
    asTeacher()
    mockFetchMyContacts.mockResolvedValue(TEACHER_CONTACTS)

    renderPage(`/pedagogical-log?studentId=${OTHER_STUDENT_ID}`)

    await waitFor(() => {
      expect(mockFetchStudentPedagogicalLog).toHaveBeenCalledWith(OTHER_STUDENT_ID, {
        from: undefined,
        to: undefined,
      })
    })
  })

  it('affiche les entrées renvoyées par le serveur sans les re-trier', async () => {
    asTeacher()
    mockFetchMyContacts.mockResolvedValue(TEACHER_CONTACTS)
    mockFetchStudentPedagogicalLog.mockResolvedValue([
      makeEntry({ id: 'log-recent', date: '2026-08-19', sessionSummary: 'Séance récente' }),
      makeEntry({ id: 'log-old', date: '2026-08-01', sessionSummary: 'Séance ancienne' }),
    ])

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)

    await waitFor(() => {
      expect(screen.getByText('Séance récente')).toBeDefined()
    })

    const renderedOrder = screen
      .getAllByText(/Séance (récente|ancienne)/)
      .map((node) => node.textContent)
    expect(renderedOrder).toEqual(['Séance récente', 'Séance ancienne'])
  })
})

// ─── 2 & 3. Sélecteur de visibilité corrigé + formulaire à 3 champs ───────

describe('PedagogicalLogPage — formulaire de création (points 1 et 2)', () => {
  beforeEach(() => {
    asTeacher()
    mockFetchMyContacts.mockResolvedValue(TEACHER_CONTACTS)
  })

  it('propose les 3 catégories corrigées, jamais l\'ancienne "eleve_formateur"', async () => {
    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)
    await openNewEntryForm()

    expect(screen.getByRole('option', { name: /Élève \+ Parent \+ Formateur/ })).toBeDefined()
    expect(screen.getByRole('option', { name: /Parent \+ Formateur.*sans l'élève/ })).toBeDefined()
    expect(screen.getByRole('option', { name: /Formateur \+ RP uniquement/ })).toBeDefined()
    expect(screen.queryByText(/eleve_formateur/i)).toBeNull()
    expect(screen.queryByRole('option', { name: /^Élève \+ Formateur$/ })).toBeNull()
  })

  it('pré-remplit la date du jour', async () => {
    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)
    await openNewEntryForm()

    await waitFor(() => {
      expect(screen.getByLabelText('Date de la séance')).toBeDefined()
    })

    const dateInput = screen.getByLabelText('Date de la séance') as HTMLInputElement
    const today = new Date().toISOString().slice(0, 10)
    // Tolère un décalage de fuseau : on vérifie juste qu'une valeur AAAA-MM-JJ est posée,
    // proche de la date du jour au jour près.
    expect(dateInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Math.abs(new Date(dateInput.value).getTime() - new Date(today).getTime())).toBeLessThan(
      2 * 24 * 60 * 60 * 1000,
    )
  })

  it('peut être soumis avec les 3 champs vides — POST sans content, avec date/sessionSummary/homework', async () => {
    mockCreateStudentLogEntry.mockResolvedValue(
      makeEntry({ id: 'log-empty', date: '', sessionSummary: undefined, homework: undefined }),
    )

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)
    await openNewEntryForm()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ajouter une entrée/i })).toBeDefined()
    })

    // Vide la date pré-remplie pour tester le cas "tout vide".
    fireEvent.change(screen.getByLabelText('Date de la séance'), { target: { value: '' } })
    await userEvent.click(screen.getByRole('button', { name: /ajouter une entrée/i }))

    await waitFor(() => {
      expect(mockCreateStudentLogEntry).toHaveBeenCalledWith(
        STUDENT_ID,
        expect.objectContaining({
          date: undefined,
          sessionSummary: undefined,
          homework: undefined,
        }),
      )
    })

    const [, payload] = mockCreateStudentLogEntry.mock.calls[0]
    expect(payload).not.toHaveProperty('content')
  })

  it('soumet les 3 champs remplis avec la catégorie choisie', async () => {
    mockCreateStudentLogEntry.mockResolvedValue(
      makeEntry({ id: 'log-new', sessionSummary: 'Cours sur les dérivées', homework: 'Ex. 12 p.34' }),
    )

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)
    await openNewEntryForm()

    await waitFor(() => {
      expect(screen.getByLabelText('Déroulement de la séance')).toBeDefined()
    })

    await userEvent.type(screen.getByLabelText('Déroulement de la séance'), 'Cours sur les dérivées')
    await userEvent.type(screen.getByLabelText('À faire'), 'Ex. 12 p.34')
    await userEvent.selectOptions(screen.getByLabelText('Destinataires'), 'parent_formateur')
    await userEvent.click(screen.getByRole('button', { name: /ajouter une entrée/i }))

    await waitFor(() => {
      expect(mockCreateStudentLogEntry).toHaveBeenCalledWith(
        STUDENT_ID,
        expect.objectContaining({
          sessionSummary: 'Cours sur les dérivées',
          homework: 'Ex. 12 p.34',
          visibility: 'parent_formateur',
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Cours sur les dérivées')).toBeDefined()
    })
  })
})

// ─── 4. Écriture réservée au formateur ────────────────────────────────────

describe('PedagogicalLogPage — écriture réservée au formateur (point 3)', () => {
  it("élève — ne voit ni formulaire de création, ni bouton modifier/supprimer", async () => {
    asStudent()
    mockFetchStudentPedagogicalLog.mockResolvedValue([
      makeEntry({ authorId: TEACHER_ID, authorRole: 'formateur' }),
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Révision des limites')).toBeDefined()
    })

    expect(screen.queryByText('Nouvelle entrée')).toBeNull()
    expect(screen.queryByRole('button', { name: /modifier/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /supprimer/i })).toBeNull()
    expect(screen.getByText(/consultation uniquement/i)).toBeDefined()
  })

  it('parent — lecture seule, sélecteur avec le premier élève par défaut', async () => {
    asParent()
    mockFetchMyContacts.mockResolvedValue(PARENT_CONTACTS)
    mockFetchStudentPedagogicalLog.mockResolvedValue([makeEntry()])

    const { container } = renderPage()

    await waitFor(() => {
      expect(mockFetchStudentPedagogicalLog).toHaveBeenCalledWith(STUDENT_ID, { from: undefined, to: undefined })
    })

    expect(screen.queryByText('Nouvelle entrée')).toBeNull()
    expect(screen.getByRole('option', { name: /Lina Archivet/ })).toBeDefined()
    expectNoTechnicalIdentifier(container)
  })

  it("RP — pas de formulaire d'entrée normale, mais garde la création de page spéciale", async () => {
    asResponsablePedagogique()
    mockFetchMyContacts.mockResolvedValue([
      {
        userId: STUDENT_ID,
        firstName: 'Lina',
        lastName: 'Archivet',
        relations: [{ kind: 'coordinator_of_student' as const }],
      },
    ])

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)

    await waitFor(() => {
      expect(screen.getByText(/créer une page spéciale \(rp\)/i)).toBeDefined()
    })

    expect(screen.queryByText('Nouvelle entrée')).toBeNull()
    expect(screen.queryByLabelText('Destinataires')).toBeNull()
  })

  it("formateur — voit modifier/supprimer sur ses propres entrées, pas sur celles d'un autre auteur", async () => {
    asTeacher()
    mockFetchMyContacts.mockResolvedValue(TEACHER_CONTACTS)
    mockFetchStudentPedagogicalLog.mockResolvedValue([
      makeEntry({ id: 'mine', authorId: TEACHER_ID, sessionSummary: 'Mon entrée' }),
      makeEntry({ id: 'other', authorId: 'other-teacher', sessionSummary: 'Entrée d\'un autre formateur' }),
    ])

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)

    await waitFor(() => {
      expect(screen.getByText('Mon entrée')).toBeDefined()
    })

    // Une seule entrée (la mienne) doit porter les boutons d'édition.
    expect(screen.getAllByRole('button', { name: /^modifier$/i }).length).toBe(1)
    expect(screen.getAllByRole('button', { name: /^supprimer$/i }).length).toBe(1)
  })
})

// ─── 5. Sélecteur d'élève ──────────────────────────────────────────────────

describe('PedagogicalLogPage — sélecteur d\'élève (point 4)', () => {
  it('formateur avec plusieurs élèves — sélectionne le premier par défaut, sans option "Tous"', async () => {
    asTeacher()
    mockFetchMyContacts.mockResolvedValue(TEACHER_CONTACTS)

    renderPage()

    await waitFor(() => {
      expect(mockFetchStudentPedagogicalLog).toHaveBeenCalledWith(STUDENT_ID, { from: undefined, to: undefined })
    })

    expect(screen.queryByRole('option', { name: /^Tous$/i })).toBeNull()
  })

  it('changer de sélection recharge le cahier de texte du nouvel élève', async () => {
    asTeacher()
    mockFetchMyContacts.mockResolvedValue(TEACHER_CONTACTS)

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Sacha Second/ })).toBeDefined()
    })
    mockFetchStudentPedagogicalLog.mockClear()

    await userEvent.selectOptions(screen.getByLabelText('Élève consulté'), OTHER_STUDENT_ID)

    await waitFor(() => {
      expect(mockFetchStudentPedagogicalLog).toHaveBeenCalledWith(OTHER_STUDENT_ID, {
        from: undefined,
        to: undefined,
      })
    })
  })

  it("aucun élève rattaché — message explicite, pas de crash", async () => {
    asTeacher()
    mockFetchMyContacts.mockResolvedValue([])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/aucun élève rattaché/i)).toBeDefined()
    })
    expect(screen.getByText(/sélectionnez un élève/i)).toBeDefined()
    expect(mockFetchStudentPedagogicalLog).not.toHaveBeenCalled()
  })
})

// ─── 6. Recherche par date ──────────────────────────────────────────────────

describe('PedagogicalLogPage — recherche par date (point 4)', () => {
  it('transmet from/to au serveur', async () => {
    asStudent()

    renderPage()

    await waitFor(() => {
      expect(screen.getByLabelText('Du')).toBeDefined()
    })

    fireEvent.change(screen.getByLabelText('Du'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('Au'), { target: { value: '2026-08-31' } })

    await waitFor(() => {
      expect(mockFetchStudentPedagogicalLog).toHaveBeenCalledWith(STUDENT_ID, {
        from: '2026-08-01',
        to: '2026-08-31',
      })
    })
  })
})

// ─── 7. Modification et suppression (formateur) ────────────────────────────

describe('PedagogicalLogPage — modification et suppression par le formateur', () => {
  beforeEach(() => {
    asTeacher()
    mockFetchMyContacts.mockResolvedValue(TEACHER_CONTACTS)
  })

  it('modifie une entrée via PATCH /logs/:id et réaffiche la réponse serveur', async () => {
    mockFetchStudentPedagogicalLog.mockResolvedValue([
      makeEntry({ id: 'log-1', authorId: TEACHER_ID, sessionSummary: 'Avant modification' }),
    ])
    mockUpdateLogEntry.mockResolvedValue(
      makeEntry({ id: 'log-1', authorId: TEACHER_ID, sessionSummary: 'Après modification (serveur)' }),
    )

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)

    await waitFor(() => {
      expect(screen.getByText('Avant modification')).toBeDefined()
    })

    const entryItem = screen.getByText('Avant modification').closest('li') as HTMLElement
    await userEvent.click(within(entryItem).getByRole('button', { name: /^modifier$/i }))
    const summaryField = within(entryItem).getByLabelText('Déroulement de la séance')
    await userEvent.clear(summaryField)
    await userEvent.type(summaryField, 'Nouveau texte saisi')
    await userEvent.click(within(entryItem).getByRole('button', { name: /^enregistrer$/i }))

    await waitFor(() => {
      expect(mockUpdateLogEntry).toHaveBeenCalledWith('log-1', expect.objectContaining({
        sessionSummary: 'Nouveau texte saisi',
      }))
    })

    // La page réaffiche la réponse du serveur, pas le texte tapé localement.
    await waitFor(() => {
      expect(screen.getByText('Après modification (serveur)')).toBeDefined()
    })
  })

  it('supprime une entrée via DELETE /logs/:id après confirmation', async () => {
    mockFetchStudentPedagogicalLog.mockResolvedValue([
      makeEntry({ id: 'log-del', authorId: TEACHER_ID, sessionSummary: 'À supprimer' }),
    ])
    mockDeleteLogEntry.mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)

    await waitFor(() => {
      expect(screen.getByText('À supprimer')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /^supprimer$/i }))

    await waitFor(() => {
      expect(mockDeleteLogEntry).toHaveBeenCalledWith('log-del')
    })
    await waitFor(() => {
      expect(screen.queryByText('À supprimer')).toBeNull()
    })
  })
})

// ─── 8. Cas d'erreur ─────────────────────────────────────────────────────

describe('PedagogicalLogPage — cas d\'erreur', () => {
  it('403 — affiche "Accès refusé"', async () => {
    asStudent()
    mockFetchStudentPedagogicalLog.mockRejectedValue(makeApiError(403))

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Accès refusé')).toBeDefined()
    })
  })

  it('503 (profile-service injoignable) — message de chargement générique, pas de plantage', async () => {
    asTeacher()
    mockFetchMyContacts.mockResolvedValue(TEACHER_CONTACTS)
    mockFetchStudentPedagogicalLog.mockRejectedValue(makeApiError(503))

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger le cahier de texte.')).toBeDefined()
    })
  })

  it('création refusée (403, formateur non titulaire de la relation) — message affiché', async () => {
    asTeacher()
    mockFetchMyContacts.mockResolvedValue(TEACHER_CONTACTS)
    mockCreateStudentLogEntry.mockRejectedValue(makeApiError(403, "Vous n'êtes pas le formateur de cet élève"))

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)
    await openNewEntryForm()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ajouter une entrée/i })).toBeDefined()
    })
    await userEvent.click(screen.getByRole('button', { name: /ajouter une entrée/i }))

    await waitFor(() => {
      expect(screen.getByText("Vous n'êtes pas le formateur de cet élève")).toBeDefined()
    })
  })

  it('liste vide — message explicite, pas de crash', async () => {
    asTeacher()
    mockFetchMyContacts.mockResolvedValue(TEACHER_CONTACTS)
    mockFetchStudentPedagogicalLog.mockResolvedValue([])

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)

    await waitFor(() => {
      expect(screen.getByText('Aucune entrée dans le cahier de texte')).toBeDefined()
    })
  })
})

// ─── 9. Formulaire replié par défaut ───────────────────────────────────────

describe('PedagogicalLogPage — formulaire replié par défaut (point 5, 2026-08-21)', () => {
  beforeEach(() => {
    asTeacher()
    mockFetchMyContacts.mockResolvedValue(TEACHER_CONTACTS)
  })

  it("au chargement, le formulaire n'est pas affiché et la liste des entrées existantes est immédiatement visible", async () => {
    mockFetchStudentPedagogicalLog.mockResolvedValue([
      makeEntry({ id: 'log-existing', sessionSummary: 'Entrée déjà présente' }),
    ])

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)

    await waitFor(() => {
      expect(screen.getByText('Entrée déjà présente')).toBeDefined()
    })

    // Le bouton est là, mais aucun champ du formulaire n'est monté.
    expect(screen.getByRole('button', { name: 'Nouvelle entrée' })).toBeDefined()
    expect(screen.queryByLabelText('Date de la séance')).toBeNull()
    expect(screen.queryByLabelText('Déroulement de la séance')).toBeNull()
    expect(screen.queryByLabelText('Destinataires')).toBeNull()
  })

  it('cliquer sur « Nouvelle entrée » ouvre le formulaire et masque le bouton', async () => {
    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)
    await openNewEntryForm()

    expect(screen.getByLabelText('Date de la séance')).toBeDefined()
    expect(screen.getByLabelText('Déroulement de la séance')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Nouvelle entrée' })).toBeNull()
  })

  it('« Annuler » referme le formulaire sans soumettre, et réaffiche le bouton', async () => {
    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)
    await openNewEntryForm()

    await userEvent.type(screen.getByLabelText('Déroulement de la séance'), 'Texte non soumis')
    await userEvent.click(screen.getByRole('button', { name: /^annuler$/i }))

    expect(mockCreateStudentLogEntry).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Nouvelle entrée' })).toBeDefined()
    expect(screen.queryByLabelText('Déroulement de la séance')).toBeNull()
  })

  it('après une création réussie, le formulaire se referme et le bouton réapparaît', async () => {
    mockCreateStudentLogEntry.mockResolvedValue(
      makeEntry({ id: 'log-created', sessionSummary: 'Nouvelle entrée créée' }),
    )

    renderPage(`/pedagogical-log?studentId=${STUDENT_ID}`)
    await openNewEntryForm()

    await userEvent.click(screen.getByRole('button', { name: /ajouter une entrée/i }))

    await waitFor(() => {
      expect(screen.getByText('Nouvelle entrée créée')).toBeDefined()
    })
    expect(screen.getByRole('button', { name: 'Nouvelle entrée' })).toBeDefined()
    expect(screen.queryByLabelText('Déroulement de la séance')).toBeNull()
  })
})
