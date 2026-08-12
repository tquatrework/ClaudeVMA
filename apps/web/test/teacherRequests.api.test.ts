/**
 * Contrat HTTP du flow « demande de professeur ».
 *
 * Ce fichier remplace `test/pages/TeacherRequestStudentJourney.test.tsx`, qui **figeait le
 * contrat erroné** : il vérifiait qu'on postait `{description}` seul sur `/teacher-requests`
 * — vrai — mais laissait passer sans un mot les six autres appels du flow, dont trois
 * visaient des routes supprimées ou des corps que le serveur n'accepte pas.
 *
 * Les URL et les corps ci-dessous sont ceux de `docs/routes.md` >
 * teacher-request-service, rejoués contre la pile réelle le 2026-08-12.
 * **Les tests de page mockent `src/api/teacherRequests` : ils ne peuvent donc pas voir
 * une URL fausse.** C'est ici, et seulement ici, que l'URL est vérifiée.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

import apiClient from '../src/api/client'
import {
  createPpChangeRequest,
  createTeacherRequest,
  deleteTeacherRequest,
  fetchTeacherProposalInbox,
  fetchTeacherProposals,
  fetchTeacherRequest,
  fetchTeacherRequests,
  respondToTeacherProposal,
  sendTeacherProposals,
  updateTeacherRequestStatus,
  validateTeacherRequest,
} from '../src/api/teacherRequests'
import * as teacherRequestsApi from '../src/api/teacherRequests'

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)
const mockPatch = vi.mocked(apiClient.patch)
const mockDelete = vi.mocked(apiClient.delete)

const REQUEST_ID = '11111111-1111-1111-1111-111111111111'
const PROPOSAL_ID = '22222222-2222-2222-2222-222222222222'
const STUDENT_ID = '33333333-3333-3333-3333-333333333333'
const TEACHER_ID = '44444444-4444-4444-4444-444444444444'
const OTHER_TEACHER_ID = '55555555-5555-5555-5555-555555555555'

beforeEach(() => {
  vi.clearAllMocks()
  mockGet.mockResolvedValue({ data: [] } as never)
  mockPost.mockResolvedValue({ data: {} } as never)
  mockPatch.mockResolvedValue({ data: {} } as never)
  mockDelete.mockResolvedValue({ data: undefined } as never)
})

describe('Étape 1 — créer une demande', () => {
  it('poste sur /teacher-requests, jamais sur /requests ni /teacher-requests/requests', async () => {
    await createTeacherRequest({ description: 'Besoin de soutien en analyse' })

    expect(mockPost).toHaveBeenCalledWith('/teacher-requests', {
      description: 'Besoin de soutien en analyse',
    })
  })

  it("n'envoie que description et studentId — subject/level/sector sont refusés en 400", async () => {
    await createTeacherRequest({ description: 'Soutien', studentId: STUDENT_ID })

    const [, body] = mockPost.mock.calls[0]
    expect(Object.keys(body as object).sort()).toEqual(['description', 'studentId'])
  })

  it('renvoie la demande créée par le serveur', async () => {
    mockPost.mockResolvedValue({
      data: { id: REQUEST_ID, status: 'pending', studentName: 'Lea Bertrand' },
    } as never)

    const createdRequest = await createTeacherRequest({ description: 'Soutien' })

    expect(createdRequest.studentName).toBe('Lea Bertrand')
  })
})

describe('Étapes 2, 4 et 8 — lire les demandes ou la boîte de réception', () => {
  it('passe la portée en query, `open` par défaut', async () => {
    await fetchTeacherRequests()

    expect(mockGet).toHaveBeenCalledWith('/teacher-requests', { params: { scope: 'open' } })
  })

  it('accepte les portées `closed` et `all`', async () => {
    await fetchTeacherRequests('closed')
    await fetchTeacherRequests('all')

    expect(mockGet).toHaveBeenNthCalledWith(1, '/teacher-requests', {
      params: { scope: 'closed' },
    })
    expect(mockGet).toHaveBeenNthCalledWith(2, '/teacher-requests', {
      params: { scope: 'all' },
    })
  })

  it('la boîte de réception formateur emprunte la même URL — la forme dépend du rôle', async () => {
    await fetchTeacherProposalInbox('all')

    expect(mockGet).toHaveBeenCalledWith('/teacher-requests', { params: { scope: 'all' } })
  })

  it('renvoie le tableau tel quel, sans repli sur une enveloppe inexistante', async () => {
    mockGet.mockResolvedValue({ data: [{ id: REQUEST_ID }] } as never)

    expect(await fetchTeacherRequests()).toEqual([{ id: REQUEST_ID }])
  })

  it('lit le détail sur /teacher-requests/:id', async () => {
    mockGet.mockResolvedValue({ data: { id: REQUEST_ID } } as never)

    await fetchTeacherRequest(REQUEST_ID)

    expect(mockGet).toHaveBeenCalledWith(`/teacher-requests/${REQUEST_ID}`)
  })
})

describe('Étape 3 — le RP propose à plusieurs formateurs', () => {
  it('poste teacherIds (pluriel), et non teacherId', async () => {
    await sendTeacherProposals(REQUEST_ID, {
      teacherIds: [TEACHER_ID, OTHER_TEACHER_ID],
      message: 'Seriez-vous disponible ?',
    })

    expect(mockPost).toHaveBeenCalledWith(`/teacher-requests/${REQUEST_ID}/proposals`, {
      teacherIds: [TEACHER_ID, OTHER_TEACHER_ID],
      message: 'Seriez-vous disponible ?',
    })
  })

  it('transporte les trois indications facultatives quand elles sont fournies', async () => {
    await sendTeacherProposals(REQUEST_ID, {
      teacherIds: [TEACHER_ID],
      message: 'Suivi hebdomadaire',
      availabilityNote: 'Mardi ou jeudi après 17h',
      compensationNote: "45 € de l'heure",
      responseDeadline: '2026-08-20',
    })

    const [, body] = mockPost.mock.calls[0]
    expect(body).toMatchObject({
      availabilityNote: 'Mardi ou jeudi après 17h',
      compensationNote: "45 € de l'heure",
      responseDeadline: '2026-08-20',
    })
  })

  it('renvoie les propositions créées, avec le nom des formateurs résolu', async () => {
    mockPost.mockResolvedValue({
      data: [{ id: PROPOSAL_ID, teacherId: TEACHER_ID, teacherName: 'Nadia Lambert' }],
    } as never)

    const createdProposals = await sendTeacherProposals(REQUEST_ID, {
      teacherIds: [TEACHER_ID],
      message: 'Bonjour',
    })

    expect(createdProposals[0].teacherName).toBe('Nadia Lambert')
  })
})

describe('Étape 4 — le formateur répond', () => {
  it('poste sur /proposals/:proposalId/accept', async () => {
    mockPost.mockResolvedValue({ data: { id: PROPOSAL_ID, status: 'accepted' } } as never)

    await respondToTeacherProposal(PROPOSAL_ID, 'accepted')

    expect(mockPost).toHaveBeenCalledWith(`/proposals/${PROPOSAL_ID}/accept`, {})
  })

  it('poste sur /proposals/:proposalId/decline pour un refus', async () => {
    mockPost.mockResolvedValue({ data: { id: PROPOSAL_ID, status: 'declined' } } as never)

    await respondToTeacherProposal(PROPOSAL_ID, 'declined')

    expect(mockPost).toHaveBeenCalledWith(`/proposals/${PROPOSAL_ID}/decline`, {})
  })

  it('renvoie la proposition mise à jour par le serveur', async () => {
    mockPost.mockResolvedValue({
      data: { id: PROPOSAL_ID, status: 'accepted', requestStatus: 'redirected' },
    } as never)

    const updatedProposal = await respondToTeacherProposal(PROPOSAL_ID, 'accepted')

    expect(updatedProposal.status).toBe('accepted')
    expect(updatedProposal.requestStatus).toBe('redirected')
  })
})

describe('Étapes 5 et 6 — le RP lit les réponses puis tranche', () => {
  it('lit les propositions sur /teacher-requests/:requestId/proposals', async () => {
    await fetchTeacherProposals(REQUEST_ID)

    expect(mockGet).toHaveBeenCalledWith(`/teacher-requests/${REQUEST_ID}/proposals`)
  })

  it('valide sur /teacher-requests/:id/validate avec {proposalId, isPrincipalTeacher}', async () => {
    mockPost.mockResolvedValue({ data: { id: REQUEST_ID, status: 'closed' } } as never)

    await validateTeacherRequest(REQUEST_ID, {
      proposalId: PROPOSAL_ID,
      isPrincipalTeacher: true,
    })

    expect(mockPost).toHaveBeenCalledWith(`/teacher-requests/${REQUEST_ID}/validate`, {
      proposalId: PROPOSAL_ID,
      isPrincipalTeacher: true,
    })
  })

  it('renvoie la demande clôturée, avec le nom du professeur retenu', async () => {
    mockPost.mockResolvedValue({
      data: {
        id: REQUEST_ID,
        status: 'closed',
        chosenTeacherName: 'Nadia Lambert',
        closedAt: '2026-08-12T10:17:05.104Z',
      },
    } as never)

    const closedRequest = await validateTeacherRequest(REQUEST_ID, { proposalId: PROPOSAL_ID })

    expect(closedRequest.status).toBe('closed')
    expect(closedRequest.chosenTeacherName).toBe('Nadia Lambert')
  })
})

describe('Actions RP hors flow nominal', () => {
  it('change le statut via PATCH /teacher-requests/:id/status', async () => {
    mockPatch.mockResolvedValue({ data: { id: REQUEST_ID, status: 'cancelled' } } as never)

    await updateTeacherRequestStatus(REQUEST_ID, { status: 'cancelled' })

    expect(mockPatch).toHaveBeenCalledWith(`/teacher-requests/${REQUEST_ID}/status`, {
      status: 'cancelled',
    })
  })

  it('supprime via DELETE /teacher-requests/:id', async () => {
    await deleteTeacherRequest(REQUEST_ID)

    expect(mockDelete).toHaveBeenCalledWith(`/teacher-requests/${REQUEST_ID}`)
  })

  it('poste le changement de professeur principal avec le corps attendu par le serveur', async () => {
    mockPost.mockResolvedValue({ data: { id: REQUEST_ID, type: 'pp_change' } } as never)

    await createPpChangeRequest({
      studentId: STUDENT_ID,
      currentPpTeacherId: TEACHER_ID,
      description: 'Changement souhaité pour cause de disponibilités.',
    })

    // Le front envoyait `{currentTeacherId, requestedTeacherId, reason}` — trois noms
    // qu'aucun DTO ne déclare.
    expect(mockPost).toHaveBeenCalledWith('/teacher-requests/pp-change', {
      studentId: STUDENT_ID,
      currentPpTeacherId: TEACHER_ID,
      description: 'Changement souhaité pour cause de disponibilités.',
    })
  })
})

describe('Routes du modèle abandonné — retirées du front', () => {
  it("n'expose plus la sélection par le client, supprimée côté serveur", () => {
    // `POST /teacher-requests/:id/select` relevait du modèle « le RP présélectionne,
    // le client choisit ». C'est le RP qui tranche, et lui seul.
    expect('selectTeacherCandidate' in teacherRequestsApi).toBe(false)
  })

  it("n'expose plus l'ajout de candidat un par un", () => {
    expect('addTeacherCandidate' in teacherRequestsApi).toBe(false)
  })

  it("n'expose plus la variante sujet/niveau/filière du formulaire de demande", () => {
    expect('createSpecificTeacherRequest' in teacherRequestsApi).toBe(false)
  })

  it("n'expose plus l'arrêt de collaboration, dont le préfixe n'est pas proxifié", () => {
    // `/teacher-collaborations/...` répondait `404` HTML de nginx : la gateway ne
    // connaît pas ce préfixe.
    expect('requestCollaborationStop' in teacherRequestsApi).toBe(false)
  })

  it("n'expose plus /requests, second nom de la même ressource que /teacher-requests", () => {
    expect('fetchTeacherRequestsForDashboard' in teacherRequestsApi).toBe(false)
  })
})
