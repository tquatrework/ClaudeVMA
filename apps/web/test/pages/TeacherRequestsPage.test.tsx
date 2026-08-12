/**
 * TeacherRequestsPage — `/teacher-requests`, point d'entrée du flow.
 *
 * Couvre : chargement, erreur, vide, succès, autorisations par rôle, et les deux
 * formes de réponse du serveur (demandes pour élève/parent/RP, propositions pour le
 * formateur).
 */

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TeacherRequestsPage from '../../src/pages/TeacherRequestsPage'
import type {
  TeacherProposalInboxItem,
  TeacherRequest,
} from '../../src/types/teacherRequests'
import type { MyContact } from '../../src/types/relations'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/teacherRequests')
vi.mock('../../src/api/relations')

import { useAuth } from '../../src/hooks/useAuth'
import {
  createTeacherRequest,
  fetchTeacherProposalInbox,
  fetchTeacherRequests,
  respondToTeacherProposal,
} from '../../src/api/teacherRequests'
import { fetchMyContacts } from '../../src/api/relations'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchTeacherRequests = vi.mocked(fetchTeacherRequests)
const mockFetchTeacherProposalInbox = vi.mocked(fetchTeacherProposalInbox)
const mockCreateTeacherRequest = vi.mocked(createTeacherRequest)
const mockRespondToTeacherProposal = vi.mocked(respondToTeacherProposal)
const mockFetchMyContacts = vi.mocked(fetchMyContacts)

function buildAuthMock(role: string, userId = 'user-1') {
  return {
    user: { id: userId, email: `${role}@test.com`, role, validationStatus: 'active' },
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
    id: 'request-1',
    requesterId: 'student-lea',
    requesterRole: 'eleve',
    studentId: 'student-lea',
    studentName: 'Lea Bertrand',
    description: 'Besoin de soutien en analyse',
    status: 'pending',
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

function buildInboxItem(
  overrides: Partial<TeacherProposalInboxItem> = {},
): TeacherProposalInboxItem {
  return {
    id: 'proposal-1',
    requestId: 'request-1',
    requestDescription: 'Besoin de soutien en analyse',
    studentName: 'Lea Bertrand',
    message: 'Seriez-vous disponible ?',
    availabilityNote: 'Mardi ou jeudi après 17h',
    compensationNote: "45 € de l'heure",
    responseDeadline: '2026-08-20',
    status: 'pending',
    requestStatus: 'redirected',
    respondedAt: null,
    createdAt: '2026-08-02T10:00:00Z',
    updatedAt: '2026-08-02T10:00:00Z',
    ...overrides,
  }
}

const LINKED_STUDENTS: MyContact[] = [
  {
    userId: 'student-lea',
    firstName: 'Lea',
    lastName: 'Bertrand',
    relations: [{ kind: 'finance_owner_of_student' }],
  },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <TeacherRequestsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock('eleve', 'student-lea'))
  mockFetchMyContacts.mockResolvedValue([])
})

describe('TeacherRequestsPage — vue élève', () => {
  it('affiche un état de chargement pendant la requête', () => {
    mockFetchTeacherRequests.mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it('charge la portée « en cours » par défaut', async () => {
    mockFetchTeacherRequests.mockResolvedValue([])

    renderPage()

    await waitFor(() => {
      expect(mockFetchTeacherRequests).toHaveBeenCalledWith('open')
    })
  })

  it("affiche le nom de l'élève et sa description, jamais un identifiant technique", async () => {
    mockFetchTeacherRequests.mockResolvedValue([buildRequest()])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Lea Bertrand')).toBeDefined()
      expect(screen.getByText('Besoin de soutien en analyse')).toBeDefined()
    })
    expect(screen.queryByText(/request-1/)).toBeNull()
    expect(screen.queryByText(/student-lea/)).toBeNull()
  })

  it('affiche le libellé français du statut, y compris pour les nouveaux statuts', async () => {
    mockFetchTeacherRequests.mockResolvedValue([
      buildRequest({ id: 'request-2', status: 'redirected' }),
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Proposée à des formateurs')).toBeDefined()
    })
  })

  it('affiche le professeur retenu sur une demande clôturée', async () => {
    mockFetchTeacherRequests.mockResolvedValue([
      buildRequest({
        status: 'closed',
        chosenTeacherId: 'teacher-nadia',
        chosenTeacherName: 'Nadia Lambert',
        closedAt: '2026-08-12T10:17:05Z',
      }),
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Professeur retenu : Nadia Lambert/)).toBeDefined()
    })
  })

  it('affiche un état vide actionnable', async () => {
    mockFetchTeacherRequests.mockResolvedValue([])

    renderPage()

    await waitFor(() => {
      expect(
        screen.getByText("Vous n'avez pas pour l'instant de demande en cours."),
      ).toBeDefined()
    })
  })

  it('affiche le message du serveur en cas d’erreur de chargement', async () => {
    mockFetchTeacherRequests.mockRejectedValue({
      response: { status: 400, data: { message: 'La demande est déjà clôturée.' } },
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('La demande est déjà clôturée.')).toBeDefined()
    })
  })

  it('recharge la liste au changement de portée', async () => {
    mockFetchTeacherRequests.mockResolvedValue([])

    renderPage()

    await waitFor(() => expect(mockFetchTeacherRequests).toHaveBeenCalledWith('open'))
    await userEvent.click(screen.getByRole('button', { name: 'Traitées' }))

    await waitFor(() => {
      expect(mockFetchTeacherRequests).toHaveBeenCalledWith('closed')
    })
  })

  it("poste exactement {description} — le seul champ du formulaire", async () => {
    mockFetchTeacherRequests.mockResolvedValue([])
    mockCreateTeacherRequest.mockResolvedValue(
      buildRequest({ id: 'request-new', description: 'Aide en analyse' }),
    )

    renderPage()

    await waitFor(() => screen.getByRole('button', { name: 'Nouvelle demande' }))
    await userEvent.click(screen.getByRole('button', { name: 'Nouvelle demande' }))
    await userEvent.type(
      screen.getByLabelText(/Description du besoin/),
      'Aide en analyse',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Soumettre la demande' }))

    await waitFor(() => {
      expect(mockCreateTeacherRequest).toHaveBeenCalledWith({ description: 'Aide en analyse' })
    })
  })

  it('affiche la demande renvoyée par le serveur sans recharger la liste', async () => {
    mockFetchTeacherRequests.mockResolvedValue([])
    mockCreateTeacherRequest.mockResolvedValue(
      buildRequest({
        id: 'request-new',
        description: 'Aide en analyse',
        studentName: 'Lea Bertrand',
      }),
    )

    renderPage()

    await waitFor(() => screen.getByRole('button', { name: 'Nouvelle demande' }))
    await userEvent.click(screen.getByRole('button', { name: 'Nouvelle demande' }))
    await userEvent.type(screen.getByLabelText(/Description du besoin/), 'Aide en analyse')
    await userEvent.click(screen.getByRole('button', { name: 'Soumettre la demande' }))

    await waitFor(() => {
      expect(screen.getByText('Aide en analyse')).toBeDefined()
    })
    // Un seul chargement : la réponse d'écriture remonte, on ne relit pas le serveur.
    expect(mockFetchTeacherRequests).toHaveBeenCalledTimes(1)
  })

  it("n'offre jamais de champ d'identifiant d'élève à l'élève lui-même", async () => {
    mockFetchTeacherRequests.mockResolvedValue([])

    renderPage()

    await waitFor(() => screen.getByRole('button', { name: 'Nouvelle demande' }))
    await userEvent.click(screen.getByRole('button', { name: 'Nouvelle demande' }))

    expect(screen.queryByLabelText(/Élève concerné/)).toBeNull()
    expect(screen.queryByPlaceholderText(/UUID/i)).toBeNull()
  })

  it("ne propose pas le changement de professeur principal à l'élève (403 côté serveur)", async () => {
    mockFetchTeacherRequests.mockResolvedValue([])

    renderPage()

    await waitFor(() => screen.getByRole('button', { name: 'Nouvelle demande' }))
    expect(screen.queryByRole('button', { name: /professeur principal/i })).toBeNull()
  })
})

describe('TeacherRequestsPage — vue parent financeur', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(buildAuthMock('parent_financeur', 'parent-1'))
    mockFetchMyContacts.mockResolvedValue(LINKED_STUDENTS)
  })

  it('propose un sélecteur d’élève par prénom et nom, sans aucun UUID', async () => {
    mockFetchTeacherRequests.mockResolvedValue([])

    renderPage()

    await waitFor(() => screen.getByRole('button', { name: 'Nouvelle demande' }))
    await userEvent.click(screen.getByRole('button', { name: 'Nouvelle demande' }))

    await waitFor(() => {
      const studentSelect = screen.getByLabelText(/Élève concerné/)
      expect(within(studentSelect).getByText('Lea Bertrand')).toBeDefined()
    })
    expect(screen.queryByPlaceholderText(/UUID/i)).toBeNull()
  })

  it('joint le studentId choisi au corps de la demande', async () => {
    mockFetchTeacherRequests.mockResolvedValue([])
    mockCreateTeacherRequest.mockResolvedValue(buildRequest({ id: 'request-new' }))

    renderPage()

    await waitFor(() => screen.getByRole('button', { name: 'Nouvelle demande' }))
    await userEvent.click(screen.getByRole('button', { name: 'Nouvelle demande' }))
    await waitFor(() => screen.getByLabelText(/Élève concerné/))
    await userEvent.type(screen.getByLabelText(/Description du besoin/), 'Soutien hebdo')
    await userEvent.click(screen.getByRole('button', { name: 'Soumettre la demande' }))

    await waitFor(() => {
      expect(mockCreateTeacherRequest).toHaveBeenCalledWith({
        description: 'Soutien hebdo',
        studentId: 'student-lea',
      })
    })
  })

  it('propose le changement de professeur principal', async () => {
    mockFetchTeacherRequests.mockResolvedValue([])

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /professeur principal/i })).toBeDefined()
    })
  })
})

describe('TeacherRequestsPage — vue responsable pédagogique', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(buildAuthMock('responsable_pedagogique', 'rp-1'))
  })

  it('affiche le décompte des réponses renvoyé par le serveur', async () => {
    mockFetchTeacherRequests.mockResolvedValue([
      buildRequest({ acceptedProposalCount: 2, pendingProposalCount: 1 }),
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('2 acceptations · 1 sans réponse')).toBeDefined()
    })
  })

  it("n'offre pas le formulaire de création au RP", async () => {
    mockFetchTeacherRequests.mockResolvedValue([])

    renderPage()

    await waitFor(() => expect(mockFetchTeacherRequests).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Nouvelle demande' })).toBeNull()
  })
})

describe('TeacherRequestsPage — boîte de réception formateur', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(buildAuthMock('formateur', 'teacher-nadia'))
  })

  it('lit la forme « propositions » et non la forme « demandes »', async () => {
    mockFetchTeacherProposalInbox.mockResolvedValue([buildInboxItem()])

    renderPage()

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Propositions reçues' }),
      ).toBeDefined()
      expect(screen.getByText('Besoin de soutien en analyse')).toBeDefined()
    })
    expect(mockFetchTeacherRequests).not.toHaveBeenCalled()
  })

  it('affiche les trois indications facultatives de la proposition', async () => {
    mockFetchTeacherProposalInbox.mockResolvedValue([buildInboxItem()])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Mardi ou jeudi après 17h/)).toBeDefined()
      expect(screen.getByText(/45 € de l'heure/)).toBeDefined()
      expect(screen.getByText(/20\/08\/2026/)).toBeDefined()
    })
  })

  it("poste sur l'identifiant de la PROPOSITION, jamais sur celui de la demande", async () => {
    mockFetchTeacherProposalInbox.mockResolvedValue([buildInboxItem()])
    mockRespondToTeacherProposal.mockResolvedValue(
      buildInboxItem({ status: 'accepted', respondedAt: '2026-08-12T10:00:00Z' }),
    )

    renderPage()

    await waitFor(() => screen.getByRole('button', { name: 'Me porter candidat' }))
    await userEvent.click(screen.getByRole('button', { name: 'Me porter candidat' }))

    await waitFor(() => {
      expect(mockRespondToTeacherProposal).toHaveBeenCalledWith('proposal-1', 'accepted')
    })
  })

  it('remplace la proposition par la réponse du serveur, sans la faire disparaître', async () => {
    mockFetchTeacherProposalInbox.mockResolvedValue([buildInboxItem()])
    mockRespondToTeacherProposal.mockResolvedValue(
      buildInboxItem({ status: 'accepted', respondedAt: '2026-08-12T10:00:00Z' }),
    )

    renderPage()

    await waitFor(() => screen.getByRole('button', { name: 'Me porter candidat' }))
    await userEvent.click(screen.getByRole('button', { name: 'Me porter candidat' }))

    await waitFor(() => {
      expect(screen.getByText('A accepté')).toBeDefined()
    })
    expect(mockFetchTeacherProposalInbox).toHaveBeenCalledTimes(1)
  })

  it('ne propose pas de répondre à une proposition déjà soldée', async () => {
    mockFetchTeacherProposalInbox.mockResolvedValue([
      buildInboxItem({ status: 'expired', requestStatus: 'closed' }),
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Sans réponse (demande clôturée)')).toBeDefined()
    })
    expect(screen.queryByRole('button', { name: 'Me porter candidat' })).toBeNull()
  })

  it('affiche un état vide explicite', async () => {
    mockFetchTeacherProposalInbox.mockResolvedValue([])

    renderPage()

    await waitFor(() => {
      expect(
        screen.getByText('Aucune proposition en attente de votre réponse.'),
      ).toBeDefined()
    })
  })

  it("n'offre pas le formulaire de demande au formateur", async () => {
    mockFetchTeacherProposalInbox.mockResolvedValue([])

    renderPage()

    await waitFor(() => expect(mockFetchTeacherProposalInbox).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Nouvelle demande' })).toBeNull()
  })
})
