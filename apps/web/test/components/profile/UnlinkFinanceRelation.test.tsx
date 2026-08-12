/**
 * Tests — « Délier » un parent financeur et un élève, dans les deux sens.
 *
 * Écrans couverts, symétriques :
 *   - `ParentFinanceurSection` : l'élève délie un parent financeur ;
 *   - `LinkedStudentsSection`  : le parent financeur délie un élève.
 *
 * Comportements verrouillés ici :
 *   - la confirmation **nomme la personne** (prénom + nom), jamais un UUID ;
 *   - la rupture réussie retire la ligne **depuis la réponse du serveur**, sans
 *     nouvelle requête de liste, et la liste vide affiche son message normal ;
 *   - un refus (`404`, deux causes indiscernables) laisse la boîte ouverte, la
 *     ligne en place, et affiche un message en français qui ne suppose aucune des
 *     deux causes ;
 *   - un double clic n'envoie qu'une seule requête ;
 *   - « Annuler » n'appelle rien.
 *
 * ⚠️ Ces tests simulent tout le réseau : ils ne valent pas preuve contre la pile
 * réelle, seulement garde-fou de non-régression.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ParentFinanceurSection from '../../../src/components/profile/ParentFinanceurSection'
import LinkedStudentsSection from '../../../src/components/profile/LinkedStudentsSection'
import { expectNoTechnicalIdentifier } from '../../../src/test-helpers'

vi.mock('../../../src/api/relations')
vi.mock('../../../src/api/parentLinkRequest')
vi.mock('../../../src/hooks/useAuth')

import {
  fetchLinkedParents,
  fetchLinkedStudents,
  unlinkFinanceOwnerAndStudent,
} from '../../../src/api/relations'
import { fetchParentLinkRequests } from '../../../src/api/parentLinkRequest'
import { useAuth } from '../../../src/hooks/useAuth'

const mockFetchLinkedParents = vi.mocked(fetchLinkedParents)
const mockFetchLinkedStudents = vi.mocked(fetchLinkedStudents)
const mockUnlinkFinanceOwnerAndStudent = vi.mocked(unlinkFinanceOwnerAndStudent)
const mockFetchParentLinkRequests = vi.mocked(fetchParentLinkRequests)
const mockUseAuth = vi.mocked(useAuth)

const STUDENT_ID = '3f2a1b40-1111-4aaa-8bbb-000000000001'
const FINANCE_OWNER_ID = 'ee7c85dc-1234-4abc-9def-000000000000'
const LINK_ID = '9c0d5e11-2222-4ccc-9ddd-000000000002'

const ACTIVE_LINK = {
  id: LINK_ID,
  financeOwnerId: FINANCE_OWNER_ID,
  studentId: STUDENT_ID,
  createdAt: '2026-01-10T10:00:00.000Z',
  endedAt: null,
  endedBy: null,
}

/** Réponse `200` du DELETE : le lien est clos, jamais supprimé. */
const CLOSED_LINK = {
  ...ACTIVE_LINK,
  endedAt: '2026-08-11T09:30:00.000Z',
  endedBy: STUDENT_ID,
}

function buildAuthMock(role: 'eleve' | 'parent_financeur', userId: string) {
  return {
    user: {
      id: userId,
      loginIdentifier: role === 'eleve' ? 'lucas.martin' : 'jean.martin',
      email: 'personne@test.com',
      role,
      validationStatus: 'active' as const,
    },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    hasRole: vi.fn(() => false),
    isInternalRole: vi.fn(() => false),
  }
}

function buildNotFoundError() {
  return {
    response: {
      status: 404,
      data: { message: 'Aucun lien de financement trouvé entre ces deux personnes' },
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchParentLinkRequests.mockResolvedValue([])
})

// ─── Sens 1 : l'élève délie son parent financeur ──────────────────────────────

describe('ParentFinanceurSection — délier un parent financeur', () => {
  function renderStudentSide() {
    mockUseAuth.mockReturnValue(buildAuthMock('eleve', STUDENT_ID))
    return render(
      <MemoryRouter>
        <ParentFinanceurSection studentId={STUDENT_ID} />
      </MemoryRouter>,
    )
  }

  it('propose un bouton « Délier » nommant le parent financeur', async () => {
    mockFetchLinkedParents.mockResolvedValue([
      { ...ACTIVE_LINK, financeOwnerName: { firstName: 'Jean', lastName: 'Martin' } },
    ])

    const { container } = renderStudentSide()

    await waitFor(() => expect(screen.getByText('Jean Martin')).toBeDefined())
    expect(screen.getByRole('button', { name: 'Délier Jean Martin' })).toBeDefined()
    expectNoTechnicalIdentifier(container)
  })

  it('ouvre une confirmation qui nomme la personne, sans aucun identifiant technique', async () => {
    const user = userEvent.setup()
    mockFetchLinkedParents.mockResolvedValue([
      { ...ACTIVE_LINK, financeOwnerName: { firstName: 'Jean', lastName: 'Martin' } },
    ])

    const { container } = renderStudentSide()
    await waitFor(() => expect(screen.getByText('Jean Martin')).toBeDefined())

    await user.click(screen.getByRole('button', { name: 'Délier Jean Martin' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Délier Jean Martin ?')
    expect(dialog.textContent).toContain("La personne n'est pas supprimée")
    expect(mockUnlinkFinanceOwnerAndStudent).not.toHaveBeenCalled()
    expectNoTechnicalIdentifier(container)
  })

  it('retire la ligne depuis la réponse du serveur, sans recharger la liste', async () => {
    const user = userEvent.setup()
    mockFetchLinkedParents.mockResolvedValue([
      { ...ACTIVE_LINK, financeOwnerName: { firstName: 'Jean', lastName: 'Martin' } },
    ])
    mockUnlinkFinanceOwnerAndStudent.mockResolvedValue(CLOSED_LINK)

    renderStudentSide()
    await waitFor(() => expect(screen.getByText('Jean Martin')).toBeDefined())

    await user.click(screen.getByRole('button', { name: 'Délier Jean Martin' }))
    await user.click(screen.getByRole('button', { name: 'Délier' }))

    await waitFor(() => {
      expect(screen.getByText("Aucun parent financeur rattaché pour l'instant.")).toBeDefined()
    })
    expect(mockUnlinkFinanceOwnerAndStudent).toHaveBeenCalledWith(FINANCE_OWNER_ID, STUDENT_ID)
    // Une seule lecture, celle du montage : la liste se met à jour depuis la réponse.
    expect(mockFetchLinkedParents).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it("affiche un message français et garde la ligne quand le serveur répond 404", async () => {
    const user = userEvent.setup()
    mockFetchLinkedParents.mockResolvedValue([
      { ...ACTIVE_LINK, financeOwnerName: { firstName: 'Jean', lastName: 'Martin' } },
    ])
    mockUnlinkFinanceOwnerAndStudent.mockRejectedValue(buildNotFoundError())

    renderStudentSide()
    await waitFor(() => expect(screen.getByText('Jean Martin')).toBeDefined())

    await user.click(screen.getByRole('button', { name: 'Délier Jean Martin' }))
    await user.click(screen.getByRole('button', { name: 'Délier' }))

    await waitFor(() => {
      expect(
        screen.getByText("Ce lien n'a pas pu être rompu : il n'existe plus, ou il ne vous appartient pas."),
      ).toBeDefined()
    })
    // La boîte reste ouverte et la ligne en place : l'utilisateur voit le refus.
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByText('Jean Martin')).toBeDefined()
  })

  it("n'envoie qu'une seule requête sur un double clic de confirmation", async () => {
    const user = userEvent.setup()
    mockFetchLinkedParents.mockResolvedValue([
      { ...ACTIVE_LINK, financeOwnerName: { firstName: 'Jean', lastName: 'Martin' } },
    ])
    let resolveUnlink: (value: typeof CLOSED_LINK) => void = () => {}
    mockUnlinkFinanceOwnerAndStudent.mockReturnValue(
      new Promise((resolve) => {
        resolveUnlink = resolve
      }),
    )

    renderStudentSide()
    await waitFor(() => expect(screen.getByText('Jean Martin')).toBeDefined())

    await user.click(screen.getByRole('button', { name: 'Délier Jean Martin' }))
    const confirmButton = screen.getByRole('button', { name: 'Délier' })
    await user.click(confirmButton)
    await user.click(screen.getByRole('button', { name: 'Rupture du lien…' }))

    expect(mockUnlinkFinanceOwnerAndStudent).toHaveBeenCalledTimes(1)

    resolveUnlink(CLOSED_LINK)
    await waitFor(() => {
      expect(screen.getByText("Aucun parent financeur rattaché pour l'instant.")).toBeDefined()
    })
  })

  it("n'appelle rien quand l'utilisateur annule", async () => {
    const user = userEvent.setup()
    mockFetchLinkedParents.mockResolvedValue([
      { ...ACTIVE_LINK, financeOwnerName: { firstName: 'Jean', lastName: 'Martin' } },
    ])

    renderStudentSide()
    await waitFor(() => expect(screen.getByText('Jean Martin')).toBeDefined())

    await user.click(screen.getByRole('button', { name: 'Délier Jean Martin' }))
    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mockUnlinkFinanceOwnerAndStudent).not.toHaveBeenCalled()
    expect(screen.getByText('Jean Martin')).toBeDefined()
  })

  it('nomme un parent sans profil administratif par un repli lisible, jamais par un UUID', async () => {
    const user = userEvent.setup()
    mockFetchLinkedParents.mockResolvedValue([{ ...ACTIVE_LINK, financeOwnerName: null }])

    const { container } = renderStudentSide()
    await waitFor(() => expect(screen.getByText('Financeur (nom non renseigné)')).toBeDefined())

    await user.click(screen.getByRole('button', { name: 'Délier Financeur (nom non renseigné)' }))

    expect(screen.getByRole('dialog').textContent).toContain('Financeur (nom non renseigné)')
    expectNoTechnicalIdentifier(container)
  })
})

// ─── Sens 2 : le parent financeur délie son élève ─────────────────────────────

describe('LinkedStudentsSection — délier un élève', () => {
  function renderFinanceOwnerSide() {
    mockUseAuth.mockReturnValue(buildAuthMock('parent_financeur', FINANCE_OWNER_ID))
    return render(
      <MemoryRouter>
        <LinkedStudentsSection parentId={FINANCE_OWNER_ID} />
      </MemoryRouter>,
    )
  }

  it('propose un bouton « Délier » nommant l\'élève', async () => {
    mockFetchLinkedStudents.mockResolvedValue([
      { ...ACTIVE_LINK, studentName: { firstName: 'Lucas', lastName: 'Martin' } },
    ])

    const { container } = renderFinanceOwnerSide()

    await waitFor(() => expect(screen.getByText('Lucas Martin')).toBeDefined())
    expect(screen.getByRole('button', { name: 'Délier Lucas Martin' })).toBeDefined()
    expectNoTechnicalIdentifier(container)
  })

  it('annonce ce que la rupture referme, du point de vue du parent financeur', async () => {
    const user = userEvent.setup()
    mockFetchLinkedStudents.mockResolvedValue([
      { ...ACTIVE_LINK, studentName: { firstName: 'Lucas', lastName: 'Martin' } },
    ])

    renderFinanceOwnerSide()
    await waitFor(() => expect(screen.getByText('Lucas Martin')).toBeDefined())

    await user.click(screen.getByRole('button', { name: 'Délier Lucas Martin' }))

    expect(screen.getByRole('dialog').textContent).toContain(
      "Vous n'aurez plus accès au profil, aux statistiques ni aux archives pédagogiques",
    )
  })

  it('retire la ligne et affiche la liste vide après une rupture réussie', async () => {
    const user = userEvent.setup()
    mockFetchLinkedStudents.mockResolvedValue([
      { ...ACTIVE_LINK, studentName: { firstName: 'Lucas', lastName: 'Martin' } },
    ])
    mockUnlinkFinanceOwnerAndStudent.mockResolvedValue({ ...CLOSED_LINK, endedBy: FINANCE_OWNER_ID })

    renderFinanceOwnerSide()
    await waitFor(() => expect(screen.getByText('Lucas Martin')).toBeDefined())

    await user.click(screen.getByRole('button', { name: 'Délier Lucas Martin' }))
    await user.click(screen.getByRole('button', { name: 'Délier' }))

    await waitFor(() => {
      expect(screen.getByText("Aucun élève rattaché pour l'instant.")).toBeDefined()
    })
    expect(mockUnlinkFinanceOwnerAndStudent).toHaveBeenCalledWith(FINANCE_OWNER_ID, STUDENT_ID)
    expect(mockFetchLinkedStudents).toHaveBeenCalledTimes(1)
  })

  it("ne retire que le lien nommé par la réponse, les autres élèves restent listés", async () => {
    const user = userEvent.setup()
    const OTHER_STUDENT_ID = '7d1c9a22-3333-4eee-9fff-000000000003'
    mockFetchLinkedStudents.mockResolvedValue([
      { ...ACTIVE_LINK, studentName: { firstName: 'Lucas', lastName: 'Martin' } },
      {
        ...ACTIVE_LINK,
        id: 'autre-lien',
        studentId: OTHER_STUDENT_ID,
        studentName: { firstName: 'Emma', lastName: 'Martin' },
      },
    ])
    mockUnlinkFinanceOwnerAndStudent.mockResolvedValue({ ...CLOSED_LINK, endedBy: FINANCE_OWNER_ID })

    renderFinanceOwnerSide()
    await waitFor(() => expect(screen.getByText('Lucas Martin')).toBeDefined())

    await user.click(screen.getByRole('button', { name: 'Délier Lucas Martin' }))
    await user.click(screen.getByRole('button', { name: 'Délier' }))

    await waitFor(() => expect(screen.queryByText('Lucas Martin')).toBeNull())
    expect(screen.getByText('Emma Martin')).toBeDefined()
  })

  it('affiche un message français quand le serveur répond une erreur inattendue', async () => {
    const user = userEvent.setup()
    mockFetchLinkedStudents.mockResolvedValue([
      { ...ACTIVE_LINK, studentName: { firstName: 'Lucas', lastName: 'Martin' } },
    ])
    mockUnlinkFinanceOwnerAndStudent.mockRejectedValue({ response: { status: 500, data: {} } })

    renderFinanceOwnerSide()
    await waitFor(() => expect(screen.getByText('Lucas Martin')).toBeDefined())

    await user.click(screen.getByRole('button', { name: 'Délier Lucas Martin' }))
    await user.click(screen.getByRole('button', { name: 'Délier' }))

    await waitFor(() => {
      expect(
        screen.getByText('Le serveur rencontre un problème. Veuillez réessayer plus tard.'),
      ).toBeDefined()
    })
    expect(screen.getByText('Lucas Martin')).toBeDefined()
  })
})
