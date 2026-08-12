/**
 * TeacherRequestDetailPage — `/teacher-requests/:requestId`.
 *
 * Couvre les étapes 3, 5 et 6 du flow côté RP (proposer, lire les réponses, retenir),
 * et le masquage des actions qui mèneraient un autre rôle à un `403`.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TeacherRequestDetailPage from '../../src/pages/TeacherRequestDetailPage'
import type { TeacherProposal, TeacherRequest } from '../../src/types/teacherRequests'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/teacherRequests')
vi.mock('../../src/api/profile')

import { useAuth } from '../../src/hooks/useAuth'
import {
  deleteTeacherRequest,
  fetchTeacherProposals,
  fetchTeacherRequest,
  sendTeacherProposals,
  updateTeacherRequestStatus,
  validateTeacherRequest,
} from '../../src/api/teacherRequests'
import { fetchValidatedTeachers } from '../../src/api/profile'
import type { ValidatedTeacher } from '../../src/types/profile'
import type { PaginatedResponse } from '../../src/types/pagination'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchValidatedTeachers = vi.mocked(fetchValidatedTeachers)
const mockFetchTeacherRequest = vi.mocked(fetchTeacherRequest)
const mockFetchTeacherProposals = vi.mocked(fetchTeacherProposals)
const mockSendTeacherProposals = vi.mocked(sendTeacherProposals)
const mockValidateTeacherRequest = vi.mocked(validateTeacherRequest)
const mockUpdateTeacherRequestStatus = vi.mocked(updateTeacherRequestStatus)
const mockDeleteTeacherRequest = vi.mocked(deleteTeacherRequest)

const REQUEST_ID = 'request-1'

function buildAuthMock(role: string) {
  return {
    user: { id: `${role}-1`, email: `${role}@test.com`, role, validationStatus: 'active' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(role)),
    isInternalRole: vi.fn(() => false),
  } as unknown as ReturnType<typeof useAuth>
}

function buildRequest(overrides: Partial<TeacherRequest> = {}): TeacherRequest {
  return {
    id: REQUEST_ID,
    requesterId: 'student-lea',
    requesterRole: 'eleve',
    studentId: 'student-lea',
    studentName: 'Lea Bertrand',
    description: 'Besoin de soutien en analyse',
    status: 'redirected',
    type: 'specific',
    currentPpTeacherId: null,
    chosenTeacherId: null,
    chosenTeacherName: null,
    closedAt: null,
    createdAt: '2026-08-01T10:00:00Z',
    updatedAt: '2026-08-01T10:00:00Z',
    ...overrides,
  }
}

function buildProposal(overrides: Partial<TeacherProposal> = {}): TeacherProposal {
  return {
    id: 'proposal-nadia',
    requestId: REQUEST_ID,
    teacherId: 'teacher-nadia',
    teacherName: 'Nadia Lambert',
    message: 'Suivi hebdomadaire ?',
    availabilityNote: null,
    compensationNote: null,
    responseDeadline: null,
    status: 'accepted',
    respondedAt: '2026-08-11T10:00:00Z',
    createdAt: '2026-08-10T10:00:00Z',
    updatedAt: '2026-08-11T10:00:00Z',
    ...overrides,
  }
}

function buildValidatedTeacher(
  overrides: Partial<ValidatedTeacher> = {},
): ValidatedTeacher {
  return {
    userId: 'teacher-nadia',
    firstName: 'Nadia',
    lastName: 'Lambert',
    levels: ['seconde', 'premiere'],
    subjects: ['mathematiques'],
    ...overrides,
  }
}

/** Enveloppe `{data, page, limit, total, totalPages}` — jamais un tableau nu. */
function buildDirectoryPage(
  teachers: ValidatedTeacher[],
  overrides: Partial<PaginatedResponse<ValidatedTeacher>> = {},
): PaginatedResponse<ValidatedTeacher> {
  return {
    data: teachers,
    page: 1,
    limit: 100,
    total: teachers.length,
    totalPages: teachers.length > 0 ? 1 : 0,
    ...overrides,
  }
}

async function openComposer() {
  await waitFor(() => screen.getByRole('button', { name: 'Proposer à des professeurs' }))
  await userEvent.click(screen.getByRole('button', { name: 'Proposer à des professeurs' }))
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/teacher-requests/${REQUEST_ID}`]}>
      <Routes>
        <Route path="/teacher-requests/:requestId" element={<TeacherRequestDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock('responsable_pedagogique'))
  mockFetchTeacherRequest.mockResolvedValue(buildRequest())
  mockFetchTeacherProposals.mockResolvedValue([])
  mockFetchValidatedTeachers.mockResolvedValue(
    buildDirectoryPage([
      buildValidatedTeacher(),
      buildValidatedTeacher({
        userId: 'teacher-yanis',
        firstName: 'Yanis',
        lastName: 'Roche',
        levels: null,
        subjects: null,
      }),
    ]),
  )
})

describe('TeacherRequestDetailPage — affichage commun', () => {
  it('affiche un état de chargement', () => {
    mockFetchTeacherRequest.mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it("affiche le nom de l'élève et la description, sans identifiant technique", async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Lea Bertrand')).toBeDefined()
      expect(screen.getByText('Besoin de soutien en analyse')).toBeDefined()
    })
    expect(screen.queryByText(REQUEST_ID)).toBeNull()
    expect(screen.queryByText('student-lea')).toBeNull()
  })

  it('affiche le professeur retenu sur une demande clôturée', async () => {
    mockFetchTeacherRequest.mockResolvedValue(
      buildRequest({
        status: 'closed',
        chosenTeacherId: 'teacher-nadia',
        chosenTeacherName: 'Nadia Lambert',
        closedAt: '2026-08-12T10:17:05Z',
      }),
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Nadia Lambert')).toBeDefined()
      expect(screen.getByText('Professeur trouvé')).toBeDefined()
    })
  })

  it('affiche le message du serveur en cas d’erreur de chargement', async () => {
    mockFetchTeacherRequest.mockRejectedValue({
      response: { status: 404, data: { message: "Cette demande n'existe pas." } },
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Cette demande n'existe pas.")).toBeDefined()
    })
  })
})

describe('TeacherRequestDetailPage — rôles sans droit RP', () => {
  it.each(['eleve', 'parent_financeur', 'formateur'])(
    "ne lit pas les propositions et ne montre aucune action RP pour le rôle %s",
    async (role) => {
      mockUseAuth.mockReturnValue(buildAuthMock(role))

      renderPage()

      await waitFor(() => expect(screen.getByText('Lea Bertrand')).toBeDefined())

      // `GET /.../proposals` répond 403 hors RP : on ne l'appelle pas.
      expect(mockFetchTeacherProposals).not.toHaveBeenCalled()
      // `GET /profiles/teachers/validated` est réservé aux administrateurs (RP, AF,
      // TI) : un élève, un parent ou un formateur y recevrait 403 — on n'essaie pas.
      expect(mockFetchValidatedTeachers).not.toHaveBeenCalled()
      // Ces actions répondent 403 à l'élève et au parent : elles ne sont pas affichées.
      expect(screen.queryByRole('button', { name: 'Annuler la demande' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Supprimer définitivement' })).toBeNull()
      expect(screen.queryByRole('button', { name: /Proposer à des professeurs/ })).toBeNull()
      expect(screen.queryByRole('button', { name: /Retenir ce professeur/ })).toBeNull()
    },
  )
})

describe('TeacherRequestDetailPage — étape 3, le RP propose', () => {
  it('charge la demande et ses propositions en un seul passage', async () => {
    renderPage()

    await waitFor(() => {
      expect(mockFetchTeacherRequest).toHaveBeenCalledTimes(1)
      expect(mockFetchTeacherProposals).toHaveBeenCalledTimes(1)
    })
  })

  it('ne propose jamais de saisir un identifiant de formateur', async () => {
    renderPage()
    await openComposer()

    expect(screen.queryByPlaceholderText(/UUID/i)).toBeNull()
    expect(screen.queryByLabelText(/ID du formateur/i)).toBeNull()
  })

  it('pré-remplit le message avec la description rédigée par l’élève', async () => {
    renderPage()
    await openComposer()

    const messageField = screen.getByLabelText(/Message aux professeurs/) as HTMLTextAreaElement
    expect(messageField.value).toBe('Besoin de soutien en analyse')
  })

  it('refuse l’envoi tant qu’aucun professeur n’est sélectionné', async () => {
    renderPage()
    await openComposer()

    const submitButton = screen.getByRole('button', { name: 'Envoyer la proposition' })
    expect(submitButton.hasAttribute('disabled')).toBe(true)
    expect(mockSendTeacherProposals).not.toHaveBeenCalled()
  })
})

describe('TeacherRequestDetailPage — étape 3, annuaire des professeurs validés', () => {
  it('coche les professeurs par leur nom, jamais par un identifiant technique', async () => {
    renderPage()
    await openComposer()

    expect(screen.getByLabelText(/Nadia Lambert/)).toBeDefined()
    expect(screen.getByLabelText(/Yanis Roche/)).toBeDefined()
    expect(screen.queryByText('teacher-nadia')).toBeNull()
    expect(screen.queryByText('teacher-yanis')).toBeNull()
  })

  it('affiche niveaux et matières quand ils sont renseignés', async () => {
    renderPage()
    await openComposer()

    expect(
      screen.getByText('Niveaux : seconde, premiere · Matières : mathematiques'),
    ).toBeDefined()
  })

  it("dit « non renseignés » plutôt que « null » quand le profil pédagogique manque", async () => {
    renderPage()
    await openComposer()

    expect(screen.getByText('Niveaux et matières non renseignés')).toBeDefined()
    expect(screen.queryByText(/null/)).toBeNull()
  })

  it('reste lisible en français quand le serveur renvoie un nom absent', async () => {
    mockFetchValidatedTeachers.mockResolvedValue(
      buildDirectoryPage([
        buildValidatedTeacher({ firstName: null, lastName: null }),
      ]),
    )

    renderPage()
    await openComposer()

    expect(screen.getByLabelText(/Professeur \(nom non renseigné\)/)).toBeDefined()
    expect(screen.queryByText('teacher-nadia')).toBeNull()
  })

  it('envoie les identifiants des professeurs cochés', async () => {
    mockSendTeacherProposals.mockResolvedValue([])

    renderPage()
    await openComposer()

    await userEvent.click(screen.getByLabelText(/Nadia Lambert/))
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer la proposition' }))

    await waitFor(() => {
      expect(mockSendTeacherProposals).toHaveBeenCalledWith(REQUEST_ID, {
        teacherIds: ['teacher-nadia'],
        message: 'Besoin de soutien en analyse',
      })
    })
  })

  it('affiche un état vide quand aucun professeur validé n’existe', async () => {
    mockFetchValidatedTeachers.mockResolvedValue(buildDirectoryPage([]))

    renderPage()
    await openComposer()

    expect(
      screen.getByText("Aucun professeur validé n'est disponible pour l'instant."),
    ).toBeDefined()
  })

  it('distingue « annuaire vide » de « tous déjà sollicités »', async () => {
    mockFetchTeacherProposals.mockResolvedValue([
      buildProposal({ teacherId: 'teacher-nadia' }),
      buildProposal({ id: 'proposal-yanis', teacherId: 'teacher-yanis' }),
    ])

    renderPage()
    await openComposer()

    expect(
      screen.getByText(
        'Tous les professeurs disponibles ont déjà été sollicités sur cette demande.',
      ),
    ).toBeDefined()
  })

  it("affiche le message du serveur quand l'annuaire est refusé", async () => {
    mockFetchValidatedTeachers.mockRejectedValue({
      response: { status: 403, data: { message: 'Accès réservé aux administrateurs.' } },
    })

    renderPage()
    await openComposer()

    await waitFor(() => {
      expect(screen.getByText('Accès réservé aux administrateurs.')).toBeDefined()
    })
    expect(screen.queryByLabelText(/Nadia Lambert/)).toBeNull()
  })

  it('enchaîne les pages suivantes au lieu de s’arrêter à la première', async () => {
    mockFetchValidatedTeachers.mockImplementation(async (page = 1) =>
      page === 1
        ? buildDirectoryPage([buildValidatedTeacher()], { total: 2, totalPages: 2 })
        : buildDirectoryPage(
            [buildValidatedTeacher({ userId: 'teacher-yanis', firstName: 'Yanis', lastName: 'Roche' })],
            { page: 2, total: 2, totalPages: 2 },
          ),
    )

    renderPage()
    await openComposer()

    await waitFor(() => {
      expect(mockFetchValidatedTeachers).toHaveBeenCalledTimes(2)
    })
    expect(mockFetchValidatedTeachers).toHaveBeenNthCalledWith(1, 1, 100)
    expect(mockFetchValidatedTeachers).toHaveBeenNthCalledWith(2, 2, 100)
    expect(screen.getByLabelText(/Yanis Roche/)).toBeDefined()
  })
})

describe('TeacherRequestDetailPage — étapes 5 et 6, le RP tranche', () => {
  it('affiche chaque réponse avec son libellé français', async () => {
    mockFetchTeacherProposals.mockResolvedValue([
      buildProposal(),
      buildProposal({
        id: 'proposal-yanis',
        teacherId: 'teacher-yanis',
        teacherName: 'Yanis Roche',
        status: 'declined',
      }),
      buildProposal({
        id: 'proposal-sans-reponse',
        teacherId: 'teacher-3',
        teacherName: 'Camille Durand',
        status: 'pending',
        respondedAt: null,
      }),
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Nadia Lambert')).toBeDefined()
      expect(screen.getByText('A accepté')).toBeDefined()
      expect(screen.getByText('A refusé')).toBeDefined()
      expect(screen.getByText('Sans réponse')).toBeDefined()
    })
  })

  it("n'offre « Retenir ce professeur » que sur une proposition acceptée", async () => {
    mockFetchTeacherProposals.mockResolvedValue([
      buildProposal(),
      buildProposal({ id: 'proposal-yanis', teacherName: 'Yanis Roche', status: 'declined' }),
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Retenir ce professeur' })).toHaveLength(1)
    })
  })

  it('poste {proposalId, isPrincipalTeacher} sur la route de validation', async () => {
    mockFetchTeacherProposals.mockResolvedValue([buildProposal()])
    mockValidateTeacherRequest.mockResolvedValue(
      buildRequest({
        status: 'closed',
        chosenTeacherId: 'teacher-nadia',
        chosenTeacherName: 'Nadia Lambert',
        closedAt: '2026-08-12T10:17:05Z',
      }),
    )

    renderPage()

    await waitFor(() => screen.getByRole('button', { name: 'Retenir ce professeur' }))
    await userEvent.click(
      screen.getByLabelText('Désigner le professeur retenu comme professeur principal'),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Retenir ce professeur' }))

    await waitFor(() => {
      expect(mockValidateTeacherRequest).toHaveBeenCalledWith(REQUEST_ID, {
        proposalId: 'proposal-nadia',
        isPrincipalTeacher: true,
      })
    })
  })

  it('réaffiche la demande clôturée renvoyée par le serveur', async () => {
    mockFetchTeacherProposals.mockResolvedValue([buildProposal()])
    mockValidateTeacherRequest.mockResolvedValue(
      buildRequest({
        status: 'closed',
        chosenTeacherId: 'teacher-nadia',
        chosenTeacherName: 'Nadia Lambert',
        closedAt: '2026-08-12T10:17:05Z',
      }),
    )

    renderPage()

    await waitFor(() => screen.getByRole('button', { name: 'Retenir ce professeur' }))
    await userEvent.click(screen.getByRole('button', { name: 'Retenir ce professeur' }))

    await waitFor(() => {
      expect(screen.getByText('Professeur trouvé')).toBeDefined()
      expect(
        screen.getByText('Nadia Lambert accompagnera désormais cet élève.'),
      ).toBeDefined()
    })
    // La demande n'est pas relue : la réponse d'écriture porte déjà l'état final.
    expect(mockFetchTeacherRequest).toHaveBeenCalledTimes(1)
  })

  it('affiche le message français du serveur quand la validation échoue', async () => {
    mockFetchTeacherProposals.mockResolvedValue([buildProposal()])
    mockValidateTeacherRequest.mockRejectedValue({
      response: {
        status: 409,
        data: { message: 'Un lien contradictoire existe déjà pour cet élève.' },
      },
    })

    renderPage()

    await waitFor(() => screen.getByRole('button', { name: 'Retenir ce professeur' }))
    await userEvent.click(screen.getByRole('button', { name: 'Retenir ce professeur' }))

    await waitFor(() => {
      expect(
        screen.getByText('Un lien contradictoire existe déjà pour cet élève.'),
      ).toBeDefined()
    })
  })
})

describe('TeacherRequestDetailPage — actions RP hors flow', () => {
  it("poste le statut `cancelled` à l'annulation", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockUpdateTeacherRequestStatus.mockResolvedValue(buildRequest({ status: 'cancelled' }))

    renderPage()

    await waitFor(() => screen.getByRole('button', { name: 'Annuler la demande' }))
    await userEvent.click(screen.getByRole('button', { name: 'Annuler la demande' }))

    await waitFor(() => {
      expect(mockUpdateTeacherRequestStatus).toHaveBeenCalledWith(REQUEST_ID, {
        status: 'cancelled',
      })
    })
  })

  it('supprime la demande après confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockDeleteTeacherRequest.mockResolvedValue(undefined)

    renderPage()

    await waitFor(() => screen.getByRole('button', { name: 'Supprimer définitivement' }))
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))

    await waitFor(() => {
      expect(mockDeleteTeacherRequest).toHaveBeenCalledWith(REQUEST_ID)
    })
  })
})
